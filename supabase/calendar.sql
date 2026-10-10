-- Mothership × calendars (Google / Outlook / iCloud): run this once in Supabase → SQL Editor → New query
-- → Run (after schema.sql). Safe to run again.
--
-- Only the "calendar" Edge Function (service role) reads or writes these tables. Row level security is on
-- with no policies, so the app and anyone holding the public anon key can't see calendar sign-ins.

create table if not exists public.calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft', 'icloud')),
  label text not null default '',
  -- Refresh token (Google / Microsoft) or Apple ID + app-specific password (iCloud).
  secret jsonb not null,
  calendar_id text,
  calendar_name text,
  -- New cards with dates are written to this account's calendar.
  is_target boolean not null default false,
  last_sync timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists calendar_accounts_user_idx on public.calendar_accounts (user_id);
-- Added later: the user's time zone, for syncs that run while the app is closed.
alter table public.calendar_accounts add column if not exists tz text;

-- One row per card ↔ event pair.
create table if not exists public.calendar_links (
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.calendar_accounts (id) on delete cascade,
  event_id text not null,
  card_id text not null,
  hash text not null,
  card_start text not null,
  card_due text not null,
  all_day boolean not null,
  ev_start text not null,
  ev_end text not null,
  start_date text not null,
  recurring boolean not null default false,
  primary key (account_id, event_id),
  unique (user_id, card_id)
);

alter table public.calendar_accounts enable row level security;
alter table public.calendar_links enable row level security;
revoke all on public.calendar_accounts from anon, authenticated;
revoke all on public.calendar_links from anon, authenticated;
