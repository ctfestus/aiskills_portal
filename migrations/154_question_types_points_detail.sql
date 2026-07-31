-- 154: widen the courses.question_types projection with the slide-kind flags and share bonus.
--
-- save-progress accepts the running points total from the browser, because only the client knows the
-- live streak/time state mid-course. It now clamps that number to what the course could possibly
-- award (lib/course-schema maxCoursePoints), so an inflated `points` cannot reach student_xp through
-- the recalc_student_xp trigger and sit on the leaderboard.
--
-- Computing that ceiling needs to know which slides are scorable and what each share slide is worth.
-- Migration 136 added this projection precisely so save-progress never loads the whole questions
-- JSONB, so the flags are added here rather than reverting to selecting `questions`. The payload
-- grows by four booleans and a number per slide.
--
-- Values are passed through as raw jsonb (no ::boolean / ::numeric casts): this function is called on
-- every progress save, and a cast failure on one hand-edited or imported course would break saves for
-- that course entirely. lib/course-schema coerces instead.
--
-- Backward compatible: `id` and `type` keep their shape and meaning for questionTypeMap(). Against a
-- database still on 136 the new keys are absent, slidesCarryPointsDetail() returns false, and
-- save-progress skips the clamp rather than risk clamping legitimate points.

CREATE OR REPLACE FUNCTION public.question_types(c public.courses)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'id',                  q->>'id',
      'type',                COALESCE(q->>'type', 'multiple_choice'),
      'lessonOnly',          COALESCE(q->'lessonOnly',      'false'::jsonb),
      'isSection',           COALESCE(q->'isSection',       'false'::jsonb),
      'isDownloads',         COALESCE(q->'isDownloads',     'false'::jsonb),
      'isLinkedInShare',     COALESCE(q->'isLinkedInShare', 'false'::jsonb),
      'linkedInSharePoints', COALESCE(q->'linkedInSharePoints', 'null'::jsonb)
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
