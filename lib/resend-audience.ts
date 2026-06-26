import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Add a contact to the configured Resend audience.
 *
 * No-op when RESEND_API_KEY or RESEND_AUDIENCE_ID is unset. Never throws -- a
 * failed contact create must not break the calling flow (account provisioning,
 * onboarding email). Note: resend.contacts.create resolves with `{ error }` on
 * API errors (e.g. 404 for a bad audience id) rather than rejecting, so the
 * response object is inspected here, not just a try/catch.
 */
export async function addToResendAudience(input: { email: string; name?: string | null }): Promise<void> {
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!audienceId || !process.env.RESEND_API_KEY) return;

  const email = input.email?.trim();
  if (!email) return;

  const name = (input.name ?? '').trim();
  const [firstName, ...rest] = name.split(/\s+/).filter(Boolean);

  try {
    const res = await resend.contacts.create({
      audienceId,
      email,
      firstName: firstName || undefined,
      lastName:  rest.join(' ') || undefined,
      unsubscribed: false,
    });
    if (res?.error) {
      console.error('[resend-audience] contact create failed', email, res.error.message ?? res.error);
    }
  } catch (err: any) {
    console.error('[resend-audience] contact create threw', email, err?.message ?? err);
  }
}
