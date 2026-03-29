/**
 * QStash request verification.
 *
 * Verification order:
 *   1. Upstash-Signature header (production -- QStash; has built-in replay protection)
 *   2. x-cron-secret + x-cron-ts (local dev / preview only; restricted to non-production
 *      and requires a timestamp within ±5 minutes to prevent replay)
 *
 * Install: npm install @upstash/qstash
 */
import { Receiver } from '@upstash/qstash';

const MAX_CLOCK_SKEW_SECONDS = 300; // 5 minutes

export async function verifyQStashRequest(req: Request): Promise<{ valid: boolean; body: string }> {
  const body = await req.text();

  // -- 1. QStash signature (primary, always attempted first) ---
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey    = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (currentKey && nextKey) {
    const signature = req.headers.get('upstash-signature') ?? '';
    if (signature) {
      try {
        const receiver = new Receiver({ currentSigningKey: currentKey, nextSigningKey: nextKey });
        const valid = await receiver.verify({ signature, body });
        if (valid) return { valid: true, body };
      } catch {
        // Invalid signature -- fall through; do NOT grant access
      }
    }

    // QStash keys are configured but no valid QStash signature was presented.
    // In production this is an outright rejection -- no fallback.
    const isProduction = process.env.VERCEL_ENV === 'production';
    if (isProduction) return { valid: false, body };
  }

  // -- 2. Shared-secret fallback (non-production only) ---
  // Requires:
  // x-cron-secret: <CRON_SECRET>
  // x-cron-ts: <unix seconds> -- timestamp within ±5 min to prevent replay
  const isProduction = process.env.VERCEL_ENV === 'production';
  if (isProduction) return { valid: false, body };

  const cronSecret     = process.env.CRON_SECRET;
  const providedSecret = req.headers.get('x-cron-secret');
  const providedTs     = req.headers.get('x-cron-ts');

  if (!cronSecret || !providedSecret || !providedTs) return { valid: false, body };
  if (providedSecret !== cronSecret) return { valid: false, body };

  const ts    = Number(providedTs);
  const nowSec = Math.floor(Date.now() / 1000);
  if (isNaN(ts) || Math.abs(nowSec - ts) > MAX_CLOCK_SKEW_SECONDS) {
    return { valid: false, body };
  }

  return { valid: true, body };
}
