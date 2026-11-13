-- Fair Play (Migration "chess_fairplay"): Hat jemand etwas Feindseliges über einen anderen Spieler geschrieben, trägt der
-- Betreiber den Fall hier ein (nur er, von Fall zu Fall; die App kann nichts eintragen). Die Person sieht dann statt der App
-- einen Hinweis mit dem eigenen Satz, ihre NatCoins sind weg, und erst langes Drücken auf „Ich entschuldige mich“ gibt die App
-- wieder frei, mit 5.000 NatCoins als Neustart (FairPlay in index.html). Niemand außer der Person selbst kann die Zeile lesen.
-- Einen Fall anlegen (SQL-Editor):  insert into public.chess_fairplay (user_id, quote) values ('<uuid>', '<was geschrieben wurde>');
create table if not exists public.chess_fairplay (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quote text not null check (char_length(quote) between 1 and 300),
  status text not null default 'open' check (status in ('open', 'sorry')),
  created_at timestamptz not null default now(),
  sorry_at timestamptz
);
create index if not exists chess_fairplay_user on public.chess_fairplay(user_id, status);
alter table public.chess_fairplay enable row level security;
create policy chess_fairplay_read on public.chess_fairplay for select to authenticated using (user_id = (select auth.uid()));
grant select on public.chess_fairplay to authenticated;
-- the apology: true exactly once per case (that phone hands out the fresh start)
create or replace function public.fairplay_sorry(fid uuid) returns boolean language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.chess_fairplay set status = 'sorry', sorry_at = now() where id = fid and user_id = auth.uid() and status = 'open';
  get diagnostics n = row_count; return n > 0;
end $$;
revoke all on function public.fairplay_sorry(uuid) from public, anon;
grant execute on function public.fairplay_sorry(uuid) to authenticated;

-- Melden (Migration "chess_fairplay_report"): Der Betreiber tippt in der App bei einem Feedback oder einer Idee auf „Melden“.
-- Der Eintrag wird gelöscht und für den Verfasser ein Fall mit genau diesem Satz angelegt (außer er hat schon einen offenen).
-- Antwort: 'warned' = Fall angelegt, 'already' = offener Fall war schon da, 'removed' = nur gelöscht (Eintrag ohne Verfasser).
-- „Mit Schande“ (shame): Vor der Entschuldigung sagt eine Stimme „Schande!“ und die Person muss viermal die Glocke läuten.
alter table public.chess_fairplay add column if not exists shame boolean not null default false;
create or replace function public.fairplay_report(src text, rid uuid, shame boolean default false) returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid; q text;
begin
  if not public.news_is_admin() then raise exception 'not allowed'; end if;
  if src = 'idea' then select user_id, coalesce(body, title) into uid, q from public.chess_ideas where id = rid;
  elsif src = 'feedback' then select user_id, body into uid, q from public.chess_feedback where id = rid;
  else raise exception 'unknown source'; end if;
  if not found then raise exception 'not found'; end if;
  if uid = auth.uid() then raise exception 'own entry'; end if;
  if src = 'idea' then delete from public.chess_ideas where id = rid; else delete from public.chess_feedback where id = rid; end if;
  if uid is null then return 'removed'; end if;
  if exists (select 1 from public.chess_fairplay where user_id = uid and status = 'open') then return 'already'; end if;
  insert into public.chess_fairplay (user_id, quote, shame) values (uid, left(btrim(q), 300), coalesce(fairplay_report.shame, false));
  return 'warned';
end $$;
revoke all on function public.fairplay_report(text, uuid, boolean) from public, anon;
grant execute on function public.fairplay_report(text, uuid, boolean) to authenticated;
