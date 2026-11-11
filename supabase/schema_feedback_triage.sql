-- What happened to each piece of feedback: read once a day, sorted into a kind, and worked on.
-- Only the operator (service role / SQL editor) reads and writes this; the app has no access (RLS on, no policies).
create table if not exists public.chess_feedback_triage (
  feedback_id uuid primary key references public.chess_feedback(id) on delete cascade,
  kind text not null check (kind in ('bug', 'wish', 'question', 'praise', 'noise')),
  status text not null default 'open' check (status in ('open', 'proposed', 'done', 'skipped')),
  summary text not null default '',
  pr text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.chess_feedback_triage enable row level security;
