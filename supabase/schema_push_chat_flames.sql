create extension if not exists pg_net;
create extension if not exists pg_cron;

alter table public.chess_players add column if not exists flame integer not null default 0;
alter table public.chess_players add column if not exists flame_day date;
grant update (flame, flame_day) on public.chess_players to authenticated;

create table if not exists public.chess_push (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  p256dh text not null, auth text not null,
  tz integer not null default 0,
  hour integer not null default 18 check (hour between 0 and 23),
  prefs jsonb not null default '{"invites":true,"friends":true,"messages":true,"hearts":true,"remind":true}',
  created_at timestamptz not null default now(), last_remind date
);
create index if not exists chess_push_user on public.chess_push(user_id);
alter table public.chess_push enable row level security;
create policy "push: own" on public.chess_push for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.chess_push to authenticated;

create table if not exists public.chess_messages (
  id bigint generated always as identity primary key,
  from_id uuid not null default auth.uid() references auth.users on delete cascade,
  to_id uuid not null references auth.users on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists chess_messages_to on public.chess_messages(to_id, created_at desc);
create index if not exists chess_messages_from on public.chess_messages(from_id, created_at desc);
alter table public.chess_messages enable row level security;
create policy "messages: see own" on public.chess_messages for select to authenticated using ((select auth.uid()) in (from_id, to_id));
create policy "messages: friends only" on public.chess_messages for insert to authenticated with check (
  from_id = (select auth.uid()) and to_id <> from_id and exists (
    select 1 from public.chess_friends f where f.status = 'accepted' and f.a = least(from_id, to_id) and f.b = greatest(from_id, to_id)));
create policy "messages: mark read" on public.chess_messages for update to authenticated using (to_id = (select auth.uid())) with check (to_id = (select auth.uid()));
grant select, insert on public.chess_messages to authenticated;
grant update (read_at) on public.chess_messages to authenticated;
alter publication supabase_realtime add table public.chess_messages;

create schema if not exists private;
create table if not exists private.push_config (k text primary key, v text not null);

create or replace function public.push_config() returns jsonb language sql security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(c.k, c.v), '{}'::jsonb) from private.push_config c
  where coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb ->> 'role' = 'service_role' $$;
grant execute on function public.push_config() to service_role;

create or replace function private.push(target uuid, kind text, title text, body text, url text) returns void language plpgsql security definer set search_path = '' as $$
declare fn text; hk text;
begin
  select c.v into fn from private.push_config c where c.k = 'fn_url';
  select c.v into hk from private.push_config c where c.k = 'hook_key';
  if fn is null or hk is null or target is null then return; end if;
  if not exists (select 1 from public.chess_push p where p.user_id = target) then return; end if;
  perform net.http_post(url := fn, body := jsonb_build_object('to', target, 'kind', kind, 'title', title, 'body', body, 'url', url),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-key', hk), timeout_milliseconds := 8000);
end $$;

create or replace function private.pname(pid uuid) returns text language sql security definer set search_path = '' as $$
  select coalesce((select p.name from public.chess_players p where p.id = pid), 'A friend') $$;

create or replace function private.on_invite() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'open' then perform private.push(new.to_id, 'invites', private.pname(new.from_id) || ' challenges you', 'Tap to join the game.', '/#friends'); end if;
  return new; end $$;
create or replace function private.on_friend() returns trigger language plpgsql security definer set search_path = '' as $$
declare other uuid;
begin
  other := case when new.requested_by = new.a then new.b else new.a end;
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform private.push(other, 'friends', 'New friend request', private.pname(new.requested_by) || ' wants to be your friend.', '/#friends');
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform private.push(new.requested_by, 'friends', 'Friend request accepted', private.pname(other) || ' is your friend now.', '/#friends');
  end if;
  return new; end $$;
create or replace function private.on_gift() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.push(new.to_id, 'hearts', private.pname(new.from_id) || ' sent you a ❤️', 'From the cage, with love.', '/#trophies');
  return new; end $$;
create or replace function private.on_duel() returns trigger language plpgsql security definer set search_path = '' as $$
declare winner uuid;
begin
  if new.result in ('1-0', '0-1') then
    winner := case when new.reported_by = new.white then new.black else new.white end;
    perform private.push(winner, 'friends', 'Locked up! 🔒', private.pname(new.reported_by) || ' is in your cage now.', '/#trophies');
  end if;
  return new; end $$;
create or replace function private.on_message() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.push(new.to_id, 'messages', private.pname(new.from_id), left(new.body, 140), '/#chat-' || new.from_id::text);
  return new; end $$;

create trigger push_invite after insert on public.chess_invites for each row execute function private.on_invite();
create trigger push_friend after insert or update on public.chess_friends for each row execute function private.on_friend();
create trigger push_gift after insert on public.chess_gifts for each row execute function private.on_gift();
create trigger push_duel after insert on public.chess_duels for each row execute function private.on_duel();
create trigger push_message after insert on public.chess_messages for each row execute function private.on_message();

create or replace function private.remind_tick() returns void language plpgsql security definer set search_path = '' as $$
declare fn text; hk text;
begin
  select c.v into fn from private.push_config c where c.k = 'fn_url';
  select c.v into hk from private.push_config c where c.k = 'hook_key';
  if fn is null then return; end if;
  perform net.http_post(url := fn, body := jsonb_build_object('remind', true), headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-key', hk), timeout_milliseconds := 20000);
end $$;
select cron.schedule('chess-remind', '2 * * * *', 'select private.remind_tick()');
