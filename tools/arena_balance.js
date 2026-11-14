/* Nat Stars: how strong is each fighter? A duel simulator that reads the fighters straight out of games/arena.js.
   Every pair fights many duels on open ground with a gas that closes in (so nobody can run away forever). Each fighter keeps
   its own distance like the bots do, reloads, charges and uses its super. Whether a shot hits depends on how long it flies,
   how big it is and how far the other one can step aside in that time (shotgun pellets spread, bombs splash, the boxer
   only hits up close, the light beam holds while the other one is close enough). It is a model, not the game, but it
   uses the same numbers, so it shows clearly who is too strong or too weak.
   Run:  node tools/arena_balance.js            (table of win rates)
         node tools/arena_balance.js --json     (only the averages, for scripts) */
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(process.env.ARENA || path.join(__dirname, "..", "games", "arena.js"), "utf8");
const grab = (re, what) => { const m = re.exec(src); if (!m) throw new Error("not found in arena.js: " + what); return m[1]; };
const CLS = new Function("OUT", "return " + grab(/const CLS = (\{[\s\S]*?\}\}\});\n/, "CLS"))("");
const WANT = new Function("return " + grab(/const WANT = (\{[^}]*\});/, "WANT"))();
const num = n => +grab(new RegExp("\\b" + n + " = ([0-9.]+)"), n);
const BODY = num("BODY"), SPD = num("SPD"), AMMO = num("AMMO"), CHG = num("CHG");
const KEYS = Object.keys(CLS).filter(k => !CLS[k].off);

/* a seeded random number, so two runs give the same table */
let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
/* how far someone gets away from where the shot was aimed while it flies. Shooters aim ahead of a running target (the bots do
   too), so only a sudden turn helps: on average about a third of the way they could run in that time */
const side = (tgt, tof) => SPD * CLS[tgt.k].sp * tgt.spd() * tof * (0.1 + rnd() * 0.5);
/* a shot of radius r with lateral offset off (pixels) hits if the target, stepping aside by u, is still under it */
const lands = (off, r, u) => Math.abs(off - u) < BODY + r;

function fighter(k, x){ const c = CLS[k]; return {k, c, x, hp: c.hp, mx: c.hp, am: AMMO, rl: 0, cd: 0, sup: 0, chS: 0, fear: 0, slow: 0, lastHit: -9, lastShot: -9, beam: null, dealt: 0,
  spd(){ return (this.chS ? .55 : 1) * (this.slow > T ? CLS.beam.slow : 1); }}; }
let T = 0; const ev = [];
function hit(a, b, d, opts = {}){ ev.push({at: T + (opts.delay || 0), fn: () => { if (b.hp <= 0 || a.hp <= 0 && !opts.anyway) return; if (opts.reach && Math.abs(b.x - a.x) > opts.reach) return; b.hp -= d; b.lastHit = T; a.dealt += d; if (!opts.su) a.sup = Math.min(1, a.sup + d / a.c.sc);
  if (opts.kb) b.x += Math.sign(b.x - a.x || 1) * opts.kb; if (opts.fear) b.fear = T + opts.fear / 1000; if (opts.heal) a.hp = Math.min(a.mx, a.hp + d * opts.heal); }}); }

/* one attack (or super) from a at b, d apart */
function attack(a, b, d, su){
  const c = a.c, s2 = su ? Object.assign({}, c, c.su) : c, k = a.k;
  if (k === "punch"){
    if (su){ const land = Math.min(s2.rg, d), tof = s2.dur / 1000; a.x += Math.sign(b.x - a.x) * Math.max(0, land - 40); const u = side(b, tof) * .8; if (u < s2.splash + BODY) hit(a, b, s2.dmg, {delay: tof, kb: s2.kb, su: 1}); return; }
    /* the three punches: each one only lands if the other one is still within reach by then */
    for (let i = 0; i < c.jabs; i++) if (rnd() < .9) hit(a, b, c.dmg, {delay: i * .115, reach: c.rg + BODY}); return; }
  if (k === "beam"){
    if (su){ if (d <= s2.rg + BODY && rnd() < .85) hit(a, b, s2.dmg, {fear: s2.fear, su: 1}); return; }
    if (d > c.rg + BODY || rnd() > .9) return; a.beam = {b, n: 0, t0: T}; return; }
  if (c.lob){ const tof = c.lob / 1000 * (.6 + .4 * Math.min(1, d / s2.rg)), u = side(b, tof) * (rnd() < .5 ? 1 : -1), rr = (s2.splash || 60) + BODY * .6; if (Math.abs(u) < rr) hit(a, b, s2.dmg, {delay: tof, kb: su ? s2.kb : 0, su}); return; }
  if (k === "gun"){ for (let i = 0; i < s2.n; i++){ const tof = d / s2.v, u = side(b, tof + i * s2.gap / 1000) * (rnd() < .5 ? 1 : -1), off = (((i * 37) % 7) - 3) * .007 * d; if (d <= s2.rg && lands(off, c.r, u)) hit(a, b, s2.dmg, {delay: tof + i * s2.gap / 1000, su}); } return; }
  if (k === "rang"){ const n = s2.n || 1; for (let i = 0; i < n; i++){ const off = n > 1 ? (i - (n - 1) / 2) * s2.spr * d : 0, tof = d / c.v; if (d > s2.rg) continue;
      const u = side(b, tof) * (rnd() < .5 ? 1 : -1); if (lands(off, c.r, u)) hit(a, b, s2.dmg, {delay: tof, su});
      /* and on its way back, past the same spot a little later */
      const u2 = side(b, tof * 2) * (rnd() < .5 ? 1 : -1); if (lands(off, c.r, u2)) hit(a, b, s2.dmg, {delay: tof * 2, su}); } return; }
  /* shotgun pellets and the sniper's bullet */
  const ch = k === "snipe" && !su && a.chS ? Math.min(1, (T - a.chS) / (CHG / 1000)) : 0, n = s2.n || 1, v = s2.v * (1 + ch / 2), r = (s2.r || c.r) + ch * 4;
  const dmg = su ? s2.dmg : k === "snipe" ? Math.round(c.dmg + c.chg * Math.pow(ch, 1.3)) : s2.dmg, tof = d / v, u = side(b, tof) * (rnd() < .5 ? 1 : -1);
  for (let i = 0; i < n; i++){ const off = n > 1 ? Math.tan((i - (n - 1) / 2) * s2.spr) * d : 0; if (d <= s2.rg && lands(off, r, u)) hit(a, b, dmg, {delay: tof, kb: su && s2.kb ? s2.kb / n : 0, su}); }
}

function duel(k1, k2){
  T = 0; ev.length = 0; const d0 = 420 + rnd() * 480, A = fighter(k1, 700 - d0 / 2), B = fighter(k2, 700 + d0 / 2), F = [A, B], dt = .02;
  while (T < 120){
    T += dt; const wall = Math.max(260, 1400 - T * 16);
    for (const e of ev.splice(0).sort((x, y) => x.at - y.at)) if (e.at <= T) e.fn(); else ev.push(e);
    if (A.hp <= 0 || B.hp <= 0) break;
    for (const [a, b] of [[A, B], [B, A]]){
      const c = a.c, d = Math.abs(b.x - a.x), dir = Math.sign(b.x - a.x) || 1;
      a.rl += dt * 1000; while (a.am < AMMO && a.rl >= c.rl){ a.am++; a.rl -= c.rl; } if (a.am >= AMMO) a.rl = 0; a.cd -= dt * 1000;
      /* health comes back after 3 s without being hit and without shooting */
      if (T - a.lastHit > 3 && T - a.lastShot > 3) a.hp = Math.min(a.mx, a.hp + a.mx * .14 * dt);
      /* a beam ticks while it holds */
      if (a.beam){ const bm = a.beam; if (b.hp <= 0 || d > CLS.beam.rg * CLS.beam.brk) a.beam = null; else { b.slow = T + .1; while (bm.n < CLS.beam.ticks && T - bm.t0 >= (bm.n + 1) * CLS.beam.every / 1000){ bm.n++; hit(a, b, CLS.beam.dmg, {heal: CLS.beam.heal}); } if (bm.n >= CLS.beam.ticks) a.beam = null; } }
      /* moving: blinded runs away; the boxer rushes in; the others keep their distance */
      let mv = 0; const want = c.rg * (WANT[a.k] || .6);
      if (a.fear > T) mv = -1; else if (a.k === "punch" || d > want) mv = 1; else if (d < want * .55) mv = -.8;
      a.x += mv * dir * SPD * c.sp * a.spd() * dt; a.x = clamp(a.x, 700 - wall / 2, 700 + wall / 2);
      if (Math.abs(b.x - a.x) < BODY) a.x = b.x - dir * BODY;
      if (a.fear > T) continue;
      const d2 = Math.abs(b.x - a.x), su = c.su, sr = su.rg || c.rg;
      if (a.sup >= 1 && d2 < sr * .9){ a.sup = 0; a.chS = 0; a.lastShot = T; attack(a, b, d2, true); continue; }
      if (a.k === "snipe" && d2 > 300 && !a.chS && a.am >= 1) a.chS = T;
      const inR = d2 < (a.k === "punch" ? c.rg + BODY - 4 : c.rg * .95);
      if (inR && a.am >= 1 && a.cd <= 0 && (a.k !== "snipe" || !a.chS || T - a.chS > CHG / 1000 * .9)){ a.am--; a.cd = c.cd; a.lastShot = T; attack(a, b, d2, false); a.chS = 0; }
    }
  }
  return A.hp > 0 && B.hp <= 0 ? 1 : B.hp > 0 && A.hp <= 0 ? 0 : .5;
}

function table(n = 300){ const W = {}; KEYS.forEach(a => { W[a] = {}; KEYS.forEach(b => { W[a][b] = .5; }); });
  for (let i = 0; i < KEYS.length; i++) for (let j = i + 1; j < KEYS.length; j++){ let s = 0; for (let r = 0; r < n; r++) s += r % 2 ? duel(KEYS[i], KEYS[j]) : 1 - duel(KEYS[j], KEYS[i]); const w = s / n; W[KEYS[i]][KEYS[j]] = w; W[KEYS[j]][KEYS[i]] = 1 - w; }
  const avg = Object.fromEntries(KEYS.map(a => [a, KEYS.filter(b => b !== a).reduce((x, b) => x + W[a][b], 0) / (KEYS.length - 1)]));
  return {W, avg}; }

/* --tune: finds a strength factor per fighter so every fighter wins about half its duels. Damage takes 60 % of the change,
   health 40 %, so each fighter keeps its character (the boxer stays the one with the most health, the sniper hits hardest) */
function tune(rounds = 14, n = 240){
  const base = JSON.parse(JSON.stringify(CLS)), f = Object.fromEntries(KEYS.map(k => [k, 1]));
  const apply = () => KEYS.forEach(k => { const b = base[k], c = CLS[k], dm = Math.pow(f[k], .6), hm = Math.pow(f[k], .4);
    c.hp = b.hp * hm; c.dmg = b.dmg * dm; if (b.chg) c.chg = b.chg * dm; if (b.su.dmg) c.su.dmg = b.su.dmg * dm; });
  let res; for (let r = 0; r < rounds; r++){ apply(); res = table(n); KEYS.forEach(k => { f[k] *= clamp(Math.pow(.5 / clamp(res.avg[k], .03, .97), .45), .8, 1.25); }); }
  apply(); res = table(n * 2); return {f, res}; }
if (require.main === module && process.argv.includes("--tune")){
  const {f, res} = tune(), pc = x => Math.round(x * 100) + "%";
  KEYS.forEach(k => { const c = CLS[k]; console.log(k.padEnd(6), "Faktor", f[k].toFixed(2), " hp", Math.round(c.hp), " dmg", +c.dmg.toFixed(1), c.chg ? " chg " + Math.round(c.chg) : "", c.su.dmg ? " su.dmg " + Math.round(c.su.dmg) : "", " →", pc(res.avg[k])); });
  process.exit(0); }
if (require.main === module){
  const {W, avg} = table(+(process.argv.find(x => /^\d+$/.test(x)) || 300));
  if (process.argv.includes("--json")) console.log(JSON.stringify(avg));
  else { const pc = x => (Math.round(x * 100) + "%").padStart(5);
    console.log("Gewinnrate im Duell (Zeile gegen Spalte)\n" + "".padEnd(8) + KEYS.map(k => k.padStart(6)).join("") + "   Schnitt");
    KEYS.forEach(a => console.log(a.padEnd(8) + KEYS.map(b => a === b ? "    –" : pc(W[a][b])).map(x => x.padStart(6)).join("") + "   " + pc(avg[a])));
    const lo = Math.min(...Object.values(avg)), hi = Math.max(...Object.values(avg)); console.log("\nSpanne: " + pc(lo).trim() + " bis " + pc(hi).trim()); }
}
module.exports = {table, CLS, KEYS};
