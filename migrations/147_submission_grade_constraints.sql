-- 147: value constraints on assignment_submissions grades (defense in depth behind the app +
-- apply-grades validation, so a buggy or compromised writer still cannot store a bad grade).

-- (1) score was bounded below only (score >= 0); a write could store an out-of-range value > 100.
ALTER TABLE public.assignment_submissions
  DROP CONSTRAINT IF EXISTS assignment_submissions_score_check;
ALTER TABLE public.assignment_submissions
  ADD  CONSTRAINT assignment_submissions_score_check
  CHECK (score IS NULL OR (score >= 0 AND score <= 100));

-- (2) task_grades had no shape constraint. Require an object whose every value is an object with an
-- optional numeric score in [0,100] and an optional feedback string within the app's length cap
-- (MAX_TASK_FEEDBACK = 8000). CASE guards guarantee the numeric/length checks only run on the right
-- json type, so a malformed value fails the constraint rather than erroring the cast.
CREATE OR REPLACE FUNCTION public.valid_task_grades(tg jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT tg IS NULL OR (
    jsonb_typeof(tg) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_each(tg) AS e(k, val)
      WHERE jsonb_typeof(val) <> 'object'
        OR CASE
             WHEN jsonb_typeof(val->'score') = 'number'
               THEN (val->>'score')::numeric < 0 OR (val->>'score')::numeric > 100
             WHEN val ? 'score' AND jsonb_typeof(val->'score') <> 'null'
               THEN true
             ELSE false
           END
        OR CASE
             WHEN jsonb_typeof(val->'feedback') = 'string'
               THEN length(val->>'feedback') > 8000
             WHEN val ? 'feedback' AND jsonb_typeof(val->'feedback') <> 'null'
               THEN true
             ELSE false
           END
    )
  );
$$;

ALTER TABLE public.assignment_submissions
  DROP CONSTRAINT IF EXISTS assignment_submissions_task_grades_valid;
ALTER TABLE public.assignment_submissions
  ADD  CONSTRAINT assignment_submissions_task_grades_valid
  CHECK (public.valid_task_grades(task_grades));
