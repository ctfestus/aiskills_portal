-- Migration 110: Persist multiple files per Data Playground dataset

ALTER TABLE public.data_center_datasets
  ADD COLUMN IF NOT EXISTS files jsonb NOT NULL DEFAULT '[]';
