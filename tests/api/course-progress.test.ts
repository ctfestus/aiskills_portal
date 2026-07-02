import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/api-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-auth')>()),
  requireRole: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

import { requireRole } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';
import { GET } from '@/app/api/course-progress/route';
import { makeSupabaseStub } from '../helpers/supabaseStub';

const mockRequireRole = vi.mocked(requireRole);
const mockCreateClient = vi.mocked(createClient);

function get() {
  return GET(new Request('http://localhost/api/course-progress?formId=course1', {
    headers: { Authorization: 'Bearer test-token' },
  }) as any);
}

beforeEach(() => {
  mockRequireRole.mockReset();
  mockCreateClient.mockReset();
});

describe('GET /api/course-progress attempt status', () => {
  it('shows an active retake instead of an older failed completed attempt', async () => {
    mockRequireRole.mockResolvedValue({ token: 'test-token', user: { id: 'owner1' }, role: 'instructor' } as any);
    mockCreateClient
      .mockReturnValue(makeSupabaseStub({
        courses: { data: [{ id: 'course1' }], error: null },
        course_attempts: {
          data: [
            {
              course_id: 'course1',
              student_id: 'student1',
              current_question_index: 3,
              score: 40,
              points: 0,
              passed: false,
              completed_at: '2026-01-01T00:00:00.000Z',
              attempt_number: 1,
              updated_at: '2026-01-01T00:00:00.000Z',
              answers: {},
              students: { email: 'student@example.com', full_name: 'Student One' },
            },
            {
              course_id: 'course1',
              student_id: 'student1',
              current_question_index: 2,
              score: 0,
              points: 0,
              passed: false,
              completed_at: null,
              attempt_number: 2,
              updated_at: '2026-01-02T00:00:00.000Z',
              answers: {},
              students: { email: 'student@example.com', full_name: 'Student One' },
            },
          ],
          error: null,
        },
      }) as any);

    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.progress).toHaveLength(1);
    expect(body.progress[0].attempt_number).toBe(2);
    expect(body.progress[0].completed).toBe(false);
    expect(body.progress[0].status).toBe('in_progress');
  });

  it('401 for an anonymous caller', async () => {
    mockRequireRole.mockResolvedValue({ error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) });
    expect((await get()).status).toBe(401);
  });

  it('requires a staff role before returning cross-student progress', async () => {
    mockRequireRole.mockResolvedValue({ error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) });
    expect((await get()).status).toBe(403);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
