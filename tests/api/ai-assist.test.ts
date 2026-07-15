import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-auth', () => ({
  requireRole: vi.fn(),
  isAuthError: (value: any) => !!value?.error,
}));

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(),
}));

vi.mock('@/lib/ai', () => ({
  generateJSON: vi.fn(),
}));

import { requireRole } from '@/lib/api-auth';
import { getRedis } from '@/lib/redis';
import { generateJSON } from '@/lib/ai';
import { POST } from '@/app/api/ai-assist/route';

const mockRequireRole = vi.mocked(requireRole);
const mockGetRedis = vi.mocked(getRedis);
const mockGenerateJSON = vi.mocked(generateJSON);

function post(body: Record<string, unknown>): Promise<Response> {
  return POST(new Request('http://localhost/api/ai-assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
    body: JSON.stringify(body),
  }) as any) as unknown as Promise<Response>;
}

function redisStub(count = 1) {
  return {
    incr: vi.fn(async () => count),
    expire: vi.fn(async () => 1),
    del: vi.fn(async () => 1),
    ttl: vi.fn(async () => 3000),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireRole.mockResolvedValue({ user: { id: 'u1' }, supabase: {} as any, token: 't', role: 'instructor' } as any);
  mockGetRedis.mockReturnValue(redisStub() as any);
});

describe('POST /api/ai-assist - auth and rate limiting', () => {
  it('returns the auth error and never calls the model when the role check fails', async () => {
    mockRequireRole.mockResolvedValue({ error: new Response('forbidden', { status: 403 }) } as any);
    const res = await post({ action: 'improve', text: 'x' });
    expect(res.status).toBe(403);
    expect(mockGenerateJSON).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when the rate limiter is unavailable', async () => {
    mockGetRedis.mockReturnValue(null as any);
    const res = await post({ action: 'improve', text: 'x' });
    expect(res.status).toBe(503);
    expect(mockGenerateJSON).not.toHaveBeenCalled();
  });

  it('returns 429 once over the hourly cap', async () => {
    mockGetRedis.mockReturnValue(redisStub(41) as any);
    const res = await post({ action: 'improve', text: 'x' });
    expect(res.status).toBe(429);
  });
});

describe('POST /api/ai-assist - validation', () => {
  it('rejects an unknown action', async () => {
    expect((await post({ action: 'nope', text: 'x' })).status).toBe(400);
  });

  it('rejects a selection over the length cap (413)', async () => {
    expect((await post({ action: 'improve', text: 'a'.repeat(6001) })).status).toBe(413);
  });

  it('rejects a custom action with no instruction', async () => {
    expect((await post({ action: 'custom', text: 'x', instruction: '   ' })).status).toBe(400);
  });

  it('rejects empty text for a non-continue action', async () => {
    expect((await post({ action: 'improve', text: '   ' })).status).toBe(400);
  });
});

describe('POST /api/ai-assist - generation', () => {
  it('returns { result } for a text action', async () => {
    mockGenerateJSON.mockResolvedValue({ result: 'better text' });
    const res = await post({ action: 'improve', text: 'meh' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: 'better text' });
  });

  it('returns { kind, interactive } for an explicit format', async () => {
    mockGenerateJSON.mockResolvedValue({ cards: [{ front: 'F', back: 'B' }] });
    const res = await post({ action: 'make_flashcards', text: 'term: definition' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ kind: 'flashcards', interactive: { cards: [{ front: 'F', back: 'B' }] } });
  });

  it('classifies then generates for make_auto', async () => {
    mockGenerateJSON
      .mockResolvedValueOnce({ format: 'steps' })
      .mockResolvedValueOnce({ steps: [{ title: 'Step 1', body: 'do x' }] });
    const res = await post({ action: 'make_auto', text: 'first do x then y' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ kind: 'steps', interactive: { steps: [{ title: 'Step 1', body: 'do x' }] } });
    expect(mockGenerateJSON).toHaveBeenCalledTimes(2);
  });

  it('falls back to quiz when make_auto returns an unknown format', async () => {
    mockGenerateJSON
      .mockResolvedValueOnce({ format: 'banana' })
      .mockResolvedValueOnce({ question: 'Q', options: ['a', 'b'], correctIndex: 0, explanation: 'E' });
    const res = await post({ action: 'make_auto', text: 'x' });
    expect((await res.json()).kind).toBe('quiz');
  });

  it('returns 502 when the model output cannot be normalized', async () => {
    mockGenerateJSON.mockResolvedValue({ cards: [] });
    expect((await post({ action: 'make_flashcards', text: 'x' })).status).toBe(502);
  });
});
