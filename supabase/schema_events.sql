-- Usage log (first-party): which pages are opened, which modes started, which buttons tapped.
create table if not exists public.chess_events (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session text,
  kind text not null check (char_length(kind) <= 24),
  name text check (char_length(name) <= 64),
  meta jsonb,
  device text check (char_length(device) <= 12),
  created_at timestamptz not null default now()
);
create index if not exists chess_events_created on public.chess_events (created_at desc);
create index if not exists chess_events_user on public.chess_events (user_id, created_at desc);
alter table public.chess_events enable row level security;
drop policy if exists "events insert own" on public.chess_events;
create policy "events insert own" on public.chess_events for insert to authenticated
  with check (user_id = auth.uid() and coalesce(pg_column_size(meta), 0) < 2000);
-- reading only for admins, through this function
create or replace function public.events_summary(days int default 7)
returns table(kind text, name text, users bigint, n bigint)
language sql security definer set search_path = public, private as $$
  select e.kind, e.name, count(distinct e.user_id), count(*)
  from public.chess_events e
  where e.created_at > now() - make_interval(days => greatest(1, least(days, 90)))
    and exists (select 1 from private.news_admins a where a.user_id = auth.uid())
  group by 1, 2 order by 4 desc limit 500;
$$;
revoke all on function public.events_summary(int) from public, anon;
grant execute on function public.events_summary(int) to authenticated;
