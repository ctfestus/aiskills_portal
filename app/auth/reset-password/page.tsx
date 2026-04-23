import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import ResetPasswordForm from './ResetPasswordForm';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
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

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return <ResetPasswordForm error="Invalid or expired reset link. Please request a new one." />;
    }
    return <ResetPasswordForm />;
  }

  // No code -- check for an existing recovery session (implicit flow or already exchanged)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return <ResetPasswordForm error="Invalid or expired reset link. Please request a new one." />;
  }

  return <ResetPasswordForm />;
}
