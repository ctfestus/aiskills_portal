-- 136: expose a lightweight question id/type projection for course progress saves.
--
-- PostgREST exposes single-row SQL functions whose first argument is a table row
-- as computed fields. Selecting courses.question_types avoids fetching the full
-- questions JSONB blob on save-progress, while still deriving the data from the
-- current source of truth at query time.

CREATE OR REPLACE FUNCTION public.question_types(c public.courses)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'id',   q->>'id',
      'type', COALESCE(q->>'type', 'multiple_choice')
    )),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(c.questions) = 'array' THEN c.questions
      ELSE '[]'::jsonb
    END
  ) AS q
$$;

NOTIFY pgrst, 'reload schema';
