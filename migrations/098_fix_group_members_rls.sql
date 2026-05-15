-- Fix group_members student SELECT policy.
-- The original policy was self-referential (subquery on the same table), which
-- can return empty results depending on how PostgreSQL resolves the recursion.
-- Replace with my_group_ids() SECURITY DEFINER function (created in 097)
-- which bypasses RLS entirely and reliably returns the student's group IDs.

BEGIN;

DROP POLICY IF EXISTS "group_members: student select own group" ON public.group_members;

CREATE POLICY "group_members: student select own group"
  ON public.group_members FOR SELECT TO authenticated
  USING (group_id = ANY(public.my_group_ids()));

COMMIT;
