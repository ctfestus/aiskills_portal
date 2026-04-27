-- Add dark-mode logo support to platform_settings
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS logo_dark_url text;
