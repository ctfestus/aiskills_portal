-- Tracks when each cohort was assigned to each form.
-- assigned_at is preserved on re-save (ON CONFLICT DO NOTHING) so student deadlines
-- are always measured from the original assignment date.
--
-- deadline_days lives in forms.config.deadline_days (per form), not here.

CREATE TABLE IF NOT EXISTS public.cohort_assignments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id     uuid        NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  cohort_id   uuid        NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cohort_assignments_uniq UNIQUE (form_id, cohort_id)
);

CREATE INDEX IF NOT EXISTS cohort_assignments_form
  ON public.cohort_assignments(form_id);

CREATE INDEX IF NOT EXISTS cohort_assignments_cohort
  ON public.cohort_assignments(cohort_id);
