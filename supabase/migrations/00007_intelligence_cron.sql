-- Schedule property intelligence pipeline every Sunday at 3 AM IST (21:30 UTC Saturday)
-- IST = UTC + 5:30, so 3:00 AM IST Sunday = 21:30 UTC Saturday
SELECT cron.schedule(
  'weekly-property-intelligence',
  '30 21 * * 6',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/property-intelligence',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
