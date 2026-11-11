-- Kalorien-Tracker, part 2 (applied as migrations kcal_source_search, kcal_body_weights_ice, kcal_ice_streak_and_friend_pushes)
-- * kcal_meals.source may also be 'search' (picked in the search) and 'quick' (added again from "Oft gegessen")
-- * kcal_body: what the day's needs are made of, only the person sees it (aim, sex, born, height, weight, activity,
--   custom = targets typed by hand, weigh_min = minute of day of the first fasted weigh-in, setup_at)
-- * kcal_profile: protein / carbs / fat targets (g), ice (streak freezes, 0–2), fpush (pushes when friends eat or reach their goal)
-- * kcal_weights: weigh-ins (kg, fasted = nothing logged that day yet, pooped)
-- * kcal_ice: days covered by a streak freeze; private.kcal_recalc counts them as bridges (no +1),
--   every full week of flames earns one freeze (max 2); private.kcal_ice_tick (cron 'kcal-ice', 23:05 UTC) uses one for a missed day;
--   public.kcal_buy_ice() adds one bought with Natcoins (coins are counted on the phone)
-- * private.on_kcal_meal_new (trigger kcal_meal_friends): "<emoji> <name> hat gegessen" push to friends who track, once per 10-minute burst
alter table public.kcal_meals drop constraint if exists kcal_meals_source_check;
alter table public.kcal_meals add constraint kcal_meals_source_check check (source in ('voice', 'barcode', 'manual', 'text', 'search', 'quick'));
create table if not exists public.kcal_body (
  user_id uuid primary key references auth.users(id) on delete cascade,
  aim text check (aim in ('lose', 'keep', 'gain', 'muscle', 'bulk')), sex text check (sex in ('m', 'f')),
  born smallint check (born between 1900 and 2030), height smallint check (height between 100 and 250),
  weight numeric(5,1) check (weight between 25 and 400), activity numeric(4,3) check (activity between 1 and 2.5),
  custom boolean not null default false, weigh_min smallint check (weigh_min between 0 and 1439), setup_at timestamptz, updated_at timestamptz not null default now());
alter table public.kcal_body enable row level security;
create policy "kcal body: own" on public.kcal_body for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter table public.kcal_profile add column if not exists protein smallint, add column if not exists carbs smallint, add column if not exists fat smallint,
  add column if not exists ice smallint not null default 0 check (ice between 0 and 2), add column if not exists fpush boolean not null default true;
create table if not exists public.kcal_weights (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  ts timestamptz not null default now(), day date not null, kg numeric(5,1) not null check (kg between 25 and 400), fasted boolean, pooped boolean, created_at timestamptz not null default now());
create index if not exists kcal_weights_user_ts on public.kcal_weights(user_id, ts desc);
alter table public.kcal_weights enable row level security;
create policy "kcal weights: own" on public.kcal_weights for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create table if not exists public.kcal_ice (user_id uuid not null references auth.users(id) on delete cascade, day date not null, primary key (user_id, day));
alter table public.kcal_ice enable row level security;
create policy "kcal ice: see own and friends" on public.kcal_ice for select to authenticated using (public.kcal_can_see(user_id));
-- functions: see the migration kcal_ice_streak_and_friend_pushes (private.kcal_recalc, private.kcal_ice_tick, public.kcal_buy_ice, private.on_kcal_meal_new)

-- Part 3: what each person cares about (shown big / as columns) and pinned suggestions
alter table public.kcal_profile add column if not exists show text[];
alter table public.kcal_profile add column if not exists pins jsonb not null default '[]'::jsonb;
alter table public.kcal_profile drop constraint if exists kcal_profile_show_ok;
alter table public.kcal_profile add constraint kcal_profile_show_ok check (show is null or (cardinality(show) between 1 and 3 and show <@ array['kcal','carbs','protein','fat']));
alter table public.kcal_profile drop constraint if exists kcal_profile_pins_ok;
alter table public.kcal_profile add constraint kcal_profile_pins_ok check (jsonb_typeof(pins) = 'array' and jsonb_array_length(pins) <= 12 and octet_length(pins::text) < 60000);
