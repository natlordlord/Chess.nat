-- Tippspiel: events (synced from ESPN by the "tipp" edge function, or made by an admin), tips with Natcoins,
-- settlement with pushes (result, overtaken), leaderboard, and the AI tipster (rows with bot = 'ki').
create table if not exists public.tipp_events (
  id text primary key,
  sport text not null,               -- fb, mma, box, hb
  comp text not null,                -- ger.1, uefa.champions, ger.dfb_pokal, ufc, oktagon, box, hb
  name text,
  home text, away text, home_logo text, away_logo text, home_id text, away_id text,
  start_at timestamptz not null,
  state text not null default 'pre', -- pre, in, post, canc
  clock text,
  score_h int, score_a int,
  stats jsonb not null default '{}'::jsonb,
  markets jsonb not null default '[]'::jsonb,
  model jsonb,
  odds_src text, odds_at timestamptz,
  result jsonb,
  settled boolean not null default false,
  fav boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_at timestamptz not null default now()
);
create index if not exists tipp_events_start on public.tipp_events (start_at);
alter table public.tipp_events enable row level security;
drop policy if exists "tipp events: everyone reads" on public.tipp_events;
create policy "tipp events: everyone reads" on public.tipp_events for select using (true);

create table if not exists public.tipp_tips (
  id bigint generated always as identity primary key,
  user_id uuid,                       -- null for the AI tipster
  bot text,                           -- 'ki' for the AI tipster
  event_id text not null references public.tipp_events(id) on delete cascade,
  market text not null, pick text not null, label text,
  stake int not null check (stake between 1 and 1000000),
  odds numeric(8,2) not null,
  status text not null default 'open', -- open, won, lost, void
  payout int not null default 0,
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index if not exists tipp_tips_user on public.tipp_tips (user_id);
create index if not exists tipp_tips_event on public.tipp_tips (event_id);
alter table public.tipp_tips enable row level security;
drop policy if exists "tipp tips: signed-in read" on public.tipp_tips;
create policy "tipp tips: signed-in read" on public.tipp_tips for select to authenticated using (true);

create table if not exists public.tipp_admins (user_id uuid primary key);
alter table public.tipp_admins enable row level security;
drop policy if exists "tipp admins: read" on public.tipp_admins;
create policy "tipp admins: read" on public.tipp_admins for select to authenticated using (true);
insert into public.tipp_admins (user_id) values ('f81450e7-6054-4bbb-9cfe-e722708dd933') on conflict do nothing;

-- place a tip: odds always come from the server's markets, never from the phone
create or replace function public.tipp_place(p_event text, p_market text, p_pick text, p_stake int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ev public.tipp_events; m jsonb; o jsonb; uid uuid := auth.uid(); tid bigint;
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
  insert into public.tipp_tips (user_id, event_id, market, pick, label, stake, odds)
    values (uid, p_event, p_market, p_pick, coalesce(m->>'t','') || ': ' || coalesce(o->>'l',''), p_stake, (o->>'q')::numeric)
    returning id into tid;
  return jsonb_build_object('id', tid, 'odds', (o->>'q')::numeric);
end $$;
revoke all on function public.tipp_place(text, text, text, int) from public, anon;
grant execute on function public.tipp_place(text, text, text, int) to authenticated;

-- collect winnings (and refunds) once: the phone adds them to its wallet
create or replace function public.tipp_claim()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); tot int; n int; won int;
begin
  if uid is null then return jsonb_build_object('sum', 0, 'n', 0); end if;
  with c as (update public.tipp_tips set claimed = true where user_id = uid and not claimed and status in ('won','void') returning payout, status)
  select coalesce(sum(payout),0), count(*), count(*) filter (where status = 'won') into tot, n, won from c;
  return jsonb_build_object('sum', tot, 'n', n, 'won', won);
end $$;
revoke all on function public.tipp_claim() from public, anon;
grant execute on function public.tipp_claim() to authenticated;

-- the leaderboard: profit from settled tips, everyone plus the AI tipster
create or replace function public.tipp_board()
returns table (uid uuid, bot text, name text, avatar jsonb, profit int, staked int, won int, lost int, open int, n int)
language sql security definer set search_path = '' stable as $$
  select t.user_id, max(t.bot), coalesce(max(p.name), case when max(t.bot) = 'ki' then 'Nat-KI' else '?' end), (array_agg(p.avatar))[1],
    coalesce(sum(case when t.status in ('won','lost','void') then t.payout - t.stake else 0 end),0)::int,
    coalesce(sum(t.stake),0)::int,
    count(*) filter (where t.status = 'won')::int, count(*) filter (where t.status = 'lost')::int, count(*) filter (where t.status = 'open')::int, count(*)::int
  from public.tipp_tips t left join public.chess_players p on p.id = t.user_id
  group by t.user_id, coalesce(t.bot, '')
  order by 5 desc, 7 desc;
$$;
grant execute on function public.tipp_board() to authenticated, anon;

-- push to everyone who has a tip on this event (goals) — server only
create or replace function public.tipp_notify(p_event text, p_title text, p_body text)
returns int language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  if coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role' is distinct from 'service_role' then raise exception 'forbidden'; end if;
  for r in select distinct user_id from public.tipp_tips where event_id = p_event and user_id is not null loop
    perform private.push(r.user_id, 'tipp', p_title, p_body, '/#tipp'); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.tipp_notify(text, text, text) from public, anon, authenticated;

-- remind the tipsters who haven't tipped this big game yet — server only
create or replace function public.tipp_remind(p_event text, p_title text, p_body text)
returns int language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  if coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role' is distinct from 'service_role' then raise exception 'forbidden'; end if;
  for r in select distinct user_id from public.tipp_tips where user_id is not null and created_at > now() - interval '30 days'
           and user_id not in (select user_id from public.tipp_tips where event_id = p_event and user_id is not null) loop
    perform private.push(r.user_id, 'tipp', p_title, p_body, '/#tipp'); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.tipp_remind(text, text, text) from public, anon, authenticated;

-- tell the admins that a manual event needs its result — server only
create or replace function public.tipp_admin_nudge(p_event text, p_title text, p_body text)
returns int language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  if coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role' is distinct from 'service_role' then raise exception 'forbidden'; end if;
  for r in select user_id from public.tipp_admins loop
    perform private.push(r.user_id, 'tipp', p_title, p_body, '/#tipp'); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.tipp_admin_nudge(text, text, text) from public, anon, authenticated;

-- a market's result is one winning pick, or a list of them (a draw wins "1 or X" and "X or 2")
create or replace function public.tipp_hit(res jsonb, pick text) returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(res) = 'array' then res ? pick else res #>> '{}' = pick end $$;

-- settle an event: p_res maps market -> winning pick ('void' gives the stake back).
-- Sends each tipster one summary push and tells people who just got overtaken.
create or replace function public.tipp_settle(p_event text, p_res jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); is_srv boolean; ev public.tipp_events; before jsonb; after jsonb; r record; n int := 0; title text; a record; b record;
begin
  is_srv := coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role' = 'service_role';
  if not is_srv and not exists (select 1 from public.tipp_admins where user_id = uid) then raise exception 'forbidden'; end if;
  select * into ev from public.tipp_events where id = p_event for update;
  if not found then raise exception 'no such event'; end if;
  select coalesce(jsonb_object_agg(x.u, x.rk), '{}'::jsonb) into before from (select user_id::text u, rank() over (order by sum(case when status <> 'open' then payout - stake else 0 end) desc) rk from public.tipp_tips where user_id is not null group by user_id) x;
  update public.tipp_tips t set
      status = case when p_res ? t.market then case when p_res->>t.market = 'void' then 'void' when public.tipp_hit(p_res->t.market, t.pick) then 'won' else 'lost' end else t.status end,
      payout = case when p_res ? t.market then case when p_res->>t.market = 'void' then t.stake when public.tipp_hit(p_res->t.market, t.pick) then round(t.stake * t.odds)::int else 0 end else t.payout end,
      settled_at = case when p_res ? t.market then now() else t.settled_at end
    where t.event_id = p_event and t.status = 'open';
  get diagnostics n = row_count;
  update public.tipp_events set result = coalesce(result, '{}'::jsonb) || p_res,
    settled = not exists (select 1 from jsonb_array_elements(markets) m where not (p_res ? (m->>'k')) and not (coalesce(result,'{}'::jsonb) ? (m->>'k'))),
    updated_at = now(), state = case when state in ('pre','in') then 'post' else state end where id = p_event;
  -- one push per tipster with what came out
  for r in select user_id, count(*) filter (where status = 'won') w, count(*) filter (where status = 'lost') l, sum(payout - stake) filter (where status in ('won','lost','void')) net
           from public.tipp_tips where event_id = p_event and user_id is not null and settled_at > now() - interval '5 seconds' group by user_id loop
    title := case when r.w > 0 then '✅ ' || r.w || ' Tipp' || case when r.w > 1 then 's' else '' end || ' gewonnen' else '❌ Tipp verloren' end;
    perform private.push(r.user_id, 'tipp', title, coalesce(ev.name, ev.home || ' – ' || ev.away) || case when ev.score_h is not null then ' ' || ev.score_h || ':' || ev.score_a else '' end || ' · ' || case when r.net >= 0 then '+' else '' end || r.net || ' NAT', '/#tipp');
  end loop;
  -- who got overtaken
  select coalesce(jsonb_object_agg(x.u, x.rk), '{}'::jsonb) into after from (select user_id::text u, rank() over (order by sum(case when status <> 'open' then payout - stake else 0 end) desc) rk from public.tipp_tips where user_id is not null group by user_id) x;
  for a in select key u, value::int rk from jsonb_each_text(after) loop
    if before ? a.u and (before->>a.u)::int < a.rk then
      for b in select key u from jsonb_each_text(after) where value::int < a.rk and before ? key and (before->>key)::int > (before->>a.u)::int limit 1 loop
        perform private.push(a.u::uuid, 'tipp', '😬 Überholt!', coalesce((select name from public.chess_players where id = b.u::uuid), 'Jemand') || ' hat dich im Tippspiel überholt. Du bist jetzt Platz ' || a.rk || '.', '/#tipp');
      end loop;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.tipp_settle(text, jsonb) from public, anon;
grant execute on function public.tipp_settle(text, jsonb) to authenticated;

-- an admin creates or edits a hand-made event (boxing, Oktagon, handball): markets come in ready-made
create or replace function public.tipp_admin_event(p jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); eid text;
begin
  if not exists (select 1 from public.tipp_admins where user_id = uid) then raise exception 'forbidden'; end if;
  eid := coalesce(nullif(p->>'id',''), 'man:' || gen_random_uuid()::text);
  insert into public.tipp_events (id, sport, comp, name, home, away, start_at, markets, odds_src, odds_at, fav, meta, created_by, state)
  values (eid, p->>'sport', p->>'comp', p->>'name', p->>'home', p->>'away', (p->>'start_at')::timestamptz, coalesce(p->'markets','[]'::jsonb), 'manual', now(), coalesce((p->>'fav')::boolean, false), coalesce(p->'meta','{}'::jsonb), uid, coalesce(p->>'state','pre'))
  on conflict (id) do update set sport = excluded.sport, comp = excluded.comp, name = excluded.name, home = excluded.home, away = excluded.away, start_at = excluded.start_at,
    markets = excluded.markets, fav = excluded.fav, meta = public.tipp_events.meta || excluded.meta, state = excluded.state,
    score_h = coalesce((p->>'score_h')::int, public.tipp_events.score_h), score_a = coalesce((p->>'score_a')::int, public.tipp_events.score_a), updated_at = now();
  return eid;
end $$;
revoke all on function public.tipp_admin_event(jsonb) from public, anon;
grant execute on function public.tipp_admin_event(jsonb) to authenticated;

-- every minute: the edge function pulls scores, odds and stats, settles finished games
create or replace function private.tipp_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare fn text; hk text;
begin
  select replace(c.v, '/functions/v1/push', '/functions/v1/tipp') into fn from private.push_config c where c.k = 'fn_url';
  select c.v into hk from private.push_config c where c.k = 'hook_key';
  if fn is null then return; end if;
  perform net.http_post(url := fn, body := jsonb_build_object('sync', true), headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-key', hk), timeout_milliseconds := 55000);
end $$;
select cron.schedule('tipp-sync', '* * * * *', 'select private.tipp_tick()');
