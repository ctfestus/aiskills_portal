-- Migration 108: Add source_url to data_center_datasets

ALTER TABLE public.data_center_datasets
  ADD COLUMN IF NOT EXISTS source_url text;
