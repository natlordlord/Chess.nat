-- Kalorien-Tracker: die Lücken-Liste (Idee von Natlordlord). Kennt weder die feste Tabelle noch die geprüfte Datenbank noch
-- Open Food Facts ein Lebensmittel, wird es trotzdem eingetragen: erst mit der Schätzung der KI, und sein Name wird hier vorgemerkt.
-- Beim nächsten Durchlauf trägt der Betreiber die echten Werte nach (private.kcal_gap_fill): das Lebensmittel steht dann in
-- kcal_foods, und das Handy jedes Spielers, der es geschätzt eingetragen hat, berichtigt seinen eigenen Eintrag beim nächsten Öffnen.
-- Hier steht nur der Name und wie oft er gebraucht wurde, NICHT wer ihn gegessen hat. Niemand außer dem Betreiber liest die Liste.
create table if not exists public.kcal_gaps (
  key text primary key check (char_length(key) between 2 and 60),
  name text not null check (char_length(name) between 2 and 80),
  product text check (char_length(product) <= 80),
  uses integer not null default 1,
  status text not null default 'open' check (status in ('open', 'done', 'skipped')),
  food text references public.kcal_foods(key) on update cascade on delete set null,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);
alter table public.kcal_gaps enable row level security;
revoke all on public.kcal_gaps from public, anon, authenticated;

-- items: [{"name": "Lidl Croissant Schoko Nougat", "product": "…"}, …] – was eben nur geschätzt werden konnte. Merkt jeden Namen vor
-- (oder zählt ihn hoch) und antwortet je Eintrag in derselben Reihenfolge: null (nicht vorgemerkt) oder {"key": …, "food": …}; food ist die
-- geprüfte Zeile, wenn diese Lücke schon gefüllt ist, dann kann sofort richtig gerechnet werden.
create or replace function public.kcal_gap_note(items jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare e jsonb; gk text; nm text; fd public.kcal_foods; gp public.kcal_gaps; res jsonb := '[]'::jsonb; room boolean;
begin
  if (select auth.uid()) is null then raise exception 'Bitte anmelden'; end if;
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 30 then return res; end if;
  room := (select count(*) from public.kcal_gaps x where x.status = 'open') < 5000;
  for e in select value from jsonb_array_elements(items) loop
    nm := left(btrim(regexp_replace(coalesce(e->>'name', ''), '\s+', ' ', 'g')), 80); gk := public.kcal_food_key(nm);
    if char_length(nm) < 2 or char_length(gk) < 2 then res := res || 'null'::jsonb; continue; end if;
    select t.* into fd from public.kcal_foods t where t.key = gk;
    if found then res := res || jsonb_build_object('key', gk, 'food', to_jsonb(fd)); continue; end if;
    select t.* into gp from public.kcal_gaps t where t.key = gk;
    if found then
      update public.kcal_gaps t set uses = t.uses + 1, last_at = now() where t.key = gk;
      if gp.status = 'skipped' then res := res || 'null'::jsonb;
      else res := res || jsonb_build_object('key', gk, 'food', (select to_jsonb(t.*) from public.kcal_foods t where gp.status = 'done' and t.key = gp.food)); end if;
    elsif room then
      insert into public.kcal_gaps (key, name, product) values (gk, nm, nullif(left(btrim(coalesce(e->>'product', '')), 80), '')) on conflict (key) do nothing;
      res := res || jsonb_build_object('key', gk, 'food', null);
    else res := res || 'null'::jsonb; end if;
  end loop;
  return res;
end $$;
revoke all on function public.kcal_gap_note(jsonb) from public, anon;
grant execute on function public.kcal_gap_note(jsonb) to authenticated;

-- keys: die Lücken-Schlüssel, die in den eigenen Einträgen noch auf „wird geprüft“ stehen. Antwort je Schlüssel in derselben Reihenfolge:
-- null (noch offen), {"skip": true} (wird nicht nachgetragen, bleibt Schätzung) oder die geprüfte Zeile aus kcal_foods. Liest nur.
create or replace function public.kcal_gaps_resolved(keys jsonb) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg((
    select case when g.status = 'skipped' then jsonb_build_object('skip', true)
                when g.status = 'done' then (select to_jsonb(f.*) from public.kcal_foods f where f.key = g.food) end
    from public.kcal_gaps g where g.key = n.value) order by n.ord), '[]'::jsonb)
  from jsonb_array_elements_text(case when (select auth.uid()) is not null and jsonb_typeof(keys) = 'array' and jsonb_array_length(keys) <= 40 then keys else '[]'::jsonb end) with ordinality as n(value, ord)
$$;
revoke all on function public.kcal_gaps_resolved(jsonb) from public, anon;
grant execute on function public.kcal_gaps_resolved(jsonb) to authenticated;

-- Nur der Betreiber: eine Lücke füllen. Legt das Lebensmittel mit geprüften Werten pro 100 g an (oder nimmt das vorhandene gleichen
-- Namens) und hängt die Lücke daran. Mehrere Lücken („Schokocroissant“, „Schoko-Croissant Lidl“) dürfen auf dasselbe Lebensmittel zeigen.
create or replace function private.kcal_gap_fill(gap text, food_name text, kcal numeric, carbs numeric, protein numeric, fat numeric, fiber numeric, sugar numeric, satfat numeric, quality integer, src text) returns text language plpgsql set search_path = '' as $$
declare fk text := public.kcal_food_key(food_name);
begin
  if not exists (select 1 from public.kcal_gaps t where t.key = gap) then raise exception 'Lücke % gibt es nicht', gap; end if;
  insert into public.kcal_foods (key, name, k, c, p, f, fi, su, sf, q, source) values (fk, food_name, kcal, carbs, protein, fat, coalesce(fiber, 0), coalesce(sugar, 0), coalesce(satfat, 0), coalesce(quality, 3), src) on conflict (key) do nothing;
  update public.kcal_gaps t set status = 'done', food = fk where t.key = gap;
  return fk;
end $$;
-- Nur der Betreiber: eine Lücke wird nicht nachgetragen (kein echtes Lebensmittel, nichts Verlässliches zu finden). Der Eintrag bleibt eine Schätzung.
create or replace function private.kcal_gap_skip(gap text, why text) returns void language sql set search_path = '' as $$
  update public.kcal_gaps t set status = 'skipped', food = null, note = left(why, 300) where t.key = gap
$$;
revoke all on function private.kcal_gap_fill(text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, integer, text) from public, anon, authenticated;
revoke all on function private.kcal_gap_skip(text, text) from public, anon, authenticated;

-- kommt ein Lebensmittel auf anderem Weg in die geprüfte Datenbank, ist die gleichnamige Lücke damit auch gefüllt
create or replace function private.kcal_gap_food() returns trigger language plpgsql security definer set search_path = '' as $$
begin update public.kcal_gaps g set status = 'done', food = new.key where g.key = new.key and g.status = 'open'; return null; end $$;
drop trigger if exists kcal_gap_food on public.kcal_foods;
create trigger kcal_gap_food after insert on public.kcal_foods for each row execute function private.kcal_gap_food();
