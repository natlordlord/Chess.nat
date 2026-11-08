-- 2026-11-08: news can carry a round video message, the text is optional, and the team can delete old messages.
alter table public.chess_news add column if not exists video_url text;

update storage.buckets set file_size_limit = 52428800,
  allowed_mime_types = array['audio/mp4','audio/aac','audio/mpeg','audio/webm','audio/ogg','audio/wav','audio/x-m4a','audio/mp3','video/mp4','video/webm','video/quicktime']
where id = 'news';

create or replace function public.news_post_v(t text, b text, a text default null, v text default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare nid bigint;
begin
  if not exists (select 1 from private.news_admins x where x.user_id = auth.uid()) then raise exception 'not_allowed'; end if;
  insert into public.chess_news (title, body, audio_url, video_url)
  values (coalesce(nullif(btrim(t), ''), 'Nachricht von Nathan'), coalesce(btrim(b), ''), nullif(btrim(coalesce(a, '')), ''), nullif(btrim(coalesce(v, '')), ''))
  returning id into nid;
  return nid;
end $$;
revoke all on function public.news_post_v(text, text, text, text) from public, anon;
grant execute on function public.news_post_v(text, text, text, text) to authenticated;

create or replace function public.news_delete(nid bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from private.news_admins x where x.user_id = auth.uid()) then raise exception 'not_allowed'; end if;
  delete from public.chess_news where id = nid;
end $$;
revoke all on function public.news_delete(bigint) from public, anon;
grant execute on function public.news_delete(bigint) to authenticated;

create or replace function public.news_broadcast(nid bigint) returns integer
language plpgsql security definer set search_path = '' as $$
declare n record; u uuid; c integer := 0; txt text;
begin
  if not exists (select 1 from private.news_admins a where a.user_id = auth.uid()) then raise exception 'not_allowed'; end if;
  select * into n from public.chess_news where id = nid;
  if not found then raise exception 'no_news'; end if;
  if n.pushed_at is not null then raise exception 'already_sent'; end if;
  txt := coalesce(nullif(btrim(n.body), ''), case when n.video_url is not null then '🎥 Videobotschaft' when n.audio_url is not null then '🎤 Sprachnachricht' else 'Tippe zum Ansehen' end);
  for u in select distinct p.user_id from public.chess_push p loop
    perform private.push(u, 'news', n.title, txt, '/#home');
    c := c + 1;
  end loop;
  update public.chess_news set pushed_at = now(), pushed_count = c where id = nid;
  return c;
end $$;
