-- 155: record who a claimed LinkedIn post actually belongs to.
--
-- Uniqueness (migration 153) stops one post being claimed twice, but a stranger's post has never
-- been claimed, so it passed. The fix needs no LinkedIn API: a /posts/ share URL is prefixed with the
-- author's own profile vanity,
--
-- and students.social_links->>'linkedin' already holds each student's profile URL (collected at
-- onboarding). Comparing the two turns "this is a real post" into "this is YOUR post". A mismatch is
-- rejected outright and never reaches this table.
--
--   author_vanity  the vanity read out of the post URL, or NULL when the URL does not carry one
--   verification   'verified'     the author matched the student's profile
--                  'unverified'   the URL carries no author, so it could not be checked --
--                                 /feed/update/ permalinks and /pulse/ articles. Accepted so nobody
--                                 legitimate is blocked, but surfaced to instructors as the subset
--                                 actually worth spot-checking.
--
-- Existing rows predate the check and are therefore 'unverified', which the DEFAULT gives us.
--
-- Still NOT closed by this: a student who sets someone else's profile URL as their own, and a student
-- who posts, submits, then deletes. The first is conspicuous (their LinkedIn shows on their profile,
-- resume and job-search output, and sits next to their name in the instructor panel); the second
-- needs LinkedIn OAuth and partner-tier API scopes.

ALTER TABLE public.linkedin_shares
  ADD COLUMN IF NOT EXISTS author_vanity text,
  ADD COLUMN IF NOT EXISTS verification  text NOT NULL DEFAULT 'unverified'
    CHECK (verification IN ('verified', 'unverified'));

-- Instructors filter the audit list down to the claims that were never author-checked.
CREATE INDEX IF NOT EXISTS linkedin_shares_verification_idx
  ON public.linkedin_shares (content_id, verification);
