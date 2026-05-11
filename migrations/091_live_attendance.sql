-- Migration 091: Live attendance tracking via tracked join links
--
-- Adds join_token to event_registrations so each student gets a unique
-- redirect URL. When clicked, the /api/join route records attendance in
-- live_attendance and redirects to the actual meeting link.

-- 1. Add join_token column to event_registrations
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS join_token TEXT DEFAULT gen_random_uuid()::text;

-- Backfill any rows without a token (new DEFAULT handles existing rows in Postgres 11+,
-- but the UPDATE guards against edge cases)
UPDATE public.event_registrations
SET join_token = gen_random_uuid()::text
WHERE join_token IS NULL;

ALTER TABLE public.event_registrations
  ALTER COLUMN join_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_join_token_uniq
  ON public.event_registrations (join_token);

-- 2. Create live_attendance table
CREATE TABLE IF NOT EXISTS public.live_attendance (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id   UUID        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  session_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, student_id, session_date)
);

-- 3. RLS for live_attendance
ALTER TABLE public.live_attendance ENABLE ROW LEVEL SECURITY;

-- Students can read their own attendance
CREATE POLICY "live_attendance: student select"
ON public.live_attendance FOR SELECT
USING (student_id = (SELECT auth.uid()));

-- Instructors and admins can read attendance for events they manage
CREATE POLICY "live_attendance: instructor select"
ON public.live_attendance FOR SELECT
USING (
  (SELECT public.is_instructor_or_admin())
  OR EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id AND e.user_id = (SELECT auth.uid())
  )
);

-- Service role handles inserts from the join API (bypasses RLS automatically)
