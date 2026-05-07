-- Add optional grace period (in days) to cohort payment settings.
-- When set, overdue students retain active access for this many days
-- past the missed installment due date before being moved to outstanding.
ALTER TABLE public.cohort_payment_settings
  ADD COLUMN IF NOT EXISTS grace_period_days integer DEFAULT NULL
    CHECK (grace_period_days IS NULL OR grace_period_days >= 0);
