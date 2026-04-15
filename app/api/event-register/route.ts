import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { confirmationEmail } from '@/lib/email-templates';
import { getTenantSettings } from '@/lib/get-tenant-settings';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  if (contentLength > 65536) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  // Require authenticated student
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const jwt = authHeader.slice(7);

  const supabase = adminClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Confirm they are a student
  const { data: student } = await supabase
    .from('students')
    .select('id, email')
    .eq('id', user.id)
    .single();

  if (!student) {
    return NextResponse.json({ error: 'Student record not found' }, { status: 403 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { formId } = body;
  if (!formId) {
    return NextResponse.json({ error: 'formId is required' }, { status: 400 });
  }

  // Confirm the event exists
  const { data: event } = await supabase
    .from('events')
    .select('id, title, slug, event_date, event_time, timezone, location, meeting_link')
    .eq('id', formId)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  // Register via RPC
  const { data: result, error: rpcError } = await supabase.rpc('register_event_attendee', {
    p_event_id:   formId,
    p_student_id: student.id,
  });

  if (rpcError) {
    console.error('[event-register] rpc error:', rpcError.message);
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  if (result?.error === 'already_registered') {
    return NextResponse.json({ error: 'already_registered' }, { status: 409 });
  }

  // Send confirmation email (fire-and-forget)
  if (process.env.RESEND_API_KEY && student.email) {
    const t       = await getTenantSettings();
    const FROM    = process.env.RESEND_FROM_EMAIL || `${t.senderName} <${t.supportEmail}>`;
    const branding = { logoUrl: t.logoUrl, teamName: t.teamName, appName: t.appName, appUrl: t.appUrl };
    const subject = `You're registered: ${event.title || 'Event'}`;
    const html = confirmationEmail({
      name:          student.email,
      eventTitle:    event.title      || '',
      eventDate:     event.event_date ? String(event.event_date) : '',
      eventTime:     event.event_time ? String(event.event_time) : '',
      eventTimezone: event.timezone   || '',
      eventLocation: event.location   || '',
      meetingLink:   event.meeting_link || '',
      formUrl:       `${t.appUrl}/${event.slug ?? formId}`,
      branding,
    });

    resend.emails
      .send({ from: FROM, to: student.email, subject, html })
      .catch((err: unknown) => console.error('[event-register] confirmation email failed:', err));
  }

  return NextResponse.json({ success: true });
}
