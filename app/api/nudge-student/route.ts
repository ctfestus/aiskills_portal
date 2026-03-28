import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminClient } from '@/lib/subscription';
import { nudgeEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || 'AI Skills Africa <notifications@festforms.com>';
const APP_URL = process.env.APP_URL || 'https://festforms.com';

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: { user }, error: authError } = await adminClient().auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { studentEmail, studentName, formTitle, formId, contentType, status } = body;

  if (!studentEmail || !formTitle || !formId || !status) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!['not_started', 'stalled'].includes(status)) {
    return NextResponse.json({ error: 'status must be not_started or stalled' }, { status: 400 });
  }

  const subject = status === 'not_started'
    ? `Your learning journey is waiting, ${studentName || 'there'}!`
    : `Don't stop now -- you started something great, ${studentName || 'there'}!`;

  const html = nudgeEmail({
    name: studentName || 'there',
    contentTitle: formTitle,
    contentType: contentType ?? 'course',
    status,
    formUrl: `${APP_URL}/${formId}`,
  });

  try {
    await resend.emails.send({ from: FROM, to: studentEmail, subject, html });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[nudge-student]', err);
    return NextResponse.json({ error: err.message || 'Send failed' }, { status: 500 });
  }
}
