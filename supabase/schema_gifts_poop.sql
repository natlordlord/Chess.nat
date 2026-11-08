-- 2026-11-08: besides hearts, the one holding the cage can throw poop (hold the heart button)
alter table public.chess_gifts drop constraint if exists chess_gifts_kind_check;
alter table public.chess_gifts add constraint chess_gifts_kind_check check (kind in ('heart', 'poop'));
create or replace function private.on_gift() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'poop' then
    perform private.push(new.to_id, 'hearts', private.pname(new.from_id) || ' threw a 💩 at you', 'From the cage. Win the next game to break out.', '/#trophies');
  else
    perform private.push(new.to_id, 'hearts', private.pname(new.from_id) || ' sent you a ❤️', 'From the cage, with love.', '/#trophies');
  end if;
  return new; end $$;
