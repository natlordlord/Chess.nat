-- Applause in the calorie tracker: a friend reached their goal today, you clap once for that day.
create table if not exists public.kcal_claps (
  from_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  to_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id, day),
  check (from_id <> to_id)
);
create index if not exists kcal_claps_to on public.kcal_claps(to_id, day);
alter table public.kcal_claps enable row level security;
create policy kcal_claps_read on public.kcal_claps for select to authenticated using (from_id = auth.uid() or to_id = auth.uid());
create policy kcal_claps_add on public.kcal_claps for insert to authenticated with check (from_id = auth.uid());
