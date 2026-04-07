-- Prevent students from changing their own cohort_id or original_cohort_id.
--
-- The "students: own update" RLS policy (migration 018) allows a student to
-- update their own row, which would otherwise let them move themselves back
-- to their original cohort by calling Supabase's REST API directly with
-- their JWT. This trigger closes that gap.
--
-- Unauthorized attempts raise an exception (ERRCODE insufficient_privilege)
-- so PostgREST returns 403 — no silent no-ops, no confusing UI states.
-- Admins and instructors are allowed through via OLD.role (already in memory).
-- Service-role calls (auth.uid() IS NULL) are allowed through unconditionally.

CREATE OR REPLACE FUNCTION public.prevent_student_cohort_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service-role calls (from the server) have auth.uid() = NULL — allow through.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admins and instructors may change cohort assignments freely.
  -- OLD.role is already in memory (no extra query needed) because the student
  -- updating their own row always satisfies auth.uid() = OLD.id.
  IF OLD.role IN ('admin', 'instructor') THEN
    RETURN NEW;
  END IF;

  -- Reject the attempt explicitly so PostgREST returns 403, not a silent no-op.
  RAISE EXCEPTION 'permission denied: students may not change their own cohort'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_student_cohort_change ON public.students;

CREATE TRIGGER trg_prevent_student_cohort_change
  BEFORE UPDATE OF cohort_id, original_cohort_id ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_student_cohort_change();
