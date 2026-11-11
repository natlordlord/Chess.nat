-- Kalorien-Tracker: die gemeinsame Lebensmittel-Datenbank. Für alles, was nicht in der festen Tabelle (data/foods.js) steht:
-- das erste Mal, dass die KI ein Lebensmittel schätzt, werden seine Werte pro 100 g hier gespeichert; danach bekommen alle
-- genau diese Werte. Jedes Lebensmittel gibt es nur einmal (key = Name in Kleinbuchstaben ohne Umlaute, Klammern, Zeichen).
-- Geschrieben wird nur über kcal_foods_resolve() (prüft, ob die Werte plausibel sind; überschreibt nie), lesen dürfen alle Angemeldeten.
create table if not exists public.kcal_foods (
  key text primary key check (char_length(key) between 2 and 60),
  name text not null check (char_length(name) between 2 and 60),
  k numeric not null check (k >= 0 and k <= 900),
  c numeric not null check (c >= 0 and c <= 100), p numeric not null check (p >= 0 and p <= 100), f numeric not null check (f >= 0 and f <= 100),
  fi numeric not null default 0, su numeric not null default 0, sf numeric not null default 0, q smallint not null default 3 check (q between 1 and 5),
  uses integer not null default 1,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.kcal_foods enable row level security;
drop policy if exists "kcal foods: everyone signed in reads" on public.kcal_foods;
create policy "kcal foods: everyone signed in reads" on public.kcal_foods for select to authenticated using (true);
revoke all on public.kcal_foods from anon, authenticated;
grant select on public.kcal_foods to authenticated;

create or replace function public.kcal_food_key(t text) returns text language sql immutable set search_path = '' as $$
  select left(btrim(regexp_replace(translate(lower(regexp_replace(coalesce(t, ''), '\(.*?\)', ' ', 'g')), 'äöüßéèêàáâíóúñç', 'aouseeeaaaiounc'), '[^a-z0-9]+', ' ', 'g')), 60)
$$;

-- items: [{name, k, c, p, f, fi, su, sf, q}] with values per 100 g. Returns one entry per item, in the same order: the stored food
-- (the existing one, or the one just created from these values) or null when it could not be stored (no name, implausible values).
create or replace function public.kcal_foods_resolve(items jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare it jsonb; res jsonb := '[]'::jsonb; ky text; r public.kcal_foods%rowtype; hit boolean; vk numeric; vc numeric; vp numeric; vf numeric;
begin
  if auth.uid() is null then raise exception 'Bitte anmelden'; end if;
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 40 then raise exception 'bad input'; end if;
  for it in select value from jsonb_array_elements(items) loop
    ky := public.kcal_food_key(it->>'name'); hit := false;
    if char_length(ky) >= 2 then
      select * into r from public.kcal_foods where key = ky; hit := found;
      if hit then update public.kcal_foods set uses = uses + 1 where key = ky;
      else
        vk := round((it->>'k')::numeric, 2); vc := round((it->>'c')::numeric, 2); vp := round((it->>'p')::numeric, 2); vf := round((it->>'f')::numeric, 2);
        if vk between 0 and 900 and vc between 0 and 100 and vp between 0 and 100 and vf between 0 and 100 and vc + vp + vf <= 101
           and abs(4 * vc + 4 * vp + 9 * vf - vk) <= greatest(40, vk * 0.3) then
          insert into public.kcal_foods (key, name, k, c, p, f, fi, su, sf, q)
            values (ky, left(btrim(it->>'name'), 60), vk, vc, vp, vf,
              least(100, greatest(0, round(coalesce((it->>'fi')::numeric, 0), 2))), least(100, greatest(0, round(coalesce((it->>'su')::numeric, 0), 2))), least(100, greatest(0, round(coalesce((it->>'sf')::numeric, 0), 2))),
              least(5, greatest(1, round(coalesce((it->>'q')::numeric, 3))))::smallint)
            on conflict (key) do nothing;
          select * into r from public.kcal_foods where key = ky; hit := found;
        end if;
      end if;
    end if;
    res := res || jsonb_build_array(case when hit then to_jsonb(r) - 'created_by' else 'null'::jsonb end);
  end loop;
  return res;
end $$;
revoke all on function public.kcal_foods_resolve(jsonb) from public, anon;
grant execute on function public.kcal_foods_resolve(jsonb) to authenticated;
