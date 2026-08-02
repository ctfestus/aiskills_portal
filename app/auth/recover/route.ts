import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { PASSWORD_SETUP_PATH } from '@/lib/account-state';

// Dedicated landing point for Supabase's native password-recovery email. It exchanges
// the one-time code and opens the password form; it never runs signup admission logic.
export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get('code');
  const invalidLink = () =>
    NextResponse.redirect(new URL('/auth?error=invalid_link', request.url));

  // Never fall through to a session the browser already held. A missing or expired
  // recovery code must not open the password form for a different signed-in account.
  if (!code) return invalidLink();

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        ),
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return invalidLink();

  return NextResponse.redirect(new URL(PASSWORD_SETUP_PATH, request.url));
}
