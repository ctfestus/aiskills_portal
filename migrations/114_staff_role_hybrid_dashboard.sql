-- Staff hybrid dashboard permissions.
-- Staff use /student by default and get a limited /dashboard operations console:
-- live sessions (events), recordings, tracking, and cohorts.

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_role_check;

ALTER TABLE public.students
  ADD CONSTRAINT students_role_check
  CHECK (role IN ('student', 'instructor', 'admin', 'staff'));

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students
    WHERE id = (SELECT auth.uid()) AND role = 'staff'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- Staff can view students for cohort roster/tracking, but cannot manage students.
DROP POLICY IF EXISTS "students: staff select" ON public.students;
CREATE POLICY "students: staff select"
  ON public.students FOR SELECT
  USING ((SELECT public.is_staff()));

-- Staff can view all cohorts. Cohort metadata edits go through /api/cohorts/[id].
DROP POLICY IF EXISTS "cohorts: staff select" ON public.cohorts;
CREATE POLICY "cohorts: staff select"
  ON public.cohorts FOR SELECT
  USING ((SELECT public.is_staff()));

-- Staff can view published content for cohort assignment. Assignment mutation is
-- handled by /api/cohort-content-assignment so staff are not granted broad writes.
DROP POLICY IF EXISTS "courses: staff published select" ON public.courses;
CREATE POLICY "courses: staff published select"
  ON public.courses FOR SELECT
  USING ((SELECT public.is_staff()) AND status = 'published');

DROP POLICY IF EXISTS "virtual_experiences: staff published select" ON public.virtual_experiences;
CREATE POLICY "virtual_experiences: staff published select"
  ON public.virtual_experiences FOR SELECT
  USING ((SELECT public.is_staff()) AND status = 'published');

DROP POLICY IF EXISTS "assignments: staff published select" ON public.assignments;
CREATE POLICY "assignments: staff published select"
  ON public.assignments FOR SELECT
  USING ((SELECT public.is_staff()) AND status = 'published');

DROP POLICY IF EXISTS "learning_paths: staff published select" ON public.learning_paths;
CREATE POLICY "learning_paths: staff published select"
  ON public.learning_paths FOR SELECT
  USING ((SELECT public.is_staff()) AND status = 'published');

-- Live sessions: staff can create and edit any event, but cannot delete.
DROP POLICY IF EXISTS "events: staff select" ON public.events;
CREATE POLICY "events: staff select"
  ON public.events FOR SELECT
  USING ((SELECT public.is_staff()));

DROP POLICY IF EXISTS "events: staff insert" ON public.events;
CREATE POLICY "events: staff insert"
  ON public.events FOR INSERT
  WITH CHECK ((SELECT public.is_staff()) AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "events: staff update" ON public.events;
CREATE POLICY "events: staff update"
  ON public.events FOR UPDATE
  USING ((SELECT public.is_staff()))
  WITH CHECK ((SELECT public.is_staff()));

-- Tracking read access.
DROP POLICY IF EXISTS "responses: staff select" ON public.responses;
CREATE POLICY "responses: staff select"
  ON public.responses FOR SELECT
  USING ((SELECT public.is_staff()));

DROP POLICY IF EXISTS "event_registrations: staff select" ON public.event_registrations;
CREATE POLICY "event_registrations: staff select"
  ON public.event_registrations FOR SELECT
  USING ((SELECT public.is_staff()));

DROP POLICY IF EXISTS "live_attendance: staff select" ON public.live_attendance;
CREATE POLICY "live_attendance: staff select"
  ON public.live_attendance FOR SELECT
  USING ((SELECT public.is_staff()));

DROP POLICY IF EXISTS "course_attempts: staff select" ON public.course_attempts;
CREATE POLICY "course_attempts: staff select"
  ON public.course_attempts FOR SELECT
  USING ((SELECT public.is_staff()));

DROP POLICY IF EXISTS "guided_project_attempts: staff select" ON public.guided_project_attempts;
CREATE POLICY "guided_project_attempts: staff select"
  ON public.guided_project_attempts FOR SELECT
  USING ((SELECT public.is_staff()));

DROP POLICY IF EXISTS "student_xp: staff select" ON public.student_xp;
CREATE POLICY "student_xp: staff select"
  ON public.student_xp FOR SELECT
  USING ((SELECT public.is_staff()));

-- Recordings: staff can create/edit recordings and entries, but cannot delete
-- recordings. Entry deletion is needed when the recording editor replaces weeks.
DROP POLICY IF EXISTS "recordings: staff select" ON public.recordings;
CREATE POLICY "recordings: staff select"
  ON public.recordings FOR SELECT
  USING ((SELECT public.is_staff()));

DROP POLICY IF EXISTS "recordings: staff insert" ON public.recordings;
CREATE POLICY "recordings: staff insert"
  ON public.recordings FOR INSERT
  WITH CHECK ((SELECT public.is_staff()) AND created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "recordings: staff update" ON public.recordings;
CREATE POLICY "recordings: staff update"
  ON public.recordings FOR UPDATE
  USING ((SELECT public.is_staff()))
  WITH CHECK ((SELECT public.is_staff()));

DROP POLICY IF EXISTS "recording_entries: staff select" ON public.recording_entries;
CREATE POLICY "recording_entries: staff select"
  ON public.recording_entries FOR SELECT
  USING ((SELECT public.is_staff()));

DROP POLICY IF EXISTS "recording_entries: staff manage" ON public.recording_entries;
CREATE POLICY "recording_entries: staff manage"
  ON public.recording_entries FOR ALL
  USING ((SELECT public.is_staff()))
  WITH CHECK ((SELECT public.is_staff()));
