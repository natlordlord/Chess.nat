// NOT DEPLOYED YET (no cron job either): until it is, the big series are entered by hand, see supabase/tipp_lol.sql.
// Chess.nat Tippspiel, League of Legends: every two minutes (pg_cron -> private.tipp_lol_tick) this would pull the big
// series from the LoL Esports schedule (Worlds, MSI, First Stand, LEC; only finals, playoffs, knockouts and best-of-five,
// no LCS) into tipp_events as sport "lol". They are tipped like a UFC title fight: pick the winner, 3 points.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
type J = Record<string, any>;
const API = "https://esports-api.lolesports.com/persisted/gw";
const KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z"; /* the public key of the lolesports.com website */
/* which leagues, and which of their rounds count as big */
const BIG: Record<string, RegExp> = { worlds: /final|semi|quarter|knockout|playoff/i, msi: /final|semi|knockout|playoff|bracket/i, first_stand: /final|semi|knockout|playoff/i, lec: /final|playoff/i };
let leagueIds: string | null = null;

async function get(path: string): Promise<J | null> {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 9000);
  try { const r = await fetch(`${API}/${path}`, { signal: c.signal, headers: { "x-api-key": KEY, "user-agent": "Mozilla/5.0 chessnat-tipp" } }); if (!r.ok) return null; return await r.json(); }
  catch (_) { return null; } finally { clearTimeout(t); }
}
const r2 = (x: number) => Math.round(x * 100) / 100;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const fair = (p: number) => r2(clamp(0.94 / Math.max(p, 0.001), 1.03, 60));
const recP = (r?: J) => { const w = +(r?.wins || 0), l = +(r?.losses || 0); return (w + 3) / (w + l + 6); };

function toEvent(e: J): J | null {
  const m = e.match, ts = (m?.teams || []) as J[], slug = String(e.league?.slug || "");
  if (e.type !== "match" || !m?.id || ts.length !== 2 || !BIG[slug]) return null;
  const [A, B] = ts; if (!A?.name || !B?.name || /^tbd$/i.test(A.name) || /^tbd$/i.test(B.name)) return null;
  const block = String(e.blockName || ""), bo = +(m.strategy?.count || 0);
  if (!BIG[slug].test(block) && bo < 5) return null;
  const st = e.state === "completed" ? "post" : e.state === "inProgress" ? "in" : "pre", ga = +(A.result?.gameWins || 0), gb = +(B.result?.gameWins || 0);
  const winner = st === "post" ? (A.result?.outcome === "win" || ga > gb ? "a" : B.result?.outcome === "win" || gb > ga ? "b" : null) : null;
  return { id: `lol:${m.id}`, sport: "lol", comp: "lol", name: [e.league?.name, block].filter(Boolean).join(" · "), home: A.name, away: B.name, home_logo: A.image || null, away_logo: B.image || null,
    home_id: A.code || null, away_id: B.code || null, start_at: e.startTime, state: st, clock: st === "in" ? `Spiel ${ga + gb + 1} · ${ga}:${gb}` : st === "post" ? `${ga}:${gb}` : null,
    score_h: st === "pre" ? null : ga, score_a: st === "pre" ? null : gb, fav: /final/i.test(block) && !/semi|quarter/i.test(block),
    meta: { slug, block, bo, winner, title: true, rec: [A.record ? `${A.record.wins}-${A.record.losses}` : null, B.record ? `${B.record.wins}-${B.record.losses}` : null], pa: r2(clamp(0.5 + (recP(A.record) - recP(B.record)) * 0.9, 0.2, 0.8)) } };
}

async function sync() {
  const now = new Date(), log: string[] = [];
  if (!leagueIds){ const j = await get("getLeagues?hl=en-US"); const L = ((j?.data?.leagues || []) as J[]).filter(l => BIG[l.slug]); if (!L.length) return { error: "no leagues" }; leagueIds = L.map(l => l.id).join(","); }
  const j = await get(`getSchedule?hl=en-US&leagueId=${leagueIds}`); if (!j) return { error: "no schedule" };
  const all = ((j.data?.schedule?.events || []) as J[]).map(toEvent).filter(Boolean) as J[];
  const keep = all.filter(e => { const t = Date.parse(e.start_at); return t > now.getTime() - 3 * 864e5 && t < now.getTime() + 40 * 864e5; });
  if (!keep.length) return { events: 0 };
  const old: Record<string, J> = {}; { const { data } = await sb.from("tipp_events").select("id,state,markets,meta").in("id", keep.map(e => e.id)); (data || []).forEach((r: J) => old[r.id] = r); }
  const up = keep.map(e => Object.assign({}, e, { meta: Object.assign({}, old[e.id]?.meta || {}, e.meta), updated_at: now.toISOString() }));
  { const { error } = await sb.from("tipp_events").upsert(up, { onConflict: "id" }); if (error) return { error: "upsert " + error.message }; }
  for (const e of up){ const o = old[e.id];
    /* the winner market (for Nat-KI's tip), once, before the start */
    if (e.state === "pre" && Date.parse(e.start_at) > now.getTime() + 60e3 && !(o?.markets || []).length){
      const pa = e.meta.pa || 0.5, markets = [{ k: "win", t: "Sieger", o: [{ p: "a", l: e.home, q: fair(pa), pr: pa }, { p: "b", l: e.away, q: fair(1 - pa), pr: r2(1 - pa) }] }];
      const { error } = await sb.from("tipp_events").update({ markets, model: { pa }, odds_src: "model", odds_at: now.toISOString() }).eq("id", e.id).eq("state", "pre"); if (error) log.push("markets " + error.message);
      if (Date.parse(e.start_at) < now.getTime() + 4 * 864e5){ const { count } = await sb.from("tipp_picks").select("id", { count: "exact", head: true }).eq("event_id", e.id).eq("bot", "ki");
        if (!count) await sb.from("tipp_picks").insert({ bot: "ki", event_id: e.id, w: Math.random() < pa ? "a" : "b" }); } }
    /* an hour before: a reminder */
    const t = Date.parse(e.start_at) - now.getTime();
    if (e.state === "pre" && t > 40 * 60e3 && t < 75 * 60e3 && !e.meta.rem){ try { await sb.rpc("tipp_remind", { p_event: e.id, p_title: `🎮 Gleich: ${e.home} vs. ${e.away}`, p_body: `${e.name}. In einer Stunde geht's los. Noch kein Tipp? Sieger tippen, fertig.` }); } catch (_) { /* ignore */ }
      await sb.from("tipp_events").update({ meta: Object.assign({}, e.meta, { rem: true }) }).eq("id", e.id); }
    /* over: everyone with a tip hears how it went (once; tipp_final marks it) */
    if (e.state === "post" && e.meta.winner && !e.meta.pp){ try { await sb.rpc("tipp_final", { p_event: e.id }); } catch (er) { log.push("final " + String(er)); } }
  }
  return { events: keep.length, log };
}

Deno.serve(async (req) => {
  try {
    const { data, error } = await sb.rpc("push_config"); if (error) throw error;
    if (req.headers.get("x-hook-key") !== (data as Record<string, string>).hook_key) return new Response("forbidden", { status: 401 });
    const out = await sync(); console.log("lol", JSON.stringify(out));
    return Response.json(out);
  } catch (e) {
    console.log("error", String(e));
    return new Response("error " + String(e), { status: 500 });
  }
});
