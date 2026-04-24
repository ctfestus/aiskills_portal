import ResetPasswordForm from './ResetPasswordForm';

// The code is exchanged client-side so the Supabase JS client fires PASSWORD_RECOVERY,
// which is required for GoTrue to allow updateUser({ password }) without the current password.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return <ResetPasswordForm code={code} />;
}
