-- Remove group_ids check from virtual_experiences participants SELECT policy.
-- Standalone VEs are cohort-only; group targeting only applies to VE assignments.

BEGIN;

DROP POLICY IF EXISTS "virtual_experiences: participants select" ON public.virtual_experiences;

CREATE POLICY "virtual_experiences: participants select"
  ON public.virtual_experiences FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR (SELECT cohort_id FROM public.students WHERE id = (SELECT auth.uid())) = ANY(cohort_ids)
    OR EXISTS (
      SELECT 1 FROM public.learning_paths lp
      WHERE lp.status = 'published'
        AND virtual_experiences.id = ANY(lp.item_ids)
        AND (SELECT cohort_id FROM public.students WHERE id = (SELECT auth.uid())) = ANY(lp.cohort_ids)
    )
  );

COMMIT;
