-- Allows admins to manually restore a student's access even if they have an
-- outstanding balance. Auto-sync on Refresh skips students with this flag set.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS payment_exempt boolean NOT NULL DEFAULT false;

-- Extend the existing cohort-protection trigger to also block students from
-- toggling their own payment_exempt flag via the Supabase REST API.
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

  -- Admins and instructors may change these columns freely.
  IF OLD.role IN ('admin', 'instructor') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'permission denied: students may not change their own cohort or payment exemption'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

-- Extend the trigger to fire on payment_exempt changes as well
DROP TRIGGER IF EXISTS trg_prevent_student_cohort_change ON public.students;

CREATE TRIGGER trg_prevent_student_cohort_change
  BEFORE UPDATE OF cohort_id, original_cohort_id, payment_exempt ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_student_cohort_change();
