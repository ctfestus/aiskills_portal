-- Migration 065: prevent students from self-promoting their role via REST API.
-- Mirrors the existing trg_prevent_student_status_change pattern.
-- Addresses CWE-269 / CWE-862 identified in security review.

CREATE OR REPLACE FUNCTION public.prevent_student_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role <> OLD.role AND (SELECT auth.uid()) = OLD.id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.students
      WHERE id = (SELECT auth.uid()) AND role IN ('admin','instructor')
    ) THEN
      RAISE EXCEPTION 'permission denied: students may not change their own role'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prevent_student_role_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_prevent_student_role_change ON public.students;
CREATE TRIGGER trg_prevent_student_role_change
  BEFORE UPDATE OF role ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.prevent_student_role_change();
