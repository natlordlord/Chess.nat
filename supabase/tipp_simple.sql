-- Tippspiel, simple: one result tip per person and game (football score, or the winner of a UFC title fight),
-- changeable until kick-off. Points like Kicktipp: exact 4, right goal difference 3, right winner/draw 2,
-- UFC winner 3. Points are worked out from the final score, so nothing has to be "settled".
-- The old Natcoin bets (tipp_tips) stay in the database; their open stakes are refunded.

create table if not exists public.tipp_picks (
  id bigint generated always as identity primary key,
  user_id uuid,
  bot text,
  event_id text not null references public.tipp_events(id) on delete cascade,
  sh int check (sh between 0 and 20),
  sa int check (sa between 0 and 20),
  w text check (w in ('a', 'b')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((user_id is null) <> (bot is null))
);
create unique index if not exists tipp_picks_user_ev on public.tipp_picks (user_id, event_id) where user_id is not null;
create unique index if not exists tipp_picks_bot_ev on public.tipp_picks (bot, event_id) where bot is not null;
create index if not exists tipp_picks_ev on public.tipp_picks (event_id);
alter table public.tipp_picks enable row level security;
drop policy if exists "tipp picks: own, or everyone's once it started" on public.tipp_picks;
create policy "tipp picks: own, or everyone's once it started" on public.tipp_picks for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.tipp_events e where e.id = event_id and (e.state <> 'pre' or e.start_at <= now())));

-- the points for one tip against a result (null while there is no result)
create or replace function public.tipp_pts(p_sport text, sh int, sa int, w text, rh int, ra int, rw text)
returns int language sql immutable set search_path = '' as $$
  select case
    when p_sport = 'mma' then case when w is null or rw is null then null when w = rw then 3 else 0 end
    when sh is null or sa is null or rh is null or ra is null then null
    when sh = rh and sa = ra then 4
    when sign(sh - sa) = sign(rh - ra) and rh <> ra and sh - sa = rh - ra then 3
    when sign(sh - sa) = sign(rh - ra) then 2
    else 0 end $$;

-- the score that counts: after 90 minutes when the server stored it (cup games with extra time), else the score
create or replace function public.tipp_ev_pts(e public.tipp_events, sh int, sa int, w text, p_final boolean default true)
returns int language sql stable set search_path = '' as $$
  select case when e.state = 'canc' then null
    when p_final and e.state <> 'post' then null
    when e.state = 'pre' then null
    else public.tipp_pts(e.sport, sh, sa, w,
      coalesce((e.meta -> 'reg' ->> 0)::int, e.score_h), coalesce((e.meta -> 'reg' ->> 1)::int, e.score_a),
      case when e.state = 'post' then e.meta ->> 'winner' end) end $$;

-- place or change my tip
create or replace function public.tipp_pick(p_event text, p_h int default null, p_a int default null, p_w text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); ev public.tipp_events; r public.tipp_picks;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into ev from public.tipp_events where id = p_event;
  if not found then raise exception 'no such event'; end if;
  if ev.state <> 'pre' or ev.start_at <= now() then raise exception 'closed'; end if;
  if ev.sport = 'fb' then
    if p_h is null or p_a is null or p_h not between 0 and 20 or p_a not between 0 and 20 then raise exception 'bad score'; end if;
    p_w := null;
  elsif ev.sport = 'mma' then
    if p_w is null or p_w not in ('a', 'b') then raise exception 'bad pick'; end if;
    p_h := null; p_a := null;
  else raise exception 'not tippable'; end if;
  insert into public.tipp_picks (user_id, event_id, sh, sa, w) values (uid, p_event, p_h, p_a, p_w)
    on conflict (user_id, event_id) where user_id is not null do update set sh = excluded.sh, sa = excluded.sa, w = excluded.w, updated_at = now()
    returning * into r;
  return jsonb_build_object('event_id', r.event_id, 'sh', r.sh, 'sa', r.sa, 'w', r.w, 'updated_at', r.updated_at);
end $$;
revoke all on function public.tipp_pick(text, int, int, text) from public, anon;
grant execute on function public.tipp_pick(text, int, int, text) to authenticated;

-- the table: points from finished games, everyone who tipped plus Nat-KI
create or replace function public.tipp_table()
returns table (uid uuid, bot text, name text, avatar jsonb, pts int, exact int, n int, open int)
language sql security definer set search_path = '' stable as $$
  with x as (
    select p.user_id, p.bot, e.sport, e.state, public.tipp_ev_pts(e, p.sh, p.sa, p.w) pts
    from public.tipp_picks p join public.tipp_events e on e.id = p.event_id
  )
  select x.user_id, x.bot, coalesce(max(pl.name), case when x.bot = 'ki' then 'Nat-KI' else '?' end), (array_agg(pl.avatar))[1],
    coalesce(sum(x.pts), 0)::int,
    (count(*) filter (where x.sport = 'fb' and x.pts = 4) + count(*) filter (where x.sport = 'mma' and x.pts = 3))::int,
    count(x.pts)::int,
    count(*) filter (where x.pts is null and x.state <> 'canc')::int
  from x left join public.chess_players pl on pl.id = x.user_id
  group by x.user_id, x.bot
  order by 5 desc, 6 desc, 7 asc;
$$;
grant execute on function public.tipp_table() to authenticated, anon;

-- everyone's tips on one game, once it has started (live: the points as it stands)
create or replace function public.tipp_event_picks(p_event text)
returns table (uid uuid, bot text, name text, avatar jsonb, sh int, sa int, w text, pts int, final boolean)
language plpgsql security definer set search_path = '' stable as $$
declare ev public.tipp_events;
begin
  select * into ev from public.tipp_events where id = p_event; if not found then return; end if;
  if ev.state = 'pre' and ev.start_at > now() then
    return query select p.user_id, p.bot, coalesce(pl.name, '?'), pl.avatar, p.sh, p.sa, p.w, null::int, false
      from public.tipp_picks p left join public.chess_players pl on pl.id = p.user_id where p.event_id = p_event and p.user_id = auth.uid();
    return;
  end if;
  return query select p.user_id, p.bot, coalesce(pl.name, case when p.bot = 'ki' then 'Nat-KI' else '?' end), pl.avatar, p.sh, p.sa, p.w,
      public.tipp_ev_pts(ev, p.sh, p.sa, p.w, false), ev.state = 'post'
    from public.tipp_picks p left join public.chess_players pl on pl.id = p.user_id
    where p.event_id = p_event order by 8 desc nulls last, 3;
end $$;
grant execute on function public.tipp_event_picks(text) to authenticated;

-- pushes (server only): kick-off, reminder, goals with the live points, final whistle with the points
create or replace function public.tipp_notify(p_event text, p_title text, p_body text)
returns int language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  if coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role' is distinct from 'service_role' then raise exception 'forbidden'; end if;
  for r in select distinct user_id from public.tipp_picks where event_id = p_event and user_id is not null loop
    perform private.push(r.user_id, 'tipp', p_title, p_body, '/#tipp'); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.tipp_notify(text, text, text) from public, anon, authenticated;

create or replace function public.tipp_remind(p_event text, p_title text, p_body text)
returns int language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  if coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role' is distinct from 'service_role' then raise exception 'forbidden'; end if;
  for r in select distinct user_id from public.tipp_picks where user_id is not null and updated_at > now() - interval '30 days'
           and user_id not in (select user_id from public.tipp_picks where event_id = p_event and user_id is not null) loop
    perform private.push(r.user_id, 'tipp', p_title, p_body, '/#tipp'); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.tipp_remind(text, text, text) from public, anon, authenticated;

-- one line per tipster: "2:1 · 🎯 4" (live: the points if it ended now)
create or replace function public.tipp_lines(p_event text, p_final boolean)
returns table (user_id uuid, nm text, tip text, pts int)
language sql stable security definer set search_path = '' as $$
  select p.user_id, coalesce(pl.name, case when p.bot = 'ki' then 'Nat-KI' else '?' end),
    case when e.sport = 'mma' then split_part(case when p.w = 'a' then e.home else e.away end, ' ', -1) else p.sh || ':' || p.sa end,
    public.tipp_ev_pts(e, p.sh, p.sa, p.w, p_final)
  from public.tipp_picks p join public.tipp_events e on e.id = p.event_id left join public.chess_players pl on pl.id = p.user_id
  where p.event_id = p_event;
$$;
revoke all on function public.tipp_lines(text, boolean) from public, anon, authenticated;

create or replace function public.tipp_live(p_event text, p_title text)
returns int language plpgsql security definer set search_path = '' as $$
declare r record; me_line text; others text; n int := 0;
begin
  if coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role' is distinct from 'service_role' then raise exception 'forbidden'; end if;
  for r in select * from public.tipp_lines(p_event, false) where user_id is not null loop
    me_line := 'Du: ' || r.tip || case when r.pts = 4 then ' · 🎯 gerade 4 P.' when r.pts > 0 then ' · gerade ' || r.pts || ' P.' else ' · gerade 0 P.' end;
    select string_agg(l.nm || ' ' || l.tip, ' · ' order by l.pts desc nulls last, l.nm) into others
      from (select * from public.tipp_lines(p_event, false) x where x.user_id is distinct from r.user_id limit 6) l;
    perform private.push(r.user_id, 'tipp', p_title, concat_ws(' · ', me_line, others), '/#tipp'); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.tipp_live(text, text) from public, anon, authenticated;

-- final whistle: everyone with a tip gets their points once
create or replace function public.tipp_final(p_event text)
returns int language plpgsql security definer set search_path = '' as $$
declare ev public.tipp_events; r record; others text; n int := 0; title text;
begin
  if coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role' is distinct from 'service_role' then raise exception 'forbidden'; end if;
  select * into ev from public.tipp_events where id = p_event for update; if not found or ev.state <> 'post' then return 0; end if;
  if coalesce((ev.meta ->> 'pp')::boolean, false) then return 0; end if;
  update public.tipp_events set meta = meta || '{"pp": true}'::jsonb where id = p_event;
  title := case when ev.sport = 'mma' then '🥊 ' || case ev.meta ->> 'winner' when 'a' then ev.home when 'b' then ev.away else 'Kein Sieger' end || ' gewinnt'
    else '🏁 ' || ev.home || ' ' || coalesce((ev.meta -> 'reg' ->> 0), ev.score_h::text) || ':' || coalesce((ev.meta -> 'reg' ->> 1), ev.score_a::text) || ' ' || ev.away end;
  for r in select * from public.tipp_lines(p_event, true) where user_id is not null loop
    select string_agg(l.nm || ' ' || coalesce(l.pts, 0), ' · ' order by l.pts desc nulls last, l.nm) into others
      from (select * from public.tipp_lines(p_event, true) x where x.user_id is distinct from r.user_id limit 6) l;
    perform private.push(r.user_id, 'tipp', title,
      concat_ws(' · ', 'Du: ' || r.tip || case when r.pts = 4 or (ev.sport = 'mma' and r.pts = 3) then ' → 🎯 +' || r.pts || ' Punkte' when r.pts > 0 then ' → +' || r.pts || ' Punkte' else ' → 0 Punkte' end, others), '/#tipp');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.tipp_final(text) from public, anon, authenticated;

-- move the open bets over: per person and game the last exact score (else the winner), then refund the stakes
insert into public.tipp_picks (user_id, bot, event_id, sh, sa, w, created_at, updated_at)
select distinct on (coalesce(x.user_id::text, x.bot), x.event_id) x.user_id, x.bot, x.event_id, x.sh, x.sa, x.w, x.created_at, x.created_at
from (
  select t.user_id, t.bot, t.event_id, t.created_at, e.sport,
    case when e.sport <> 'fb' then null
         when t.market = 'cs' and t.pick ~ '^[0-9]+-[0-9]+$' then split_part(t.pick, '-', 1)::int
         when t.market = 'cs' and t.label ~ '[0-9]+:[0-9]+$' then split_part(substring(t.label from '([0-9]+:[0-9]+)$'), ':', 1)::int
         when t.market = '1x2' then case t.pick when 'h' then 1 when 'd' then 1 else 0 end end sh,
    case when e.sport <> 'fb' then null
         when t.market = 'cs' and t.pick ~ '^[0-9]+-[0-9]+$' then split_part(t.pick, '-', 2)::int
         when t.market = 'cs' and t.label ~ '[0-9]+:[0-9]+$' then split_part(substring(t.label from '([0-9]+:[0-9]+)$'), ':', 2)::int
         when t.market = '1x2' then case t.pick when 'h' then 0 when 'd' then 1 else 1 end end sa,
    case when e.sport = 'mma' and t.market = 'win' and t.pick in ('a', 'b') then t.pick end w,
    case when t.market = 'cs' then 2 when t.market in ('1x2', 'win') then 1 else 0 end prio
  from public.tipp_tips t join public.tipp_events e on e.id = t.event_id
  where t.status = 'open' and e.state = 'pre' and e.sport in ('fb', 'mma')
) x
where (x.sport = 'fb' and x.sh is not null and x.sa is not null) or (x.sport = 'mma' and x.w is not null)
order by coalesce(x.user_id::text, x.bot), x.event_id, x.prio desc, x.created_at desc
on conflict do nothing;

update public.tipp_tips set status = 'void', payout = case when user_id is not null then stake else 0 end, settled_at = now(), claimed = (user_id is null)
where status = 'open';

-- Natcoin bets are gone: an old app version that still tries one gets a clear error (no stake is taken)
create or replace function public.tipp_place(p_event text, p_market text, p_pick text, p_stake integer, p_score text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Das Tippspiel ist neu: bitte App neu öffnen.';
end $$;

-- only UFC title fights count (meta.title, set by the edge function): drop tips on the small fights; tipp_pick
-- now also refuses a fight without meta.title (see the live definition: "elsif ev.sport = 'mma' and title")
delete from public.tipp_picks p using public.tipp_events e
where e.id = p.event_id and e.sport = 'mma' and not coalesce((e.meta ->> 'title')::boolean, false);
