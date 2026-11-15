-- Nations League (League A) for the Tippspiel's "Nations League" tab: the edge function "tipp" writes the groups,
-- every league-phase game and the knockout games here (ESPN, every 5 minutes); everybody may read it.
create table if not exists public.nl_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.nl_state enable row level security;
drop policy if exists nl_state_read on public.nl_state;
create policy nl_state_read on public.nl_state for select to anon, authenticated using (true);
grant select on public.nl_state to anon, authenticated;
