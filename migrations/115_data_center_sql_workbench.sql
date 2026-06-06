-- Migration 115: Add SQL Workbench toggle to Data Center datasets
--
-- Lets admins/instructors decide which published datasets expose the
-- browser-only SQL Workbench in the Data Playground.

ALTER TABLE public.data_center_datasets
  ADD COLUMN IF NOT EXISTS sql_workbench_enabled boolean NOT NULL DEFAULT true;
