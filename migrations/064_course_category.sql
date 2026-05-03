-- Add category column to courses for skill-based grouping
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS category text;
