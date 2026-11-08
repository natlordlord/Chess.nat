-- NOT YET APPLIED (needs the owner's OK): a burst of hearts or poop sends one phone notification, not a hundred
create or replace function private.on_gift() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.chess_gifts g where g.from_id = new.from_id and g.to_id = new.to_id and g.id <> new.id and g.created_at > now() - interval '2 minutes') then
    return new;
  end if;
  if new.kind = 'poop' then
    perform private.push(new.to_id, 'hearts', private.pname(new.from_id) || ' threw a 💩 at you', 'From the cage. Win the next game to break out.', '/#trophies');
  else
    perform private.push(new.to_id, 'hearts', private.pname(new.from_id) || ' sent you a ❤️', 'From the cage, with love.', '/#trophies');
  end if;
  return new; end $$;
