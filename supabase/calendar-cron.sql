-- Mothership: sync calendars every 5 minutes, even while the app is closed.
-- Run once in Supabase → SQL Editor → New query → Run, after calendar.sql. Safe to run again.
--
-- Every 5 minutes the database calls the "calendar" function, which (for anyone whose app isn't open)
-- takes in waiting Beamup items, writes changed cards to the calendars and brings calendar changes back.
-- The call carries a secret generated here; only the database and the function can read it.

-- (calendar.sql already adds this column; repeated so this file also works on its own.)
alter table public.calendar_accounts add column if not exists tz text;

create table if not exists public.calendar_cron (
  id int primary key default 1 check (id = 1),
  secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
insert into public.calendar_cron (id) values (1) on conflict (id) do nothing;
alter table public.calendar_cron enable row level security;
revoke all on public.calendar_cron from anon, authenticated;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Replace an earlier schedule of the same name, then schedule the call.
select cron.unschedule(jobid) from cron.job where jobname = 'mothership-calendar';
select cron.schedule(
  'mothership-calendar',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://bunbpnmcpcqtfshgvzup.supabase.co/functions/v1/calendar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select secret from public.calendar_cron where id = 1)
    ),
    body := '{"action":"cron"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
