-- Wolfsuii's wish (18.11.2026): "Fehler korrigieren" while tracking. Migration "kcal_fixes_and_portions".
-- 1) Wrong numbers of a product (e.g. 0 kcal at Open Food Facts): photograph its nutrition table; the printed numbers are read
--    off and confirmed, like a pack nobody knows. Such a row is marked fix = true and then wins over Open Food Facts for that
--    barcode, for everybody, marked with who corrected it. The operator takes a wrong one out with status 'bad'.
alter table public.kcal_own_products add column if not exists fix boolean not null default false;
create index if not exists kcal_own_fix_idx on public.kcal_own_products (code) where fix;

-- 2) The portion ("1 Brötchen = 60 g" but it weighs 70 g): grams per piece/portion. For a barcode product it counts for
--    everybody (shared), for a food without barcode only for the one who set it (rolls are different everywhere).
create table if not exists public.kcal_portions (
  key text not null check (char_length(key) between 3 and 140),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  g numeric not null check (g > 0 and g <= 2000),
  shared boolean not null default false,
  author text not null default '',
  created_at timestamptz not null default now(),
  primary key (key, user_id)
);
alter table public.kcal_portions enable row level security;
create policy kcal_por_read on public.kcal_portions for select to authenticated using (user_id = (select auth.uid()) or shared);
create policy kcal_por_add on public.kcal_portions for insert to authenticated with check (user_id = (select auth.uid()));
create policy kcal_por_edit on public.kcal_portions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy kcal_por_del on public.kcal_portions for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.kcal_portions to authenticated;
create or replace function private.kcal_por_stamp() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  new.user_id := auth.uid(); new.author := left(coalesce(private.pname(auth.uid()), ''), 40); new.created_at := now();
  new.shared := new.key like 'c:%';
  return new;
end $$;
create trigger kcal_por_stamp before insert or update on public.kcal_portions for each row execute function private.kcal_por_stamp();
