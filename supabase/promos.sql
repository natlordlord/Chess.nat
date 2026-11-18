-- Promotions (Nathan, Nov 2026): someone reaches a new rank tier for the first time (puzzles Bronze → Silver,
-- an online rating Iron → Bronze …). Everyone who can see that player gets a push, and in the app a card with
-- "Congratulate". The one promoted gets a push for every congratulation and sees who sent one.
-- Tiers and their lower bounds are the app's TIERS (index.html).

create or replace function private.tier_idx(t text) returns int language sql immutable set search_path = '' as $$
  select array_position(array['iron','bronze','silver','gold','platinum','emerald','diamond','master','grandmaster','challenger'], t) - 1 $$;
create or replace function private.tier_lo(t text) returns int language sql immutable set search_path = '' as $$
  select (array[400,1010,1316,1517,1713,1900,2153,2404,2672,2782])[private.tier_idx(t) + 1] $$;
create or replace function private.tier_de(t text) returns text language sql immutable set search_path = '' as $$
  select (array['Eisen','Bronze','Silber','Gold','Platin','Smaragd','Diamant','Meister','Großmeister','Herausforderer'])[private.tier_idx(t) + 1] $$;
create or replace function private.promo_kind_de(k text) returns text language sql immutable set search_path = '' as $$
  select case k when 'puzzle' then 'Puzzles' when 'bullet' then 'Bullet' when 'blitz' then 'Blitz' when 'rapid' then 'Schnellschach' else k end $$;

create table if not exists public.chess_promos (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('puzzle', 'bullet', 'blitz', 'rapid')),
  tier text not null check (private.tier_idx(tier) >= 1),
  from_tier text,
  rating int,
  created_at timestamptz not null default now(),
  unique (user_id, kind, tier)
);
create index if not exists chess_promos_recent on public.chess_promos (created_at desc);
create table if not exists public.chess_promo_cheers (
  promo_id bigint not null references public.chess_promos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  owner uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (promo_id, user_id)
);
create index if not exists chess_promo_cheers_owner on public.chess_promo_cheers (owner, created_at desc);

alter table public.chess_promos enable row level security;
alter table public.chess_promo_cheers enable row level security;
drop policy if exists "promos: read visible" on public.chess_promos;
create policy "promos: read visible" on public.chess_promos for select to authenticated
  using (private.player_visible((select auth.uid()), user_id));
drop policy if exists "promo cheers: read visible" on public.chess_promo_cheers;
create policy "promo cheers: read visible" on public.chess_promo_cheers for select to authenticated
  using (private.player_visible((select auth.uid()), owner) and private.player_visible((select auth.uid()), user_id));
-- no insert/update/delete policies: only through the functions below

-- tell everyone who can see the player (not the player)
create or replace function private.promo_notify(nid bigint) returns int language plpgsql security definer set search_path = '' as $$
declare p public.chess_promos; nm text; v uuid; n int := 0;
begin
  select * into p from public.chess_promos where id = nid; if not found then return 0; end if;
  nm := coalesce(nullif(private.pname(p.user_id), ''), 'Jemand');
  for v in select c.id from public.chess_players c where c.id <> p.user_id and private.player_visible(c.id, p.user_id) loop
    begin
      perform private.push(v, 'friends', '🎉 ' || nm || ' ist jetzt ' || private.tier_de(p.tier) || '!',
        private.promo_kind_de(p.kind) || ': ' || coalesce(private.tier_de(p.from_tier) || ' → ', '') || private.tier_de(p.tier)
          || '. Tippe hier und gratuliere!', '/#promo-' || nid);
      n := n + 1;
    exception when others then null;
    end;
  end loop;
  return n;
end $$;

-- a new tier: only upward, only the first time (higher than every earlier promotion of this kind), only if the rating is really there
create or replace function public.promo_add(p_kind text, p_tier text, p_from text, p_rating int) returns bigint
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); i int := private.tier_idx(p_tier); best int; nid bigint;
begin
  if u is null or i is null or i < 1 or p_kind not in ('puzzle', 'bullet', 'blitz', 'rapid') then return null; end if;
  if p_rating is null or p_rating < private.tier_lo(p_tier) or p_rating > 3500 then return null; end if;
  if p_kind <> 'puzzle' and not exists (select 1 from public.chess_ratings r where r.user_id = u and r.cat = p_kind and r.r >= private.tier_lo(p_tier) - 1) then return null; end if;
  select max(private.tier_idx(tier)) into best from public.chess_promos where user_id = u and kind = p_kind;
  if best is not null and best >= i then return null; end if;
  insert into public.chess_promos(user_id, kind, tier, from_tier, rating)
    values (u, p_kind, p_tier, case when private.tier_idx(p_from) between 0 and i - 1 then p_from end, p_rating)
    on conflict (user_id, kind, tier) do nothing returning id into nid;
  if nid is null then return null; end if;
  perform private.promo_notify(nid);
  return nid;
end $$;

-- the last two weeks of promotions this player may see, with who congratulated
create or replace function public.promo_feed() returns table(id bigint, uid uuid, name text, avatar jsonb, kind text, tier text, from_tier text, rating int,
  created_at timestamptz, cheers int, mine boolean, by jsonb)
language sql stable security definer set search_path = '' as $$
  select p.id, p.user_id, pl.name, pl.avatar, p.kind, p.tier, p.from_tier, p.rating, p.created_at,
    (select count(*)::int from public.chess_promo_cheers c where c.promo_id = p.id and private.player_visible(auth.uid(), c.user_id)),
    exists (select 1 from public.chess_promo_cheers c where c.promo_id = p.id and c.user_id = auth.uid()),
    coalesce((select jsonb_agg(jsonb_build_object('uid', c.user_id, 'name', cp.name, 'avatar', cp.avatar) order by c.created_at)
      from public.chess_promo_cheers c join public.chess_players cp on cp.id = c.user_id
      where c.promo_id = p.id and private.player_visible(auth.uid(), c.user_id)), '[]'::jsonb)
  from public.chess_promos p join public.chess_players pl on pl.id = p.user_id
  where auth.uid() is not null and p.created_at > now() - interval '14 days' and private.player_visible(auth.uid(), p.user_id)
  order by p.created_at desc limit 30;
$$;

-- congratulate: once per promotion; the one promoted gets a push
create or replace function public.promo_cheer(p_id bigint) returns int language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); p public.chess_promos; added int;
begin
  select * into p from public.chess_promos where id = p_id;
  if u is null or not found or p.user_id = u or not private.player_visible(u, p.user_id) then return null; end if;
  insert into public.chess_promo_cheers(promo_id, user_id, owner) values (p_id, u, p.user_id) on conflict do nothing;
  get diagnostics added = row_count;
  if added > 0 then
    begin
      perform private.push(p.user_id, 'friends', '🎉 ' || coalesce(nullif(private.pname(u), ''), 'Jemand') || ' gratuliert dir!',
        'Zu ' || private.tier_de(p.tier) || ' (' || private.promo_kind_de(p.kind) || ').', '/#promo-' || p_id);
    exception when others then null;
    end;
  end if;
  return (select count(*)::int from public.chess_promo_cheers c where c.promo_id = p_id);
end $$;

revoke all on function public.promo_add(text, text, text, int) from public, anon;
revoke all on function public.promo_feed() from public, anon;
revoke all on function public.promo_cheer(bigint) from public, anon;
grant execute on function public.promo_add(text, text, text, int) to authenticated;
grant execute on function public.promo_feed() to authenticated;
grant execute on function public.promo_cheer(bigint) to authenticated;
revoke all on function private.promo_notify(bigint) from public, anon, authenticated;

-- live: a new promotion pops up at once for everyone online, a congratulation for the one promoted
do $$ begin
  begin alter publication supabase_realtime add table public.chess_promos; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.chess_promo_cheers; exception when duplicate_object then null; end;
end $$;
