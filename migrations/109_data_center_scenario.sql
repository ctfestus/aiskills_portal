-- Migration 109: Add scenario/background rich text field to data_center_datasets

ALTER TABLE public.data_center_datasets
  ADD COLUMN IF NOT EXISTS scenario text;
