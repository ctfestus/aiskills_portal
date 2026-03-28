-- Security fix: Grade Tampering via Missing Field-Level Security
-- A student could intercept their own submission update and inject
-- score, feedback, graded_by, or graded_at values directly.
-- Fix: add IS NOT DISTINCT FROM sub-selects in WITH CHECK so the
-- policy rejects any write that would change instructor-only fields.

DROP POLICY IF EXISTS "assignment_submissions: student update" ON public.assignment_submissions;

CREATE POLICY "assignment_submissions: student update"
  ON public.assignment_submissions FOR UPDATE
  USING  (student_id = auth.uid() AND status IN ('draft', 'submitted'))
  WITH CHECK (
    student_id = auth.uid()
    AND status IN ('draft', 'submitted')
    AND score      IS NOT DISTINCT FROM (SELECT score      FROM public.assignment_submissions s WHERE s.id = assignment_submissions.id)
    AND feedback   IS NOT DISTINCT FROM (SELECT feedback   FROM public.assignment_submissions s WHERE s.id = assignment_submissions.id)
    AND graded_by  IS NOT DISTINCT FROM (SELECT graded_by  FROM public.assignment_submissions s WHERE s.id = assignment_submissions.id)
    AND graded_at  IS NOT DISTINCT FROM (SELECT graded_at  FROM public.assignment_submissions s WHERE s.id = assignment_submissions.id)
  );
