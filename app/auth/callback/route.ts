import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type');

  const isRecovery =
    type === 'recovery' ||
    request.cookies.get('sb-reset-intent')?.value === '1';

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
    }
  );

  // Password reset: exchange code here (Route Handler can set cookies),
  // then redirect to the reset form -- no code in the URL.
  if (isRecovery && code) {
    await supabase.auth.exchangeCodeForSession(code);
    const response = NextResponse.redirect(new URL('/auth/reset-password', request.url));
    response.cookies.delete('sb-reset-intent');
    return response;
  }

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const db = adminClient();

    if (!user.email) {
      await db.auth.admin.deleteUser(user.id);
      return NextResponse.redirect(new URL('/auth?error=not_allowed', request.url));
    }

    // Safety net: if the user is already enrolled, treat this as recovery
    // (avoids running new-signup allowlist check on existing students).
    const { data: existing } = await db.from('students').select('id').eq('id', user.id).maybeSingle();
    if (existing) {
      return NextResponse.redirect(new URL('/auth/reset-password', request.url));
    }

    const { data: cohortId } = await db.rpc('check_email_allowlist', { p_email: user.email });

    if (!cohortId) {
      await db.auth.admin.deleteUser(user.id);
      return NextResponse.redirect(new URL('/auth?error=not_allowed', request.url));
    }

    await db.from('students').update({ cohort_id: cohortId }).eq('id', user.id);

    await db.from('cohort_allowed_emails').delete().eq('email', user.email.toLowerCase());
  }

  return NextResponse.redirect(new URL('/onboarding', request.url));
}
