-- Song raten: the ranking across all players (Nathan, Nov 2026: who is how good, titles like "Oldie-Scanner" or
-- "Musical-Experte", and how fast someone knows a song). After an online game each phone adds its own player's numbers
-- with song_add(); song_board() lists everyone you may see (hidden players stay hidden, like everywhere else).
create table if not exists public.song_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  games int not null default 0,
  won int not null default 0,
  heard int not null default 0,
  right_n int not null default 0,
  pts int not null default 0,
  ms_sum bigint not null default 0,
  ms_n int not null default 0,
  best_ms int,
  genres jsonb not null default '{}'::jsonb,   -- {"y80": [right, heard], …}
  updated_at timestamptz not null default now()
);
alter table public.song_stats enable row level security;
drop policy if exists "song stats: read visible" on public.song_stats;
create policy "song stats: read visible" on public.song_stats for select to authenticated
  using (private.player_visible((select auth.uid()), user_id));

-- one finished game of the signed-in player; the numbers are kept in plausible bounds
create or replace function public.song_add(p_won int, p_heard int, p_right int, p_pts int, p_ms int[], p_genres jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  ms_ok int[];
  cur jsonb;
  k text;
  v jsonb;
begin
  if u is null then return; end if;
  p_heard := least(greatest(coalesce(p_heard, 0), 0), 60);
  p_right := least(greatest(coalesce(p_right, 0), 0), p_heard);
  p_pts := least(greatest(coalesce(p_pts, 0), 0), 600);
  p_won := case when coalesce(p_won, 0) > 0 then 1 else 0 end;
  if p_heard = 0 then return; end if;
  select array_agg(x) into ms_ok from (select x from unnest(coalesce(p_ms, '{}'::int[])) x where x between 150 and 60000 limit 60) t;
  insert into public.song_stats(user_id) values (u) on conflict (user_id) do nothing;
  select genres into cur from public.song_stats where user_id = u for update;
  for k, v in select key, value from jsonb_each(coalesce(p_genres, '{}'::jsonb)) loop
    if k ~ '^[a-z0-9]{1,12}$' and jsonb_typeof(v) = 'array' then
      cur := jsonb_set(coalesce(cur, '{}'::jsonb), array[k], jsonb_build_array(
        coalesce((cur -> k ->> 0)::int, 0) + least(greatest(coalesce((v ->> 0)::int, 0), 0), 60),
        coalesce((cur -> k ->> 1)::int, 0) + least(greatest(coalesce((v ->> 1)::int, 0), 0), 60)));
    end if;
  end loop;
  update public.song_stats set
    games = games + 1, won = won + p_won, heard = heard + p_heard, right_n = right_n + p_right, pts = pts + p_pts,
    ms_sum = ms_sum + coalesce((select sum(x) from unnest(ms_ok) x), 0),
    ms_n = ms_n + coalesce(array_length(ms_ok, 1), 0),
    best_ms = (select min(x) from (select best_ms as x union all select unnest(ms_ok)) t),
    genres = cur, updated_at = now()
  where user_id = u;
end $$;
revoke all on function public.song_add(int, int, int, int, int[], jsonb) from public, anon;
grant execute on function public.song_add(int, int, int, int, int[], jsonb) to authenticated;

create or replace function public.song_board()
returns table(uid uuid, name text, avatar jsonb, games int, won int, heard int, right_n int, pts int, avg_ms int, best_ms int, genres jsonb)
language sql stable security definer set search_path = '' as $$
  select s.user_id, p.name, p.avatar, s.games, s.won, s.heard, s.right_n, s.pts,
    case when s.ms_n > 0 then (s.ms_sum / s.ms_n)::int end, s.best_ms, s.genres
  from public.song_stats s join public.chess_players p on p.id = s.user_id
  where private.player_visible(auth.uid(), s.user_id)
  order by s.pts desc, s.right_n desc
  limit 100;
$$;
revoke all on function public.song_board() from public, anon;
grant execute on function public.song_board() to authenticated;
