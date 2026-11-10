-- A tipping-game invite (chess_invites.tc = 't:tipp') sends its own push and opens the Tippspiel.
create or replace function private.on_invite()
returns trigger language plpgsql security definer set search_path = '' as $function$
begin
  if new.status = 'open' then
    if new.tc = 't:tipp' then
      perform private.push(new.to_id, 'tipp', private.pname(new.from_id) || ' lädt dich zum Tippspiel ein', 'Bayern, Bundesliga, UFC – tipp mit Natcoins mit.', '/#tipp');
    else
      perform private.push(new.to_id, 'invites', private.pname(new.from_id) || ' challenges you', 'Tap to join the game.', '/#friends');
    end if;
  end if;
  return new;
end $function$;
