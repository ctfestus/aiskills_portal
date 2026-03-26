-- ─────────────────────────────────────────────────────────────────────────────
-- FestForms — Supabase Cron Setup for Event Reminders
-- Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enable required extensions (both are available on the free plan)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Schedule hourly reminder check
--    Replace the URL and CRON_SECRET with your actual values before running.
SELECT cron.schedule(
  'festforms-event-reminders',   -- job name (unique)
  '0 * * * *',                   -- every hour at :00
  $$
  SELECT net.http_post(
    url     := 'https://YOUR_APP_URL/api/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- ─── Useful management queries ────────────────────────────────────────────────

-- List all scheduled jobs:
-- SELECT * FROM cron.job;

-- View recent job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- Unschedule the job (if needed):
-- SELECT cron.unschedule('festforms-event-reminders');

-- Update the schedule (e.g. every 30 mins):
-- SELECT cron.unschedule('festforms-event-reminders');
-- Then re-run the schedule block above with '*/30 * * * *'
