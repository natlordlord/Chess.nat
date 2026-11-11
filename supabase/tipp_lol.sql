-- Tippspiel: League of Legends (sport 'lol') is tipped like a UFC title fight: pick the winner, 3 points.
-- Rewrites the five functions that only knew 'mma' in place (each replacement must hit, otherwise it stops).
do $do$
declare r record; d text; n text;
begin
  for r in select * from (values
    ('tipp_pts', $a$p_sport = 'mma'$a$, $b$p_sport in ('mma', 'lol')$b$),
    ('tipp_pick', $a$elsif ev.sport = 'mma' and coalesce((ev.meta ->> 'title')::boolean, false) then$a$, $b$elsif (ev.sport = 'mma' and coalesce((ev.meta ->> 'title')::boolean, false)) or ev.sport = 'lol' then$b$),
    ('tipp_table', $a$x.sport = 'mma' and x.pts = 3$a$, $b$x.sport in ('mma', 'lol') and x.pts = 3$b$),
    ('tipp_lines', $a$case when e.sport = 'mma' then split_part($a$, $b$case when e.sport = 'lol' then case when p.w = 'a' then e.home else e.away end when e.sport = 'mma' then split_part($b$),
    ('tipp_final', $a$case when ev.sport = 'mma' then '🥊 ' ||$a$, $b$case when ev.sport in ('mma', 'lol') then case when ev.sport = 'lol' then '🎮 ' else '🥊 ' end ||$b$),
    ('tipp_final', $a$(ev.sport = 'mma' and r.pts = 3)$a$, $b$(ev.sport in ('mma', 'lol') and r.pts = 3)$b$)
  ) v(fn, old, new) loop
    select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = r.fn;
    if position(r.new in d) > 0 then continue; end if;
    n := replace(d, r.old, r.new);
    if n = d then raise exception 'tipp_lol: % not found in %', r.old, r.fn; end if;
    execute n;
  end loop;
end $do$;

-- The big series are entered by hand for now (id 'man:lol-…', sport 'lol', meta.title true; the result as state 'post',
-- score_h/score_a = games won, meta.winner 'a' or 'b'). supabase/functions/tipp-lol would pull them from the LoL Esports
-- schedule on its own; it is written but NOT deployed and has no cron job yet.
