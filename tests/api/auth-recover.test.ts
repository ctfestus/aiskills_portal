import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Recovery is safe on Supabase's native email precisely BECAUSE this route grants a
// session and nothing else. The token category is not proved here -- a code arriving at
// this URL is trusted to be a recovery code -- and that is acceptable only while the
// route cannot admit, provision, or mutate anything. A session on its own is already
// gated everywhere by access_state.
//
// So the assertions below are load-bearing, not decoration. Both database doors are
// mocked and asserted unused: the service-role client AND the session-scoped client's
// .from(), since a user-scoped write would bypass an adminClient-only check.

const h = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  sessionFrom: vi.fn(),
  adminClient: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { exchangeCodeForSession: h.exchangeCodeForSession },
    from: h.sessionFrom,
  }),
}));

vi.mock('@/lib/admin-client', () => ({ adminClient: h.adminClient }));

import { GET } from '@/app/auth/recover/route';

function recover(query: string) {
  return new NextRequest(`http://localhost/auth/recover?${query}`);
}

describe('GET /auth/recover', () => {
  beforeEach(() => {
    h.exchangeCodeForSession.mockReset();
    h.exchangeCodeForSession.mockResolvedValue({ error: null });
    h.sessionFrom.mockClear();
    h.adminClient.mockClear();
  });

  it('exchanges a valid recovery code and opens the password form', async () => {
    const response = await GET(recover('code=abc'));

    expect(h.exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(response.headers.get('location')).toBe('http://localhost/auth/reset-password');
  });

  it('rejects a missing code without inspecting an existing session', async () => {
    const response = await GET(recover(''));

    expect(h.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe('http://localhost/auth?error=invalid_link');
  });

  it('rejects an expired or already-used code', async () => {
    h.exchangeCodeForSession.mockResolvedValue({ error: { message: 'expired' } });

    const response = await GET(recover('code=abc'));

    expect(response.headers.get('location')).toBe('http://localhost/auth?error=invalid_link');
  });

  // The property the whole design rests on. If either of these ever fires, this route
  // has grown the ability to change an account and the reasoning above no longer holds.
  describe('touches no database, by either door', () => {
    it.each([
      ['a successful exchange', 'code=abc',      null],
      ['a missing code',        '',              null],
      ['a failed exchange',     'code=abc',      { message: 'expired' }],
    ])('reaches neither client on %s', async (_label, query, exchangeError) => {
      h.exchangeCodeForSession.mockResolvedValue({ error: exchangeError });

      await GET(recover(query));

      expect(h.adminClient).not.toHaveBeenCalled();
      expect(h.sessionFrom).not.toHaveBeenCalled();
    });
  });
});
