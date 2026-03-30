import { Redis } from '@upstash/redis';

// Lazy singleton -- only initialised if env vars are present
let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

export { getRedis };

// Leaderboard key per cohort: sorted set where score = XP, member = student email
export const leaderboardKey = (cohortId: string) => `leaderboard:${cohortId}`;

// Store student display name alongside email
export const studentNameKey = (cohortId: string) => `leaderboard:names:${cohortId}`;
