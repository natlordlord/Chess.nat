-- Tippspiel: every game has a result source, and the library (Polymarket) to follow any league you like.
-- Why: the Worlds final 2026 (Gen.G – BLG) was entered by hand with no source for its result, so it stayed "pre" after the
-- game and nobody got points. Since then:
--   * a game is only created with a source the server asks for the result: ESPN ("espn:…"), LoL Esports ("lol:…"),
--     Polymarket ("pm:…", or meta.src = {"kind": "pm", "ev": <event id>} / {"kind": "pm", "find": {...}} for a hand-entered
--     game that is linked to its market as soon as Polymarket lists it). Anything else is refused (private.tipp_src_guard).
--   * the edge functions: tipp (ESPN), tipp-lol (LoL Esports, now live), tipp-pm (Polymarket: library, results, watchdog).
--   * sport "pm": tipped by winner (a draw too where the market has one), 3 points. Football from the library is "fb" and
--     tipped by score like every football game.

-- 1. the leagues Polymarket lists (filled by tipp-pm once a day)
create table if not exists public.tipp_leagues (
  key text primary key,
  name text not null,
  grp text not null,
  series text not null,
  image text,
  rank int not null default 100,
  builtin boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.tipp_leagues enable row level security;
drop policy if exists "tipp leagues: everyone reads" on public.tipp_leagues;
create policy "tipp leagues: everyone reads" on public.tipp_leagues for select using (true);
grant select on public.tipp_leagues to anon, authenticated;

-- 2. who follows which league (each person only their own)
create table if not exists public.tipp_follows (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  league text not null references public.tipp_leagues(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, league)
);
alter table public.tipp_follows enable row level security;
drop policy if exists "tipp follows: own" on public.tipp_follows;
create policy "tipp follows: own" on public.tipp_follows for select to authenticated using (user_id = auth.uid());
drop policy if exists "tipp follows: add own" on public.tipp_follows;
create policy "tipp follows: add own" on public.tipp_follows for insert to authenticated
  with check (user_id = auth.uid() and not exists (select 1 from public.tipp_leagues l where l.key = league and l.builtin));
drop policy if exists "tipp follows: remove own" on public.tipp_follows;
create policy "tipp follows: remove own" on public.tipp_follows for delete to authenticated using (user_id = auth.uid());
grant select, insert, delete on public.tipp_follows to authenticated;

-- 3. a draw can be tipped where the market has one
alter table public.tipp_picks drop constraint if exists tipp_picks_w_check;
alter table public.tipp_picks add constraint tipp_picks_w_check check (w in ('a', 'b', 'd'));

-- 4. tipped by winner: UFC title fights, LoL, and every library game that isn't football
create or replace function public.tipp_is_w(p_sport text) returns boolean language sql immutable set search_path = '' as $$
  select p_sport in ('mma', 'lol', 'pm') $$;

create or replace function public.tipp_pts(p_sport text, sh int, sa int, w text, rh int, ra int, rw text)
returns int language sql immutable set search_path = '' as $$
  select case
    when public.tipp_is_w(p_sport) then case when w is null or rw is null then null when w = rw then 3 else 0 end
    when sh is null or sa is null or rh is null or ra is null then null
    when sh = rh and sa = ra then 4
    when sign(sh - sa) = sign(rh - ra) and rh <> ra and sh - sa = rh - ra then 3
    when sign(sh - sa) = sign(rh - ra) then 2
    else 0 end $$;

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
  elsif (ev.sport = 'mma' and coalesce((ev.meta ->> 'title')::boolean, false)) or ev.sport in ('lol', 'pm') then
    if p_w is null or not (p_w in ('a', 'b') or (p_w = 'd' and coalesce((ev.meta ->> 'draw')::boolean, false))) then raise exception 'bad pick'; end if;
    p_h := null; p_a := null;
  else raise exception 'not tippable'; end if;
  insert into public.tipp_picks (user_id, event_id, sh, sa, w) values (uid, p_event, p_h, p_a, p_w)
    on conflict (user_id, event_id) where user_id is not null do update set sh = excluded.sh, sa = excluded.sa, w = excluded.w, updated_at = now()
    returning * into r;
  return jsonb_build_object('event_id', r.event_id, 'sh', r.sh, 'sa', r.sa, 'w', r.w, 'updated_at', r.updated_at);
end $$;
revoke all on function public.tipp_pick(text, int, int, text) from public, anon;
grant execute on function public.tipp_pick(text, int, int, text) to authenticated;

create or replace function public.tipp_table()
returns table (uid uuid, bot text, name text, avatar jsonb, pts int, exact int, n int, open int)
language sql security definer set search_path = '' stable as $$
  with x as (
    select p.user_id, p.bot, e.sport, e.state, public.tipp_ev_pts(e, p.sh, p.sa, p.w) pts
    from public.tipp_picks p join public.tipp_events e on e.id = p.event_id where private.player_visible(auth.uid(), p.user_id)
  )
  select x.user_id, x.bot, coalesce(max(pl.name), case when x.bot = 'ki' then 'Nat-KI' else '?' end), (array_agg(pl.avatar))[1],
    coalesce(sum(x.pts), 0)::int,
    (count(*) filter (where x.sport = 'fb' and x.pts = 4) + count(*) filter (where public.tipp_is_w(x.sport) and x.pts = 3))::int,
    count(x.pts)::int,
    count(*) filter (where x.pts is null and x.state <> 'canc')::int
  from x left join public.chess_players pl on pl.id = x.user_id
  group by x.user_id, x.bot
  order by 5 desc, 6 desc, 7 asc;
$$;
grant execute on function public.tipp_table() to authenticated, anon;

create or replace function public.tipp_lines(p_event text, p_final boolean)
returns table (user_id uuid, nm text, tip text, pts int)
language sql stable security definer set search_path = '' as $$
  select p.user_id, coalesce(pl.name, case when p.bot = 'ki' then 'Nat-KI' else '?' end),
    case when e.sport in ('lol', 'pm') then case p.w when 'a' then e.home when 'b' then e.away else 'Unentschieden' end
         when e.sport = 'mma' then split_part(case when p.w = 'a' then e.home else e.away end, ' ', -1) else p.sh || ':' || p.sa end,
    public.tipp_ev_pts(e, p.sh, p.sa, p.w, p_final)
  from public.tipp_picks p join public.tipp_events e on e.id = p.event_id left join public.chess_players pl on pl.id = p.user_id
  where p.event_id = p_event;
$$;
revoke all on function public.tipp_lines(text, boolean) from public, anon, authenticated;

create or replace function public.tipp_final(p_event text)
returns int language plpgsql security definer set search_path = '' as $$
declare ev public.tipp_events; r record; others text; n int := 0; title text;
begin
  if coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role' is distinct from 'service_role' then raise exception 'forbidden'; end if;
  select * into ev from public.tipp_events where id = p_event for update; if not found or ev.state <> 'post' then return 0; end if;
  if coalesce((ev.meta ->> 'pp')::boolean, false) then return 0; end if;
  update public.tipp_events set meta = meta || '{"pp": true}'::jsonb where id = p_event;
  title := case when public.tipp_is_w(ev.sport) then
      case ev.sport when 'lol' then '🎮 ' when 'mma' then '🥊 ' else '🏆 ' end ||
      case ev.meta ->> 'winner' when 'a' then ev.home || ' gewinnt' when 'b' then ev.away || ' gewinnt' when 'd' then 'Unentschieden: ' || ev.home || ' – ' || ev.away else 'Kein Sieger' end ||
      case when ev.sport in ('lol', 'pm') and ev.score_h is not null and ev.score_a is not null and ev.score_h + ev.score_a > 1 then ' (' || ev.score_h || ':' || ev.score_a || ')' else '' end
    else '🏁 ' || ev.home || ' ' || coalesce((ev.meta -> 'reg' ->> 0), ev.score_h::text) || ':' || coalesce((ev.meta -> 'reg' ->> 1), ev.score_a::text) || ' ' || ev.away end;
  for r in select * from public.tipp_lines(p_event, true) where user_id is not null loop
    select string_agg(l.nm || ' ' || coalesce(l.pts, 0), ' · ' order by l.pts desc nulls last, l.nm) into others
      from (select * from public.tipp_lines(p_event, true) x where x.user_id is distinct from r.user_id and private.player_visible(r.user_id, x.user_id) limit 6) l;
    perform private.push(r.user_id, 'tipp', title,
      concat_ws(' · ', 'Du: ' || r.tip || case when r.pts = 4 or (public.tipp_is_w(ev.sport) and r.pts = 3) then ' → 🎯 +' || r.pts || ' Punkte' when r.pts > 0 then ' → +' || r.pts || ' Punkte' else ' → 0 Punkte' end, others), '/#tipp');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.tipp_final(text) from public, anon, authenticated;

-- 5. a push to the admins (server only): a game is long over and still has no result
create or replace function public.tipp_alert(p_title text, p_body text)
returns int language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  if coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role' is distinct from 'service_role' then raise exception 'forbidden'; end if;
  for r in select user_id from public.tipp_admins loop perform private.push(r.user_id, 'tipp', p_title, p_body, '/#tipp'); n := n + 1; end loop;
  return n;
end $$;
revoke all on function public.tipp_alert(text, text) from public, anon, authenticated;

-- 6. no game without a result source
create or replace function private.tipp_src_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id ~ '^(espn|lol|pm):' then return new; end if;
  if new.meta -> 'src' ->> 'kind' in ('pm', 'espn', 'lol') and (new.meta -> 'src' ? 'ev' or new.meta -> 'src' ? 'find' or new.meta -> 'src' ? 'match') then return new; end if;
  raise exception 'Tippspiel: "%" hat keine Ergebnis-Quelle. Spiele nur mit Quelle anlegen (ESPN, LoL Esports oder Polymarket, meta.src).', new.id;
end $$;
drop trigger if exists tipp_events_src on public.tipp_events;
create trigger tipp_events_src before insert on public.tipp_events for each row execute function private.tipp_src_guard();

-- 7. the hand-entered games get theirs: linked to Polymarket as soon as it lists them (until then they don't show);
--    not listed by the start -> called off. The Worlds final keeps the LoL Esports match it was scored from.
update public.tipp_events set meta = meta || jsonb_build_object('src', s.src) from (values
  ('man:box-kabayel-hysa', '{"kind": "pm", "find": {"q": "Kabayel Hysa", "terms": ["Kabayel", "Hysa"], "league": "boxing", "grp": "mma"}}'::jsonb),
  ('man:okt98-main', '{"kind": "pm", "find": {"q": "Legierski Buchinger", "terms": ["Legierski", "Buchinger"], "grp": "mma"}}'::jsonb),
  ('man:okt101-main', '{"kind": "pm", "find": {"q": "Dalaslan Kinehan", "terms": ["Dalaslan", "Kinehan"], "grp": "mma"}}'::jsonb),
  ('man:hb-ger-tun', '{"kind": "pm", "find": {"q": "Germany Tunisia", "terms": ["Germany", "Tunisia"], "grp": "hb"}}'::jsonb),
  ('man:hb-ger-uru', '{"kind": "pm", "find": {"q": "Germany Uruguay", "terms": ["Germany", "Uruguay"], "grp": "hb"}}'::jsonb),
  ('man:hb-ger-srb', '{"kind": "pm", "find": {"q": "Germany Serbia", "terms": ["Germany", "Serbia"], "grp": "hb"}}'::jsonb),
  ('man:lol-worlds26-final', '{"kind": "lol", "match": "worlds-2026-final", "pm": "1345375"}'::jsonb)
) s(id, src) where public.tipp_events.id = s.id;

-- 8. every two minutes: the library and LoL (the URL and key are the push function's, like private.tipp_tick)
create or replace function private.tipp_pm_tick() returns void language plpgsql security definer set search_path = '' as $$
declare fn text; hk text;
begin
  select replace(c.v, '/functions/v1/push', '/functions/v1/tipp-pm') into fn from private.push_config c where c.k = 'fn_url';
  select c.v into hk from private.push_config c where c.k = 'hook_key';
  if fn is null then return; end if;
  perform net.http_post(url := fn, body := '{}'::jsonb, headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-key', hk), timeout_milliseconds := 55000);
end $$;
create or replace function private.tipp_lol_tick() returns void language plpgsql security definer set search_path = '' as $$
declare fn text; hk text;
begin
  select replace(c.v, '/functions/v1/push', '/functions/v1/tipp-lol') into fn from private.push_config c where c.k = 'fn_url';
  select c.v into hk from private.push_config c where c.k = 'hook_key';
  if fn is null then return; end if;
  perform net.http_post(url := fn, body := '{}'::jsonb, headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-key', hk), timeout_milliseconds := 55000);
end $$;
select cron.schedule('tipp-pm', '1-59/2 * * * *', 'select private.tipp_pm_tick()');
select cron.schedule('tipp-lol', '*/2 * * * *', 'select private.tipp_lol_tick()');
