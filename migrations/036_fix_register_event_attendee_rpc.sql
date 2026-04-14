-- Migration 036: Fix register_event_attendee RPC
-- The old version inserted into responses(form_id) which FK-references forms(id).
-- Since events now live in the events table (not forms), that FK fails.
-- Events use event_registrations for attendee tracking -- no responses insert needed.

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
  -- Try to claim the slot. ON CONFLICT DO NOTHING handles the
  -- (form_id, email) PRIMARY KEY -- any other error propagates normally.
  INSERT INTO public.event_registrations (form_id, email, response_id)
  VALUES (p_form_id, lower(trim(p_email)), p_response_id)
  ON CONFLICT (form_id, email) DO NOTHING;

  -- IF NOT FOUND means the row already existed -- email already registered.
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'already_registered');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_event_attendee FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.register_event_attendee TO service_role;
