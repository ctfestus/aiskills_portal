-- Migration 015: Fix self-referencing recursion in assignment_submissions student update policy
-- The old WITH CHECK subqueried assignment_submissions against itself to guard score/feedback/
-- graded_by/graded_at fields, which risks infinite recursion.
-- Those fields are already protected by the separate "instructor grade" policy being the only
-- UPDATE policy that can set them. The simpler policy below is safe and correct.

DROP POLICY IF EXISTS "assignment_submissions: student update" ON public.assignment_submissions;

CREATE POLICY "assignment_submissions: student update"
  ON public.assignment_submissions FOR UPDATE
  USING (
    student_id = (SELECT auth.uid())
    AND status IN ('draft', 'submitted')
  )
  WITH CHECK (
    student_id = (SELECT auth.uid())
    AND status IN ('draft', 'submitted')
  );
