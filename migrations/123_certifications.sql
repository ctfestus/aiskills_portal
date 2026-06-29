-- ─────────────────────────────────────────────────────────────
--  Certifications: a first-class, timed, protected exam content type.
--  Modeled on the courses/virtual_experiences content-type pattern: its own table,
--  its own attempts table, and a polymorphic link on certificates.
--  Idempotent: safe to re-run after a partial apply.
-- ─────────────────────────────────────────────────────────────

-- ── certifications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.certifications (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text        NOT NULL DEFAULT 'Untitled',
  description     text,
  slug            text        NOT NULL UNIQUE,
  status          text        NOT NULL DEFAULT 'published'
                                CHECK (status IN ('draft','published','archived')),
  cohort_ids      uuid[]      NOT NULL DEFAULT '{}',
  cover_image     text,
  badge_image_url text,
  questions       jsonb       NOT NULL DEFAULT '[]',
  passmark        integer     NOT NULL DEFAULT 70 CHECK (passmark BETWEEN 0 AND 100),
  time_limit      integer     CHECK (time_limit IS NULL OR time_limit > 0), -- minutes; null = untimed
  max_attempts    integer     NOT NULL DEFAULT 1 CHECK (max_attempts >= 0), -- 0 = unlimited
  exam_protection boolean     NOT NULL DEFAULT true,
  deadline_days   integer,
  learn_outcomes  text[]      DEFAULT '{}',
  theme           text,
  mode            text        CHECK (mode IN ('light','dark')),
  font            text,
  custom_accent   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_certifications_updated_at ON public.certifications;
CREATE TRIGGER trg_certifications_updated_at
  BEFORE UPDATE ON public.certifications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── certification_attempts ────────────────────────────────────
-- One row per attempt (mirrors course_attempts). proctor stores Standard-protection
-- counters (tab-switch / blur / fullscreen-exit). No XP trigger: exams are not gamified.
CREATE TABLE IF NOT EXISTS public.certification_attempts (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id             uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  certification_id       uuid        NOT NULL REFERENCES public.certifications(id) ON DELETE CASCADE,
  attempt_number         integer     NOT NULL DEFAULT 1,
  started_at             timestamptz NOT NULL DEFAULT now(),
  completed_at           timestamptz,
  passed                 boolean,
  score                  integer     NOT NULL DEFAULT 0,
  current_question_index integer     NOT NULL DEFAULT 0,
  answers                jsonb       NOT NULL DEFAULT '{}',
  proctor                jsonb       NOT NULL DEFAULT '{}',
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cert_attempts_student      ON public.certification_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_cert_attempts_cert         ON public.certification_attempts(certification_id);
CREATE INDEX IF NOT EXISTS idx_cert_attempts_student_cert ON public.certification_attempts(student_id, certification_id);
-- At most one active (in-progress) attempt per student ACROSS ALL certifications -- enforces the
-- "one certification in progress at a time" rule atomically (the check in start-attempt is not, on
-- its own, race-safe). Subsumes per-certification uniqueness.
DROP INDEX IF EXISTS public.idx_cert_attempts_one_active_per_student;
CREATE UNIQUE INDEX idx_cert_attempts_one_active_per_student
  ON public.certification_attempts (student_id)
  WHERE completed_at IS NULL;

-- ── certificates: add certification_id ────────────────────────
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS certification_id uuid; -- no FK: cert must outlive its content

ALTER TABLE public.certificates DROP CONSTRAINT IF EXISTS check_cert_has_content;
ALTER TABLE public.certificates ADD CONSTRAINT check_cert_has_content
  CHECK (course_id IS NOT NULL OR ve_id IS NOT NULL OR learning_path_id IS NOT NULL OR certification_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS certificates_unique_active_student_certification
  ON public.certificates (certification_id, student_id)
  WHERE revoked = false AND certification_id IS NOT NULL;

-- ── cohort_assignments: allow 'certification' content_type ────
ALTER TABLE public.cohort_assignments DROP CONSTRAINT IF EXISTS cohort_assignments_content_type_check;
ALTER TABLE public.cohort_assignments ADD CONSTRAINT cohort_assignments_content_type_check
  CHECK (content_type IN ('course','event','virtual_experience','form','certification'));

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.certifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_attempts ENABLE ROW LEVEL SECURITY;

-- IMPORTANT: students do NOT get direct SELECT on certifications -- the `questions` column holds
-- answer keys (correctAnswer / sqlSolution / pythonExpectedOutput / rubrics). Student-facing reads
-- (catalog metadata + answer-stripped exam questions) go through the service-role API
-- (app/api/certification-attempt). Only the owner / admin / staff (published) may read the base row.
DROP POLICY IF EXISTS "certifications: participants select" ON public.certifications;
DROP POLICY IF EXISTS "certifications: owner admin select" ON public.certifications;
CREATE POLICY "certifications: owner admin select"
  ON public.certifications FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "certifications: instructor insert" ON public.certifications;
CREATE POLICY "certifications: instructor insert"
  ON public.certifications FOR INSERT
  WITH CHECK (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

DROP POLICY IF EXISTS "certifications: instructor update" ON public.certifications;
CREATE POLICY "certifications: instructor update"
  ON public.certifications FOR UPDATE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  )
  WITH CHECK (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

DROP POLICY IF EXISTS "certifications: instructor delete" ON public.certifications;
CREATE POLICY "certifications: instructor delete"
  ON public.certifications FOR DELETE
  USING (
    (SELECT public.is_instructor_or_admin())
    AND (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  );

DROP POLICY IF EXISTS "certifications: staff published select" ON public.certifications;
CREATE POLICY "certifications: staff published select"
  ON public.certifications FOR SELECT
  USING ((SELECT public.is_staff()) AND status = 'published');

-- certification_attempts: students may READ their own rows only. There are deliberately NO student
-- INSERT/UPDATE policies -- all attempt writes (start/save/score) go through the service-role API
-- (app/api/certification-attempt), which bypasses RLS. This prevents a student from directly setting
-- passed/score/completed_at/answers via the Supabase client (the exam-tamper hole).
DROP POLICY IF EXISTS "certification_attempts: student insert" ON public.certification_attempts;
DROP POLICY IF EXISTS "certification_attempts: student update" ON public.certification_attempts;

-- Attempts hold student answers + proctor data. Read is scoped to the certification's OWNER (and
-- admin) -- not every instructor -- to match the API access model. Staff have no attempt read.
DROP POLICY IF EXISTS "certification_attempts: instructor read" ON public.certification_attempts;
DROP POLICY IF EXISTS "certification_attempts: staff select" ON public.certification_attempts;
DROP POLICY IF EXISTS "certification_attempts: owner read" ON public.certification_attempts;
CREATE POLICY "certification_attempts: owner read"
  ON public.certification_attempts FOR SELECT
  USING (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1 FROM public.certifications c
      WHERE c.id = certification_attempts.certification_id AND c.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "certification_attempts: student read" ON public.certification_attempts;
CREATE POLICY "certification_attempts: student read"
  ON public.certification_attempts FOR SELECT
  USING (student_id = (SELECT auth.uid()));
