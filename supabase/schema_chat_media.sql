-- Chess.nat chat: voice messages and shared games. Additive only.
-- The files live in a private storage bucket: you can upload into your own folder, and read your own files plus the files
-- a friend sent you in a message. A message points at its file: "🎤 voice|<path>|<seconds>" or "♟ game|<path>|<title>".

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chess-chat', 'chess-chat', false, 3145728, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'application/json'])
on conflict (id) do nothing;

drop policy if exists "chess-chat: upload own" on storage.objects;
create policy "chess-chat: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'chess-chat' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "chess-chat: read own or sent to me" on storage.objects;
create policy "chess-chat: read own or sent to me" on storage.objects for select to authenticated
  using (bucket_id = 'chess-chat' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.chess_messages m where m.to_id = (select auth.uid()) and m.from_id::text = (storage.foldername(name))[1] and position(name in m.body) > 0)));

-- the push for a voice message or a shared game says what it is, not the file path
create or replace function private.on_message() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.push(new.to_id, 'messages', private.pname(new.from_id),
    case when new.body like '🎤 voice|%' then '🎤 Voice message'
         when new.body like '♟ game|%' then '♟ ' || left(split_part(new.body, '|', 3), 120)
         else left(new.body, 140) end,
    '/#chat-' || new.from_id::text);
  return new; end $$;
