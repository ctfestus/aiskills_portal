import { getRedis } from './redis';

export const activityKey = (cohortId: string) => `cohort:${cohortId}:activity`;

export interface ActivityEvent {
  name:        string;
  action:      'completed';
  title:       string;
  contentType: 'course' | 'virtual_experience';
  ts:          number;
}

/**
 * Publish a student activity event to the cohort feed.
 * Fire-and-forget -- errors are logged but not rethrown.
 */
export async function publishActivity(
  cohortId: string,
  event:    ActivityEvent,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const key    = activityKey(cohortId);
  const member = JSON.stringify(event);

  try {
    await redis
      .pipeline()
      .zadd(key, { score: event.ts, member })
      .zremrangebyrank(key, 0, -51)   // keep newest 50
      .expire(key, 86400)              // 24-hour TTL
      .exec();
  } catch (err) {
    console.error('[activity] publish failed', err);
  }
}
