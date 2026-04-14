-- Migration 035: Add speakers column to events table
-- Speakers were stored in forms.config->eventDetails->speakers (JSONB array)
-- but were not included in the 030 migration schema.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS speakers jsonb NOT NULL DEFAULT '[]';

-- Backfill from forms table (only runs if forms table still exists with event rows)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'forms'
  ) THEN
    UPDATE public.events e
    SET speakers = COALESCE(f.config->'eventDetails'->'speakers', '[]'::jsonb)
    FROM public.forms f
    WHERE f.id = e.id
      AND f.content_type = 'event'
      AND f.config->'eventDetails'->'speakers' IS NOT NULL
      AND jsonb_array_length(COALESCE(f.config->'eventDetails'->'speakers', '[]'::jsonb)) > 0;
  END IF;
END
$$;
