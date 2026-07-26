-- 150: validate config.passingScore in SQL exactly like passMarkOf() does in TypeScript.
--
-- Migration 149 read config->>'passingScore' with a plain COALESCE-to-85. That diverged from the app:
--   * passingScore 0 or 101 -> the app clamps to 85, but the raw SQL used 0 / 101 (could release a
--     solution at 0, or demand an impossible 101).
--   * a non-numeric value ("invalid") -> the ::numeric cast throws and breaks the policy evaluation.
-- assignment_pass_mark() reproduces passMarkOf(): a JSON number in [1,100] is used as-is, and anything
-- else (absent, out of range, wrong type, null config) safely falls back to 85. The nested CASE means
-- the ::numeric cast only runs once the value is known to be a JSON number, so it can never throw.

CREATE OR REPLACE FUNCTION public.assignment_pass_mark(config jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN jsonb_typeof(config->'passingScore') = 'number' THEN
      CASE WHEN (config->>'passingScore')::numeric BETWEEN 1 AND 100
           THEN (config->>'passingScore')::numeric
           ELSE 85 END
    ELSE 85
  END;
$$;

DROP POLICY IF EXISTS "assignment_solutions: released select" ON public.assignment_solutions;
CREATE POLICY "assignment_solutions: released select"
  ON public.assignment_solutions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.assignment_submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    WHERE s.assignment_id = assignment_solutions.assignment_id
      AND s.status = 'graded'
      AND s.score IS NOT NULL
      AND s.score >= public.assignment_pass_mark(a.config)
      AND (
        s.student_id = (SELECT auth.uid())
        OR (
          s.group_id IS NOT NULL
          AND s.group_id = ANY(public.my_group_ids())
          AND (SELECT auth.uid()) = ANY(s.participants)
        )
      )
  ));
