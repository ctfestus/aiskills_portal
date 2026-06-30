-- ─────────────────────────────────────────────────────────────
--  Certification foundation assets (additive to migration 123):
--    - skill_areas: defined skill areas per certification ([{id,name}]); questions map to a
--      skill via CourseQuestion.skillAreaId (stored in the questions jsonb, no schema change).
--    - study guide: an uploaded PDF resource learners can view/download, with a publish flag.
--    - poster: an uploaded image, with a publish flag.
--    - practice_test_url: a link to the certification's practice test.
--  All columns are additive and idempotent (safe to re-run).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS skill_areas           jsonb   NOT NULL DEFAULT '[]';
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS study_guide_url       text;
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS study_guide_name      text;
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS study_guide_published boolean NOT NULL DEFAULT false;
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS poster_url            text;
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS poster_published      boolean NOT NULL DEFAULT false;
ALTER TABLE public.certifications ADD COLUMN IF NOT EXISTS practice_test_url     text;
