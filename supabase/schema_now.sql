-- "Is in a game right now": what a player is doing at this moment (a party lobby with its code, a puzzle, a chess game).
-- One row per player, rewritten by the app every few seconds while something is going on and removed when it ends;
-- the app treats a row older than 90 seconds as gone. Only the player and their accepted friends can read it.
create table if not exists public.chess_now (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  what jsonb not null check (pg_column_size(what) < 600),
  updated_at timestamptz not null default now()
);
alter table public.chess_now enable row level security;
drop policy if exists chess_now_read on public.chess_now;
create policy chess_now_read on public.chess_now for select to authenticated using (
  user_id = (select auth.uid()) or exists (select 1 from public.chess_friends f where f.status = 'accepted'
    and f.a = least(chess_now.user_id, (select auth.uid())) and f.b = greatest(chess_now.user_id, (select auth.uid()))));
drop policy if exists chess_now_add on public.chess_now;
create policy chess_now_add on public.chess_now for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists chess_now_edit on public.chess_now;
create policy chess_now_edit on public.chess_now for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists chess_now_del on public.chess_now;
create policy chess_now_del on public.chess_now for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.chess_now to authenticated;
