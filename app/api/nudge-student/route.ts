import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminClient } from '@/lib/subscription';
import { nudgeEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || 'AI Skills Africa <support@app.aiskillsafrica.com>';
const APP_URL = process.env.APP_URL || 'https://festforms.com';

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = adminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { studentEmail, studentName, formId, status } = body;

  if (!studentEmail || !formId || !status) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!['not_started', 'stalled'].includes(status)) {
    return NextResponse.json({ error: 'status must be not_started or stalled' }, { status: 400 });
  }

  // Verify the caller owns the form
  const { data: form } = await supabase
    .from('forms')
    .select('user_id, title, slug, content_type, config')
    .eq('id', formId)
    .single();

  if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

  const { data: student } = await supabase.from('students').select('role').eq('id', user.id).single();
  const isAdmin = student?.role === 'admin';

  if (form.user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // All email content derived from the server-side form record -- nothing trusted from body
  const formTitle   = form.title || '';
  const contentType = form.content_type || 'course';
  const formUrl     = `${APP_URL}/${form.slug || formId}`;

  const subject = status === 'not_started'
    ? `Your learning journey is waiting, ${studentName || 'there'}!`
    : `Do not stop now. You started something great, ${studentName || 'there'}!`;

  const html = nudgeEmail({
    name: studentName || 'there',
    contentTitle: formTitle,
    contentType,
    status,
    formUrl,
    coverImage: form.config?.coverImage || null,
  });

  try {
    await resend.emails.send({ from: FROM, to: studentEmail, subject, html });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[nudge-student]', err);
    return NextResponse.json({ error: 'Failed to send nudge. Please try again.' }, { status: 500 });
  }
}
