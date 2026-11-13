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
