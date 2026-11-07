-- Every player always has an ID. It can be changed once; after that it's fixed. The name stays free to change.
alter table public.chess_players add column if not exists handle_changes integer not null default 0;
create or replace function private.guard_handle() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.handle_changes := old.handle_changes;
  if old.handle is not null and new.handle is distinct from old.handle then
    if new.handle is null then raise exception 'handle_required' using errcode = 'P0001'; end if;
    if old.handle_changes >= 1 then raise exception 'handle_locked' using errcode = 'P0001'; end if;
    new.handle_changes := old.handle_changes + 1;
  end if;
  return new;
end $$;
drop trigger if exists chess_players_handle_guard on public.chess_players;
create trigger chess_players_handle_guard before update on public.chess_players for each row execute function private.guard_handle();
