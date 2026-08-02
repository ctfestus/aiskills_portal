import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Middleware builds its Supabase client from cookies alone, so a bearer-only API call
// is invisible to it. A student holding the access token from their setup link could
// otherwise drive the whole API while the pages were blocked. requireUser is the
// shared boundary every user-authenticated route passes through, so the gate lives
// there -- and exempts exactly one path.

const h = vi.hoisted(() => {
  const getUser = vi.fn();
  const single  = vi.fn();
  return { getUser, single };
});

vi.mock('@/lib/admin-client', () => ({
  adminClient: () => ({
    auth: { getUser: h.getUser },
    from: () => ({ select: () => ({ eq: () => ({ single: h.single }) }) }),
  }),
}));

import { requireUser, requireRole, isAuthError } from '@/lib/api-auth';

const SETUP_CLAIM = { needs_password_setup: true };

function request(pathname: string) {
  return new NextRequest(`http://localhost${pathname}`, {
    headers: { authorization: 'Bearer recovery-token' },
  });
}

function signedInWith(app_metadata: Record<string, unknown>) {
  h.getUser.mockResolvedValue({ data: { user: { id: 'student-1', email: 's@example.com', app_metadata } }, error: null });
}

async function statusOf(pathname: string) {
  const result = await requireUser(request(pathname));
  return isAuthError(result) ? result.error.status : 200;
}

describe('requireUser and outstanding password setup', () => {
  beforeEach(() => {
    h.getUser.mockReset();
    h.single.mockReset();
  });

  it('rejects a call with no bearer token', async () => {
    signedInWith({});
    const result = await requireUser(new NextRequest('http://localhost/api/forms'));

    expect(isAuthError(result) && result.error.status).toBe(401);
  });

  it('lets a completed account through', async () => {
    signedInWith({ needs_password_setup: false });

    expect(await statusOf('/api/forms')).toBe(200);
  });

  it('lets an account that never had the claim through', async () => {
    signedInWith({ provider: 'email' });

    expect(await statusOf('/api/forms')).toBe(200);
  });

  describe('a session with the setup claim', () => {
    beforeEach(() => signedInWith(SETUP_CLAIM));

    it('may still reach the completion endpoint', async () => {
      expect(await statusOf('/api/account/complete-setup')).toBe(200);
    });

    it.each([
      '/api/forms',
      '/api/upload',
      '/api/activity/feed',
      '/api/account/change-password',
      '/api/account/delete',
      '/api/platform-settings',
    ])('is refused 403 on %s', async (pathname) => {
      expect(await statusOf(pathname)).toBe(403);
    });

    // requireRole delegates to requireUser, so role-guarded routes inherit the gate
    // rather than needing their own check.
    it('is refused before any role lookup on a role-guarded route', async () => {
      const result = await requireRole(request('/api/admin/delete-user'), ['admin']);

      expect(isAuthError(result) && result.error.status).toBe(403);
      expect(h.single).not.toHaveBeenCalled();
    });
  });

  // An unadmitted signup keeps its account and its password, so the session stays
  // valid. The recorded access_state is the only thing standing between that token and
  // the API, which is why the bearer boundary has to read it too.
  describe.each(['pending', 'denied'])('a session whose account is %s', (state) => {
    beforeEach(() => signedInWith({ access_state: state }));

    it.each([
      '/api/forms',
      '/api/upload',
      '/api/activity/feed',
      '/api/vector/gaps',
    ])('is refused 403 on %s', async (pathname) => {
      expect(await statusOf(pathname)).toBe(403);
    });

    // Choosing a password does not make an unadmitted account admitted, so the one
    // exemption that exists for password setup does not apply here.
    it('is refused even at the setup-completion endpoint', async () => {
      expect(await statusOf('/api/account/complete-setup')).toBe(403);
    });
  });

  it('lets an explicitly active account through', async () => {
    signedInWith({ access_state: 'active' });

    expect(await statusOf('/api/forms')).toBe(200);
  });
});
