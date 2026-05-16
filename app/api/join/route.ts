import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token || token.length < 8) {
    return new NextResponse('Not found', { status: 404 });
  }

  const supabase = adminClient();

  // Step 1: look up registration by token
  const { data: reg, error: regError } = await supabase
    .from('event_registrations')
    .select('event_id, student_id')
    .eq('join_token', token)
    .maybeSingle();

  if (regError) {
    console.error('[join] registration lookup error:', regError.message, regError.details);
    return new NextResponse('Internal error', { status: 500 });
  }

  if (!reg) {
    console.warn('[join] token not found:', token);
    return new NextResponse('Not found', { status: 404 });
  }

  // Step 2: get the meeting link for the event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('meeting_link')
    .eq('id', reg.event_id)
    .maybeSingle();

  if (eventError) {
    console.error('[join] event lookup error:', eventError.message);
    return new NextResponse('Internal error', { status: 500 });
  }

  const rawLink: string | null = event?.meeting_link ?? null;
  if (!rawLink) {
    return new NextResponse('No meeting link configured for this event', { status: 404 });
  }

  // Normalize: add https:// if the stored link has no protocol
  const normalized = /^https?:\/\//i.test(rawLink) ? rawLink : `https://${rawLink}`;

  let safeUrl: string;
  try {
    const u = new URL(normalized);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return new NextResponse('Invalid meeting URL', { status: 400 });
    }
    safeUrl = u.toString();
  } catch {
    return new NextResponse('Invalid meeting URL', { status: 400 });
  }

  // Record attendance; upsert so repeated clicks on the same day update joined_at
  const today = new Date().toISOString().slice(0, 10);
  const { error: attendanceError } = await supabase
    .from('live_attendance')
    .upsert(
      { event_id: reg.event_id, student_id: reg.student_id, session_date: today, joined_at: new Date().toISOString() },
      { onConflict: 'event_id,student_id,session_date' }
    );

  if (attendanceError) {
    console.error('[join] attendance upsert error:', attendanceError.message);
    // Non-fatal: still redirect even if attendance recording fails
  }

  return NextResponse.redirect(safeUrl);
}
