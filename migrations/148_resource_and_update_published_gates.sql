-- 148: two more "must be published" gates that migration 146 did not cover.
--
--   (1) assignment_resources SELECT let a cohort student read the resources of a DRAFT assignment if
--       they knew its id. Student visibility is now gated to a published assignment (the owner and
--       admins still see resources of drafts they are authoring).
--
--   (2) assignment_submissions student UPDATE did not recheck the assignment status, so a legacy
--       submission could still be edited after its assignment was unpublished. The update now
--       requires the assignment to be published (the grader UPDATE policy is separate and unchanged).

-- (1) Resources: students see only published-assignment resources.
DROP POLICY IF EXISTS "assignment_resources: select" ON public.assignment_resources;
CREATE POLICY "assignment_resources: select"
  ON public.assignment_resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id AND (
        a.created_by = (SELECT auth.uid()) OR (SELECT public.is_admin())
        OR (
          a.status = 'published'
          AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = (SELECT auth.uid()) AND s.cohort_id = ANY(a.cohort_ids)
          )
        )
      )
    )
  );

-- (2) Student submission UPDATE: only while the assignment is published.
DROP POLICY IF EXISTS "assignment_submissions: student update" ON public.assignment_submissions;
CREATE POLICY "assignment_submissions: student update"
  ON public.assignment_submissions FOR UPDATE
  USING (
    status IN ('draft','submitted')
    AND EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_submissions.assignment_id AND a.status = 'published')
    AND (
      (group_id IS NULL AND student_id = (SELECT auth.uid()))
      OR EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = assignment_submissions.group_id
          AND student_id = (SELECT auth.uid())
          AND is_leader = true
      )
    )
  )
  WITH CHECK (
    status IN ('draft','submitted')
    AND EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_submissions.assignment_id AND a.status = 'published')
    AND (
      (group_id IS NULL AND student_id = (SELECT auth.uid()))
      OR EXISTS (
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
