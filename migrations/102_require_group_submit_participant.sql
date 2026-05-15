-- Tighten group submissions: final submitted group work must name at least one
-- participant. The submitting leader does not have to be included because they
-- may submit administratively for members who participated.
-- Drafts may keep an empty participant list while work is still being prepared.

BEGIN;

DROP POLICY IF EXISTS "assignment_submissions: student insert" ON public.assignment_submissions;
CREATE POLICY "assignment_submissions: student insert"
  ON public.assignment_submissions FOR INSERT
  WITH CHECK (
    student_id = (SELECT auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.assignments a
        JOIN public.students s ON s.id = (SELECT auth.uid())
        WHERE a.id = assignment_submissions.assignment_id
          AND s.cohort_id = ANY(a.cohort_ids)
          AND assignment_submissions.group_id IS NULL
      )
      OR
      EXISTS (
        SELECT 1 FROM public.group_members gm
        JOIN public.assignments a ON a.id = assignment_submissions.assignment_id
        WHERE gm.student_id = (SELECT auth.uid())
          AND gm.group_id = assignment_submissions.group_id
          AND gm.group_id = ANY(a.group_ids)
          AND gm.is_leader = true
          AND public.valid_group_participants(
            assignment_submissions.group_id,
            assignment_submissions.participants
          )
          AND (
            assignment_submissions.status = 'draft'
            OR cardinality(assignment_submissions.participants) > 0
          )
      )
    )
  );

DROP POLICY IF EXISTS "assignment_submissions: student update" ON public.assignment_submissions;
CREATE POLICY "assignment_submissions: student update"
  ON public.assignment_submissions FOR UPDATE
  USING (
    status IN ('draft','submitted')
    AND (
      (group_id IS NULL AND student_id = (SELECT auth.uid()))
      OR
      EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = assignment_submissions.group_id
          AND student_id = (SELECT auth.uid())
          AND is_leader = true
      )
    )
  )
  WITH CHECK (
    status IN ('draft','submitted')
    AND (
      (group_id IS NULL AND student_id = (SELECT auth.uid()))
      OR
      EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = assignment_submissions.group_id
          AND student_id = (SELECT auth.uid())
          AND is_leader = true
          AND public.valid_group_participants(
            assignment_submissions.group_id,
            assignment_submissions.participants
          )
          AND (
            assignment_submissions.status = 'draft'
            OR cardinality(assignment_submissions.participants) > 0
          )
      )
    )
  );

COMMIT;
