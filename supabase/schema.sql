-- Chess.nat: one private key-value store per account.
-- Run once in Supabase → SQL Editor → New query → Run.
create table if not exists public.kv (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  path       text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, path)
);

alter table public.kv enable row level security;

drop policy if exists "kv: own rows only" on public.kv;
create policy "kv: own rows only" on public.kv
  for all to authenticated
  using  ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- keep a single document from growing without bound (profiles are ~20 KB, daily logs up to ~200 KB)
alter table public.kv drop constraint if exists kv_size;
alter table public.kv add constraint kv_size check (pg_column_size(data) < 1000000);
