-- Kalorien-Tracker: Produkte, die Open Food Facts nicht kennt. Applied as migration "kcal_own_products".
-- Wer so eine Packung scannt, fotografiert die Nährwerttabelle; die gedruckten Zahlen werden abgelesen und er bestätigt sie.
-- Der Eintrag gilt zuerst NUR für ihn (status 'new'). Für alle sichtbar wird er erst, wenn der Betreiber Foto und Zahlen
-- verglichen und status auf 'ok' gesetzt hat – so kommt nichts Ungeprüftes in die gemeinsame Datenbank.
create table if not exists public.kcal_own_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text not null check (char_length(code) between 4 and 40),
  name text not null check (char_length(name) between 2 and 80),
  brand text not null default '' check (char_length(brand) <= 40),
  unit text not null default 'g' check (unit in ('g', 'ml')),
  k numeric not null check (k >= 0 and k <= 900),
  c numeric not null check (c >= 0 and c <= 100), p numeric not null check (p >= 0 and p <= 100), f numeric not null check (f >= 0 and f <= 100),
  fi numeric not null default 0, su numeric not null default 0, sf numeric not null default 0, sa numeric not null default 0,
  img text check (img is null or char_length(img) <= 400000),
  status text not null default 'new' check (status in ('new', 'ok', 'bad')),
  created_at timestamptz not null default now(),
  unique (user_id, code)
);
alter table public.kcal_own_products enable row level security;
create policy kcal_own_read on public.kcal_own_products for select to authenticated using (user_id = auth.uid() or status = 'ok');
create policy kcal_own_add on public.kcal_own_products for insert to authenticated with check (user_id = auth.uid() and status = 'new');
create policy kcal_own_edit on public.kcal_own_products for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and status = 'new');
grant select, insert, update on public.kcal_own_products to authenticated;
create index if not exists kcal_own_code_idx on public.kcal_own_products(code);
