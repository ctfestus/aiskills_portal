-- Migration 037: Fix event registration 500 error
--
-- The register_event_attendee RPC (036) tried to INSERT into
-- event_registrations(form_id, email, response_id) but those columns
-- do not exist. The actual event_registrations table uses student_id/event_id.
-- Create event_attendees for email-based public sign-ups and rewrite the RPC.

-- 1. event_attendees table
CREATE TABLE IF NOT EXISTS public.event_attendees (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  email         text        NOT NULL,
  response_id   uuid,
  data          jsonb       NOT NULL DEFAULT '{}',
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, email)
);

CREATE INDEX IF NOT EXISTS idx_event_attendees_event
  ON public.event_attendees(event_id);

ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_attendees_owner_read" ON public.event_attendees
  FOR SELECT USING (
    event_id IN (
      SELECT id FROM public.events WHERE user_id = (SELECT auth.uid())
    )
  );

-- 2. register_event_attendee RPC rewritten to use event_attendees
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
BEGIN
  INSERT INTO public.event_attendees (event_id, email, response_id, data)
  VALUES (p_form_id, lower(trim(p_email)), p_response_id, COALESCE(p_data, '{}'))
  ON CONFLICT (event_id, email) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'already_registered');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_event_attendee FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.register_event_attendee TO service_role;
