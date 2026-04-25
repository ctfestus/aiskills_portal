-- Replace deadline_days (never shipped) with a concrete deadline_date
ALTER TABLE public.assignments
  DROP COLUMN IF EXISTS deadline_days,
  ADD COLUMN IF NOT EXISTS deadline_date date;
