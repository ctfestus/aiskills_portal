-- Migration 067: prevent direct PostgREST writes to outcome fields on guided_project_attempts.
-- Addresses CWE-345 / CWE-863 identified in security review.
-- The existing "student_own" FOR ALL policy allows students to write any column directly.
-- This trigger blocks non-service-role callers from setting completed_at or review,
-- which are the fields that drive certificate issuance and instructor scoring.
-- Service-role callers (API routes) have auth.uid() = NULL and are always allowed.
-- progress, current_module_id, and current_lesson_id remain student-writable.

CREATE OR REPLACE FUNCTION public.prevent_guided_project_outcome_tampering()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Service-role calls bypass this check entirely
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.completed_at IS NOT NULL OR NEW.review IS NOT NULL THEN
      RAISE EXCEPTION 'permission denied: outcome fields may not be set on insert'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.completed_at IS DISTINCT FROM OLD.completed_at
       OR NEW.review IS DISTINCT FROM OLD.review THEN
      RAISE EXCEPTION 'permission denied: outcome fields may not be changed directly'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prevent_guided_project_outcome_tampering() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_prevent_guided_project_outcome_tampering ON public.guided_project_attempts;
CREATE TRIGGER trg_prevent_guided_project_outcome_tampering
  BEFORE INSERT OR UPDATE ON public.guided_project_attempts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_guided_project_outcome_tampering();
