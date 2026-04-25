import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminClient } from '@/lib/admin-client';
import { nudgeEmail } from '@/lib/email-templates';
import { getTenantSettings } from '@/lib/get-tenant-settings';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

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

  // Look up content across courses, events, and virtual_experiences
  const [{ data: course }, { data: event }, { data: ve }] = await Promise.all([
    supabase.from('courses').select('user_id, title, slug, cover_image').eq('id', formId).maybeSingle(),
    supabase.from('events').select('user_id, title, slug, cover_image').eq('id', formId).maybeSingle(),
    supabase.from('virtual_experiences').select('user_id, title, slug, cover_image').eq('id', formId).maybeSingle(),
  ]);

  let content: any = null;
  let contentType: string = 'course';

  if (course)      { content = course; contentType = 'course'; }
  else if (event)  { content = event;  contentType = 'event'; }
  else if (ve)     { content = ve;     contentType = 'virtual_experience'; }

  if (!content) return NextResponse.json({ error: 'Content not found' }, { status: 404 });

  const { data: student } = await supabase.from('students').select('role').eq('id', user.id).single();
  const isAdmin = student?.role === 'admin';

  if (content.user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const t        = await getTenantSettings();
  const FROM     = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
  const branding = { logoUrl: t.logoUrl, emailBannerUrl: t.emailBannerUrl, teamName: t.teamName, appName: t.appName, appUrl: t.appUrl };
  const formUrl  = `${t.appUrl}/${content.slug || formId}`;

  const subject = status === 'not_started'
    ? `Your learning journey is waiting, ${studentName || 'there'}!`
    : `Do not stop now. You started something great, ${studentName || 'there'}!`;

  const html = nudgeEmail({
    name: studentName || 'there',
    contentTitle: content.title,
    contentType,
    status,
    formUrl,
    coverImage: content.cover_image || null,
    branding,
  });

  try {
    const { error: sendError } = await resend.emails.send({ from: FROM, to: studentEmail, subject, html });
    if (sendError) {
      console.error('[nudge-student] Resend error:', sendError);
      return NextResponse.json({ error: 'Failed to send nudge. Please try again.' }, { status: 500 });
    }

    // Record the nudge so the dashboard can reflect it
    const { data: studentRow } = await supabase.from('students').select('id').eq('email', studentEmail).maybeSingle();
    if (studentRow?.id) {
      await supabase.from('sent_nudges').insert({ student_id: studentRow.id, form_id: formId, nudge_type: 'manual' });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[nudge-student]', err);
    return NextResponse.json({ error: 'Failed to send nudge. Please try again.' }, { status: 500 });
  }
}
