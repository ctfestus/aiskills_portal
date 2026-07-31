/**
 * Validation and identity for student-submitted LinkedIn post URLs.
 *
 * Used by the LinkedIn share slide (courses) and the linkedin_share deliverable (virtual
 * experiences). Imported by BOTH the client players and the server routes so the gate a student
 * sees and the gate the server enforces can never drift apart.
 *
 * Host checks parse with new URL() and compare hostname exactly -- never substring matching --
 * for the same reason as lib/safe-embed-url.ts: `https://evil.com/?x=linkedin.com/posts/...`
 * and `https://linkedin.com.evil.com/posts/...` must both fail.
 *
 * Two values come back, and the difference matters:
 *
 *   url -- the submitted URL with tracking params and trailing slash stripped. Faithful to what
 *          the student pasted, so it is what we store and show and what instructors click.
 *   key -- the post's IDENTITY, stored as linkedin_shares.post_key with a UNIQUE index. Every URL
 *          form pointing at one post must collapse to one key, or "already claimed" is trivially
 *          bypassed: the same post reaches us as a /posts/ share link, as a /feed/update/
 *          permalink, from a regional host (gh.linkedin.com), and with a pile of utm_ params.
 */

// linkedin.com plus the subdomains LinkedIn actually serves posts from: www, mobile, and the
// two-letter country hosts (gh.linkedin.com, ng.linkedin.com, ...) that regional shares land on.
// Deliberately excludes lnkd.in -- a shortener whose target cannot be checked without following
// a redirect, so it would let any URL through.
function isLinkedInHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'linkedin.com') return true;
  if (!host.endsWith('.linkedin.com')) return false;
  const sub = host.slice(0, -'.linkedin.com'.length);
  return sub === 'www' || sub === 'm' || /^[a-z]{2}$/.test(sub);
}

// The normal share URL: /posts/<profile-slug>_<text>-<kind>-<id>-<token>, where <kind> is activity,
// ugcPost or share depending on how the post was created -- all three occur in the wild, e.g.
//   /posts/chayilgrace_we-often-hear-...-ugcPost-7487771599983575040-a2Kg
// The slug and trailing token vary wildly (and are localized), so anchor on the id instead of the
// whole shape. The leading [^/]* is greedy so a slug that happens to contain "activity-" cannot
// shadow the real id, which always sits at the end. Case-insensitive because the kind is camelCase
// (ugcPost) and hosts/paths get lower-cased by some clients.
const POSTS_PATH = /^\/posts\/[^/]*(?:activity|ugcpost|share)-(\d{10,25})[^/]*$/i;
// Permalink form. share/ugcPost are alternate URNs for the same underlying post, so the numeric id
// alone is the identity -- the URN flavour must not create a second claimable key.
const FEED_PATH  = /^\/feed\/update\/urn:li:(?:activity|share|ugcPost):(\d{10,25})$/i;
// Long-form articles. /pulse/<slug> is the canonical article URL. The slug carries no numeric id, so
// the slug itself is the identity (lower-cased for the key).
//
// NOTE: recognised here but NOT claimable -- an article URL names no author, and with no reviewer a
// claim that could not be author-checked is indistinguishable from one that was. Parsing and claim
// policy are kept separate on purpose: to let articles count again, drop the `no_author_in_url` guard
// in claimLinkedInShare, accepting that a stranger's article would then pass.
//
// Deliberately NOT matched: /feed/update/urn:li:article:<id> and urn:li:linkedInArticle:<id>. Those
// ids live in a different space to the slug and cannot be resolved to it without LinkedIn's API, so
// accepting them would give one article two claimable keys.
const PULSE_PATH = /^\/pulse\/([A-Za-z0-9%._~-]+)$/;

export interface LinkedInPostRef {
  /** Cleaned submitted URL: https, lowercase host, no query/hash/trailing slash. Safe to display. */
  url: string;
  /** Canonical identity of the post. The uniqueness key -- never render this to students. */
  key: string;
  /**
   * The post author's profile vanity, lower-cased, when the URL reveals it.
   *
   * A /posts/ share URL is prefixed with the author's own vanity:
   *   /posts/chayilgrace_we-often-hear-people-say-...-ugcPost-7487771599983575040-a2Kg
   *          ^^^^^^^^^^^
   * Comparing that against the student's stored LinkedIn profile confirms the post is THEIRS --
   * the difference between "this is a real post" and "this is your post" -- with no LinkedIn API.
   *
   * null for /feed/update/ permalinks and /pulse/ articles, which carry no author. Nobody reviews
   * claims, so a URL that cannot be author-checked is refused rather than recorded unchecked.
   */
  authorVanity: string | null;
}

/**
 * Returns the cleaned URL and canonical identity of a LinkedIn post URL, or null when `raw` is
 * not one.
 */
export function parseLinkedInPostRef(raw: string | null | undefined): LinkedInPostRef | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try { parsed = new URL(trimmed); } catch { return null; }

  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  if (!isLinkedInHost(parsed.hostname)) return null;

  // Strip a single trailing slash so `/posts/x-activity-1-y/` and `/posts/x-activity-1-y` collide.
  const path = parsed.pathname.length > 1 && parsed.pathname.endsWith('/')
    ? parsed.pathname.slice(0, -1)
    : parsed.pathname;

  const postsMatch = POSTS_PATH.exec(path);
  const activityId = postsMatch?.[1] ?? FEED_PATH.exec(path)?.[1];
  const pulseSlug  = activityId ? null : PULSE_PATH.exec(path)?.[1];
  if (!activityId && !pulseSlug) return null;

  return {
    // Query and hash are dropped: they carry only utm_ tracking, and keeping them would let one
    // post occupy several rows.
    url: `https://${parsed.hostname.toLowerCase()}${path}`,
    key: activityId ? `urn:li:activity:${activityId}` : `pulse:${pulseSlug!.toLowerCase()}`,
    authorVanity: postsMatch ? authorVanityFromPostsPath(path) : null,
  };
}

/**
 * The author vanity sitting in front of the first underscore of a /posts/ path.
 *
 * Vanities themselves cannot contain underscores, so splitting on the FIRST one is safe even though
 * the post's title text (which follows) frequently contains them.
 */
function authorVanityFromPostsPath(path: string): string | null {
  const afterPrefix = path.slice('/posts/'.length);
  const underscore = afterPrefix.indexOf('_');
  if (underscore <= 0) return null;
  const vanity = afterPrefix.slice(0, underscore).toLowerCase();
  return VANITY.test(vanity) ? vanity : null;
}

// Vanity charset: LinkedIn allows letters, digits and hyphens, and percent-encodes non-ASCII names.
const VANITY = /^[a-z0-9%-]{2,120}$/;

/**
 * The vanity from a student's own LinkedIn profile URL, for comparison against a post's author.
 *
 * Deliberately forgiving about what students type into a profile field: full URL or bare handle,
 * with or without a protocol, `www.`, a trailing slash, a query string, or surrounding whitespace.
 * Onboarding asks for `https://linkedin.com/in/username`, but nobody types that exactly.
 */
export function parseLinkedInProfileVanity(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  // A bare handle, e.g. "chayilgrace".
  if (!trimmed.includes('/') && !trimmed.includes('.')) {
    return VANITY.test(trimmed) ? trimmed : null;
  }

  const withProtocol = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try { parsed = new URL(withProtocol); } catch { return null; }
  if (!isLinkedInHost(parsed.hostname)) return null;

  // /in/<vanity> is the profile path; ignore anything after it (/details/experience, etc).
  const match = /^\/in\/([^/]+)/.exec(parsed.pathname);
  if (!match) return null;
  const vanity = match[1].toLowerCase();
  return VANITY.test(vanity) ? vanity : null;
}

/** True when `raw` is a LinkedIn post or article URL. Says nothing about who wrote it. */
export function isLinkedInPostUrl(raw: string | null | undefined): boolean {
  return parseLinkedInPostRef(raw) !== null;
}

/**
 * Client-side pre-check mirroring what the claim endpoint will decide, so a student gets the right
 * message instantly instead of after a round trip.
 *
 * Returns the same error codes the server uses, which is why both surfaces can share one copy table
 * (shareClaimErrorMessage). A claimable URL must name its author -- see claimLinkedInShare.
 */
export function preflightLinkedInPostUrl(
  raw: string | null | undefined,
): { ok: true } | { ok: false; code: 'invalid_url' | 'no_author_in_url' } {
  const ref = parseLinkedInPostRef(raw);
  if (!ref) return { ok: false, code: 'invalid_url' };
  if (!ref.authorVanity) return { ok: false, code: 'no_author_in_url' };
  return { ok: true };
}
