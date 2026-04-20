-- Add is_short_course flag to virtual_experiences for simplified course mode
ALTER TABLE virtual_experiences
  ADD COLUMN IF NOT EXISTS is_short_course boolean DEFAULT false;
