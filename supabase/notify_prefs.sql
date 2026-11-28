-- Benachrichtigungen einstellen (Wunsch von Nat, 28.11.2026)
-- Jede Person stellt selbst ein, welche Pushes sie bekommt. Gilt für alle ihre Geräte.
-- Pflicht (nicht abschaltbar): Einladungen ('invites', auch Tipprunde und Kalorien-Tracker), Nachrichten
-- vom Betreiber ('news', Patch-Notes) und Antworten auf das eigene Feedback ('feedback').
-- Schlüssel: messages, friends, hearts, kcal, tipp, home und je Sportart 'tipp.<gruppe>' (Erinnerung vor dem Spiel).
-- Fehlt ein Schlüssel, ist er an. Nichts Bestehendes wird gelöscht oder umgeschrieben.

create table if not exists public.chess_notify (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.chess_notify enable row level security;
drop policy if exists "notify: own" on public.chess_notify;
create policy "notify: own" on public.chess_notify for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update on public.chess_notify to authenticated;

-- an, solange der Schlüssel nicht ausdrücklich auf false steht
create or replace function private.notify_on(target uuid, key text) returns boolean
language sql stable security definer set search_path to '' as $$
  select not exists (select 1 from public.chess_notify n where n.user_id = target and n.prefs ->> key = 'false');
$$;

-- welche Sportart eine Tipp-Liga ist (für 'tipp.<gruppe>')
create or replace function private.tipp_group(comp text) returns text
language sql immutable set search_path to '' as $$
  select case
    when comp in ('ger.1') then 'bl'
    when comp like 'ger.dfb%' then 'pokal'
    when comp like 'uefa.champions%' then 'cl'
    when comp in ('uefa.nations', 'nt') or comp like 'fifa.%' or comp like 'uefa.euro%' then 'nt'
    when comp in ('ufc', 'oktagon', 'box', 'pm:boxing') or comp like 'mma%' then 'fight'
    when comp = 'hb' then 'hb'
    when comp = 'lol' then 'lol'
    when comp = 'pm:chess' then 'chess'
    else 'other' end;
$$;

-- private.push: wie bisher, nur fragt sie vorher die Einstellungen der Person (Pflicht-Arten immer)
create or replace function private.push(target uuid, kind text, title text, body text, url text)
returns void language plpgsql security definer set search_path to '' as $function$
declare fn text; hk text;
begin
  select c.v into fn from private.push_config c where c.k = 'fn_url';
  select c.v into hk from private.push_config c where c.k = 'hook_key';
  if fn is null or hk is null or target is null then return; end if;
  if kind not in ('invites', 'news', 'feedback') and not private.notify_on(target, kind) then return; end if;
  if not exists (select 1 from public.chess_push p where p.user_id = target) then return; end if;
  if exists (select 1 from public.chess_players pl where pl.id = target and pl.active_at > now() - interval '40 seconds') then return; end if;
  perform net.http_post(url := fn, body := jsonb_build_object('to', target, 'kind', kind, 'title', title, 'body', body, 'url', url),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-key', hk), timeout_milliseconds := 8000);
end $function$;

-- Erinnerung vor dem Spiel: nur an die, die diese Sportart nicht ausgeschaltet haben
create or replace function public.tipp_remind(p_event text, p_title text, p_body text)
returns integer language plpgsql security definer set search_path to '' as $function$
declare r record; n int := 0; ufc boolean; grp text;
begin
  if coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role' is distinct from 'service_role' then raise exception 'forbidden'; end if;
  select comp = 'ufc', private.tipp_group(comp) into ufc, grp from public.tipp_events where id = p_event;
  for r in select distinct user_id from public.tipp_picks where user_id is not null and updated_at > now() - interval '30 days'
           and user_id not in (select user_id from public.tipp_picks where event_id = p_event and user_id is not null)
           and (not coalesce(ufc, false) or user_id in (select user_id from public.tipp_follows where league = 'mma-ufc')) loop
    if private.notify_on(r.user_id, 'tipp.' || coalesce(grp, 'other')) then
      perform private.push(r.user_id, 'tipp', p_title, p_body, '/#tipp'); n := n + 1;
    end if;
  end loop;
  return n;
end $function$;

-- Einladung in eine Tipprunde ist eine Einladung (Pflicht), nicht ein Tippspiel-Push
create or replace function private.on_invite() returns trigger
language plpgsql security definer set search_path to '' as $function$
declare gname text;
begin
  if new.status = 'open' then
    if new.tc = 't:tipp' then
      select name into gname from public.tipp_groups where code = new.code;
      perform private.push(new.to_id, 'invites', private.pname(new.from_id) || case when gname is not null then ' lädt dich in die Tipprunde „' || gname || '“ ein' else ' lädt dich zum Tippspiel ein' end, 'Bayern, Bundesliga, Deutschland – tipp mit Natcoins mit.', '/#tipp-' || new.code);
    else
      perform private.push(new.to_id, 'invites', private.pname(new.from_id) || ' challenges you', 'Tap to join the game.', '/#friends');
    end if;
  end if;
  return new;
end $function$;

-- Einladung zum Kalorien-Tracker ebenso
create or replace function public.kcal_invite(target uuid) returns text
language plpgsql security definer set search_path to '' as $function$
declare me uuid := (select auth.uid());
begin
  if me is null or target is null or target = me then return 'invalid'; end if;
  if not exists (select 1 from public.chess_friends f where f.status = 'accepted' and f.a = least(me, target) and f.b = greatest(me, target)) then return 'not_friends'; end if;
  if exists (select 1 from public.kcal_profile k where k.user_id = target and k.enabled) then return 'already'; end if;
  if exists (select 1 from public.kcal_invites i where i.from_id = me and i.to_id = target and i.created_at > now() - interval '20 hours') then return 'sent'; end if;
  insert into public.kcal_invites (from_id, to_id, created_at) values (me, target, now())
    on conflict (from_id, to_id) do update set created_at = now();
  perform private.push(target, 'invites', '🍽️ ' || private.pname(me) || ' lädt dich zum Kalorien-Tracker ein', 'Kalorien zusammen tracken und Flammen sammeln. Tippen zum Aktivieren.', '/#kcal');
  return 'ok';
end $function$;
