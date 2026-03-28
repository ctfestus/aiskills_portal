-- GIN indexes for uuid[] array columns used in = ANY(...) RLS checks.
-- B-Tree indexes do not accelerate array containment scans; GIN does.

CREATE INDEX IF NOT EXISTS idx_assignments_cohort_ids   ON public.assignments   USING GIN (cohort_ids);
CREATE INDEX IF NOT EXISTS idx_projects_cohort_ids      ON public.projects      USING GIN (cohort_ids);
CREATE INDEX IF NOT EXISTS idx_communities_cohort_ids   ON public.communities   USING GIN (cohort_ids);
CREATE INDEX IF NOT EXISTS idx_announcements_cohort_ids ON public.announcements USING GIN (cohort_ids);
CREATE INDEX IF NOT EXISTS idx_schedules_cohort_ids     ON public.schedules     USING GIN (cohort_ids);
