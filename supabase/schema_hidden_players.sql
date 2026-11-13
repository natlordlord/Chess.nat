-- 13.11.2026, Migration "chess_hidden_players": unsichtbare Spieler (Privatsphäre).
-- Wer in private.hidden_players steht, sehen nur sie selbst, ihre bestätigten Freunde und das Chess.nat-Team (news_admins).
-- Für alle anderen taucht sie nirgends auf: nicht in der Spielersuche, nicht in Bestenlisten (Ranked, Tippspiel),
-- nicht in Tippspiel-Pushes, nicht über ihren Einladelink. Rezepte, Foto-Produkte und Ideen von ihr stehen als "Anonym".
-- Jemanden unsichtbar machen:  insert into private.hidden_players (user_id) values ('<uuid>');
-- Wieder sichtbar:             delete from private.hidden_players where user_id = '<uuid>';
create table if not exists private.hidden_players (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function private.player_visible(viewer uuid, pid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select pid is null
    or coalesce(viewer = pid, false)
    or not exists (select 1 from private.hidden_players h where h.user_id = pid)
    or exists (select 1 from private.news_admins a where a.user_id = viewer)
    or exists (select 1 from public.chess_friends f where f.status = 'accepted' and f.a = least(viewer, pid) and f.b = greatest(viewer, pid)) $$;

create or replace function private.public_name(pid uuid) returns text language sql stable security definer set search_path = '' as $$
  select case when exists (select 1 from private.hidden_players h where h.user_id = pid) then 'Anonym' else private.pname(pid) end $$;

drop policy if exists "players: signed-in can read" on public.chess_players;
create policy "players: signed-in can read" on public.chess_players for select to authenticated using (private.player_visible((select auth.uid()), id));

-- Die Funktionen, die Leute auflisten, umgehen die Zeilen-Sicherheit und filtern deshalb selbst (eingefügt per Textersetzung
-- in die vorhandene Fassung, siehe Migration):
--   ranked_top, tipp_table, tipp_board, tipp_event_picks, invite_who: ... and private.player_visible(auth.uid(), <user>)
--   tipp_live, tipp_final (Pushes mit den Tipps der anderen): ... and private.player_visible(<Empfänger>, x.user_id)
--   tipp_settle ("Überholt!"-Push): Name nur, wenn sichtbar, sonst "Jemand"
--   kcal_recipe_stamp, kcal_own_stamp: author := private.public_name(auth.uid())

create or replace function private.chess_ideas_hide_name() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from private.hidden_players h where h.user_id = new.user_id) then new.name := 'Anonym'; end if;
  return new;
end $$;
drop trigger if exists chess_ideas_hide_name on public.chess_ideas;
create trigger chess_ideas_hide_name before insert or update on public.chess_ideas for each row execute function private.chess_ideas_hide_name();

-- Yasemin ("Pupsi") möchte Privatsphäre
insert into private.hidden_players (user_id) values ('a28fa387-fc57-47a6-b4f8-1f30b27df625') on conflict do nothing;
