-- Drop the FK that ties sent_nudges.form_id to public.forms(id).
-- form_id now stores course/VE/assignment IDs — none of which are in forms.
-- The constraint was added in 006 and never removed in 016.
ALTER TABLE public.sent_nudges
  DROP CONSTRAINT IF EXISTS sent_nudges_form_id_fkey;
