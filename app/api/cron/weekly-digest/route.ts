/**
 * Weekly cron -- Learning digest email.
 * Triggered by QStash every Monday at 08:00.
 *
 * Sends each student assigned to a cohort a summary of:
 *   - What they completed this week
 *   - What's in progress
 *   - Overdue items (deadline passed, not completed)
 *   - Programs not yet started
 */
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminClient } from '@/lib/subscription';
import { verifyQStashRequest } from '@/lib/qstash';
import { weeklyDigestEmail } from '@/lib/email-templates';
import { hasNudgeBeenSent, recordNudge } from '@/lib/nudge-helpers';

export const dynamic = 'force-dynamic';

const resend  = new Resend(process.env.RESEND_API_KEY);
const FROM    = process.env.RESEND_FROM_EMAIL || 'AI Skills Africa <support@app.aiskillsafrica.com>';
const APP_URL = process.env.APP_URL || 'https://app.aiskillsafrica.com';

export async function POST(req: NextRequest) {
  const { valid } = await verifyQStashRequest(req);
  if (!valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
  }

  const supabase = adminClient();
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  // -- 1. Fetch all cohort assignments --
  const { data: cohortAssignments } = await supabase
    .from('cohort_assignments')
    .select('form_id, cohort_id, assigned_at');

  if (!cohortAssignments?.length) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
  }

  // -- 2. Fetch all relevant published forms --
  const formIds = [...new Set(cohortAssignments.map((a: any) => a.form_id))];
  const { data: forms } = await supabase
    .from('forms')
    .select('id, title, slug, content_type, config')
    .in('id', formIds)
    .eq('status', 'published');

  const formMap = new Map((forms ?? []).map((f: any) => [f.id, f]));

  // -- 3. Fetch all students in the relevant cohorts --
  const cohortIds = [...new Set(cohortAssignments.map((a: any) => a.cohort_id))];
  const { data: students } = await supabase
    .from('students')
    .select('id, email, full_name, cohort_id')
    .in('cohort_id', cohortIds);

  if (!students?.length) return NextResponse.json({ ok: true, sent: 0, skipped: 0 });

  // -- 4. Fetch all attempts for the relevant forms --
  const [{ data: courseAttempts }, { data: gpAttempts }] = await Promise.all([
    supabase
      .from('course_attempts')
      .select('student_id, form_id, completed_at, score, updated_at')
      .in('form_id', formIds),
    supabase
      .from('guided_project_attempts')
      .select('student_id, form_id, completed_at, updated_at')
      .in('form_id', formIds),
  ]);

  // Map: `${studentId}|${formId}` -> attempt
  type AttemptData = { completedAt: string | null; score?: number | null; updatedAt: string };
  const attemptMap = new Map<string, AttemptData>();

  for (const a of courseAttempts ?? []) {
    attemptMap.set(`${a.student_id}|${a.form_id}`, {
      completedAt: a.completed_at,
      score: a.score,
      updatedAt: a.updated_at,
    });
  }
  for (const a of gpAttempts ?? []) {
    const key = `${a.student_id}|${a.form_id}`;
    if (!attemptMap.has(key)) {
      attemptMap.set(key, { completedAt: a.completed_at, updatedAt: a.updated_at });
    }
  }

  // -- 5. Build cohort assignments map --
  const assignmentsByCohort = new Map<string, typeof cohortAssignments>();
  for (const a of cohortAssignments) {
    if (!assignmentsByCohort.has(a.cohort_id)) assignmentsByCohort.set(a.cohort_id, []);
    assignmentsByCohort.get(a.cohort_id)!.push(a);
  }

  // -- 6. Build and send one digest per student --
  let sent = 0;
  let skipped = 0;

  for (const student of students) {
    const email = ((student.email as string) ?? '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

    const alreadySent = await hasNudgeBeenSent(supabase, student.id, null, 'weekly_digest', 6);
    if (alreadySent) { skipped++; continue; }

    const assignments = assignmentsByCohort.get(student.cohort_id) ?? [];

    const completed:       { title: string; contentType: string; score?: number | null }[] = [];
    const inProgress:      { title: string; contentType: string }[] = [];
    const notStarted:      { title: string; contentType: string }[] = [];
    const missedDeadlines: { title: string; contentType: string; daysOverdue: number }[] = [];

    for (const assignment of assignments) {
      const form = formMap.get(assignment.form_id);
      if (!form) continue;

      const isVE = form.content_type === 'virtual_experience' || form.content_type === 'guided_project';
      const contentType = isVE ? 'virtual_experience' : form.content_type;
      const attempt = attemptMap.get(`${student.id}|${assignment.form_id}`);

      // Deadline check
      let isOverdue = false;
      let daysOverdue = 0;
      if (form.config?.deadline_days) {
        const deadline = new Date(assignment.assigned_at).getTime() + Number(form.config.deadline_days) * 86400000;
        if (now > deadline && !attempt?.completedAt) {
          isOverdue = true;
          daysOverdue = Math.floor((now - deadline) / 86400000);
        }
      }

      if (!attempt) {
        // Never opened
        if (isOverdue) {
          missedDeadlines.push({ title: form.title, contentType, daysOverdue });
        } else {
          notStarted.push({ title: form.title, contentType });
        }
      } else if (attempt.completedAt) {
        // Completed -- only highlight if finished this week
        if (attempt.completedAt >= sevenDaysAgo) {
          completed.push({ title: form.title, contentType, score: attempt.score });
        }
      } else {
        // Started but not finished
        if (isOverdue) {
          missedDeadlines.push({ title: form.title, contentType, daysOverdue });
        } else {
          inProgress.push({ title: form.title, contentType });
        }
      }
    }

    // Nothing meaningful to show -- skip
    if (!completed.length && !inProgress.length && !notStarted.length && !missedDeadlines.length) {
      skipped++;
      continue;
    }

    const subject = missedDeadlines.length > 0
      ? `⚠️ ${missedDeadlines.length} overdue item${missedDeadlines.length > 1 ? 's' : ''} -- your weekly update`
      : completed.length > 0
        ? `You completed ${completed.length} item${completed.length > 1 ? 's' : ''} this week 🎓`
        : `Your weekly learning update -- keep going!`;

    const html = weeklyDigestEmail({
      name: student.full_name || 'there',
      completed,
      inProgress,
      notStarted,
      missedDeadlines,
      dashboardUrl: `${APP_URL}/student`,
    });

    try {
      await resend.emails.send({ from: FROM, to: email, subject, html });
      await recordNudge(supabase, student.id, null, 'weekly_digest');
      sent++;
    } catch (err) {
      console.error('[cron/weekly-digest] send failed for', email, err);
    }
  }

  console.log(`[cron/weekly-digest] sent=${sent} skipped=${skipped}`);
  return NextResponse.json({ ok: true, sent, skipped });
}
