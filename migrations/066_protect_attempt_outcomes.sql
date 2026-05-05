-- Migration 066: prevent direct PostgREST writes to outcome fields on course_attempts.
-- Addresses CWE-345 / CWE-863 identified in security review.
-- Service-role callers (API routes) have auth.uid() = NULL and are always allowed.
-- Authenticated students are blocked from setting passed, score, points, completed_at
-- on INSERT or UPDATE, closing the direct Supabase/PostgREST tamper path.

CREATE OR REPLACE FUNCTION public.prevent_attempt_outcome_tampering()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Service-role calls bypass this check entirely
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.passed IS NOT NULL
       OR NEW.score <> 0
       OR NEW.points <> 0
       OR NEW.completed_at IS NOT NULL THEN
      RAISE EXCEPTION 'permission denied: outcome fields may not be set on insert'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.passed IS DISTINCT FROM OLD.passed
       OR NEW.score IS DISTINCT FROM OLD.score
       OR NEW.points IS DISTINCT FROM OLD.points
       OR NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
      RAISE EXCEPTION 'permission denied: outcome fields may not be changed directly'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prevent_attempt_outcome_tampering() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_prevent_attempt_outcome_tampering ON public.course_attempts;
CREATE TRIGGER trg_prevent_attempt_outcome_tampering
  BEFORE INSERT OR UPDATE ON public.course_attempts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_attempt_outcome_tampering();
