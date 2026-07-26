-- 143: per-task grading for scenario-based (standard) assignments.
--
-- A scenario assignment is a set of tasks, so one overall score + one feedback blob is too
-- coarse: the instructor now scores and comments on EACH task. Those live in a jsonb map
-- keyed by task id, { "<taskId>": { "score": 0-100, "feedback": "..." } }, alongside the
-- existing submission-level score/feedback (which stays the official grade, defaulting to the
-- mean of the task scores).

ALTER TABLE public.assignment_submissions
  ADD COLUMN IF NOT EXISTS task_grades jsonb;

-- task_grades is grader-only, exactly like score/feedback: extend the guard so a student can
-- never write it. Compared against OLD on UPDATE (not just "is not null") so a student editing
-- their own draft after a reset is not blocked by a value the grader left behind.
CREATE OR REPLACE FUNCTION public.protect_submission_graded_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT role FROM public.students WHERE id = auth.uid()) = 'student' THEN
    IF NEW.status = 'graded'
       OR NEW.graded_by IS NOT NULL
       OR NEW.graded_at IS NOT NULL
       OR NEW.score IS NOT NULL
       OR NEW.feedback IS NOT NULL
       OR (TG_OP = 'INSERT' AND NEW.task_grades IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.task_grades IS DISTINCT FROM OLD.task_grades) THEN
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
