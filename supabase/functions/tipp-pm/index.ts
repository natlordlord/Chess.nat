// Chess.nat Tippspiel, the library: games from Polymarket (https://gamma-api.polymarket.com, public, no key).
// Every 2 minutes (pg_cron -> private.tipp_pm_tick) this
//  1. once a day: the leagues Polymarket lists (/sports) -> public.tipp_leagues (motor racing, golf, cycling, poker are left out:
//     they have no "A against B")
//  2. every 10 minutes: the games of every league somebody follows (public.tipp_follows), 14 days ahead -> tipp_events "pm:<event id>"
//     football (home, draw, away) is tipped by score like every football game; everything else by winner (a draw where the
//     market has one), 3 points
//  3. every game whose result comes from Polymarket (id "pm:…", or a hand-entered one with meta.src.kind "pm"): live score while
//     it is played, the result as soon as it is in -> points (tipp_ev_pts) and the final push (tipp_final)
//  4. hand-entered games that wait for their market (meta.src.find): linked as soon as Polymarket lists them; still not listed
//     at the start -> called off, so nobody tips a game that can never be scored
//  5. watchdog for every game, whatever its source: long over and still no result -> one push to the admins
// The app calls it too (signed in): {league} loads that league's games at once after you follow it.
// Rule: a game without a result source is never created (trigger private.tipp_src_guard, see supabase/tipp_library.sql).
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL")!, SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(URL, SRV, { auth: { persistSession: false } });
type J = Record<string, any>;
const G = "https://gamma-api.polymarket.com";

async function get(path: string, ms = 12000): Promise<any> {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(G + path, { signal: c.signal, headers: { "user-agent": "Mozilla/5.0 chessnat-tipp", "accept": "application/json" } }); if (!r.ok) return null; return await r.json(); }
  catch (_) { return null; } finally { clearTimeout(t); }
}
const r2 = (x: number) => Math.round(x * 100) / 100;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const fair = (p: number) => r2(clamp(0.95 / Math.max(p, 0.001), 1.01, 60));
const arr = (s: unknown): any[] => { try { const a = typeof s === "string" ? JSON.parse(s) : s; return Array.isArray(a) ? a : []; } catch (_) { return []; } };
const nums = (s: unknown) => arr(s).map(Number);
const fold = (s: unknown) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const iso = (t: number) => new Date(t).toISOString();

/* ---------- 1. leagues ---------- */
/* already in the Tippspiel for everyone (ESPN): not offered again */
const BUILTIN = new Set(["bun", "ucl", "dfb", "ufc", "unl"]);
const SKIP = /^(f1|formulae|indycar|motogp|moto2|moto3|wsbk|nascar.*|pga|lpga|liv|dpwt|kft|cycling|poker|rodeo)$/;
const SKIP_TAG = new Set(["100219", "434", "102166"]);
const TAG: Record<string, string> = { "100350": "fb", "517": "cr", "28": "bk", "102883": "vb", "103767": "tt", "64": "es", "102193": "ru", "100088": "ih", "102897": "hb", "678": "bb", "864": "tn", "101437": "da", "102393": "x" };
const CODE: Record<string, string> = { nba: "bk", wnba: "bk", cbb: "bk", ncaab: "bk", euroleague: "bk", nbasl: "bk", nhl: "ih", mlb: "bb", wbc: "bb", nfl: "af", cfb: "af", ufl: "af", cfl: "af",
  ufc: "mma", boxing: "mma", zuffa: "mma", powerslap: "mma", afl: "ru", aflw: "ru", chess: "ch", mlp: "x", "ppa-doubles": "x" };
const grpOf = (k: string, tags: string[]) => CODE[k] || tags.map(t => TAG[t]).find(Boolean) || "x";
/* what most people look for comes first in its group */
const POPULAR = ["epl", "lal", "sea", "fl1", "uel", "col", "bl2", "fifwc", "euc", "ere", "por", "nba", "euroleague", "bkbbl", "nfl", "nhl", "dehl", "lol", "cs2", "val", "dota2", "atp", "wta", "boxing", "pdcdarts", "darts", "hbbundesliga", "hbehfcl", "chess", "mlb"];

async function leagues(force = false) {
  if (!force){ const { data } = await sb.from("tipp_leagues").select("updated_at").order("updated_at", { ascending: false }).limit(1);
    if (data?.[0] && Date.now() - Date.parse(data[0].updated_at) < 24 * 3600e3) return 0; }
  const j = await get("/sports", 20000); if (!Array.isArray(j)) return -1;
  const seen = new Set<string>(), rows: J[] = [], now = new Date().toISOString();
  for (const s of [...j].sort((a, b) => (+a.id || 0) - (+b.id || 0))){
    const k = String(s.sport || ""), ser = String(s.series || "").trim(), tags = String(s.tags || "").split(",");
    if (!k || !ser || SKIP.test(k) || tags.some(t => SKIP_TAG.has(t))) continue;
    if (seen.has(ser) && !BUILTIN.has(k)) continue; seen.add(ser);
    const pi = POPULAR.indexOf(k);
    rows.push({ key: k, name: String(s.name || k.toUpperCase()), grp: grpOf(k, tags), series: ser, image: s.image || null, rank: pi >= 0 ? pi : 100, builtin: BUILTIN.has(k), updated_at: now });
  }
  for (let i = 0; i < rows.length; i += 200){ const { error } = await sb.from("tipp_leagues").upsert(rows.slice(i, i + 200), { onConflict: "key" }); if (error) throw error; }
  return rows.length;
}

/* ---------- a Polymarket event -> a Tippspiel game ---------- */
const ENDED = /^(v?ft|final|aet|pen|ended|finished|f\/ot|f\/so)/i;
function score(s: unknown): [number, number] | null {
  const segs = String(s || "").split("|").map(x => x.trim()), seg = segs.length >= 2 ? segs[1] : segs[0];
  const m = seg.match(/^(\d+)\s*-\s*(\d+)$/); return m ? [+m[1], +m[2]] : null;
}
/* the part of the title that says where in the tournament it is ("Worlds Playoffs", "Montevideo") */
function sub(title: string, league: string) {
  const a = (title.match(/ - ([^-]{2,40})$/) || [])[1] || (title.match(/^([^:]{2,30}):/) || [])[1] || "";
  return a && fold(a) !== fold(league) && !/^(lol|cs2|dota ?2|valorant|r6|rl)$/i.test(a) ? a.trim() : "";
}
/* the game in Polymarket's words: two sides, their chances, and a winner once there is one */
function parse(x: J, grp: string) {
  const ml = ((x.markets || []) as J[]).filter(m => m.sportsMarketType === "moneyline");
  if (!ml.length) return null;
  const title = String(x.title || "");
  if (ml.length === 1){
    const m = ml[0], out = arr(m.outcomes).map(String), px = nums(m.outcomePrices);
    if (out.length !== 2 || /^yes$/i.test(out[0])) return null;
    const closed = m.closed === true || m.closed === "true", res = String(m.umaResolutionStatus || "");
    let win: string | null = null, void_ = false;
    if (px.length === 2){
      if ((closed || res === "resolved") && Math.abs(px[0] - 0.5) < 0.02 && Math.abs(px[1] - 0.5) < 0.02) void_ = true;
      else if (closed || res === "resolved"){ if (px[0] >= 0.99) win = "a"; else if (px[1] >= 0.99) win = "b"; }
      else if (x.ended === true && px[0] >= 0.98) win = "a"; else if (x.ended === true && px[1] >= 0.98) win = "b";
    }
    return { kind: "w2", a: out[0], b: out[1], p: px.length === 2 ? [r2(px[0]), r2(px[1])] : null, win, void_, ids: [m.id], title };
  }
  /* three markets "Will A win?", "Draw?", "Will B win?" (football, handball …) */
  const dr = ml.find(m => /^draw/i.test(String(m.groupItemTitle || ""))), teams = ml.filter(m => m !== dr);
  if (!dr || teams.length !== 2) return null;
  const pos = (m: J) => { const i = fold(title).indexOf(fold(m.groupItemTitle)); return i < 0 ? 999 : i; };
  teams.sort((p, q) => pos(p) - pos(q));
  const yes = (m: J) => nums(m.outcomePrices)[0], done = (m: J) => m.closed === true || m.closed === "true" || m.umaResolutionStatus === "resolved";
  const all = [teams[0], dr, teams[1]], py = all.map(yes);
  let win: string | null = null, void_ = false;
  if (all.every(done)){ const i = py.findIndex(v => v >= 0.99); if (i >= 0) win = ["a", "d", "b"][i]; else if (py.every(v => v < 0.02) || py.some(v => Math.abs(v - 0.5) < 0.02)) void_ = true; }
  else if (x.ended === true){ const i = py.findIndex(v => v >= 0.98); if (i >= 0) win = ["a", "d", "b"][i]; }
  const s = py.reduce((t, v) => t + (v || 0), 0) || 1;
  return { kind: grp === "fb" ? "fb" : "w3", a: String(teams[0].groupItemTitle), b: String(teams[1].groupItemTitle), p: py.map(v => r2((v || 0) / s)), win, void_, ids: all.map(m => m.id), title };
}
function logo(x: J, name: string) { const t = ((x.teams || []) as J[]).find(t => fold(t.name) === fold(name)); return t?.logo || null; }

/* the row for tipp_events (state, score and result included) */
function toRow(x: J, L: J, keep?: J) {
  const P = parse(x, L.grp); if (!P) return null;
  const st = x.startTime || (x.markets || [])[0]?.gameStartTime || x.endDate; if (!st) return null;
  const sc = score(x.score), live = x.live === true, ended = x.ended === true || ENDED.test(String(x.period || ""));
  const w = P.kind !== "fb";
  let state = live ? "in" : "pre", winner: string | null = null;
  if (P.void_) state = "canc";
  else if (w && P.win){ state = "post"; winner = P.win; }
  else if (!w && ended && sc && (P.win || x.ended === true)) state = "post";
  else if (ended || Date.parse(st) < Date.now()) state = state === "pre" && Date.parse(st) < Date.now() ? "in" : state;
  const per = String(x.period || ""), el = String(x.elapsed || "");
  const clock = state === "in" ? [per, el && el !== "0" ? (/^\d+$/.test(el) ? el + "'" : el) : ""].filter(Boolean).join(" ") || "Live" : state === "post" ? (sc ? `${sc[0]}:${sc[1]}` : "Ende") : null;
  const markets = w ? [{ k: "win", t: "Sieger", o: [{ p: "a", l: P.a, q: fair(P.p?.[0] ?? .5), pr: P.p?.[0] ?? .5 },
      ...(P.kind === "w3" ? [{ p: "d", l: "Unentschieden", q: fair(P.p?.[1] ?? .25), pr: P.p?.[1] ?? .25 }] : []),
      { p: "b", l: P.b, q: fair(P.p?.[P.kind === "w3" ? 2 : 1] ?? .5), pr: P.p?.[P.kind === "w3" ? 2 : 1] ?? .5 }] }] : [];
  const meta = Object.assign({}, keep?.meta || {}, { src: Object.assign({}, keep?.meta?.src || {}, { kind: "pm", ev: String(x.id) }), league: L.key, slug: x.slug || null,
    p: P.p, draw: P.kind === "w3", sub: sub(P.title, L.name), period: per || null, winner: state === "post" && w ? winner : (keep?.meta?.winner ?? null) });
  return { sport: w ? "pm" : "fb", comp: `pm:${L.key}`, name: L.name, home: P.a, away: P.b, home_logo: logo(x, P.a), away_logo: logo(x, P.b), start_at: st, state, clock,
    score_h: state === "pre" ? null : sc ? sc[0] : (w && state === "post" ? (winner === "a" ? 1 : 0) : null), score_a: state === "pre" ? null : sc ? sc[1] : (w && state === "post" ? (winner === "b" ? 1 : 0) : null),
    markets, odds_src: "Polymarket", odds_at: new Date().toISOString(), meta, fav: false, updated_at: new Date().toISOString(), _w: winner };
}

/* ---------- 2. the games of the leagues people follow ---------- */
async function leagueEvents(L: J) {
  const out: J[] = [], now = Date.now();
  for (const s of String(L.series).split(",").map(x => x.trim()).filter(Boolean))
    for (let off = 0; off < 300; off += 50){
      const j = await get(`/events?series_id=${s}&closed=false&limit=50&offset=${off}&order=startTime&ascending=true&end_date_min=${iso(now - 864e5)}&end_date_max=${iso(now + 30 * 864e5)}`);
      if (!Array.isArray(j)) break; out.push(...j); if (j.length < 50) break; }
  return out;
}
async function syncLeague(L: J) {
  const xs = await leagueEvents(L), now = Date.now(), rows: J[] = [];
  for (const x of xs){ const st = Date.parse(x.startTime || ""); if (!st || st < now - 6 * 3600e3 || st > now + 14 * 864e5) continue;
    const r = toRow(x, L); if (r) rows.push(Object.assign(r, { id: `pm:${x.id}` })); }
  if (!rows.length) return 0;
  /* finished ones are left to step 3 (it sends the pushes); nothing that is already scored is written again */
  const old: Record<string, J> = {}; { const { data } = await sb.from("tipp_events").select("id,state,settled,meta").in("id", rows.map(r => r.id)); (data || []).forEach((r: J) => old[r.id] = r); }
  const up = rows.filter(r => !old[r.id]?.settled && old[r.id]?.state !== "post" && r.state !== "post" && r.state !== "canc")
    .map(r => { const { _w, ...x } = r; void _w; return Object.assign(x, { meta: Object.assign({}, old[r.id]?.meta || {}, x.meta) }); });
  for (let i = 0; i < up.length; i += 100){ const { error } = await sb.from("tipp_events").upsert(up.slice(i, i + 100), { onConflict: "id" }); if (error) throw error; }
  return up.length;
}

/* ---------- 3. live scores and results ---------- */
async function finish(id: string) {
  try { await sb.rpc("tipp_final", { p_event: id }); } catch (_) { /* ignore */ }
}
async function track(leagueMap: Record<string, J>) {
  const now = Date.now(), log: string[] = [];
  const { data } = await sb.from("tipp_events").select("id,sport,comp,home,away,start_at,state,settled,meta")
    .eq("settled", false).neq("state", "canc").eq("meta->src->>kind", "pm").not("meta->src->>ev", "is", null)
    .gte("start_at", iso(now - 4 * 864e5)).lte("start_at", iso(now + 10 * 60e3)).limit(120);
  const evs = (data || []) as J[]; if (!evs.length) return { tracked: 0 };
  const byPm: Record<string, J> = {}; evs.forEach(e => byPm[String(e.meta.src.ev)] = e);
  const ids = Object.keys(byPm), got: Record<string, J> = {};
  for (let i = 0; i < ids.length; i += 20){ const j = await get(`/events?${ids.slice(i, i + 20).map(x => "id=" + x).join("&")}&limit=20`); if (Array.isArray(j)) j.forEach((x: J) => got[String(x.id)] = x); }
  for (const id of ids) if (!got[id]){ const x = await get(`/events/${id}`); if (x && x.id) got[id] = x; }
  let done = 0;
  for (const id of ids){ const e = byPm[id], x = got[id]; if (!x) continue;
    const L = leagueMap[e.meta.league] || { key: e.meta.league || "x", name: e.comp, grp: e.meta.grp || (e.sport === "fb" ? "fb" : "x") };
    const r = toRow(x, L, e); if (!r) continue;
    const hand = !String(e.id).startsWith("pm:");
    /* a hand-entered game keeps its own names: the sides may be the other way round on Polymarket */
    let { home, away, score_h, score_a } = r as J, w = r._w as string | null;
    if (hand && e.meta?.src?.flip){ [score_h, score_a] = [score_a, score_h]; if (w === "a") w = "b"; else if (w === "b") w = "a"; }
    const upd: J = { state: r.state, clock: r.clock, score_h, score_a, updated_at: r.updated_at,
      meta: Object.assign({}, e.meta || {}, { period: r.meta.period, winner: r.state === "post" && e.sport !== "fb" ? w : e.meta?.winner ?? null, p: hand && e.meta?.src?.flip && r.meta.p ? [...r.meta.p].reverse() : r.meta.p }) };
    if (!hand){ Object.assign(upd, { home, away, start_at: r.start_at }); }
    if (r.state === "post" || r.state === "canc") upd.settled = true;
    const { error } = await sb.from("tipp_events").update(upd).eq("id", e.id).eq("settled", false);
    if (error){ log.push(e.id + " " + error.message); continue; }
    if (r.state === "post"){ await finish(e.id); done++; }
  }
  return { tracked: ids.length, done, log };
}

/* ---------- 4. hand-entered games waiting for their market ---------- */
async function link(leagueMap: Record<string, J>, minute: number) {
  if (minute % 30 > 1) return { link: "later" };
  const now = Date.now();
  const { data } = await sb.from("tipp_events").select("id,sport,home,away,start_at,state,meta").eq("meta->src->>kind", "pm").is("meta->src->>ev", null)
    .not("meta->src->find", "is", null).in("state", ["pre"]).lte("start_at", iso(now + 21 * 864e5)).limit(20);
  const out: string[] = [];
  for (const e of (data || []) as J[]){
    const f = e.meta.src.find || {}, terms = ((f.terms || []) as string[]).map(fold), t0 = Date.parse(e.start_at);
    /* not listed by the start: called off, nobody could tip it anyway (it only shows once it has its market) */
    if (t0 < now){ await sb.from("tipp_events").update({ state: "canc", settled: true, clock: "abgesagt", updated_at: new Date().toISOString(), meta: Object.assign({}, e.meta, { nolink: true }) }).eq("id", e.id); out.push(e.id + " off"); continue; }
    const j = await get(`/public-search?q=${encodeURIComponent(f.q || terms.join(" "))}&limit_per_type=20&events_status=active`);
    const hit = ((j?.events || []) as J[]).find(x => terms.every(t => fold(x.title).includes(t)) && Math.abs(Date.parse(x.startTime || x.endDate || "") - t0) < 36 * 3600e3
      && ((x.markets || []) as J[]).some(m => m.sportsMarketType === "moneyline"));
    if (!hit) continue;
    /* the whole event (the search answer is short) */
    const x = (await get(`/events/${hit.id}`)) || hit, grp = f.grp || "x", L = Object.assign({ key: f.league || "x", name: e.meta.name || "", grp }, leagueMap[f.league] || {});
    const r = toRow(x, L); if (!r) continue;
    const flip = !fold(r.home).includes(terms[0] || "~") && fold(r.away).includes(terms[0] || "~");
    const p = flip && r.meta.p ? [...r.meta.p].reverse() : r.meta.p;
    const mk = (r.markets as J[]).map(m => Object.assign({}, m, { o: (flip ? [...m.o].reverse() : m.o).map((o: J) => Object.assign({}, o, { p: o.p === "d" ? "d" : (o.p === "a") !== flip ? "a" : "b", l: o.p === "d" ? o.l : (o.p === "a") !== flip ? e.home : e.away })) }));
    const { error } = await sb.from("tipp_events").update({ sport: r.sport, markets: mk, odds_src: "Polymarket", odds_at: r.odds_at, start_at: r.start_at,
      meta: Object.assign({}, e.meta, { src: Object.assign({}, e.meta.src, { ev: String(x.id), flip }), league: L.key, p, draw: r.meta.draw }) }).eq("id", e.id);
    out.push(e.id + (error ? " " + error.message : " -> " + x.id));
  }
  return { link: out };
}

/* ---------- 5. watchdog ---------- */
async function watchdog(map: Record<string, J>) {
  const now = Date.now();
  const { data } = await sb.from("tipp_events").select("id,name,home,away,start_at,state,meta,comp").in("state", ["pre", "in"]).eq("settled", false)
    .lte("start_at", iso(now - 10 * 3600e3)).gte("start_at", iso(now - 4 * 864e5)).limit(50);
  const out: string[] = [];
  for (const e of (data || []) as J[]){
    /* cricket can take days */
    if (e.meta?.stuck || map[e.meta?.league]?.grp === "cr") continue;
    /* only games somebody could tip (and did): the app shows nothing else */
    const { count } = await sb.from("tipp_picks").select("id", { count: "exact", head: true }).eq("event_id", e.id);
    if (!count) continue;
    const src = e.meta?.src?.kind || String(e.id).split(":")[0];
    try { await sb.rpc("tipp_alert", { p_title: "⚠️ Tippspiel: kein Ergebnis", p_body: `${e.home} – ${e.away}: seit ${Math.round((now - Date.parse(e.start_at)) / 3600e3)} Std. ohne Ergebnis (Quelle: ${src}). Bitte prüfen.` }); } catch (_) { /* ignore */ }
    await sb.from("tipp_events").update({ meta: Object.assign({}, e.meta || {}, { stuck: true }) }).eq("id", e.id);
    out.push(e.id);
  }
  return out;
}

async function tick(force = false) {
  const minute = new Date().getUTCMinutes(), log: J = {};
  try { log.leagues = await leagues(); } catch (e) { log.leagues = String(e); }
  const { data: Ls } = await sb.from("tipp_leagues").select("key,name,grp,series"); const map: Record<string, J> = {}; (Ls || []).forEach((l: J) => map[l.key] = l);
  if (force || minute % 10 < 2){
    const { data: F } = await sb.from("tipp_follows").select("league"); const keys = [...new Set(((F || []) as J[]).map(f => f.league))];
    log.synced = {}; for (const k of keys) if (map[k]) try { log.synced[k] = await syncLeague(map[k]); } catch (e) { log.synced[k] = String(e); }
  }
  try { log.track = await track(map); } catch (e) { log.track = String(e); }
  try { log.link = await link(map, minute); } catch (e) { log.link = String(e); }
  if (minute % 10 < 2) try { log.stuck = await watchdog(map); } catch (e) { log.stuck = String(e); }
  return log;
}

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, x-client-info, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const { data: cfg } = await sb.rpc("push_config");
    if (req.headers.get("x-hook-key") === (cfg as Record<string, string>)?.hook_key){
      const out = body.leagues ? { leagues: await leagues(true) } : await tick(!!body.force); console.log("pm", JSON.stringify(out)); return Response.json(out);
    }
    /* from the app: a signed-in player has just followed a league -> its games now, not in ten minutes */
    const tok = (req.headers.get("authorization") || "").replace(/^Bearer /i, "");
    const { data: u } = tok ? await sb.auth.getUser(tok) : { data: null };
    if (!u?.user) return new Response("forbidden", { status: 401, headers: cors });
    if (body.league){
      const { data: L } = await sb.from("tipp_leagues").select("key,name,grp,series,builtin").eq("key", String(body.league)).maybeSingle();
      if (!L || L.builtin) return Response.json({ n: 0 }, { headers: cors });
      return Response.json({ n: await syncLeague(L) }, { headers: cors });
    }
    return Response.json({ ok: true }, { headers: cors });
  } catch (e) {
    console.log("error", String(e));
    return new Response("error " + String(e), { status: 500, headers: cors });
  }
});
