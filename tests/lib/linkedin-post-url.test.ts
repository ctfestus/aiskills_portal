import { describe, it, expect } from 'vitest';

import {
  parseLinkedInPostRef, isLinkedInPostUrl, parseLinkedInProfileVanity, preflightLinkedInPostUrl,
} from '@/lib/linkedin-post-url';

const ACTIVITY = '7123456789012345678';
const SHARE    = `https://www.linkedin.com/posts/jane-doe_data-analytics-activity-${ACTIVITY}-Ab1c`;
const PERMA    = `https://www.linkedin.com/feed/update/urn:li:activity:${ACTIVITY}`;

const keyOf = (raw: string) => parseLinkedInPostRef(raw)?.key;
const urlOf = (raw: string) => parseLinkedInPostRef(raw)?.url;
const authorOf = (raw: string) => parseLinkedInPostRef(raw)?.authorVanity;

// Author extraction is what turns "this is a real post" into "this is YOUR post". Without it a
// student can paste any stranger's post URL and collect the XP.
describe('post author vanity', () => {
  it('reads the author out of a /posts/ share URL', () => {
    expect(authorOf(`https://www.linkedin.com/posts/chayilgrace_we-often-hear-people-say-ugcPost-${ACTIVITY}-a2Kg`))
      .toBe('chayilgrace');
  });

  it('splits on the FIRST underscore, so title text containing underscores is not mistaken for it', () => {
    expect(authorOf(`https://www.linkedin.com/posts/jane-doe_my_post_about_things-activity-${ACTIVITY}-Ab1c`))
      .toBe('jane-doe');
  });

  it('lower-cases the author so casing differences still match a profile', () => {
    expect(authorOf(`https://www.linkedin.com/posts/Jane-Doe_update-activity-${ACTIVITY}-Ab1c`)).toBe('jane-doe');
  });

  it('handles a hyphen-and-digits vanity, the auto-generated profile form', () => {
    expect(authorOf(`https://www.linkedin.com/posts/jane-doe-1a2b3c4_update-activity-${ACTIVITY}-Ab1c`))
      .toBe('jane-doe-1a2b3c4');
  });

  it('is null for permalinks and articles, which carry no author', () => {
    expect(authorOf(`https://www.linkedin.com/feed/update/urn:li:activity:${ACTIVITY}`)).toBe(null);
    expect(authorOf('https://www.linkedin.com/pulse/my-article-jane-doe')).toBe(null);
  });

  it('is null when a /posts/ path has no underscore at all', () => {
    expect(authorOf(`https://www.linkedin.com/posts/noauthorhere-activity-${ACTIVITY}-Ab1c`)).toBe(null);
  });
});

// The client pre-check must reach the same verdict as the claim endpoint, or a student sees "looks
// fine" then gets an error from the server -- or worse, the reverse.
describe('preflightLinkedInPostUrl', () => {
  it('passes a /posts/ URL, which names its author', () => {
    expect(preflightLinkedInPostUrl(`https://www.linkedin.com/posts/jane-doe_update-activity-${ACTIVITY}-Ab1c`))
      .toEqual({ ok: true });
  });

  it('rejects a permalink, which names nobody, with the server code', () => {
    expect(preflightLinkedInPostUrl(`https://www.linkedin.com/feed/update/urn:li:activity:${ACTIVITY}`))
      .toEqual({ ok: false, code: 'no_author_in_url' });
  });

  it('rejects an article for the same reason', () => {
    expect(preflightLinkedInPostUrl('https://www.linkedin.com/pulse/my-article-jane-doe'))
      .toEqual({ ok: false, code: 'no_author_in_url' });
  });

  it('separates "not a post" from "no author"', () => {
    expect(preflightLinkedInPostUrl('https://www.linkedin.com/in/jane-doe'))
      .toEqual({ ok: false, code: 'invalid_url' });
    expect(preflightLinkedInPostUrl('nonsense')).toEqual({ ok: false, code: 'invalid_url' });
  });
});

describe('parseLinkedInProfileVanity', () => {
  it('reads the vanity from the URL form onboarding asks for', () => {
    expect(parseLinkedInProfileVanity('https://linkedin.com/in/chayilgrace')).toBe('chayilgrace');
  });

  it('tolerates what students actually type', () => {
    expect(parseLinkedInProfileVanity('https://www.linkedin.com/in/chayilgrace/')).toBe('chayilgrace');
    expect(parseLinkedInProfileVanity('www.linkedin.com/in/chayilgrace')).toBe('chayilgrace');
    expect(parseLinkedInProfileVanity('linkedin.com/in/chayilgrace')).toBe('chayilgrace');
    expect(parseLinkedInProfileVanity('  https://LinkedIn.com/IN/ChayilGrace  ')).toBe('chayilgrace');
    expect(parseLinkedInProfileVanity('https://www.linkedin.com/in/chayilgrace?originalSubdomain=gh')).toBe('chayilgrace');
    expect(parseLinkedInProfileVanity('https://gh.linkedin.com/in/chayilgrace')).toBe('chayilgrace');
    expect(parseLinkedInProfileVanity('chayilgrace')).toBe('chayilgrace');
  });

  it('ignores trailing profile sub-paths', () => {
    expect(parseLinkedInProfileVanity('https://www.linkedin.com/in/chayilgrace/details/experience/')).toBe('chayilgrace');
  });

  it('rejects non-profile and non-LinkedIn input', () => {
    expect(parseLinkedInProfileVanity('https://www.linkedin.com/company/acme')).toBe(null);
    expect(parseLinkedInProfileVanity('https://www.linkedin.com/feed/')).toBe(null);
    expect(parseLinkedInProfileVanity('https://example.com/in/chayilgrace')).toBe(null);
    expect(parseLinkedInProfileVanity('')).toBe(null);
    expect(parseLinkedInProfileVanity(null)).toBe(null);
  });

  it('round-trips: a student profile matches the author of their own post', () => {
    const post = `https://www.linkedin.com/posts/chayilgrace_my-work-ugcPost-${ACTIVITY}-a2Kg`;
    expect(authorOf(post)).toBe(parseLinkedInProfileVanity('https://www.linkedin.com/in/chayilgrace/'));
  });

  it('round-trips negatively: a stranger post does not match', () => {
    const post = `https://www.linkedin.com/posts/someone-else_their-work-ugcPost-${ACTIVITY}-a2Kg`;
    expect(authorOf(post)).not.toBe(parseLinkedInProfileVanity('https://www.linkedin.com/in/chayilgrace'));
  });
});

// Real URLs copied out of a browser. LinkedIn embeds the entity id in a /posts/ path as
// activity-, ugcPost- OR share-, depending on how the post was created -- an early version of this
// validator only accepted activity- and rejected genuine ugcPost- share links.
describe('real-world share URLs', () => {
  const REAL_UGC = 'https://www.linkedin.com/posts/chayilgrace_we-often-hear-people-say-that-gen-zs-are-ugcPost-7487771599983575040-a2Kg/?utm_source=share&utm_medium=member_desktop&rcm=ACoAAA9hFAsBKPKDq9S9xZIUGusiYmcyoBwQOYI';

  it('accepts a ugcPost /posts/ share link with tracking params and a trailing slash', () => {
    expect(isLinkedInPostUrl(REAL_UGC)).toBe(true);
  });

  it('strips the tracking params and trailing slash from it', () => {
    expect(urlOf(REAL_UGC)).toBe(
      'https://www.linkedin.com/posts/chayilgrace_we-often-hear-people-say-that-gen-zs-are-ugcPost-7487771599983575040-a2Kg',
    );
  });

  it('keys it by its entity id', () => {
    expect(keyOf(REAL_UGC)).toBe('urn:li:activity:7487771599983575040');
  });

  it('collapses it with the matching permalink, so one post cannot be claimed twice', () => {
    expect(keyOf('https://www.linkedin.com/feed/update/urn:li:ugcPost:7487771599983575040')).toBe(keyOf(REAL_UGC));
    expect(keyOf('https://www.linkedin.com/feed/update/urn:li:activity:7487771599983575040')).toBe(keyOf(REAL_UGC));
  });

  it('accepts the share- variant of a /posts/ path', () => {
    expect(isLinkedInPostUrl(`https://www.linkedin.com/posts/jane-doe_my-update-share-${ACTIVITY}-Ab1c`)).toBe(true);
  });
});

// Students may write up their work as a LinkedIn article rather than a plain post. The canonical
// article URL -- what the address bar and the article's own Share button both give -- is /pulse/.
describe('articles (/pulse/)', () => {
  it('accepts an article with a trailing slash', () => {
    expect(isLinkedInPostUrl('https://www.linkedin.com/pulse/my-article-title-jane-doe/')).toBe(true);
  });

  it('accepts the trailing hash suffix LinkedIn appends to newer article slugs', () => {
    expect(isLinkedInPostUrl('https://www.linkedin.com/pulse/what-i-learned-building-dashboards-jane-doe-1a2b')).toBe(true);
  });

  it('drops article tracking params', () => {
    expect(urlOf('https://www.linkedin.com/pulse/my-article-jane-doe-abc1e/?trackingId=xKz%2FQ%3D%3D'))
      .toBe('https://www.linkedin.com/pulse/my-article-jane-doe-abc1e');
  });

  it('accepts a slug starting with a digit', () => {
    expect(isLinkedInPostUrl('https://www.linkedin.com/pulse/5-things-i-learned-jane-doe')).toBe(true);
  });

  it('accepts percent-encoded accents and emoji in the slug', () => {
    expect(isLinkedInPostUrl('https://www.linkedin.com/pulse/caf%C3%A9-culture-data-jane-doe')).toBe(true);
    expect(isLinkedInPostUrl('https://www.linkedin.com/pulse/title-with-emoji-%F0%9F%9A%80-jane-doe')).toBe(true);
  });

  it('accepts underscores in the slug', () => {
    expect(isLinkedInPostUrl('https://www.linkedin.com/pulse/title_with_underscore-jane-doe')).toBe(true);
  });

  it('keys one article to one claim across casing and trailing slash', () => {
    const a = keyOf('https://www.linkedin.com/pulse/My-Title-Jane-Doe');
    expect(a).toBe('pulse:my-title-jane-doe');
    expect(keyOf('https://www.linkedin.com/pulse/my-title-jane-doe/')).toBe(a);
    expect(keyOf('https://gh.linkedin.com/pulse/my-title-jane-doe')).toBe(a);
  });

  it('rejects the bare /pulse/ index and a deeper path', () => {
    expect(isLinkedInPostUrl('https://www.linkedin.com/pulse/')).toBe(false);
    expect(isLinkedInPostUrl('https://www.linkedin.com/pulse/a-b/extra-segment')).toBe(false);
  });

  // A newsletter's home page is not a specific piece of work, so it must not satisfy a share.
  it('rejects a newsletter home page', () => {
    expect(isLinkedInPostUrl('https://www.linkedin.com/newsletters/data-weekly-7123456789012345678/')).toBe(false);
  });

  // Deliberately NOT accepted: /feed/update/urn:li:article:<id> and urn:li:linkedInArticle:<id>.
  // An article already has a stable identity in its /pulse/ slug, and those URNs use a different id
  // space that cannot be resolved to the slug without LinkedIn's API -- accepting them would give one
  // article two claimable keys. See the note in lib/linkedin-post-url.ts.
  it('rejects article URN permalinks, which would create a second key for one article', () => {
    expect(isLinkedInPostUrl('https://www.linkedin.com/feed/update/urn:li:article:7487771599983575040')).toBe(false);
    expect(isLinkedInPostUrl('https://www.linkedin.com/feed/update/urn:li:linkedInArticle:7487771599983575040')).toBe(false);
  });
});

describe('accepted post URL shapes', () => {
  it('accepts the normal /posts/ share URL', () => {
    expect(isLinkedInPostUrl(SHARE)).toBe(true);
  });

  it('accepts the /feed/update/ permalink', () => {
    expect(isLinkedInPostUrl(PERMA)).toBe(true);
  });

  it('accepts the older share and ugcPost URNs', () => {
    expect(isLinkedInPostUrl(`https://www.linkedin.com/feed/update/urn:li:share:${ACTIVITY}`)).toBe(true);
    expect(isLinkedInPostUrl(`https://www.linkedin.com/feed/update/urn:li:ugcPost:${ACTIVITY}`)).toBe(true);
  });

  it('accepts a /pulse/ article', () => {
    expect(isLinkedInPostUrl('https://www.linkedin.com/pulse/what-i-learned-jane-doe')).toBe(true);
  });

  it('accepts the bare, mobile and regional country hosts', () => {
    expect(isLinkedInPostUrl(`https://linkedin.com/feed/update/urn:li:activity:${ACTIVITY}`)).toBe(true);
    expect(isLinkedInPostUrl(`https://m.linkedin.com/feed/update/urn:li:activity:${ACTIVITY}`)).toBe(true);
    expect(isLinkedInPostUrl(`https://gh.linkedin.com/feed/update/urn:li:activity:${ACTIVITY}`)).toBe(true);
    expect(isLinkedInPostUrl(`https://ng.linkedin.com/feed/update/urn:li:activity:${ACTIVITY}`)).toBe(true);
  });

  it('tolerates surrounding whitespace from a paste', () => {
    expect(isLinkedInPostUrl(`  ${SHARE}  `)).toBe(true);
  });
});

describe('rejected input', () => {
  it('rejects a profile URL, a company page and the bare feed', () => {
    expect(isLinkedInPostUrl('https://www.linkedin.com/in/jane-doe')).toBe(false);
    expect(isLinkedInPostUrl('https://www.linkedin.com/company/acme')).toBe(false);
    expect(isLinkedInPostUrl('https://www.linkedin.com/feed/')).toBe(false);
  });

  it('rejects lnkd.in short links -- the target cannot be verified', () => {
    expect(isLinkedInPostUrl('https://lnkd.in/abcd1234')).toBe(false);
  });

  it('rejects non-https', () => {
    expect(isLinkedInPostUrl(SHARE.replace('https:', 'http:'))).toBe(false);
  });

  // The reason host checks parse with new URL() instead of matching substrings.
  it('rejects lookalike and substring-bypass hosts', () => {
    expect(isLinkedInPostUrl(`https://linkedin.com.evil.com/feed/update/urn:li:activity:${ACTIVITY}`)).toBe(false);
    expect(isLinkedInPostUrl(`https://evil.com/?x=www.linkedin.com/feed/update/urn:li:activity:${ACTIVITY}`)).toBe(false);
    expect(isLinkedInPostUrl(`https://notlinkedin.com/feed/update/urn:li:activity:${ACTIVITY}`)).toBe(false);
    expect(isLinkedInPostUrl(`https://evil.linkedin.com.co/feed/update/urn:li:activity:${ACTIVITY}`)).toBe(false);
  });

  it('rejects embedded credentials', () => {
    expect(isLinkedInPostUrl(`https://user:pw@www.linkedin.com/feed/update/urn:li:activity:${ACTIVITY}`)).toBe(false);
  });

  it('rejects an activity id that is too short to be real', () => {
    expect(isLinkedInPostUrl('https://www.linkedin.com/feed/update/urn:li:activity:123')).toBe(false);
    expect(isLinkedInPostUrl('https://www.linkedin.com/posts/jane-doe_x-activity-123-Ab1c')).toBe(false);
  });

  it('rejects a /posts/ URL with no activity id', () => {
    expect(isLinkedInPostUrl('https://www.linkedin.com/posts/jane-doe_just-some-text')).toBe(false);
  });

  it('rejects empty and non-URL input', () => {
    expect(isLinkedInPostUrl('')).toBe(false);
    expect(isLinkedInPostUrl('   ')).toBe(false);
    expect(isLinkedInPostUrl(null)).toBe(false);
    expect(isLinkedInPostUrl(undefined)).toBe(false);
    expect(isLinkedInPostUrl('not a url')).toBe(false);
    expect(isLinkedInPostUrl('javascript:alert(1)')).toBe(false);
  });
});

// The uniqueness guarantee rests entirely on these collapsing to one key. If any pair diverges,
// two students can each claim the same post.
describe('post identity (the uniqueness key)', () => {
  it('collapses the /posts/ share link and the /feed/update/ permalink', () => {
    expect(keyOf(SHARE)).toBe(`urn:li:activity:${ACTIVITY}`);
    expect(keyOf(PERMA)).toBe(keyOf(SHARE));
  });

  it('collapses the activity, share and ugcPost URNs', () => {
    expect(keyOf(`https://www.linkedin.com/feed/update/urn:li:share:${ACTIVITY}`)).toBe(keyOf(PERMA));
    expect(keyOf(`https://www.linkedin.com/feed/update/urn:li:ugcPost:${ACTIVITY}`)).toBe(keyOf(PERMA));
  });

  it('collapses tracking params', () => {
    expect(keyOf(`${SHARE}?utm_source=share&utm_medium=member_desktop`)).toBe(keyOf(SHARE));
    expect(keyOf(`${SHARE}?rcm=ACoAAA#comments`)).toBe(keyOf(SHARE));
  });

  it('collapses a trailing slash', () => {
    expect(keyOf(`${SHARE}/`)).toBe(keyOf(SHARE));
  });

  it('collapses regional, mobile, bare and upper-case hosts', () => {
    expect(keyOf(`https://gh.linkedin.com/posts/jane-doe_data-analytics-activity-${ACTIVITY}-Ab1c`)).toBe(keyOf(SHARE));
    expect(keyOf(`https://m.linkedin.com/posts/jane-doe_data-analytics-activity-${ACTIVITY}-Ab1c`)).toBe(keyOf(SHARE));
    expect(keyOf(`https://LinkedIn.com/posts/jane-doe_data-analytics-activity-${ACTIVITY}-Ab1c`)).toBe(keyOf(SHARE));
  });

  it('collapses a differing profile slug on the same activity', () => {
    expect(keyOf(`https://www.linkedin.com/posts/other-name_different-text-activity-${ACTIVITY}-Zz9y`)).toBe(keyOf(SHARE));
  });

  it('keeps genuinely different posts apart', () => {
    expect(keyOf(PERMA)).not.toBe(keyOf('https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345679'));
  });

  it('keys articles by slug, case-insensitively', () => {
    expect(keyOf('https://www.linkedin.com/pulse/my-article')).toBe('pulse:my-article');
    expect(keyOf('https://www.linkedin.com/pulse/My-Article')).toBe('pulse:my-article');
    expect(keyOf('https://www.linkedin.com/pulse/other-article')).not.toBe('pulse:my-article');
  });
});

describe('cleaned URL for display and storage', () => {
  it('drops tracking params, hash and trailing slash but keeps the recognizable path', () => {
    expect(urlOf(`${SHARE}/?utm_source=share#reactions`)).toBe(SHARE);
  });

  it('lower-cases the host without touching the path casing', () => {
    expect(urlOf(`https://WWW.LinkedIn.com/posts/Jane-Doe_data-activity-${ACTIVITY}-Ab1c`))
      .toBe(`https://www.linkedin.com/posts/Jane-Doe_data-activity-${ACTIVITY}-Ab1c`);
  });
});
