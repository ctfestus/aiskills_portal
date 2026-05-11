-- ── 089_open_certificates ───────────────────────────────────────────────────
-- Tables: programs, open_certificates
-- Purpose: Manual certificate issuance for events, programs, and live
--          experiences to external recipients (not tied to course completion).

-- Reusable program / event definitions per instructor
CREATE TABLE IF NOT EXISTS public.programs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  issued_by   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Manually issued certificates to external recipients
CREATE TABLE IF NOT EXISTS public.open_certificates (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id       uuid        REFERENCES public.programs(id) ON DELETE SET NULL,
  program_name     text        NOT NULL,
  recipient_name   text        NOT NULL,
  recipient_email  text,
  issued_date      date        NOT NULL,
  issued_by        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  revoked          boolean     NOT NULL DEFAULT false,
  revoked_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS open_certificates_program_id_idx  ON public.open_certificates (program_id);
CREATE INDEX IF NOT EXISTS open_certificates_issued_by_idx   ON public.open_certificates (issued_by);
CREATE INDEX IF NOT EXISTS programs_issued_by_idx             ON public.programs (issued_by);

-- Prevent issuing the same active credential twice to the same email for the
-- same program. Revoked credentials can be reissued.
CREATE UNIQUE INDEX IF NOT EXISTS open_certificates_unique_active_email
  ON public.open_certificates (
    issued_by,
    COALESCE(program_id::text, lower(program_name)),
    lower(recipient_email)
  )
  WHERE recipient_email IS NOT NULL AND revoked = false;

-- RLS
ALTER TABLE public.programs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_certificates  ENABLE ROW LEVEL SECURITY;

-- programs: instructors manage their own; public can read (for cert display)
DROP POLICY IF EXISTS "programs: public read" ON public.programs;
CREATE POLICY "programs: public read"
  ON public.programs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "programs: instructor insert" ON public.programs;
CREATE POLICY "programs: instructor insert"
  ON public.programs FOR INSERT
  WITH CHECK ((SELECT public.is_instructor_or_admin()) AND issued_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "programs: instructor update" ON public.programs;
CREATE POLICY "programs: instructor update"
  ON public.programs FOR UPDATE
  USING  ((SELECT public.is_instructor_or_admin()) AND issued_by = (SELECT auth.uid()))
  WITH CHECK ((SELECT public.is_instructor_or_admin()) AND issued_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "programs: instructor delete" ON public.programs;
CREATE POLICY "programs: instructor delete"
  ON public.programs FOR DELETE
  USING  ((SELECT public.is_instructor_or_admin()) AND issued_by = (SELECT auth.uid()));

-- open_certificates: instructors manage their own; public can read (for cert display)
DROP POLICY IF EXISTS "open_certificates: public read" ON public.open_certificates;
CREATE POLICY "open_certificates: public read"
  ON public.open_certificates FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "open_certificates: instructor insert" ON public.open_certificates;
CREATE POLICY "open_certificates: instructor insert"
  ON public.open_certificates FOR INSERT
  WITH CHECK ((SELECT public.is_instructor_or_admin()) AND issued_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "open_certificates: instructor update" ON public.open_certificates;
CREATE POLICY "open_certificates: instructor update"
  ON public.open_certificates FOR UPDATE
  USING  ((SELECT public.is_instructor_or_admin()) AND issued_by = (SELECT auth.uid()))
  WITH CHECK ((SELECT public.is_instructor_or_admin()) AND issued_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "open_certificates: instructor delete" ON public.open_certificates;
CREATE POLICY "open_certificates: instructor delete"
  ON public.open_certificates FOR DELETE
  USING  ((SELECT public.is_instructor_or_admin()) AND issued_by = (SELECT auth.uid()));
