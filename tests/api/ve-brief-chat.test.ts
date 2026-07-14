import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-auth', () => ({
  requireUser: vi.fn(),
  isAuthError: (value: any) => !!value?.error,
}));

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(),
}));

vi.mock('@/lib/ai', () => ({
  generateJSON: vi.fn(),
}));

import { requireUser } from '@/lib/api-auth';
import { getRedis } from '@/lib/redis';
import { generateJSON } from '@/lib/ai';
import { POST } from '@/app/api/ve-brief-chat/route';

const mockRequireUser = vi.mocked(requireUser);
const mockGetRedis = vi.mocked(getRedis);
const mockGenerateJSON = vi.mocked(generateJSON);

function post(body: Record<string, unknown>): Promise<Response> {
  return POST(new Request('http://localhost/api/ve-brief-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
    body: JSON.stringify(body),
  }) as any) as unknown as Promise<Response>;
}

function redisStub(count = 1) {
  return { incr: vi.fn(async () => count), expire: vi.fn(async () => 1) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({ user: { id: 'u1' }, supabase: {} as any, token: 't' } as any);
  mockGetRedis.mockReturnValue(redisStub() as any);
});

describe('POST /api/ve-brief-chat - auth and rate limiting', () => {
  it('returns the auth error and never calls the model when unauthenticated', async () => {
    mockRequireUser.mockResolvedValue({ error: new Response('unauthorized', { status: 401 }) } as any);
    const res = await post({ question: 'What format do you want?' });
    expect(res.status).toBe(401);
    expect(mockGenerateJSON).not.toHaveBeenCalled();
  });

  it('fails open when the rate limiter is unavailable', async () => {
    mockGetRedis.mockReturnValue(null as any);
    mockGenerateJSON.mockResolvedValue({ reply: 'Use the CSV I attached.' });
    const res = await post({ question: 'Which file should I use?' });
    expect(res.status).toBe(200);
  });

  it('returns 429 once over the daily cap', async () => {
    mockGetRedis.mockReturnValue(redisStub(31) as any);
    const res = await post({ question: 'One more thing?' });
    expect(res.status).toBe(429);
    expect(mockGenerateJSON).not.toHaveBeenCalled();
  });
});

describe('POST /api/ve-brief-chat - validation', () => {
  it('rejects an empty question', async () => {
    expect((await post({ question: '   ' })).status).toBe(400);
  });

  it('rejects a question over the length cap', async () => {
    expect((await post({ question: 'a'.repeat(501) })).status).toBe(400);
  });
});

describe('POST /api/ve-brief-chat - generation', () => {
  it('returns { reply } and stays in persona context', async () => {
    mockGenerateJSON.mockResolvedValue({ reply: 'Focus on Q3 only for this pass.' });
    const res = await post({
      question: 'Should I include Q4 data?',
      context: { managerName: 'Sarah Chen', company: 'Acme', briefBody: '<p>Clean the Q3 sales data.</p>' },
      history: [{ who: 'me', text: 'Hi' }, { who: 'manager', text: 'Hello' }],
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: 'Focus on Q3 only for this pass.' });
    const prompt = mockGenerateJSON.mock.calls[0][0] as string;
    expect(prompt).toContain('Sarah Chen');
    expect(prompt).toContain('Clean the Q3 sales data.');
    expect(prompt).not.toContain('<p>');
  });

  it('returns 500 when the model returns no usable reply', async () => {
    mockGenerateJSON.mockResolvedValue({ reply: '' });
    expect((await post({ question: 'Anything?' })).status).toBe(500);
  });
});
