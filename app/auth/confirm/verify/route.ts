import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { type EmailOtpType } from '@supabase/supabase-js';

// POST only. The one-time token is consumed here rather than on the GET of
// /auth/confirm so an email scanner prefetching the link cannot burn it before
// the student clicks Continue.
//
// Redirects use 303 so the browser follows them as a GET instead of re-POSTing.
export async function POST(request: NextRequest) {
  const invalid = () =>
    NextResponse.redirect(new URL('/auth?error=invalid_link', request.url), 303);

  // A malformed or non-form body throws; treat it as a bad link rather than a 500.
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return invalid();
  }

  const token_hash = String(form.get('token_hash') ?? '');
  const type       = String(form.get('type') ?? '') as EmailOtpType;

  if (!token_hash || !type) return invalid();

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) return invalid();

  if (type === 'recovery') {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      await supabase
        .from('students')
        .update({ password_setup_started_at: new Date().toISOString() })
        .eq('id', user.id);
    }
  }

  return NextResponse.redirect(new URL('/auth/reset-password', request.url), 303);
}
