-- 131: shared runnable-playground data for a certification.
--
-- Tables / DataFrames (and optional setup code) defined once at the certification
-- level, so every question's runnable playground can reuse them instead of the
-- author re-uploading the same dataset on each question. Shape:
--   { sqlTables: [...], pythonDatasets: [...], setupSql, setupPython }
-- No answer keys here, so it is safe to deliver to the client with the exam.

ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS playground_data jsonb NOT NULL DEFAULT '{}';
