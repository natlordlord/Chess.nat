-- 2026-11-11: Kalorien-Tracker inside Chess.nat (opt-in per person in Settings).
-- Meals per person and day, a daily kcal goal, flames for days the goal was reached, sharing with friends
-- who also track, invites, and push reminders with a meal suggestion in grams. Applied as migrations chess_kcal_probe, chess_kcal_tables, chess_kcal_flames, chess_kcal_reminders.

create table if not exists public.kcal_profile (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  enabled boolean not null default false,
  goal integer not null default 2500 check (goal between 800 and 7000),
  share boolean not null default true,
  remind boolean not null default true,
  flame integer not null default 0,
  flame_day date,
  best integer not null default 0,
  last_remind_at timestamptz,
  last_remind_kind text,
  updated_at timestamptz not null default now()
);

create table if not exists public.kcal_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  ts timestamptz not null default now(),
  title text not null check (char_length(title) between 1 and 120),
  emoji text check (char_length(emoji) <= 16),
  source text check (source in ('voice', 'barcode', 'manual', 'text')),
  kcal integer not null default 0 check (kcal between 0 and 20000),
  carbs numeric(7,1) not null default 0,
  protein numeric(7,1) not null default 0,
  fat numeric(7,1) not null default 0,
  grams integer,
  code text,
  said text check (char_length(said) <= 2000),
  items jsonb,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists kcal_meals_user_day on public.kcal_meals(user_id, day desc, ts desc);

create table if not exists public.kcal_invites (
  from_id uuid not null default auth.uid() references auth.users on delete cascade,
  to_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);

-- friends who may see each other: accepted friendship, and the owner shares
create or replace function public.kcal_can_see(owner uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select owner = (select auth.uid()) or (
    exists (select 1 from public.kcal_profile k where k.user_id = owner and k.enabled and k.share)
    and exists (select 1 from public.chess_friends f where f.status = 'accepted'
      and f.a = least(owner, (select auth.uid())) and f.b = greatest(owner, (select auth.uid()))))
$$;
revoke execute on function public.kcal_can_see(uuid) from public, anon;
grant execute on function public.kcal_can_see(uuid) to authenticated;

alter table public.kcal_profile enable row level security;
alter table public.kcal_meals enable row level security;
alter table public.kcal_invites enable row level security;

create policy "kcal profile: see own and friends" on public.kcal_profile for select to authenticated using (public.kcal_can_see(user_id));
create policy "kcal profile: insert own" on public.kcal_profile for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "kcal profile: update own" on public.kcal_profile for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select on public.kcal_profile to authenticated;
grant insert (user_id, enabled, goal, share, remind) on public.kcal_profile to authenticated;
grant update (enabled, goal, share, remind, updated_at) on public.kcal_profile to authenticated;

create policy "kcal meals: see own and friends" on public.kcal_meals for select to authenticated using (public.kcal_can_see(user_id));
create policy "kcal meals: write own" on public.kcal_meals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "kcal meals: change own" on public.kcal_meals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "kcal meals: delete own" on public.kcal_meals for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.kcal_meals to authenticated;

create policy "kcal invites: see mine" on public.kcal_invites for select to authenticated using ((select auth.uid()) in (from_id, to_id));
create policy "kcal invites: delete mine" on public.kcal_invites for delete to authenticated using ((select auth.uid()) in (from_id, to_id));
grant select, delete on public.kcal_invites to authenticated;

-- Berlin day of "now"
create or replace function private.kcal_today() returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Berlin')::date $$;

-- flames: consecutive days on which the goal was reached (today counts once reached; until then yesterday's run stays alive)
create or replace function private.kcal_recalc(uid uuid) returns void language plpgsql security definer set search_path = '' as $$
declare g integer; d date; n integer := 0; last_hit date; old_flame integer; old_day date; today date := private.kcal_today(); hit_today boolean;
begin
  select k.goal, k.flame, k.flame_day into g, old_flame, old_day from public.kcal_profile k where k.user_id = uid;
  if g is null then return; end if;
  select coalesce(sum(m.kcal), 0) >= g into hit_today from public.kcal_meals m where m.user_id = uid and m.day = today;
  d := case when hit_today then today else today - 1 end;
  loop
    exit when not exists (select 1 from public.kcal_meals m where m.user_id = uid and m.day = d group by m.day having sum(m.kcal) >= g);
    if last_hit is null then last_hit := d; end if;
    n := n + 1; d := d - 1;
    exit when n > 3650;
  end loop;
  update public.kcal_profile k set flame = n, flame_day = last_hit, best = greatest(k.best, n) where k.user_id = uid;
  -- goal reached just now: a push for me and for friends who track too
  if hit_today and old_day is distinct from today then
    perform private.push(uid, 'kcal', '🔥 Kalorienziel geschafft!', case when n > 1 then n || ' Tage in Folge. Weiter so!' else 'Deine erste Flamme brennt. Morgen wieder!' end, '/#kcal');
    perform private.push(f.other, 'kcal', '🔥 ' || private.pname(uid) || ' hat das Kalorienziel geschafft', case when n > 1 then n || ' Tage in Folge.' else 'Heute geschafft.' end, '/#kcal')
    from (select case when f.a = uid then f.b else f.a end as other from public.chess_friends f where f.status = 'accepted' and uid in (f.a, f.b)) f
    join public.kcal_profile k on k.user_id = f.other and k.enabled
    where exists (select 1 from public.kcal_profile me where me.user_id = uid and me.share);
  end if;
end $$;

create or replace function private.on_kcal_meal() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.kcal_recalc(coalesce(new.user_id, old.user_id));
  return null;
end $$;
drop trigger if exists kcal_meal_flame on public.kcal_meals;
create trigger kcal_meal_flame after insert or update or delete on public.kcal_meals for each row execute function private.on_kcal_meal();

create or replace function private.on_kcal_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.goal is distinct from old.goal then perform private.kcal_recalc(new.user_id); end if;
  return null;
end $$;
drop trigger if exists kcal_profile_flame on public.kcal_profile;
create trigger kcal_profile_flame after insert or update of goal on public.kcal_profile for each row execute function private.on_kcal_profile();

-- invite a friend: only accepted friends, at most once a day per pair, with a push
create or replace function public.kcal_invite(target uuid) returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null or target is null or target = me then return 'invalid'; end if;
  if not exists (select 1 from public.chess_friends f where f.status = 'accepted' and f.a = least(me, target) and f.b = greatest(me, target)) then return 'not_friends'; end if;
  if exists (select 1 from public.kcal_profile k where k.user_id = target and k.enabled) then return 'already'; end if;
  if exists (select 1 from public.kcal_invites i where i.from_id = me and i.to_id = target and i.created_at > now() - interval '20 hours') then return 'sent'; end if;
  insert into public.kcal_invites (from_id, to_id, created_at) values (me, target, now())
    on conflict (from_id, to_id) do update set created_at = now();
  perform private.push(target, 'kcal', '🍽️ ' || private.pname(me) || ' lädt dich zum Kalorien-Tracker ein', 'Kalorien zusammen tracken und Flammen sammeln. Tippen zum Aktivieren.', '/#kcal');
  return 'ok';
end $$;
revoke execute on function public.kcal_invite(uuid) from public, anon;
grant execute on function public.kcal_invite(uuid) to authenticated;

-- meal ideas for reminders: grams so that one portion fills what is missing (cut at a sensible size)
create table if not exists private.kcal_ideas (
  id serial primary key, slot text not null, name text not null, kcal100 numeric not null, extra_kcal integer not null default 0, extra text not null default '', min_g integer not null, max_g integer not null
);
truncate private.kcal_ideas;
insert into private.kcal_ideas (slot, name, kcal100, extra_kcal, extra, min_g, max_g) values
 ('morning', 'Müsli', 370, 130, ' mit 200 ml Milch', 50, 150),
 ('morning', 'Haferflocken', 370, 230, ' mit 200 ml Milch und einer Banane', 50, 120),
 ('morning', 'Vollkornbrot mit Erdnussbutter', 330, 0, '', 80, 250),
 ('morning', 'Griechischer Joghurt mit Honig', 150, 120, ' und einer Handvoll Nüssen', 150, 400),
 ('day', 'Nudeln (trocken gewogen)', 355, 150, ' mit Pesto', 80, 200),
 ('day', 'Reis (trocken gewogen)', 350, 180, ' mit Hähnchen', 70, 180),
 ('day', 'Vollkornbrot mit Käse', 300, 0, '', 100, 300),
 ('day', 'Studentenfutter', 480, 0, '', 30, 120),
 ('day', 'Müsliriegel', 420, 0, '', 25, 100),
 ('evening', 'Nudeln (trocken gewogen)', 355, 200, ' mit Tomatensoße und Hackfleisch', 80, 200),
 ('evening', 'Brot mit Käse und Butter', 330, 0, '', 80, 250),
 ('evening', 'Kartoffeln', 75, 250, ' mit Quark und Leinöl', 200, 600),
 ('late', 'Erdnussbutter-Toast', 360, 0, '', 50, 200),
 ('late', 'Müsli', 370, 130, ' mit 200 ml Milch', 50, 150),
 ('late', 'Nüsse', 620, 0, '', 25, 100),
 ('late', 'Quark mit Honig', 120, 60, '', 150, 500);

create or replace function private.kcal_idea(missing integer, slot text) returns text language plpgsql volatile set search_path = '' as $$
declare r record; g integer; want integer := least(missing, case slot when 'late' then 900 else 1000 end);
begin
  select * into r from private.kcal_ideas i where i.slot = kcal_idea.slot order by random() limit 1;
  if r is null then return ''; end if;
  g := greatest(r.min_g, least(r.max_g, round(greatest(0, want - r.extra_kcal) / (r.kcal100 / 100.0) / 5.0) * 5));
  return g || ' g ' || r.name || r.extra || ' (≈ ' || round((g * r.kcal100 / 100.0 + r.extra_kcal) / 10.0) * 10 || ' kcal)';
end $$;

-- every 30 minutes: who is behind for this time of day gets a nudge with a suggestion (at most every 3 hours, 9–21 Uhr)
create or replace function private.kcal_remind_tick() returns void language plpgsql security definer set search_path = '' as $$
declare r record; lt timestamp := now() at time zone 'Europe/Berlin'; h numeric := extract(hour from lt) + extract(minute from lt) / 60.0;
  today date := private.kcal_today(); eaten integer; last_meal timestamptz; expect integer; missing integer; slot text; title text; body text;
begin
  if h < 9 or h > 21.6 then return; end if;
  slot := case when h < 11 then 'morning' when h < 17 then 'day' when h < 20.5 then 'evening' else 'late' end;
  for r in select k.* from public.kcal_profile k where k.enabled and k.remind
      and (k.last_remind_at is null or k.last_remind_at < now() - interval '3 hours')
      and exists (select 1 from public.chess_push p where p.user_id = k.user_id) loop
    select coalesce(sum(m.kcal), 0), max(m.ts) into eaten, last_meal from public.kcal_meals m where m.user_id = r.user_id and m.day = today;
    missing := r.goal - eaten;
    if missing <= 150 then continue; end if;
    if last_meal is not null and last_meal > now() - interval '2 hours 30 minutes' then continue; end if;
    -- the day's goal spread over 8–21 Uhr
    expect := round(r.goal * least(1, greatest(0, (h - 8) / 13.0)));
    if slot = 'late' then
      title := '🔥 Noch ' || missing || ' kcal bis zu deiner Flamme';
      body := 'Zum Auffüllen z. B. ' || private.kcal_idea(missing, slot) || '.';
    elsif eaten = 0 and h >= 9.5 then
      title := '🍽️ Zeit für was zu essen';
      body := 'Heute noch nichts eingetragen. Wie wär''s mit ' || private.kcal_idea(least(missing, 700), slot) || '?';
    elsif eaten < expect - 350 then
      title := '🍽️ Du solltest jetzt was essen';
      body := 'Dir fehlen heute noch ' || missing || ' kcal. Iss z. B. ' || private.kcal_idea(least(missing, 800), slot) || '.';
    else
      continue;
    end if;
    update public.kcal_profile k set last_remind_at = now(), last_remind_kind = slot where k.user_id = r.user_id;
    perform private.push(r.user_id, 'kcal', title, body, '/#kcal');
  end loop;
end $$;

select cron.unschedule('kcal-remind') where exists (select 1 from cron.job where jobname = 'kcal-remind');
select cron.schedule('kcal-remind', '7,37 * * * *', 'select private.kcal_remind_tick()');

-- Nathan's two accounts have the tracker on from the start; everyone else switches it on in Settings
insert into public.kcal_profile (user_id, enabled) values
  ('f81450e7-6054-4bbb-9cfe-e722708dd933', true), ('20f698b4-4307-4104-aa6f-499ba2724482', true)
on conflict (user_id) do update set enabled = true;

alter publication supabase_realtime add table public.kcal_meals;
