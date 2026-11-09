-- 2026-11-09 (NOT applied yet, needs Nathan's OK): let the admin replace or delete a recorded voice line in the news bucket (lines/<id>).
drop policy if exists "news_lines_admin_update" on storage.objects;
create policy "news_lines_admin_update" on storage.objects for update to authenticated using (bucket_id = 'news' and name like 'lines/%' and public.news_is_admin()) with check (bucket_id = 'news' and name like 'lines/%' and public.news_is_admin());
drop policy if exists "news_lines_admin_delete" on storage.objects;
create policy "news_lines_admin_delete" on storage.objects for delete to authenticated using (bucket_id = 'news' and name like 'lines/%' and public.news_is_admin());
