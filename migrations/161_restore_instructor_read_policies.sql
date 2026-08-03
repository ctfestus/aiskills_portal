-- Migration 161: restore the instructor/admin read policies on student-progress tables.
--
-- The canonical schema (festman-fresh-schema.sql) declares "<table>: instructor read/select" SELECT
-- policies USING is_instructor_or_admin() on these tables, but they were never shipped as a numbered
-- migration -- only the "staff select" policies were (migration 114, and is_staff() = role 'staff'
-- only). So databases built up via migrations (aisa, festman) never granted instructors/admins a
-- cross-student read on them. Effect: an instructor/admin SESSION could read only its OWN rows, so
-- leaderboards, cohort stats, course/VE analytics, at-risk scoring, and student reports returned no
-- other-student data. The web app avoids this by reading through service-role routes; direct-session
-- readers (the Claude Desktop MCP tools) could not, which is how this surfaced.
--
-- Confirmed clamped on aisa: student_xp, course_attempts, guided_project_attempts. live_attendance is
-- included on the same pattern (its at-risk attendance signal needs it). These match the canonical
-- schema verbatim; idempotent and additive (SELECT-only, instructor/admin). assignment_submissions is
-- intentionally left untouched -- its SELECT policy already covers instructors and is more complex.

DROP POLICY IF EXISTS "student_xp: instructor read" ON public.student_xp;
CREATE POLICY "student_xp: instructor read"
  ON public.student_xp FOR SELECT
  USING ((SELECT public.is_instructor_or_admin()));

DROP POLICY IF EXISTS "course_attempts: instructor read" ON public.course_attempts;
CREATE POLICY "course_attempts: instructor read"
  ON public.course_attempts FOR SELECT
  USING ((SELECT public.is_instructor_or_admin()));

DROP POLICY IF EXISTS "guided_project_attempts: instructor read" ON public.guided_project_attempts;
CREATE POLICY "guided_project_attempts: instructor read"
  ON public.guided_project_attempts FOR SELECT
  USING ((SELECT public.is_instructor_or_admin()));

DROP POLICY IF EXISTS "live_attendance: instructor select" ON public.live_attendance;
CREATE POLICY "live_attendance: instructor select"
  ON public.live_attendance FOR SELECT
  USING ((SELECT public.is_instructor_or_admin()));
