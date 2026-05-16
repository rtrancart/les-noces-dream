
-- Unschedule existing jobs with same name (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job
   WHERE jobname IN ('cron-archive-unsigned-prestataires', 'cron-suspend-charte-obsolete');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'cron-archive-unsigned-prestataires',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://egbohbwiywgyyculswvf.supabase.co/functions/v1/cron-archive-unsigned-prestataires',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYm9oYndpeXdneXljdWxzd3ZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTY3MTYsImV4cCI6MjA4ODc5MjcxNn0.Gh2g_CdEQDUu-oIZTdwLSqjTgn5N-k1slXqNetVcYLw"}'::jsonb,
    body := concat('{"triggered_at":"', now(), '"}')::jsonb
  );
  $$
);

SELECT cron.schedule(
  'cron-suspend-charte-obsolete',
  '15 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://egbohbwiywgyyculswvf.supabase.co/functions/v1/cron-suspend-charte-obsolete',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYm9oYndpeXdneXljdWxzd3ZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTY3MTYsImV4cCI6MjA4ODc5MjcxNn0.Gh2g_CdEQDUu-oIZTdwLSqjTgn5N-k1slXqNetVcYLw"}'::jsonb,
    body := concat('{"triggered_at":"', now(), '"}')::jsonb
  );
  $$
);
