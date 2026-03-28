-- Add 'virtual_experience' to the content_type CHECK constraint.
-- Run this in your Supabase SQL editor.

ALTER TABLE public.forms DROP CONSTRAINT forms_content_type_check;

ALTER TABLE public.forms ADD CONSTRAINT forms_content_type_check
  CHECK (content_type IN ('course', 'event', 'guided_project', 'virtual_experience'));
