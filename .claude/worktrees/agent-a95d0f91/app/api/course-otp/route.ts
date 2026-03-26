import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { signStudentToken } from '@/lib/course-token';
import { otpEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

const MAX_VERIFY_ATTEMPTS = 5;       // per individual OTP record
const MAX_EMAIL_ATTEMPTS  = 15;      // across all OTP records for one email in 30 min

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || 'FestForms <notifications@festforms.com>';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action, email, code } = body;

  if (!action || !email) {
    return NextResponse.json({ error: 'action and email are required' }, { status: 400 });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  const supabase = adminClient();

  // ── Send OTP ──────────────────────────────────────────────────────────────
  if (action === 'send') {
    // Rate limit: max 3 sends per email per 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count, error: countErr } = await supabase
      .from('course_otps')
      .select('id', { count: 'exact', head: true })
      .eq('email', normalizedEmail)
      .eq('used', false)
      .gte('created_at', fiveMinutesAgo);

    if (countErr) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    if ((count ?? 0) >= 3) {
      return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes before trying again.' }, { status: 429 });
    }

    // Generate 6-digit code using cryptographically secure randomness
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const otpCode = String(100000 + (buf[0] % 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    const { error: insertErr } = await supabase.from('course_otps').insert({
      email: normalizedEmail,
      code: otpCode,
      expires_at: expiresAt,
      used: false,
    });

    if (insertErr) {
      return NextResponse.json({ error: 'Failed to create verification code' }, { status: 500 });
    }

    // Send email via Resend using shared template
    const { error: sendErr } = await resend.emails.send({
      from: FROM,
      to: normalizedEmail,
      subject: `Your FestForms verification code`,
      html: otpEmail({ code: otpCode }),
    });

    if (sendErr) {
      console.error('[course-otp send]', sendErr);
      return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  // ── Verify OTP ────────────────────────────────────────────────────────────
  if (action === 'verify') {
    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Look up the latest unused, non-expired code for this email (includes attempt counter)
    const { data: otpRow, error: lookupErr } = await supabase
      .from('course_otps')
      .select('id, code, attempts')
      .eq('email', normalizedEmail)
      .eq('used', false)
      .gte('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lookupErr || !otpRow) {
      return NextResponse.json({ error: 'Invalid or expired code. Please request a new one.' }, { status: 400 });
    }

    // Per-OTP attempt cap
    if (otpRow.attempts >= MAX_VERIFY_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many attempts. Please request a new code.' }, { status: 429 });
    }

    // Cross-OTP cap: count all failed attempts for this email in the last 30 minutes.
    // Prevents cycling through freshly-requested OTPs to bypass the per-OTP limit.
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentOtps } = await supabase
      .from('course_otps')
      .select('attempts')
      .eq('email', normalizedEmail)
      .gte('created_at', thirtyMinAgo);
    const totalAttempts = (recentOtps ?? []).reduce((sum, r) => sum + (r.attempts ?? 0), 0);
    if (totalAttempts >= MAX_EMAIL_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many failed attempts. Please wait 30 minutes before trying again.' }, { status: 429 });
    }

    if (otpRow.code !== String(code).trim()) {
      // Await the increment so it always persists before the response is sent.
      // Use a raw SQL increment (attempts = attempts + 1) so concurrent brute-force
      // requests can't all read attempts=0 and bypass the lockout via a race condition.
      await supabase.rpc('increment_otp_attempts', { otp_id: otpRow.id });
      return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 });
    }

    // Correct code — mark used
    await supabase.from('course_otps').update({ used: true }).eq('id', otpRow.id);

    const token = signStudentToken(normalizedEmail);
    return NextResponse.json({ ok: true, token });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
