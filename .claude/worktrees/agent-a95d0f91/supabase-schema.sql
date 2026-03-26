-- Run this in your Supabase SQL Editor

-- Create forms table
create table public.forms (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  slug text unique,
  title text not null,
  description text,
  config jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create responses table
create table public.responses (
  id uuid default gen_random_uuid() primary key,
  form_id uuid references public.forms on delete cascade not null,
  data jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table public.forms enable row level security;
alter table public.responses enable row level security;

-- Policies for forms
create policy "Users can create their own forms." on forms for insert with check (auth.uid() = user_id);
create policy "Users can view their own forms." on forms for select using (auth.uid() = user_id);
create policy "Users can update their own forms." on forms for update using (auth.uid() = user_id);
create policy "Users can delete their own forms." on forms for delete using (auth.uid() = user_id);
create policy "Anyone can view a form." on forms for select using (true);

-- Policies for responses
create policy "Anyone can insert a response." on responses for insert with check (true);
create policy "Users can view responses to their forms." on responses for select using (
  exists (select 1 from forms where forms.id = responses.form_id and forms.user_id = auth.uid())
);

-- Creators can delete responses to their own forms (spam, test, bogus entries)
create policy "Users can delete responses to their forms." on responses for delete using (
  exists (select 1 from forms where forms.id = responses.form_id and forms.user_id = auth.uid())
);

-- Fix missing ON DELETE CASCADE on forms.user_id (run against existing databases)
ALTER TABLE public.forms
  DROP CONSTRAINT IF EXISTS forms_user_id_fkey,
  ADD CONSTRAINT forms_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── Email idempotency ────────────────────────────────────────────────────────
-- Prevents duplicate confirmation/course-result emails when the client retries.
-- Keyed on (response_id, type) — only one email of each type per response.
CREATE TABLE IF NOT EXISTS public.sent_emails (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id uuid       NOT NULL REFERENCES public.responses(id) ON DELETE CASCADE,
  type       text        NOT NULL CHECK (type IN ('confirmation', 'course-result')),
  sent_at    timestamptz DEFAULT now() NOT NULL,
  UNIQUE (response_id, type)
);
-- No RLS; only reachable via service_role from the API route.

-- ── Blast send quotas ────────────────────────────────────────────────────────
-- Tracks how many broadcast emails a creator has sent today.
-- Cap enforced in the API route (default: 10 blasts per creator per day).
CREATE TABLE IF NOT EXISTS public.blast_quotas (
  id         uuid  DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id uuid  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date  NOT NULL DEFAULT CURRENT_DATE,
  count      integer NOT NULL DEFAULT 0,
  UNIQUE (creator_id, date)
);
-- No RLS; only reachable via service_role from the API route.

-- ── Event registrations ───────────────────────────────────────────────────────
-- One row per (form, email) pair — the PRIMARY KEY enforces uniqueness at the
-- DB level so duplicate registrations are impossible even under race conditions.
CREATE TABLE IF NOT EXISTS public.event_registrations (
  form_id       uuid        NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  email         text        NOT NULL CHECK (email = lower(trim(email))),
  response_id   uuid        REFERENCES public.responses(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  registered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (form_id, email)
);

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
-- No client-facing policies — all access goes through the service role key
-- in /api/event-register via the register_event_attendee RPC below.

-- ── Atomic event registration RPC ────────────────────────────────────────────
-- Inserts into both event_registrations and responses in a single transaction.
-- If either INSERT fails the whole operation rolls back — no ghost registrations.
-- SECURITY DEFINER + pinned search_path prevents search-path hijacking.
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
  -- Try to claim the slot. ON CONFLICT DO NOTHING handles only the
  -- (form_id, email) PRIMARY KEY — any other error propagates normally.
  INSERT INTO public.event_registrations (form_id, email, response_id)
  VALUES (p_form_id, lower(trim(p_email)), p_response_id)
  ON CONFLICT (form_id, email) DO NOTHING;

  -- IF NOT FOUND means the row already existed — email already registered.
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'already_registered');
  END IF;

  -- Record the form response in the same transaction.
  -- Any failure here (e.g. duplicate response_id) raises a real exception
  -- and rolls back the registration insert above.
  INSERT INTO public.responses (id, form_id, data)
  VALUES (p_response_id, p_form_id, p_data);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Only the service role (used by /api/event-register) may call this function.
REVOKE EXECUTE ON FUNCTION public.register_event_attendee FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.register_event_attendee TO service_role;
