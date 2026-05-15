-- Fix assignments SELECT policy:
-- 1. Instructors were blocked from seeing assignments they didn't create
-- 2. is_admin() replaced with is_instructor_or_admin() so all staff see all assignments
-- 3. Group-members condition preserved from migration 095
-- Run in a transaction so DROP + CREATE are atomic

BEGIN;

DROP POLICY IF EXISTS "assignments: select" ON public.assignments;

CREATE POLICY "assignments: select"
  ON public.assignments FOR SELECT
  USING (
    (SELECT public.is_instructor_or_admin())
    OR created_by = (SELECT auth.uid())
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

COMMIT;
