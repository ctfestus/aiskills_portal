-- 142: server-only answer keys for scenario-based (standard) assignments.
--
-- MCQ correct answers must never reach the student browser. They previously lived inside
-- assignments.config, which students can SELECT directly -- exposing every answer before
-- submitting. Move them to a table students cannot read: the create/edit flow (owning
-- instructor) reads/writes via RLS, and the scenario submit endpoint reads them with the
-- service role to grade MCQ authoritatively server-side.

CREATE TABLE IF NOT EXISTS public.assignment_answer_keys (
  assignment_id uuid        PRIMARY KEY REFERENCES public.assignments(id) ON DELETE CASCADE,
  keys          jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- { "<taskId>": "<correct option text>" }
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assignment_answer_keys ENABLE ROW LEVEL SECURITY;

-- Only the owning instructor (or an admin) can read/write. Students get NO policy, so RLS
-- denies them all access. The submit endpoint uses the service role, which bypasses RLS.
CREATE POLICY "assignment_answer_keys: instructor manage"
  ON public.assignment_answer_keys FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND (a.created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND (a.created_by = (SELECT auth.uid()) OR (SELECT public.is_admin()))));

CREATE TRIGGER trg_assignment_answer_keys_updated_at
  BEFORE UPDATE ON public.assignment_answer_keys FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Harden the graded-fields guard so a student can never write score, feedback, status='graded',
-- or grading metadata -- on INSERT *or* UPDATE. Previously only UPDATE was guarded and INSERT
-- allowed an arbitrary score/status, so a direct insert could self-grade. score/feedback are
-- grader-only; the AI-review auto-submit is updated to stop writing a client score, and the
-- server scenario endpoint runs as the service role (auth.uid() null) so this check skips it.
CREATE OR REPLACE FUNCTION public.protect_submission_graded_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT role FROM public.students WHERE id = auth.uid()) = 'student' THEN
    IF NEW.status = 'graded'
       OR NEW.graded_by IS NOT NULL
       OR NEW.graded_at IS NOT NULL
       OR NEW.score IS NOT NULL
       OR NEW.feedback IS NOT NULL THEN
      RAISE EXCEPTION 'Students cannot set graded fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_submission_graded_fields ON public.assignment_submissions;
CREATE TRIGGER trg_protect_submission_graded_fields
  BEFORE INSERT OR UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.protect_submission_graded_fields();
