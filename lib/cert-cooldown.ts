// Certification retake cooldown: the earliest time a fresh attempt may start after the previous
// one completed. Returns the ISO time to wait until, or null when a retake is allowed now -- i.e.
// there is no prior completed attempt, no cooldown is configured, or the wait has already elapsed.
// Pure so it can be unit-tested and shared by both the start-attempt gate and the get-progress read.
export function retakeReadyAt(
  lastCompletedAt: string | null | undefined,
  cooldownHours: number | null | undefined,
  now: number,
): string | null {
  const hours = Number(cooldownHours) || 0;
  if (hours <= 0 || !lastCompletedAt) return null;
  const completed = new Date(lastCompletedAt).getTime();
  if (!Number.isFinite(completed)) return null;
  const ready = completed + hours * 3600 * 1000;
  return ready > now ? new Date(ready).toISOString() : null;
}
