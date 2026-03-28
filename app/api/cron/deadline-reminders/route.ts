/**
 * Daily cron -- Deadline reminder emails.
 * Triggered by QStash at 08:00 every day.
 * Sends a reminder to students whose deadline is within 3 days (including overdue, up to 1 day past).
 * Uses sent_nudges to prevent resending within 1 day.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminClient } from '@/lib/subscription';
import { verifyQStashRequest } from '@/lib/qstash';
import { deadlineReminderEmail } from '@/lib/email-templates';
import { hasNudgeBeenSent, recordNudge } from '@/lib/nudge-helpers';

export const dynamic = 'force-dynamic';

const resend  = new Resend(process.env.RESEND_API_KEY);
const FROM    = process.env.RESEND_FROM_EMAIL || 'AI Skills Africa <support@app.aiskillsafrica.com>';
const APP_URL = process.env.APP_URL || 'https://app.aiskillsafrica.com';

export async function POST(req: NextRequest) {
  const REMINDER_DAYS_BEFORE = Number(process.env.DEADLINE_REMINDER_DAYS ?? 3);

  const { valid } = await verifyQStashRequest(req);
  if (!valid) {
    console.error('[cron/deadline-reminders] Unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
  }

  const supabase = adminClient();

  // Fetch all cohort_assignments (we'll filter by deadline in code)
  const { data: assignments } = await supabase
    .from('cohort_assignments')
    .select('form_id, cohort_id, assigned_at');

  if (!assignments?.length) {
    console.log('[cron/deadline-reminders] No cohort assignments found');
    return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
  }

  // Fetch the forms that have deadline_days configured
  const formIds = [...new Set(assignments.map(a => a.form_id))];
  const { data: forms } = await supabase
    .from('forms')
    .select('id, title, slug, content_type, config')
    .in('id', formIds);

  if (!forms?.length) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
  }

  const formMap = new Map(forms.map(f => [f.id, f]));

  // Find assignments where deadline is between -1 day and +3 days from now
  const now = Date.now();
  const candidates: { formId: string; cohortId: string; daysLeft: number; form: any }[] = [];

  for (const assignment of assignments) {
    const form = formMap.get(assignment.form_id);
    if (!form?.config?.deadline_days) continue;

    const deadline = new Date(assignment.assigned_at).getTime() + Number(form.config.deadline_days) * 86400000;
    const daysLeft = Math.ceil((deadline - now) / 86400000);

    // Only send for: overdue by ≤1 day OR due within REMINDER_DAYS_BEFORE days
    if (daysLeft > REMINDER_DAYS_BEFORE || daysLeft < -1) continue;

    candidates.push({ formId: assignment.form_id, cohortId: assignment.cohort_id, daysLeft, form });
  }

  if (!candidates.length) {
    console.log('[cron/deadline-reminders] No deadlines in range today');
    return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
  }

  // Collect unique cohort IDs to fetch students
  const cohortIds = [...new Set(candidates.map(c => c.cohortId))];
  const { data: students } = await supabase
    .from('students')
    .select('email, full_name, cohort_id')
    .in('cohort_id', cohortIds);

  if (!students?.length) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
  }

  // Build student map: cohortId -> students[]
  const studentsByCohort = new Map<string, typeof students>();
  for (const student of students) {
    if (!studentsByCohort.has(student.cohort_id)) studentsByCohort.set(student.cohort_id, []);
    studentsByCohort.get(student.cohort_id)!.push(student);
  }

  // Fetch all relevant attempts to skip already-completed students
  const candidateFormIds = [...new Set(candidates.map(c => c.formId))];
  const [{ data: courseAttempts }, { data: gpAttempts }] = await Promise.all([
    supabase
      .from('course_attempts')
      .select('student_email, form_id, completed_at')
      .in('form_id', candidateFormIds)
      .not('completed_at', 'is', null),
    supabase
      .from('guided_project_attempts')
      .select('student_email, form_id, completed_at')
      .in('form_id', candidateFormIds)
      .not('completed_at', 'is', null),
  ]);

  const completedSet = new Set<string>();
  for (const a of [...(courseAttempts ?? []), ...(gpAttempts ?? [])]) {
    completedSet.add(`${a.student_email}|${a.form_id}`);
  }

  let sent = 0;
  let skipped = 0;

  for (const { formId, cohortId, daysLeft, form } of candidates) {
    const cohortStudents = studentsByCohort.get(cohortId) ?? [];
    const slug = form.slug ?? formId;
    const isVE = form.content_type === 'virtual_experience' || form.content_type === 'guided_project';
    const contentType = isVE ? 'virtual_experience' : form.content_type;

    for (const student of cohortStudents) {
      const email = (student.email ?? '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

      // Skip completed students
      if (completedSet.has(`${email}|${formId}`)) { skipped++; continue; }

      // Skip if already nudged today
      const alreadySent = await hasNudgeBeenSent(supabase, email, formId, 'deadline_reminder', 1);
      if (alreadySent) { skipped++; continue; }

      const name    = student.full_name || 'there';
      const subject = daysLeft <= 0
        ? `⚠ Deadline passed: ${form.title}`
        : daysLeft === 1
          ? `Last chance! Your deadline is tomorrow: ${form.title}`
          : `Reminder: ${daysLeft} days left to complete "${form.title}"`;

      const html = deadlineReminderEmail({
        name,
        contentTitle: form.title,
        contentType,
        formUrl: `${APP_URL}/${slug}`,
        daysLeft,
      });

      try {
        await resend.emails.send({ from: FROM, to: email, subject, html });
        await recordNudge(supabase, email, formId, 'deadline_reminder');
        sent++;
      } catch (err) {
        console.error('[cron/deadline-reminders] send failed for', email, err);
      }
    }
  }

  console.log(`[cron/deadline-reminders] sent=${sent} skipped=${skipped}`);
  return NextResponse.json({ ok: true, sent, skipped });
}
