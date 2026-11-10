/* ===== Natposter Arena: a Brawl-Stars-style fight at the emergency meeting.
   Everyone alive runs through the middle of the station (cafeteria, storage, chess lounge, oxygen) and shoots.
   Walls and furniture stop shots, gas closes in, the last one standing wins and picks a secret bonus for the round.
   Network: every phone moves itself ("am"), says when it shoots ("as") and when it got hit ("ah").
   The host keeps the health ("ahp"), runs the bots ("amb") and decides who is out. ===== */
(() => {
  const {T} = PG, now = () => Date.now(), N = () => PG.npx;
  const PICK = 4500, FIGHT = 50000, PERK = 7000, BAN = 2600, GAS0 = 16000, GAS1 = 44000, R0 = 820, R1 = 150, GC = {x: 1290, y: 640}, BODY = 26, SPD = 255;
  const CLS = {
    shot: {e: "💥", en: "Shotgun", de: "Schrotflinte", sen: "Close · 5 pellets", sde: "Nah · 5 Kugeln", hp: 125, sp: 1, rl: 1450, cd: 380, rg: 330, n: 5, spr: .12, v: 1050, dmg: 11, r: 7},
    rock: {e: "🚀", en: "Rockets", de: "Raketen", sen: "Explodes · burns", sde: "Explodiert · Brandfeld", hp: 95, sp: .95, rl: 1900, cd: 480, rg: 560, n: 1, v: 690, dmg: 24, r: 11, splash: 72, sdmg: 16, field: 2600},
    melee: {e: "🥊", en: "Brawler", de: "Faust", sen: "Lots of health", sde: "Viel Leben · Faust", hp: 175, sp: 1.12, rl: 900, cd: 320, rg: 112, cone: .95, dmg: 34},
    fire: {e: "🔥", en: "Fire trail", de: "Flammenspur", sen: "Flames · fire trail", sde: "Flammen · Feuerspur", hp: 130, sp: 1.15, rl: 1250, cd: 380, rg: 205, cone: .42, dmg: 17, burn: 3000},
    snipe: {e: "🎯", en: "Sniper", de: "Scharfschütze", sen: "Far · harder far away", sde: "Weit · trifft weit stärker", hp: 80, sp: .95, rl: 2000, cd: 450, rg: 780, n: 1, v: 1600, dmg: 15, far: 30, r: 6}};
  const KEYS = Object.keys(CLS), AMMO = 3;
  const PERKS = {
    vote2: {e: "🗳️", en: "Double vote", de: "Doppelte Stimme", sen: "Your vote counts twice now.", sde: "Deine Stimme zählt jetzt doppelt."},
    revive: {e: "💉", en: "Revive", de: "Wiederbeleben", sen: "Bring someone back. They stay silent.", sde: "Hol jemanden zurück. Er bleibt stumm."},
    chain: {e: "⛓️", en: "Shackles", de: "Fesseln", sen: "30 s: Natposters can't kill or vent.", sde: "30 s: Natposter können nicht töten, keine Schächte."},
    track: {e: "📍", en: "Tracker", de: "Peilsender", sen: "20 s: you see where the Natposters are.", sde: "20 s: du siehst, wo die Natposter sind."},
    knife: {e: "🔪", en: "Knife", de: "Messer", sen: "You may kill once.", sde: "Du darfst einmal töten."},
    flame: {e: "🔥", en: "Fire trail", de: "Feuerspur", sen: "Every 10 s a fire trail. Whoever walks through burns.", sde: "Alle 10 s eine Feuerspur. Wer durchläuft, brennt."},
    sabkeep: {e: "☢️", en: "Sabotage stays", de: "Sabotage bleibt", sen: "Sabotage keeps going and is ready at once.", sde: "Sabotage läuft weiter und ist sofort bereit."},
    killreset: {e: "⚡", en: "Instant kill", de: "Sofort töten", sen: "No cooldown after the meeting.", sde: "Nach dem Meeting kein Abklingen."},
    ghost: {e: "🫥", en: "Invisible", de: "Unsichtbar", sen: "12 s invisible after the meeting.", sde: "12 s unsichtbar nach dem Meeting."}};
  const nm = o => T(o.en, o.de);
  const rngOf = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const isBot = id => /^bot/.test(id) || !!(((PNet.P && PNet.P.G && PNet.P.G.s && PNet.P.G.s.bots) || []).find(b => b.id === id));

  /* ---------------- the arena: four rooms and the three halls between them ---------------- */
  let AR = null, BARS = null, ADJ = null;
  const areas = () => AR || (AR = N().ROOMS.filter(r => ["caf", "chess", "sto", "o2"].includes(r.id)).concat(N().HALLS.filter(h => [[1230, 556], [976, 760], [1476, 760]].some(([x, y]) => h.x === x && h.y === y))));
  const inside = (a, x, y) => x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h;
  const inAr = (x, y) => areas().some(a => inside(a, x, y));
  const overlap = (a, b) => { const x1 = Math.max(a.x, b.x), x2 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.max(a.y, b.y), y2 = Math.min(a.y + a.h, b.y + b.h); return x1 <= x2 + 1 && y1 <= y2 + 1 && (x2 - x1 > 30 || y2 - y1 > 30) ? {x1, x2, y1, y2} : null; };
  /* where the arena meets the rest of the station: a glowing barrier */
  const bars = () => BARS || (BARS = (() => { const out = []; areas().forEach(a => N().AREAS.forEach(b => { if (areas().includes(b)) return; const o = overlap(a, b); if (o) out.push(o); })); return out; })());
  const adj = () => ADJ || (ADJ = areas().map((a, i) => areas().map((b, j) => j).filter(j => j !== i && overlap(a, areas()[j]))));
  const bodySolid = (x, y) => N().OBST.some(o => Math.hypot(x - o.x, y - o.y) < o.r) || N().OBR.some(o => N().rdist(o, x, y) < 16);
  const shotSolid = (x, y) => N().OBST.some(o => Math.hypot(x - o.x, y - o.y) < o.r - 12) || N().OBR.some(o => x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h);
  const walkA = (x, y) => { const r = 20; return inAr(x - r, y) && inAr(x + r, y) && inAr(x, y - r) && inAr(x, y + r + 6) && !bodySolid(x, y); };
  const clear = (a, b) => { const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 14); for (let i = 1; i < n; i++){ const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n; if (!inAr(x, y) || shotSolid(x, y)) return false; } return true; };
  const gasR = el => el < GAS0 ? 99999 : R0 - (R0 - R1) * Math.min(1, (el - GAS0) / (GAS1 - GAS0));
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return Math.abs(d); };
  /* the next point to walk to: straight there in the same room, else the doorway to the next room */
  function wayTo(from, to){
    const L = areas(), ai = L.findIndex(a => inside(a, from.x, from.y)), bi = L.findIndex(a => inside(a, to.x, to.y)); if (ai < 0 || bi < 0 || ai === bi) return to;
    const prev = {[ai]: -1}, q = [ai]; while (q.length){ const i = q.shift(); if (i === bi) break; adj()[i].forEach(j => { if (prev[j] === undefined){ prev[j] = i; q.push(j); } }); }
    if (prev[bi] === undefined) return to; let j = bi; while (prev[j] !== ai && prev[j] !== -1) j = prev[j];
    const o = overlap(L[ai], L[j]); return {x: (o.x1 + o.x2) / 2, y: (o.y1 + o.y2) / 2};
  }
  const SPN = [[1060, 200], [1500, 200], [1060, 525], [1500, 525], [1280, 200], [1280, 525], [660, 700], [660, 920], [920, 920], [800, 800], [1430, 700], [1160, 950], [1300, 820], [1680, 720], [1880, 720], [1880, 900], [1680, 900]];
  function spawns(n, R){
    const P = SPN.map(([x, y]) => ({x, y})).filter(p => walkA(p.x, p.y)), out = [P.splice(Math.floor(R() * P.length), 1)[0]];
    while (out.length < n && P.length){ let bi = 0, bd = -1; P.forEach((p, i) => { const d = Math.min(...out.map(q => Math.hypot(p.x - q.x, p.y - q.y))) + R() * 60; if (d > bd){ bd = d; bi = i; } }); out.push(P.splice(bi, 1)[0]); }
    while (out.length < n) out.push({x: out[out.length % 17].x + 30, y: out[out.length % 17].y}); return out;
  }

  /* ---------------- the host: health, bots, who is out, the bonus ---------------- */
  const HB = {bots: {}, seen: new Set(), int: 0, hpT: 0, dirty: false, dot: {}, dotT: 0, ambT: 0};
  const hostG = () => { const P = PNet.P; return P && P.isHost && P.G && P.G.s ? P.G : null; };
  const hostMg = () => { const G = hostG(), mg = G && G.s.meet && G.s.meet.mg; return mg && mg.g === "arena" && mg.ar ? mg : null; };
  /* everything the host says about the arena also reaches its own screen */
  const bc = m => { PNet.raw(m); client.onMsg(Object.assign({id: PNet.me}, m)); };
  function hostInit(G, mg){
    const s = G.s, ids = G.ids.filter(id => s.alive[id]), sp = spawns(ids.length, rngOf(mg.seed));
    mg.ar = {ph: "pick", pickEnd: mg.t0 + N().SPIN + PICK, fight: 0, end: 0, ids, hp: {}, mx: {}, cls: {}, out: [], sp: Object.fromEntries(ids.map((id, i) => [id, sp[i]])), dmg: {}, kills: {}, lh: {}, ls: {}, feed: []};
    (s.bots || []).forEach(b => { if (ids.includes(b.id)) mg.ar.cls[b.id] = KEYS[Math.floor(Math.random() * KEYS.length)]; });
    mg.end = mg.ar.pickEnd + FIGHT; HB.seen.clear(); HB.bots = {}; HB.dot = {};
  }
  function stopHost(){ clearInterval(HB.int); HB.int = 0; }
  function hostTick(G){
    const s = G.s, mg = s.meet && s.meet.mg; if (!mg || mg.g !== "arena" || !mg.ar || mg.done){ stopHost(); return false; }
    const A = mg.ar; let ch = false;
    if (!HB.int) HB.int = setInterval(() => { try { hostLoop(); } catch(e) { console.error(e); } }, 50);
    if (A.ph === "pick" && now() >= A.pickEnd){ A.ph = "fight"; A.fight = now(); A.end = now() + FIGHT; mg.end = A.end;
      A.ids.forEach(id => { if (!CLS[A.cls[id]]) A.cls[id] = KEYS[Math.floor(Math.random() * KEYS.length)]; A.mx[id] = A.hp[id] = CLS[A.cls[id]].hp; A.dmg[id] = 0; A.kills[id] = 0; A.lh[id] = A.ls[id] = 0; });
      botsInit(s, A); ch = true; }
    /* a new host after a handover takes the bots over where they were */
    if (A.ph === "fight" && !Object.keys(HB.bots).length && (s.bots || []).some(b => A.ids.includes(b.id))) botsInit(s, A);
    if (A.ph === "fight"){ const alive = A.ids.filter(id => !A.out.includes(id)), humans = A.ids.filter(id => !isBot(id));
      if (alive.length <= 1 || now() >= A.end || (humans.length && !alive.some(id => humans.includes(id)) && alive.length)){ finish(G, mg); ch = true; } }
    return ch;
  }
  function botsInit(s, A){ HB.bots = {}; (s.bots || []).forEach(b => { if (!A.ids.includes(b.id)) return; const q = C.AP[b.id], p = q && q.dx != null ? {x: q.dx, y: q.dy} : A.sp[b.id]; HB.bots[b.id] = {x: p.x, y: p.y, a: 0, f: 1, mv: 0, am: AMMO, rl: 0, cd: 600 + Math.random() * 900, str: Math.random() < .5 ? -1 : 1, strT: 0, seen: 0, skill: .55 + Math.random() * .45}; }); }
  function hostLoop(){
    const G = hostG(), mg = hostMg(); if (!G || !mg || mg.done){ stopHost(); return; }
    const A = mg.ar; if (A.ph === "pick"){ if (now() >= A.pickEnd && hostTick(G)) PNet.refresh(); return; }
    if (A.ph !== "fight") return;
    const dt = .05; botsStep(A, dt); regen(A, dt); botHazards(A, dt);
    if (now() - HB.ambT > 130){ HB.ambT = now(); const l = Object.entries(HB.bots).filter(([id]) => !A.out.includes(id)).map(([id, b]) => [id, Math.round(b.x), Math.round(b.y), Math.round(b.a * 100), b.mv ? 1 : 0, b.f]); if (l.length) PNet.raw({t: "amb", l}); }
    if (HB.dirty && now() - HB.hpT > 150){ HB.dirty = false; HB.hpT = now(); bc({t: "ahp", hp: rnd(A.hp), out: A.out, f: A.feed.slice(-4)}); }
    if (hostTick(G)) PNet.refresh();
  }
  const rnd = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
  function hostHit(vic, d, by, k){
    const G = hostG(), mg = hostMg(), A = mg && mg.ar; if (!A || A.ph !== "fight" || !A.ids.includes(vic) || A.out.includes(vic) || !(d > 0)) return;
    if (k){ const key = vic + "|" + k; if (HB.seen.has(key)) return; HB.seen.add(key); if (HB.seen.size > 5000) HB.seen.clear(); }
    d = Math.min(90, d); A.hp[vic] = Math.max(0, A.hp[vic] - d); A.lh[vic] = now(); if (by && by !== vic && A.dmg[by] != null) A.dmg[by] += d; HB.dirty = true;
    if (A.hp[vic] <= 0){ A.out.push(vic); if (by && by !== vic && A.kills[by] != null) A.kills[by]++; A.feed.push([A.ids.includes(by) ? by : "", vic, A.ids.includes(by) ? A.cls[by] : "gas"]); if (A.feed.length > 8) A.feed.shift();
      HB.hpT = now(); HB.dirty = false; bc({t: "ahp", hp: rnd(A.hp), out: A.out, f: A.feed.slice(-4), ko: vic}); if (hostTick(G)) {} PNet.refresh(); }
  }
  function regen(A, dt){ A.ids.forEach(id => { if (A.out.includes(id) || A.hp[id] >= A.mx[id]) return; if (now() - (A.lh[id] || 0) > 3000 && now() - (A.ls[id] || 0) > 3000){ A.hp[id] = Math.min(A.mx[id], A.hp[id] + A.mx[id] * .14 * dt); HB.dirty = true; } }); }
  const posOf = id => { if (id === PNet.me && C.on && C.me) return C.me; const b = HB.bots[id]; if (b) return b; const p = C.AP[id]; return p && p.dx != null ? {x: p.dx, y: p.dy} : null; };
  const velOf = id => { const b = C.AP[id] && C.AP[id].buf; if (!b || b.length < 2) return {x: 0, y: 0}; const p = b[b.length - 2], q = b[b.length - 1], dt = Math.max(30, q.t - p.t) / 1000; return {x: (q.x - p.x) / dt, y: (q.y - p.y) / dt}; };
  /* bots: keep their distance, strafe, shoot when they see you, run from the gas */
  function botsStep(A, dt){
    const el = now() - A.fight, gr = gasR(el);
    for (const id in HB.bots){ const b = HB.bots[id]; if (A.out.includes(id)){ b.mv = 0; continue; } const cl = CLS[A.cls[id]];
      b.rl += dt * 1000; while (b.am < AMMO && b.rl >= cl.rl){ b.am++; b.rl -= cl.rl; } if (b.am >= AMMO) b.rl = 0; b.cd -= dt * 1000;
      let best = null; A.ids.forEach(o => { if (o === id || A.out.includes(o)) return; const q = posOf(o); if (!q) return; const d = Math.hypot(q.x - b.x, q.y - b.y), los = d < 900 && clear(b, q), sc = d - (los ? 260 : 0); if (!best || sc < best.sc) best = {id: o, q, d, los, sc}; });
      let gx = 0, gy = 0; const outGas = Math.hypot(b.x - GC.x, b.y - GC.y) > gr - 60;
      const go = t => { const w = wayTo(b, t), dx = w.x - b.x, dy = w.y - b.y, d = Math.hypot(dx, dy) || 1; gx = dx / d; gy = dy / d; };
      if (outGas) go(GC);
      else if (best && best.los){ const want = cl.rg * (cl.cone ? .5 : .68), dx = best.q.x - b.x, dy = best.q.y - b.y, d = best.d || 1, k = d > want ? 1 : d < want * .55 ? -.8 : 0;
        if (now() > b.strT){ b.strT = now() + 500 + Math.random() * 900; if (Math.random() < .45) b.str *= -1; } gx = dx / d * k - dy / d * b.str * .85; gy = dy / d * k + dx / d * b.str * .85; }
      else if (best) go(best.q);
      const m = Math.hypot(gx, gy); b.mv = m > .1 ? 1 : 0;
      if (b.mv){ const sp = SPD * cl.sp * .92 * dt, nx = b.x + gx / m * sp, ny = b.y + gy / m * sp; let moved = false; if (walkA(nx, b.y)){ b.x = nx; moved = true; } if (walkA(b.x, ny)){ b.y = ny; moved = true; } if (!moved){ b.str *= -1; b.strT = now() + 700; } if (Math.abs(gx) > .1) b.f = gx < 0 ? -1 : 1; }
      if (best && best.los){ if (!b.seen) b.seen = now(); b.a = Math.atan2(best.q.y - b.y, best.q.x - b.x); } else b.seen = 0;
      if (best && best.los && b.seen && now() - b.seen > 380 && best.d < cl.rg * (cl.cone ? .95 : .92) && b.am >= 1 && b.cd <= 0){
        const v = velOf(best.id), tt = cl.v ? best.d / cl.v : 0, ax = best.q.x + v.x * tt * b.skill, ay = best.q.y + v.y * tt * b.skill;
        const a = Math.atan2(ay - b.y, ax - b.x) + (Math.random() - .5) * .34 * (1.35 - b.skill); b.am--; b.cd = cl.cd + 200 + Math.random() * 600; b.a = a; b.f = Math.cos(a) < 0 ? -1 : 1;
        A.ls[id] = now(); bc({t: "as", by: id, k: id.slice(-3) + (++C.seq), c: A.cls[id], x: Math.round(b.x), y: Math.round(b.y), a: Math.round(a * 1000) / 1000}); }
      const p = C.AP[id] || (C.AP[id] = {buf: []}); p.dx = b.x; p.dy = b.y; p.a = b.a; p.f = b.f; p.mv = b.mv; p.t = now(); }
  }
  /* fire on the floor, the fire trail and the gas also hurt the bots */
  function botHazards(A, dt){
    const el = now() - A.fight, gr = gasR(el);
    for (const id in HB.bots){ if (A.out.includes(id)) continue; const b = HB.bots[id], h = hazards(b, id, el, gr); if (h.dps <= 0) continue;
      const o = HB.dot[id] || (HB.dot[id] = {d: 0, t: now(), by: ""}); o.d += h.dps * dt; o.by = h.by; if (now() - o.t > 300 && o.d >= 1){ hostHit(id, Math.round(o.d), o.by, null); o.d = 0; o.t = now(); } }
  }
  function finish(G, mg){
    const s = G.s, A = mg.ar; A.ph = "done"; stopHost();
    const alive = A.ids.filter(id => !A.out.includes(id)).sort((a, b) => A.hp[b] / A.mx[b] - A.hp[a] / A.mx[a] || (A.dmg[b] || 0) - (A.dmg[a] || 0));
    const rank = alive.concat(A.out.slice().reverse()); rank.forEach((id, i) => { mg.sc[id] = -(i + 1); mg.at[id] = now(); });
    mg.win = rank[0] || null; mg.done = now(); mg.end = now() + BAN; if (mg.win){ s.dw = s.dw || {}; s.dw[mg.win] = (s.dw[mg.win] || 0) + 1; }
    G.sk++; s.snd = {k: "s" + G.sk, n: "mgwin"};
    mg.perk = mg.win ? {opts: perkOpts(G, mg.win), until: now() + N().RES + BAN + PERK, pick: null} : null;
    s.meet.until = now() + N().RES + BAN + (+G.opts.meet || 60) * 1000;
    if (mg.win && isBot(mg.win) && mg.perk){ const o = mg.perk.opts[Math.floor(Math.random() * mg.perk.opts.length)], R = revivable(G); hostAct(G, mg.win, {a: "arperk", v: o, t: R[Math.floor(Math.random() * R.length)]}); }
    bc({t: "ahp", hp: rnd(A.hp), out: A.out, f: A.feed.slice(-4)});
  }
  const revivable = G => { const s = G.s; return G.ids.filter(x => !s.alive[x] && !(s.gone || {})[x] && s.killed && s.killed[x] && s.imps.includes(s.killed[x].by)); };
  function perkOpts(G, id){ const imp = G.s.imps.includes(id), pool = imp ? ["sabkeep", "killreset", "ghost"] : ["revive", "chain", "track", "knife", "flame"].filter(k => k !== "revive" || revivable(G).length);
    return ["vote2"].concat(PG.shuffle(pool).slice(0, 2)); }
  function hostAct(G, id, a){
    const s = G.s, mg = s.meet && s.meet.mg; if (!mg || mg.g !== "arena" || !mg.ar) return false; const A = mg.ar;
    if (a.a === "arcl"){ if (A.ph === "pick" && A.ids.includes(id) && CLS[a.v]) A.cls[id] = a.v; return true; }
    if (a.a === "arperk"){ const P2 = mg.perk; if (!mg.done || !P2 || P2.pick || id !== mg.win || !P2.opts.includes(a.v)) return true;
      if (a.v === "revive"){ if (!revivable(G).includes(a.t)) return true; P2.t = a.t; }
      P2.pick = a.v; s.perkNext = {id, k: a.v, t: P2.t || null}; return true; }
    return false;
  }
  function hostView(G, mg, id){
    const A = mg.ar, P2 = mg.perk;
    return {ph: A.ph, ids: A.ids, cls: A.cls, hp: rnd(A.hp), mx: A.mx, out: A.out, sp: A.sp, feed: A.feed.slice(-4), kills: A.kills, pickLeft: Math.max(0, A.pickEnd - now()), fightEl: A.fight ? now() - A.fight : 0, left: A.end ? Math.max(0, A.end - now()) : 0,
      perk: P2 ? (id === mg.win ? {opts: P2.opts, pick: P2.pick, t: P2.t || null, left: Math.max(0, P2.until - now()), rev: P2.opts.includes("revive") ? revivable(G) : []} : {pick: !!P2.pick}) : null};
  }
  function hostMsg(m){
    const mg = hostMg(), A = mg && mg.ar; if (!A || mg.done) return;
    if (m.t === "as" && A.ls && A.ids.includes(m.by)) A.ls[m.by] = now();
    if (m.t === "ah" && A.ids.includes(m.id)) hostHit(m.id, +m.d || 0, A.ids.includes(m.by) ? m.by : "", m.k ? String(m.k).slice(0, 24) : null);
  }
  /* after the meeting: what the winner picked changes the round */
  function applyPerk(G, pk){
    const s = G.s, id = pk.id;
    if (pk.k === "revive" && pk.t && !s.alive[pk.t]){ s.alive[pk.t] = true; s.mute = s.mute || {}; s.mute[pk.t] = 1; if (s.killed) delete s.killed[pk.t]; s.ps = s.ps || {}; s.ps[pk.t] = {k: "p" + (++G.sk), n: "revived"}; }
    if (pk.k === "chain") s.chain = now() + 30000;
    if (pk.k === "track") s.track = {id, until: now() + 20000};
    if (pk.k === "knife"){ s.knife = s.knife || {}; s.knife[id] = 1; }
    if (pk.k === "flame"){ s.flame = s.flame || {}; s.flame[id] = 1; }
    if (pk.k === "killreset") s.killAt[id] = now();
    if (pk.k === "ghost") s.invis = {id, until: now() + 12000};
    if (pk.k === "sabkeep") s.sabAt = now();
  }

  /* ---------------- this phone: move, aim, shoot, draw ---------------- */
  const C = {on: false, seed: null, A: null, me: null, am: AMMO, rl: 0, cd: 0, seq: 0, AP: {}, proj: [], fx: [], fields: [], trail: [], pops: [], sent: 0, sentP: null, moveP: null, aimP: null, keys: {}, dot: 0, dotT: 0, dotBy: "", burn: 0, burnBy: "", hurtT: 0, shake: 0, hitAt: {}, L: null, t0: 0, pickEnd: 0, fightT0: 0, endAt: 0, doneAt: 0, started: false, hpT: 0, outShown: false, lastTr: {}, sndT: {}};
  const me = () => PNet.me;
  const NPo = () => N().NP;
  function reset(){ Object.assign(C, {on: false, seed: null, A: null, me: null, proj: [], fx: [], fields: [], trail: [], pops: [], AP: {}, moveP: null, aimP: null, started: false, doneAt: 0, outShown: false, lastTr: {}, burn: 0, dot: 0}); leaveLayer(); }
  const amIn = () => C.A && C.A.ids.includes(me());
  const alive = id => C.A && C.A.ids.includes(id) && !C.A.out.includes(id);
  const fighting = () => C.A && C.A.ph === "fight" && C.started && alive(me()) && C.me;
  const pos = id => id === me() && C.me ? C.me : C.AP[id] && C.AP[id].dx != null ? {x: C.AP[id].dx, y: C.AP[id].dy} : C.A && C.A.sp[id] ? C.A.sp[id] : null;
  const isHost = () => !!(PNet.P && PNet.P.isHost);
  /* sounds: from NP's little synth (quiet when the game sound is off), softer when it's far away */
  function snd(n, at){ const x = NPo().sfx, d = at && C.me ? Math.hypot(at.x - C.me.x, at.y - C.me.y) : 0, g = Math.max(.15, 1 - d / 900); if (now() - (C.sndT[n] || 0) < 45) return; C.sndT[n] = now(); try {
    if (n === "shot"){ x.noise(0, .14, 2600, 400, .2 * g, "lowpass"); x.tone(0, 170, 55, .1, .12 * g, "square"); }
    else if (n === "rock"){ x.noise(0, .38, 500, 1900, .13 * g, "bandpass", 2); }
    else if (n === "boom"){ x.noise(0, .55, 1000, 50, .36 * g, "lowpass"); x.tone(0, 95, 32, .45, .3 * g, "sine"); }
    else if (n === "melee"){ x.noise(0, .1, 3200, 700, .16 * g, "highpass"); x.tone(.03, 150, 60, .1, .2 * g, "sine"); }
    else if (n === "fire"){ x.noise(0, .32, 900, 2600, .14 * g, "bandpass", .7); }
    else if (n === "snipe"){ x.tone(0, 1900, 260, .14, .09 * g, "sawtooth"); x.noise(0, .09, 5000, 1400, .14 * g, "highpass"); }
    else if (n === "hurt"){ x.tone(0, 230, 80, .14, .2, "square"); }
    else if (n === "hit"){ x.tone(0, 680, 320, .06, .06 * g, "square"); }
    else if (n === "ko"){ x.chord(0, [60, 63, 67], .45, .07, "sawtooth"); x.noise(0, .4, 1800, 200, .2, "lowpass"); }
    else if (n === "empty"){ x.tone(0, 320, 300, .04, .05, "square"); }
    else if (n === "go"){ x.chord(0, [67, 71, 74], .25, .07, "square"); x.chord(.22, [72, 76, 79], .45, .07, "square"); }
    else if (n === "win"){ x.chord(0, [60, 64, 67], .3, .07, "triangle"); x.chord(.25, [65, 69, 72], .3, .07, "triangle"); x.chord(.5, [72, 76, 79], .7, .08, "triangle"); }
  } catch(e) {} }

  /* the view from the host: phases, health, classes */
  function view(v){
    const mg = v && v.phase === "meet" && v.meet && v.meet.mg; if (!mg || mg.g !== "arena" || !mg.ar){ if (C.seed != null) reset(); return; }
    const a = mg.ar; if (C.seed !== mg.seed){ reset(); C.seed = mg.seed; C.t0 = now() - (mg.el || 0); }
    const A = C.A || (C.A = {hp: {}, mx: {}, out: [], feed: []}); A.ph = a.ph; A.ids = a.ids; A.cls = a.cls; A.sp = a.sp; A.kills = a.kills || {}; A.perk = a.perk;
    if (now() - C.hpT > 500){ A.hp = Object.assign({}, a.hp); A.out = a.out.slice(); A.feed = a.feed || []; } A.mx = a.mx;
    const pe = now() + a.pickLeft; if (Math.abs(pe - C.pickEnd) > 250) C.pickEnd = pe;
    if (a.ph === "fight"){ const f0 = now() - a.fightEl; if (!C.fightT0 || Math.abs(f0 - C.fightT0) > 250) C.fightT0 = f0; C.endAt = now() + a.left; if (!C.started) start(); }
    if (mg.done && !C.doneAt){ C.doneAt = now(); C.win = mg.win; banner(mg.win ? `👑 ${esc(NPo().nm(mg.win))}` : T("Draw", "Unentschieden"), mg.win === me() ? "win" : ""); snd(mg.win === me() ? "win" : "ko"); if (mg.win === me()) Haptic.go([30, 50, 30, 50, 80]); }
  }
  function start(){
    C.started = true; const sp = C.A.sp[me()]; C.me = sp ? {x: sp.x, y: sp.y, a: 0, f: 1, mv: false} : null; C.am = AMMO; C.rl = 0; C.cd = 0; C.cls = C.A.cls[me()] || "shot";
    if (amIn()){ banner(T("GO!", "LOS!"), "go"); snd("go"); Haptic.go([20, 40, 20]); }
  }
  /* the arena takes the screen once the wheel has stopped, until the winner has been shown */
  function active(){ const v = NPo().v, mg = v && v.phase === "meet" && v.meet && v.meet.mg; if (!mg || mg.g !== "arena" || !C.A || C.seed !== mg.seed) return false;
    const on = now() - C.t0 >= N().SPIN && !(C.doneAt && now() - C.doneAt > BAN); if (on && !C.on) enter(); if (!on && C.on) leaveLayer(); return on; }
  function hold(mg){ const extra = mg.win === me() && C.A && C.A.perk && !C.A.perk.pick ? PERK : 0; return N().RES + BAN + extra; }

  /* ---- the layer above the station: class pick, sticks, health, kills ---- */
  function enter(){
    C.on = true; const NP = NPo(); if (!NP.el) return; NP.el.classList.add("arena"); NP.joy = null;
    let L = C.L; if (!L || !L.isConnected){ L = C.L = document.createElement("div"); L.className = "ar-l";
      L.innerHTML = `<div class="ar-hud"><span class="ar-t"></span><span class="ar-n"></span><span class="ar-gas">☠️ ${T("Gas", "Gas")}</span></div><div class="ar-feed"></div><div class="ar-ban"></div><div class="ar-pick"></div><div class="ar-joy"><i></i></div><div class="ar-fire"><b></b><span class="ar-am"><i></i><i></i><i></i></span></div>`;
      NP.el.appendChild(L); wire(L); }
    pickDraw(true);
  }
  function leaveLayer(){ C.on = false; const NP = NPo(); if (NP && NP.el) NP.el.classList.remove("arena"); if (C.L){ C.L.remove(); C.L = null; } C.moveP = C.aimP = null; }
  function banner(txt, cls){ C.ban = {txt, cls, t: now()}; const b = C.L && C.L.querySelector(".ar-ban"); if (b){ b.className = "ar-ban on " + (cls || ""); b.innerHTML = txt; b.style.animation = "none"; void b.offsetWidth; b.style.animation = ""; } }
  function wire(L){
    const gw = () => NPo().el.offsetWidth, LOC = N().LOC, joy = L.querySelector(".ar-joy"), knob = joy.firstChild, fb = L.querySelector(".ar-fire"), fk = fb.firstChild;
    L.addEventListener("pointerdown", e => { if (e.target.closest("button")) return; e.preventDefault(); const p = LOC(e);
      if (p.x < gw() * .45){ if (C.moveP) return; C.moveP = {x0: p.x, y0: p.y, dx: 0, dy: 0, id: e.pointerId}; joy.style.left = p.x + "px"; joy.style.top = p.y + "px"; joy.classList.add("on"); knob.style.transform = "translate(-50%,-50%)"; }
      else { if (C.aimP) return; C.aimP = {x0: p.x, y0: p.y, dx: 0, dy: 0, id: e.pointerId, man: false}; fb.classList.add("on"); fb.style.left = (p.x - 55) + "px"; fb.style.top = (p.y - 55) + "px"; fk.style.transform = ""; }
      try { L.setPointerCapture(e.pointerId); } catch(_) {} });
    L.addEventListener("pointermove", e => { const p = LOC(e);
      if (C.moveP && e.pointerId === C.moveP.id){ let dx = p.x - C.moveP.x0, dy = p.y - C.moveP.y0; const d = Math.hypot(dx, dy), m = 56; if (d > m){ dx *= m / d; dy *= m / d; } C.moveP.dx = dx / m; C.moveP.dy = dy / m; knob.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`; }
      if (C.aimP && e.pointerId === C.aimP.id){ let dx = p.x - C.aimP.x0, dy = p.y - C.aimP.y0; const d = Math.hypot(dx, dy); if (d > 16) C.aimP.man = true; C.aimP.dx = dx; C.aimP.dy = dy; const k = Math.min(1, 44 / Math.max(1, d)); fk.style.transform = `translate(${dx * k}px,${dy * k}px)`; } });
    const up = e => { if (C.moveP && e.pointerId === C.moveP.id){ C.moveP = null; joy.classList.remove("on"); }
      if (C.aimP && e.pointerId === C.aimP.id){ const a = C.aimP; C.aimP = null; fb.classList.remove("on"); fb.style.left = fb.style.top = ""; fk.style.transform = "";
        if (e.type === "pointerup") { if (a.man) fire(Math.atan2(a.dy, a.dx)); else autoFire(); } } };
    L.addEventListener("pointerup", up); L.addEventListener("pointercancel", up);
    L.addEventListener("click", e => { const b = e.target.closest("[data-arc]"); if (!b) return; pick(b.dataset.arc); });
    if (!C.kd){ C.kd = e => { if (!C.on) return; if (/^(Arrow|Key[WASD])/.test(e.code)){ C.keys[e.code] = 1; e.preventDefault(); } if (e.code === "Space"){ e.preventDefault(); autoFire(); } }; C.ku = e => { delete C.keys[e.code]; };
      window.addEventListener("keydown", C.kd); window.addEventListener("keyup", C.ku); }
  }
  function pick(k){ if (!CLS[k] || !C.A || C.A.ph !== "pick" || !amIn()) return; C.A.cls[me()] = k; PG.st.arCls = k; try { PG.persist(); } catch(e) {} Sound.tap(); Haptic.go(10); NPo().act({a: "arcl", v: k}); pickDraw(true); }
  function pickDraw(force){
    const box = C.L && C.L.querySelector(".ar-pick"); if (!box) return; const A = C.A, on = A && A.ph === "pick"; box.classList.toggle("on", !!on); if (!on) return;
    if (amIn() && !C.picked){ C.picked = 1; const k = CLS[PG.st.arCls] ? PG.st.arCls : KEYS[Math.floor(Math.random() * KEYS.length)]; if (!A.cls[me()]) { A.cls[me()] = k; NPo().act({a: "arcl", v: k}); } }
    const left = Math.max(0, C.pickEnd - now()), mine = A.cls[me()];
    const sig = JSON.stringify(A.cls) + amIn();
    if (force || box._sig !== sig){ box._sig = sig; const P = NPo().pl();
      box.innerHTML = `<div class="ar-pt">⚔️ ${amIn() ? T("Pick your weapon", "Wähl deine Waffe") : "👻 " + T("You're watching", "Du schaust zu")}</div><div class="ar-cards">${KEYS.map(k => { const c = CLS[k], who = A.ids.filter(id => A.cls[id] === k);
        return `<button class="ar-card ${mine === k ? "sel" : ""}" data-arc="${k}" ${amIn() ? "" : "disabled"}><span class="e">${c.e}</span><b>${esc(nm(c))}</b><small>${esc(T(c.sen, c.sde))}</small><i class="hp">❤ ${c.hp}</i><span class="who">${who.slice(0, 5).map(id => `<span class="np-hd sm">${headOf(id, P)}</span>`).join("")}</span></button>`; }).join("")}</div><div class="ar-pbar"><i></i></div>`; }
    const bar = box.querySelector(".ar-pbar i"); if (bar) bar.style.width = Math.min(100, left / PICK * 100) + "%";
  }
  const HC = {};
  function headOf(id, P){ const p = (P || NPo().pl()).find(x => x.id === id), k = id + (p && p.av ? JSON.stringify(p.av).length : 0); if (HC[k]) return HC[k]; try { return HC[k] = avatarSVG(Object.assign({}, p && p.av || {}, {aura: "none", pet: "none"}), {head: true, size: 22}); } catch(e) { return ""; } }
  function hud(){
    const L = C.L; if (!L || !C.A) return; const A = C.A, n = A.ids.filter(id => !A.out.includes(id)).length;
    const t = A.ph === "fight" ? `⏱ ${Math.max(0, Math.ceil((C.endAt - now()) / 1000))}` : A.ph === "pick" ? `⏱ ${Math.ceil(Math.max(0, C.pickEnd - now()) / 1000)}` : "⏱ 0";
    const te = L.querySelector(".ar-t"); if (te.textContent !== t) te.textContent = t; const ne = L.querySelector(".ar-n"), nt = `🧍 ${n}`; if (ne.textContent !== nt) ne.textContent = nt;
    L.querySelector(".ar-gas").classList.toggle("on", A.ph === "fight" && now() - C.fightT0 > GAS0 - 2000);
    const fh = (A.feed || []).slice(-3).map(([by, vic, c]) => `<div>${by ? `<b>${esc(NPo().nm(by))}</b> ${CLS[c] ? CLS[c].e : "💀"} ` : "☠️ "}<b>${esc(NPo().nm(vic))}</b></div>`).join(""), fe = L.querySelector(".ar-feed"); if (fe._h !== fh){ fe._h = fh; fe.innerHTML = fh; }
    const fb = L.querySelector(".ar-fire"), show = !!fighting(); fb.style.display = show ? "" : "none"; if (show){ const b = fb.firstChild, e2 = CLS[C.cls].e; if (b.textContent !== e2) b.textContent = e2; fb.querySelectorAll(".ar-am i").forEach((x, i) => x.classList.toggle("off", i >= C.am)); }
    if (amIn() && A.out.includes(me()) && !C.outShown && !C.doneAt){ C.outShown = true; const place = A.ids.length - A.out.indexOf(me()); banner(`💀 ${T("Out!", "Raus!")}<small>${T("Place", "Platz")} ${place}</small>`, "out"); }
    pickDraw();
  }

  /* ---- shooting ---- */
  function nearestEnemy(rg){ let best = null; C.A.ids.forEach(id => { if (id === me() || !alive(id)) return; const q = pos(id); if (!q) return; const d = Math.hypot(q.x - C.me.x, q.y - C.me.y); if (d > rg) return; if (!clear(C.me, q)) return; if (!best || d < best.d) best = {id, q, d}; }); return best; }
  function autoFire(){ if (!fighting()) return; const cl = CLS[C.cls], t = nearestEnemy(cl.rg * 1.12);
    if (!t) return fire(C.me.a || 0); const v = velOf(t.id), tt = cl.v ? t.d / cl.v : 0; C.autoLine = {x: t.q.x, y: t.q.y, t: now()}; fire(Math.atan2(t.q.y + v.y * tt - C.me.y, t.q.x + v.x * tt - C.me.x)); }
  function fire(a){
    if (!fighting()) return; const cl = CLS[C.cls]; if (C.am < 1 || C.cd > 0){ if (C.am < 1) snd("empty"); return; }
    C.am--; C.cd = cl.cd; C.me.a = a; C.me.f = Math.cos(a) < 0 ? -1 : 1; C.lastShot = now();
    const m = {t: "as", by: me(), k: me().slice(0, 3) + (++C.seq), c: C.cls, x: Math.round(C.me.x), y: Math.round(C.me.y), a: Math.round(a * 1000) / 1000};
    PNet.raw(m); if (isHost()) hostMsg(Object.assign({id: me()}, m)); shot(m); Haptic.go(8);
  }
  /* a shot arrives (or is ours): bullets fly, fists and flames hit at once */
  function shot(m){
    const cl = CLS[m.c]; if (!cl || !C.A) return; const a = +m.a || 0, by = m.by, from = {x: +m.x, y: +m.y};
    if (by !== me()){ const p = C.AP[by]; if (p){ p.a = a; p.f = Math.cos(a) < 0 ? -1 : 1; p.shotT = now(); } }
    C.fx.push({k: "flash", x: from.x + Math.cos(a) * 30, y: from.y + Math.sin(a) * 30, a, t: now(), c: m.c});
    if (cl.cone){ snd(m.c === "melee" ? "melee" : "fire", from); C.fx.push({k: m.c === "melee" ? "swipe" : "flame", x: from.x, y: from.y, a, t: now(), rg: cl.rg, cone: cl.cone});
      const hitIn = (id, q) => { if (!q || id === by || !alive(id)) return false; const d = Math.hypot(q.x - from.x, q.y - from.y); return d < cl.rg + BODY && angDiff(Math.atan2(q.y - from.y, q.x - from.x), a) < cl.cone + Math.atan2(BODY, Math.max(1, d)) && clear(from, q); };
      if (alive(me()) && C.me && hitIn(me(), C.me)){ hurt(cl.dmg, by, m.k); if (cl.burn){ C.burn = now() + cl.burn; C.burnBy = by; } }
      if (isHost()) Object.keys(HB.bots).forEach(id => { if (hitIn(id, HB.bots[id])){ hostHit(id, cl.dmg, by, m.k); if (cl.burn){ const o = HB.dot[id] || (HB.dot[id] = {d: 0, t: now(), by}); o.burn = now() + cl.burn; o.burnBy = by; } } });
      return; }
    snd(m.c, from);
    const n = cl.n || 1; for (let i = 0; i < n; i++){ const aa = a + (n > 1 ? (i - (n - 1) / 2) * cl.spr : 0); C.proj.push({k: m.k + ":" + i, by, c: m.c, x: from.x + Math.cos(aa) * 16, y: from.y + Math.sin(aa) * 16, vx: Math.cos(aa) * cl.v, vy: Math.sin(aa) * cl.v, tr: 0, rg: cl.rg, r: cl.r, t: now()}); }
  }
  const dmgOf = p => { const cl = CLS[p.c]; return p.c === "snipe" ? Math.round(cl.dmg + cl.far * Math.min(1, p.tr / cl.rg)) : cl.dmg; };
  /* something hits a body: on my own body I take the damage, the host does it for the bots */
  function bodyAt(p){ const ids = C.A.ids; for (let i = 0; i < ids.length; i++){ const id = ids[i]; if (id === p.by || !alive(id)) continue; const q = id === me() ? C.me : (isHost() && HB.bots[id]) || pos(id); if (!q) continue; if (Math.hypot(q.x - p.x, q.y - p.y) < BODY + p.r) return id; } return null; }
  function boom(p, direct){
    const cl = CLS.rock; snd("boom", p); C.fx.push({k: "boom", x: p.x, y: p.y, t: now()}); C.shake = Math.max(C.shake, C.me && Math.hypot(p.x - C.me.x, p.y - C.me.y) < 400 ? 10 : 3);
    const near = q => q && Math.hypot(q.x - p.x, q.y - p.y) < cl.splash + BODY * .5 && clear(p, {x: q.x + (p.x - q.x) * .1, y: q.y + (p.y - q.y) * .1});
    if (direct !== me() && alive(me()) && p.by !== me() && near(C.me)) hurt(cl.sdmg, p.by, p.k + "x");
    if (isHost()) Object.keys(HB.bots).forEach(id => { if (id !== direct && id !== p.by && alive(id) && near(HB.bots[id])) hostHit(id, cl.sdmg, p.by, p.k + "x"); });
    C.fields.push({x: p.x, y: p.y, r: 64, until: now() + cl.field, by: p.by, t: now()});
  }
  function hurt(d, by, k){
    if (!(d > 0) || !alive(me())) return; const m = {t: "ah", by: by || "", d: Math.round(d), k: k || ("d" + now())};
    PNet.raw(m); if (isHost()) hostMsg(Object.assign({id: me()}, m));
    if (C.A.hp[me()] != null) C.A.hp[me()] = Math.max(1, C.A.hp[me()] - d); C.hpT = now();
    C.hurtT = now(); C.hitAt[me()] = now(); C.shake = Math.max(C.shake, 7); C.pops.push({x: C.me.x, y: C.me.y - 120, txt: "-" + Math.round(d), t: now(), me: 1}); snd("hurt"); Haptic.go(d > 20 ? 25 : 10);
  }
  /* fire on the floor, the fire trail, burning and the gas: what is hurting this spot right now */
  function hazards(q, id, el, gr){
    let dps = 0, by = ""; const t = now();
    C.fields.forEach(f => { if (f.by !== id && f.until > t && Math.hypot(q.x - f.x, q.y - f.y) < f.r){ dps = Math.max(dps, 26); by = f.by; } });
    let tr = 0; C.trail.forEach(p => { if (p.by !== id && t - p.t < 1800 && Math.hypot(q.x - p.x, q.y - p.y) < 30){ tr = 24; by = by || p.by; } }); dps += tr;
    if (id === me() && C.burn > t){ dps += 7; by = by || C.burnBy; } const o = HB.dot[id]; if (o && o.burn > t){ dps += 7; by = by || o.burnBy; }
    if (el >= GAS0 && Math.hypot(q.x - GC.x, q.y - GC.y) > gr){ dps += 22; }
    return {dps, by};
  }
  function onMsg(m){
    if (!m || !m.t) return;
    if (m.t === "afl" || m.t === "abr"){ FX.msg(m); return; }
    if (isHost() && m.id !== me()) hostMsg(m);
    if (!C.A) return;
    if (m.t === "am"){ if (m.id !== me()) onPos(m.id, +m.x, +m.y, (+m.a || 0) / 100, m.f, m.m); }
    else if (m.t === "amb"){ if (!isHost() && Array.isArray(m.l)) m.l.forEach(([id, x, y, a, mv, f]) => onPos(id, x, y, a / 100, f, mv)); }
    else if (m.t === "as"){ if (m.by !== me()) shot(m); }
    else if (m.t === "ah"){ if (m.id !== me()){ const q = pos(m.id); C.hitAt[m.id] = now(); if (q) C.pops.push({x: q.x, y: q.y - 120, txt: "-" + m.d, t: now()}); if (m.by === me()) snd("hit", q); } }
    else if (m.t === "ahp"){ C.A.hp = Object.assign({}, m.hp); C.A.out = (m.out || []).slice(); C.A.feed = m.f || []; C.hpT = now();
      if (m.ko){ const q = pos(m.ko); if (q) C.fx.push({k: "ko", x: q.x, y: q.y, t: now()}); snd("ko", q); if (m.ko === me()) Haptic.go([60, 40, 120]); } }
  }
  function onPos(id, x, y, a, f, mv){ const p = C.AP[id] || (C.AP[id] = {buf: [], dx: x, dy: y}), t = now(), l = p.buf[p.buf.length - 1]; if (l && Math.hypot(l.x - x, l.y - y) > 300) p.buf = []; p.buf.push({t, x, y}); if (p.buf.length > 6) p.buf.shift(); p.a = a; p.f = f || 1; p.mv = !!mv; p.t = t; }

  function step(dt){
    if (!C.A) return; const A = C.A, el = now() - C.fightT0, gr = A.ph === "fight" ? gasR(el) : 99999;
    if (fighting()){ const cl = CLS[C.cls]; let ix = 0, iy = 0;
      if (C.moveP){ ix = C.moveP.dx; iy = C.moveP.dy; } const k = C.keys; if (k.ArrowLeft || k.KeyA) ix -= 1; if (k.ArrowRight || k.KeyD) ix += 1; if (k.ArrowUp || k.KeyW) iy -= 1; if (k.ArrowDown || k.KeyS) iy += 1;
      const m = Math.hypot(ix, iy); if (m > 1){ ix /= m; iy /= m; } C.me.mv = m > .05;
      if (C.me.mv){ const sp = SPD * cl.sp * dt, nx = C.me.x + ix * sp, ny = C.me.y + iy * sp; if (walkA(nx, C.me.y)) C.me.x = nx; if (walkA(C.me.x, ny)) C.me.y = ny; if (Math.abs(ix) > .1) C.me.f = ix < 0 ? -1 : 1; if (!C.aimP || !C.aimP.man) C.me.a = Math.atan2(iy, ix); }
      if (C.aimP && C.aimP.man) C.me.a = Math.atan2(C.aimP.dy, C.aimP.dx);
      C.rl += dt * 1000; while (C.am < AMMO && C.rl >= cl.rl){ C.am++; C.rl -= cl.rl; } if (C.am >= AMMO) C.rl = 0; C.cd -= dt * 1000;
      const t = now(), moved = !C.sentP || Math.hypot(C.me.x - C.sentP.x, C.me.y - C.sentP.y) > 2 || Math.abs(C.me.a - C.sentP.a) > .15;
      if ((moved && t - C.sent > 135) || t - C.sent > 900){ C.sent = t; C.sentP = {x: C.me.x, y: C.me.y, a: C.me.a}; PNet.raw({t: "am", x: Math.round(C.me.x), y: Math.round(C.me.y), a: Math.round(C.me.a * 100), f: C.me.f, m: C.me.mv ? 1 : 0}); }
      /* what hurts where I stand */
      const h = hazards(C.me, me(), el, gr); if (h.dps > 0){ C.dot += h.dps * dt; C.dotBy = h.by || C.dotBy; } if (now() - C.dotT > 300 && C.dot >= 1){ hurt(Math.round(C.dot), C.dotBy, null); C.dot = 0; C.dotT = now(); C.dotBy = ""; }
    }
    /* everyone else, a little behind so it stays smooth */
    const rt = now() - 150; for (const id in C.AP){ const p = C.AP[id], b = p.buf; if (!b || !b.length) continue; if (rt <= b[0].t){ p.dx = b[0].x; p.dy = b[0].y; continue; }
      let i = b.length - 1; while (i > 0 && b[i - 1].t > rt) i--; const a0 = b[i - 1] || b[0], b0 = b[i]; if (rt >= b0.t){ p.dx = b0.x; p.dy = b0.y; continue; } const f = (rt - a0.t) / Math.max(1, b0.t - a0.t); p.dx = a0.x + (b0.x - a0.x) * f; p.dy = a0.y + (b0.y - a0.y) * f; }
    /* the fire-trail class leaves flames where it walks */
    if (A.ph === "fight") A.ids.forEach(id => { if (A.cls[id] !== "fire" || !alive(id)) return; const q = id === me() ? C.me : pos(id); if (!q) return; const l = C.lastTr[id]; if (!l || Math.hypot(l.x - q.x, l.y - q.y) > 34){ C.lastTr[id] = {x: q.x, y: q.y}; C.trail.push({x: q.x, y: q.y, by: id, t: now()}); } });
    C.trail = C.trail.filter(p => now() - p.t < 1800); C.fields = C.fields.filter(f => f.until > now());
    /* bullets */
    for (const p of C.proj){ if (p.dead) continue; const sp = Math.hypot(p.vx, p.vy) * dt, n = Math.max(1, Math.ceil(sp / 10));
      for (let i = 0; i < n; i++){ p.x += p.vx * dt / n; p.y += p.vy * dt / n; p.tr += sp / n;
        if (!inAr(p.x, p.y) || shotSolid(p.x, p.y) || p.tr >= p.rg){ p.dead = 1; if (p.c === "rock") boom(p, null); else C.fx.push({k: "spark", x: p.x, y: p.y, t: now()}); break; }
        const id = bodyAt(p); if (id){ p.dead = 1; const d = dmgOf(p); C.hitAt[id] = now();
          if (id === me()) hurt(d, p.by, p.k); else if (isHost() && HB.bots[id]) hostHit(id, d, p.by, p.k);
          if (p.c === "rock") boom(p, id); else C.fx.push({k: "spark", x: p.x, y: p.y, t: now(), hit: 1}); break; } } }
    C.proj = C.proj.filter(p => !p.dead && now() - p.t < 3000);
    C.fx = C.fx.filter(f => now() - f.t < 700); C.pops = C.pops.filter(p => now() - p.t < 900);
    C.shake *= Math.pow(.02, dt);
    if (now() - (C.hudT || 0) > 120){ C.hudT = now(); hud(); }
  }

  /* ---- drawing ---- */
  function render(){
    const NP = NPo(), c = NP.ctx, cv = NP.cv; if (!c || !C.A) return; const d = NP.dpr, A = C.A, cw = cv.width, ch = cv.height;
    let cam = C.me && alive(me()) ? C.me : null;
    if (!cam){ const k = (A.feed || []).slice().reverse().find(f => f[1] === me()), fol = k && k[0] && alive(k[0]) ? k[0] : A.ids.filter(alive).sort((a, b) => (A.hp[b] || 0) - (A.hp[a] || 0))[0]; cam = (fol && pos(fol)) || C.me || GC; }
    const spec = !(C.me && alive(me())), z = NP.zoom * d * (spec ? .64 : .76), sh = C.shake > .5 ? C.shake * d : 0;
    const ox = cw / 2 - cam.x * z + (Math.random() - .5) * sh, oy = ch / 2 - (cam.y - 40) * z + (Math.random() - .5) * sh;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = "#0B0C12"; c.fillRect(0, 0, cw, ch);
    c.fillStyle = "#fff"; N().STARS.forEach(([x, y, r, a]) => { const sx = (x - cam.x * .35) * z * .6 + cw / 2, sy = (y - cam.y * .35) * z * .6 + ch / 2; if (sx < -5 || sy < -5 || sx > cw + 5 || sy > ch + 5) return; c.globalAlpha = .25 + a * .6; c.fillRect(sx, sy, r * d, r * d); }); c.globalAlpha = 1;
    c.setTransform(z, 0, 0, z, ox, oy);
    /* the station, the rest of it dimmed behind the barrier */
    const {AREAS, ROOMS, HALLS} = N(); c.fillStyle = "#211F1C"; AREAS.forEach(a => c.fillRect(a.x - 14, a.y - 14, a.w + 28, a.h + 28)); AREAS.forEach(a => { c.fillStyle = "#33302C"; c.fillRect(a.x, a.y, a.w, a.h); });
    ROOMS.forEach(r => NP.floor(c, r)); HALLS.forEach(a => { c.fillStyle = "#2B2926"; c.fillRect(a.x, a.y, a.w, a.h); });
    NP.walls(c); NP.props(c);
    c.fillStyle = "rgba(5,6,10,.8)"; AREAS.forEach(a => { if (!areas().includes(a)) c.fillRect(a.x - 14, a.y - 14, a.w + 28, a.h + 28); });
    const pulse = (Math.sin(now() / 200) + 1) / 2; bars().forEach(o => { const vert = o.x2 - o.x1 < o.y2 - o.y1; c.fillStyle = `rgba(226,82,62,${.55 + pulse * .35})`; c.shadowColor = "#E2523E"; c.shadowBlur = 18; if (vert) c.fillRect((o.x1 + o.x2) / 2 - 5, o.y1, 10, o.y2 - o.y1); else c.fillRect(o.x1, (o.y1 + o.y2) / 2 - 5, o.x2 - o.x1, 10); c.shadowBlur = 0; });
    /* fire on the floor */
    C.fields.forEach(f => { const k = Math.min(1, (f.until - now()) / 600); fireBlob(c, f.x, f.y, f.r, .55 * k); });
    C.trail.forEach(p => { const k = 1 - (now() - p.t) / 1800; fireBlob(c, p.x, p.y, 26, .5 * k); });
    /* the gas closing in */
    if (A.ph === "fight"){ const el = now() - C.fightT0, gr = gasR(el); if (gr < 2000){ c.save(); c.beginPath(); c.rect(400, -100, 1800, 1300); c.arc(GC.x, GC.y, gr, 0, Math.PI * 2, true); c.fillStyle = `rgba(88,200,92,${.26 + pulse * .08})`; c.fill("evenodd"); c.strokeStyle = "rgba(150,240,130,.85)"; c.lineWidth = 6; c.setLineDash([22, 14]); c.lineDashOffset = -now() / 40; c.beginPath(); c.arc(GC.x, GC.y, gr, 0, Math.PI * 2); c.stroke(); c.restore(); } }
    /* aiming: where the shot will go */
    if (fighting() && C.aimP && C.aimP.man){ const cl = CLS[C.cls], a = C.me.a, x = C.me.x, y = C.me.y - 30; c.save(); c.globalAlpha = .32; c.fillStyle = "#fff";
      if (cl.cone || cl.n > 1){ const w = cl.cone || cl.spr * 2.4; c.beginPath(); c.moveTo(x, y); c.arc(x, y, cl.rg, a - w, a + w); c.closePath(); c.fill(); }
      else { c.lineWidth = cl.r * 2.4; c.strokeStyle = "#fff"; c.lineCap = "round"; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * cl.rg, y + Math.sin(a) * cl.rg); c.stroke(); if (cl.splash){ c.beginPath(); c.arc(x + Math.cos(a) * cl.rg, y + Math.sin(a) * cl.rg, cl.splash, 0, 7); c.fill(); } } c.restore(); }
    if (C.autoLine && now() - C.autoLine.t < 200 && C.me){ c.strokeStyle = "rgba(255,255,255,.5)"; c.lineWidth = 3; c.setLineDash([8, 8]); c.beginPath(); c.moveTo(C.me.x, C.me.y - 30); c.lineTo(C.autoLine.x, C.autoLine.y - 30); c.stroke(); c.setLineDash([]); }
    /* people */
    const P = NP.pl(), list = A.ids.filter(id => A.ph !== "fight" || alive(id) || (C.hitAt[id] && now() - C.hitAt[id] < 400)).map(id => ({id, q: id === me() && C.me ? {x: C.me.x, y: C.me.y, f: C.me.f, mv: C.me.mv} : (() => { const p = C.AP[id]; return p && p.dx != null ? {x: p.dx, y: p.dy, f: p.f, mv: p.mv} : A.sp[id] ? {x: A.sp[id].x, y: A.sp[id].y, f: 1} : null; })()})).filter(o => o.q).sort((a, b) => a.q.y - b.q.y);
    list.forEach(({id, q}) => { const p = P.find(x => x.id === id) || {id, name: "?"}, self = id === me(), out = A.out.includes(id);
      if (out){ c.globalAlpha = .4; }
      NP.figure(c, q.x, q.y, p, {f: q.f, mv: q.mv, me: self});
      c.globalAlpha = 1;
      if (C.hitAt[id] && now() - C.hitAt[id] < 140){ c.fillStyle = "rgba(255,80,60,.4)"; c.beginPath(); c.ellipse(q.x, q.y - 50, 36, 58, 0, 0, 7); c.fill(); }
      if ((self && C.burn > now()) || (HB.dot[id] && HB.dot[id].burn > now())){ c.font = "28px system-ui"; c.textAlign = "center"; c.fillText("🔥", q.x + Math.sin(now() / 90) * 6, q.y - 64); }
      if (A.ph === "fight" && !out){ const hp = A.hp[id] || 0, mx = A.mx[id] || 1, w = 70, y = q.y - 142, f = Math.max(0, Math.min(1, hp / mx)); c.fillStyle = "rgba(10,10,14,.85)"; rr(c, q.x - w / 2 - 3, y - 3, w + 6, 16, 6); c.fill();
        c.fillStyle = self ? "#7FD04A" : "#E9573F"; rr(c, q.x - w / 2, y, w * f, 10, 5); c.fill(); c.font = "900 13px Figtree,system-ui,sans-serif"; c.textAlign = "center"; c.fillStyle = "#fff"; c.fillText(Math.ceil(hp), q.x, y - 6);
        const ce = CLS[A.cls[id]]; if (ce){ c.font = "18px system-ui"; c.fillText(ce.e, q.x - w / 2 - 14, y + 11); }
        if (self){ for (let i = 0; i < AMMO; i++){ const filled = i < C.am, part = i === C.am ? Math.min(1, C.rl / CLS[C.cls].rl) : 0; c.fillStyle = "rgba(10,10,14,.85)"; rr(c, q.x - 37 + i * 25, q.y + 24, 23, 8, 4); c.fill(); c.fillStyle = "#E98A2B"; if (filled || part > 0){ rr(c, q.x - 36 + i * 25, q.y + 25, 21 * (filled ? 1 : part), 6, 3); c.fill(); } } } } });
    /* bullets and bangs */
    C.proj.forEach(p => { const y = p.y - 34; if (p.c === "rock"){ c.save(); c.translate(p.x, y); c.rotate(Math.atan2(p.vy, p.vx)); c.fillStyle = "rgba(200,200,200,.35)"; for (let i = 1; i < 5; i++){ c.beginPath(); c.arc(-i * 12, Math.sin(now() / 40 + i) * 3, 5 + i, 0, 7); c.fill(); } c.fillStyle = "#E9573F"; rr(c, -14, -7, 28, 14, 7); c.fill(); c.fillStyle = "#FFD15C"; c.beginPath(); c.arc(-16, 0, 5, 0, 7); c.fill(); c.restore(); }
      else if (p.c === "snipe"){ c.strokeStyle = "#fff"; c.lineWidth = 4; c.shadowColor = "#9fe0ff"; c.shadowBlur = 12; c.beginPath(); c.moveTo(p.x - p.vx * .02, y - p.vy * .02); c.lineTo(p.x, y); c.stroke(); c.shadowBlur = 0; }
      else { c.fillStyle = "#FFD15C"; c.beginPath(); c.arc(p.x, y, 7, 0, 7); c.fill(); c.fillStyle = "rgba(255,209,92,.35)"; c.beginPath(); c.arc(p.x - p.vx * .012, y - p.vy * .012, 5, 0, 7); c.fill(); } });
    C.fx.forEach(f => { const k = (now() - f.t) / 700;
      if (f.k === "boom"){ const r = 20 + k * 90; c.fillStyle = `rgba(255,170,60,${.7 * (1 - k)})`; c.beginPath(); c.arc(f.x, f.y - 20, r, 0, 7); c.fill(); c.fillStyle = `rgba(255,240,180,${.8 * (1 - k * 2)})`; c.beginPath(); c.arc(f.x, f.y - 20, r * .5, 0, 7); c.fill(); }
      else if (f.k === "spark"){ c.fillStyle = f.hit ? `rgba(255,255,255,${1 - k * 2})` : `rgba(255,209,92,${1 - k * 2})`; for (let i = 0; i < 5; i++){ const an = i * 1.3 + f.t, r = k * 40; c.beginPath(); c.arc(f.x + Math.cos(an) * r, f.y - 34 + Math.sin(an) * r, 3, 0, 7); c.fill(); } }
      else if (f.k === "flash"){ if (k < .15){ c.fillStyle = "rgba(255,230,150,.9)"; c.beginPath(); c.arc(f.x, f.y - 34, 14, 0, 7); c.fill(); } }
      else if (f.k === "swipe"){ if (k < .45){ const kk = k / .45; c.strokeStyle = `rgba(255,255,255,${.85 * (1 - kk)})`; c.lineWidth = 12; c.lineCap = "round"; c.beginPath(); c.arc(f.x, f.y - 34, f.rg * .8, f.a - f.cone + kk * .3, f.a + f.cone * (kk * 2 - 1)); c.stroke(); } }
      else if (f.k === "flame"){ if (k < .5){ const kk = k / .5; for (let i = 0; i < 14; i++){ const an = f.a + (((i * 7919) % 100) / 100 - .5) * f.cone * 1.8, r = f.rg * (.25 + .75 * ((i * 37 % 100) / 100)) * Math.min(1, kk * 2.2); c.fillStyle = `rgba(${255},${120 + (i * 13) % 100},40,${.75 * (1 - kk)})`; c.beginPath(); c.arc(f.x + Math.cos(an) * r, f.y - 34 + Math.sin(an) * r, 9 + kk * 10, 0, 7); c.fill(); } } }
      else if (f.k === "ko"){ c.font = `${40 + k * 30}px system-ui`; c.textAlign = "center"; c.globalAlpha = 1 - k; c.fillText("💀", f.x, f.y - 80 - k * 40); c.globalAlpha = 1; } });
    C.pops.forEach(p => { const k = (now() - p.t) / 900; c.globalAlpha = 1 - k; c.font = "900 22px Figtree,system-ui,sans-serif"; c.textAlign = "center"; c.lineWidth = 4; c.strokeStyle = "rgba(0,0,0,.6)"; c.strokeText(p.txt, p.x, p.y - k * 40); c.fillStyle = p.me ? "#ff6a55" : "#fff"; c.fillText(p.txt, p.x, p.y - k * 40); c.globalAlpha = 1; });
    /* the screen goes red when you're hit or nearly dead */
    c.setTransform(1, 0, 0, 1, 0, 0); const hk = Math.max(0, 1 - (now() - C.hurtT) / 400), low = fighting() && (A.hp[me()] || 0) / (A.mx[me()] || 1) < .3 ? .25 + pulse * .2 : 0, red = Math.max(hk * .5, low);
    if (red > 0){ const g = c.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * .3, cw / 2, ch / 2, Math.max(cw, ch) * .7); g.addColorStop(0, "rgba(200,30,20,0)"); g.addColorStop(1, `rgba(200,30,20,${red})`); c.fillStyle = g; c.fillRect(0, 0, cw, ch); }
  }
  function fireBlob(c, x, y, r, a){ if (a <= 0) return; const g = c.createRadialGradient(x, y, 2, x, y, r); g.addColorStop(0, `rgba(255,220,120,${a})`); g.addColorStop(.5, `rgba(255,120,40,${a * .8})`); g.addColorStop(1, "rgba(255,80,30,0)"); c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r, r * .62, 0, 0, 7); c.fill(); }
  const rr = (c, x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, Math.max(0, w), h, r); else c.rect(x, y, Math.max(0, w), h); };

  /* ---- the result: places and, for the winner, the secret bonus ---- */
  function fmt(sc, id){ const k = C.A && C.A.kills && id ? C.A.kills[id] || 0 : 0; return sc === -1 ? "🏆" + (k ? " · 💀 " + k : "") : sc == null ? "–" : k ? "💀 " + k : ""; }
  function resTick(box, mg){
    if (mg.g !== "arena" || !C.A) return; let el = box.querySelector(".ar-perk"); if (!el){ el = document.createElement("div"); el.className = "ar-perk"; const r = box.querySelector(".du-res"); if (!r) return; r.insertBefore(el, r.querySelector(".du-rank")); }
    const P2 = C.A.perk, w = mg.win; let h = "";
    if (!P2 || !w) h = "";
    else if (w !== me()) h = `<p class="muted">${P2.pick ? `🤫 ${T("Secret bonus picked", "Geheimer Bonus gewählt")}` : `👑 ${T("is picking a secret bonus…", "wählt einen geheimen Bonus…")}`}</p>`;
    else if (P2.pick) h = `<div class="ar-pk done"><span>${PERKS[P2.pick].e}</span><div><b>${esc(nm(PERKS[P2.pick]))}</b><small>${P2.pick === "vote2" ? T("Counts in this meeting.", "Gilt in diesem Meeting.") : T("Starts after the meeting. Only you know.", "Gilt nach dem Meeting. Nur du weißt es.")}</small></div></div>`;
    else if (C.revive) h = `<p class="ar-pq">💉 ${T("Who comes back?", "Wer kommt zurück?")}</p><div class="ar-rv">${(P2.rev || []).map(id => `<button data-rv="${esc(id)}"><span class="np-hd">${headOf(id)}</span><b>${esc(NPo().nm(id))}</b></button>`).join("")}</div>`;
    else h = `<p class="ar-pq">🎁 ${T("Pick your secret bonus", "Wähl deinen geheimen Bonus")} · ${Math.ceil(P2.left / 1000)}</p><div class="ar-pks">${P2.opts.map(k => `<button class="ar-pk" data-pk="${k}"><span>${PERKS[k].e}</span><div><b>${esc(nm(PERKS[k]))}</b><small>${esc(T(PERKS[k].sen, PERKS[k].sde))}</small></div></button>`).join("")}</div>`;
    if (el._h !== h){ el._h = h; el.innerHTML = h;
      el.querySelectorAll("[data-pk]").forEach(b => b.onclick = () => { Sound.tap(); if (b.dataset.pk === "revive"){ C.revive = 1; el._h = null; resTick(box, mg); return; } NPo().act({a: "arperk", v: b.dataset.pk}); C.A.perk.pick = b.dataset.pk; Haptic.go([20, 30, 20]); el._h = null; resTick(box, mg); });
      el.querySelectorAll("[data-rv]").forEach(b => b.onclick = () => { Sound.tap(); NPo().act({a: "arperk", v: "revive", t: b.dataset.rv}); C.A.perk.pick = "revive"; C.revive = 0; Haptic.go([20, 30, 20]); el._h = null; resTick(box, mg); }); }
  }

  /* ---------------- bonus effects in the round: the fire trail ---------------- */
  const FX = {fl: {}, burn: {}, patches: [], last: {}, mine: 0, cd: 0, burnT: 0,
    msg(m){ if (m.t === "afl") this.fl[m.id] = now() + Math.min(4000, +m.u || 3000); if (m.t === "abr") this.burn[m.w || m.id] = now() + Math.min(8000, +m.u || 6000); },
    use(NP){ if (now() < this.cd) return; this.cd = now() + 10000; this.mine = now() + 3000; PNet.raw({t: "afl", u: 3000}); NP.sfx.noise(0, .4, 700, 2400, .15, "bandpass", .7); Haptic.go([15, 25, 15]); },
    left(){ return Math.max(0, this.cd - now()); },
    step(NP, POS){ const t = now(), add = (id, x, y) => { const l = this.last[id]; if (!l || Math.hypot(l.x - x, l.y - y) > 30){ this.last[id] = {x, y}; this.patches.push({x, y, by: id, t}); } };
      if (this.mine > t && NP.me) add(PNet.me, NP.me.x, NP.me.y); Object.entries(this.fl).forEach(([id, u]) => { if (u > t && POS[id] && POS[id].dx != null) add(id, POS[id].dx, POS[id].dy); });
      this.patches = this.patches.filter(p => t - p.t < 4000);
      const v = NP.v, hot = (id, q) => this.patches.some(p => p.by !== id && t - p.t < 4000 && Math.hypot(p.x - q.x, p.y - q.y) < 34);
      /* the host checks its bots */
      if (v && v.phase === "play" && v.host && this.patches.length) (v.bots || []).forEach(b => { const q = POS[b.id]; if (!q || q.dx == null || (v.deadList || []).includes(b.id) || this.burn[b.id] > t || !hot(b.id, {x: q.dx, y: q.dy})) return; this.burn[b.id] = t + 6000; PNet.raw({t: "abr", u: 6000, w: b.id}); });
      if (v && v.phase === "play" && v.alive && NP.me && !(this.burn[PNet.me] > t) && this.patches.some(p => p.by !== PNet.me && t - p.t < 4000 && Math.hypot(p.x - NP.me.x, p.y - NP.me.y) < 34)){ this.burn[PNet.me] = t + 6000; PNet.raw({t: "abr", u: 6000}); NP.sfx.noise(0, .5, 900, 2600, .18, "bandpass", .7); Haptic.go([30, 30, 30]); } },
    draw(c, POS, NP){ const t = now(); this.patches.forEach(p => { const k = 1 - (t - p.t) / 4000; fireBlob(c, p.x, p.y, 28, .55 * k); });
      Object.entries(this.burn).forEach(([id, u]) => { if (u < t) return; const q = id === PNet.me ? NP.me : POS[id]; if (!q) return; const x = id === PNet.me ? q.x : q.dx, y = id === PNet.me ? q.y : q.dy; if (x == null) return; c.font = "30px system-ui"; c.textAlign = "center"; c.fillText("🔥", x + Math.sin(t / 90 + x) * 8, y - 70 + Math.sin(t / 130) * 4); c.fillText("🔥", x - 18 + Math.sin(t / 70) * 5, y - 30); }); },
    burning(id){ return (this.burn[id] || 0) > now(); },
    reset(){ this.fl = {}; this.burn = {}; this.patches = []; this.last = {}; this.mine = 0; this.cd = 0; }};

  const client = {view, active, step, render, hold, resTick, fmt, onMsg, get on(){ return C.on; }, _C: C};
  PG.arena = {CLS, PERKS, PICK, FIGHT, hostInit, hostTick, hostAct, hostView, applyPerk, client, fx: FX, stopHost};
  PG.onArena = m => onMsg(m);
  window.__ar = () => ({on: C.on, ph: C.A && C.A.ph, me: C.me && {x: Math.round(C.me.x), y: Math.round(C.me.y)}, hp: C.A && C.A.hp, out: C.A && C.A.out, cls: C.A && C.A.cls, am: C.am, proj: C.proj.length, bots: Object.keys(HB.bots).length});
  window.__arFire = a => a == null ? autoFire() : fire(a);
  window.__arMove = (dx, dy) => { C.moveP = dx == null ? null : {dx, dy, id: -1}; };
  window.__arTo = (x, y) => { if (C.me){ C.me.x = x; C.me.y = y; } };
  window.__arSeen = id => { const q = pos(id); return q && {x: Math.round(q.x), y: Math.round(q.y)}; };

  const css = document.createElement("style"); css.textContent = `
.np.arena .np-ov,.np.arena .np-bar,.np.arena .np-emob,.np.arena .np-emos,.np.arena .np-mapb,.np.arena .np-btns,.np.arena .np-tasks,.np.arena .np-tbar,.np.arena .np-alert,.np.arena .np-ev,.np.arena .np-joy,.np.arena .np-lob,.np.arena .np-panel{display:none!important}
.np.arena .np-cv{filter:none!important}
.ar-l{position:absolute;inset:0;z-index:6;touch-action:none;-webkit-user-select:none;user-select:none}
.ar-hud{position:absolute;top:calc(var(--st,0px) + 12px);left:calc(50% + (var(--sl,0px) - var(--sr,0px)) / 2);transform:translateX(-50%);display:flex;gap:8px;pointer-events:none}
.ar-hud span{background:rgba(20,19,17,.8);border-radius:12px;padding:6px 12px;font:900 17px var(--display);color:#fff;white-space:nowrap}
.ar-hud .ar-gas{display:none;background:#2f7a33}.ar-hud .ar-gas.on{display:block;animation:arPulse 1s ease-in-out infinite}
@keyframes arPulse{50%{transform:scale(1.08)}}
.ar-feed{position:absolute;top:calc(var(--st,0px) + 62px);right:calc(var(--sr,0px) + 12px);display:flex;flex-direction:column;gap:4px;align-items:flex-end;pointer-events:none}
.ar-feed div{background:rgba(20,19,17,.72);border-radius:10px;padding:3px 9px;font:700 13px var(--body);color:#ddd}.ar-feed b{color:#fff}
.ar-ban{position:absolute;left:0;right:0;top:30%;text-align:center;pointer-events:none;font:900 56px var(--display);color:#fff;text-shadow:0 5px 0 rgba(0,0,0,.35);opacity:0;display:flex;flex-direction:column;align-items:center}
.ar-ban small{font:800 20px var(--body);opacity:.85;margin-top:4px}
.ar-ban.on{animation:arBan 1.8s ease-out forwards}.ar-ban.go{color:#9BE25A}.ar-ban.out{color:#ff7a66}.ar-ban.win{color:#FFD15C}
@keyframes arBan{0%{opacity:0;transform:scale(1.6)}12%{opacity:1;transform:scale(1)}75%{opacity:1}100%{opacity:0;transform:translateY(-20px)}}
.ar-pick{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(6,7,12,.8);padding:calc(var(--st,0px) + 10px) calc(var(--sr,0px) + 10px) calc(var(--sb,0px) + 10px) calc(var(--sl,0px) + 10px)}
.ar-pick.on{display:flex}
.ar-pt{font:900 24px var(--display);color:#fff}
.ar-cards{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;max-width:100%}
.ar-card{width:min(124px,18vw);min-width:96px;padding:10px 6px 8px;border-radius:16px;background:var(--panel,#1e1d1b);border:3px solid rgba(255,255,255,.06);display:flex;flex-direction:column;align-items:center;gap:3px;color:#fff;font:800 14px var(--body);transition:transform .15s,border-color .15s}
.ar-card .e{font-size:38px;line-height:1.1}.ar-card small{color:var(--muted,#aaa);font-weight:700;font-size:11px;line-height:1.2;text-align:center;min-height:26px}
.ar-card .hp{font-style:normal;font-size:12px;color:#ff8a78}.ar-card .who{display:flex;gap:2px;min-height:24px}.ar-card .who .np-hd{width:24px;height:24px;overflow:hidden;border-radius:50%}.ar-card .who svg{width:100%;height:100%;display:block}
.ar-card.sel{border-color:var(--go-hi,#8FC458);transform:translateY(-5px);box-shadow:0 8px 24px rgba(127,178,74,.25)}
.ar-pbar{width:min(420px,70%);height:6px;background:rgba(255,255,255,.12);border-radius:3px;overflow:hidden}.ar-pbar i{display:block;height:100%;background:var(--go-hi,#8FC458);transition:width .12s linear}
.ar-joy{position:absolute;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;background:rgba(244,242,238,.08);border:2px solid rgba(244,242,238,.18);display:none;pointer-events:none}.ar-joy.on{display:block}
.ar-joy i{position:absolute;left:50%;top:50%;width:52px;height:52px;border-radius:50%;background:rgba(244,242,238,.35);transform:translate(-50%,-50%)}
.ar-fire{position:absolute;right:calc(var(--sr,0px) + 28px);bottom:calc(var(--sb,0px) + 30px);width:110px;height:110px;border-radius:50%;background:rgba(226,82,62,.16);border:3px solid rgba(226,82,62,.5);pointer-events:none;display:flex;align-items:center;justify-content:center}
.ar-fire.on{background:rgba(226,82,62,.26)}
.ar-fire b{width:60px;height:60px;border-radius:50%;background:rgba(226,82,62,.9);display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 4px 0 rgba(0,0,0,.3)}
.ar-am{position:absolute;bottom:-16px;display:flex;gap:4px}.ar-am i{width:24px;height:7px;border-radius:4px;background:#E98A2B}.ar-am i.off{background:rgba(255,255,255,.2)}
.ar-perk{margin:6px 0}.ar-pq{font:900 16px var(--body);margin:4px 0 8px}
.ar-pks{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.ar-pk{display:flex;align-items:center;gap:8px;text-align:left;padding:10px;border-radius:14px;background:rgba(255,255,255,.06);border:2px solid rgba(255,255,255,.08);color:#fff}
.ar-pk span{font-size:28px}.ar-pk b{display:block;font:900 14px var(--body)}.ar-pk small{display:block;color:var(--muted,#aaa);font-size:11px;line-height:1.25}
.ar-pk:active{transform:scale(.97)}.ar-pk.done{border-color:var(--go-hi,#8FC458);justify-content:center;max-width:360px;margin:0 auto}
.ar-rv{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}.ar-rv button{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px;border-radius:12px;background:rgba(255,255,255,.06);color:#fff;border:2px solid rgba(255,255,255,.08)}
@media (max-height:420px){.ar-card{padding:6px 4px}.ar-card .e{font-size:30px}.ar-pt{font-size:20px}.ar-pk{padding:7px 8px}.ar-pk span{font-size:24px}.ar-pq{margin:2px 0 6px}}
.np-duel:has(.ar-pks) .du-rank>div:nth-child(n+4),.np-duel:has(.ar-rv) .du-rank>div:nth-child(n+4){display:none}
`; document.head.appendChild(css);
})();
