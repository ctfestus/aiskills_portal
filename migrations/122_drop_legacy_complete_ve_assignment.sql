-- Remove the pre-group VE assignment completion RPC overload.
--
-- The newer complete_ve_assignment function accepts p_group_id and
-- p_participants with DEFAULT NULL. Leaving the old six-argument overload in
-- place makes PostgREST unable to resolve individual assignment submissions.

DROP FUNCTION IF EXISTS public.complete_ve_assignment(
  uuid, uuid, uuid, jsonb, text, text
);

REVOKE EXECUTE ON FUNCTION public.complete_ve_assignment(
  uuid, uuid, uuid, jsonb, text, text, uuid, uuid[]
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ve_assignment(
  uuid, uuid, uuid, jsonb, text, text, uuid, uuid[]
) TO service_role;

NOTIFY pgrst, 'reload schema';
