/**
 * Server-side claim logic for LinkedIn post shares (see migration 153).
 *
 * Lives here rather than in a route so the course claim action (/api/course) and the VE claim
 * action (/api/guided-project-progress) enforce byte-identical rules. Both call these with a
 * service-role client: linkedin_shares has no client write policy, deliberately.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { parseLinkedInPostRef, parseLinkedInProfileVanity } from '@/lib/linkedin-post-url';
import { clampLinkedInSharePoints } from '@/lib/course-schema';

export type ShareContentType = 'course' | 'virtual_experience';

export type ClaimErrorCode =
  | 'invalid_url'       // not a LinkedIn post URL at all
  | 'no_author_in_url'  // a real post URL, but it does not say who wrote it
  | 'already_claimed'   // this post is held by another slot or another student
  | 'author_mismatch'   // the post belongs to somebody else
  | 'no_profile'        // we have no LinkedIn profile for this student to check against
  | 'error';

export type ClaimResult =
  | { ok: true; url: string }
  | { ok: false; code: ClaimErrorCode };

/**
 * Validate a submitted post URL and record the claim, one row per (student, content, item).
 *
 * Re-claiming the same slot updates that row, which frees the previously claimed post_key -- this
 * is how a student corrects a mistyped link. A post_key already held by ANY other row (including
 * another slot of the student's own) comes back `already_claimed`: one post satisfies exactly one
 * share.
 */
export async function claimLinkedInShare(
  supabase: SupabaseClient,
  opts: {
    studentId: string;
    contentType: ShareContentType;
    contentId: string;
    itemId: string;
    postUrl: string;
    points?: number;
    /** The student's own LinkedIn profile URL, from students.social_links->>'linkedin'. */
    studentProfileUrl?: string | null;
  },
): Promise<ClaimResult> {
  const ref = parseLinkedInPostRef(opts.postUrl);
  if (!ref) return { ok: false, code: 'invalid_url' };

  // Authorship is mandatory: nobody reviews these, so a claim that could not be checked is
  // indistinguishable from one that was. A /posts/ URL names its author; permalinks and /pulse/
  // articles name nobody and are refused rather than recorded unchecked.
  if (!ref.authorVanity) return { ok: false, code: 'no_author_in_url' };
  const studentVanity = parseLinkedInProfileVanity(opts.studentProfileUrl);
  if (!studentVanity) return { ok: false, code: 'no_profile' };
  // The other profile's handle is deliberately NOT returned: it belongs to a third party, and the
  // student can do nothing with it.
  if (ref.authorVanity !== studentVanity) return { ok: false, code: 'author_mismatch' };

  // Two lookups before writing, both needed to decide what the upsert may change.
  const [
    // Reject a post held by a different slot before upserting, so the caller gets `already_claimed`
    // rather than a constraint error, and so the student's existing valid claim is left intact.
    { data: clash, error: clashError },
    // The slot this claim targets, if the student already holds one. `points` is a SNAPSHOT of what
    // was on offer when the claim was made, and it must survive a correction: linkedin_shares.points
    // feeds student_xp for VE shares (migration 160), so letting the upsert rewrite it would mean an
    // instructor editing the bonus retroactively revalues XP the student already banked -- upward on
    // a raise, and silently DOWNWARD on a cut, the moment they fix a typo in their URL.
    { data: existingSlot, error: slotError },
  ] = await Promise.all([
    supabase
      .from('linkedin_shares')
      .select('student_id, content_id, item_id')
      .eq('post_key', ref.key)
      .maybeSingle(),
    supabase
      .from('linkedin_shares')
      .select('points')
      .eq('student_id', opts.studentId)
      .eq('content_id', opts.contentId)
      .eq('item_id', opts.itemId)
      .maybeSingle(),
  ]);

  if (clashError) {
    console.error('[linkedin-share] post_key lookup failed', clashError);
    return { ok: false, code: 'error' };
  }
  if (slotError) {
    console.error('[linkedin-share] slot lookup failed', slotError);
    return { ok: false, code: 'error' };
  }

  // Reused verbatim rather than re-clamped: clamping is applied on the way in, so a stored value is
  // already in range, and re-clamping would let a future reduction of MAX_LINKEDIN_SHARE_POINTS cut
  // XP somebody had already earned -- the exact thing this snapshot exists to prevent.
  const points = existingSlot ? existingSlot.points : clampLinkedInSharePoints(opts.points);

  if (clash
    && !(clash.student_id === opts.studentId
      && clash.content_id === opts.contentId
      && clash.item_id === opts.itemId)) {
    return { ok: false, code: 'already_claimed' };
  }

  const { error } = await supabase
    .from('linkedin_shares')
    .upsert({
      student_id:   opts.studentId,
      content_type: opts.contentType,
      content_id:   opts.contentId,
      item_id:      opts.itemId,
      post_url:      ref.url,
      post_key:      ref.key,
      points,
      author_vanity: ref.authorVanity,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'student_id,content_id,item_id' });

  if (error) {
    // Lost a race against a concurrent claim of the same post between the check above and here.
    if ((error as { code?: string }).code === '23505') return { ok: false, code: 'already_claimed' };
    console.error('[linkedin-share] upsert failed', error);
    return { ok: false, code: 'error' };
  }

  return { ok: true, url: ref.url };
}

/**
 * Item ids this student has claimed on this course/VE, in one query.
 *
 * Both gates key off this rather than the URL sitting in answers/progress jsonb: the table is the
 * authority, so a client-injected URL with no claim behind it earns nothing and satisfies nothing.
 */
export async function loadClaimedShareItemIds(
  supabase: SupabaseClient,
  opts: { studentId: string; contentId: string },
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('linkedin_shares')
    .select('item_id')
    .eq('student_id', opts.studentId)
    .eq('content_id', opts.contentId);

  if (error) {
    console.error('[linkedin-share] claim lookup failed', error);
    return new Set();
  }
  return new Set((data ?? []).map(r => String(r.item_id)));
}
