-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule weekly crawl every Monday at 9:00 AM IST (3:30 AM UTC)
-- IST = UTC + 5:30, so 9:00 AM IST = 3:30 AM UTC
-- Day 1 = Monday in cron
SELECT cron.schedule(
  'weekly-property-crawl',
  '30 3 * * 1',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/daily-crawl',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
