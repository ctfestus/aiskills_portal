/**
 * Weekly cron -- Learning digest email.
 * Triggered by QStash every Monday at 08:00.
 * Sends each active student a summary of what they completed and what's in progress.
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
const APP_URL = process.env.APP_URL || 'https://festforms.com';

export async function POST(req: NextRequest) {
  const { valid } = await verifyQStashRequest(req);
  if (!valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
  }

  const supabase  = adminClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all attempts active in the last 7 days
  const [{ data: courseAttempts }, { data: gpAttempts }] = await Promise.all([
    supabase
      .from('course_attempts')
      .select('student_email, student_name, form_id, completed_at, score, updated_at')
      .gte('updated_at', sevenDaysAgo),

    supabase
      .from('guided_project_attempts')
      .select('student_email, student_name, form_id, completed_at, updated_at')
      .gte('updated_at', sevenDaysAgo),
  ]);

  // Collect all form IDs needed
  const formIds = [...new Set([
    ...(courseAttempts ?? []).map((a: any) => a.form_id),
    ...(gpAttempts ?? []).map((a: any) => a.form_id),
  ])];

  const { data: forms } = formIds.length
    ? await supabase.from('forms').select('id, title, content_type').in('id', formIds)
    : { data: [] };

  const formMap = new Map((forms ?? []).map((f: any) => [f.id, f]));

  // Group all attempts by student email
  type AttemptRow = { formId: string; completedThisWeek: boolean; score?: number | null };
  const byStudent = new Map<string, { name: string; attempts: AttemptRow[] }>();

  const addAttempt = (email: string, name: string, formId: string, completedAt: string | null, score?: number | null) => {
    if (!byStudent.has(email)) byStudent.set(email, { name: name || 'there', attempts: [] });
    byStudent.get(email)!.attempts.push({
      formId,
      completedThisWeek: !!completedAt && completedAt >= sevenDaysAgo,
      score: score ?? null,
    });
  };

  for (const a of courseAttempts ?? []) {
    addAttempt(a.student_email, a.student_name, a.form_id, a.completed_at, a.score);
  }
  for (const a of gpAttempts ?? []) {
    addAttempt(a.student_email, a.student_name, a.form_id, a.completed_at, null);
  }

  let sent = 0;
  let skipped = 0;

  for (const [email, { name, attempts }] of byStudent) {
    // Skip if digest sent in last 6 days
    const alreadySent = await hasNudgeBeenSent(supabase, email, null, 'weekly_digest', 6);
    if (alreadySent) { skipped++; continue; }

    const completed: { title: string; contentType: string; score?: number | null }[] = [];
    const inProgress: { title: string; contentType: string }[] = [];

    for (const a of attempts) {
      const form = formMap.get(a.formId);
      if (!form) continue;
      const isVE = form.content_type === 'virtual_experience' || form.content_type === 'guided_project';
      const contentType = isVE ? 'virtual_experience' : form.content_type;

      if (a.completedThisWeek) {
        completed.push({ title: form.title, contentType, score: a.score });
      } else {
        inProgress.push({ title: form.title, contentType });
      }
    }

    // Only send if there's something meaningful to show
    if (!completed.length && !inProgress.length) { skipped++; continue; }

    const subject = completed.length > 0
      ? `You completed ${completed.length} item${completed.length > 1 ? 's' : ''} this week 🎓`
      : `Your weekly learning update -- keep going!`;

    const html = weeklyDigestEmail({
      name,
      completed,
      inProgress,
      dashboardUrl: `${APP_URL}/student`,
    });

    try {
      await resend.emails.send({ from: FROM, to: email, subject, html });
      await recordNudge(supabase, email, null, 'weekly_digest');
      sent++;
    } catch (err) {
      console.error('[cron/weekly-digest] send failed for', email, err);
    }
  }

  console.log(`[cron/weekly-digest] sent=${sent} skipped=${skipped}`);
  return NextResponse.json({ ok: true, sent, skipped });
}
