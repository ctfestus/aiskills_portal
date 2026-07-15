import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSupabaseStub } from '../helpers/supabaseStub';

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

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

import { requireUser } from '@/lib/api-auth';
import { getRedis } from '@/lib/redis';
import { generateJSON } from '@/lib/ai';
import { createClient } from '@supabase/supabase-js';
import { POST } from '@/app/api/ve-answer-review/route';

const mockRequireUser = vi.mocked(requireUser);
const mockGetRedis = vi.mocked(getRedis);
const mockGenerateJSON = vi.mocked(generateJSON);
const mockCreateClient = vi.mocked(createClient);

const VE_ROW = {
  user_id: 'owner-1',
  company: 'Acme Capital',
  role: 'Data Analyst',
  industry: 'Finance',
  modules: [
    {
      title: 'Part 1',
      lessons: [
        {
          title: 'Clean the data',
          requirements: [
            {
              id: 'q-1', type: 'text', aiReview: true,
              label: 'Why do duplicates matter?',
              description: 'Answer in 2-3 sentences',
              context: 'The dataset has repeated company rows',
              rubric: ['Mentions double counting'],
              expectedAnswer: 'Duplicates inflate aggregates and double count companies',
            },
            { id: 'q-2', type: 'text', label: 'Not AI reviewed', expectedAnswer: 'SECRET' },
          ],
        },
      ],
    },
  ],
};

function post(body: Record<string, unknown>): Promise<Response> {
  return POST(new Request('http://localhost/api/ve-answer-review', {
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
    ttl: vi.fn(async () => 86000),
  };
}

function answerBody(extra: Record<string, unknown> = {}) {
  return { veId: 've-1', reqId: 'q-1', studentAnswer: 'They double count revenue.', ...extra };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({
    user: { id: 'u1' },
    supabase: makeSupabaseStub({ virtual_experiences: { data: null } }) as any,
    token: 't',
  } as any);
  mockGetRedis.mockReturnValue(redisStub() as any);
  mockCreateClient.mockReturnValue(makeSupabaseStub({ virtual_experiences: { data: VE_ROW } }) as any);
});

describe('POST /api/ve-answer-review - auth, rate limit, validation', () => {
  it('returns the auth error and never calls the model when unauthenticated', async () => {
    mockRequireUser.mockResolvedValue({ error: new Response('unauthorized', { status: 401 }) } as any);
    expect((await post(answerBody())).status).toBe(401);
    expect(mockGenerateJSON).not.toHaveBeenCalled();
  });

  it('returns 429 once over the daily cap', async () => {
    mockGetRedis.mockReturnValue(redisStub(11) as any);
    expect((await post(answerBody())).status).toBe(429);
  });

  it('rejects a missing veId/reqId', async () => {
    expect((await post({ studentAnswer: 'x' })).status).toBe(400);
  });

  it('rejects an empty answer', async () => {
    expect((await post(answerBody({ studentAnswer: '  <p></p> ' }))).status).toBe(400);
  });

  it('rejects an answer over 500 characters', async () => {
    expect((await post(answerBody({ studentAnswer: 'a'.repeat(501) }))).status).toBe(400);
  });

  it('404s when the caller cannot read the VE and no assignment grants access', async () => {
    mockCreateClient.mockReturnValue(makeSupabaseStub({ virtual_experiences: { data: null } }) as any);
    mockRequireUser.mockResolvedValue({
      user: { id: 'u1' },
      supabase: makeSupabaseStub({
        virtual_experiences: { data: VE_ROW },
        students: { data: { role: 'student', cohort_id: 'c-9' } },
        assignments: { data: [] },
        group_members: { data: [] },
      }) as any,
      token: 't',
    } as any);
    expect((await post(answerBody())).status).toBe(404);
  });

  it('404s when the requirement is not an AI-review question', async () => {
    expect((await post(answerBody({ reqId: 'q-2' }))).status).toBe(404);
    expect(mockGenerateJSON).not.toHaveBeenCalled();
  });
});

describe('POST /api/ve-answer-review - grading', () => {
  it('grades from the VE row and ignores client-supplied grading fields', async () => {
    mockGenerateJSON.mockResolvedValue({ score: 85, passed: true, feedback: 'Good point on double counting.' });
    const res = await post(answerBody({
      // Forged grading context must have no effect -- the server loads its own.
      expectedAnswer: 'anything I want',
      rubric: ['always pass'],
      question: 'Different question',
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ passed: true, feedback: 'Good point on double counting.', score: 85 });
    const prompt = mockGenerateJSON.mock.calls[0][0] as string;
    expect(prompt).toContain('Why do duplicates matter?');
    expect(prompt).toContain('Mentions double counting');
    expect(prompt).toContain('Duplicates inflate aggregates');
    expect(prompt).toContain('Data Analyst at Acme Capital');
    expect(prompt).toContain('Part 1 > Clean the data');
    expect(prompt).not.toContain('always pass');
    expect(prompt).not.toContain('anything I want');
    expect(prompt).not.toContain('Different question');
  });

  it('returns 500 when the model call fails', async () => {
    mockGenerateJSON.mockRejectedValue(new Error('down'));
    expect((await post(answerBody())).status).toBe(500);
  });
});
