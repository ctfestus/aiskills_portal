-- ── user_integrations table ───────────────────────────────────────────────────
-- Run this in the Supabase SQL editor before using the integrations feature.
--
-- You also need to configure OAuth apps and set these env vars in .env.local:
--
--   SUPABASE_SERVICE_ROLE_KEY=   (from Supabase Settings → API)
--   APP_URL=https://festforms.com
--
--   GOOGLE_CLIENT_ID=            (Google Cloud Console → APIs → Credentials)
--   GOOGLE_CLIENT_SECRET=        (enable "Google Calendar API" in the console)
--   Redirect URI: {APP_URL}/api/integrations/google_meet/callback
--
--   ZOOM_CLIENT_ID=              (marketplace.zoom.us → Develop → Build App → OAuth)
--   ZOOM_CLIENT_SECRET=
--   Redirect URI: {APP_URL}/api/integrations/zoom/callback
--
--   TEAMS_CLIENT_ID=             (Azure Portal → App registrations → New registration)
--   TEAMS_CLIENT_SECRET=         (Certificates & secrets → New client secret)
--   Redirect URI: {APP_URL}/api/integrations/teams/callback
--   Required API permission: Microsoft Graph → OnlineMeetings.ReadWrite (delegated)

CREATE TABLE IF NOT EXISTS user_integrations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      text        NOT NULL CHECK (provider IN ('google_meet', 'zoom', 'teams')),
  access_token  text        NOT NULL,
  refresh_token text,
  token_expiry  timestamptz,
  account_email text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own integrations"
  ON user_integrations FOR ALL
  USING (auth.uid() = user_id);
