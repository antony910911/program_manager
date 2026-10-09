-- Arbor: run this once in Supabase → SQL Editor → New query → Run.
-- To receive todos from Beamup, also run inbox.sql.
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
