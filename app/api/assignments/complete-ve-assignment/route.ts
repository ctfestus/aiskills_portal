import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { Resend } from 'resend';
import { submissionConfirmEmail } from '@/lib/email-templates';
import { getTenantSettings } from '@/lib/get-tenant-settings';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const supabase = adminClient();
  const { data: { user }, error } = await supabase.auth.getUser(auth.slice(7));
  if (error || !user) return null;
  return user;
}

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { assignmentId, progress, currentModuleId, currentLessonId } = body;

  if (!assignmentId) return NextResponse.json({ error: 'assignmentId required' }, { status: 400 });

  const supabase = adminClient();

  // Fetch assignment and student profile in parallel
  const [{ data: assignment }, { data: studentRow }] = await Promise.all([
    supabase.from('assignments')
      .select('id, title, config, cohort_ids, status, type')
      .eq('id', assignmentId)
      .single(),
    supabase.from('students')
      .select('id, cohort_id, full_name, email')
      .eq('id', user.id)
      .single(),
  ]);

  if (!assignment || assignment.status !== 'published') {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }
  if (assignment.type !== 'virtual_experience') {
    return NextResponse.json({ error: 'Not a virtual experience assignment' }, { status: 400 });
  }

  const cohortIds: string[] = Array.isArray(assignment.cohort_ids) ? assignment.cohort_ids : [];
  if (!studentRow?.cohort_id || !cohortIds.includes(studentRow.cohort_id)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const veFormId: string | null = assignment.config?.ve_form_id ?? null;
  if (!veFormId) {
    return NextResponse.json({ error: 'Assignment has no linked virtual experience' }, { status: 400 });
  }

  // Fetch VE for server-side completion validation
  const { data: ve } = await supabase.from('virtual_experiences')
    .select('id, modules, status')
    .eq('id', veFormId)
    .single();

  if (!ve || ve.status !== 'published') {
    return NextResponse.json({ error: 'Virtual experience not found' }, { status: 404 });
  }

  // Server-validate completion. MCQ requires correct answer; all other types trust the completed flag.
  let totalReqs = 0;
  let doneReqs = 0;
  for (const mod of (Array.isArray(ve.modules) ? ve.modules : [])) {
    for (const lesson of mod.lessons ?? []) {
      for (const req of lesson.requirements ?? []) {
        totalReqs++;
        const entry = (progress ?? {})[req.id];
        if (!entry) continue;
        if (req.type === 'mcq') {
          if (entry.selectedAnswer === req.correctAnswer) doneReqs++;
        } else {
          if (entry.completed) doneReqs++;
        }
      }
    }
  }

  if (totalReqs === 0 || doneReqs < totalReqs) {
    return NextResponse.json(
      { error: `Not all requirements are complete (${doneReqs} of ${totalReqs} done)` },
      { status: 400 },
    );
  }

  // Single atomic RPC: validates linkage and student access inside the transaction,
  // writes guided_project_attempts.completed_at, then upserts assignment_submissions.
  // Graded rows are not touched (WHERE clause in ON CONFLICT DO UPDATE).
  const { data: rpcResult, error: rpcError } = await supabase.rpc('complete_ve_assignment', {
    p_ve_id:             veFormId,
    p_assignment_id:     assignmentId,
    p_student_id:        user.id,
    p_progress:          progress || {},
    p_current_module_id: currentModuleId || null,
    p_current_lesson_id: currentLessonId || null,
  });

  if (rpcError) {
    console.error('[complete-ve-assignment] rpc error:', rpcError);
    return NextResponse.json({ error: 'Failed to complete assignment.' }, { status: 500 });
  }

  const submission = rpcResult?.submission ?? null;

  // Exactly-once confirmation email using email_dedup insert-as-lock.
  // Two concurrent calls both writing for the first time will race on the INSERT;
  // only one gets the row, the other hits 23505 and skips.
  if (process.env.RESEND_API_KEY && studentRow?.email && submission?.id) {
    (async () => {
      try {
        const dedupeKey = submission.id as string;
        const emailType = 've-assignment-submission-confirm';

        // Attempt to acquire the send lock.
        const { error: lockError } = await supabase
          .from('email_dedup')
          .insert({ dedupe_key: dedupeKey, type: emailType, status: 'pending' });

        if (lockError) {
          if (lockError.code !== '23505') {
            console.error('[complete-ve-assignment] unexpected email_dedup lock error:', lockError);
            return;
          }

          // Another process holds or held the lock. Check its status and age.
          const { data: existing } = await supabase
            .from('email_dedup')
            .select('status, sent_at')
            .eq('dedupe_key', dedupeKey)
            .eq('type', emailType)
            .maybeSingle();

          if (existing?.status === 'sent') return; // already sent, done

          // pending + recent = another request is actively sending right now. Skip.
          // pending + stale (>10 min) = prior holder crashed before marking sent. Reclaim.
          const STALE_MS = 10 * 60 * 1000;
          const ageMs = existing?.sent_at ? Date.now() - new Date(existing.sent_at).getTime() : 0;
          if (ageMs < STALE_MS) return;

          // Stale lock: delete and re-acquire once. If another process beats us here, give up.
          await supabase.from('email_dedup')
            .delete()
            .eq('dedupe_key', dedupeKey)
            .eq('type', emailType)
            .eq('status', 'pending');

          const { error: retryError } = await supabase
            .from('email_dedup')
            .insert({ dedupe_key: dedupeKey, type: emailType, status: 'pending' });

          if (retryError) return; // lost the re-acquire race, give up
        }

        // Lock acquired. Send the email.
        const t = await getTenantSettings();
        const FROM = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
        const branding = { logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl, teamName: t.teamName, appName: t.appName, appUrl: t.appUrl };

        await resend.emails.send({
          from:    FROM,
          to:      studentRow.email,
          subject: `Submission received: ${assignment.title}`,
          html:    submissionConfirmEmail({
            name:            studentRow.full_name || 'there',
            assignmentTitle: assignment.title,
            dashboardUrl:    `${t.appUrl}/student?section=assignments`,
            branding,
          }),
        });

        // Mark as sent so future callers know the email was delivered.
        await supabase.from('email_dedup')
          .update({ status: 'sent' })
          .eq('dedupe_key', dedupeKey)
          .eq('type', emailType);

      } catch (err) {
        console.error('[complete-ve-assignment] email error:', err);
      }
    })();
  }

  return NextResponse.json({ success: true, submission });
}
