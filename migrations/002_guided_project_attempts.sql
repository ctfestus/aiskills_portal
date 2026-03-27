-- Guided Project Attempts
-- Tracks each student's progress through a guided project.
-- One row per (student_email, form_id) pair — upserted on every save.

CREATE TABLE IF NOT EXISTS public.guided_project_attempts (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email     text        NOT NULL,
  student_name      text,
  form_id           uuid        NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  started_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  -- progress shape: { [requirementId]: { completed: boolean, notes?: string } }
  progress          jsonb       NOT NULL DEFAULT '{}',
  current_module_id text,
  current_lesson_id text,
  -- review shape: { score: number, feedback: string, reviewed_at: string, reviewed_by: string }
  review            jsonb,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- One attempt row per student per project
CREATE UNIQUE INDEX IF NOT EXISTS guided_project_attempts_uniq
  ON public.guided_project_attempts(student_email, form_id);

-- Fast lookup by form (for dashboard reporting)
CREATE INDEX IF NOT EXISTS guided_project_attempts_form_id_idx
  ON public.guided_project_attempts(form_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_guided_project_attempts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guided_project_attempts_updated_at ON public.guided_project_attempts;
CREATE TRIGGER trg_guided_project_attempts_updated_at
  BEFORE UPDATE ON public.guided_project_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_guided_project_attempts_updated_at();

-- RLS
ALTER TABLE public.guided_project_attempts ENABLE ROW LEVEL SECURITY;

-- Students can read/write their own rows
CREATE POLICY "student_own" ON public.guided_project_attempts
  FOR ALL USING (student_email = auth.jwt()->>'email');

-- Service role bypasses RLS (used by API routes)
