-- Arbor × Beamup: run this once in Supabase → SQL Editor → New query → Run
-- (after schema.sql). Safe to run again.
--
-- Beamup has no Arbor login. It sends each todo with a private "connection code" that
-- Arbor generates for you (外觀 → 連接 Beamup). inbox_push() looks the code up, files the
-- todo under its owner, and Arbor picks it up, turns it into a card in the top 待辦 list
-- and deletes the row. Regenerating the code in Arbor cuts off the old one.

create table if not exists public.inbox_keys (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  key text not null unique check (length(key) >= 24),
  created_at timestamptz not null default now()
);

create table if not exists public.inbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists inbox_user_idx on public.inbox (user_id, id);

alter table public.inbox_keys enable row level security;
alter table public.inbox enable row level security;

drop policy if exists "read own key" on public.inbox_keys;
drop policy if exists "insert own key" on public.inbox_keys;
drop policy if exists "update own key" on public.inbox_keys;
drop policy if exists "delete own key" on public.inbox_keys;
drop policy if exists "read own inbox" on public.inbox;
drop policy if exists "delete own inbox" on public.inbox;

create policy "read own key" on public.inbox_keys
  for select to authenticated using (auth.uid() = user_id);
create policy "insert own key" on public.inbox_keys
  for insert to authenticated with check (auth.uid() = user_id);
create policy "update own key" on public.inbox_keys
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own key" on public.inbox_keys
  for delete to authenticated using (auth.uid() = user_id);

-- Nobody inserts into inbox directly; only inbox_push() below does.
create policy "read own inbox" on public.inbox
  for select to authenticated using (auth.uid() = user_id);
create policy "delete own inbox" on public.inbox
  for delete to authenticated using (auth.uid() = user_id);

create or replace function public.inbox_push(p_key text, p_item jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  select user_id into owner from public.inbox_keys where key = p_key;
  if owner is null then
    raise exception 'invalid connection code' using errcode = '28000';
  end if;
  if p_item ->> 'type' = 'ping' then
    return jsonb_build_object('ok', true);
  end if;
  if octet_length(p_item::text) > 20000 then
    raise exception 'todo too large' using errcode = '22023';
  end if;
  insert into public.inbox (user_id, payload) values (owner, p_item);
  return jsonb_build_object('id', p_item ->> 'id');
end;
$$;

revoke all on function public.inbox_push(text, jsonb) from public;
grant execute on function public.inbox_push(text, jsonb) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.inbox;
exception when duplicate_object then null;
end $$;
