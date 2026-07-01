-- Migration 125: Add whatsapp_community_url to platform_settings
-- Community WhatsApp invite link, editable from dashboard branding settings.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS whatsapp_community_url text;
