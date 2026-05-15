/**
 * POST /api/assignments/grade-notify
 * Sends an email to a student when their assignment is graded.
 * Called fire-and-forget from the instructor dashboard after saveGrade().
 */
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminClient } from '@/lib/admin-client';
import { getTenantSettings } from '@/lib/get-tenant-settings';
import { assignmentGradedEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

const PASS_MARK = 85;

async function getAuthUser(req: NextRequest) {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ') || header.length <= 7) return null;
  const { data: { user }, error } = await adminClient().auth.getUser(header.slice(7));
  if (error || !user) return null;
  return user;
}

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ ok: true }); // silently skip if no email configured

  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only instructors/admins can trigger grade notifications
  const { data: sender } = await adminClient()
    .from('students')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (sender?.role !== 'admin' && sender?.role !== 'instructor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { submissionId?: string; assignmentTitle?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { submissionId, assignmentTitle } = body;
  if (!submissionId || !assignmentTitle) {
    return NextResponse.json({ error: 'submissionId and assignmentTitle required' }, { status: 400 });
  }

  // Fetch the submission including the participants array
  const { data: sub } = await adminClient()
    .from('assignment_submissions')
    .select('id, score, feedback, student_id, participants')
    .eq('id', submissionId)
    .maybeSingle();

  if (!sub) return NextResponse.json({ error: 'Submission not found' }, { status: 404 });

  // Resolve the set of student IDs to notify: participants array if present, otherwise just the submitter
  const participantIds: string[] = Array.isArray(sub.participants) && sub.participants.length > 0
    ? sub.participants
    : [sub.student_id];

  const { data: recipientRows } = await adminClient()
    .from('students')
    .select('id, full_name, email')
    .in('id', participantIds);

  const recipients = (recipientRows ?? []).filter(
    (s: any) => s.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim()),
  );

  if (recipients.length === 0) return NextResponse.json({ ok: true });

  try {
    const t        = await getTenantSettings();
    const FROM     = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
    const branding = { logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl, teamName: t.teamName, appName: t.appName, appUrl: t.appUrl };
    const passed   = sub.score != null && sub.score >= PASS_MARK;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await Promise.all(recipients.map((student: any) => {
      const html = assignmentGradedEmail({
        name:            student.full_name || 'there',
        assignmentTitle,
        score:           sub.score,
        passed,
        feedback:        sub.feedback,
        studentUrl:      `${t.appUrl}/student`,
        branding,
      });
      return resend.emails.send({
        from:    FROM,
        to:      student.email.trim(),
        subject: `Your assignment has been graded: ${assignmentTitle}`,
        html,
      });
    }));
  } catch (err) {
    console.error('[grade-notify]', err);
  }

  return NextResponse.json({ ok: true });
}
