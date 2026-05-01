import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { milestoneEmail, courseResultEmail } from '@/lib/email-templates';
import { hasNudgeBeenSent, recordNudge, totalRequirements, completedRequirements } from '@/lib/nudge-helpers';
import { getTenantSettings } from '@/lib/get-tenant-settings';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

const adminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getUser(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await adminClient().auth.getUser(auth.slice(7));
  if (error || !user) return null;
  return user;
}

// -- GET /api/guided-project-progress?veId= ---
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const veId      = searchParams.get('veId') ?? searchParams.get('formId'); // formId kept for backward compat
  const studentId = searchParams.get('studentId');

  if (!veId) return NextResponse.json({ error: 'veId required' }, { status: 400 });

  const supabase = adminClient();

  // Creator/admin view -- return all attempts for a VE
  if (!studentId) {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [{ data: ve }, { data: profile }] = await Promise.all([
      supabase.from('virtual_experiences').select('user_id').eq('id', veId).single(),
      supabase.from('students').select('role').eq('id', user.id).single(),
    ]);
    const isAdmin = profile?.role === 'admin';
    if (!ve || (ve.user_id !== user.id && !isAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch VE cohort_ids, all enrolled students, and all attempts in parallel
    const [{ data: veData }, { data: attempts }] = await Promise.all([
      supabase.from('virtual_experiences').select('cohort_ids').eq('id', veId).single(),
      supabase
        .from('guided_project_attempts')
        .select('id, student_id, progress, completed_at, started_at, updated_at, review')
        .eq('ve_id', veId),
    ]);

    const cohortIds: string[] = veData?.cohort_ids ?? [];

    // Get all students enrolled in this VE's cohorts
    const { data: enrolledStudents } = cohortIds.length > 0
      ? await supabase
          .from('students')
          .select('id, full_name, email, cohort_id')
          .in('cohort_id', cohortIds)
          .eq('role', 'student')
          .order('full_name', { ascending: true })
      : { data: [] };

    // Merge: every enrolled student gets a row; attempt fields are null if not started
    const attemptsMap = new Map((attempts ?? []).map((a: any) => [a.student_id, a]));
    const merged = (enrolledStudents ?? []).map((s: any) => {
      const attempt = attemptsMap.get(s.id) as any;
      return {
        id:            attempt?.id            ?? null,
        student_id:    s.id,
        student_name:  s.full_name            ?? null,
        student_email: s.email                ?? null,
        cohort_id:     s.cohort_id            ?? null,
        progress:      attempt?.progress      ?? null,
        completed_at:  attempt?.completed_at  ?? null,
        started_at:    attempt?.started_at    ?? null,
        updated_at:    attempt?.updated_at    ?? null,
        review:        attempt?.review        ?? null,
      };
    });

    return NextResponse.json({ attempts: merged });
  }

  // Student view
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.id !== studentId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: attempt } = await supabase
    .from('guided_project_attempts')
    .select('*')
    .eq('ve_id', veId)
    .eq('student_id', user.id)
    .maybeSingle();

  return NextResponse.json({ attempt: attempt ?? null });
}

// -- POST /api/guided-project-progress ---
export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = adminClient();

  // -- Instructor review --
  if (body.action === 'review') {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { attemptId, score, feedback } = body;
    if (!attemptId) return NextResponse.json({ error: 'attemptId required' }, { status: 400 });

    const { data: attempt } = await supabase
      .from('guided_project_attempts')
      .select('ve_id')
      .eq('id', attemptId)
      .single();

    if (!attempt) return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });

    const [{ data: ve }, { data: reviewProfile }] = await Promise.all([
      supabase.from('virtual_experiences').select('user_id').eq('id', attempt.ve_id).single(),
      supabase.from('students').select('role').eq('id', user.id).single(),
    ]);
    const isAdmin = reviewProfile?.role === 'admin';
    if (!ve || (ve.user_id !== user.id && !isAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase
      .from('guided_project_attempts')
      .update({
        review: {
          score:       Number(score) || 0,
          feedback:    String(feedback || '').slice(0, 2000),
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        },
      })
      .eq('id', attemptId);

    if (error) { console.error('[guided-project-progress]', error); return NextResponse.json({ error: 'Failed to save. Please try again.' }, { status: 500 }); }
    return NextResponse.json({ success: true });
  }

  // -- Issue certificate --
  if (body.action === 'issue-certificate') {
    const { veId, studentName } = body;
    // Accept veId or formId (backward compat)
    const resolvedVeId = veId ?? body.formId;
    if (!resolvedVeId) return NextResponse.json({ error: 'veId required' }, { status: 400 });

    const certUser = await getUser(req);
    if (!certUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: attempt } = await supabase
      .from('guided_project_attempts')
      .select('id, completed_at')
      .eq('ve_id', resolvedVeId)
      .eq('student_id', certUser.id)
      .not('completed_at', 'is', null)
      .maybeSingle();

    if (!attempt) return NextResponse.json({ error: 'Project not completed' }, { status: 403 });

    const { data: existing } = await supabase
      .from('certificates')
      .select('id')
      .eq('ve_id', resolvedVeId)
      .eq('student_id', certUser.id)
      .eq('revoked', false)
      .maybeSingle();

    if (existing?.id) return NextResponse.json({ certId: existing.id });

    const { data: cert, error: certErr } = await supabase
      .from('certificates')
      .insert({
        ve_id:        resolvedVeId,
        student_name: studentName || certUser.email,
        student_id:   certUser.id,
      })
      .select('id')
      .single();

    if (certErr) { console.error('[guided-project-progress] certificate error:', certErr); return NextResponse.json({ error: 'Failed to issue certificate.' }, { status: 500 }); }

    // Fire-and-forget certificate email
    if (process.env.RESEND_API_KEY) {
      (async () => {
        try {
          const [{ data: ve }, { data: student }] = await Promise.all([
            supabase.from('virtual_experiences').select('title, slug').eq('id', resolvedVeId).single(),
            supabase.from('students').select('email, full_name').eq('id', certUser.id).single(),
          ]);
          if (!student?.email || !ve) return;

          const t        = await getTenantSettings();
          const FROM     = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
          const branding = { logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl, teamName: t.teamName, appName: t.appName, appUrl: t.appUrl };
          const certUrl  = `${t.appUrl}/certificate/${cert.id}`;
          const formUrl  = `${t.appUrl}/${ve.slug ?? resolvedVeId}`;

          await resend.emails.send({
            from:    FROM,
            to:      student.email,
            subject: `Your certificate is ready: ${ve.title}`,
            html:    courseResultEmail({
              name:        studentName || student.full_name || 'there',
              courseTitle: ve.title,
              score:       0,
              total:       0,
              percentage:  100,
              passed:      true,
              certUrl,
              formUrl,
              branding,
            }),
          });
        } catch (emailErr) {
          console.error('[guided-project-progress] certificate email failed', emailErr);
        }
      })();
    }

    return NextResponse.json({ certId: cert.id });
  }

  // -- Student progress save --
  const { veId, formId, studentName, progress, currentModuleId, currentLessonId, completedAt } = body;
  const resolvedVeId = veId ?? formId; // formId kept for backward compat

  if (!resolvedVeId) return NextResponse.json({ error: 'veId required' }, { status: 400 });

  const progressUser = await getUser(req);
  if (!progressUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('guided_project_attempts')
    .upsert(
      {
        ve_id:             resolvedVeId,
        student_id:        progressUser.id,
        progress:          progress || {},
        current_module_id: currentModuleId || null,
        current_lesson_id: currentLessonId || null,
        completed_at:      completedAt || null,
      },
      { onConflict: 'student_id,ve_id' },
    );

  if (error) { console.error('[guided-project-progress] upsert error:', error); return NextResponse.json({ error: 'Failed to save progress.' }, { status: 500 }); }

  // -- 80% milestone check (fire-and-forget) --
  if (progress && !completedAt && process.env.RESEND_API_KEY) {
    (async () => {
      try {
        const { data: ve } = await supabase
          .from('virtual_experiences')
          .select('modules, title, slug')
          .eq('id', resolvedVeId)
          .single();

        if (!ve) return;
        const total = totalRequirements(ve.modules);
        if (total === 0) return;

        const done = completedRequirements(progress);
        const pct  = Math.round((done / total) * 100);
        if (pct < 80) return;

        const alreadySent = await hasNudgeBeenSent(supabase, progressUser.id, resolvedVeId, 'milestone_80');
        if (alreadySent) return;

        const { data: studentProfile } = await supabase
          .from('students')
          .select('email, full_name')
          .eq('id', progressUser.id)
          .single();

        if (!studentProfile?.email) return;

        const t        = await getTenantSettings();
        const FROM     = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
        const branding = { logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl, teamName: t.teamName, appName: t.appName, appUrl: t.appUrl };

        const html = milestoneEmail({
          name:         studentName || studentProfile.full_name || 'there',
          contentTitle: ve.title,
          contentType:  'virtual_experience',
          formUrl:      `${t.appUrl}/${ve.slug ?? resolvedVeId}`,
          branding,
        });

        await resend.emails.send({
          from: FROM,
          to:   studentProfile.email,
          subject: `You are 80% done. Finish strong! 🎯`,
          html,
        });
        await recordNudge(supabase, progressUser.id, resolvedVeId, 'milestone_80');
      } catch (err) {
        console.error('[guided-project-progress] milestone check failed', err);
      }
    })();
  }

  return NextResponse.json({ success: true });
}
