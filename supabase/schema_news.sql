-- News from the app owner: shown once a day in the app until newer news replaces it, and pushed to every phone
-- only when the owner presses "send" (rpc news_broadcast). Applied as migration "chess_news".
create table if not exists public.chess_news (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now(),
  pushed_at timestamptz,
  pushed_count integer
);
alter table public.chess_news enable row level security;
create policy chess_news_read on public.chess_news for select to anon, authenticated using (true);
grant select on public.chess_news to anon, authenticated;
create table if not exists private.news_admins (user_id uuid primary key);
-- functions news_is_admin(), news_post(t, b), news_broadcast(nid): security definer, admin-only (see migration)
-- voice messages (migration "chess_news_audio"): chess_news.audio_url, public storage bucket "news" (audio only, 15 MB),
-- uploads only for news admins; news_post(t, b, a) takes the audio URL.
