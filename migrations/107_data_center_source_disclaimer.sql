-- Migration 107: Add source, disclaimer, and table_type to data_center_datasets

ALTER TABLE public.data_center_datasets
  ADD COLUMN IF NOT EXISTS source      text,
  ADD COLUMN IF NOT EXISTS disclaimer  text,
  ADD COLUMN IF NOT EXISTS table_type  text CHECK (table_type IN ('single', 'multiple'));
-- table_type: 'single' = one table, 'multiple' = several related tables (e.g. a ZIP with many CSVs)
