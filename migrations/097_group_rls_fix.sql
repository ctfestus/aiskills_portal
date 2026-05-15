-- Fix group-targeted content visibility for students.
-- Problem: the assignments SELECT policy subquery on group_members is blocked by
-- group_members' own RLS; and virtual_experiences SELECT policy has no group_ids
-- check at all.
-- Solution: SECURITY DEFINER helper function (bypasses RLS) used in both policies.

BEGIN;

-- Helper: returns the group IDs the current user belongs to (bypasses group_members RLS)
CREATE OR REPLACE FUNCTION public.my_group_ids()
RETURNS uuid[]
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT ARRAY(SELECT group_id FROM public.group_members WHERE student_id = (SELECT auth.uid()))
$$;

REVOKE EXECUTE ON FUNCTION public.my_group_ids() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.my_group_ids() TO authenticated;

-- Fix assignments SELECT: use helper instead of direct group_members subquery
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
    OR (group_ids && public.my_group_ids())
  );

-- Fix virtual_experiences SELECT: add group_ids check alongside existing cohort check
DROP POLICY IF EXISTS "virtual_experiences: participants select" ON public.virtual_experiences;
CREATE POLICY "virtual_experiences: participants select"
  ON public.virtual_experiences FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
    OR (SELECT cohort_id FROM public.students WHERE id = (SELECT auth.uid())) = ANY(cohort_ids)
    OR (group_ids && public.my_group_ids())
    OR EXISTS (
      SELECT 1 FROM public.learning_paths lp
      WHERE lp.status = 'published'
        AND virtual_experiences.id = ANY(lp.item_ids)
        AND (SELECT cohort_id FROM public.students WHERE id = (SELECT auth.uid())) = ANY(lp.cohort_ids)
    )
  );

COMMIT;
