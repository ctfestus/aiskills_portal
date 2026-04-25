/**
 * Daily cron -- Deadline reminder emails.
 * Triggered by QStash at 08:00 every day.
 * Sends a reminder to students whose deadline is within DEADLINE_REMINDER_DAYS days
 * (including overdue, up to 1 day past).
 */
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminClient } from '@/lib/admin-client';
import { verifyQStashRequest } from '@/lib/qstash';
import { deadlineReminderEmail } from '@/lib/email-templates';
import { getTenantSettings } from '@/lib/get-tenant-settings';

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 100;

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

const resend = new Resend(process.env.RESEND_API_KEY);

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

  const supabase  = adminClient();
  const now       = Date.now();
  const since1Day = new Date(now - 86400000).toISOString();

  const t        = await getTenantSettings();
  const FROM     = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
  const branding = { logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl, teamName: t.teamName, appName: t.appName, appUrl: t.appUrl };

  type EmailPayload = Parameters<typeof resend.batch.send>[0][number];
  const emailBatch:   EmailPayload[] = [];
  const nudgeRecords: { student_id: string; form_id: string; nudge_type: string }[] = [];
  let skipped = 0;

  // -- 1. Courses / Events / VEs via cohort_assignments ---
  const { data: cohortAssignments } = await supabase
    .from('cohort_assignments')
    .select('content_id, content_type, cohort_id, assigned_at');

  if (cohortAssignments?.length) {
    const courseIds = [...new Set(cohortAssignments.filter(a => a.content_type === 'course').map(a => a.content_id))];
    const eventIds  = [...new Set(cohortAssignments.filter(a => a.content_type === 'event').map(a => a.content_id))];
    const veIds     = [...new Set(cohortAssignments.filter(a => a.content_type === 'virtual_experience').map(a => a.content_id))];

    const [{ data: courses }, { data: events }, { data: ves }] = await Promise.all([
      courseIds.length ? supabase.from('courses').select('id, title, slug, deadline_days').in('id', courseIds) : Promise.resolve({ data: [] }),
      eventIds.length  ? supabase.from('events').select('id, title, slug, deadline_days').in('id', eventIds)   : Promise.resolve({ data: [] }),
      veIds.length     ? supabase.from('virtual_experiences').select('id, title, slug, deadline_days').in('id', veIds) : Promise.resolve({ data: [] }),
    ]);

    const contentMap = new Map<string, { id: string; title: string; slug: string; deadline_days: number | null; content_type: string }>();
    for (const c of courses ?? []) contentMap.set(c.id, { ...c, content_type: 'course' });
    for (const e of events  ?? []) contentMap.set(e.id, { ...e, content_type: 'event' });
    for (const v of ves     ?? []) contentMap.set(v.id, { ...v, content_type: 'virtual_experience' });

    const candidates: { contentId: string; cohortId: string; daysLeft: number; content: any }[] = [];
    for (const assignment of cohortAssignments) {
      const content = contentMap.get(assignment.content_id);
      if (!content?.deadline_days) continue;
      const deadline = new Date(assignment.assigned_at).getTime() + Number(content.deadline_days) * 86400000;
      const daysLeft = Math.ceil((deadline - now) / 86400000);
      if (daysLeft > REMINDER_DAYS_BEFORE || daysLeft < -1) continue;
      candidates.push({ contentId: assignment.content_id, cohortId: assignment.cohort_id, daysLeft, content });
    }

    if (candidates.length) {
      const candidateContentIds = [...new Set(candidates.map(c => c.contentId))];
      const candidateCohortIds  = [...new Set(candidates.map(c => c.cohortId))];
      const candidateCourseIds  = candidateContentIds.filter(id => contentMap.get(id)?.content_type === 'course');
      const candidateVeIds      = candidateContentIds.filter(id => contentMap.get(id)?.content_type === 'virtual_experience');

      const [{ data: students }, { data: courseAttempts }, { data: gpAttempts }, { data: recentNudges }] = await Promise.all([
        supabase.from('students').select('id, email, full_name, cohort_id').in('cohort_id', candidateCohortIds),
        candidateCourseIds.length
          ? supabase.from('course_attempts').select('student_id, course_id').in('course_id', candidateCourseIds).not('completed_at', 'is', null)
          : Promise.resolve({ data: [] }),
        candidateVeIds.length
          ? supabase.from('guided_project_attempts').select('student_id, ve_id').in('ve_id', candidateVeIds).not('completed_at', 'is', null)
          : Promise.resolve({ data: [] }),
        supabase.from('sent_nudges').select('student_id, form_id')
          .eq('nudge_type', 'deadline_reminder')
          .in('form_id', candidateContentIds)
          .gte('sent_at', since1Day),
      ]);

      const completedSet = new Set<string>();
      for (const a of courseAttempts ?? []) completedSet.add(`${a.student_id}|${a.course_id}`);
      for (const a of gpAttempts    ?? []) completedSet.add(`${a.student_id}|${a.ve_id}`);

      const nudgedSet = new Set<string>();
      for (const n of recentNudges ?? []) nudgedSet.add(`${n.student_id}|${n.form_id}`);

      const studentsByCohort = new Map<string, typeof students>();
      for (const student of students ?? []) {
        if (!studentsByCohort.has(student.cohort_id)) studentsByCohort.set(student.cohort_id, []);
        studentsByCohort.get(student.cohort_id)!.push(student);
      }

      for (const { contentId, cohortId, daysLeft, content } of candidates) {
        const cohortStudents = studentsByCohort.get(cohortId) ?? [];
        const slug = content.slug ?? contentId;
        for (const student of cohortStudents) {
          const email = (student.email ?? '').trim().toLowerCase();
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
          if (completedSet.has(`${student.id}|${contentId}`)) { skipped++; continue; }
          if (nudgedSet.has(`${student.id}|${contentId}`))    { skipped++; continue; }

          const subject = daysLeft <= 0
            ? `⚠ Deadline passed: ${content.title}`
            : daysLeft === 1
              ? `Last chance! Your deadline is tomorrow: ${content.title}`
              : `Reminder: ${daysLeft} days left to complete "${content.title}"`;

          emailBatch.push({
            from: FROM, to: email, subject,
            html: deadlineReminderEmail({ name: student.full_name || 'there', contentTitle: content.title, contentType: content.content_type, formUrl: `${t.appUrl}/${slug}`, daysLeft, branding }),
          });
          nudgeRecords.push({ student_id: student.id, form_id: contentId, nudge_type: 'deadline_reminder' });
        }
      }
    }
  }

  // -- 2. Assignments (deadline_date, cohort_ids array) ---
  const windowStart = new Date(now - 86400000).toISOString().slice(0, 10);
  const windowEnd   = new Date(now + REMINDER_DAYS_BEFORE * 86400000).toISOString().slice(0, 10);

  const { data: asmRows } = await supabase
    .from('assignments')
    .select('id, title, cohort_ids, deadline_date')
    .eq('status', 'published')
    .not('deadline_date', 'is', null)
    .gte('deadline_date', windowStart)
    .lte('deadline_date', windowEnd);

  if (asmRows?.length) {
    const allCohortIds  = [...new Set((asmRows as any[]).flatMap((a: any) => a.cohort_ids ?? []))];
    const asmContentIds = (asmRows as any[]).map((a: any) => a.id);

    const [{ data: asmStudents }, { data: asmSubs }, { data: asmNudges }] = await Promise.all([
      supabase.from('students').select('id, email, full_name, cohort_id').in('cohort_id', allCohortIds),
      supabase.from('assignment_submissions').select('student_id, assignment_id')
        .in('assignment_id', asmContentIds)
        .in('status', ['submitted', 'graded']),
      supabase.from('sent_nudges').select('student_id, form_id')
        .eq('nudge_type', 'deadline_reminder')
        .in('form_id', asmContentIds)
        .gte('sent_at', since1Day),
    ]);

    const submittedSet   = new Set((asmSubs    ?? []).map((s: any) => `${s.student_id}|${s.assignment_id}`));
    const asmNudgedSet   = new Set((asmNudges  ?? []).map((n: any) => `${n.student_id}|${n.form_id}`));
    const studentsByCohort2 = new Map<string, any[]>();
    for (const s of asmStudents ?? []) {
      if (!studentsByCohort2.has(s.cohort_id)) studentsByCohort2.set(s.cohort_id, []);
      studentsByCohort2.get(s.cohort_id)!.push(s);
    }

    for (const asm of asmRows as any[]) {
      const daysLeft = Math.ceil((new Date(asm.deadline_date).getTime() - now) / 86400000);
      for (const cohortId of (asm.cohort_ids ?? [])) {
        for (const student of studentsByCohort2.get(cohortId) ?? []) {
          const email = (student.email ?? '').trim().toLowerCase();
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
          if (submittedSet.has(`${student.id}|${asm.id}`)) { skipped++; continue; }
          if (asmNudgedSet.has(`${student.id}|${asm.id}`)) { skipped++; continue; }

          const subject = daysLeft <= 0
            ? `⚠ Assignment deadline passed: ${asm.title}`
            : daysLeft === 1
              ? `Last chance! Assignment due tomorrow: ${asm.title}`
              : `Reminder: ${daysLeft} days left to submit "${asm.title}"`;

          emailBatch.push({
            from: FROM, to: email, subject,
            html: deadlineReminderEmail({ name: student.full_name || 'there', contentTitle: asm.title, contentType: 'assignment', formUrl: `${t.appUrl}/student#assignments`, daysLeft, branding }),
          });
          nudgeRecords.push({ student_id: student.id, form_id: asm.id, nudge_type: 'deadline_reminder' });
        }
      }
    }
  }

  // -- 3. Send ---
  if (!emailBatch.length) {
    console.log(`[cron/deadline-reminders] sent=0 skipped=${skipped}`);
    return NextResponse.json({ ok: true, sent: 0, skipped });
  }

  const sentKeySet = new Set<string>();
  const batches    = chunk(emailBatch, BATCH_SIZE);
  let sent = 0;

  for (let i = 0; i < batches.length; i++) {
    const batchNudges = nudgeRecords.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    try {
      await resend.batch.send(batches[i]);
      sent += batches[i].length;
      for (const n of batchNudges) sentKeySet.add(`${n.student_id}|${n.form_id}`);
    } catch (err) {
      console.error('[cron/deadline-reminders] batch send failed:', err);
    }
  }

  if (sentKeySet.size) {
    const toInsert = nudgeRecords.filter(n => sentKeySet.has(`${n.student_id}|${n.form_id}`));
    if (toInsert.length) await supabase.from('sent_nudges').insert(toInsert);
  }

  console.log(`[cron/deadline-reminders] sent=${sent} skipped=${skipped}`);
  return NextResponse.json({ ok: true, sent, skipped });
}
