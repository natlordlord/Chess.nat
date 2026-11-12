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

-- Seit 13.11.2026 (Migration "kcal_own_products_shared", Wunsch von Finnel): ein abfotografiertes Produkt ist sofort für alle da
-- (Barcode und Suche), gekennzeichnet mit dem Namen dessen, der es fotografiert hat. Der Betreiber nimmt ein falsches mit
-- status 'bad' wieder heraus; 'ok' heißt weiterhin "vom Betreiber geprüft" und hat bei mehreren Fotos desselben Barcodes Vorrang.
alter table public.kcal_own_products add column if not exists author text not null default '';
-- who photographed it is filled in here, never taken from the phone; the phone can't change the status either
create or replace function private.kcal_own_stamp() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;   -- the operator (SQL editor) may set anything
  new.user_id := auth.uid(); new.author := left(private.pname(auth.uid()), 40); new.name := btrim(new.name);
  if tg_op = 'UPDATE' then new.status := old.status; new.created_at := old.created_at; else new.status := 'new'; end if;
  return new;
end $$;
drop trigger if exists kcal_own_stamp on public.kcal_own_products;
create trigger kcal_own_stamp before insert or update on public.kcal_own_products for each row execute function private.kcal_own_stamp();
drop policy if exists kcal_own_read on public.kcal_own_products;
create policy kcal_own_read on public.kcal_own_products for select to authenticated using (user_id = (select auth.uid()) or status <> 'bad');
drop policy if exists kcal_own_edit on public.kcal_own_products;
create policy kcal_own_edit on public.kcal_own_products for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
update public.kcal_own_products o set author = left(private.pname(o.user_id), 40) where author = '';
create index if not exists kcal_own_name_idx on public.kcal_own_products (lower(name));
