-- Migration 118: Add guided analyst task sections to Data Playground datasets.
-- This keeps the older sample_questions fields as a fallback while allowing
-- dataset-specific phases with SQL and analytics tasks.

ALTER TABLE public.data_center_datasets
  ADD COLUMN IF NOT EXISTS analyst_sections jsonb NOT NULL DEFAULT '[]'::jsonb;
