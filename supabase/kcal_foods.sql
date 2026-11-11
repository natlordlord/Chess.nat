-- Kalorien-Tracker: die geprüfte Lebensmittel-Datenbank, die zweite Quelle neben der festen Tabelle (data/foods.js).
-- Hier stehen NUR geprüfte Werte pro 100 g aus einer offiziellen Quelle (Spalte source nennt sie). Die App und die KI können
-- nichts hineinschreiben: es gibt keine Schreibrechte für Nutzer und keine Funktion, die etwas anlegt. Einträge kommen nur
-- durch den Betreiber hinein (SQL / Import). Jedes Lebensmittel gibt es genau einmal: key = Name in Kleinbuchstaben ohne
-- Umlaute, Klammern und Zeichen, und der ist der Primärschlüssel.
create table if not exists public.kcal_foods (
  key text primary key check (char_length(key) between 2 and 60),
  name text not null check (char_length(name) between 2 and 60),
  k numeric not null check (k >= 0 and k <= 900),
  c numeric not null check (c >= 0 and c <= 100), p numeric not null check (p >= 0 and p <= 100), f numeric not null check (f >= 0 and f <= 100),
  fi numeric not null default 0, su numeric not null default 0, sf numeric not null default 0, q smallint not null default 3 check (q between 1 and 5),
  source text not null check (char_length(source) between 2 and 120),
  created_at timestamptz not null default now()
);
alter table public.kcal_foods add column if not exists source text;
alter table public.kcal_foods drop column if exists uses, drop column if exists created_by;
alter table public.kcal_foods enable row level security;
drop policy if exists "kcal foods: everyone signed in reads" on public.kcal_foods;
create policy "kcal foods: everyone signed in reads" on public.kcal_foods for select to authenticated using (true);
revoke all on public.kcal_foods from anon, authenticated;
grant select on public.kcal_foods to authenticated;

create or replace function public.kcal_food_key(t text) returns text language sql immutable set search_path = '' as $$
  select left(btrim(regexp_replace(translate(lower(regexp_replace(coalesce(t, ''), '\(.*?\)', ' ', 'g')), 'äöüßéèêàáâíóúñç', 'aouseeeaaaiounc'), '[^a-z0-9]+', ' ', 'g')), 60)
$$;
-- the key always follows the name, so two spellings of one food can never be two rows
create or replace function private.kcal_food_stamp() returns trigger language plpgsql set search_path = '' as $$
begin new.name := btrim(new.name); new.key := public.kcal_food_key(new.name); return new; end $$;
drop trigger if exists kcal_food_stamp on public.kcal_foods;
create trigger kcal_food_stamp before insert or update on public.kcal_foods for each row execute function private.kcal_food_stamp();

-- names: ["Mascarpone", …]. Returns one entry per name, in the same order: the checked food or null. Reads only, never writes.
drop function if exists public.kcal_foods_resolve(jsonb);
create or replace function public.kcal_foods_lookup(names jsonb) returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg((select to_jsonb(t.*) from public.kcal_foods t where t.key = public.kcal_food_key(n.value)) order by n.ord), '[]'::jsonb)
  from jsonb_array_elements_text(case when jsonb_typeof(names) = 'array' and jsonb_array_length(names) <= 40 then names else '[]'::jsonb end) with ordinality as n(value, ord)
$$;
revoke all on function public.kcal_foods_lookup(jsonb) from public, anon;
grant execute on function public.kcal_foods_lookup(jsonb) to authenticated;
