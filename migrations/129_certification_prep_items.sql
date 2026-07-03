-- 129: courses / learning paths to complete before a certification exam.
--
-- Instructors attach published courses and/or a learning path to a certification;
-- the certification overview renders them under the "Complete courses" step as
-- landing-page-style cards with hover previews. Stored as [{id, type:'course'|'path'}].
-- Details are resolved at render time from the public published_* views, so
-- unpublished or deleted items silently drop out.

ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS prep_items jsonb NOT NULL DEFAULT '[]';
