-- No phone notifications while you're in the app: the open app says "I'm here" every 25 seconds,
-- and a push is skipped while that is fresher than 40 seconds (the app shows its own card instead).
alter table public.chess_players add column if not exists active_at timestamptz;
grant update (active_at) on public.chess_players to authenticated;
create or replace function private.push(target uuid, kind text, title text, body text, url text) returns void language plpgsql security definer set search_path = '' as $$
declare fn text; hk text;
begin
  select c.v into fn from private.push_config c where c.k = 'fn_url';
  select c.v into hk from private.push_config c where c.k = 'hook_key';
  if fn is null or hk is null or target is null then return; end if;
  if not exists (select 1 from public.chess_push p where p.user_id = target) then return; end if;
  if exists (select 1 from public.chess_players pl where pl.id = target and pl.active_at > now() - interval '40 seconds') then return; end if;
  perform net.http_post(url := fn, body := jsonb_build_object('to', target, 'kind', kind, 'title', title, 'body', body, 'url', url),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-key', hk), timeout_milliseconds := 8000);
end $$;
