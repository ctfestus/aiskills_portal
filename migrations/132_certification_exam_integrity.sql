-- 132: certification exam integrity (randomize order, shuffle options, question pooling).
--
-- Per-certification settings:
--   randomize_questions  - shuffle question order per attempt
--   shuffle_options      - shuffle answer options per attempt (text-option types)
--   question_pool_size   - draw N questions at random from the bank (null/0 = use all)
--
-- Per-attempt: question_ids stores the exact ordered set delivered to that attempt, so a resumed
-- attempt sees the same form and grading scores only the delivered questions (pooling-correct).

ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS randomize_questions boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shuffle_options     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS question_pool_size  integer CHECK (question_pool_size IS NULL OR question_pool_size > 0);

ALTER TABLE public.certification_attempts
  ADD COLUMN IF NOT EXISTS question_ids jsonb NOT NULL DEFAULT '[]';
