-- Chess.nat social layer: player names, friends, results between accounts (the "cage"), hearts and game invites.
-- Additive only. Run once in Supabase → SQL Editor (already applied on the live project).

-- public player card: only a chosen name, a rating and when the player was last online (never the email)
create table if not exists public.chess_players (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 2 and 24),
  name_lc    text generated always as (lower(btrim(name))) stored unique,
  rating     int,
  last_seen  timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.chess_players enable row level security;
drop policy if exists "players: signed-in can read" on public.chess_players;
create policy "players: signed-in can read" on public.chess_players for select to authenticated using (true);
drop policy if exists "players: own row insert" on public.chess_players;
create policy "players: own row insert" on public.chess_players for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "players: own row update" on public.chess_players;
create policy "players: own row update" on public.chess_players for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- friendships, stored once per pair with a < b
create table if not exists public.chess_friends (
  a            uuid not null references auth.users (id) on delete cascade,
  b            uuid not null references auth.users (id) on delete cascade,
  requested_by uuid not null,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  primary key (a, b),
  check (a < b),
  check (requested_by in (a, b))
);
create index if not exists chess_friends_b on public.chess_friends (b);
alter table public.chess_friends enable row level security;
drop policy if exists "friends: see own" on public.chess_friends;
create policy "friends: see own" on public.chess_friends for select to authenticated using ((select auth.uid()) in (a, b));
drop policy if exists "friends: send request" on public.chess_friends;
create policy "friends: send request" on public.chess_friends for insert to authenticated
  with check (requested_by = (select auth.uid()) and status = 'pending');
drop policy if exists "friends: accept request" on public.chess_friends;
create policy "friends: accept request" on public.chess_friends for update to authenticated
  using ((select auth.uid()) in (a, b) and (select auth.uid()) <> requested_by)
  with check (status = 'accepted');
drop policy if exists "friends: remove" on public.chess_friends;
create policy "friends: remove" on public.chess_friends for delete to authenticated using ((select auth.uid()) in (a, b));

-- live games between two accounts. Only the loser's device may report a loss (so nobody can invent a win);
-- either player may report a draw. id = room code + game number, so a game is stored once.
create table if not exists public.chess_duels (
  id          text primary key check (char_length(id) <= 40),
  white       uuid not null references auth.users (id) on delete cascade,
  black       uuid not null references auth.users (id) on delete cascade,
  result      text not null check (result in ('1-0', '0-1', '1/2-1/2')),
  reason      text check (char_length(reason) <= 40),
  moves       int,
  reported_by uuid not null default auth.uid(),
  created_at  timestamptz not null default now(),
  check (white <> black)
);
create index if not exists chess_duels_white on public.chess_duels (white, created_at desc);
create index if not exists chess_duels_black on public.chess_duels (black, created_at desc);
alter table public.chess_duels enable row level security;
drop policy if exists "duels: see own" on public.chess_duels;
create policy "duels: see own" on public.chess_duels for select to authenticated using ((select auth.uid()) in (white, black));
drop policy if exists "duels: loser reports" on public.chess_duels;
create policy "duels: loser reports" on public.chess_duels for insert to authenticated with check (
  reported_by = (select auth.uid()) and (
    (result = '1-0' and black = (select auth.uid())) or
    (result = '0-1' and white = (select auth.uid())) or
    (result = '1/2-1/2' and (select auth.uid()) in (white, black))));

-- hearts: you can send them to someone you have beaten
create table if not exists public.chess_gifts (
  id         bigint generated always as identity primary key,
  from_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  to_id      uuid not null references auth.users (id) on delete cascade,
  kind       text not null default 'heart' check (kind in ('heart')),
  created_at timestamptz not null default now()
);
create index if not exists chess_gifts_to on public.chess_gifts (to_id, created_at desc);
create index if not exists chess_gifts_from on public.chess_gifts (from_id, created_at desc);
alter table public.chess_gifts enable row level security;
drop policy if exists "gifts: see own" on public.chess_gifts;
create policy "gifts: see own" on public.chess_gifts for select to authenticated using ((select auth.uid()) in (from_id, to_id));
drop policy if exists "gifts: only to someone you beat" on public.chess_gifts;
create policy "gifts: only to someone you beat" on public.chess_gifts for insert to authenticated with check (
  from_id = (select auth.uid()) and exists (select 1 from public.chess_duels d where
    (d.result = '1-0' and d.white = (select auth.uid()) and d.black = to_id) or
    (d.result = '0-1' and d.black = (select auth.uid()) and d.white = to_id)));

-- game invites between friends
create table if not exists public.chess_invites (
  id         bigint generated always as identity primary key,
  from_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  to_id      uuid not null references auth.users (id) on delete cascade,
  code       text not null check (code ~ '^[a-z0-9]{4,12}$'),
  tc         text check (char_length(tc) <= 12),
  status     text not null default 'open' check (status in ('open', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists chess_invites_to on public.chess_invites (to_id, created_at desc);
alter table public.chess_invites enable row level security;
drop policy if exists "invites: see own" on public.chess_invites;
create policy "invites: see own" on public.chess_invites for select to authenticated using ((select auth.uid()) in (from_id, to_id));
drop policy if exists "invites: friends only" on public.chess_invites;
create policy "invites: friends only" on public.chess_invites for insert to authenticated with check (
  from_id = (select auth.uid()) and status = 'open' and exists (select 1 from public.chess_friends f where f.status = 'accepted' and
    ((f.a = (select auth.uid()) and f.b = to_id) or (f.b = (select auth.uid()) and f.a = to_id))));
drop policy if exists "invites: answer or cancel" on public.chess_invites;
create policy "invites: answer or cancel" on public.chess_invites for update to authenticated
  using ((select auth.uid()) in (from_id, to_id)) with check ((select auth.uid()) in (from_id, to_id));

-- updates may only touch the columns they are meant for
revoke update on public.chess_players, public.chess_friends, public.chess_invites, public.chess_duels, public.chess_gifts from anon, authenticated;
grant update (name, rating, last_seen) on public.chess_players to authenticated;
grant update (status) on public.chess_friends to authenticated;
grant update (status) on public.chess_invites to authenticated;
revoke all on public.chess_players, public.chess_friends, public.chess_invites, public.chess_duels, public.chess_gifts from anon;

-- live notifications (row level security still decides who receives what)
do $$ begin
  begin alter publication supabase_realtime add table public.chess_friends; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.chess_gifts; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.chess_invites; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.chess_duels; exception when duplicate_object then null; end;
end $$;
