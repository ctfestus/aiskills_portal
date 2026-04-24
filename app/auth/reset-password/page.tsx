import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import ResetPasswordForm from './ResetPasswordForm';

// Session is established server-side by /auth/confirm (verifyOtp).
// By the time the user reaches this page the session cookie is already set.
export default async function ResetPasswordPage() {
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

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <ResetPasswordForm error="Invalid or expired reset link. Please request a new one." />;
  }

  return <ResetPasswordForm />;
}
