-- ─────────────────────────────────────────────────────────────
--  Migration 047: Cohort email allowlist
--  Only emails on the allowlist for a cohort can register.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.cohort_allowed_emails (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id  uuid        NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  email      text        NOT NULL,
  added_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cohort_allowed_emails_email_lower CHECK (email = lower(email)),
  UNIQUE (email)
);

ALTER TABLE public.cohort_allowed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cohort_allowed_emails: instructor manage"
  ON public.cohort_allowed_emails FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.students
    WHERE id = (SELECT auth.uid()) AND role IN ('admin','instructor')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.students
    WHERE id = (SELECT auth.uid()) AND role IN ('admin','instructor')
  ));

CREATE INDEX idx_cohort_allowed_emails_cohort ON public.cohort_allowed_emails(cohort_id);
CREATE INDEX idx_cohort_allowed_emails_email  ON public.cohort_allowed_emails(email);

-- Given an email, returns the cohort_id it belongs to (or null if not allowed).
-- Service-role only — called from API routes, never from client.
CREATE OR REPLACE FUNCTION public.check_email_allowlist(p_email text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT cohort_id FROM public.cohort_allowed_emails
  WHERE email = lower(p_email)
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.check_email_allowlist(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_email_allowlist(text) TO service_role;
