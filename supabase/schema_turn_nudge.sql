-- "Your move" push for live games: the mover's app calls this when the opponent has the app in the background.
-- Only between friends, at most one every 25 seconds per pair. The notification opens the game.
create table if not exists private.nudge_log(from_id uuid not null, to_id uuid not null, at timestamptz not null default now(), primary key (from_id, to_id));
create or replace function public.nudge_turn(target uuid, code text) returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); last timestamptz;
begin
  if me is null or target is null or me = target or code is null or code !~ '^[a-z0-9]{4,12}$' then return; end if;
  if not exists (select 1 from public.chess_friends f where f.status = 'accepted' and ((f.a = me and f.b = target) or (f.a = target and f.b = me))) then return; end if;
  select n.at into last from private.nudge_log n where n.from_id = me and n.to_id = target;
  if last is not null and last > now() - interval '25 seconds' then return; end if;
  insert into private.nudge_log(from_id, to_id, at) values (me, target, now()) on conflict (from_id, to_id) do update set at = excluded.at;
  perform private.push(target, 'invites', private.pname(me) || ' moved', 'Your move. Tap to play.', '/#g-' || code);
end $$;
revoke all on function public.nudge_turn(uuid, text) from public, anon;
grant execute on function public.nudge_turn(uuid, text) to authenticated;
