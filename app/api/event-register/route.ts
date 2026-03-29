import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { confirmationEmail } from '@/lib/email-templates';

// Service role -- needed to call register_event_attendee (no public RLS policies)
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.RESEND_FROM_EMAIL || 'AI Skills Africa <support@app.aiskillsafrica.com>';

export async function POST(req: NextRequest) {
  // Check size BEFORE parsing to prevent memory spike from large payloads.
  // content-length can be absent (chunked encoding) so treat missing as 0 and let
  // the DB constraint be the hard backstop in that case.
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  if (contentLength > 65536) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { formId, responseId, data } = body;

  if (!formId || !responseId || !data || typeof data !== 'object') {
    return NextResponse.json({ error: 'formId, responseId and data are required' }, { status: 400 });
  }

  // Field-level validation -- prevent unbounded strings from being stored as JSONB.
  const FIELD_LIMITS: Record<string, number> = { email: 254, name: 200, phone: 30, company: 200 };
  for (const [field, maxLen] of Object.entries(FIELD_LIMITS)) {
    if (typeof data[field] === 'string' && (data[field] as string).length > maxLen) {
      return NextResponse.json({ error: `Field '${field}' exceeds maximum length of ${maxLen}` }, { status: 400 });
    }
  }
  // Cap any remaining string fields at 2000 chars to prevent JSONB bloat.
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    if (typeof val === 'string' && val.length > 2000) {
      return NextResponse.json({ error: `Field '${key}' exceeds maximum length of 2000` }, { status: 400 });
    }
  }

  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (!email) {
    return NextResponse.json({ error: 'Email is required for event registration' }, { status: 400 });
  }

  const supabase = adminClient();

  // Confirm the form exists and is actually an event -- business logic stays
  // in application code; the RPC handles only the atomic write.
  const { data: form } = await supabase
    .from('forms')
    .select('id, slug, config')
    .eq('id', formId)
    .single();

  if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  if (!form.config?.eventDetails?.isEvent) {
    return NextResponse.json({ error: 'Not an event form' }, { status: 400 });
  }

  // -- Single atomic transaction via Postgres RPC ---
  // register_event_attendee inserts into event_registrations and responses in
  // one transaction. If either insert fails the whole thing rolls back --
  // no compensation pattern, no ghost registrations possible.
  const { data: result, error: rpcError } = await supabase.rpc('register_event_attendee', {
    p_form_id:     formId,
    p_email:       email,
    p_response_id: responseId,
    p_data:        data,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  if (result?.error === 'already_registered') {
    return NextResponse.json({ error: 'already_registered' }, { status: 409 });
  }

  // -- Send confirmation email server-side (fire-and-forget) ---
  // All email content is derived from the DB-verified form record and the
  // validated registration data -- never from untrusted client input.
  if (process.env.RESEND_API_KEY) {
    const cfg = form.config as Record<string, any>;
    const subject = `You're registered: ${cfg?.title || 'Event'}`;
    const html = confirmationEmail({
      name:          data.name || data.full_name || email,
      eventTitle:    cfg?.title       || '',
      eventDate:     cfg?.eventDetails?.date  || '',
      eventTime:     cfg?.eventDetails?.time  || '',
      eventTimezone: cfg?.eventDetails?.timezone || '',
      eventLocation: cfg?.eventDetails?.location || '',
      meetingLink:   cfg?.eventDetails?.meetingLink || '',
      formUrl: `${process.env.APP_URL || 'https://app.aiskillsafrica.com'}/${form.slug ?? formId}`,
    });

    // Idempotency: skip if already sent for this response
    const { data: alreadySent } = await supabase
      .from('sent_emails')
      .select('id')
      .eq('response_id', responseId)
      .eq('type', 'confirmation')
      .maybeSingle();

    if (!alreadySent) {
      resend.emails
        .send({ from: FROM, to: email, subject, html })
        .then(() => supabase.from('sent_emails').insert({ response_id: responseId, type: 'confirmation' }))
        .catch((err: unknown) => console.error('[event-register] confirmation email failed:', err));
    }
  }

  return NextResponse.json({ success: true, responseId });
}
