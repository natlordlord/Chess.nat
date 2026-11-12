-- Ideen-Voting: jeder schlägt vor, alle stimmen ab, was oben steht wird gebaut. Applied as migration "chess_ideas".
-- Die App liest beide Tabellen getrennt (Ideen + Stimmen) und zählt selbst; Status setzt nur ein News-Admin.
create table if not exists public.chess_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text,
  title text not null check (char_length(title) between 3 and 120),
  body text check (body is null or char_length(body) <= 600),
  status text not null default 'open' check (status in ('open', 'building', 'done', 'closed')),
  created_at timestamptz not null default now()
);
alter table public.chess_ideas enable row level security;
create policy chess_ideas_read on public.chess_ideas for select to authenticated using (true);
create policy chess_ideas_add on public.chess_ideas for insert to authenticated with check (user_id = auth.uid());
create policy chess_ideas_edit on public.chess_ideas for update to authenticated using (user_id = auth.uid() or public.news_is_admin()) with check (user_id = auth.uid() or public.news_is_admin());
create policy chess_ideas_del on public.chess_ideas for delete to authenticated using (user_id = auth.uid() or public.news_is_admin());
grant select, insert, update, delete on public.chess_ideas to authenticated;

create table if not exists public.chess_idea_votes (
  idea_id uuid not null references public.chess_ideas(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);
alter table public.chess_idea_votes enable row level security;
create policy chess_idea_votes_read on public.chess_idea_votes for select to authenticated using (true);
create policy chess_idea_votes_add on public.chess_idea_votes for insert to authenticated with check (user_id = auth.uid());
create policy chess_idea_votes_del on public.chess_idea_votes for delete to authenticated using (user_id = auth.uid());
grant select, insert, delete on public.chess_idea_votes to authenticated;
create index if not exists chess_idea_votes_idea_idx on public.chess_idea_votes(idea_id);

-- Wer hat eingeladen? Der Einladungsfilm (/invite?ref=<handle>) läuft ohne Konto, darf aber den Namen zeigen.
create or replace function public.invite_who(h text)
returns table(name text, avatar jsonb, recruits integer)
language sql stable security definer set search_path = ''
as $$
  select p.name, p.avatar, (select count(*)::integer from public.chess_players r where r.referred_by = p.id)
  from public.chess_players p where p.handle = lower(h) limit 1;
$$;
grant execute on function public.invite_who(text) to anon, authenticated;
