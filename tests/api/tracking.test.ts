import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// Role-tiering archetype: requireRole(['admin','instructor','staff']). The gate admits three
// roles and rejects student/anon; internally staff+admin take the published-scoped branch and
// instructors the owner-scoped branch -- both reach 200. Proves the gate, not the row scoping.

vi.mock('@/lib/api-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-auth')>()),
  requireRole: vi.fn(),
}));

import { requireRole } from '@/lib/api-auth';
import { GET } from '@/app/api/tracking/route';
import { makeSupabaseStub } from '../helpers/supabaseStub';

const mockRequireRole = vi.mocked(requireRole);

function get() {
  return GET(new Request('http://localhost/api/tracking') as any);
}

// Every table the handler fans out to -- all empty so it returns an empty-but-200 payload.
function emptyDb() {
  return makeSupabaseStub({
    courses: { data: [], error: null },
    virtual_experiences: { data: [], error: null },
    assignments: { data: [], error: null },
    cohorts: { data: [], error: null },
    students: { data: [], error: null },
    course_attempts: { data: [], error: null },
    guided_project_attempts: { data: [], error: null },
    assignment_submissions: { data: [], error: null },
    cohort_assignments: { data: [], error: null },
  });
}
function authed(role: string) {
  mockRequireRole.mockResolvedValue({ user: { id: 'u1' }, supabase: emptyDb(), role, token: 't' } as any);
}

beforeEach(() => mockRequireRole.mockReset());

describe('GET /api/tracking', () => {
  it('401 for an anonymous caller', async () => {
    mockRequireRole.mockResolvedValue({ error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) });
    expect((await get()).status).toBe(401);
  });

  it('403 for a student (wrong role)', async () => {
    mockRequireRole.mockResolvedValue({ error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) });
    expect((await get()).status).toBe(403);
  });

  it('200 for staff (published-scoped branch)', async () => {
    authed('staff');
    expect((await get()).status).toBe(200);
  });

  it('200 for admin (published-scoped branch)', async () => {
    authed('admin');
    expect((await get()).status).toBe(200);
  });

  it('200 for instructor (owner-scoped branch)', async () => {
    authed('instructor');
    expect((await get()).status).toBe(200);
  });
});
