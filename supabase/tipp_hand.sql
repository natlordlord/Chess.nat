-- Tippspiel: a result entered by hand, the UFC as a choice, every UFC fight tippable.
-- Why: the WBC title fight Kabayel – Hysa (28 Nov 2026) was prepared, but Polymarket never listed it, so it stayed hidden
-- (a game needs a result source) and would have been called off at the bell. Now there is a fourth source, "hand":
--   * meta.src = {"kind": "hand"}: the game shows at once; after it an admin (tipp_admins) taps the winner under Ergebnisse
--     (public.tipp_result), everyone gets their points and the final push. The admins are asked by push 2 hours after the
--     start (private.tipp_hand_tick); the watchdog of tipp-pm asks again after 10 hours.
--   * the UFC is no longer in for everyone: it is the library row "mma-ufc" (its fights still come from ESPN, series is empty,
--     so tipp-pm fetches nothing for it). Whoever tipped a UFC fight before follows it already.
--   * every UFC fight with two known fighters is tipped (3 points for the winner), not only the title fights.

-- 1. the fourth source
create or replace function private.tipp_src_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id ~ '^(espn|lol|pm):' then return new; end if;
  if new.meta -> 'src' ->> 'kind' = 'hand' then return new; end if;
  if new.meta -> 'src' ->> 'kind' in ('pm', 'espn', 'lol') and (new.meta -> 'src' ? 'ev' or new.meta -> 'src' ? 'find' or new.meta -> 'src' ? 'match') then return new; end if;
  raise exception 'Tippspiel: "%" hat keine Ergebnis-Quelle. Spiele nur mit Quelle anlegen (ESPN, LoL Esports, Polymarket oder von Hand: meta.src).', new.id;
end $$;

-- 2. the final push, callable from the admin's result too (public.tipp_final stays for the edge functions only)
create or replace function private.tipp_final_do(p_event text)
returns int language plpgsql security definer set search_path = '' as $$
declare ev public.tipp_events; r record; others text; n int := 0; title text;
begin
  select * into ev from public.tipp_events where id = p_event for update; if not found or ev.state <> 'post' then return 0; end if;
  if coalesce((ev.meta ->> 'pp')::boolean, false) then return 0; end if;
  update public.tipp_events set meta = meta || '{"pp": true}'::jsonb where id = p_event;
  title := case when public.tipp_is_w(ev.sport) then
      case when ev.sport = 'lol' then '🎮 ' when ev.sport = 'mma' or ev.comp = 'box' then '🥊 ' else '🏆 ' end ||
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
revoke all on function private.tipp_final_do(text) from public, anon, authenticated;

create or replace function public.tipp_final(p_event text)
returns int language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role' is distinct from 'service_role' then raise exception 'forbidden'; end if;
  return private.tipp_final_do(p_event);
end $$;
revoke all on function public.tipp_final(text) from public, anon, authenticated;

-- 3. an admin enters the result: 'a', 'b', 'd' (draw, where the game has one) or 'x' (called off). It can be corrected;
--    the points follow the winner at once, the push goes out only the first time.
create or replace function public.tipp_result(p_event text, p_w text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); ev public.tipp_events;
begin
  if uid is null or not exists (select 1 from public.tipp_admins where user_id = uid) then raise exception 'forbidden'; end if;
  select * into ev from public.tipp_events where id = p_event for update;
  if not found then raise exception 'no such event'; end if;
  if ev.meta -> 'src' ->> 'kind' is distinct from 'hand' then raise exception 'not by hand'; end if;
  if p_w = 'x' then
    update public.tipp_events set state = 'canc', settled = true, clock = 'abgesagt', score_h = null, score_a = null,
      meta = meta || jsonb_build_object('winner', null, 'by', uid), updated_at = now() where id = p_event;
  elsif p_w in ('a', 'b') or (p_w = 'd' and coalesce((ev.meta ->> 'draw')::boolean, false)) then
    if ev.start_at > now() then raise exception 'not started'; end if;
    update public.tipp_events set state = 'post', settled = true, clock = 'Ende', score_h = null, score_a = null,
      meta = meta || jsonb_build_object('winner', p_w, 'by', uid), updated_at = now() where id = p_event;
    perform private.tipp_final_do(p_event);
  else raise exception 'bad result'; end if;
  return jsonb_build_object('id', p_event, 'winner', case when p_w = 'x' then null else p_w end);
end $$;
revoke all on function public.tipp_result(text, text) from public, anon;
grant execute on function public.tipp_result(text, text) to authenticated;

-- 4. every 10 minutes for the hand-entered games: an hour before a big one, those who haven't tipped it are reminded;
--    2 hours after the start the admins are asked for the winner
create or replace function private.tipp_hand_tick() returns void language plpgsql security definer set search_path = '' as $$
declare e record; r record;
begin
  for e in select * from public.tipp_events where meta -> 'src' ->> 'kind' = 'hand' and state = 'pre' and fav
      and start_at between now() + interval '40 minutes' and now() + interval '75 minutes' and not coalesce((meta ->> 'rem')::boolean, false) loop
    update public.tipp_events set meta = meta || '{"rem": true}'::jsonb where id = e.id;
    for r in select distinct user_id from public.tipp_picks where user_id is not null and updated_at > now() - interval '30 days'
             and user_id not in (select user_id from public.tipp_picks where event_id = e.id and user_id is not null) loop
      perform private.push(r.user_id, 'tipp', '🥊 Gleich: ' || e.home || ' – ' || e.away, 'In einer Stunde geht''s los. Noch kein Tipp? Sieger tippen, fertig.', '/#tipp');
    end loop;
  end loop;
  for e in select * from public.tipp_events where meta -> 'src' ->> 'kind' = 'hand' and state in ('pre', 'in') and not settled
      and start_at < now() - interval '2 hours' and start_at > now() - interval '4 days' and not coalesce((meta ->> 'asked')::boolean, false) loop
    update public.tipp_events set meta = meta || '{"asked": true}'::jsonb where id = e.id;
    for r in select user_id from public.tipp_admins loop
      perform private.push(r.user_id, 'tipp', '🥊 Wer hat gewonnen?', e.home || ' – ' || e.away || ': Sieger im Tippspiel unter „Ergebnisse“ eintragen, dann bekommen alle ihre Punkte.', '/#tipp');
    end loop;
  end loop;
end $$;
revoke all on function private.tipp_hand_tick() from public, anon, authenticated;
select cron.schedule('tipp-hand', '*/10 * * * *', 'select private.tipp_hand_tick()');

-- 5. every UFC fight with two known fighters is tipped
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
  elsif (ev.sport = 'mma' and coalesce(ev.home, 'TBA') !~* '\mTBA\M' and coalesce(ev.away, 'TBA') !~* '\mTBA\M' and ev.home <> '?' and ev.away <> '?') or ev.sport in ('lol', 'pm') then
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

-- 6. the UFC as a choice: its own library row; the kick-off reminder for a UFC fight only goes to those who follow it
insert into public.tipp_leagues (key, name, grp, series, rank, builtin) values ('mma-ufc', 'UFC', 'mma', '', 22, false)
  on conflict (key) do update set name = excluded.name, grp = excluded.grp, series = excluded.series, rank = excluded.rank, builtin = false;
insert into public.tipp_follows (user_id, league)
  select distinct p.user_id, 'mma-ufc' from public.tipp_picks p join public.tipp_events e on e.id = p.event_id
  where e.comp = 'ufc' and p.user_id is not null and exists (select 1 from auth.users u where u.id = p.user_id)
  on conflict do nothing;

create or replace function public.tipp_remind(p_event text, p_title text, p_body text)
returns int language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0; ufc boolean;
begin
  if coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role' is distinct from 'service_role' then raise exception 'forbidden'; end if;
  select comp = 'ufc' into ufc from public.tipp_events where id = p_event;
  for r in select distinct user_id from public.tipp_picks where user_id is not null and updated_at > now() - interval '30 days'
           and user_id not in (select user_id from public.tipp_picks where event_id = p_event and user_id is not null)
           and (not coalesce(ufc, false) or user_id in (select user_id from public.tipp_follows where league = 'mma-ufc')) loop
    perform private.push(r.user_id, 'tipp', p_title, p_body, '/#tipp'); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.tipp_remind(text, text, text) from public, anon, authenticated;

-- 7. Kabayel – Hysa: shown now, the winner is entered by hand (a draw can be tipped)
update public.tipp_events set sport = 'pm', comp = 'box',
  meta = (meta - 'src') || '{"src": {"kind": "hand"}, "draw": true}'::jsonb, updated_at = now()
  where id = 'man:box-kabayel-hysa' and state = 'pre';
