-- 2026-11-09: Nathan sends gift chests from the news editor (to everyone or to chosen players).
-- Each gift is one chess_fixes row per player; the app turns puzzle.gift into a chest that opens by itself. Additive.
create or replace function public.chess_gift_send(targets uuid[], gift jsonb)
returns int language plpgsql security definer set search_path = public, private as $$
declare n int; gid text := 'gift-' || replace(gen_random_uuid()::text, '-', '');
begin
  if not exists (select 1 from private.news_admins a where a.user_id = auth.uid()) then raise exception 'not_admin'; end if;
  if gift is null or jsonb_typeof(gift) <> 'object' or octet_length(gift::text) > 4000 then raise exception 'bad_gift'; end if;
  insert into public.chess_fixes (id, user_id, xp, pz, note, puzzle)
  select gid, p.id, 0, 0, 'Geschenk: ' || left(coalesce(gift->>'msg', ''), 100), jsonb_build_object('gift', gift)
  from public.chess_players p
  where (targets is null or p.id = any(targets)) and exists (select 1 from auth.users u where u.id = p.id)
  on conflict (user_id, id) do nothing;
  get diagnostics n = row_count; return n;
end $$;
revoke all on function public.chess_gift_send(uuid[], jsonb) from public, anon;
grant execute on function public.chess_gift_send(uuid[], jsonb) to authenticated;
-- pictures in gift chests live in the public news bucket
update storage.buckets set allowed_mime_types = (select array(select distinct unnest(coalesce(allowed_mime_types, '{}') || array['image/jpeg','image/png','image/webp','image/gif'])))
where id = 'news';
