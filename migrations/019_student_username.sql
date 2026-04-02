-- ─── Student username field ──────────────────────────────────────────────────
-- Adds a unique, case-insensitive username to the students table so that each
-- student can have a shareable public profile at /s/<username>.
--
-- Intentionally simple: no view, no extra table. Public profile data is served
-- via an API route that uses the service-role key and returns only safe fields.

-- 1. Add nullable username column
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS username text;

-- 2. Case-insensitive uniqueness (only for non-NULL values)
CREATE UNIQUE INDEX IF NOT EXISTS students_username_ci_idx
  ON public.students (lower(username))
  WHERE username IS NOT NULL;

-- 3. Students can read and update their own username (already covered by the
--    existing "students: own update" policy). No additional RLS needed here.
--
--    Public profile reads go through /api/student-profile/[username] which uses
--    the service-role key — no anon SELECT policy on students is required.
