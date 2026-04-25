-- Add tool_logos column to virtual_experiences
-- Stores a JSON map of tool name -> logo URL, e.g. {"Excel": "https://...", "Power BI": "https://..."}
ALTER TABLE public.virtual_experiences
  ADD COLUMN IF NOT EXISTS tool_logos jsonb DEFAULT '{}';
