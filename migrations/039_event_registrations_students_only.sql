-- Migration 039: Events are for students only — revert 038 email-based changes
--
-- Removes nullable student_id, email, data, response_id columns added in 038.
-- RPC now takes student_id directly. Route will pass authenticated student's ID.

-- 1. Delete any rows inserted with student_id = NULL (from 038 email-based flow)
DELETE FROM public.event_registrations WHERE student_id IS NULL;

-- 2. Restore student_id NOT NULL
ALTER TABLE public.event_registrations
  ALTER COLUMN student_id SET NOT NULL;

-- 3. Drop columns added in 038
ALTER TABLE public.event_registrations
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS data,
  DROP COLUMN IF EXISTS response_id;

-- 4. Drop partial index added in 038
DROP INDEX IF EXISTS event_registrations_event_email_uniq;

-- 5. Drop all old overloads of register_event_attendee
DROP FUNCTION IF EXISTS public.register_event_attendee(uuid, text, uuid, jsonb);
DROP FUNCTION IF EXISTS public.register_event_attendee(uuid, uuid);

-- 6. Create new RPC with student_id
CREATE FUNCTION public.register_event_attendee(
  p_event_id   uuid,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.event_registrations (event_id, student_id)
  VALUES (p_event_id, p_student_id)
  ON CONFLICT (student_id, event_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'already_registered');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_event_attendee(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.register_event_attendee(uuid, uuid) TO service_role;
