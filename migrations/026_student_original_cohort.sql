-- Stores the cohort a student was in before being moved to the owing/OINS cohort.
-- Used to restore them to the correct cohort when their balance is cleared.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS original_cohort_id uuid
    REFERENCES public.cohorts(id) ON DELETE SET NULL;
