-- ── 111_course_lesson_timing ────────────────────────────────────────────────
-- Add lesson_timing, show_answers, and max_attempts to courses table.
-- These settings were stored only in the editor state and never persisted.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS lesson_timing  text    CHECK (lesson_timing IN ('before', 'after')),
  ADD COLUMN IF NOT EXISTS show_answers   text    NOT NULL DEFAULT 'per_question'
                                                  CHECK (show_answers IN ('per_question', 'after_quiz', 'none')),
  ADD COLUMN IF NOT EXISTS max_attempts   integer CHECK (max_attempts IS NULL OR max_attempts > 0);
