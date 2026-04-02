-- ─── Education & Work Experience ─────────────────────────────────────────────
-- Adds two JSONB columns to students. No new tables — arrays of objects stored
-- inline with the student row. Typical size: ~500 bytes per student.
--
-- education      : [{id, school, degree, field, start_year, end_year, current}]
-- work_experience: [{id, company, title, start_year, end_year, current}]

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS education       jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS work_experience jsonb NOT NULL DEFAULT '[]'::jsonb;
