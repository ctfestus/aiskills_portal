-- Add cover_image to assignments (missing from original schema)
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS cover_image text;

-- Add cover_image to communities (missing from original schema)
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS cover_image text;

-- Add youtube_url to announcements (missing from original schema)
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS youtube_url text;
