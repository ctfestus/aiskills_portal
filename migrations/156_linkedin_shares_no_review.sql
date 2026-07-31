-- 156: drop the human-review layer from LinkedIn share claims.
--
-- 153 and 155 assumed an instructor would review submitted posts: a claim could be struck (revoked)
-- and a claim whose URL carried no author was recorded as 'unverified' for someone to eyeball.
-- Instructors are not reviewing posts, so both are gone, and a claim now carries a single meaning:
--
--   a row in linkedin_shares == the URL was a LinkedIn post, it names the student as its author,
--                               and nobody had claimed it before.
--
-- All three are decided at claim time, so nothing needs a status column. The corollary is that URL
-- forms carrying NO author -- /feed/update/ permalinks and /pulse/ articles -- are now rejected
-- outright rather than recorded unchecked; see lib/linkedin-share.ts. Accepting them with no flag and
-- no reviewer would have let any stranger's permalink through silently.
--
-- author_vanity is kept: it is the evidence the check ran, and records which vanity matched at claim
-- time even if the student later renames their profile. It is not a status and needs no review.

DROP INDEX IF EXISTS public.linkedin_shares_verification_idx;

ALTER TABLE public.linkedin_shares
  DROP COLUMN IF EXISTS revoked,
  DROP COLUMN IF EXISTS revoked_at,
  DROP COLUMN IF EXISTS revoked_by,
  DROP COLUMN IF EXISTS verification;
