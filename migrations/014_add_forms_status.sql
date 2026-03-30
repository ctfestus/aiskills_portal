-- Migration 014: Add status column to forms table + fix RLS
-- Instructors can save as draft and publish when ready.
-- Students only see published forms assigned to their cohort.

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published'
  CHECK (status IN ('draft', 'published', 'archived'));

CREATE INDEX IF NOT EXISTS idx_forms_status ON public.forms(status);

-- Drop the old overly-permissive USING(true) policy
DROP POLICY IF EXISTS "forms: public read" ON public.forms;

-- Instructors/admins can always read their own forms (any status)
CREATE POLICY "forms: owner read"
  ON public.forms FOR SELECT
  USING (user_id = auth.uid());

-- Students can only read published forms assigned to their cohort
CREATE POLICY "forms: assigned student read"
  ON public.forms FOR SELECT
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = auth.uid()
        AND s.cohort_id = ANY(cohort_ids)
    )
  );
