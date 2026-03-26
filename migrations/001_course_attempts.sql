-- ─── course_attempts ─────────────────────────────────────────────────────────
-- One row per attempt. Never overwritten — each retake creates a new row.
CREATE TABLE IF NOT EXISTS public.course_attempts (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email          text        NOT NULL,
  form_id                uuid        NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  attempt_number         int         NOT NULL DEFAULT 1,
  started_at             timestamptz NOT NULL DEFAULT now(),
  completed_at           timestamptz,          -- NULL = in progress
  passed                 boolean,              -- NULL = in progress
  score                  int         NOT NULL DEFAULT 0,   -- % when completed
  points                 int         NOT NULL DEFAULT 0,   -- XP earned this attempt
  current_question_index int         NOT NULL DEFAULT 0,
  answers                jsonb       NOT NULL DEFAULT '{}',
  streak                 int         NOT NULL DEFAULT 0,
  hints_used             text[]      NOT NULL DEFAULT '{}',
  student_name           text,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ca_student        ON public.course_attempts(student_email);
CREATE INDEX IF NOT EXISTS idx_ca_form           ON public.course_attempts(form_id);
CREATE INDEX IF NOT EXISTS idx_ca_active         ON public.course_attempts(student_email, form_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_ca_student_form   ON public.course_attempts(student_email, form_id);

-- ─── student_xp ──────────────────────────────────────────────────────────────
-- Aggregate XP per student. Kept up-to-date by trigger below.
CREATE TABLE IF NOT EXISTS public.student_xp (
  student_email text        PRIMARY KEY,
  total_xp      int         NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── XP recalculation trigger ─────────────────────────────────────────────────
-- Rules:
--   • If student has a passing attempt for a course → use MAX(points) from passing attempts
--     (XP never decreases after you pass, even if you retake)
--   • If no passing attempt → use latest attempt's points
--     (XP resets when a new attempt starts after failing)
CREATE OR REPLACE FUNCTION public.recalc_student_xp()
RETURNS TRIGGER AS $$
DECLARE
  v_email text;
BEGIN
  v_email := COALESCE(NEW.student_email, OLD.student_email);

  INSERT INTO public.student_xp (student_email, total_xp, updated_at)
  SELECT
    v_email,
    COALESCE((
      SELECT SUM(course_xp) FROM (
        SELECT
          form_id,
          CASE
            WHEN MAX(CASE WHEN passed = true THEN 1 ELSE 0 END) = 1
              THEN MAX(CASE WHEN passed = true THEN points ELSE 0 END)
            ELSE (
              SELECT points FROM public.course_attempts ca2
              WHERE  ca2.student_email = v_email AND ca2.form_id = ca.form_id
              ORDER  BY started_at DESC LIMIT 1
            )
          END AS course_xp
        FROM   public.course_attempts ca
        WHERE  student_email = v_email
        GROUP  BY form_id
      ) sub
    ), 0),
    now()
  ON CONFLICT (student_email) DO UPDATE
    SET total_xp   = EXCLUDED.total_xp,
        updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_recalc_student_xp
AFTER INSERT OR UPDATE OR DELETE ON public.course_attempts
FOR EACH ROW EXECUTE FUNCTION public.recalc_student_xp();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.course_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_xp      ENABLE ROW LEVEL SECURITY;

-- Students can read their own attempts
CREATE POLICY "students_read_own_attempts"
  ON public.course_attempts FOR SELECT
  USING (student_email = auth.jwt() ->> 'email');

-- Students can read their own XP
CREATE POLICY "students_read_own_xp"
  ON public.student_xp FOR SELECT
  USING (student_email = auth.jwt() ->> 'email');
