-- Migration 041: Allow instructors to reassign students between cohorts
-- The students table had no UPDATE policy for instructors, only for admins and
-- students updating their own record. This caused cohort reassignment to silently
-- fail (RLS blocked the write), reverting to the old cohort on refresh.

CREATE POLICY "students: instructor assign cohort" ON public.students FOR UPDATE
  USING (
    (select public.is_instructor_or_admin())
  )
  WITH CHECK (
    (select public.is_instructor_or_admin())
    AND (
      cohort_id IS NULL
      OR (select public.is_admin())
      OR EXISTS (
        SELECT 1 FROM public.cohorts c
        WHERE c.id = cohort_id AND c.created_by = (select auth.uid())
      )
    )
  );
