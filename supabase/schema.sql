-- Mothership: run this once in Supabase → SQL Editor → New query → Run.
-- To receive todos from Beamup, also run inbox.sql. Safe to run again (e.g. after an update).
--
-- Every user's data is a set of JSON documents (one per board, one per list with its cards, plus
-- "meta" for theme, members and the alien). Row level security keeps each user to their own rows,
-- which is what makes it safe to put the anon key in the website.

create table if not exists public.user_docs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  doc_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, doc_id)
);

alter table public.user_docs enable row level security;

drop policy if exists "read own docs" on public.user_docs;
drop policy if exists "insert own docs" on public.user_docs;
drop policy if exists "update own docs" on public.user_docs;
drop policy if exists "delete own docs" on public.user_docs;

create policy "read own docs" on public.user_docs
  for select to authenticated using (auth.uid() = user_id);
create policy "insert own docs" on public.user_docs
  for insert to authenticated with check (auth.uid() = user_id);
create policy "update own docs" on public.user_docs
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own docs" on public.user_docs
  for delete to authenticated using (auth.uid() = user_id);

-- Live updates between devices (Supabase Realtime).
do $$
begin
  alter publication supabase_realtime add table public.user_docs;
exception when duplicate_object then null;
end $$;

-- A save must carry a newer revision (_rev) than the stored one. Current versions of the app only save on
-- top of the revision they last saw (and merge first if it changed), so this only stops an outdated copy of
-- the app, e.g. a tab left open on another device, from overwriting newer data with its old copy.
create or replace function public.user_docs_newer_only()
returns trigger
language plpgsql
as $$
begin
  if old.data ? '_rev'
     and coalesce((new.data ->> '_rev')::numeric, -1) <= (old.data ->> '_rev')::numeric then
    raise exception 'outdated save of %: reload the app', old.doc_id using errcode = '40001';
  end if;
  return new;
end;
$$;

drop trigger if exists user_docs_newer_only on public.user_docs;
create trigger user_docs_newer_only
  before update on public.user_docs
  for each row execute function public.user_docs_newer_only();
