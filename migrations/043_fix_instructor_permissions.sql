-- Migration 043: Fix instructor permissions — replaces 040, 041, 042
--
-- ROOT CAUSE of cohort reassignment reverting (also affects payment cohort override):
--   Migration 027 trigger prevent_student_cohort_change checked OLD.role
--   (the STUDENT'S role on the row being updated) instead of the role of the
--   person making the request. So instructor/admin updates to cohort_id — including
--   moving a student from the outstanding cohort back to their original cohort on
--   the payment page — always hit the RAISE EXCEPTION branch, returned 403, and
--   reverted on refresh.
--
-- Additional fixes:
--   - students: no instructor SELECT/INSERT/DELETE policies (was admin-only since 012)
--   - event_registrations: policies referenced e.instructor_id (column doesn't exist,
--     events uses user_id) and registered_by/status columns removed in schema refactor
--   - enrollments: table does not exist — removed from this migration

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Fix the cohort-change trigger (migration 027)
--    Check the REQUESTER's role, not the row being updated's role.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.prevent_student_cohort_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service-role / server-side calls (e.g. payment processor moving student to
  -- outstanding cohort) have auth.uid() = NULL — allow unconditionally.
  IF (select auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow if the person making the request is an instructor or admin.
  -- This covers: dashboard cohort reassignment, payment page override.
  -- Uses SECURITY DEFINER so the students query bypasses RLS (no recursion).
  IF EXISTS (
    SELECT 1 FROM public.students
    WHERE id = (select auth.uid())
      AND role IN ('admin', 'instructor')
  ) THEN
    RETURN NEW;
  END IF;

  -- Block students from changing their own cohort via the REST API.
  RAISE EXCEPTION 'permission denied: students may not change their own cohort'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

-- Trigger already exists from 027 — replace the function is enough.
-- Recreate trigger to be safe.
DROP TRIGGER IF EXISTS trg_prevent_student_cohort_change ON public.students;
CREATE TRIGGER trg_prevent_student_cohort_change
  BEFORE UPDATE OF cohort_id, original_cohort_id ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_student_cohort_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. students RLS
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "students: own select"               ON public.students;
DROP POLICY IF EXISTS "students: select"                   ON public.students;
DROP POLICY IF EXISTS "students: admin insert"             ON public.students;
DROP POLICY IF EXISTS "students: admin update"             ON public.students;
DROP POLICY IF EXISTS "students: admin delete"             ON public.students;
DROP POLICY IF EXISTS "students: instructor insert"        ON public.students;
DROP POLICY IF EXISTS "students: instructor update"        ON public.students;
DROP POLICY IF EXISTS "students: instructor delete"        ON public.students;
DROP POLICY IF EXISTS "students: instructor assign cohort" ON public.students;
-- "students: own update" is kept — students can still update their own
-- non-privileged fields (name, avatar, etc.) as per migration 018/027.

-- Students see only themselves; instructors and admins see everyone.
CREATE POLICY "students: select"
  ON public.students FOR SELECT
  USING (
    (select auth.uid()) = id
    OR (select public.is_instructor_or_admin())
  );

-- Instructors and admins can create, update, and delete any student record.
-- This includes moving students between cohorts (payment override etc.).
CREATE POLICY "students: instructor insert"
  ON public.students FOR INSERT
  WITH CHECK ((select public.is_instructor_or_admin()));

CREATE POLICY "students: instructor update"
  ON public.students FOR UPDATE
  USING  ((select public.is_instructor_or_admin()))
  WITH CHECK ((select public.is_instructor_or_admin()));

CREATE POLICY "students: instructor delete"
  ON public.students FOR DELETE
  USING ((select public.is_instructor_or_admin()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. event_registrations RLS
--    Old policies referenced e.instructor_id (events uses user_id),
--    registered_by column (removed in 039), cohort_events table (removed in
--    schema refactor), and status column (never set by current RPC).
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "event_registrations: select"                ON public.event_registrations;
DROP POLICY IF EXISTS "event_registrations: student self-register"  ON public.event_registrations;
DROP POLICY IF EXISTS "event_registrations: student insert"         ON public.event_registrations;
DROP POLICY IF EXISTS "event_registrations: instructor manage"      ON public.event_registrations;
DROP POLICY IF EXISTS "event_registrations: student cancel"         ON public.event_registrations;

-- Students see their own registrations; instructors/admins see all.
CREATE POLICY "event_registrations: select"
  ON public.event_registrations FOR SELECT
  USING (
    student_id = (select auth.uid())
    OR (select public.is_instructor_or_admin())
  );

-- Students can register themselves. Capacity check included.
-- Note: the register_event_attendee RPC is SECURITY DEFINER so it bypasses
-- RLS anyway — this policy covers any direct REST inserts.
CREATE POLICY "event_registrations: student insert"
  ON public.event_registrations FOR INSERT
  WITH CHECK (
    student_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.events e
      JOIN  public.students s ON s.id = (select auth.uid())
      WHERE e.id = event_id
        AND e.status = 'published'
        AND s.cohort_id = ANY(e.cohort_ids)
        AND (
          e.capacity IS NULL
          OR (SELECT count(*) FROM public.event_registrations er WHERE er.event_id = e.id) < e.capacity
        )
    )
  );

-- Instructors and admins have full control over registrations.
CREATE POLICY "event_registrations: instructor manage"
  ON public.event_registrations FOR ALL
  USING  ((select public.is_instructor_or_admin()))
  WITH CHECK ((select public.is_instructor_or_admin()));
