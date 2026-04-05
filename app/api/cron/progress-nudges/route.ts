/**
 * Daily cron -- "We miss you" inactivity nudge.
 * Triggered by QStash at 08:00 every day.
 * Finds students who haven't progressed in 7+ days and haven't been nudged in 14 days.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminClient } from '@/lib/subscription';
import { verifyQStashRequest } from '@/lib/qstash';
import { nudgeEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

const resend            = new Resend(process.env.RESEND_API_KEY);
const FROM              = process.env.RESEND_FROM_EMAIL || 'AI Skills Africa <support@app.aiskillsafrica.com>';
const APP_URL           = process.env.APP_URL || 'https://festforms.com';
const INACTIVITY_DAYS   = Number(process.env.NUDGE_INACTIVITY_DAYS ?? 7);
const RESEND_AFTER_DAYS = Number(process.env.NUDGE_RESEND_AFTER_DAYS ?? 14);
const BATCH_SIZE        = 100; // Resend batch limit

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

export async function POST(req: NextRequest) {
  const { valid } = await verifyQStashRequest(req);
  if (!valid) {
    console.error('[cron/progress-nudges] Unauthorized -- check QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY in Vercel env vars');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
  }

  const supabase = adminClient();
  const cutoff   = new Date(Date.now() - INACTIVITY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Fetch stalled attempts: started but not completed, last activity between 7 and 60 days ago
  const [{ data: courseAttempts }, { data: gpAttempts }] = await Promise.all([
    supabase
      .from('course_attempts')
      .select('student_id, form_id, updated_at')
      .is('completed_at', null)
      .lt('updated_at', cutoff)
      .gt('updated_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()),

    supabase
      .from('guided_project_attempts')
      .select('student_id, form_id, updated_at')
      .is('completed_at', null)
      .lt('updated_at', cutoff)
      .gt('updated_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  // Collect unique form IDs and student IDs
  const formIds = [...new Set([
    ...(courseAttempts ?? []).map((a: any) => a.form_id),
    ...(gpAttempts ?? []).map((a: any) => a.form_id),
  ])];
  const studentIds = [...new Set([
    ...(courseAttempts ?? []).map((a: any) => a.student_id),
    ...(gpAttempts ?? []).map((a: any) => a.student_id),
  ])];

  if (!studentIds.length) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
  }

  const [{ data: forms }, { data: studentRows }] = await Promise.all([
    formIds.length
      ? supabase.from('forms').select('id, title, content_type, slug, config').in('id', formIds)
      : Promise.resolve({ data: [] }),
    supabase.from('students').select('id, email, full_name').in('id', studentIds),
  ]);

  const formMap    = new Map((forms ?? []).map((f: any) => [f.id, f]));
  const studentMap = new Map((studentRows ?? []).map((s: any) => [s.id, s]));

  // Fetch related assignments for stalled courses (smart nudge)
  const courseFormIds = (courseAttempts ?? []).map((a: any) => a.form_id);
  const { data: relatedAssignments } = courseFormIds.length
    ? await supabase
        .from('assignments')
        .select('id, title, related_course')
        .in('related_course', courseFormIds)
        .eq('status', 'published')
    : { data: [] };
  const assignmentMap = new Map((relatedAssignments ?? []).map((a: any) => [a.related_course, a.title]));

  // Merge all stalled attempts, deduplicate by student+form
  const seen = new Set<string>();
  const candidates: {
    studentId: string;
    email: string;
    name: string;
    formId: string;
    contentType: string;
    formTitle: string;
    slug: string;
    coverImage?: string | null;
  }[] = [];

  for (const a of [...(courseAttempts ?? []), ...(gpAttempts ?? [])]) {
    const key = `${a.student_id}|${a.form_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const form    = formMap.get(a.form_id);
    const student = studentMap.get(a.student_id);
    if (!form || !student?.email) continue;

    const isVE = form.content_type === 'virtual_experience' || form.content_type === 'guided_project';
    candidates.push({
      studentId:   a.student_id,
      email:       student.email,
      name:        student.full_name || 'there',
      formId:      a.form_id,
      contentType: isVE ? 'virtual_experience' : form.content_type,
      formTitle:   form.title,
      slug:        form.slug ?? a.form_id,
      coverImage:  form.config?.coverImage || null,
    });
  }

  // Pre-fetch all recent inactivity nudges in bulk -- avoids one DB call per candidate
  const nudgeCutoff = new Date(Date.now() - RESEND_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const candidateStudentIds = [...new Set(candidates.map(c => c.studentId))];
  const { data: recentNudges } = candidateStudentIds.length
    ? await supabase
        .from('sent_nudges')
        .select('student_id, form_id')
        .eq('nudge_type', 'inactivity')
        .in('student_id', candidateStudentIds)
        .gte('sent_at', nudgeCutoff)
    : { data: [] as any[] };

  const nudgedSet = new Set(
    (recentNudges ?? []).map((n: any) => `${n.student_id}|${n.form_id}`),
  );

  // Build email batch for all eligible candidates
  type EmailPayload = Parameters<typeof resend.batch.send>[0][number];
  const emailBatch: EmailPayload[] = [];
  const nudgeRecords: { student_id: string; form_id: string }[] = [];
  let skipped = 0;

  for (const c of candidates) {
    if (nudgedSet.has(`${c.studentId}|${c.formId}`)) { skipped++; continue; }

    const relatedAssignmentTitle = assignmentMap.get(c.formId);
    const subject = `We miss you, ${c.name}! Come back and keep learning 👋`;
    const html = nudgeEmail({
      name:                  c.name,
      contentTitle:          c.formTitle,
      contentType:           c.contentType,
      status:                'stalled',
      formUrl:               `${APP_URL}/${c.slug}`,
      coverImage:            c.coverImage,
      relatedAssignmentTitle,
    });

    emailBatch.push({ from: FROM, to: c.email, subject, html });
    nudgeRecords.push({ student_id: c.studentId, form_id: c.formId });
  }

  if (!emailBatch.length) {
    console.log(`[cron/progress-nudges] sent=0 skipped=${skipped}`);
    return NextResponse.json({ ok: true, sent: 0, skipped });
  }

  // Send in batches of 100 (Resend limit)
  const sentKeys = new Set<string>();
  const batches = chunk(emailBatch, BATCH_SIZE);
  let sent = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNudges = nudgeRecords.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    try {
      await resend.batch.send(batch);
      sent += batch.length;
      for (const n of batchNudges) sentKeys.add(`${n.student_id}|${n.form_id}`);
    } catch (err) {
      console.error('[cron/progress-nudges] batch send failed:', err);
    }
  }

  // Bulk insert nudge records for successfully sent emails
  if (sentKeys.size) {
    const toInsert = nudgeRecords
      .filter(n => sentKeys.has(`${n.student_id}|${n.form_id}`))
      .map(n => ({ student_id: n.student_id, form_id: n.form_id, nudge_type: 'inactivity' }));
    if (toInsert.length) {
      await supabase.from('sent_nudges').insert(toInsert);
    }
  }

  console.log(`[cron/progress-nudges] sent=${sent} skipped=${skipped}`);
  return NextResponse.json({ ok: true, sent, skipped });
}
