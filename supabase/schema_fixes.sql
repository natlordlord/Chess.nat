-- Corrections to a player's progress (e.g. XP farmed with a trick). The app reads its own rows once and subtracts them; additive.
create table if not exists public.chess_fixes (
  id         text not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  xp         int not null default 0,
  pz         int not null default 0,
  note       text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.chess_fixes enable row level security;
drop policy if exists "fixes: read own" on public.chess_fixes;
create policy "fixes: read own" on public.chess_fixes for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.chess_fixes to authenticated;
-- applied on 2026-11-08: one row for a player who skipped 789 rated puzzles in about 4 minutes (xp 1578, pz 789)
