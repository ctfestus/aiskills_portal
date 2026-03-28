-- Performance fix: RLS per-row function call overhead
-- Wraps auth.uid(), public.is_admin(), and public.is_instructor_or_admin()
-- in (select ...) so Postgres evaluates each once per query, not once per row.

-- ── Helper functions ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  select exists (select 1 from public.students where id = (select auth.uid()) and role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_instructor_or_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  select exists (select 1 from public.students where id = (select auth.uid()) and role in ('instructor','admin'))
$$;

-- ── students ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "students: own select"   ON public.students;
DROP POLICY IF EXISTS "students: own update"   ON public.students;
DROP POLICY IF EXISTS "students: admin insert" ON public.students;
DROP POLICY IF EXISTS "students: admin update" ON public.students;
DROP POLICY IF EXISTS "students: admin delete" ON public.students;

CREATE POLICY "students: own select"   ON public.students FOR SELECT USING ((select auth.uid()) = id OR (select public.is_admin()));
CREATE POLICY "students: own update"   ON public.students FOR UPDATE
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id AND role = public.get_my_role() AND status = (SELECT status FROM public.students WHERE id = (select auth.uid())));
CREATE POLICY "students: admin insert" ON public.students FOR INSERT WITH CHECK ((select public.is_admin()));
CREATE POLICY "students: admin update" ON public.students FOR UPDATE USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));
CREATE POLICY "students: admin delete" ON public.students FOR DELETE USING ((select public.is_admin()));

-- ── cohorts ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cohorts: select"            ON public.cohorts;
DROP POLICY IF EXISTS "cohorts: instructor insert" ON public.cohorts;
DROP POLICY IF EXISTS "cohorts: instructor update" ON public.cohorts;
DROP POLICY IF EXISTS "cohorts: instructor delete" ON public.cohorts;

CREATE POLICY "cohorts: select" ON public.cohorts FOR SELECT USING (
  (select public.is_admin()) OR created_by = (select auth.uid())
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = (select auth.uid()) AND s.cohort_id = cohorts.id)
);
CREATE POLICY "cohorts: instructor insert" ON public.cohorts FOR INSERT WITH CHECK ((select public.is_instructor_or_admin()) AND (created_by = (select auth.uid()) OR (select public.is_admin())));
CREATE POLICY "cohorts: instructor update" ON public.cohorts FOR UPDATE USING (created_by = (select auth.uid()) OR (select public.is_admin())) WITH CHECK (created_by = (select auth.uid()) OR (select public.is_admin()));
CREATE POLICY "cohorts: instructor delete" ON public.cohorts FOR DELETE USING (created_by = (select auth.uid()) OR (select public.is_admin()));

-- ── cohort_members ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cohort_members: select"            ON public.cohort_members;
DROP POLICY IF EXISTS "cohort_members: instructor insert" ON public.cohort_members;
DROP POLICY IF EXISTS "cohort_members: instructor delete" ON public.cohort_members;

CREATE POLICY "cohort_members: select" ON public.cohort_members FOR SELECT USING (
  student_id = (select auth.uid()) OR (select public.is_admin())
  OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid()))
);
CREATE POLICY "cohort_members: instructor insert" ON public.cohort_members FOR INSERT WITH CHECK (
  (select public.is_instructor_or_admin()) AND (EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid())) OR (select public.is_admin()))
);
CREATE POLICY "cohort_members: instructor delete" ON public.cohort_members FOR DELETE USING (
  (select public.is_admin()) OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid()))
);

-- ── courses ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "courses: select"            ON public.courses;
DROP POLICY IF EXISTS "courses: instructor insert" ON public.courses;
DROP POLICY IF EXISTS "courses: instructor update" ON public.courses;
DROP POLICY IF EXISTS "courses: instructor delete" ON public.courses;

CREATE POLICY "courses: select" ON public.courses FOR SELECT USING (
  instructor_id = (select auth.uid()) OR (select public.is_admin())
  OR EXISTS (SELECT 1 FROM public.cohort_courses cc JOIN public.students s ON s.cohort_id = cc.cohort_id WHERE cc.course_id = courses.id AND s.id = (select auth.uid()))
);
CREATE POLICY "courses: instructor insert" ON public.courses FOR INSERT WITH CHECK ((select public.is_instructor_or_admin()) AND (instructor_id = (select auth.uid()) OR (select public.is_admin())));
CREATE POLICY "courses: instructor update" ON public.courses FOR UPDATE USING (instructor_id = (select auth.uid()) OR (select public.is_admin())) WITH CHECK (instructor_id = (select auth.uid()) OR (select public.is_admin()));
CREATE POLICY "courses: instructor delete" ON public.courses FOR DELETE USING (instructor_id = (select auth.uid()) OR (select public.is_admin()));

-- ── assignments ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "assignments: select"            ON public.assignments;
DROP POLICY IF EXISTS "assignments: instructor insert" ON public.assignments;
DROP POLICY IF EXISTS "assignments: instructor update" ON public.assignments;
DROP POLICY IF EXISTS "assignments: instructor delete" ON public.assignments;

CREATE POLICY "assignments: select" ON public.assignments FOR SELECT USING (
  created_by = (select auth.uid()) OR (select public.is_admin())
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = (select auth.uid()) AND s.cohort_id = ANY(cohort_ids))
);
CREATE POLICY "assignments: instructor insert" ON public.assignments FOR INSERT WITH CHECK ((select public.is_instructor_or_admin()) AND (created_by = (select auth.uid()) OR (select public.is_admin())));
CREATE POLICY "assignments: instructor update" ON public.assignments FOR UPDATE USING (created_by = (select auth.uid()) OR (select public.is_admin())) WITH CHECK (created_by = (select auth.uid()) OR (select public.is_admin()));
CREATE POLICY "assignments: instructor delete" ON public.assignments FOR DELETE USING (created_by = (select auth.uid()) OR (select public.is_admin()));

-- ── assignment_resources ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "assignment_resources: select"           ON public.assignment_resources;
DROP POLICY IF EXISTS "assignment_resources: instructor manage" ON public.assignment_resources;

CREATE POLICY "assignment_resources: select" ON public.assignment_resources FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND (a.created_by = (select auth.uid()) OR (select public.is_admin()) OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = (select auth.uid()) AND s.cohort_id = ANY(a.cohort_ids))))
);
CREATE POLICY "assignment_resources: instructor manage" ON public.assignment_resources FOR ALL
  USING (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND (a.created_by = (select auth.uid()) OR (select public.is_admin()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND (a.created_by = (select auth.uid()) OR (select public.is_admin()))));

-- ── events ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "events: select"            ON public.events;
DROP POLICY IF EXISTS "events: instructor insert" ON public.events;
DROP POLICY IF EXISTS "events: instructor update" ON public.events;
DROP POLICY IF EXISTS "events: instructor delete" ON public.events;

CREATE POLICY "events: select" ON public.events FOR SELECT USING (
  instructor_id = (select auth.uid()) OR (select public.is_admin())
  OR EXISTS (SELECT 1 FROM public.cohort_events ce JOIN public.students s ON s.cohort_id = ce.cohort_id WHERE ce.event_id = events.id AND s.id = (select auth.uid()))
);
CREATE POLICY "events: instructor insert" ON public.events FOR INSERT WITH CHECK ((select public.is_instructor_or_admin()) AND (instructor_id = (select auth.uid()) OR (select public.is_admin())));
CREATE POLICY "events: instructor update" ON public.events FOR UPDATE USING (instructor_id = (select auth.uid()) OR (select public.is_admin())) WITH CHECK (instructor_id = (select auth.uid()) OR (select public.is_admin()));
CREATE POLICY "events: instructor delete" ON public.events FOR DELETE USING (instructor_id = (select auth.uid()) OR (select public.is_admin()));

-- ── projects ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "projects: select"            ON public.projects;
DROP POLICY IF EXISTS "projects: instructor insert" ON public.projects;
DROP POLICY IF EXISTS "projects: instructor update" ON public.projects;
DROP POLICY IF EXISTS "projects: instructor delete" ON public.projects;

CREATE POLICY "projects: select" ON public.projects FOR SELECT USING (
  created_by = (select auth.uid()) OR (select public.is_admin())
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = (select auth.uid()) AND s.cohort_id = ANY(cohort_ids))
);
CREATE POLICY "projects: instructor insert" ON public.projects FOR INSERT WITH CHECK ((select public.is_instructor_or_admin()) AND (created_by = (select auth.uid()) OR (select public.is_admin())));
CREATE POLICY "projects: instructor update" ON public.projects FOR UPDATE USING (created_by = (select auth.uid()) OR (select public.is_admin())) WITH CHECK (created_by = (select auth.uid()) OR (select public.is_admin()));
CREATE POLICY "projects: instructor delete" ON public.projects FOR DELETE USING (created_by = (select auth.uid()) OR (select public.is_admin()));

-- ── project_resources ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "project_resources: select"           ON public.project_resources;
DROP POLICY IF EXISTS "project_resources: instructor manage" ON public.project_resources;

CREATE POLICY "project_resources: select" ON public.project_resources FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.created_by = (select auth.uid()) OR (select public.is_admin()) OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = (select auth.uid()) AND s.cohort_id = ANY(p.cohort_ids))))
);
CREATE POLICY "project_resources: instructor manage" ON public.project_resources FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.created_by = (select auth.uid()) OR (select public.is_admin()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.created_by = (select auth.uid()) OR (select public.is_admin()))));

-- ── communities ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "communities: select"            ON public.communities;
DROP POLICY IF EXISTS "communities: instructor insert" ON public.communities;
DROP POLICY IF EXISTS "communities: instructor update" ON public.communities;
DROP POLICY IF EXISTS "communities: instructor delete" ON public.communities;

CREATE POLICY "communities: select" ON public.communities FOR SELECT USING (
  created_by = (select auth.uid()) OR (select public.is_admin())
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = (select auth.uid()) AND s.cohort_id = ANY(cohort_ids))
);
CREATE POLICY "communities: instructor insert" ON public.communities FOR INSERT WITH CHECK ((select public.is_instructor_or_admin()) AND (created_by = (select auth.uid()) OR (select public.is_admin())));
CREATE POLICY "communities: instructor update" ON public.communities FOR UPDATE USING (created_by = (select auth.uid()) OR (select public.is_admin())) WITH CHECK (created_by = (select auth.uid()) OR (select public.is_admin()));
CREATE POLICY "communities: instructor delete" ON public.communities FOR DELETE USING (created_by = (select auth.uid()) OR (select public.is_admin()));

-- ── announcements ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "announcements: select"            ON public.announcements;
DROP POLICY IF EXISTS "announcements: instructor insert" ON public.announcements;
DROP POLICY IF EXISTS "announcements: instructor update" ON public.announcements;
DROP POLICY IF EXISTS "announcements: instructor delete" ON public.announcements;

CREATE POLICY "announcements: select" ON public.announcements FOR SELECT USING (
  author_id = (select auth.uid()) OR (select public.is_admin())
  OR ((expires_at IS NULL OR expires_at > now()) AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = (select auth.uid()) AND s.cohort_id = ANY(cohort_ids)))
);
CREATE POLICY "announcements: instructor insert" ON public.announcements FOR INSERT WITH CHECK ((select public.is_instructor_or_admin()) AND (author_id = (select auth.uid()) OR (select public.is_admin())));
CREATE POLICY "announcements: instructor update" ON public.announcements FOR UPDATE USING (author_id = (select auth.uid()) OR (select public.is_admin())) WITH CHECK (author_id = (select auth.uid()) OR (select public.is_admin()));
CREATE POLICY "announcements: instructor delete" ON public.announcements FOR DELETE USING (author_id = (select auth.uid()) OR (select public.is_admin()));

-- ── announcement_reads ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "announcement_reads: select"           ON public.announcement_reads;
DROP POLICY IF EXISTS "announcement_reads: student mark read" ON public.announcement_reads;

CREATE POLICY "announcement_reads: select"           ON public.announcement_reads FOR SELECT USING (student_id = (select auth.uid()) OR (select public.is_instructor_or_admin()));
CREATE POLICY "announcement_reads: student mark read" ON public.announcement_reads FOR INSERT WITH CHECK (student_id = (select auth.uid()));

-- ── schedules ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "schedules: select"            ON public.schedules;
DROP POLICY IF EXISTS "schedules: instructor insert" ON public.schedules;
DROP POLICY IF EXISTS "schedules: instructor update" ON public.schedules;
DROP POLICY IF EXISTS "schedules: instructor delete" ON public.schedules;

CREATE POLICY "schedules: select" ON public.schedules FOR SELECT USING (
  created_by = (select auth.uid()) OR (select public.is_admin())
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = (select auth.uid()) AND s.cohort_id = ANY(cohort_ids))
);
CREATE POLICY "schedules: instructor insert" ON public.schedules FOR INSERT WITH CHECK ((select public.is_instructor_or_admin()) AND (created_by = (select auth.uid()) OR (select public.is_admin())));
CREATE POLICY "schedules: instructor update" ON public.schedules FOR UPDATE USING (created_by = (select auth.uid()) OR (select public.is_admin())) WITH CHECK (created_by = (select auth.uid()) OR (select public.is_admin()));
CREATE POLICY "schedules: instructor delete" ON public.schedules FOR DELETE USING (created_by = (select auth.uid()) OR (select public.is_admin()));

-- ── schedule_topics ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "schedule_topics: select"           ON public.schedule_topics;
DROP POLICY IF EXISTS "schedule_topics: instructor manage" ON public.schedule_topics;

CREATE POLICY "schedule_topics: select" ON public.schedule_topics FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = schedule_id AND (s.created_by = (select auth.uid()) OR (select public.is_admin()) OR EXISTS (SELECT 1 FROM public.cohort_courses cc JOIN public.students st ON st.cohort_id = cc.cohort_id WHERE cc.course_id = s.course_id AND st.id = (select auth.uid()))))
);
CREATE POLICY "schedule_topics: instructor manage" ON public.schedule_topics FOR ALL
  USING (EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = schedule_id AND (s.created_by = (select auth.uid()) OR (select public.is_admin()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = schedule_id AND (s.created_by = (select auth.uid()) OR (select public.is_admin()))));

-- ── schedule_resources ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "schedule_resources: select"           ON public.schedule_resources;
DROP POLICY IF EXISTS "schedule_resources: instructor manage" ON public.schedule_resources;

CREATE POLICY "schedule_resources: select" ON public.schedule_resources FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = schedule_id AND (s.created_by = (select auth.uid()) OR (select public.is_admin()) OR EXISTS (SELECT 1 FROM public.cohort_courses cc JOIN public.students st ON st.cohort_id = cc.cohort_id WHERE cc.course_id = s.course_id AND st.id = (select auth.uid()))))
);
CREATE POLICY "schedule_resources: instructor manage" ON public.schedule_resources FOR ALL
  USING (EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = schedule_id AND (s.created_by = (select auth.uid()) OR (select public.is_admin()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = schedule_id AND (s.created_by = (select auth.uid()) OR (select public.is_admin()))));

-- ── cohort_courses ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cohort_courses: select"           ON public.cohort_courses;
DROP POLICY IF EXISTS "cohort_courses: instructor manage" ON public.cohort_courses;

CREATE POLICY "cohort_courses: select" ON public.cohort_courses FOR SELECT USING (
  (select public.is_admin())
  OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid()))
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = (select auth.uid()) AND s.cohort_id = cohort_courses.cohort_id)
);
CREATE POLICY "cohort_courses: instructor manage" ON public.cohort_courses FOR ALL
  USING ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid())))
  WITH CHECK ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid())));

-- ── cohort_assignments ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cohort_assignments: select"           ON public.cohort_assignments;
DROP POLICY IF EXISTS "cohort_assignments: instructor manage" ON public.cohort_assignments;

CREATE POLICY "cohort_assignments: select" ON public.cohort_assignments FOR SELECT USING (
  (select public.is_admin())
  OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid()))
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = (select auth.uid()) AND s.cohort_id = cohort_assignments.cohort_id)
);
CREATE POLICY "cohort_assignments: instructor manage" ON public.cohort_assignments FOR ALL
  USING ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid())))
  WITH CHECK ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid())));

-- ── cohort_events ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cohort_events: select"           ON public.cohort_events;
DROP POLICY IF EXISTS "cohort_events: instructor manage" ON public.cohort_events;

CREATE POLICY "cohort_events: select" ON public.cohort_events FOR SELECT USING (
  (select public.is_admin())
  OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid()))
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = (select auth.uid()) AND s.cohort_id = cohort_events.cohort_id)
);
CREATE POLICY "cohort_events: instructor manage" ON public.cohort_events FOR ALL
  USING ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid())))
  WITH CHECK ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid())));

-- ── cohort_projects ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cohort_projects: select"           ON public.cohort_projects;
DROP POLICY IF EXISTS "cohort_projects: instructor manage" ON public.cohort_projects;

CREATE POLICY "cohort_projects: select" ON public.cohort_projects FOR SELECT USING (
  (select public.is_admin())
  OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid()))
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = (select auth.uid()) AND s.cohort_id = cohort_projects.cohort_id)
);
CREATE POLICY "cohort_projects: instructor manage" ON public.cohort_projects FOR ALL
  USING ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid())))
  WITH CHECK ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid())));

-- ── cohort_communities ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cohort_communities: select"           ON public.cohort_communities;
DROP POLICY IF EXISTS "cohort_communities: instructor manage" ON public.cohort_communities;

CREATE POLICY "cohort_communities: select" ON public.cohort_communities FOR SELECT USING (
  (select public.is_admin())
  OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid()))
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = (select auth.uid()) AND s.cohort_id = cohort_communities.cohort_id)
);
CREATE POLICY "cohort_communities: instructor manage" ON public.cohort_communities FOR ALL
  USING ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid())))
  WITH CHECK ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid())));

-- ── cohort_announcements ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "cohort_announcements: select"           ON public.cohort_announcements;
DROP POLICY IF EXISTS "cohort_announcements: instructor manage" ON public.cohort_announcements;

CREATE POLICY "cohort_announcements: select" ON public.cohort_announcements FOR SELECT USING (
  (select public.is_admin())
  OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid()))
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = (select auth.uid()) AND s.cohort_id = cohort_announcements.cohort_id)
);
CREATE POLICY "cohort_announcements: instructor manage" ON public.cohort_announcements FOR ALL
  USING ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid())))
  WITH CHECK ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.cohorts c WHERE c.id = cohort_id AND c.created_by = (select auth.uid())));

-- ── enrollments ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "enrollments: select"            ON public.enrollments;
DROP POLICY IF EXISTS "enrollments: instructor insert" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments: instructor update" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments: instructor delete" ON public.enrollments;

CREATE POLICY "enrollments: select" ON public.enrollments FOR SELECT USING (
  student_id = (select auth.uid()) OR (select public.is_admin())
  OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = (select auth.uid()))
);
CREATE POLICY "enrollments: instructor insert" ON public.enrollments FOR INSERT WITH CHECK (
  (select public.is_instructor_or_admin()) AND (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = (select auth.uid())) OR (select public.is_admin()))
);
CREATE POLICY "enrollments: instructor update" ON public.enrollments FOR UPDATE
  USING ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = (select auth.uid())))
  WITH CHECK ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = (select auth.uid())));
CREATE POLICY "enrollments: instructor delete" ON public.enrollments FOR DELETE USING (
  (select public.is_admin()) OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.instructor_id = (select auth.uid()))
);

-- ── assignment_submissions ────────────────────────────────────────────────
DROP POLICY IF EXISTS "assignment_submissions: select"          ON public.assignment_submissions;
DROP POLICY IF EXISTS "assignment_submissions: student insert"  ON public.assignment_submissions;
DROP POLICY IF EXISTS "assignment_submissions: student update"  ON public.assignment_submissions;
DROP POLICY IF EXISTS "assignment_submissions: instructor grade" ON public.assignment_submissions;

CREATE POLICY "assignment_submissions: select" ON public.assignment_submissions FOR SELECT USING (
  student_id = (select auth.uid()) OR (select public.is_admin())
  OR EXISTS (SELECT 1 FROM public.students WHERE id = (select auth.uid()) AND role = 'instructor')
  OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND a.created_by = (select auth.uid()))
);
CREATE POLICY "assignment_submissions: student insert" ON public.assignment_submissions FOR INSERT WITH CHECK (
  student_id = (select auth.uid())
  AND EXISTS (SELECT 1 FROM public.assignments a JOIN public.students s ON s.id = (select auth.uid()) WHERE a.id = assignment_submissions.assignment_id AND s.cohort_id = ANY(a.cohort_ids))
);
CREATE POLICY "assignment_submissions: student update" ON public.assignment_submissions FOR UPDATE
  USING (student_id = (select auth.uid()) AND status IN ('draft','submitted'))
  WITH CHECK (
    student_id = (select auth.uid()) AND status IN ('draft','submitted')
    AND score     IS NOT DISTINCT FROM (SELECT score     FROM public.assignment_submissions s WHERE s.id = assignment_submissions.id)
    AND feedback  IS NOT DISTINCT FROM (SELECT feedback  FROM public.assignment_submissions s WHERE s.id = assignment_submissions.id)
    AND graded_by IS NOT DISTINCT FROM (SELECT graded_by FROM public.assignment_submissions s WHERE s.id = assignment_submissions.id)
    AND graded_at IS NOT DISTINCT FROM (SELECT graded_at FROM public.assignment_submissions s WHERE s.id = assignment_submissions.id)
  );
CREATE POLICY "assignment_submissions: instructor grade" ON public.assignment_submissions FOR UPDATE
  USING ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.students WHERE id = (select auth.uid()) AND role = 'instructor') OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND a.created_by = (select auth.uid())))
  WITH CHECK ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.students WHERE id = (select auth.uid()) AND role = 'instructor') OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND a.created_by = (select auth.uid())));

-- ── assignment_submission_files ───────────────────────────────────────────
DROP POLICY IF EXISTS "assignment_submission_files: select"           ON public.assignment_submission_files;
DROP POLICY IF EXISTS "assignment_submission_files: student upload"   ON public.assignment_submission_files;
DROP POLICY IF EXISTS "assignment_submission_files: student delete own" ON public.assignment_submission_files;

CREATE POLICY "assignment_submission_files: select" ON public.assignment_submission_files FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.assignment_submissions s WHERE s.id = submission_id AND (s.student_id = (select auth.uid()) OR (select public.is_admin()) OR EXISTS (SELECT 1 FROM public.students WHERE id = (select auth.uid()) AND role = 'instructor') OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = s.assignment_id AND a.created_by = (select auth.uid()))))
);
CREATE POLICY "assignment_submission_files: student upload" ON public.assignment_submission_files FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.assignment_submissions s WHERE s.id = submission_id AND s.student_id = (select auth.uid()) AND s.status != 'graded')
);
CREATE POLICY "assignment_submission_files: student delete own" ON public.assignment_submission_files FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.assignment_submissions s WHERE s.id = submission_id AND s.student_id = (select auth.uid()) AND s.status = 'draft')
);

-- ── project_submissions ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "project_submissions: select"           ON public.project_submissions;
DROP POLICY IF EXISTS "project_submissions: student insert"   ON public.project_submissions;
DROP POLICY IF EXISTS "project_submissions: student update"   ON public.project_submissions;
DROP POLICY IF EXISTS "project_submissions: instructor review" ON public.project_submissions;

CREATE POLICY "project_submissions: select" ON public.project_submissions FOR SELECT USING (
  student_id = (select auth.uid()) OR (select public.is_admin())
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.created_by = (select auth.uid()))
);
CREATE POLICY "project_submissions: student insert" ON public.project_submissions FOR INSERT WITH CHECK (
  student_id = (select auth.uid())
  AND EXISTS (SELECT 1 FROM public.projects p JOIN public.students s ON s.id = (select auth.uid()) WHERE p.id = project_submissions.project_id AND s.cohort_id = ANY(p.cohort_ids))
);
CREATE POLICY "project_submissions: student update" ON public.project_submissions FOR UPDATE
  USING (student_id = (select auth.uid()) AND status IN ('draft','submitted'))
  WITH CHECK (
    student_id = (select auth.uid())
    AND score     IS NOT DISTINCT FROM (SELECT score     FROM public.project_submissions s WHERE s.id = project_submissions.id)
    AND graded_by IS NOT DISTINCT FROM (SELECT graded_by FROM public.project_submissions s WHERE s.id = project_submissions.id)
    AND graded_at IS NOT DISTINCT FROM (SELECT graded_at FROM public.project_submissions s WHERE s.id = project_submissions.id)
  );
CREATE POLICY "project_submissions: instructor review" ON public.project_submissions FOR UPDATE
  USING ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.created_by = (select auth.uid())))
  WITH CHECK ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.created_by = (select auth.uid())));

-- ── project_submission_files ──────────────────────────────────────────────
DROP POLICY IF EXISTS "project_submission_files: select"           ON public.project_submission_files;
DROP POLICY IF EXISTS "project_submission_files: student upload"   ON public.project_submission_files;
DROP POLICY IF EXISTS "project_submission_files: student delete own" ON public.project_submission_files;

CREATE POLICY "project_submission_files: select" ON public.project_submission_files FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.project_submissions s WHERE s.id = submission_id AND (s.student_id = (select auth.uid()) OR (select public.is_admin()) OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = s.project_id AND p.created_by = (select auth.uid()))))
);
CREATE POLICY "project_submission_files: student upload" ON public.project_submission_files FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.project_submissions s WHERE s.id = submission_id AND s.student_id = (select auth.uid()) AND s.status != 'reviewed')
);
CREATE POLICY "project_submission_files: student delete own" ON public.project_submission_files FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.project_submissions s WHERE s.id = submission_id AND s.student_id = (select auth.uid()) AND s.status = 'draft')
);

-- ── event_registrations ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "event_registrations: select"           ON public.event_registrations;
DROP POLICY IF EXISTS "event_registrations: student self-register" ON public.event_registrations;
DROP POLICY IF EXISTS "event_registrations: instructor manage" ON public.event_registrations;
DROP POLICY IF EXISTS "event_registrations: student cancel"   ON public.event_registrations;

CREATE POLICY "event_registrations: select" ON public.event_registrations FOR SELECT USING (
  student_id = (select auth.uid()) OR (select public.is_admin())
  OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.instructor_id = (select auth.uid()))
);
CREATE POLICY "event_registrations: student self-register" ON public.event_registrations FOR INSERT WITH CHECK (
  student_id = (select auth.uid()) AND registered_by = (select auth.uid())
  AND EXISTS (SELECT 1 FROM public.cohort_events ce JOIN public.students s ON s.cohort_id = ce.cohort_id WHERE ce.event_id = event_registrations.event_id AND s.id = (select auth.uid()))
  AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status = 'published' AND (e.capacity IS NULL OR (SELECT count(*) FROM public.event_registrations er WHERE er.event_id = e.id AND er.status != 'cancelled') < e.capacity))
);
CREATE POLICY "event_registrations: instructor manage" ON public.event_registrations FOR ALL
  USING ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.instructor_id = (select auth.uid())))
  WITH CHECK ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.instructor_id = (select auth.uid())));
CREATE POLICY "event_registrations: student cancel" ON public.event_registrations FOR UPDATE
  USING (student_id = (select auth.uid()) AND status = 'registered')
  WITH CHECK (student_id = (select auth.uid()) AND status = 'cancelled');

-- ── certificate_defaults ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "certificate_defaults: own select" ON public.certificate_defaults;
DROP POLICY IF EXISTS "certificate_defaults: own upsert" ON public.certificate_defaults;
DROP POLICY IF EXISTS "certificate_defaults: own update" ON public.certificate_defaults;

CREATE POLICY "certificate_defaults: own select" ON public.certificate_defaults FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "certificate_defaults: own upsert" ON public.certificate_defaults FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "certificate_defaults: own update" ON public.certificate_defaults FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- ── meeting_integrations ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "meeting_integrations: own select" ON public.meeting_integrations;
DROP POLICY IF EXISTS "meeting_integrations: own upsert" ON public.meeting_integrations;
DROP POLICY IF EXISTS "meeting_integrations: own update" ON public.meeting_integrations;
DROP POLICY IF EXISTS "meeting_integrations: own delete" ON public.meeting_integrations;

CREATE POLICY "meeting_integrations: own select" ON public.meeting_integrations FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "meeting_integrations: own upsert" ON public.meeting_integrations FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "meeting_integrations: own update" ON public.meeting_integrations FOR UPDATE USING (user_id = (select auth.uid()));
CREATE POLICY "meeting_integrations: own delete" ON public.meeting_integrations FOR DELETE USING (user_id = (select auth.uid()));
