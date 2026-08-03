import { describe, it, expect, vi, beforeEach } from 'vitest';

import { claimLinkedInShare } from '@/lib/linkedin-share';
import { MAX_LINKEDIN_SHARE_POINTS } from '@/lib/course-schema';

/**
 * linkedin_shares.points is a SNAPSHOT of the bonus that was on offer when a claim was made, and for
 * VE shares it is what recalc_student_xp sums into student_xp (migration 160). The slot upsert must
 * therefore never rewrite it: a student correcting their post URL after an instructor edited the
 * bonus would otherwise have already-banked XP silently revalued -- upward on a raise, and downward
 * on a cut, which is the case that actually harms them.
 */

const PROFILE  = 'https://www.linkedin.com/in/jane-doe';
const POST_A   = 'https://www.linkedin.com/posts/jane-doe_first-activity-7100000000000000001-aaaa';
const POST_B   = 'https://www.linkedin.com/posts/jane-doe_second-activity-7100000000000000002-bbbb';

/**
 * Stub holding one optional existing row per lookup shape. `upsert` records what it was handed so the
 * persisted points can be asserted.
 */
function stub({ clash = null, slot = null }: { clash?: any; slot?: any } = {}) {
  const upserts: any[] = [];
  const from = () => {
    const filters: Record<string, any> = {};
    const q: any = {
      select: (cols: string) => { q._cols = cols; return q; },
      eq: (col: string, val: any) => { filters[col] = val; return q; },
      maybeSingle: async () => ({
        // The post_key lookup selects the identity columns; the slot lookup selects points.
        data: 'post_key' in filters ? clash : slot,
        error: null,
      }),
      upsert: async (row: any) => { upserts.push(row); return { error: null }; },
    };
    return q;
  };
  return { client: { from } as any, upserts };
}

const base = {
  studentId: 'student1',
  contentType: 'virtual_experience' as const,
  contentId: 've1',
  itemId: 'r1',
  studentProfileUrl: PROFILE,
};

beforeEach(() => vi.restoreAllMocks());

describe('claimLinkedInShare: the points snapshot', () => {
  it('stores the offered amount on a first claim', async () => {
    const { client, upserts } = stub();
    const res = await claimLinkedInShare(client, { ...base, postUrl: POST_A, points: 50 });

    expect(res.ok).toBe(true);
    expect(upserts[0].points).toBe(50);
  });

  // The finding. Instructor raises 50 -> 100, student then corrects their link.
  it('keeps the original amount when a raised offer meets a corrected link', async () => {
    const { client, upserts } = stub({ slot: { points: 50 } });
    const res = await claimLinkedInShare(client, { ...base, postUrl: POST_B, points: 100 });

    expect(res.ok).toBe(true);
    expect(upserts[0].points).toBe(50);
  });

  // The direction that actually harms the student: a cut must not claw back banked XP.
  it('keeps the original amount when a reduced offer meets a corrected link', async () => {
    const { client, upserts } = stub({ slot: { points: 100 } });
    const res = await claimLinkedInShare(client, { ...base, postUrl: POST_B, points: 10 });

    expect(res.ok).toBe(true);
    expect(upserts[0].points).toBe(100);
  });

  // Grandfathered legacy claims stay at zero even once the requirement is funded. Deliberate: the
  // alternative makes banked XP mutable by instructor action.
  it('keeps a zero snapshot when the requirement is funded later', async () => {
    const { client, upserts } = stub({ slot: { points: 0 } });
    const res = await claimLinkedInShare(client, { ...base, postUrl: POST_B, points: 200 });

    expect(res.ok).toBe(true);
    expect(upserts[0].points).toBe(0);
  });

  it('still clamps a first claim to the maximum', async () => {
    const { client, upserts } = stub();
    await claimLinkedInShare(client, { ...base, postUrl: POST_A, points: 999999 });

    expect(upserts[0].points).toBe(MAX_LINKEDIN_SHARE_POINTS);
  });

  // A post held by somebody else's slot is refused before any write.
  it('refuses a post already claimed elsewhere without writing', async () => {
    const { client, upserts } = stub({
      clash: { student_id: 'other', content_id: 've1', item_id: 'r1' },
    });
    const res = await claimLinkedInShare(client, { ...base, postUrl: POST_A, points: 50 });

    expect(res).toEqual({ ok: false, code: 'already_claimed' });
    expect(upserts).toHaveLength(0);
  });
});
