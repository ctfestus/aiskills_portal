-- 153: LinkedIn post share claims (courses + virtual experiences).
--
-- Students paste the URL of the LinkedIn post where they shared their work. A course share slide
-- awards bonus XP; a VE linkedin_share deliverable is a plain completion requirement. Acceptance
-- needs TWO checks: the URL must match a LinkedIn post/article shape (lib/linkedin-post-url.ts),
-- and the post must not already be claimed. The second check is why this table exists -- the
-- submitted URLs would otherwise live only inside course_attempts.answers /
-- guided_project_attempts.progress jsonb, where a uniqueness lookup cannot be indexed.
--
--   * post_key is the post's IDENTITY, not the pasted URL: every URL form pointing at one post
--     (/posts/ share link, /feed/update/ permalink, regional host, utm_ params) collapses to one
--     key, so UNIQUE(post_key) actually stops a cohort passing one link around. See
--     lib/linkedin-post-url.ts parseLinkedInPostRef.
--   * UNIQUE(post_key) is unconditional, NOT partial on revoked = false, so a post struck as fake
--     cannot be recycled by anyone.
--   * UNIQUE(student_id, content_id, item_id) makes one row per share slot, so a student fixing a
--     mistyped link UPDATEs in place (freeing their old post_key) instead of stacking claims.
--   * points is an informational snapshot of the slide's configured bonus at claim time. It is NOT
--     the XP source -- course XP stays in course_attempts.points, which recalc_student_xp() already
--     sums. VE shares award nothing and store 0.
--   * content_id has no FK: this is an audit trail and must outlive a deleted course/VE.
--   * NO client write policy. Writes go only through the service-role claim actions in
--     /api/course and /api/guided-project-progress. A student who could INSERT here with their
--     anon key would bypass URL validation entirely and self-award XP.

CREATE TABLE IF NOT EXISTS public.linkedin_shares (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  content_type text        NOT NULL CHECK (content_type IN ('course', 'virtual_experience')),
  content_id   uuid        NOT NULL,
  item_id      text        NOT NULL CHECK (char_length(item_id) BETWEEN 1 AND 200),
  post_url     text        NOT NULL CHECK (char_length(post_url) BETWEEN 1 AND 2048),
  post_key     text        NOT NULL CHECK (char_length(post_key) BETWEEN 1 AND 512),
  points       integer     NOT NULL DEFAULT 0 CHECK (points >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  revoked      boolean     NOT NULL DEFAULT false,
  revoked_at   timestamptz,
  revoked_by   uuid        REFERENCES public.students(id) ON DELETE SET NULL,
  CONSTRAINT linkedin_shares_post_key_unique UNIQUE (post_key),
  CONSTRAINT linkedin_shares_slot_unique     UNIQUE (student_id, content_id, item_id)
);

-- Instructor audit lists ("who shared for this course") and the per-student gate lookup.
CREATE INDEX IF NOT EXISTS linkedin_shares_content_idx
  ON public.linkedin_shares (content_id, student_id);

ALTER TABLE public.linkedin_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "linkedin_shares: student read own" ON public.linkedin_shares;
CREATE POLICY "linkedin_shares: student read own"
  ON public.linkedin_shares FOR SELECT
  USING (student_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "linkedin_shares: instructor read" ON public.linkedin_shares;
CREATE POLICY "linkedin_shares: instructor read"
  ON public.linkedin_shares FOR SELECT
  USING ((SELECT public.is_instructor_or_admin()));

DROP POLICY IF EXISTS "linkedin_shares: staff select" ON public.linkedin_shares;
CREATE POLICY "linkedin_shares: staff select"
  ON public.linkedin_shares FOR SELECT
  USING ((SELECT public.is_staff()));

-- No INSERT / UPDATE / DELETE policy by design -- see the header note.
