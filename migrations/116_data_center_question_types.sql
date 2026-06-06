-- Migration 116: Add question type tags to Data Center datasets
--
-- Keeps existing sample_questions while allowing each question to be
-- marked as SQL-ready or broader analytics.

ALTER TABLE public.data_center_datasets
  ADD COLUMN IF NOT EXISTS sample_question_types text[] NOT NULL DEFAULT '{}';
