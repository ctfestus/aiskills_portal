-- Migration 032: Schema Refactor Phase 4 — Cleanup
-- ⚠️  RUN THIS ONLY AFTER confirming all code is working with new tables.
-- Removes migrated rows from forms, drops transitional columns, and finalises the schema.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Remove migrated content from the forms table
--    (courses, events, and VEs now live in their own tables)
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM public.forms
WHERE content_type IN ('course', 'event', 'virtual_experience');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. forms table: remove content_type (now only holds pure registration forms)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.forms
  DROP COLUMN IF EXISTS content_type;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. certificates: drop old form_id column (replaced by course_id in 031)
--    Rebuild unique index and owner-write policy to use course_id.
-- ─────────────────────────────────────────────────────────────────────────────

-- Rebuild unique active-cert index on course_id (was form_id after migration 016)
DROP INDEX IF EXISTS certificates_unique_active_student;
CREATE UNIQUE INDEX certificates_unique_active_student
  ON public.certificates (course_id, student_id)
  WHERE revoked = false AND course_id IS NOT NULL;

-- Rebuild owner-write policy to check course ownership instead of form ownership
DROP POLICY IF EXISTS "certificates_owner_write" ON public.certificates;
CREATE POLICY "certificates_owner_write" ON public.certificates
  FOR ALL USING (
    course_id IN (
      SELECT id FROM public.courses WHERE user_id = (SELECT auth.uid())
    )
  );

ALTER TABLE public.certificates
  DROP COLUMN IF EXISTS form_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. cohort_assignments: drop old form_id column (replaced by content_id in 031)
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the original unique constraint (named in migration 007)
ALTER TABLE public.cohort_assignments
  DROP CONSTRAINT IF EXISTS cohort_assignments_uniq;

-- Drop the FK to forms (form_id references forms(id) ON DELETE CASCADE)
ALTER TABLE public.cohort_assignments
  DROP CONSTRAINT IF EXISTS cohort_assignments_form_id_fkey;

ALTER TABLE public.cohort_assignments
  DROP COLUMN IF EXISTS form_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Update forms RLS policy — no longer needs content_type check
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "forms: cohort student select" ON public.forms;

-- Pure forms are accessed by the form owner or admin only (no cohort access)
CREATE POLICY "forms: owner select"
  ON public.forms FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Drop transitional safe-cast helper functions (added in 030, no longer needed)
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.safe_int(text);
DROP FUNCTION IF EXISTS public.safe_date(text);
DROP FUNCTION IF EXISTS public.safe_time(text);
DROP FUNCTION IF EXISTS public.safe_bool(text);
