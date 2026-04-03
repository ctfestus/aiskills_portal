-- Add skills JSONB column to students (array of skill strings)
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS skills jsonb NOT NULL DEFAULT '[]'::jsonb;
