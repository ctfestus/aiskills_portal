-- Add group targeting to virtual_experiences (mirrors assignments.group_ids)
ALTER TABLE public.virtual_experiences
  ADD COLUMN IF NOT EXISTS group_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_ve_group_ids ON public.virtual_experiences USING GIN (group_ids);
