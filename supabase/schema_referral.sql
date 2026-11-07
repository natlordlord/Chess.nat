-- Invite links: who brought this player (set once when the player is created, never changed afterwards).
-- The inviter earns the Recruiter trophy once the invited friend has accepted the friendship and played them.
alter table public.chess_players add column if not exists referred_by uuid references public.chess_players(id) on delete set null;
grant insert (referred_by) on public.chess_players to authenticated;
create index if not exists chess_players_referred_by_idx on public.chess_players(referred_by);
alter table public.chess_players drop constraint if exists chess_players_ref_not_self;
alter table public.chess_players add constraint chess_players_ref_not_self check (referred_by is null or referred_by <> id);
