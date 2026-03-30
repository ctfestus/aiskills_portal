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
import { hasNudgeBeenSent, recordNudge } from '@/lib/nudge-helpers';

export const dynamic = 'force-dynamic';

const resend  = new Resend(process.env.RESEND_API_KEY);
const FROM    = process.env.RESEND_FROM_EMAIL || 'AI Skills Africa <support@app.aiskillsafrica.com>';
const APP_URL = process.env.APP_URL || 'https://festforms.com';
const INACTIVITY_DAYS   = Number(process.env.NUDGE_INACTIVITY_DAYS ?? 7);
const RESEND_AFTER_DAYS = Number(process.env.NUDGE_RESEND_AFTER_DAYS ?? 14);

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

  let sent = 0;
  let skipped = 0;

  for (const c of candidates) {
    const alreadySent = await hasNudgeBeenSent(supabase, c.studentId, c.formId, 'inactivity', RESEND_AFTER_DAYS);
    if (alreadySent) { skipped++; continue; }

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

    try {
      await resend.emails.send({ from: FROM, to: c.email, subject, html });
      await recordNudge(supabase, c.studentId, c.formId, 'inactivity');
      sent++;
    } catch (err) {
      console.error('[cron/progress-nudges] send failed for', c.email, err);
    }
  }

  console.log(`[cron/progress-nudges] sent=${sent} skipped=${skipped}`);
  return NextResponse.json({ ok: true, sent, skipped });
}
