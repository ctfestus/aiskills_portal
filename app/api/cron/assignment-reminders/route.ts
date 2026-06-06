/**
 * Daily cron -- Assignment deadline reminders.
 * Emails students who have not submitted an assignment whose deadline_date is within the
 * next 2 days. Deduped via sent_nudges (6-day cooldown) so each student is reminded at most
 * once per assignment during the run-up, regardless of how often the cron runs.
 *
 * QStash schedule: 0 8 * * * POST /api/cron/assignment-reminders
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';
import { verifyQStashRequest } from '@/lib/qstash';
import { sendAssignmentReminders } from '@/lib/remind-unsubmitted';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { valid } = await verifyQStashRequest(req);
  if (!valid) {
    console.error('[cron/assignment-reminders] Unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
  }

  const db = adminClient();
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const horizon  = new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10); // due within 2 days

  const { data: assignments, error } = await db
    .from('assignments')
    .select('id, title, deadline_date')
    .eq('status', 'published')
    .not('deadline_date', 'is', null)
    .gte('deadline_date', todayStr)
    .lte('deadline_date', horizon);

  if (error) {
    console.error('[cron/assignment-reminders] fetch failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!assignments?.length) {
    return NextResponse.json({ ok: true, assignments: 0, sent: 0 });
  }

  let totalSent = 0;
  for (const a of assignments) {
    try {
      const r = await sendAssignmentReminders(db, a.id, { cooldownDays: 6 });
      totalSent += r.sent ?? 0;
    } catch (err) {
      console.error('[cron/assignment-reminders] send failed for', a.id, err);
    }
  }

  console.log(`[cron/assignment-reminders] assignments=${assignments.length} sent=${totalSent}`);
  return NextResponse.json({ ok: true, assignments: assignments.length, sent: totalSent });
}
