-- Chess.nat ranked online play: a matchmaking queue, real games between players, and a rating per pace (bullet, blitz, rapid).
-- Additive only. The server owns the ratings: players can read them, only these functions change them.
--
-- Rating system: Glicko (the family lichess uses). Like Elo, a 100-point gap means the stronger player is expected to score about 64 %,
-- 200 points about 76 %, 400 points about 91 %. On top of Elo every player has an uncertainty (RD): new or long-absent players move fast,
-- settled players move slowly. Matchmaking looks for the closest rating first and only widens the search the longer you wait.

create table if not exists public.chess_ratings (
  user_id    uuid not null references auth.users (id) on delete cascade,
  cat        text not null check (cat in ('bullet', 'blitz', 'rapid')),
  r          double precision not null default 1200,
  rd         double precision not null default 350,
  games      int not null default 0,
  w          int not null default 0,
  d          int not null default 0,
  l          int not null default 0,
  peak       int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, cat)
);
alter table public.chess_ratings enable row level security;
drop policy if exists "ratings: signed-in can read" on public.chess_ratings;
create policy "ratings: signed-in can read" on public.chess_ratings for select to authenticated using (true);

create table if not exists public.chess_queue (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  tc        text not null,
  cat       text not null,
  r         double precision not null,
  joined_at timestamptz not null default now(),
  seen_at   timestamptz not null default now(),
  match_id  uuid
);
alter table public.chess_queue enable row level security;
drop policy if exists "queue: own row" on public.chess_queue;
create policy "queue: own row" on public.chess_queue for select to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.chess_matches (
  id          uuid primary key default gen_random_uuid(),
  tc          text not null,
  cat         text not null,
  white       uuid not null references auth.users (id) on delete cascade,
  black       uuid not null references auth.users (id) on delete cascade,
  room        text not null,
  status      text not null default 'live' check (status in ('live', 'done', 'void', 'disputed')),
  res_w       text,
  res_b       text,
  why_w       text,
  why_b       text,
  result      text,
  why         text,
  rw_before   int, rb_before int, rw_after int, rb_after int,
  created_at  timestamptz not null default now(),
  reported_at timestamptz,
  finished_at timestamptz
);
create index if not exists chess_matches_white on public.chess_matches (white, created_at desc);
create index if not exists chess_matches_black on public.chess_matches (black, created_at desc);
alter table public.chess_matches enable row level security;
drop policy if exists "matches: signed-in can read" on public.chess_matches;
create policy "matches: signed-in can read" on public.chess_matches for select to authenticated using (true);

-- the pace of a time control: base minutes + increment seconds, estimated over 40 moves (like lichess)
create or replace function private.ranked_cat(tc text) returns text language sql immutable set search_path = '' as $$
  select case when tc not in ('1+0', '2+1', '3+0', '3+2', '5+0', '10+0', '15+10') then null
    when split_part(tc, '+', 1)::int * 60 + split_part(tc, '+', 2)::int * 40 < 180 then 'bullet'
    when split_part(tc, '+', 1)::int * 60 + split_part(tc, '+', 2)::int * 40 < 480 then 'blitz'
    else 'rapid' end
$$;

-- a player's rating row, created on first use; the uncertainty grows again while you don't play (back to 350 after about a year)
create or replace function private.ranked_row(uid uuid, c text, hint int) returns public.chess_ratings language plpgsql security definer set search_path = '' as $$
declare x public.chess_ratings;
begin
  insert into public.chess_ratings (user_id, cat, r, rd, peak) values (uid, c, greatest(400, least(2000, coalesce(hint, 1200))), 350, 0)
    on conflict (user_id, cat) do nothing;
  select * into x from public.chess_ratings where user_id = uid and cat = c;
  x.rd := least(350, sqrt(x.rd * x.rd + 330 * extract(epoch from now() - x.updated_at) / 86400));
  return x;
end $$;

-- Glicko update for one game: me against them, s = my score (1, 0.5, 0)
create or replace function private.glicko(r double precision, rd double precision, ro double precision, rdo double precision, s double precision, out nr double precision, out nrd double precision)
language plpgsql immutable set search_path = '' as $$
declare q double precision := ln(10) / 400; g double precision; e double precision; d2 double precision;
begin
  g := 1 / sqrt(1 + 3 * q * q * rdo * rdo / (pi() * pi()));
  e := 1 / (1 + power(10, -g * (r - ro) / 400));
  d2 := 1 / (q * q * g * g * e * (1 - e));
  nr := r + q / (1 / (rd * rd) + 1 / d2) * g * (s - e);
  nrd := greatest(45, sqrt(1 / (1 / (rd * rd) + 1 / d2)));
end $$;

-- settle a match: both ratings change at once
create or replace function private.ranked_finish(mid uuid, res text, why text) returns void language plpgsql security definer set search_path = '' as $$
declare m public.chess_matches; a public.chess_ratings; b public.chess_ratings; sw double precision; ga record; gb record;
begin
  select * into m from public.chess_matches where id = mid for update;
  if m.status <> 'live' then return; end if;
  a := private.ranked_row(m.white, m.cat, null); b := private.ranked_row(m.black, m.cat, null);
  sw := case res when '1-0' then 1 when '0-1' then 0 else 0.5 end;
  select * into ga from private.glicko(a.r, a.rd, b.r, b.rd, sw);
  select * into gb from private.glicko(b.r, b.rd, a.r, a.rd, 1 - sw);
  update public.chess_ratings set r = ga.nr, rd = ga.nrd, games = games + 1, w = w + (sw = 1)::int, d = d + (sw = 0.5)::int, l = l + (sw = 0)::int,
    peak = greatest(peak, round(ga.nr)::int), updated_at = now() where user_id = m.white and cat = m.cat;
  update public.chess_ratings set r = gb.nr, rd = gb.nrd, games = games + 1, w = w + (sw = 0)::int, d = d + (sw = 0.5)::int, l = l + (sw = 1)::int,
    peak = greatest(peak, round(gb.nr)::int), updated_at = now() where user_id = m.black and cat = m.cat;
  update public.chess_matches set status = 'done', result = res, why = ranked_finish.why, rw_before = round(a.r), rb_before = round(b.r),
    rw_after = round(ga.nr), rb_after = round(gb.nr), finished_at = now() where id = mid;
end $$;

-- a claim that waited too long for the other side counts (the other player left or lost the connection)
create or replace function private.ranked_settle_stale(uid uuid) returns void language plpgsql security definer set search_path = '' as $$
declare m record;
begin
  for m in select * from public.chess_matches where status = 'live' and (white = uid or black = uid) and reported_at < now() - interval '3 minutes' loop
    if m.res_w is not null and m.res_b is null then perform private.ranked_finish(m.id, m.res_w, m.why_w);
    elsif m.res_b is not null and m.res_w is null then perform private.ranked_finish(m.id, m.res_b, m.why_b); end if;
  end loop;
  -- games nobody ever reported are dropped after a day
  update public.chess_matches set status = 'void' where status = 'live' and created_at < now() - interval '1 day' and (white = uid or black = uid);
end $$;

-- join the queue (or keep your place: call it every couple of seconds while you search)
create or replace function public.ranked_queue(tc text, hint int default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c text := private.ranked_cat(tc); mine public.chess_ratings; q public.chess_queue; o public.chess_queue; m public.chess_matches;
  waited double precision; win double precision; wht uuid; blk uuid; n int;
begin
  if me is null then raise exception 'sign in first'; end if;
  if c is null then raise exception 'unknown time control'; end if;
  perform private.ranked_settle_stale(me);
  delete from public.chess_queue where seen_at < now() - interval '20 seconds' and match_id is null;
  mine := private.ranked_row(me, c, hint);
  insert into public.chess_queue as x (user_id, tc, cat, r) values (me, ranked_queue.tc, c, mine.r)
    on conflict (user_id) do update set seen_at = now(), r = excluded.r,
      tc = excluded.tc, cat = excluded.cat, joined_at = case when x.tc = excluded.tc and x.match_id is null then x.joined_at else now() end,
      match_id = case when x.tc = excluded.tc then x.match_id else null end;
  select * into q from public.chess_queue where user_id = me for update;
  if q.match_id is not null then
    select * into m from public.chess_matches where id = q.match_id;
    if m.status = 'live' and m.created_at > now() - interval '2 minutes' then
      return jsonb_build_object('status', 'matched', 'match', to_jsonb(m));
    end if;
    update public.chess_queue set match_id = null, joined_at = now() where user_id = me; q.match_id := null;
  end if;
  waited := extract(epoch from now() - q.joined_at);
  win := least(400, 50 + 25 * waited);
  -- the closest player whose own search window also reaches me
  select * into o from public.chess_queue x where x.tc = ranked_queue.tc and x.user_id <> me and x.match_id is null and x.seen_at > now() - interval '20 seconds'
    and abs(x.r - q.r) <= win and abs(x.r - q.r) <= least(400, 50 + 25 * extract(epoch from now() - x.joined_at))
    order by abs(x.r - q.r), x.joined_at limit 1 for update skip locked;
  if o.user_id is not null then
    -- colours: whoever had white less often in their last games gets white
    if (select count(*) from public.chess_matches where white = me and created_at > now() - interval '7 days')
       - (select count(*) from public.chess_matches where black = me and created_at > now() - interval '7 days')
       <= (select count(*) from public.chess_matches where white = o.user_id and created_at > now() - interval '7 days')
       - (select count(*) from public.chess_matches where black = o.user_id and created_at > now() - interval '7 days')
    then wht := me; blk := o.user_id; else wht := o.user_id; blk := me; end if;
    insert into public.chess_matches (tc, cat, white, black, room) values (ranked_queue.tc, c, wht, blk, 'r' || substr(md5(random()::text || clock_timestamp()::text), 1, 9))
      returning * into m;
    update public.chess_queue set match_id = m.id, seen_at = now() where user_id in (me, o.user_id);
    return jsonb_build_object('status', 'matched', 'match', to_jsonb(m));
  end if;
  select count(*) into n from public.chess_queue where chess_queue.tc = ranked_queue.tc and match_id is null and seen_at > now() - interval '20 seconds';
  return jsonb_build_object('status', 'waiting', 'waited', round(waited), 'window', round(win), 'searching', n, 'r', round(mine.r), 'rd', round(mine.rd));
end $$;

create or replace function public.ranked_leave() returns void language sql security definer set search_path = '' as $$
  delete from public.chess_queue where user_id = auth.uid();
$$;

-- both players report the result; when they agree the ratings change. A loss you report yourself counts at once.
create or replace function public.ranked_report(mid uuid, res text, why text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); m public.chess_matches; mine_loss boolean;
begin
  if res not in ('1-0', '0-1', '1/2-1/2', 'void') then raise exception 'bad result'; end if;
  select * into m from public.chess_matches where id = mid for update;
  if m.id is null or me not in (m.white, m.black) then raise exception 'not your game'; end if;
  delete from public.chess_queue where user_id = me;
  if m.status = 'live' then
    if res = 'void' then
      -- nobody showed up / no move was made: the game doesn't count
      update public.chess_matches set status = 'void', why = coalesce(ranked_report.why, 'no start'), finished_at = now() where id = mid;
    else
      if me = m.white then update public.chess_matches set res_w = res, why_w = ranked_report.why, reported_at = coalesce(reported_at, now()) where id = mid;
      else update public.chess_matches set res_b = res, why_b = ranked_report.why, reported_at = coalesce(reported_at, now()) where id = mid; end if;
      select * into m from public.chess_matches where id = mid;
      mine_loss := (me = m.white and res = '0-1') or (me = m.black and res = '1-0');
      if mine_loss then perform private.ranked_finish(mid, res, ranked_report.why);
      elsif m.res_w is not null and m.res_b is not null then
        if m.res_w = m.res_b then perform private.ranked_finish(mid, m.res_w, coalesce(m.why_w, m.why_b));
        else update public.chess_matches set status = 'disputed', finished_at = now() where id = mid; end if;
      end if;
    end if;
  end if;
  select * into m from public.chess_matches where id = mid;
  return to_jsonb(m);
end $$;

-- my ratings, and the best players of a pace
create or replace function public.ranked_me() returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then return '[]'::jsonb; end if;
  perform private.ranked_settle_stale(me);
  return coalesce((select jsonb_agg(jsonb_build_object('cat', cat, 'r', round(r), 'rd', round(least(350, sqrt(rd * rd + 330 * extract(epoch from now() - updated_at) / 86400)))), 'games', games, 'w', w, 'd', d, 'l', l, 'peak', peak))
    from public.chess_ratings where user_id = me), '[]'::jsonb);
end $$;

create or replace function public.ranked_top(c text, n int default 50) returns jsonb language sql security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x.r desc), '[]'::jsonb) from (
    select r.user_id as id, p.name, round(r.r) as r, r.games from public.chess_ratings r join public.chess_players p on p.id = r.user_id
    where r.cat = c and r.games >= 5 order by r.r desc limit least(n, 100)) x
$$;

-- how many people are looking for a game right now, per time control
create or replace function public.ranked_lobby() returns jsonb language sql security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(tc, n), '{}'::jsonb) from (select tc, count(*) n from public.chess_queue where match_id is null and seen_at > now() - interval '20 seconds' group by tc) x
$$;

revoke all on function public.ranked_queue(text, int), public.ranked_leave(), public.ranked_report(uuid, text, text), public.ranked_me(), public.ranked_top(text, int), public.ranked_lobby() from public, anon;
grant execute on function public.ranked_queue(text, int), public.ranked_leave(), public.ranked_report(uuid, text, text), public.ranked_me(), public.ranked_top(text, int), public.ranked_lobby() to authenticated;
