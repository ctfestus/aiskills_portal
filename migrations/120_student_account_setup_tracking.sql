-- Track the admin-created student account setup journey:
-- account created -> setup email sent -> setup link opened -> password set -> first dashboard login.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS account_provisioned_at      timestamptz,
  ADD COLUMN IF NOT EXISTS setup_email_sent_at         timestamptz,
  ADD COLUMN IF NOT EXISTS password_setup_started_at   timestamptz,
  ADD COLUMN IF NOT EXISTS password_set_at             timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at     timestamptz;
