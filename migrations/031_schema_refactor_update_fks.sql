-- Migration 031: Schema Refactor Phase 2
-- Updates FK tables to reference the new purpose-built tables.
-- Run AFTER 030 (new tables must exist with migrated data).
-- Run BEFORE deploying updated code (Phase 3).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. course_attempts: form_id → course_id
-- ─────────────────────────────────────────────────────────────────────────────

-- Add new column
ALTER TABLE public.course_attempts
  ADD COLUMN IF NOT EXISTS course_id uuid;

-- Populate from the courses table (IDs were preserved from forms migration)
UPDATE public.course_attempts ca
SET course_id = ca.form_id
WHERE EXISTS (SELECT 1 FROM public.courses c WHERE c.id = ca.form_id);

-- Add FK constraint
ALTER TABLE public.course_attempts
  ADD CONSTRAINT course_attempts_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;

-- Make NOT NULL (all rows should be matched after the UPDATE above)
ALTER TABLE public.course_attempts
  ALTER COLUMN course_id SET NOT NULL;

-- Drop old form_id FK and column
ALTER TABLE public.course_attempts
  DROP CONSTRAINT IF EXISTS course_attempts_form_id_fkey;
ALTER TABLE public.course_attempts
  DROP COLUMN IF EXISTS form_id;

-- Recreate indexes on new column (old names from migration 016)
DROP INDEX IF EXISTS idx_ca_form;
DROP INDEX IF EXISTS idx_ca_active;
DROP INDEX IF EXISTS idx_ca_student_form;
DROP INDEX IF EXISTS idx_ca_student;

CREATE INDEX IF NOT EXISTS idx_ca_course         ON public.course_attempts(course_id);
CREATE INDEX IF NOT EXISTS idx_ca_active         ON public.course_attempts(student_id, course_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_ca_student_course ON public.course_attempts(student_id, course_id);

-- Rebuild recalc_student_xp to use course_id instead of form_id
CREATE OR REPLACE FUNCTION public.recalc_student_xp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  v_id := COALESCE(NEW.student_id, OLD.student_id);

  INSERT INTO public.student_xp (student_id, total_xp, updated_at)
  SELECT
    v_id,
    COALESCE((
      SELECT SUM(course_xp)
      FROM (
        SELECT
          course_id,
          CASE
            WHEN MAX(CASE WHEN passed = true THEN 1 ELSE 0 END) = 1
              THEN MAX(CASE WHEN passed = true THEN points ELSE 0 END)
            ELSE (
              SELECT points FROM public.course_attempts ca2
              WHERE  ca2.student_id = v_id AND ca2.course_id = ca.course_id
              ORDER  BY started_at DESC LIMIT 1
            )
          END AS course_xp
        FROM   public.course_attempts ca
        WHERE  ca.student_id = v_id
        GROUP  BY course_id
      ) sub
    ), 0),
    now()
  ON CONFLICT (student_id) DO UPDATE
    SET total_xp   = EXCLUDED.total_xp,
        updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. guided_project_attempts: form_id → ve_id
-- ─────────────────────────────────────────────────────────────────────────────

-- Add new column
ALTER TABLE public.guided_project_attempts
  ADD COLUMN IF NOT EXISTS ve_id uuid;

-- Populate from the virtual_experiences table (IDs were preserved from forms migration)
UPDATE public.guided_project_attempts gpa
SET ve_id = gpa.form_id
WHERE EXISTS (SELECT 1 FROM public.virtual_experiences ve WHERE ve.id = gpa.form_id);

-- Add FK constraint
ALTER TABLE public.guided_project_attempts
  ADD CONSTRAINT guided_project_attempts_ve_id_fkey
  FOREIGN KEY (ve_id) REFERENCES public.virtual_experiences(id) ON DELETE CASCADE;

-- Make NOT NULL
ALTER TABLE public.guided_project_attempts
  ALTER COLUMN ve_id SET NOT NULL;

-- Drop old form_id FK and column
ALTER TABLE public.guided_project_attempts
  DROP CONSTRAINT IF EXISTS guided_project_attempts_form_id_fkey;
ALTER TABLE public.guided_project_attempts
  DROP COLUMN IF EXISTS form_id;

-- Recreate unique index and regular index on new column
DROP INDEX IF EXISTS guided_project_attempts_uniq;
DROP INDEX IF EXISTS guided_project_attempts_form_id_idx;

CREATE UNIQUE INDEX IF NOT EXISTS guided_project_attempts_uniq
  ON public.guided_project_attempts(student_id, ve_id);
CREATE INDEX IF NOT EXISTS guided_project_attempts_ve_id_idx
  ON public.guided_project_attempts(ve_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. certificates: form_id → course_id
-- ─────────────────────────────────────────────────────────────────────────────

-- Add new column (nullable — learning path certs have no course_id)
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS course_id uuid;

-- Populate for certificates that belong to a course
UPDATE public.certificates cert
SET course_id = cert.form_id
WHERE cert.form_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = cert.form_id);

-- Add FK constraint (nullable, so no NOT NULL)
ALTER TABLE public.certificates
  ADD CONSTRAINT certificates_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;

-- Drop old form_id FK (keep column temporarily for safety — drop in migration 032)
ALTER TABLE public.certificates
  DROP CONSTRAINT IF EXISTS certificates_form_id_fkey;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. cohort_assignments: add polymorphic content_type + content_id columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cohort_assignments
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS content_id   uuid;

-- Populate content_type and content_id from the forms table
UPDATE public.cohort_assignments ca
SET
  content_type = f.content_type,
  content_id   = f.id
FROM public.forms f
WHERE ca.form_id = f.id
  AND f.content_type IN ('course', 'event', 'virtual_experience');

-- For pure forms (registration forms), content_type stays 'form'
UPDATE public.cohort_assignments ca
SET
  content_type = 'form',
  content_id   = ca.form_id
WHERE ca.form_id IS NOT NULL
  AND ca.content_id IS NULL;

-- Add index on the new polymorphic columns
CREATE INDEX IF NOT EXISTS idx_cohort_assignments_content
  ON public.cohort_assignments(content_type, content_id);

-- Note: form_id kept for now — drop in migration 032 after code is updated
-- New unique constraint on content (replaces form_id + cohort_id)
ALTER TABLE public.cohort_assignments
  DROP CONSTRAINT IF EXISTS cohort_assignments_content_id_cohort_id_key;
ALTER TABLE public.cohort_assignments
  ADD CONSTRAINT cohort_assignments_content_id_cohort_id_key
  UNIQUE (content_id, cohort_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. responses: keep form_id but widen scope to also cover events table
-- responses are for event registrations and pure form submissions only
-- (courses use course_attempts, VEs use guided_project_attempts)
-- No column change needed — form_id will reference forms (pure forms)
-- or be updated per content_type after code migration.
-- ─────────────────────────────────────────────────────────────────────────────

-- No changes to responses table in this migration.
-- Event responses will be updated in Phase 3 code changes.
