-- 2026-11-08: every new player is friends with the Chess.nat team (the news admins) right away,
-- and the team gets a push "Neuer Spieler". Applied as migration chess_admin_autofriend.
create or replace function private.on_new_player() returns trigger language plpgsql security definer set search_path = '' as $$
declare adm uuid;
begin
  for adm in select x.user_id from private.news_admins x loop
    if adm <> new.id then
      insert into public.chess_friends (a, b, requested_by, status)
      values (least(adm, new.id), greatest(adm, new.id), adm, 'accepted')
      on conflict (a, b) do update set status = 'accepted';
      begin
        perform private.push(adm, 'friends', 'Neuer Spieler', coalesce(nullif(new.name, ''), 'Jemand') || ' ist jetzt bei Chess.nat.', '/#friends');
      exception when others then null;
      end;
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists chess_players_admin_friend on public.chess_players;
create trigger chess_players_admin_friend after insert on public.chess_players
  for each row execute function private.on_new_player();

insert into public.chess_friends (a, b, requested_by, status)
select least(x.user_id, p.id), greatest(x.user_id, p.id), x.user_id, 'accepted'
from public.chess_players p cross join private.news_admins x
where p.id <> x.user_id
on conflict (a, b) do update set status = 'accepted';
