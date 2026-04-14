-- Migration 042: Instructor = Admin rights across all tables
--
-- Problems identified:
-- 1. students table: no instructor SELECT/INSERT/UPDATE/DELETE (only admin or own record)
-- 2. event_registrations: SELECT + manage policies referenced e.instructor_id (doesn't exist,
--    events table uses user_id) — causes all student registration queries to fail silently
-- 3. enrollments: SELECT references courses.instructor_id (doesn't exist, courses use user_id)
-- 4. event_registrations INSERT: references registered_by column + cohort_events table
--    that may not exist post schema refactor

-- ── students ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "students: own select"              ON public.students;
DROP POLICY IF EXISTS "students: own update"              ON public.students;
DROP POLICY IF EXISTS "students: admin insert"            ON public.students;
DROP POLICY IF EXISTS "students: admin update"            ON public.students;
DROP POLICY IF EXISTS "students: admin delete"            ON public.students;
DROP POLICY IF EXISTS "students: instructor assign cohort" ON public.students;

-- Instructors and admins can read all students
CREATE POLICY "students: select"
  ON public.students FOR SELECT
  USING (
    (select auth.uid()) = id
    OR (select public.is_instructor_or_admin())
  );

-- Students can update their own non-privileged fields
CREATE POLICY "students: own update"
  ON public.students FOR UPDATE
  USING ((select auth.uid()) = id)
  WITH CHECK (
    (select auth.uid()) = id
    AND role = public.get_my_role()
    AND status = (SELECT status FROM public.students WHERE id = (select auth.uid()))
  );

-- Instructors and admins can insert, update, delete any student
CREATE POLICY "students: instructor insert"
  ON public.students FOR INSERT
  WITH CHECK ((select public.is_instructor_or_admin()));

CREATE POLICY "students: instructor update"
  ON public.students FOR UPDATE
  USING ((select public.is_instructor_or_admin()))
  WITH CHECK ((select public.is_instructor_or_admin()));

CREATE POLICY "students: instructor delete"
  ON public.students FOR DELETE
  USING ((select public.is_instructor_or_admin()));

-- ── enrollments ───────────────────────────────────────────────────────────
-- Old policies referenced courses.instructor_id which doesn't exist (courses use user_id)
DROP POLICY IF EXISTS "enrollments: select"            ON public.enrollments;
DROP POLICY IF EXISTS "enrollments: instructor insert" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments: instructor update" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments: instructor delete" ON public.enrollments;

CREATE POLICY "enrollments: select"
  ON public.enrollments FOR SELECT
  USING (
    student_id = (select auth.uid())
    OR (select public.is_instructor_or_admin())
  );

CREATE POLICY "enrollments: instructor insert"
  ON public.enrollments FOR INSERT
  WITH CHECK ((select public.is_instructor_or_admin()));

CREATE POLICY "enrollments: instructor update"
  ON public.enrollments FOR UPDATE
  USING ((select public.is_instructor_or_admin()))
  WITH CHECK ((select public.is_instructor_or_admin()));

CREATE POLICY "enrollments: instructor delete"
  ON public.enrollments FOR DELETE
  USING ((select public.is_instructor_or_admin()));

-- ── event_registrations ───────────────────────────────────────────────────
-- Fully replace all policies. Old ones referenced instructor_id, registered_by,
-- cohort_events, and status columns that don't exist after schema refactor.
DROP POLICY IF EXISTS "event_registrations: select"              ON public.event_registrations;
DROP POLICY IF EXISTS "event_registrations: student self-register" ON public.event_registrations;
DROP POLICY IF EXISTS "event_registrations: instructor manage"   ON public.event_registrations;
DROP POLICY IF EXISTS "event_registrations: student cancel"      ON public.event_registrations;

-- Students read their own; instructors/admins read all
CREATE POLICY "event_registrations: select"
  ON public.event_registrations FOR SELECT
  USING (
    student_id = (select auth.uid())
    OR (select public.is_instructor_or_admin())
  );

-- Students can register themselves for published events in their cohort
CREATE POLICY "event_registrations: student insert"
  ON public.event_registrations FOR INSERT
  WITH CHECK (
    student_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND e.status = 'published'
        AND (e.capacity IS NULL OR (
          SELECT count(*) FROM public.event_registrations er WHERE er.event_id = e.id
        ) < e.capacity)
        AND (SELECT cohort_id FROM public.students WHERE id = (select auth.uid())) = ANY(e.cohort_ids)
    )
  );

-- Instructors and admins can do anything
CREATE POLICY "event_registrations: instructor manage"
  ON public.event_registrations FOR ALL
  USING ((select public.is_instructor_or_admin()))
  WITH CHECK ((select public.is_instructor_or_admin()));
