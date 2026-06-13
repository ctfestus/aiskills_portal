import { describe, it, expect, vi, beforeEach } from 'vitest';

// Layer A: unit-test the shared auth helpers by mocking the service-role client at the
// @/lib/admin-client seam. We control what auth.getUser() and the students-role lookup
// return, and assert the helper's decisions (401 / 403 / pass).

const getUser = vi.fn();
const single = vi.fn();

vi.mock('@/lib/admin-client', () => ({
  adminClient: () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
  }),
}));

import { requireUser, requireRole, isAuthError } from '@/lib/api-auth';
import { NextRequest } from 'next/server';

function req(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/test', { headers });
}
const bearer = { authorization: 'Bearer valid-token' };

beforeEach(() => {
  getUser.mockReset();
  single.mockReset();
});

describe('requireUser', () => {
  it('401 when no Authorization header', async () => {
    const r = await requireUser(req());
    expect(isAuthError(r)).toBe(true);
    if (isAuthError(r)) expect(r.error.status).toBe(401);
  });

  it('401 when token is invalid', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });
    const r = await requireUser(req(bearer));
    expect(isAuthError(r)).toBe(true);
    if (isAuthError(r)) expect(r.error.status).toBe(401);
  });

  it('returns user + token on a valid session', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.co' } }, error: null });
    const r = await requireUser(req(bearer));
    expect(isAuthError(r)).toBe(false);
    if (!isAuthError(r)) {
      expect(r.user.id).toBe('u1');
      expect(r.token).toBe('valid-token');
    }
  });
});

describe('requireRole', () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.co' } }, error: null });
  });

  it('403 when the role is not allowed', async () => {
    single.mockResolvedValue({ data: { role: 'student' } });
    const r = await requireRole(req(bearer), ['admin', 'instructor']);
    expect(isAuthError(r)).toBe(true);
    if (isAuthError(r)) expect(r.error.status).toBe(403);
  });

  it('403 when the student row is missing', async () => {
    single.mockResolvedValue({ data: null });
    const r = await requireRole(req(bearer), ['admin', 'instructor']);
    expect(isAuthError(r)).toBe(true);
    if (isAuthError(r)) expect(r.error.status).toBe(403);
  });

  it('passes and exposes the role when allowed', async () => {
    single.mockResolvedValue({ data: { role: 'instructor' } });
    const r = await requireRole(req(bearer), ['admin', 'instructor']);
    expect(isAuthError(r)).toBe(false);
    if (!isAuthError(r)) expect(r.role).toBe('instructor');
  });

  it('401 (not 403) when unauthenticated -- never reaches the role check', async () => {
    const r = await requireRole(req(), ['admin']);
    expect(isAuthError(r)).toBe(true);
    if (isAuthError(r)) expect(r.error.status).toBe(401);
  });
});
