-- Add deadline_days to assignments (matches courses, events, virtual_experiences)
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS deadline_days integer;
