-- Migration 040: Fix event_registrations RLS SELECT policy
-- The policy referenced e.instructor_id which does not exist on the events table.
-- The events table uses user_id. This caused all student SELECT queries to fail silently.

DROP POLICY IF EXISTS "event_registrations: select" ON public.event_registrations;

CREATE POLICY "event_registrations: select" ON public.event_registrations FOR SELECT USING (
  student_id = (select auth.uid())
  OR (select public.is_admin())
  OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.user_id = (select auth.uid()))
);

-- Also fix instructor manage policy which has the same issue
DROP POLICY IF EXISTS "event_registrations: instructor manage" ON public.event_registrations;

CREATE POLICY "event_registrations: instructor manage" ON public.event_registrations FOR ALL
  USING ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.user_id = (select auth.uid())))
  WITH CHECK ((select public.is_admin()) OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.user_id = (select auth.uid())));
