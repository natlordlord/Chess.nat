-- Tipprunden (own tipping rounds with chosen competitions and their own leaderboard),
-- live pushes with everyone's standing, and the "other score" kept on exact-score tips.
-- Applied as migrations tipp_groups, tipp_live_push, tipp_place_score, tipp_live_other_score.

create table if not exists public.tipp_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  name text not null,
  owner uuid not null,
  comps text[] not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists public.tipp_members (
  group_id uuid not null references public.tipp_groups(id) on delete cascade,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
alter table public.tipp_groups enable row level security;
alter table public.tipp_members enable row level security;

-- does an event belong to a round? comps: nt, bay, ger.1, uefa.champions, ger.dfb_pokal, fight, hb
create or replace function public.tipp_match(p_comp text, p_home text, p_away text, p_comps text[])
 returns boolean language sql immutable set search_path to '' as $$
  select coalesce(array_length(p_comps, 1), 0) = 0
    or p_comp = any(p_comps)
    or ('fight' = any(p_comps) and p_comp in ('ufc', 'oktagon', 'box'))
    or ('bay' = any(p_comps) and (p_home ilike '%bayern%' or p_away ilike '%bayern%'))
    or ('nt' = any(p_comps) and (p_home = 'Deutschland' or p_away = 'Deutschland') and p_comp in ('nt', 'hb'))
$$;

create or replace function public.tipp_group_save(p_id uuid, p_name text, p_comps text[])
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare uid uuid := auth.uid(); g public.tipp_groups;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_id is null then
    insert into public.tipp_groups (name, owner, comps) values (left(coalesce(nullif(trim(p_name), ''), 'Tipprunde'), 40), uid, coalesce(p_comps, '{}')) returning * into g;
    insert into public.tipp_members (group_id, user_id) values (g.id, uid) on conflict do nothing;
  else
    update public.tipp_groups set name = left(coalesce(nullif(trim(p_name), ''), name), 40), comps = coalesce(p_comps, comps) where id = p_id and owner = uid returning * into g;
    if not found then raise exception 'not yours'; end if;
  end if;
  return jsonb_build_object('id', g.id, 'code', g.code, 'name', g.name, 'comps', g.comps);
end $$;

create or replace function public.tipp_join(p_code text)
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare uid uuid := auth.uid(); g public.tipp_groups;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into g from public.tipp_groups where code = lower(p_code);
  if not found then return null; end if;
  insert into public.tipp_members (group_id, user_id) values (g.id, uid) on conflict do nothing;
  return jsonb_build_object('id', g.id, 'code', g.code, 'name', g.name, 'comps', g.comps);
end $$;

create or replace function public.tipp_leave(p_id uuid)
 returns void language sql security definer set search_path to '' as $$
  delete from public.tipp_members where group_id = p_id and user_id = auth.uid();
$$;

create or replace function public.tipp_groups_mine()
 returns table(id uuid, code text, name text, owner uuid, comps text[], members uuid[])
 language sql stable security definer set search_path to '' as $$
  select g.id, g.code, g.name, g.owner, g.comps, (select array_agg(m2.user_id order by m2.joined_at) from public.tipp_members m2 where m2.group_id = g.id)
  from public.tipp_groups g join public.tipp_members m on m.group_id = g.id and m.user_id = auth.uid()
  order by g.created_at;
$$;

-- the round's leaderboard: all members (also those without tips) and the KI, only the round's events
create or replace function public.tipp_board_group(p_group uuid)
 returns table(uid uuid, bot text, name text, avatar jsonb, profit integer, staked integer, won integer, lost integer, open integer, n integer)
 language plpgsql stable security definer set search_path to '' as $$
declare cs text[];
begin
  if not exists (select 1 from public.tipp_members where group_id = p_group and user_id = auth.uid()) then return; end if;
  select comps into cs from public.tipp_groups where id = p_group;
  return query
  with t as (
    select t.* from public.tipp_tips t join public.tipp_events e on e.id = t.event_id
    where public.tipp_match(e.comp, e.home, e.away, cs) and (t.bot = 'ki' or t.user_id in (select user_id from public.tipp_members where group_id = p_group))
  ), people as (
    select m.user_id as u, null::text as b from public.tipp_members m where m.group_id = p_group
    union all select null::uuid, 'ki'
  )
  select pe.u, pe.b, coalesce(p.name, case when pe.b = 'ki' then 'Nat-KI' else '?' end), p.avatar,
    coalesce(sum(case when t.status in ('won','lost','void') then t.payout - t.stake else 0 end), 0)::int,
    coalesce(sum(t.stake), 0)::int,
    count(t.id) filter (where t.status = 'won')::int, count(t.id) filter (where t.status = 'lost')::int, count(t.id) filter (where t.status = 'open')::int, count(t.id)::int
  from people pe
  left join public.chess_players p on p.id = pe.u
  left join t on (pe.b = 'ki' and t.bot = 'ki') or (pe.u is not null and t.user_id = pe.u)
  group by pe.u, pe.b, p.name, p.avatar
  order by 5 desc, 7 desc;
end $$;

-- placing a tip; for "other score" the score the tipster had in mind goes into the label
drop function if exists public.tipp_place(text, text, text, integer);
create or replace function public.tipp_place(p_event text, p_market text, p_pick text, p_stake integer, p_score text default null)
 returns jsonb language plpgsql security definer set search_path to '' as $$
declare ev public.tipp_events; m jsonb; o jsonb; uid uuid := auth.uid(); tid bigint; lab text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if p_stake is null or p_stake < 1 or p_stake > 1000000 then raise exception 'bad stake'; end if;
  select * into ev from public.tipp_events where id = p_event;
  if not found then raise exception 'no such event'; end if;
  if ev.state <> 'pre' or ev.start_at <= now() then raise exception 'closed'; end if;
  select x into m from jsonb_array_elements(ev.markets) x where x->>'k' = p_market limit 1;
  if m is null then raise exception 'no such market'; end if;
  select y into o from jsonb_array_elements(m->'o') y where y->>'p' = p_pick limit 1;
  if o is null then raise exception 'no such pick'; end if;
  lab := coalesce(m->>'t','') || ': ' || coalesce(o->>'l','');
  if p_market = 'cs' and p_pick = 'x' and p_score ~ '^[0-9]{1,2}-[0-9]{1,2}$' then lab := lab || ' · ' || replace(p_score, '-', ':'); end if;
  insert into public.tipp_tips (user_id, event_id, market, pick, label, stake, odds)
    values (uid, p_event, p_market, p_pick, lab, p_stake, (o->>'q')::numeric)
    returning id into tid;
  return jsonb_build_object('id', tid, 'odds', (o->>'q')::numeric);
end $$;
revoke all on function public.tipp_place(text, text, text, integer, text) from public, anon;
grant execute on function public.tipp_place(text, text, text, integer, text) to authenticated;

-- live push after a goal or at half time: "Du: ⏳ noch drin (2:1) · 🎯 Wolf genau richtig · 💀 Nathan raus"
create or replace function public.tipp_live(p_event text, p_title text)
 returns integer language plpgsql security definer set search_path to '' as $$
declare ev public.tipp_events; r record; me_line text; others text; n int := 0; res text;
begin
  if coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role' is distinct from 'service_role' then raise exception 'forbidden'; end if;
  select * into ev from public.tipp_events where id = p_event; if not found then return 0; end if;
  res := case when ev.score_h > ev.score_a then 'h' when ev.score_h = ev.score_a then 'd' else 'a' end;
  create temp table if not exists tipp_live_st (user_id uuid, nm text, ic text, word text) on commit drop; truncate tipp_live_st;
  insert into tipp_live_st
  select s.user_id, coalesce(s.nm, '?'),
    case when s.cs is not null and split_part(s.cs, '-', 1)::int = ev.score_h and split_part(s.cs, '-', 2)::int = ev.score_a then '🎯'
         when s.cs is not null and (split_part(s.cs, '-', 1)::int < ev.score_h or split_part(s.cs, '-', 2)::int < ev.score_a) then '💀'
         when s.cs is not null then '⏳'
         when s.x is not null and s.x = res then '✅'
         when s.x is not null then '❌' end,
    case when s.cs is not null and split_part(s.cs, '-', 1)::int = ev.score_h and split_part(s.cs, '-', 2)::int = ev.score_a then 'genau richtig'
         when s.cs is not null and (split_part(s.cs, '-', 1)::int < ev.score_h or split_part(s.cs, '-', 2)::int < ev.score_a) then 'raus'
         when s.cs is not null then 'noch drin (' || replace(s.cs, '-', ':') || ')'
         when s.x is not null and s.x = res then 'liegt richtig'
         when s.x is not null then 'liegt falsch' end
  from (select t.user_id, max(p.name) nm,
          max(case when t.market = 'cs' and t.pick ~ '^[0-9]+-[0-9]+$' then t.pick
                   when t.market = 'cs' and t.pick = 'x' and t.label ~ '[0-9]+:[0-9]+$' then replace(substring(t.label from '([0-9]+:[0-9]+)$'), ':', '-') end) cs,
          max(case when t.market = '1x2' then t.pick end) x
        from public.tipp_tips t left join public.chess_players p on p.id = t.user_id
        where t.event_id = p_event and t.user_id is not null group by t.user_id) s;
  for r in select distinct user_id from public.tipp_tips where event_id = p_event and user_id is not null loop
    select case when ic is not null then 'Du: ' || ic || ' ' || word else null end into me_line from tipp_live_st where user_id = r.user_id;
    select string_agg(ic || ' ' || nm || ' ' || word, ' · ' order by case ic when '🎯' then 0 when '✅' then 1 when '⏳' then 2 when '❌' then 3 else 4 end)
      into others from (select * from tipp_live_st where user_id <> r.user_id and ic is not null limit 6) x;
    perform private.push(r.user_id, 'tipp', p_title, concat_ws(' · ', me_line, others), '/#tipp'); n := n + 1;
  end loop;
  return n;
end $$;

-- After kick-off: what the people in my tipping rounds (and the KI) tipped on this game (migration tipp_event_tips)
create or replace function public.tipp_event_tips(p_event text)
 returns table(uid uuid, bot text, name text, avatar jsonb, cs text, x text, status text, net integer)
 language plpgsql stable security definer set search_path to ''
as $$
declare me uuid := auth.uid(); ev public.tipp_events;
begin
  if me is null then return; end if;
  select * into ev from public.tipp_events where id = p_event; if not found then return; end if;
  if ev.state = 'pre' and ev.start_at > now() then return; end if;
  return query
  with people as (
    select distinct m2.user_id u from public.tipp_members m1 join public.tipp_members m2 on m2.group_id = m1.group_id where m1.user_id = me
    union select me
  ), t as (
    select t.user_id, t.bot, t.market, t.pick, t.label, t.status, t.payout, t.stake from public.tipp_tips t
    where t.event_id = p_event and (t.bot = 'ki' or t.user_id in (select u from people))
  )
  select t.user_id, max(t.bot), coalesce(max(p.name), case when max(t.bot) = 'ki' then 'Nat-KI' else '?' end), (array_agg(p.avatar))[1],
    max(case when t.market = 'cs' and t.pick ~ '^[0-9]+-[0-9]+$' then replace(t.pick, '-', ':') when t.market = 'cs' and t.label ~ '[0-9]+:[0-9]+$' then substring(t.label from '([0-9]+:[0-9]+)$') end),
    max(case when t.market in ('1x2', 'win') then t.pick end),
    case when bool_or(t.status = 'open') then 'open' when bool_or(t.status = 'won') then 'won' else max(t.status) end,
    coalesce(sum(case when t.status in ('won', 'lost', 'void') then t.payout - t.stake else 0 end), 0)::int
  from t left join public.chess_players p on p.id = t.user_id
  group by t.user_id, t.bot
  order by 7, 1;
end $$;
revoke all on function public.tipp_event_tips(text) from public, anon;
grant execute on function public.tipp_event_tips(text) to authenticated;
