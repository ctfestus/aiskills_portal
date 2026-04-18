ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS recurrence         text    DEFAULT 'once',
  ADD COLUMN IF NOT EXISTS recurrence_end_date date,
  ADD COLUMN IF NOT EXISTS recurrence_days    int[];
