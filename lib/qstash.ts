/**
 * QStash request verification.
 * Accepts either:
 *   1. Upstash-Signature header (production -- QStash)
 *   2. x-cron-secret header (local dev / Vercel cron fallback)
 *
 * Install: npm install @upstash/qstash
 */
import { Receiver } from '@upstash/qstash';

export async function verifyQStashRequest(req: Request): Promise<{ valid: boolean; body: string }> {
  const body = await req.text();

  // Fallback: simple shared secret (local dev or Vercel cron)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) {
    return { valid: true, body };
  }

  // Primary: QStash signature
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey    = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentKey || !nextKey) return { valid: false, body };

  try {
    const receiver  = new Receiver({ currentSigningKey: currentKey, nextSigningKey: nextKey });
    const signature = req.headers.get('upstash-signature') ?? '';
    const valid     = await receiver.verify({ signature, body });
    return { valid, body };
  } catch {
    return { valid: false, body };
  }
}
