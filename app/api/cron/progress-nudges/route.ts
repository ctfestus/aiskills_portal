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
  const recent   = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(); // within last 24h = still active

  // Fetch stalled course attempts: started but not completed, last activity between 7 and 60 days ago
  const [{ data: courseAttempts }, { data: gpAttempts }] = await Promise.all([
    supabase
      .from('course_attempts')
      .select('student_email, student_name, form_id, updated_at')
      .is('completed_at', null)
      .lt('updated_at', cutoff)
      .gt('updated_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()), // not older than 60 days

    supabase
      .from('guided_project_attempts')
      .select('student_email, student_name, form_id, updated_at')
      .is('completed_at', null)
      .lt('updated_at', cutoff)
      .gt('updated_at', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  // Collect unique form IDs to fetch titles
  const formIds = [...new Set([
    ...(courseAttempts ?? []).map((a: any) => a.form_id),
    ...(gpAttempts ?? []).map((a: any) => a.form_id),
  ])];

  const { data: forms } = formIds.length
    ? await supabase.from('forms').select('id, title, content_type, slug, config').in('id', formIds)
    : { data: [] };

  const formMap = new Map((forms ?? []).map((f: any) => [f.id, f]));

  // Fetch related assignments for stalled courses (smart nudge)
  const courseFormIds = (courseAttempts ?? []).map((a: any) => a.form_id);
  const { data: relatedAssignments } = courseFormIds.length
    ? await supabase
        .from('assignments')
        .select('id, title, related_course')
        .in('related_course', courseFormIds)
        .eq('status', 'published')
    : { data: [] };
  // Map: form_id -> assignment title
  const assignmentMap = new Map((relatedAssignments ?? []).map((a: any) => [a.related_course, a.title]));

  // Merge all stalled attempts, deduplicate by student+form
  const seen = new Set<string>();
  const candidates: { email: string; name: string; formId: string; contentType: string; formTitle: string; slug: string }[] = [];

  for (const a of [...(courseAttempts ?? []), ...(gpAttempts ?? [])]) {
    const key = `${a.student_email}|${a.form_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const form = formMap.get(a.form_id);
    if (!form) continue;

    const isVE = form.content_type === 'virtual_experience' || form.content_type === 'guided_project';
    candidates.push({
      email:       a.student_email,
      name:        a.student_name || 'there',
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
    // Skip if already nudged within RESEND_AFTER_DAYS
    const alreadySent = await hasNudgeBeenSent(supabase, c.email, c.formId, 'inactivity', RESEND_AFTER_DAYS);
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
      await recordNudge(supabase, c.email, c.formId, 'inactivity');
      sent++;
    } catch (err) {
      console.error('[cron/progress-nudges] send failed for', c.email, err);
    }
  }

  console.log(`[cron/progress-nudges] sent=${sent} skipped=${skipped}`);
  return NextResponse.json({ ok: true, sent, skipped });
}
