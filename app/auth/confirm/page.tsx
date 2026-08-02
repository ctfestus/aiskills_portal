import { redirect } from 'next/navigation';
import ConfirmForm from './ConfirmForm';

// Email security scanners, spam filters and link previewers issue a GET on every
// URL in a message. Verifying on GET burned the one-time token before the student
// ever clicked, leaving them with a dead link. Verification now happens on POST
// from this interstitial (app/auth/confirm/verify), which a scanner will not send.
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

  const tokenHash = first(params.token_hash);
  const type      = first(params.type);

  if (!tokenHash || !type) redirect('/auth?error=invalid_link');

  return <ConfirmForm tokenHash={tokenHash} type={type} />;
}
