-- Add responses column to event_registrations for capturing custom form field answers
ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS responses jsonb DEFAULT '{}'::jsonb;
