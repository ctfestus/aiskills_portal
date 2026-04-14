-- Migration 038: Consolidate event_attendees into event_registrations
--
-- Migration 037 created event_attendees as a separate table for email-based
-- public sign-ups. This causes confusion — one event, two tables.
-- We extend event_registrations to cover both cases:
--   - student_id nullable  (anonymous/public sign-ups have no student)
--   - email column added   (for public sign-ups and deduplication)
--   - data jsonb added     (form submission payload)
-- Then migrate data from event_attendees, drop it, and update the RPC.

-- 1. Extend event_registrations
ALTER TABLE public.event_registrations
  ALTER COLUMN student_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS email         text,
  ADD COLUMN IF NOT EXISTS data          jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS response_id   uuid;

-- 2. Unique constraint for email-based deduplication
--    (student_id, event_id) unique already exists for student sign-ups.
--    Add (event_id, email) unique for public sign-ups.
CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_event_email_uniq
  ON public.event_registrations (event_id, email)
  WHERE email IS NOT NULL;

-- 3. (event_attendees already dropped in first run of this migration)

-- 4. Update register_event_attendee RPC to use event_registrations
--    Looks up student by email so logged-in students see the event on their dashboard.
CREATE OR REPLACE FUNCTION public.register_event_attendee(
  p_form_id     uuid,
  p_email       text,
  p_response_id uuid,
  p_data        jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_student_id uuid;
  v_email      text := lower(trim(p_email));
BEGIN
  -- Look up student by email so the registration appears on their dashboard
  SELECT id INTO v_student_id
  FROM public.students
  WHERE email = v_email
  LIMIT 1;

  INSERT INTO public.event_registrations (event_id, email, response_id, data, student_id)
  VALUES (p_form_id, v_email, p_response_id, COALESCE(p_data, '{}'), v_student_id)
  ON CONFLICT (event_id, email) WHERE email IS NOT NULL DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'already_registered');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_event_attendee FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.register_event_attendee TO service_role;
