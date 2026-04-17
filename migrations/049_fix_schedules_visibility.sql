-- Ensure cohort_ids exists and has the right default (safe no-op if already correct)
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS cohort_ids uuid[] NOT NULL DEFAULT '{}';

-- Ensure RLS is enabled
ALTER TABLE public.schedules             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_topics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_resources    ENABLE ROW LEVEL SECURITY;

-- ── schedules ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "schedules: select"            ON public.schedules;
DROP POLICY IF EXISTS "schedules: instructor insert" ON public.schedules;
DROP POLICY IF EXISTS "schedules: instructor update" ON public.schedules;
DROP POLICY IF EXISTS "schedules: instructor delete" ON public.schedules;

CREATE POLICY "schedules: select"
  ON public.schedules FOR SELECT
  USING (
    created_by = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = (SELECT auth.uid()) AND s.cohort_id = ANY(cohort_ids)
    )
  );

CREATE POLICY "schedules: instructor insert"
  ON public.schedules FOR INSERT
  WITH CHECK (
    (SELECT public.is_instructor_or_admin())
    AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

CREATE POLICY "schedules: instructor update"
  ON public.schedules FOR UPDATE
  USING  ((SELECT public.is_instructor_or_admin()) AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin())))
  WITH CHECK ((SELECT public.is_instructor_or_admin()) AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin())));

CREATE POLICY "schedules: instructor delete"
  ON public.schedules FOR DELETE
  USING ((SELECT public.is_instructor_or_admin()) AND (created_by = (SELECT auth.uid()) OR (SELECT public.is_admin())));

-- ── schedule_topics ────────────────────────────────────────────────────────
-- Fix: old policy used cohort_courses join (pre-refactor). Now uses cohort_ids.
DROP POLICY IF EXISTS "schedule_topics: select"            ON public.schedule_topics;
DROP POLICY IF EXISTS "schedule_topics: instructor manage" ON public.schedule_topics;

CREATE POLICY "schedule_topics: select"
  ON public.schedule_topics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = schedule_id
        AND (
          s.created_by = (SELECT auth.uid())
          OR (SELECT public.is_admin())
          OR EXISTS (
            SELECT 1 FROM public.students st
            WHERE st.id = (SELECT auth.uid()) AND st.cohort_id = ANY(s.cohort_ids)
          )
        )
    )
  );

CREATE POLICY "schedule_topics: instructor manage"
  ON public.schedule_topics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = schedule_id
        AND (s.created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = schedule_id
        AND (s.created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
    )
  );

-- ── schedule_resources ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "schedule_resources: select"            ON public.schedule_resources;
DROP POLICY IF EXISTS "schedule_resources: instructor manage" ON public.schedule_resources;

CREATE POLICY "schedule_resources: select"
  ON public.schedule_resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = schedule_id
        AND (
          s.created_by = (SELECT auth.uid())
          OR (SELECT public.is_admin())
          OR EXISTS (
            SELECT 1 FROM public.students st
            WHERE st.id = (SELECT auth.uid()) AND st.cohort_id = ANY(s.cohort_ids)
          )
        )
    )
  );

CREATE POLICY "schedule_resources: instructor manage"
  ON public.schedule_resources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = schedule_id
        AND (s.created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.id = schedule_id
        AND (s.created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))
    )
  );
