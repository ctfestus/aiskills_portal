-- 133: separate practice-only question bank for a certification.
--
-- Instructors author practice questions that are DISTINCT from the real exam. Practice mode uses
-- these (never the graded exam bank), so it can safely reveal per-question feedback + explanations
-- without leaking the real exam. Same CourseQuestion shape as `questions`.

ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS practice_questions jsonb NOT NULL DEFAULT '[]';
