-- Wer etwas gemeldet oder sich etwas gewünscht hat, erfährt, wenn es bearbeitet wurde. Applied as migration "feedback_notify".
-- Feedback: sobald die Durchsicht es auf "done" setzt, bekommt der Melder eine Nachricht (einmal; reply = ein Satz für ihn, sonst sein eigener Text).
-- Ideen: wechselt der Status auf "wird gebaut" oder "fertig", erfahren es der Vorschlagende und alle, die dafür gestimmt haben.
alter table public.chess_feedback_triage add column if not exists reply text;
alter table public.chess_feedback_triage add column if not exists told_at timestamptz;

create or replace function private.feedback_told() returns trigger language plpgsql security definer set search_path = '' as $$
declare f public.chess_feedback; t text;
begin
  if new.status <> 'done' or new.told_at is not null then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'done' then return new; end if;
  begin
    select * into f from public.chess_feedback where id = new.feedback_id;
    if f.user_id is not null then
      t := coalesce(nullif(btrim(new.reply), ''), '„' || left(regexp_replace(coalesce(f.body, ''), '\s+', ' ', 'g'), 90) || case when char_length(coalesce(f.body, '')) > 90 then '…' else '' end || '“ ist erledigt. Danke fürs Melden!');
      perform private.push(f.user_id, 'feedback', '✅ Dein Feedback wurde umgesetzt', t, '/#home');
      new.told_at := now();
    end if;
  exception when others then null; end;
  return new;
end $$;
create or replace trigger chess_feedback_triage_told before insert or update of status on public.chess_feedback_triage for each row execute function private.feedback_told();

create or replace function private.idea_told() returns trigger language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  if new.status is not distinct from old.status or new.status not in ('building', 'done') then return new; end if;
  begin
    perform private.push(new.user_id, 'feedback',
      case new.status when 'building' then '🛠 Deine Idee wird gebaut' else '✅ Deine Idee ist da' end,
      '„' || new.title || '“' || case new.status when 'building' then ' ist jetzt in Arbeit.' else ' ist jetzt in der App. Probier''s aus!' end, '/#home');
    for u in select v.user_id from public.chess_idea_votes v where v.idea_id = new.id and v.user_id <> new.user_id loop
      perform private.push(u, 'feedback',
        case new.status when 'building' then '🛠 Wird gebaut' else '✅ Ist da' end,
        '„' || new.title || '“ – du hast dafür gestimmt.', '/#home');
    end loop;
  exception when others then null; end;
  return new;
end $$;
create or replace trigger chess_ideas_told after update of status on public.chess_ideas for each row execute function private.idea_told();
