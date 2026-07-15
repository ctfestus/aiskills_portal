import type { Redis } from '@upstash/redis';

// Shared windowed rate-limit counter for the AI routes.
//
// The naive INCR-then-EXPIRE pattern has a failure mode: if INCR succeeds but
// EXPIRE fails (network blip, crash between calls), the key never gets a TTL,
// the count only ever grows, and that user is blocked from the feature forever.
//
// This helper self-heals both ways:
// - at creation, a key that cannot get a TTL is deleted (fail open, never immortal)
// - on the over-limit path, a TTL-less key is given one so a stuck key drains
//
// Returns true when the caller is over the limit. Throws only if Redis itself
// fails mid-call -- each route decides whether that fails open or closed.
export async function bumpRateLimit(
  redis: Redis,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const count = await redis.incr(key);
  if (count === 1) {
    const ok = await redis.expire(key, windowSeconds).catch(() => 0);
    if (!ok) await redis.del(key).catch(() => {});
  }
  if (count > limit) {
    const ttl = await redis.ttl(key).catch(() => -2);
    if (ttl === -1) await redis.expire(key, windowSeconds).catch(() => {});
    return true;
  }
  return false;
}
