-- Household: chores and the bin collection plan ("Müllplan"), shared by the people who live together.
-- home_groups / home_members: one household and who belongs to it (the owner picks the members from their friends).
-- home_tasks: one thing to do. kind 'once' (a one-off, e.g. "the kitchen is dirty", with an optional photo),
--   'repeat' (comes back every_days after it was done) or 'plan' (a dated bin collection; due_at is the pickup).
--   everyone = true: all are asked at once and the first to say yes has it. Otherwise it goes by turn:
--   one person is asked (state 'asked'); "can't" passes it on to the next and that person is first in line the next time.
--   States: wait (not asked yet, ask_at in the future) -> asked | open (all asked) -> taken (on someone's to-do list) -> done.
-- home_log: who did (done), passed on (pass) or didn't answer (miss) what; it decides whose turn it is and feeds the statistics.
-- Clients only insert and delete tasks; every change of state goes through home_answer / home_done, which also send the pushes.
-- private.home_tick (pg_cron, every 5 minutes) starts the asking when ask_at has come, passes on unanswered asks after 2 hours,
-- reminds whoever took something, and closes missed collections.

create table if not exists public.home_groups (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'Zuhause' check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);
create table if not exists public.home_members (
  group_id uuid not null references public.home_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create or replace function public.home_can(g uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.home_groups x where x.id = g and x.owner = auth.uid())
      or exists (select 1 from public.home_members m where m.group_id = g and m.user_id = auth.uid()) $$;
create or replace function public.home_owns(g uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.home_groups x where x.id = g and x.owner = auth.uid()) $$;

create table if not exists public.home_tasks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.home_groups(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  emoji text not null default '🧹' check (char_length(emoji) <= 16),
  note text check (note is null or char_length(note) <= 300),
  img text check (img is null or char_length(img) <= 400000),
  kind text not null default 'once' check (kind in ('once', 'repeat', 'plan')),
  every_days int check (every_days is null or every_days between 1 and 365),
  everyone boolean not null default false,
  due_at timestamptz,
  ask_at timestamptz not null default now(),
  state text not null default 'wait' check (state in ('wait', 'asked', 'open', 'taken', 'done', 'skipped')),
  asked uuid, asked_at timestamptz, passed uuid[] not null default '{}',
  taken_by uuid, taken_at timestamptz, reminded_at timestamptz,
  done_by uuid, done_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists home_tasks_group on public.home_tasks (group_id, state);
create table if not exists public.home_log (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.home_groups(id) on delete cascade,
  task_id uuid references public.home_tasks(id) on delete set null,
  title text not null, emoji text,
  user_id uuid not null,
  what text not null check (what in ('done', 'pass', 'miss')),
  at timestamptz not null default now()
);
create index if not exists home_log_group on public.home_log (group_id, at);

alter table public.home_groups enable row level security;
alter table public.home_members enable row level security;
alter table public.home_tasks enable row level security;
alter table public.home_log enable row level security;
drop policy if exists home_groups_read on public.home_groups;  create policy home_groups_read on public.home_groups for select to authenticated using (owner = (select auth.uid()) or public.home_can(id));
drop policy if exists home_groups_add on public.home_groups;   create policy home_groups_add on public.home_groups for insert to authenticated with check (owner = (select auth.uid()));
drop policy if exists home_groups_edit on public.home_groups;  create policy home_groups_edit on public.home_groups for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
drop policy if exists home_groups_del on public.home_groups;   create policy home_groups_del on public.home_groups for delete to authenticated using (owner = (select auth.uid()));
drop policy if exists home_members_read on public.home_members; create policy home_members_read on public.home_members for select to authenticated using (public.home_can(group_id));
drop policy if exists home_members_add on public.home_members;  create policy home_members_add on public.home_members for insert to authenticated with check (public.home_owns(group_id));
drop policy if exists home_members_del on public.home_members;  create policy home_members_del on public.home_members for delete to authenticated using (public.home_owns(group_id) or user_id = (select auth.uid()));
drop policy if exists home_tasks_read on public.home_tasks;    create policy home_tasks_read on public.home_tasks for select to authenticated using (public.home_can(group_id));
drop policy if exists home_tasks_add on public.home_tasks;     create policy home_tasks_add on public.home_tasks for insert to authenticated with check (public.home_can(group_id) and created_by = (select auth.uid()));
drop policy if exists home_tasks_del on public.home_tasks;     create policy home_tasks_del on public.home_tasks for delete to authenticated using (created_by = (select auth.uid()) or public.home_owns(group_id));
drop policy if exists home_log_read on public.home_log;        create policy home_log_read on public.home_log for select to authenticated using (public.home_can(group_id));
grant select, insert, update, delete on public.home_groups, public.home_members to authenticated;
grant select, insert, delete on public.home_tasks to authenticated;
grant select on public.home_log to authenticated;

-- everyone in a household
create or replace function private.home_people(g uuid) returns setof uuid language sql stable security definer set search_path = '' as $$
  select x.owner from public.home_groups x where x.id = g union select m.user_id from public.home_members m where m.group_id = g $$;
create or replace function private.home_name(u uuid) returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select p.name from public.chess_players p where p.id = u), 'Jemand') $$;
create or replace function private.home_push_all(g uuid, skip uuid, title text, body text) returns void language plpgsql security definer set search_path = '' as $$
declare u uuid; begin for u in select * from private.home_people(g) loop if u is distinct from skip then perform private.push(u, 'home', title, body, '/#home'); end if; end loop; end $$;

-- whose turn: not who already passed this time; first whoever passed or missed something since they last did one,
-- then whoever did the least in the last 60 days, then whoever did something longest ago
create or replace function private.home_pick(g uuid, skip uuid[]) returns uuid language sql security definer set search_path = '' as $$
  select p.u from (select private.home_people(g) u) p
  where not (p.u = any (coalesce(skip, '{}')))
  order by (exists (select 1 from public.home_log l where l.group_id = g and l.user_id = p.u and l.what in ('pass', 'miss')
              and l.at > coalesce((select max(d.at) from public.home_log d where d.group_id = g and d.user_id = p.u and d.what = 'done'), '-infinity'::timestamptz))) desc,
           (select count(*) from public.home_log l where l.group_id = g and l.user_id = p.u and l.what = 'done' and l.at > now() - interval '60 days') asc,
           (select max(l.at) from public.home_log l where l.group_id = g and l.user_id = p.u and l.what = 'done') asc nulls first,
           random()
  limit 1 $$;

-- ask the next person in line (or, when nobody is left, everyone)
create or replace function private.home_ask(tid uuid) returns void language plpgsql security definer set search_path = '' as $$
declare t public.home_tasks; u uuid; w text;
begin
  select * into t from public.home_tasks where id = tid for update; if not found or t.state in ('done', 'skipped', 'taken') then return; end if;
  w := case when t.kind = 'plan' and t.due_at is not null then 'Abholung ' || case when (t.due_at at time zone 'Europe/Berlin')::date = (now() at time zone 'Europe/Berlin')::date + 1 then 'morgen'
        when (t.due_at at time zone 'Europe/Berlin')::date = (now() at time zone 'Europe/Berlin')::date then 'heute' else 'am ' || to_char(t.due_at at time zone 'Europe/Berlin', 'DD.MM.') end || '. ' else '' end;
  u := private.home_pick(t.group_id, t.passed);
  if u is null then
    update public.home_tasks set state = 'open', asked = null, asked_at = now() where id = tid;
    perform private.home_push_all(t.group_id, null, t.emoji || ' Noch offen: ' || t.title, w || 'Bisher hat niemand übernommen. Wer macht''s?');
  else
    update public.home_tasks set state = 'asked', asked = u, asked_at = now() where id = tid;
    perform private.push(u, 'home', t.emoji || ' Du bist dran: ' || t.title, w || 'Machst du das? Tipp zum Antworten.', '/#home');
  end if;
end $$;

-- the asking starts
create or replace function private.home_start(tid uuid) returns void language plpgsql security definer set search_path = '' as $$
declare t public.home_tasks;
begin
  select * into t from public.home_tasks where id = tid for update; if not found or t.state <> 'wait' then return; end if;
  if t.everyone then
    update public.home_tasks set state = 'open', asked_at = now() where id = tid;
    perform private.home_push_all(t.group_id, t.created_by, t.emoji || ' ' || t.title, private.home_name(t.created_by) || ' fragt: Wer übernimmt das?' || case when t.note is not null then ' „' || t.note || '“' else '' end);
  else perform private.home_ask(tid); end if;
end $$;

create or replace function private.home_tasks_bi() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.state := 'wait'; new.asked := null; new.asked_at := null; new.passed := '{}'; new.taken_by := null; new.taken_at := null; new.reminded_at := null; new.done_by := null; new.done_at := null;
  new.title := btrim(new.title); if new.ask_at is null then new.ask_at := now(); end if;
  if new.kind = 'repeat' and new.every_days is null then new.every_days := 7; end if; if new.kind <> 'repeat' then new.every_days := null; end if;
  return new;
end $$;
drop trigger if exists home_tasks_bi on public.home_tasks; create trigger home_tasks_bi before insert on public.home_tasks for each row execute function private.home_tasks_bi();
create or replace function private.home_tasks_ai() returns trigger language plpgsql security definer set search_path = '' as $$
begin if new.ask_at <= now() then perform private.home_start(new.id); end if; return null; end $$;
drop trigger if exists home_tasks_ai on public.home_tasks; create trigger home_tasks_ai after insert on public.home_tasks for each row execute function private.home_tasks_ai();

-- "I'll do it" (p_yes) or "I can't"
create or replace function public.home_answer(p_task uuid, p_yes boolean) returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t public.home_tasks;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into t from public.home_tasks where id = p_task for update; if not found or not public.home_can(t.group_id) then raise exception 'no such task'; end if;
  if t.state in ('done', 'skipped') then return 'closed'; end if;
  if p_yes then
    if t.state = 'taken' then return case when t.taken_by = uid then 'taken' else 'gone' end; end if;
    update public.home_tasks set state = 'taken', taken_by = uid, taken_at = now(), asked = null, reminded_at = null where id = p_task;
    if t.everyone or t.state = 'open' or t.asked is distinct from uid then
      perform private.home_push_all(t.group_id, uid, t.emoji || ' ' || private.home_name(uid) || ' übernimmt das', t.title); end if;
    return 'taken';
  end if;
  if t.state = 'taken' and t.taken_by = uid then
    insert into public.home_log (group_id, task_id, title, emoji, user_id, what) values (t.group_id, t.id, t.title, t.emoji, uid, 'pass');
    update public.home_tasks set state = 'wait', taken_by = null, taken_at = null, passed = array_append(passed, uid) where id = p_task;
    perform private.home_ask(p_task); return 'passed';
  elsif t.state = 'asked' and t.asked = uid then
    insert into public.home_log (group_id, task_id, title, emoji, user_id, what) values (t.group_id, t.id, t.title, t.emoji, uid, 'pass');
    update public.home_tasks set passed = array_append(passed, uid) where id = p_task;
    perform private.home_ask(p_task); return 'passed';
  elsif t.state = 'open' then
    update public.home_tasks set passed = array_append(passed, uid) where id = p_task and not (uid = any (passed)); return 'passed';
  end if;
  return 'not yours';
end $$;

-- done: logged, everyone hears about it, a repeating task comes back
create or replace function public.home_done(p_task uuid) returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t public.home_tasks; step interval; na timestamptz;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into t from public.home_tasks where id = p_task for update; if not found or not public.home_can(t.group_id) then raise exception 'no such task'; end if;
  if t.state = 'done' then return 'done'; end if;
  update public.home_tasks set state = 'done', done_by = uid, done_at = now(), asked = null where id = p_task;
  insert into public.home_log (group_id, task_id, title, emoji, user_id, what) values (t.group_id, t.id, t.title, t.emoji, uid, 'done');
  perform private.home_push_all(t.group_id, uid, '✅ ' || private.home_name(uid) || ' hat das erledigt', t.emoji || ' ' || t.title);
  if t.kind = 'repeat' and t.every_days is not null then
    step := make_interval(days => t.every_days); na := t.ask_at + step; while na <= now() loop na := na + step; end loop;
    insert into public.home_tasks (group_id, title, emoji, note, kind, every_days, everyone, due_at, ask_at, created_by)
      values (t.group_id, t.title, t.emoji, t.note, 'repeat', t.every_days, t.everyone, case when t.due_at is null then null else t.due_at + (na - t.ask_at) end, na, t.created_by);
  end if;
  return 'done';
end $$;
revoke all on function public.home_answer(uuid, boolean), public.home_done(uuid) from public, anon;
grant execute on function public.home_answer(uuid, boolean), public.home_done(uuid), public.home_can(uuid), public.home_owns(uuid) to authenticated;

create or replace function private.home_tick() returns void language plpgsql security definer set search_path = '' as $$
declare r record; h int := extract(hour from now() at time zone 'Europe/Berlin');
begin
  for r in select id from public.home_tasks where state = 'wait' and ask_at <= now() loop perform private.home_start(r.id); end loop;
  if h >= 8 and h < 22 then
    /* no answer for two hours: the next one is asked, and the one who stayed silent is first in line next time */
    for r in select * from public.home_tasks where state = 'asked' and asked_at < now() - interval '2 hours' loop
      insert into public.home_log (group_id, task_id, title, emoji, user_id, what) values (r.group_id, r.id, r.title, r.emoji, r.asked, 'miss');
      update public.home_tasks set passed = array_append(passed, r.asked) where id = r.id; perform private.home_ask(r.id);
    end loop;
    for r in select * from public.home_tasks where state = 'taken' and reminded_at is null and taken_at < now() - interval '3 hours' loop
      update public.home_tasks set reminded_at = now() where id = r.id;
      perform private.push(r.taken_by, 'home', r.emoji || ' Noch offen: ' || r.title, 'Du hast das übernommen. Hak es ab, sobald es erledigt ist.', '/#home');
    end loop;
  end if;
  /* a collection that has passed is closed; whoever had taken it gets a miss */
  for r in select * from public.home_tasks where kind = 'plan' and state in ('wait', 'asked', 'open', 'taken') and due_at < now() - interval '12 hours' loop
    if r.taken_by is not null then insert into public.home_log (group_id, task_id, title, emoji, user_id, what) values (r.group_id, r.id, r.title, r.emoji, r.taken_by, 'miss'); end if;
    update public.home_tasks set state = 'skipped', asked = null where id = r.id;
  end loop;
end $$;
select cron.unschedule('home-tick') where exists (select 1 from cron.job where jobname = 'home-tick');
select cron.schedule('home-tick', '*/5 * * * *', 'select private.home_tick()');
do $$ begin if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'home_tasks') then alter publication supabase_realtime add table public.home_tasks; end if; end $$;

-- The household's address (Landkreis Freising): with it the app fetches the collection dates itself (api/muell.js) and
-- enters them as 'plan' tasks; the unique index keeps two phones from entering the same collection twice.
alter table public.home_groups add column if not exists ort text check (ort is null or char_length(ort) <= 80), add column if not exists strasse text check (strasse is null or char_length(strasse) <= 80);
create unique index if not exists home_tasks_plan_once on public.home_tasks (group_id, title, due_at) where kind = 'plan';

-- The full address (street, house number, town, district, state, as picked from the suggestions): api/muell.js finds the
-- region's calendar from it. home_plan_wishes: regions people asked for that no calendar is connected for yet (insert only).
alter table public.home_groups add column if not exists addr jsonb check (addr is null or pg_column_size(addr) < 2000);
create table if not exists public.home_plan_wishes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  city text check (char_length(city) <= 80), county text check (char_length(county) <= 80), state text check (char_length(state) <= 80), why text check (char_length(why) <= 40),
  created_at timestamptz not null default now()
);
alter table public.home_plan_wishes enable row level security;
drop policy if exists home_plan_wishes_add on public.home_plan_wishes;
create policy home_plan_wishes_add on public.home_plan_wishes for insert to authenticated with check (user_id = (select auth.uid()));
grant insert on public.home_plan_wishes to authenticated;

-- A heart as a thank-you: when someone ticked a task off, the others get a card with an empty heart to hold down until it is
-- full; that writes a row here (once per task and person) and the one who did the task hears about it.
create table if not exists public.home_thanks (
  task_id uuid not null references public.home_tasks(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, user_id)
);
alter table public.home_thanks enable row level security;
drop policy if exists home_thanks_read on public.home_thanks;
create policy home_thanks_read on public.home_thanks for select to authenticated using (exists (select 1 from public.home_tasks t where t.id = home_thanks.task_id and public.home_can(t.group_id)));
drop policy if exists home_thanks_add on public.home_thanks;
create policy home_thanks_add on public.home_thanks for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from public.home_tasks t where t.id = home_thanks.task_id and public.home_can(t.group_id) and t.state = 'done' and t.done_by is distinct from (select auth.uid())));
grant select, insert on public.home_thanks to authenticated;
create or replace function private.home_thanks_ai() returns trigger language plpgsql security definer set search_path = '' as $$
declare t public.home_tasks;
begin
  select * into t from public.home_tasks where id = new.task_id;
  if found and t.done_by is not null then perform private.push(t.done_by, 'home', '❤️ ' || private.home_name(new.user_id) || ' sagt Danke', t.emoji || ' ' || t.title, '/#home'); end if;
  return null;
end $$;
drop trigger if exists home_thanks_ai on public.home_thanks;
create trigger home_thanks_ai after insert on public.home_thanks for each row execute function private.home_thanks_ai();
do $$ begin if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'home_thanks') then alter publication supabase_realtime add table public.home_thanks; end if; end $$;
