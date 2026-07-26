-- 149: release solutions against the assignment's CONFIGURED passing score, not a fixed 85.
--
-- Instructors can now set config.passingScore per assignment (default 85, resolved by passMarkOf in
-- lib/assignment-scenarios.ts). The release policy must use the same rule the resubmit / solution-file
-- / grade-notify code uses, so a solution is released exactly when the submission can no longer be
-- resubmitted. COALESCE to 85 keeps every existing assignment (no passingScore key) behaving as before.

DROP POLICY IF EXISTS "assignment_solutions: released select" ON public.assignment_solutions;
CREATE POLICY "assignment_solutions: released select"
  ON public.assignment_solutions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.assignment_submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    WHERE s.assignment_id = assignment_solutions.assignment_id
      AND s.status = 'graded'
      AND s.score IS NOT NULL
      AND s.score >= COALESCE(NULLIF(a.config->>'passingScore','')::numeric, 85)
      AND (
        s.student_id = (SELECT auth.uid())
        OR (
          s.group_id IS NOT NULL
          AND s.group_id = ANY(public.my_group_ids())
          AND (SELECT auth.uid()) = ANY(s.participants)
        )
      )
  ));
