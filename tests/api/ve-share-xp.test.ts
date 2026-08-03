import { beforeEach, describe, expect, it, vi } from 'vitest';

// VE LinkedIn shares pay XP through linkedin_shares.points, which recalc_student_xp sums into
// student_xp (migration 160). The amount therefore has to come from the STORED VE config and be
// clamped -- a value taken from the request, or an unbounded one taken on trust from a malformed
// config, would mint XP straight onto the leaderboard.
//
// These tests pin the resolution rule at the route boundary by capturing what the route hands to
// claimLinkedInShare, which is the value that lands in the column the trigger reads.

vi.mock('@/lib/api-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth')>();
  const requireUser = vi.fn();
  return { ...actual, requireUser, requireStudentUser: requireUser };
});

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

vi.mock('@/lib/linkedin-share', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/linkedin-share')>();
  return {
    ...actual,
    claimLinkedInShare: vi.fn(),
    loadClaimedShareItemIds: vi.fn(async () => new Set<string>()),
  };
});

import { requireUser } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';
import { claimLinkedInShare } from '@/lib/linkedin-share';
import { MAX_LINKEDIN_SHARE_POINTS } from '@/lib/course-schema';
import { POST } from '@/app/api/guided-project-progress/route';

const mockRequireUser = vi.mocked(requireUser);
const mockCreateClient = vi.mocked(createClient);
const mockClaim = vi.mocked(claimLinkedInShare);

const POST_URL = 'https://www.linkedin.com/posts/jane-doe_my-project-activity-7100000000000000000-abcd';

/**
 * Minimal admin client. The claim branch reads the VE, the student's social_links, then the existing
 * attempt before upserting; anything else it touches is a no-op for this assertion.
 */
function stubClient(requirement: any) {
  const ve = {
    status: 'published', cohort_ids: ['c1'], title: 'VE', slug: 've',
    modules: [{ lessons: [{ requirements: [requirement] }] }],
  };
  const table = (name: string): any => {
    const row =
      name === 'virtual_experiences' ? ve
      : name === 'students' ? { social_links: { linkedin: 'https://www.linkedin.com/in/jane-doe' }, role: 'student', cohort_id: 'c1' }
      : name === 'guided_project_attempts' ? { progress: {} }
      : null;
    const q: any = {
      select: () => q, eq: () => q, in: () => q, is: () => q, not: () => q,
      order: () => q, limit: () => q,
      single: async () => ({ data: row, error: null }),
      maybeSingle: async () => ({ data: row, error: null }),
      upsert: async () => ({ error: null }),
      update: () => q, insert: async () => ({ error: null }),
      then: (r: any) => r({ data: row ? [row] : [], error: null }),
    };
    return q;
  };
  return { from: (name: string) => table(name) };
}

function authed(requirement: any) {
  const supabase = stubClient(requirement);
  mockRequireUser.mockResolvedValue({
    user: { id: 'student1', email: 'student@example.com' },
    supabase, token: 'test-token',
  } as any);
  mockCreateClient.mockReturnValue(supabase as any);
}

/** The points value the route decided to persist onto the claim row. */
function claimedPoints(): number {
  expect(mockClaim).toHaveBeenCalledTimes(1);
  return (mockClaim.mock.calls[0][1] as any).points;
}

async function claim(body: Record<string, unknown> = {}) {
  return POST(new Request('http://localhost/api/guided-project-progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
    body: JSON.stringify({
      action: 'claim-linkedin-share', veId: 've1', requirementId: 'r1', post_url: POST_URL, ...body,
    }),
  }) as any);
}

const shareReq = (extra: Record<string, unknown> = {}) =>
  ({ id: 'r1', type: 'linkedin_share', label: 'Share it', ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  mockClaim.mockResolvedValue({ ok: true, url: POST_URL } as any);
});

describe('VE LinkedIn share: the XP amount written to the claim', () => {
  it('uses the amount configured on the requirement', async () => {
    authed(shareReq({ sharePoints: 50 }));
    await claim();
    expect(claimedPoints()).toBe(50);
  });

  // Grandfathering. Every VE share requirement authored before this feature has no sharePoints key,
  // and those students were never offered a bonus -- an absent amount must therefore mean 0, NOT the
  // course-side default of 50. Getting this wrong would retroactively start paying for requirements
  // no instructor ever chose to fund.
  it('treats an absent amount as zero rather than the default', async () => {
    authed(shareReq());
    await claim();
    expect(claimedPoints()).toBe(0);
  });

  it('clamps an over-large configured amount to the maximum', async () => {
    authed(shareReq({ sharePoints: 999999 }));
    await claim();
    expect(claimedPoints()).toBe(MAX_LINKEDIN_SHARE_POINTS);
  });

  it('floors a negative or junk configured amount to zero', async () => {
    authed(shareReq({ sharePoints: -80 }));
    await claim();
    expect(claimedPoints()).toBe(0);

    vi.clearAllMocks();
    mockClaim.mockResolvedValue({ ok: true, url: POST_URL } as any);
    authed(shareReq({ sharePoints: 'lots' }));
    await claim();
    expect(claimedPoints()).toBe(0);
  });

  // The request body is not a source of truth for anything that becomes XP.
  it('ignores a points value supplied by the client', async () => {
    authed(shareReq({ sharePoints: 25 }));
    await claim({ points: 200, sharePoints: 200 });
    expect(claimedPoints()).toBe(25);
  });

  // Optionality and the bonus are independent knobs: an optional share can still pay.
  it('pays an optional share exactly like a required one', async () => {
    authed(shareReq({ sharePoints: 75, shareRequired: false }));
    await claim();
    expect(claimedPoints()).toBe(75);
  });
});
