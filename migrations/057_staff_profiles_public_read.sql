-- Expose only public profile fields (name + avatar) for staff authors on announcements.
-- A security-definer function is used so students cannot access email or other sensitive columns.
-- The students: select policy is NOT changed — staff rows remain unreadable to students directly.

CREATE OR REPLACE FUNCTION public.get_staff_profiles(p_ids uuid[])
RETURNS TABLE(id uuid, full_name text, avatar_url text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id, full_name, avatar_url
  FROM students
  WHERE id = ANY(p_ids)
    AND role IN ('admin', 'instructor');
$$;

REVOKE EXECUTE ON FUNCTION public.get_staff_profiles(uuid[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_staff_profiles(uuid[]) TO authenticated;
