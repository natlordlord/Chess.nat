-- Kalorien-Tracker: Rezepte, die jemand mit Namen veröffentlicht hat. Alle angemeldeten Spieler finden sie in der Suche,
-- ändern und löschen kann nur, wer sie veröffentlicht hat. Erlaubt sind nur Zutaten mit geprüften Werten (siehe Trigger). items = die Zutaten des ganzen Rezepts (wie in kcal_meals.items),
-- grams = Gewicht des Ganzen, kcal/carbs/protein/fat = Summe des Ganzen.
create table if not exists public.kcal_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author text not null default '',
  name text not null check (char_length(btrim(name)) between 2 and 80),
  emoji text not null default '🍽️',
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 2 and 40),
  grams numeric not null check (grams > 0 and grams < 100000),
  kcal integer not null check (kcal >= 0 and kcal < 200000),
  carbs numeric not null default 0, protein numeric not null default 0, fat numeric not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists kcal_recipes_own_name on public.kcal_recipes (user_id, lower(btrim(name)));
create index if not exists kcal_recipes_new on public.kcal_recipes (created_at desc);
alter table public.kcal_recipes enable row level security;

-- who published it is filled in here, never taken from the phone
create or replace function private.kcal_recipe_stamp() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.user_id := auth.uid(); new.author := left(private.pname(auth.uid()), 40); new.name := btrim(new.name);
  -- only ingredients with checked values: fixed table (ref / per.tab), checked database (food, must exist) or a real product (code)
  if exists (select 1 from jsonb_array_elements(new.items) e where coalesce(nullif(e->>'ref', ''), nullif(e->>'code', ''), nullif(e->'per'->>'tab', '')) is null
      and not exists (select 1 from public.kcal_foods f where f.key = nullif(e->>'food', ''))) then
    raise exception 'Ein Rezept für alle darf nur aus Zutaten mit geprüften Werten bestehen.';
  end if;
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  return new;
end $$;
drop trigger if exists kcal_recipe_stamp on public.kcal_recipes;
create trigger kcal_recipe_stamp before insert or update on public.kcal_recipes for each row execute function private.kcal_recipe_stamp();

drop policy if exists "kcal recipes: everyone signed in reads" on public.kcal_recipes;
drop policy if exists "kcal recipes: publish own" on public.kcal_recipes;
drop policy if exists "kcal recipes: change own" on public.kcal_recipes;
drop policy if exists "kcal recipes: delete own" on public.kcal_recipes;
create policy "kcal recipes: everyone signed in reads" on public.kcal_recipes for select to authenticated using (true);
create policy "kcal recipes: publish own" on public.kcal_recipes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "kcal recipes: change own" on public.kcal_recipes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "kcal recipes: delete own" on public.kcal_recipes for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.kcal_recipes from anon;
grant select, insert, update, delete on public.kcal_recipes to authenticated;
