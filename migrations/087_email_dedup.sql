-- Generic email dedup table for exactly-once sends not tied to the responses table.
-- Used for certificate emails (keyed on cert id) and any future server-side sends
-- that do not have a corresponding responses row.
--
-- dedupe_key: arbitrary stable identifier (e.g. cert UUID as text)
-- type:       email type string (e.g. 'course-certificate')
-- status:     'pending' = lock acquired but send not yet confirmed
--             'sent'    = email sent successfully
-- UNIQUE(dedupe_key, type) is the lock target for the insert-as-lock pattern.
-- On 23505: check status. 'sent' = skip. 'pending' = prior holder crashed,
-- delete the row and let the next caller re-acquire.

CREATE TABLE IF NOT EXISTS public.email_dedup (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key  text        NOT NULL,
  type        text        NOT NULL,
  status      text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent')),
  sent_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dedupe_key, type)
);

-- Service role only; no client access needed.
ALTER TABLE public.email_dedup ENABLE ROW LEVEL SECURITY;
