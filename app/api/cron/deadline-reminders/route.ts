/**
 * Daily cron -- Deadline reminder emails.
 * Triggered by QStash at 08:00 every day.
 * Sends a reminder to students whose deadline is within DEADLINE_REMINDER_DAYS days
 * (including overdue, up to 1 day past).
 *
 * Performance: all DB reads are bulk-fetched before the loop; emails are sent
 * via Resend batch API (100/call); nudge records are bulk-inserted after sending.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminClient } from '@/lib/subscription';
import { verifyQStashRequest } from '@/lib/qstash';
import { deadlineReminderEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

const resend  = new Resend(process.env.RESEND_API_KEY);
const FROM    = process.env.RESEND_FROM_EMAIL || 'AI Skills Africa <support@app.aiskillsafrica.com>';
const APP_URL = process.env.APP_URL || 'https://app.aiskillsafrica.com';

const BATCH_SIZE = 100; // Resend batch limit

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

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

  // -- 1. Bulk fetch all cohort assignments ---
  const { data: assignments } = await supabase
    .from('cohort_assignments')
    .select('form_id, cohort_id, assigned_at');

  if (!assignments?.length) {
    console.log('[cron/deadline-reminders] No cohort assignments found');
    return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
  }

  // -- 2. Bulk fetch forms with deadlines ---
  const formIds = [...new Set(assignments.map(a => a.form_id))];
  const { data: forms } = await supabase
    .from('forms')
    .select('id, title, slug, content_type, config')
    .in('id', formIds);

  if (!forms?.length) return NextResponse.json({ ok: true, sent: 0, skipped: 0 });

  const formMap = new Map(forms.map(f => [f.id, f]));

  // -- 3. Find candidates within the deadline window ---
  const now = Date.now();
  const candidates: { formId: string; cohortId: string; daysLeft: number; form: any }[] = [];

  for (const assignment of assignments) {
    const form = formMap.get(assignment.form_id);
    if (!form?.config?.deadline_days) continue;

    const deadline = new Date(assignment.assigned_at).getTime() + Number(form.config.deadline_days) * 86400000;
    const daysLeft = Math.ceil((deadline - now) / 86400000);

    if (daysLeft > REMINDER_DAYS_BEFORE || daysLeft < -1) continue;
    candidates.push({ formId: assignment.form_id, cohortId: assignment.cohort_id, daysLeft, form });
  }

  if (!candidates.length) {
    console.log('[cron/deadline-reminders] No deadlines in range today');
    return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
  }

  // -- 4. Bulk fetch students, completed attempts, and today's nudges ---
  const candidateFormIds  = [...new Set(candidates.map(c => c.formId))];
  const candidateCohortIds = [...new Set(candidates.map(c => c.cohortId))];
  const since1Day = new Date(now - 86400000).toISOString();

  const [
    { data: students },
    { data: courseAttempts },
    { data: gpAttempts },
    { data: recentNudges },
  ] = await Promise.all([
    supabase
      .from('students')
      .select('email, full_name, cohort_id')
      .in('cohort_id', candidateCohortIds),
    supabase
      .from('course_attempts')
      .select('student_email, form_id')
      .in('form_id', candidateFormIds)
      .not('completed_at', 'is', null),
    supabase
      .from('guided_project_attempts')
      .select('student_email, form_id')
      .in('form_id', candidateFormIds)
      .not('completed_at', 'is', null),
    // Pre-fetch all deadline_reminder nudges sent in the last 24h for these forms
    supabase
      .from('sent_nudges')
      .select('student_email, form_id')
      .eq('nudge_type', 'deadline_reminder')
      .in('form_id', candidateFormIds)
      .gte('sent_at', since1Day),
  ]);

  // Build lookup sets for O(1) checks
  const completedSet = new Set<string>();
  for (const a of [...(courseAttempts ?? []), ...(gpAttempts ?? [])]) {
    completedSet.add(`${a.student_email}|${a.form_id}`);
  }

  const nudgedSet = new Set<string>();
  for (const n of recentNudges ?? []) {
    nudgedSet.add(`${n.student_email}|${n.form_id}`);
  }

  const studentsByCohort = new Map<string, typeof students>();
  for (const student of students ?? []) {
    if (!studentsByCohort.has(student.cohort_id)) studentsByCohort.set(student.cohort_id, []);
    studentsByCohort.get(student.cohort_id)!.push(student);
  }

  // -- 5. Build email batch and nudge records ---
  type EmailPayload = Parameters<typeof resend.batch.send>[0][number];
  const emailBatch:  EmailPayload[] = [];
  const nudgeRecords: { student_email: string; form_id: string; nudge_type: string }[] = [];
  let skipped = 0;

  for (const { formId, cohortId, daysLeft, form } of candidates) {
    const cohortStudents = studentsByCohort.get(cohortId) ?? [];
    const slug = form.slug ?? formId;
    const isVE = form.content_type === 'virtual_experience' || form.content_type === 'guided_project';
    const contentType = isVE ? 'virtual_experience' : form.content_type;

    for (const student of cohortStudents) {
      const email = (student.email ?? '').trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

      if (completedSet.has(`${email}|${formId}`)) { skipped++; continue; }
      if (nudgedSet.has(`${email}|${formId}`))     { skipped++; continue; }

      const subject = daysLeft <= 0
        ? `⚠ Deadline passed: ${form.title}`
        : daysLeft === 1
          ? `Last chance! Your deadline is tomorrow: ${form.title}`
          : `Reminder: ${daysLeft} days left to complete "${form.title}"`;

      emailBatch.push({
        from:    FROM,
        to:      email,
        subject,
        html: deadlineReminderEmail({
          name: student.full_name || 'there',
          contentTitle: form.title,
          contentType,
          formUrl: `${APP_URL}/${slug}`,
          daysLeft,
        }),
      });

      nudgeRecords.push({ student_email: email, form_id: formId, nudge_type: 'deadline_reminder' });
    }
  }

  if (!emailBatch.length) {
    console.log('[cron/deadline-reminders] Nothing to send after dedup');
    return NextResponse.json({ ok: true, sent: 0, skipped });
  }

  // -- 6. Send in batches of 100 (Resend limit) ---
  // Track sent records as composite email|form_id keys so that a student with
  // multiple deadlines cannot have a failed form marked as sent just because
  // another of their emails happened to succeed in an earlier batch.
  const sentKeySet = new Set<string>();
  const batches = chunk(emailBatch, BATCH_SIZE);
  let sent = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNudges = nudgeRecords.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    try {
      await resend.batch.send(batch);
      sent += batch.length;
      for (const n of batchNudges) {
        sentKeySet.add(`${n.student_email}|${n.form_id}`);
      }
    } catch (err) {
      console.error('[cron/deadline-reminders] batch send failed:', err);
    }
  }

  // -- 7. Bulk insert nudge records for successfully sent emails ---
  if (sentKeySet.size) {
    const toInsert = nudgeRecords.filter(n => sentKeySet.has(`${n.student_email}|${n.form_id}`));
    if (toInsert.length) {
      await supabase.from('sent_nudges').insert(toInsert);
    }
  }

  console.log(`[cron/deadline-reminders] sent=${sent} skipped=${skipped}`);
  return NextResponse.json({ ok: true, sent, skipped });
}
