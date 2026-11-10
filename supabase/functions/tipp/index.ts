// Chess.nat Tippspiel: every minute (pg_cron -> private.tipp_tick) this pulls fixtures, live scores, real odds
// and match statistics from ESPN, builds the betting markets from a Poisson model fitted to the bookmaker odds,
// lets the AI tipster ("Nat-KI") place its tips, sends goal pushes and settles finished events.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
let hookKey: string | null = null;
async function key() {
  if (hookKey) return hookKey;
  const { data, error } = await sb.rpc("push_config");
  if (error) throw error;
  hookKey = (data as Record<string, string>).hook_key;
  return hookKey;
}

type J = Record<string, any>;
const SITE = "https://site.api.espn.com/apis/site/v2/sports";
const CORE = "https://sports.core.api.espn.com/v2/sports";
const LEAGUES = [
  { sport: "soccer", slug: "ger.1", comp: "ger.1", kind: "fb" },
  { sport: "soccer", slug: "uefa.champions", comp: "uefa.champions", kind: "fb" },
  { sport: "soccer", slug: "ger.dfb_pokal", comp: "ger.dfb_pokal", kind: "fb" },
  { sport: "mma", slug: "ufc", comp: "ufc", kind: "mma" },
  /* Germany's national team: only its games */
  { sport: "soccer", slug: "uefa.nations", comp: "nt", kind: "fb", only: true },
  { sport: "soccer", slug: "fifa.friendly", comp: "nt", kind: "fb", only: true },
  { sport: "soccer", slug: "uefa.euroq", comp: "nt", kind: "fb", only: true },
  { sport: "soccer", slug: "fifa.worldq.uefa", comp: "nt", kind: "fb", only: true },
] as J[];

async function get(url: string, ms = 9000): Promise<J | null> {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal, headers: { "user-agent": "Mozilla/5.0 chessnat-tipp" } }); if (!r.ok) return null; return await r.json(); }
  catch (_) { return null; } finally { clearTimeout(t); }
}
const month = (d: Date) => d.toISOString().slice(0, 7).replace("-", "");
const r2 = (x: number) => Math.round(x * 100) / 100;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/* ---------- odds helpers ---------- */
const amToProb = (ml: number) => ml < 0 ? -ml / (-ml + 100) : 100 / (ml + 100);
const amToDec = (ml: number) => ml < 0 ? 1 + 100 / -ml : 1 + ml / 100;
const fair = (p: number, margin = 0.94) => r2(clamp(margin / Math.max(p, 0.001), 1.03, 60));

/* ---------- the football model: two Poisson goal counts ---------- */
const fact = [1]; for (let i = 1; i < 20; i++) fact[i] = fact[i - 1] * i;
const pois = (l: number, k: number) => Math.exp(-l) * Math.pow(l, k) / fact[k];
function matrix(lh: number, la: number, N = 11) {
  const m: number[][] = []; for (let i = 0; i < N; i++){ m[i] = []; for (let j = 0; j < N; j++) m[i][j] = pois(lh, i) * pois(la, j); } return m;
}
function probs(lh: number, la: number) {
  const m = matrix(lh, la); let h = 0, d = 0, a = 0; const over: Record<string, number> = { "1.5": 0, "2.5": 0, "3.5": 0, "4.5": 0 }; let btts = 0;
  for (let i = 0; i < m.length; i++) for (let j = 0; j < m.length; j++){ const p = m[i][j];
    if (i > j) h += p; else if (i === j) d += p; else a += p;
    for (const L of Object.keys(over)) if (i + j > +L) over[L] += p;
    if (i > 0 && j > 0) btts += p; }
  return { h, d, a, over, btts, m };
}
/* find the expected goals that reproduce the bookmaker's 1X2 and over/under */
function fit(ph: number, pd: number, pa: number, line?: number, pover?: number) {
  let best = { lh: 1.5, la: 1.2, e: 9 };
  for (let lh = 0.25; lh <= 4.2; lh += 0.05) for (let la = 0.2; la <= 3.8; la += 0.05){
    const p = probs(lh, la); let e = (p.h - ph) ** 2 + (p.d - pd) ** 2 + (p.a - pa) ** 2;
    if (line && pover != null && p.over[String(line)] != null) e += 0.7 * (p.over[String(line)] - pover) ** 2;
    if (e < best.e) best = { lh, la, e };
  }
  return { lh: r2(best.lh), la: r2(best.la) };
}
/* league table strength as a fallback when there are no odds yet */
let table: { at: number; t: Record<string, { gf: number; ga: number; gp: number }>; avg: number } | null = null;
async function standings() {
  if (table && Date.now() - table.at < 6 * 3600e3) return table;
  const j = await get("https://site.api.espn.com/apis/v2/sports/soccer/ger.1/standings");
  const t: Record<string, { gf: number; ga: number; gp: number }> = {}; let G = 0, P = 0;
  for (const e of (j?.children?.[0]?.standings?.entries || []) as J[]){
    const s = Object.fromEntries((e.stats || []).map((x: J) => [x.name, +x.value]));
    t[e.team?.id] = { gf: s.pointsFor || 0, ga: s.pointsAgainst || 0, gp: s.gamesPlayed || 0 }; G += s.pointsFor || 0; P += s.gamesPlayed || 0;
  }
  table = { at: Date.now(), t, avg: P ? G / P : 1.55 }; return table;
}
async function modelFromTable(hid: string, aid: string) {
  const T = await standings(), A = T.avg || 1.55, sh = (x?: { gf: number; ga: number; gp: number }, f = "gf") => {
    if (!x || !x.gp) return 1; const raw = ((x as any)[f] / x.gp) / A, w = x.gp / (x.gp + 6); return 1 + (raw - 1) * w; };
  const H = T.t[hid], W = T.t[aid];
  return { lh: r2(clamp(A * 1.12 * sh(H) * sh(W, "ga"), 0.3, 4)), la: r2(clamp(A * 0.9 * sh(W) * sh(H, "ga"), 0.25, 3.6)) };
}

/* ---------- markets ---------- */
const RIVAL = [["Bayern", "Dortmund"], ["Dortmund", "Schalke"], ["Hamburg", "St. Pauli"], ["Köln", "Gladbach"], ["Cologne", "Gladbach"], ["Köln", "Mönchengladbach"], ["Cologne", "Mönchengladbach"], ["Bayern", "Leverkusen"]];
const isBay = (n?: string) => /bayern/i.test(n || "");
const isBvb = (n?: string) => /dortmund/i.test(n || "");
function yesNo(k: string, t: string, p: number) { return { k, t, o: [{ p: "y", l: "Ja", q: fair(p), pr: r2(p) }, { p: "n", l: "Nein", q: fair(1 - p), pr: r2(1 - p) }] }; }
function overUnder(k: string, t: string, line: number, p: number, real?: { o: number; u: number }) {
  const L = String(line).replace(".", ",");
  return { k, t: `${t}: über/unter ${L}`, o: [{ p: "o", l: `Über ${L}`, q: real ? r2(real.o) : fair(p), pr: r2(p) }, { p: "u", l: `Unter ${L}`, q: real ? r2(real.u) : fair(1 - p), pr: r2(1 - p) }] };
}
const poisCdfOver = (mu: number, line: number) => { let c = 0; for (let k = 0; k <= Math.floor(line); k++) c += pois(mu, k); return 1 - c; };
function footballMarkets(ev: J, lh: number, la: number, real?: J) {
  const P = probs(lh, la), H = ev.home, A = ev.away, M: J[] = [];
  const pr = real ? { h: real.ph, d: real.pd, a: real.pa } : { h: P.h, d: P.d, a: P.a };
  M.push({ k: "1x2", t: "Sieger", o: [
    { p: "h", l: H, q: real ? r2(real.qh) : fair(pr.h), pr: r2(pr.h) },
    { p: "d", l: "Unentschieden", q: real ? r2(real.qd) : fair(pr.d), pr: r2(pr.d) },
    { p: "a", l: A, q: real ? r2(real.qa) : fair(pr.a), pr: r2(pr.a) }] });
  M.push({ k: "dc", t: "Doppelte Chance", o: [
    { p: "1x", l: `${H} oder X`, q: fair(pr.h + pr.d, .95), pr: r2(pr.h + pr.d) },
    { p: "x2", l: `X oder ${A}`, q: fair(pr.d + pr.a, .95), pr: r2(pr.d + pr.a) },
    { p: "12", l: "Kein Remis", q: fair(pr.h + pr.a, .95), pr: r2(pr.h + pr.a) }] });
  M.push(overUnder("ou25", "Tore", 2.5, P.over["2.5"], real?.line === 2.5 ? { o: real.qo, u: real.qu } : undefined));
  M.push(overUnder("ou15", "Tore", 1.5, P.over["1.5"]));
  M.push(overUnder("ou35", "Tore", 3.5, P.over["3.5"], real?.line === 3.5 ? { o: real.qo, u: real.qu } : undefined));
  M.push(yesNo("btts", "Beide Teams treffen", P.btts));
  /* exact score: the ten likeliest, everything else in one pick */
  const cells: { s: string; p: number }[] = []; for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) cells.push({ s: `${i}-${j}`, p: P.m[i][j] });
  cells.sort((x, y) => y.p - x.p); const top = cells.slice(0, 12), rest = 1 - top.reduce((s, c) => s + c.p, 0);
  M.push({ k: "cs", t: "Genaues Ergebnis", o: top.map(c => ({ p: c.s, l: c.s.replace("-", ":"), q: fair(c.p, .9), pr: r2(c.p) })).concat([{ p: "x", l: "Anderes", q: fair(rest, .9), pr: r2(rest) }]) });
  /* the fun ones */
  const riv = RIVAL.some(([x, y]) => (H.includes(x) && A.includes(y)) || (H.includes(y) && A.includes(x)));
  const close = Math.abs(pr.h - pr.a) < 0.15, muY = 4.1 + (riv ? 0.8 : 0) + (close ? 0.4 : 0) + (ev.comp === "ger.dfb_pokal" ? 0.3 : 0);
  M.push(overUnder("yc35", "Gelbe Karten", 3.5, poisCdfOver(muY, 3.5)));
  M.push(overUnder("yc55", "Gelbe Karten", 5.5, poisCdfOver(muY, 5.5)));
  M.push(yesNo("red", "Rote Karte im Spiel", riv ? 0.16 : 0.11));
  M.push(yesNo("pen", "Elfmeter im Spiel", 0.29 + (riv ? 0.03 : 0)));
  M.push(overUnder("cor", "Ecken", 9.5, poisCdfOver(9.4 + (lh + la - 2.9) * 0.6, 9.5)));
  if (isBay(H) || isBay(A)){ const home = isBay(H), lb = home ? lh : la, lo = home ? la : lh;
    let p3 = 0, w0 = 0; for (let i = 0; i < 11; i++) for (let j = 0; j < 11; j++){ const p = P.m[i][j], b = home ? i : j, o = home ? j : i; if (b >= 3) p3 += p; if (b > o && o === 0) w0 += p; }
    M.push(yesNo("bay3", "Bayern schießt 3+ Tore", p3)); M.push(yesNo("bay0", "Bayern gewinnt zu Null", w0)); void lb; void lo; }
  if (isBvb(H) || isBvb(A)){ const pl = isBvb(H) ? pr.a : pr.h; M.push(yesNo("bvbl", "Dortmund verliert 😈", pl)); }
  return M;
}
function mmaMarkets(ev: J, pa: number, real?: J, pdist = 0.47) {
  const qa = real?.qa ? r2(real.qa) : fair(pa), qb = real?.qb ? r2(real.qb) : fair(1 - pa), rest = 1 - pdist;
  return [
    { k: "win", t: "Sieger", o: [{ p: "a", l: ev.home, q: qa, pr: r2(pa) }, { p: "b", l: ev.away, q: qb, pr: r2(1 - pa) }] },
    { k: "how", t: "Wie endet der Kampf?", o: [{ p: "ko", l: "K.o./TKO", q: fair(rest * 0.62), pr: r2(rest * 0.62) }, { p: "sub", l: "Aufgabe", q: fair(rest * 0.38), pr: r2(rest * 0.38) }, { p: "dec", l: "Punktentscheidung", q: fair(pdist), pr: r2(pdist) }] },
    yesNo("dist", "Geht über die volle Distanz", pdist),
  ];
}

/* ---------- odds from ESPN (DraftKings) ---------- */
async function realOdds(sport: string, slug: string, evId: string, cId: string) {
  const j = await get(`${CORE}/${sport}/leagues/${slug}/events/${evId}/competitions/${cId}/odds`);
  const it = (j?.items || []).find((x: J) => x?.homeTeamOdds?.moneyLine != null || x?.homeAthleteOdds?.moneyLine != null || x?.awayAthleteOdds?.moneyLine != null);
  if (!it) return null;
  if (sport === "soccer"){
    const h = +it.homeTeamOdds?.moneyLine, a = +it.awayTeamOdds?.moneyLine, d = +it.drawOdds?.moneyLine;
    if (!isFinite(h) || !isFinite(a) || !isFinite(d)) return null;
    const ph = amToProb(h), pd = amToProb(d), pa = amToProb(a), s = ph + pd + pa;
    let po: number | undefined, qo: number | undefined, qu: number | undefined; const line = it.overUnder != null ? +it.overUnder : undefined;
    if (line && it.overOdds != null && it.underOdds != null){ const o = amToProb(+it.overOdds), u = amToProb(+it.underOdds); po = o / (o + u); qo = amToDec(+it.overOdds); qu = amToDec(+it.underOdds); }
    return { ph: ph / s, pd: pd / s, pa: pa / s, qh: amToDec(h), qd: amToDec(d), qa: amToDec(a), line, po, qo, qu, src: it.provider?.name || "DraftKings" };
  }
  const ha = it.homeAthleteOdds?.moneyLine, aa = it.awayAthleteOdds?.moneyLine;
  if (ha == null || aa == null) return null;
  const p1 = amToProb(+ha), p2 = amToProb(+aa), s = p1 + p2;
  let pover: number | undefined; if (it.overUnder != null && it.overOdds != null && it.underOdds != null){ const o = amToProb(+it.overOdds), u = amToProb(+it.underOdds); pover = o / (o + u); }
  const aid = (r?: string) => (String(r || "").match(/athletes\/(\d+)/) || [])[1] || null;
  return { home: { p: p1 / s, q: amToDec(+ha), id: aid(it.homeAthleteOdds?.athlete?.$ref) }, away: { p: p2 / s, q: amToDec(+aa), id: aid(it.awayAthleteOdds?.athlete?.$ref) }, line: it.overUnder != null ? +it.overUnder : undefined, pover, src: it.provider?.name || "DraftKings" };
}

/* ---------- events from the scoreboards ---------- */
/* German names for the clubs the family knows (ESPN writes them in English) */
const DE: Record<string, string> = { "Bayern Munich": "FC Bayern", "FC Cologne": "1. FC Köln", "Cologne": "1. FC Köln", "Hamburg SV": "Hamburger SV", "Borussia Monchengladbach": "Borussia Mönchengladbach",
  "Inter Milan": "Inter Mailand", "AC Milan": "AC Mailand", "Bayer Leverkusen": "Bayer 04 Leverkusen", "Juventus": "Juventus Turin", "Napoli": "SSC Neapel", "Atletico Madrid": "Atlético Madrid",
  "Sporting CP": "Sporting Lissabon", "Benfica": "Benfica Lissabon", "Club Brugge": "FC Brügge", "Red Star Belgrade": "Roter Stern Belgrad", "Copenhagen": "FC Kopenhagen", "Galatasaray": "Galatasaray Istanbul",
  "Fenerbahce": "Fenerbahçe", "PSV Eindhoven": "PSV Eindhoven", "Slavia Prague": "Slavia Prag", "Sparta Prague": "Sparta Prag", "Shakhtar Donetsk": "Schachtar Donezk", "Celtic": "Celtic Glasgow", "Rangers": "Glasgow Rangers",
  "Germany": "Deutschland", "Netherlands": "Niederlande", "Serbia": "Serbien", "Hungary": "Ungarn", "Bosnia-Herzegovina": "Bosnien-Herzegowina", "Italy": "Italien", "France": "Frankreich", "Spain": "Spanien", "Switzerland": "Schweiz", "Austria": "Österreich",
  "Belgium": "Belgien", "Croatia": "Kroatien", "Turkey": "Türkei", "Türkiye": "Türkei", "Poland": "Polen", "Denmark": "Dänemark", "Sweden": "Schweden", "Norway": "Norwegen", "Greece": "Griechenland", "Scotland": "Schottland", "Slovakia": "Slowakei",
  "Czechia": "Tschechien", "Czech Republic": "Tschechien", "Slovenia": "Slowenien", "Romania": "Rumänien", "Ukraine": "Ukraine", "Portugal": "Portugal", "Republic of Ireland": "Irland", "Northern Ireland": "Nordirland", "Wales": "Wales", "Iceland": "Island",
  "Luxembourg": "Luxemburg", "Georgia": "Georgien", "Albania": "Albanien", "Finland": "Finnland", "Israel": "Israel", "Kosovo": "Kosovo", "North Macedonia": "Nordmazedonien", "Montenegro": "Montenegro", "Bulgaria": "Bulgarien", "USA": "USA", "United States": "USA",
  "Mexico": "Mexiko", "Brazil": "Brasilien", "Argentina": "Argentinien", "Japan": "Japan" };
const de = (n: string) => DE[n] || n;
function soccerEvent(L: J, e: J): J {
  const c = e.competitions?.[0] || {}, cs = c.competitors || [], h = cs.find((x: J) => x.homeAway === "home") || cs[0] || {}, a = cs.find((x: J) => x.homeAway === "away") || cs[1] || {};
  const st = c.status?.type || {}, canc = /postpon|cancel|abandon/i.test(st.name || "") || /postpon|cancel/i.test(st.detail || "");
  const hn = de(h.team?.displayName || h.team?.name || "?"), an = de(a.team?.displayName || a.team?.name || "?");
  return { id: `espn:${L.slug}:${e.id}`, sport: "fb", comp: L.comp, name: `${hn} – ${an}`, home: hn, away: an, home_logo: h.team?.logo || null, away_logo: a.team?.logo || null,
    home_id: h.team?.id || null, away_id: a.team?.id || null, start_at: e.date, state: canc ? "canc" : (st.state || "pre"),
    clock: st.state === "in" ? (st.shortDetail || c.status?.displayClock || "") : (st.state === "post" ? (st.shortDetail || "FT") : null),
    score_h: st.state === "pre" ? null : +h.score || 0, score_a: st.state === "pre" ? null : +a.score || 0, fav: isBay(hn) || isBay(an) || hn === "Deutschland" || an === "Deutschland",
    meta: { espn: e.id, cid: c.id, slug: L.slug, sport: L.sport, round: e.season?.slug || null, bvb: isBvb(hn) || isBvb(an), ab: [h.team?.abbreviation, a.team?.abbreviation],
      lines: [h.linescores?.map((x: J) => +x.value), a.linescores?.map((x: J) => +x.value)], detail: st.detail || null } };
}
function mmaEvents(L: J, e: J): J[] {
  const out: J[] = []; const n = (e.competitions || []).length;
  (e.competitions || []).forEach((c: J, i: number) => {
    const cs = c.competitors || [], A = cs.find((x: J) => x.order === 1) || cs[0] || {}, B = cs.find((x: J) => x.order === 2) || cs[1] || {};
    const st = c.status?.type || {}, an = A.athlete?.displayName || "?", bn = B.athlete?.displayName || "?";
    const how = (c.details || []).map((d: J) => d?.type?.text || "").join(" ");
    out.push({ id: `espn:ufc:${c.id}`, sport: "mma", comp: "ufc", name: `${an} vs. ${bn}`, home: an, away: bn, home_logo: A.athlete?.flag?.href || null, away_logo: B.athlete?.flag?.href || null,
      home_id: A.id || null, away_id: B.id || null, start_at: c.date || e.date, state: /cancel/i.test(st.name || "") ? "canc" : (st.state || "pre"),
      clock: st.state === "in" ? `R${c.status?.period || 1} ${c.status?.displayClock || ""}` : st.state === "post" ? (st.shortDetail || "Final") : null,
      score_h: st.state === "post" ? (A.winner ? 1 : 0) : null, score_a: st.state === "post" ? (B.winner ? 1 : 0) : null, fav: i >= n - 2,
      meta: { espn: e.id, cid: c.id, slug: L.slug, sport: L.sport, card: e.name, main: i >= n - 5, order: n - i, rec: [A.records?.[0]?.summary, B.records?.[0]?.summary],
        winner: A.winner ? "a" : B.winner ? "b" : null, how, round: c.status?.period || null } });
  });
  return out;
}
const recP = (r?: string) => { const [w, l] = String(r || "0-0").split("-").map(Number); return ((w || 0) + 3) / ((w || 0) + (l || 0) + 6); };

/* ---------- settlement ---------- */
async function soccerResult(ev: J) {
  const j = await get(`${SITE}/soccer/${ev.meta.slug}/summary?event=${ev.meta.espn}`);
  if (!j) return null;
  const T = (j.boxscore?.teams || []) as J[], stat = (n: string) => T.reduce((s, t) => s + (+((t.statistics || []).find((x: J) => x.name === n)?.displayValue) || 0), 0);
  const stats = { yc: stat("yellowCards"), rc: stat("redCards"), cor: stat("wonCorners"), pens: stat("penaltyKickShots"), shots: stat("totalShots") };
  /* bets on goals count the 90 minutes: drop extra time if there was some */
  const comp = j.header?.competitions?.[0], cs = comp?.competitors || [], h = cs.find((x: J) => x.homeAway === "home"), a = cs.find((x: J) => x.homeAway === "away");
  let gh = +ev.score_h, ga = +ev.score_a; const lh = (h?.linescores || []).map((x: J) => +x.displayValue || +x.value || 0), la = (a?.linescores || []).map((x: J) => +x.displayValue || +x.value || 0);
  if (lh.length > 2 && la.length > 2){ gh = lh[0] + lh[1]; ga = la[0] + la[1]; }
  const R: J = {};
  R["1x2"] = gh > ga ? "h" : gh === ga ? "d" : "a";
  (R as J).dc = gh > ga ? ["1x", "12"] : gh === ga ? ["1x", "x2"] : ["x2", "12"];
  for (const [k, L] of [["ou15", 1.5], ["ou25", 2.5], ["ou35", 3.5]] as [string, number][]) R[k] = gh + ga > L ? "o" : "u";
  R.btts = gh > 0 && ga > 0 ? "y" : "n";
  const sc = `${gh}-${ga}`, csM = (ev.markets || []).find((m: J) => m.k === "cs"); R.cs = csM && csM.o.some((o: J) => o.p === sc) ? sc : "x";
  R.yc35 = stats.yc > 3.5 ? "o" : "u"; R.yc55 = stats.yc > 5.5 ? "o" : "u"; R.red = stats.rc > 0 ? "y" : "n"; R.pen = stats.pens > 0 ? "y" : "n"; R.cor = stats.cor > 9.5 ? "o" : "u";
  const bh = isBay(ev.home), ba = isBay(ev.away);
  if (bh || ba){ const b = bh ? gh : ga, o = bh ? ga : gh; R.bay3 = b >= 3 ? "y" : "n"; R.bay0 = b > o && o === 0 ? "y" : "n"; }
  if (isBvb(ev.home) || isBvb(ev.away)){ const d = isBvb(ev.home) ? gh - ga : ga - gh; R.bvbl = d < 0 ? "y" : "n"; }
  return { R, stats, draw: gh === ga, reg: [gh, ga] };
}

/* ---------- the run ---------- */
async function notify(id: string, title: string, body: string) { try { await sb.rpc("tipp_notify", { p_event: id, p_title: title, p_body: body }); } catch (_) { /* ignore */ } }
async function live(id: string, title: string) { try { await sb.rpc("tipp_live", { p_event: id, p_title: title }); } catch (_) { /* ignore */ } }
const pickBy = (os: J[]) => { let r = Math.random() * os.reduce((s, o) => s + (o.pr || 0), 0); for (const o of os){ r -= o.pr || 0; if (r <= 0) return o; } return os[os.length - 1]; };

/* the AI tipster: once per event, a few days before, picked at random by the model's probabilities */
/* the KI is no Dortmund fan: a Dortmund win gets a third of its chance, a draw a bit less */
const BVB = /Dortmund/;
const bvbF = (m: J, o: J, home = "", away = "") => {
  const bh = BVB.test(home), ba = BVB.test(away); if (!bh && !ba) return 1;
  let r = ""; if (m.k === "1x2") r = o.p === "d" ? "d" : (o.p === "h") === bh ? "w" : "l";
  else if (m.k === "cs" && o.p !== "x"){ const [a, b] = o.p.split("-").map(Number); r = a === b ? "d" : (a > b) === bh ? "w" : "l"; }
  return r === "w" ? 0.3 : r === "d" ? 0.8 : 1;
};
async function kiTip(id: string, markets: J[], home = "", away = ""){
  if (!markets.length) return;
  const { count } = await sb.from("tipp_tips").select("id", { count: "exact", head: true }).eq("event_id", id).eq("bot", "ki");
  if (count) return;
  const main = markets[0], side = markets.filter(m => m !== main && ["btts", "ou25", "pen", "yc35", "how", "dist", "x0", "x1", "x2"].includes(m.k));
  const picks = [main].concat(side.length ? [side[Math.floor(Math.random() * side.length)]] : []);
  await sb.from("tipp_tips").insert(picks.map(m => { const o = pickBy(m.o.map((o: J) => Object.assign({}, o, { pr: (o.pr || 0) * bvbF(m, o, home, away) }))); return { user_id: null, bot: "ki", event_id: id, market: m.k, pick: o.p, label: `${m.t}: ${o.l}`, stake: 100, odds: o.q }; }));
}

async function sync() {
  const now = new Date(), log: string[] = [], minute = now.getUTCMinutes();
  const months = [month(now)]; if (minute % 10 === 0 || now.getUTCDate() >= 20) months.push(month(new Date(now.getTime() + 20 * 864e5)));
  if (now.getUTCDate() <= 2) months.push(month(new Date(now.getTime() - 3 * 864e5)));
  const fresh: J[] = [], seen = new Set<string>();
  for (const L of LEAGUES) for (const m of [...new Set(months)]){
    const j = await get(`${SITE}/${L.sport}/${L.slug}/scoreboard?dates=${m}`); if (!j) continue;
    for (const e of (j.events || []) as J[]){ if (L.sport === "mma"){ fresh.push(...mmaEvents(L, e)); continue; } const ev = soccerEvent(L, e); if (L.only && ev.home !== "Deutschland" && ev.away !== "Deutschland") continue; fresh.push(ev); }
  }
  /* the same game can come twice (two months, two lists): once is enough for the upsert */
  for (let i = fresh.length - 1; i >= 0; i--){ if (seen.has(fresh[i].id)) fresh.splice(i, 1); else seen.add(fresh[i].id); }
  /* keep what matters: from 3 days ago until 40 days ahead */
  const keep = fresh.filter(e => { const t = Date.parse(e.start_at); return t > now.getTime() - 3 * 864e5 && t < now.getTime() + 40 * 864e5; });
  const ids = keep.map(e => e.id), old: Record<string, J> = {};
  for (let i = 0; i < ids.length; i += 150){ const { data } = await sb.from("tipp_events").select("id,state,score_h,score_a,markets,odds_at,meta,settled,model,stats,start_at,home,away,comp").in("id", ids.slice(i, i + 150)); (data || []).forEach((r: J) => old[r.id] = r); }
  /* scores and states */
  const up = keep.map(e => { const o = old[e.id]; return Object.assign({}, e, { meta: Object.assign({}, o?.meta || {}, e.meta), updated_at: now.toISOString() }); });
  for (let i = 0; i < up.length; i += 100){ const { error } = await sb.from("tipp_events").upsert(up.slice(i, i + 100), { onConflict: "id" }); if (error) log.push("upsert " + error.message); }
  /* goals and fight ends -> pushes for the people with a tip on it */
  for (const e of keep){ const o = old[e.id]; if (!o) continue;
    if (e.sport === "fb" && e.state === "in" && o.score_h != null && (e.score_h !== o.score_h || e.score_a !== o.score_a) && (e.score_h + e.score_a) > (o.score_h + o.score_a)){
      const who = e.score_h > o.score_h ? e.home : e.away; await live(e.id, `⚽ Tor für ${who}! ${e.score_h}:${e.score_a}${e.clock ? " · " + e.clock : ""}`); }
    if (e.sport === "fb" && e.state === "in" && /^(HT|Halftime|Half Time)/i.test(String(e.meta?.detail || e.clock || "")) && !/^(HT|Halftime|Half Time)/i.test(String(o.meta?.detail || o.clock || "")))
      await live(e.id, `⏸️ Halbzeit · ${e.home} ${e.score_h}:${e.score_a} ${e.away}`);
    if (e.sport === "fb" && e.state === "in" && o.state === "pre") await notify(e.id, "🟢 Anpfiff", `${e.home} – ${e.away} läuft. Viel Glück mit deinen Tipps!`);
  }
  /* markets: before kick-off, refreshed every 3 hours, frozen after */
  const pre = keep.filter(e => e.state === "pre" && Date.parse(e.start_at) > now.getTime() + 60e3 && Date.parse(e.start_at) < now.getTime() + 14 * 864e5)
    .filter(e => { const o = old[e.id]; return !o || !o.markets || !o.markets.length || !o.odds_at || now.getTime() - Date.parse(o.odds_at) > 3 * 3600e3; })
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at)).slice(0, 10);
  for (const e of pre){
    let markets: J[] = [], model: J = {}, src = "model";
    if (e.sport === "fb"){
      const ro = await realOdds("soccer", e.meta.slug, e.meta.espn, e.meta.cid);
      const lam = ro ? fit(ro.ph, ro.pd, ro.pa, ro.line, ro.po) : await modelFromTable(e.home_id, e.away_id);
      markets = footballMarkets(e, lam.lh, lam.la, ro || undefined); model = { lh: lam.lh, la: lam.la }; if (ro) src = ro.src;
    } else {
      const ro = await realOdds("mma", "ufc", e.meta.espn, e.meta.cid);
      /* the odds name the fighters home/away; match them to fighter A and B by athlete id */
      const swap = !!(ro && ro.home.id && String(ro.home.id) !== String(e.home_id) && String(ro.away.id) === String(e.home_id));
      const oa = ro ? (swap ? ro.away : ro.home) : null, ob = ro ? (swap ? ro.home : ro.away) : null;
      let pa = oa ? oa.p : 0.5; if (!ro){ const a = recP(e.meta.rec?.[0]), b = recP(e.meta.rec?.[1]); pa = clamp(0.5 + (a - b) * 0.9, 0.12, 0.88); }
      const pdist = ro?.pover != null ? clamp(ro.pover * (ro.line && ro.line >= 2.5 ? 0.88 : 0.6), 0.15, 0.85) : 0.47;
      markets = mmaMarkets(e, pa, oa && ob ? { qa: oa.q, qb: ob.q } : undefined, pdist); model = { pa: r2(pa), pdist: r2(pdist) }; if (ro) src = ro.src;
    }
    const { error } = await sb.from("tipp_events").update({ markets, model, odds_src: src, odds_at: now.toISOString() }).eq("id", e.id).eq("state", "pre");
    if (error) log.push("markets " + error.message);
    if (Date.parse(e.start_at) < now.getTime() + 4 * 864e5) await kiTip(e.id, markets, e.home, e.away);
  }
  /* manual events (boxing, Oktagon, handball): live at the start, AI tip, reminder, and a nudge to the admins for the result */
  const { data: man } = await sb.from("tipp_events").select("*").not("id", "like", "espn:%").in("state", ["pre", "in"]).lt("start_at", new Date(now.getTime() + 4 * 864e5).toISOString()).limit(40);
  for (const e of (man || []) as J[]){
    const t = Date.parse(e.start_at) - now.getTime(), m = e.meta || {};
    if (e.state === "pre" && t <= 0){ await sb.from("tipp_events").update({ state: "in" }).eq("id", e.id); await notify(e.id, e.sport === "hb" ? "🤾 Anwurf" : "🥊 Es geht los", `${e.home} – ${e.away}. Viel Glück mit deinen Tipps!`); continue; }
    if (e.state === "in"){ if (t < -4 * 3600e3 && !m.nudged){ await sb.rpc("tipp_admin_nudge", { p_event: e.id, p_title: "📝 Ergebnis fehlt", p_body: `${e.home} – ${e.away}: trag das Ergebnis ein, dann wird abgerechnet.` }); await sb.from("tipp_events").update({ meta: Object.assign({}, m, { nudged: true }) }).eq("id", e.id); } continue; }
    if ((e.markets || []).length) await kiTip(e.id, e.markets, e.home, e.away);
    if (e.fav && t > 40 * 60e3 && t < 75 * 60e3 && !m.rem){ await sb.rpc("tipp_remind", { p_event: e.id, p_title: `${e.sport === "hb" ? "🤾" : "🥊"} Gleich: ${e.home} – ${e.away}`, p_body: "In einer Stunde geht's los. Noch kein Tipp abgegeben?" });
      await sb.from("tipp_events").update({ meta: Object.assign({}, m, { rem: true }) }).eq("id", e.id); }
  }
  /* live statistics for running football games (cards, corners) */
  for (const e of keep.filter(e => e.sport === "fb" && e.state === "in").slice(0, 6)){
    const j = await get(`${SITE}/soccer/${e.meta.slug}/summary?event=${e.meta.espn}`); if (!j) continue;
    const T = (j.boxscore?.teams || []) as J[], st = (n: string) => T.reduce((s, t) => s + (+((t.statistics || []).find((x: J) => x.name === n)?.displayValue) || 0), 0);
    const S = { yc: st("yellowCards"), rc: st("redCards"), cor: st("wonCorners"), pens: st("penaltyKickShots") }, os = (old[e.id] || {}).stats || {};
    await sb.from("tipp_events").update({ stats: S }).eq("id", e.id);
    if (os.rc != null && S.rc > os.rc) await notify(e.id, "🟥 Rote Karte!", `${e.home} ${e.score_h}:${e.score_a} ${e.away}${e.clock ? " · " + e.clock : ""}`);
    if (os.pens != null && S.pens > os.pens) await notify(e.id, "⚽ Elfmeter!", `${e.home} ${e.score_h}:${e.score_a} ${e.away}${e.clock ? " · " + e.clock : ""}`);
  }
  /* settle what has finished */
  const { data: due } = await sb.from("tipp_events").select("*").in("state", ["post", "canc"]).eq("settled", false).like("id", "espn:%").limit(8);
  for (const ev of (due || []) as J[]){
    if (ev.state === "canc"){ const R: J = {}; (ev.markets || []).forEach((m: J) => R[m.k] = "void"); await sb.rpc("tipp_settle", { p_event: ev.id, p_res: R }); continue; }
    if (ev.sport === "fb"){
      const res = await soccerResult(ev); if (!res) continue;
      await sb.from("tipp_events").update({ stats: res.stats }).eq("id", ev.id);
      await sb.rpc("tipp_settle", { p_event: ev.id, p_res: res.R });
    } else {
      const m = ev.meta || {}, w = m.winner, how = String(m.how || "");
      const R: J = { win: w || "void" };
      R.how = /kotko|ko\/tko|tko|knock/i.test(how) ? "ko" : /submission/i.test(how) ? "sub" : /decision/i.test(how) ? "dec" : "void";
      R.dist = R.how === "dec" ? "y" : R.how === "void" ? "void" : "n";
      if (!w && !/draw|no contest/i.test(how) && Date.parse(ev.start_at) > now.getTime() - 8 * 3600e3) continue; /* wait for the result */
      await sb.rpc("tipp_settle", { p_event: ev.id, p_res: R });
    }
  }
  /* kick-off reminders for the big ones */
  for (const e of keep.filter(e => e.fav && e.state === "pre")){ const t = Date.parse(e.start_at) - now.getTime(), o = old[e.id];
    if (t > 40 * 60e3 && t < 75 * 60e3 && !(o?.meta || {}).rem){ await sb.rpc("tipp_remind", { p_event: e.id, p_title: e.sport === "fb" ? `⚽ Gleich: ${e.home} – ${e.away}` : `🥊 Gleich: ${e.home} vs. ${e.away}`, p_body: "In einer Stunde geht's los. Noch kein Tipp abgegeben?" });
      await sb.from("tipp_events").update({ meta: Object.assign({}, o?.meta || {}, e.meta, { rem: true }) }).eq("id", e.id); } }
  return { events: keep.length, priced: pre.length, settled: (due || []).length, log };
}

Deno.serve(async (req) => {
  try {
    const k = await key();
    if (req.headers.get("x-hook-key") !== k) return new Response("forbidden", { status: 401 });
    const body = await req.json().catch(() => ({}));
    if (body.sync) return Response.json(await sync());
    return Response.json({ ok: true });
  } catch (e) {
    console.log("error", String(e));
    return new Response("error " + String(e), { status: 500 });
  }
});
