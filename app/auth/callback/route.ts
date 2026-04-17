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

    // Check for a pre-validated cohort cookie (email/password flow)
    const cohortCookie = cookieStore.get('cohort_assign')?.value;

    let cohortId: string | null = cohortCookie ?? null;

    // Google OAuth flow -- no cookie, check allowlist by email
    if (!cohortId && user.email) {
      const { data } = await db.rpc('check_email_allowlist', { p_email: user.email });
      cohortId = data ?? null;
    }

    if (cohortId) {
      await db.from('students').update({ cohort_id: cohortId }).eq('id', user.id);
    } else if (!cohortCookie) {
      // Google OAuth with email not on any allowlist -- reject
      await db.auth.admin.deleteUser(user.id);
      return NextResponse.redirect(new URL('/auth?error=not_allowed', request.url));
    }

    // Clear the cohort cookie
    cookieStore.set('cohort_assign', '', { maxAge: 0, path: '/' });
  }

  return NextResponse.redirect(new URL('/onboarding', request.url));
}
