-- 145: tighten when instructor solution files/links are released to students.
--
-- Migration 144 released a solution as soon as the student's (or their group's) submission reached
-- status='graded'. Two problems:
--
--   (1) Failing grade + resubmit. A graded submission scoring below the pass mark can be reset to
--       draft and resubmitted (see /api/assignments/resubmit, PASS_MARK = 85). Releasing the model
--       answer at 'graded' handed it to a student who could still change their answer -- they could
--       copy it into the resubmission. Release now requires a PASSING score, which is exactly the
--       state in which resubmit is refused. (85 must match PASS_MARK in the resubmit route.)
--
--   (2) Group submissions ignored participants. A group submission covers only the members listed in
--       participants[] (the leader picks who is credited). Releasing to every group member handed the
--       answer key to people the submission never graded. Group release is now limited to the
--       submitter (student_id) or a member actually in participants[].

DROP POLICY IF EXISTS "assignment_solutions: released select" ON public.assignment_solutions;
CREATE POLICY "assignment_solutions: released select"
  ON public.assignment_solutions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.assignment_submissions s
    WHERE s.assignment_id = assignment_solutions.assignment_id
      AND s.status = 'graded'
      AND s.score IS NOT NULL
      AND s.score >= 85
      AND (
        s.student_id = (SELECT auth.uid())
        OR (
          s.group_id IS NOT NULL
          AND s.group_id = ANY(public.my_group_ids())
          AND (SELECT auth.uid()) = ANY(s.participants)
        )
      )
  ));
