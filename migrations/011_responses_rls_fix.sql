-- Security fix: Unauthenticated responses insert
-- Previously WITH CHECK (true) allowed anyone (including unauthenticated
-- attackers) to flood the table with arbitrarily large payloads.
-- Fix: restrict to authenticated users only and cap data payload at 64KB.

DROP POLICY IF EXISTS "responses: public insert" ON public.responses;
DROP POLICY IF EXISTS "responses: anon insert non-course" ON public.responses;
DROP POLICY IF EXISTS "responses: authenticated insert" ON public.responses;

CREATE POLICY "responses: authenticated insert"
  ON public.responses FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND pg_column_size(data) <= 65536
  );
