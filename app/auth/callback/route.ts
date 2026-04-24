import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/admin-client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

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

    // Safety net: existing students skip the allowlist check.
    const { data: existing } = await db.from('students').select('id').eq('id', user.id).maybeSingle();
    if (existing) {
      return NextResponse.redirect(new URL('/student', request.url));
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
