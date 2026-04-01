-- Fix infinite recursion in "students: own update" policy.
--
-- Root cause: the WITH CHECK clause contained:
--   status = (SELECT status FROM public.students WHERE id = auth.uid())
-- Querying the students table inside a policy ON students causes
-- PostgreSQL to re-evaluate the same policy → infinite recursion.
--
-- Fix: drop the recursive subquery from WITH CHECK.
-- The status column is now protected by the trigger below instead,
-- which fires BEFORE UPDATE and resets status to OLD.status if a
-- non-admin student tries to change it.

-- 1. Recreate the own-update policy without the recursive status check
DROP POLICY IF EXISTS "students: own update" ON public.students;

CREATE POLICY "students: own update"
  ON public.students
  FOR UPDATE
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id AND role = public.get_my_role());

-- 2. Protect the status column via a trigger instead of RLS subquery
CREATE OR REPLACE FUNCTION public.prevent_student_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow admins (role = 'admin') to change status freely
  IF EXISTS (
    SELECT 1 FROM public.students
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RETURN NEW;
  END IF;

  -- For everyone else, silently revert status to the old value
  NEW.status := OLD.status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_student_status_change ON public.students;

CREATE TRIGGER trg_prevent_student_status_change
  BEFORE UPDATE OF status ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_student_status_change();
