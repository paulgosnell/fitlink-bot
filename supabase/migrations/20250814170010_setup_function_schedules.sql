-- Enable required extensions (idempotent)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Unschedule existing jobs if they exist (idempotent)
do $$ begin
  perform cron.unschedule('fitlink_daily_briefings_hourly');
exception when others then
  null;
end $$;

do $$ begin
  perform cron.unschedule('fitlink_pre_briefing_sync_50');
exception when others then
  null;
end $$;

-- Schedule daily-briefings: run at top of each hour (0 * * * *)
select
  cron.schedule(
    'fitlink_daily_briefings_hourly',
    '0 * * * *',
    $$
    select net.http_post(
      url := 'https://umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/daily-briefings',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('source', 'pg_cron', 'scheduled_at', now())
    );
    $$
  );

-- Schedule pre-briefing-sync: run at :50 each hour (50 * * * *)
select
  cron.schedule(
    'fitlink_pre_briefing_sync_50',
    '50 * * * *',
    $$
    select net.http_post(
      url := 'https://umixefoxgjmdlvvtfnmr.supabase.co/functions/v1/pre-briefing-sync',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('source', 'pg_cron', 'scheduled_at', now())
    );
    $$
  );

-- Notes:
-- 1) Both functions are configured with verify_jwt=false in their config.toml to allow schedule invocation.
-- 2) If you prefer to include Authorization headers, store the anon key via Vault and add a Bearer token header.

