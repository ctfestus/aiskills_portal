-- Migration 046: Grant course/VE access via learning path cohort assignment
--
-- Problem: When a learning path is assigned to a cohort (learning_paths.cohort_ids),
-- students in that cohort can see the path but cannot open the individual courses/VEs
-- inside it, because those items only check their own cohort_ids array.
--
-- Fix: Extend the SELECT policies for courses and virtual_experiences to also grant
-- access when the item is inside a published learning path that is assigned to the
-- student's cohort. No data copying needed — access is derived at query time.

-- ── courses ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "courses: participants select" ON public.courses;

CREATE POLICY "courses: participants select"
  ON public.courses FOR SELECT
  USING (
    -- Instructor who owns the course
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    -- Course is directly assigned to the student's cohort
    OR (SELECT cohort_id FROM public.students WHERE id = (SELECT auth.uid())) = ANY(cohort_ids)
    -- Course is inside a published learning path assigned to the student's cohort
    OR EXISTS (
      SELECT 1 FROM public.learning_paths lp
      WHERE lp.status = 'published'
        AND courses.id = ANY(lp.item_ids)
        AND (SELECT cohort_id FROM public.students WHERE id = (SELECT auth.uid())) = ANY(lp.cohort_ids)
    )
  );

-- ── virtual_experiences ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "virtual_experiences: participants select" ON public.virtual_experiences;

CREATE POLICY "virtual_experiences: participants select"
  ON public.virtual_experiences FOR SELECT
  USING (
    -- Instructor who owns the VE
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    -- VE is directly assigned to the student's cohort
    OR (SELECT cohort_id FROM public.students WHERE id = (SELECT auth.uid())) = ANY(cohort_ids)
    -- VE is inside a published learning path assigned to the student's cohort
    OR EXISTS (
      SELECT 1 FROM public.learning_paths lp
      WHERE lp.status = 'published'
        AND virtual_experiences.id = ANY(lp.item_ids)
        AND (SELECT cohort_id FROM public.students WHERE id = (SELECT auth.uid())) = ANY(lp.cohort_ids)
    )
  );

-- ── indexes to keep the new subqueries fast ───────────────────────────────────
-- GIN index on item_ids array for fast ANY() lookups
CREATE INDEX IF NOT EXISTS idx_lp_item_ids    ON public.learning_paths USING GIN(item_ids);
-- GIN index on cohort_ids array for fast ANY() lookups
CREATE INDEX IF NOT EXISTS idx_lp_cohort_ids  ON public.learning_paths USING GIN(cohort_ids);
-- Partial index: only published paths matter for access checks
CREATE INDEX IF NOT EXISTS idx_lp_published   ON public.learning_paths(status) WHERE status = 'published';
