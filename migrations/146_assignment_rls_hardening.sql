-- 146: close three gaps in assignment / submission row-level security.
--
--   (1) Students could SELECT unpublished assignments they were merely assigned to (cohort or group
--       match, any status). A draft assignment's config carries the not-yet-published brief and task
--       setup. Student visibility is now gated to status='published'; the owner and instructors/admins
--       still see every status so they can author and review.
--
--   (2) Students could INSERT a submission against a non-published assignment (the INSERT policy
--       checked cohort/group membership but not status). Both branches now require the assignment to
--       be published.
--
--   (3) A submission's identity columns (assignment_id, student_id, group_id) were mutable: a student
--       could UPDATE their own draft and repoint it at a different assignment or group. They are now
--       immutable on UPDATE for any authenticated caller; service-role endpoints (auth.uid() null),
--       which only ever re-save the same ids, are exempt.

-- (1) Assignment SELECT: students see only published.
DROP POLICY IF EXISTS "assignments: select" ON public.assignments;
CREATE POLICY "assignments: select"
  ON public.assignments FOR SELECT
  USING (
    (SELECT public.is_instructor_or_admin())
    OR created_by = (SELECT auth.uid())
    OR (
      status = 'published'
      AND (
        EXISTS (
          SELECT 1 FROM public.students s
          WHERE s.id = (SELECT auth.uid()) AND s.cohort_id = ANY(cohort_ids)
        )
        OR (group_ids && public.my_group_ids())
      )
    )
  );

-- (2) Submission INSERT: only against a published assignment.
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
          AND a.status = 'published'
          AND s.cohort_id = ANY(a.cohort_ids)
          AND assignment_submissions.group_id IS NULL
      )
      OR
      EXISTS (
        SELECT 1 FROM public.group_members gm
        JOIN public.assignments a ON a.id = assignment_submissions.assignment_id
        WHERE gm.student_id = (SELECT auth.uid())
          AND a.status = 'published'
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

-- (3) Immutable identity columns + the existing graded-field protection (migrations 142/143).
CREATE OR REPLACE FUNCTION public.protect_submission_graded_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Identity columns never change after insert. Service-role endpoints (auth.uid() null) are exempt;
  -- they only re-save the same ids. This stops a client repointing a submission at another
  -- assignment, student, or group.
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL THEN
    IF NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
       OR NEW.student_id  IS DISTINCT FROM OLD.student_id
       OR NEW.group_id    IS DISTINCT FROM OLD.group_id THEN
      RAISE EXCEPTION 'assignment_id, student_id and group_id cannot be changed';
    END IF;
  END IF;

  IF (SELECT role FROM public.students WHERE id = auth.uid()) = 'student' THEN
    IF NEW.status = 'graded'
       OR NEW.graded_by IS NOT NULL
       OR NEW.graded_at IS NOT NULL
       OR NEW.score IS NOT NULL
       OR NEW.feedback IS NOT NULL
       OR (TG_OP = 'INSERT' AND NEW.task_grades IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.task_grades IS DISTINCT FROM OLD.task_grades) THEN
      RAISE EXCEPTION 'Students cannot set graded fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
