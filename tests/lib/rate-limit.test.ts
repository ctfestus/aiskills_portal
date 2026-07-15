import { describe, expect, it, vi } from 'vitest';
import { bumpRateLimit } from '@/lib/rate-limit';

function redisStub(over: Partial<Record<'incr' | 'expire' | 'del' | 'ttl', any>> = {}) {
  return {
    incr:   vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
    del:    vi.fn(async () => 1),
    ttl:    vi.fn(async () => 3000),
    ...over,
  } as any;
}

describe('bumpRateLimit', () => {
  it('sets the TTL when the key is created and reports under-limit', async () => {
    const redis = redisStub();
    expect(await bumpRateLimit(redis, 'k', 10, 3600)).toBe(false);
    expect(redis.expire).toHaveBeenCalledWith('k', 3600);
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('deletes the key if it cannot get a TTL, so it can never become immortal', async () => {
    const redis = redisStub({ expire: vi.fn(async () => 0) });
    await bumpRateLimit(redis, 'k', 10, 3600);
    expect(redis.del).toHaveBeenCalledWith('k');
  });

  it('deletes the key when EXPIRE throws', async () => {
    const redis = redisStub({ expire: vi.fn(async () => { throw new Error('boom'); }) });
    await bumpRateLimit(redis, 'k', 10, 3600);
    expect(redis.del).toHaveBeenCalledWith('k');
  });

  it('reports over-limit without touching the TTL when one exists', async () => {
    const redis = redisStub({ incr: vi.fn(async () => 11) });
    expect(await bumpRateLimit(redis, 'k', 10, 3600)).toBe(true);
    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('repairs a TTL-less key on the over-limit path so a stuck key drains', async () => {
    const redis = redisStub({ incr: vi.fn(async () => 11), ttl: vi.fn(async () => -1) });
    expect(await bumpRateLimit(redis, 'k', 10, 3600)).toBe(true);
    expect(redis.expire).toHaveBeenCalledWith('k', 3600);
  });

  it('propagates an INCR failure so callers keep their own fail-open/closed choice', async () => {
    const redis = redisStub({ incr: vi.fn(async () => { throw new Error('down'); }) });
    await expect(bumpRateLimit(redis, 'k', 10, 3600)).rejects.toThrow('down');
  });
});
