-- Patch-Notes: Sobald Fixes und Wünsche aus Feedback und Ideen live sind, bekommt jeder eine Update-Nachricht:
-- was sich geändert hat und wer es sich gewünscht oder gemeldet hat. Applied as migration "chess_news_patch".
-- Die Nachricht ist eine normale Neuigkeit (chess_news) mit einer Liste in "patch"; die App zeigt sie als Update-Karte,
-- mit dem Namen des Wünschenden bei jedem Punkt ("Dein Wunsch!" bei einem selbst). Als Push geht sie an alle.
alter table public.chess_news add column if not exists patch jsonb;

-- items: [{"t": "Was sich geändert hat", "by": "Name", "uid": "<user id oder null>", "k": "wish" | "bug", "area": "Kalorien"}]
-- Nur der Betreiber ruft das auf (private Schema, kein Zugriff aus der App). Der Push läuft als Art "news": wer Neuigkeiten abbestellt hat, bekommt auch keine Updates.
create or replace function private.patch_post(t text, items jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare nid bigint; u uuid; c integer := 0; body text; ptxt text;
begin
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then raise exception 'no_items'; end if;
  select string_agg('• ' || (x ->> 't') || coalesce(' (' || nullif(x ->> 'by', '') || ')', ''), E'\n') into body from jsonb_array_elements(items) x;
  select string_agg(coalesce(nullif(x ->> 'area', ''), left(x ->> 't', 40)) || coalesce(' – ' || nullif(x ->> 'by', ''), ''), ' · ') into ptxt from jsonb_array_elements(items) x;
  insert into public.chess_news (title, body, patch)
  values (left(coalesce(nullif(btrim(t), ''), '🛠 Update ist live'), 80), left(body, 300), items)
  returning id into nid;
  for u in select distinct p.user_id from public.chess_push p loop
    perform private.push(u, 'news', left(coalesce(nullif(btrim(t), ''), '🛠 Update ist live'), 80), left(ptxt, 180), '/#home');
    c := c + 1;
  end loop;
  update public.chess_news set pushed_at = now(), pushed_count = c where id = nid;
  return nid;
end $$;
revoke all on function private.patch_post(text, jsonb) from public, anon, authenticated;
