-- Fix assignments SELECT policy to allow students to see group-targeted assignments
-- Previously only checked cohort_ids; group-targeted assignments have cohort_ids=[] so were invisible

DROP POLICY IF EXISTS "assignments: select" ON public.assignments;

CREATE POLICY "assignments: select"
  ON public.assignments FOR SELECT
  USING (
    created_by = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = (SELECT auth.uid()) AND s.cohort_id = ANY(cohort_ids)
    )
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.student_id = (SELECT auth.uid())
        AND gm.group_id = ANY(group_ids)
    )
  );
