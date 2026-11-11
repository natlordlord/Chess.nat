/* ===== Nat Stars: a Brawl-Stars-style fight on the space station.
   Everyone alive runs through the middle of the station (cafeteria, storage, chess lounge, oxygen) and shoots.
   Walls and furniture stop shots, fog hides you like a bush, gas closes in, the last one standing wins.
   It runs on its own (round after round) and as the minigame at a Natposter meeting (the winner picks a secret bonus).
   Network: every phone moves itself ("am") and says when it shoots ("as"). Whoever fired decides what the shot hit
   and says so ("ah", the host does it for the bots). What hurts where you stand (fire, gas) you report yourself.
   The host keeps the health ("ahp"), runs the bots ("amb") and decides who is out. ===== */
(() => {
  const {T} = PG, now = () => Date.now(), N = () => PG.npx;
  const PICK = 4500, PICK2 = 3200, FIGHT = 60000, PERK = 7000, BAN = 2600, NEXT = BAN + 6500, GAS0 = 20000, GAS1 = 52000, R0 = 820, R1 = 150, BODY = 26, SPD = 255;
  let GC = {x: 1290, y: 640};
  const LAG = 110, SEE = 150, REVEAL = 1000, VIS = 230, AMMO = 3;
  const CLS = {
    shot: {e: "💥", en: "Shotgun", de: "Schrotflinte", sen: "Close · 5 pellets", sde: "Nah · 5 Kugeln", hp: 160, sp: 1, rl: 1450, cd: 380, rg: 330, n: 5, spr: .12, v: 1050, dmg: 11, r: 7, sc: 130,
      su: {e: "💣", en: "Big bang", de: "Großer Knall", sen: "9 pellets, knocks back", sde: "9 Kugeln, stößt weg", n: 9, spr: .085, v: 1150, dmg: 13, rg: 380, kb: 90}},
    rock: {e: "🚀", en: "Rockets", de: "Raketen", sen: "Explodes · burns", sde: "Explodiert · Brandfeld", hp: 125, sp: .95, rl: 1900, cd: 480, rg: 560, n: 1, v: 690, dmg: 24, r: 11, splash: 72, sdmg: 16, field: 2600, sc: 110,
      su: {e: "🎆", en: "Rocket rain", de: "Raketenhagel", sen: "5 rockets at once", sde: "5 Raketen auf einmal", n: 5, spr: .15, rg: 600}},
    melee: {e: "🥊", en: "Brawler", de: "Faust", sen: "Lots of health · close", sde: "Viel Leben · Nahkampf", hp: 225, sp: 1.12, rl: 900, cd: 320, rg: 112, cone: .95, dmg: 34, sc: 115,
      su: {e: "🦘", en: "Leap", de: "Sprungschlag", sen: "Jump in, hits everyone", sde: "Sprung, trifft alle", rg: 300, dmg: 42, dur: 260}},
    fire: {e: "🔥", en: "Fire trail", de: "Flammenspur", sen: "Flames · fire trail", sde: "Flammen · Feuerspur", hp: 170, sp: 1.15, rl: 1250, cd: 380, rg: 205, cone: .42, dmg: 17, burn: 3000, sc: 105,
      su: {e: "⭕", en: "Ring of fire", de: "Feuerring", sen: "Burns everyone around you", sde: "Verbrennt alle um dich", rg: 190, dmg: 30}},
    bomb: {e: "🧨", en: "Bomber", de: "Bomber", sen: "Throws over walls", sde: "Wirft über Wände", hp: 120, sp: 1, rl: 1750, cd: 480, rg: 430, lob: 680, dmg: 30, splash: 64, sc: 110,
      su: {e: "☄️", en: "Mega bomb", de: "Megabombe", sen: "Huge blast, knocks back", sde: "Riesen-Knall, stößt weg", dmg: 46, splash: 118, kb: 80, rg: 460}},
    snipe: {e: "🎯", en: "Sniper", de: "Scharfschütze", sen: "Far · harder far away", sde: "Weit · trifft weit stärker", hp: 105, sp: .95, rl: 2000, cd: 450, rg: 780, n: 1, v: 1600, dmg: 15, far: 30, r: 6, sc: 100,
      su: {e: "⚡", en: "Piercer", de: "Durchschuss", sen: "Goes through everyone", sde: "Geht durch alle durch", v: 2300, rg: 980, dmg: 52, r: 9}}};
  const KEYS = Object.keys(CLS);
  const EMO = ["😂", "😎", "😡", "😭", "👍", "🔥", "💀", "GG"];
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

  /* ---------------- the arenas: four rooms of the station and the halls between them; on its own the map changes every round ---------------- */
  const LAYS = [
    {id: "mid", en: "Middle", de: "Mitte", rooms: ["caf", "chess", "sto", "o2"], halls: [[1230, 556], [976, 760], [1476, 760]], gc: {x: 1290, y: 640}},
    {id: "west", en: "West wing", de: "Westflügel", rooms: ["med", "rea", "chess", "ele"], halls: [[300, 476], [416, 760], [300, 976]], gc: {x: 500, y: 815}},
    {id: "east", en: "East wing", de: "Ostflügel", rooms: ["com", "bri", "o2", "nav"], halls: [[2080, 476], [1936, 760], [2080, 996]], gc: {x: 2200, y: 800}},
    {id: "low", en: "Lower deck", de: "Unterdeck", rooms: ["sto", "lab", "ele", "nav"], halls: [[1180, 996], [696, 1240], [1496, 1240]], gc: {x: 1250, y: 1290}, r0: 1000}];
  let LAY = LAYS[0], AR = null, BARS = null, ADJ = null;
  const areas = () => AR || (AR = N().ROOMS.filter(r => LAY.rooms.includes(r.id)).concat(N().HALLS.filter(h => LAY.halls.some(([x, y]) => h.x === x && h.y === y))));
  function setLay(i){ const L = LAYS[((i | 0) % LAYS.length + LAYS.length) % LAYS.length]; if (L === LAY && AR) return; LAY = L; AR = BARS = ADJ = null; GC = L.gc;
    FOG = L.fog || (L.fog = autoFog()); SPN = L.spn || (L.spn = autoSpawn()); SPR.clip = null; MC.cv = null; MC.n = 0;
    const A2 = areas(); MC.x0 = Math.min(...A2.map(a => a.x)) - 320; MC.y0 = Math.min(...A2.map(a => a.y)) - 300; MC.w = Math.max(...A2.map(a => a.x + a.w)) + 320 - MC.x0; MC.h = Math.max(...A2.map(a => a.y + a.h)) + 300 - MC.y0; }
  /* fog in two corners of every room, spawn points spread over the rooms: worked out from the furniture */
  const nearSolid = (x, y, r) => N().OBST.some(o => Math.hypot(x - o.x, y - o.y) < o.r + r) || N().OBR.some(o => N().rdist(o, x, y) < r);
  function autoFog(){ const out = []; areas().filter(a => a.id).forEach((r, ri) => { const cx = r.x + r.w / 2, cy = r.y + r.h / 2 + 20, C4 = [[r.x + 88, r.y + 128], [r.x + r.w - 88, r.y + 128], [r.x + 88, r.y + r.h - 74], [r.x + r.w - 88, r.y + r.h - 74]];
      const order = ri % 2 ? [1, 2, 0, 3] : [0, 3, 1, 2]; let n = 0;
      for (const k of order){ if (n >= 2) break; const [x, y] = C4[k]; if (nearSolid(x, y, 46)) continue; const dx = Math.sign(cx - x), dy = Math.sign(cy - y); out.push([[x, y, 52], [x + dx * 44, y + 8, 40], [x + 6, y + dy * 42, 38]]); n++; } });
    return out; }
  function autoSpawn(){ const out = []; areas().filter(a => a.id).forEach(r => { [[.5, .55], [.2, .35], [.8, .35], [.2, .82], [.8, .82]].forEach(([fx, fy]) => { const x = Math.round(r.x + r.w * fx), y = Math.round(r.y + 40 + (r.h - 40) * fy); if (walkA(x, y) && !nearSolid(x, y, 30)) out.push([x, y]); }); }); return out; }
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
  const gasR = el => { const r0 = LAY.r0 || R0; return el < GAS0 ? 99999 : r0 - (r0 - R1) * Math.min(1, (el - GAS0) / (GAS1 - GAS0)); };
  const prune = (a, f) => { let j = 0; for (let i = 0; i < a.length; i++) if (f(a[i])) a[j++] = a[i]; a.length = j; };
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return Math.abs(d); };
  /* the next point to walk to: straight there in the same room, else the doorway to the next room */
  function wayTo(from, to){
    const L = areas(), ai = L.findIndex(a => inside(a, from.x, from.y)), bi = L.findIndex(a => inside(a, to.x, to.y)); if (ai < 0 || bi < 0 || ai === bi) return to;
    const prev = {[ai]: -1}, q = [ai]; while (q.length){ const i = q.shift(); if (i === bi) break; adj()[i].forEach(j => { if (prev[j] === undefined){ prev[j] = i; q.push(j); } }); }
    if (prev[bi] === undefined) return to; let j = bi; while (prev[j] !== ai && prev[j] !== -1) j = prev[j];
    const o = overlap(L[ai], L[j]); return {x: (o.x1 + o.x2) / 2, y: (o.y1 + o.y2) / 2};
  }
  let SPN = LAYS[0].spn = [[1060, 200], [1500, 200], [1060, 525], [1500, 525], [1280, 200], [1280, 525], [660, 700], [660, 920], [920, 920], [800, 800], [1430, 700], [1160, 950], [1300, 820], [1680, 720], [1880, 720], [1880, 900], [1680, 900]];
  function spawns(n, R){
    const P = SPN.map(([x, y]) => ({x, y})).filter(p => walkA(p.x, p.y)), out = [P.splice(Math.floor(R() * P.length), 1)[0]];
    while (out.length < n && P.length){ let bi = 0, bd = -1; P.forEach((p, i) => { const d = Math.min(...out.map(q => Math.hypot(p.x - q.x, p.y - q.y))) + R() * 60; if (d > bd){ bd = d; bi = i; } }); out.push(P.splice(bi, 1)[0]); }
    while (out.length < n) out.push({x: out[out.length % 17].x + 30, y: out[out.length % 17].y}); return out;
  }
  /* fog: the station's bushes. Inside you are hidden (unless someone is close or you just shot or got hit) and see little */
  let FOG = LAYS[0].fog = [
    [[1040, 345, 58], [1064, 292, 46], [1064, 398, 46]],
    [[1520, 345, 58], [1496, 292, 46], [1496, 398, 46]],
    [[1280, 182, 50], [1222, 188, 40], [1338, 188, 40]],
    [[650, 905, 52], [702, 922, 42], [640, 852, 40]],
    [[930, 702, 46], [886, 690, 36], [942, 750, 36]],
    [[1160, 950, 50], [1214, 962, 40], [1140, 902, 36]],
    [[1432, 708, 44], [1440, 762, 40]],
    [[1770, 822, 62], [1832, 794, 48], [1712, 842, 46], [1800, 884, 40]]];
  const fogAt = (x, y) => { for (let i = 0; i < FOG.length; i++) for (const c of FOG[i]) if ((x - c[0]) * (x - c[0]) + (y - c[1]) * (y - c[1]) < c[2] * c[2]) return i; return -1; };
  const fogMid = i => { const P = FOG[i]; return {x: P.reduce((s, c) => s + c[0], 0) / P.length, y: P.reduce((s, c) => s + c[1], 0) / P.length}; };

  /* ---------------- the host: health, bots, who is out, the bonus ---------------- */
  const HB = {bots: {}, seen: new Set(), int: 0, hpT: 0, dirty: false, dot: {}, ambT: 0};
  const hostG = () => { const P = PNet.P; return P && P.isHost && P.G && P.G.s ? P.G : null; };
  const hostMg = () => { const G = hostG(), mg = G && G.s.meet && G.s.meet.mg; return mg && mg.g === "arena" && mg.ar ? mg : null; };
  /* everything said about the arena also reaches this own screen */
  const send = m => { PNet.raw(m); onMsg(Object.assign({id: PNet.me}, m)); };
  function hostInit(G, mg){
    const s = G.s, map = s.arena ? ((s.arRound || 1) - 1) % LAYS.length : 0; setLay(map);
    const ids = G.ids.filter(id => s.alive[id]), sp = spawns(ids.length, rngOf(mg.seed)), pk = s.arena && (s.arRound || 0) > 1 ? PICK2 : PICK;
    /* together against the bots: all people one team, the bots the other */
    const team = s.arena && G.opts && G.opts.team === "coop" ? Object.fromEntries(ids.map(id => [id, isBot(id) ? "b" : "h"])) : null;
    mg.ar = {map, team, ph: "pick", pickEnd: mg.t0 + N().SPIN + pk, pk, fight: 0, end: 0, ids, hp: {}, mx: {}, cls: {}, out: [], sp: Object.fromEntries(ids.map((id, i) => [id, sp[i]])), dmg: {}, kills: {}, lh: {}, ls: {}, feed: []};
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
      botsInit(s, A); A.cubes = []; A.pw = {}; A.cseq = 0; A.cubeT = now(); for (let i = 0; i < Math.min(8, 3 + A.ids.length); i++) cubeRandom(A, 99999); ch = true; }
    /* a new host after a handover takes the bots over where they were */
    if (A.ph === "fight" && !Object.keys(HB.bots).length && (s.bots || []).some(b => A.ids.includes(b.id))) botsInit(s, A);
    /* someone who left is out */
    if (A.ph === "fight") A.ids.forEach(id => { if ((s.gone || {})[id] && !A.out.includes(id)){ A.out.push(id); ch = true; } });
    if (A.ph === "fight"){ const alive = A.ids.filter(id => !A.out.includes(id)), humans = A.ids.filter(id => !isBot(id) && !(s.gone || {})[id]), teams = A.team ? new Set(alive.map(id => A.team[id])).size : alive.length;
      if (teams <= 1 || now() >= A.end || (humans.length && !alive.some(id => humans.includes(id)) && alive.length)){ finish(G, mg); ch = true; } }
    return ch;
  }
  /* energy cubes, like Brawl Stars' power cubes: each one +8 % health and +8 % damage, whoever is knocked out drops theirs */
  const CUBE = .08, CUBES = 10;
  function cubeAdd(A, x, y, n){ A.cubes.push({k: ++A.cseq, x: Math.round(x), y: Math.round(y), n: n || 1}); HB.cdirty = true; }
  function cubeRandom(A, gr){ const L = areas(); for (let i = 0; i < 40; i++){ const a = L[Math.floor(Math.random() * L.length)], x = a.x + 30 + Math.random() * (a.w - 60), y = a.y + 60 + Math.random() * (a.h - 90);
    if (walkA(x, y) && Math.hypot(x - GC.x, y - GC.y) < gr - 80 && !A.cubes.some(c => Math.hypot(c.x - x, c.y - y) < 140) && !A.ids.some(id => { const q = posOf(id); return q && Math.hypot(q.x - x, q.y - y) < 90; })) return cubeAdd(A, x, y, 1); } }
  function cubeGrab(A, id, k){ const i = A.cubes.findIndex(c => c.k === k); if (i < 0 || A.out.includes(id)) return; const c = A.cubes[i], q = posOf(id); if (!q || Math.hypot(q.x - c.x, q.y - c.y) > 90) return;
    A.cubes.splice(i, 1); const was = A.pw[id] || 0, now2 = Math.min(CUBES, was + c.n), base = CLS[A.cls[id]].hp; A.pw[id] = now2; A.mx[id] = Math.round(base * (1 + CUBE * now2)); A.hp[id] = Math.min(A.mx[id], A.hp[id] + base * CUBE * (now2 - was)); HB.dirty = true; HB.cdirty = true; }
  function botsInit(s, A){ HB.bots = {}; (s.bots || []).forEach(b => { if (!A.ids.includes(b.id)) return; const q = C.AP[b.id], p = q && q.dx != null ? {x: q.dx, y: q.dy} : A.sp[b.id];
    HB.bots[b.id] = {x: p.x, y: p.y, a: 0, f: 1, mv: 0, am: AMMO, rl: 0, cd: 600 + Math.random() * 900, str: Math.random() < .5 ? -1 : 1, strT: 0, seen: 0, skill: botSkill(), sup: 0, dash: null, kb: null, hide: 0}; }); }
  function hostLoop(){
    const G = hostG(), mg = hostMg(); if (!G || !mg || mg.done){ stopHost(); return; }
    const A = mg.ar; if (A.ph === "pick"){ if (now() >= A.pickEnd && hostTick(G)) PNet.refresh(); return; }
    if (A.ph !== "fight") return;
    const dt = .05; if (!HB.freeze) botsStep(A, dt); regen(A, dt); botHazards(A, dt);
    if (A.cubes){ if (now() - A.cubeT > 7000 && A.cubes.length < 8){ A.cubeT = now(); cubeRandom(A, gasR(now() - A.fight)); }
      for (const id in HB.bots){ if (A.out.includes(id)) continue; const b = HB.bots[id], c = A.cubes.find(c => Math.hypot(c.x - b.x, c.y - b.y) < 38); if (c) cubeGrab(A, id, c.k); }
      if (HB.cdirty){ HB.cdirty = false; send({t: "acu", c: A.cubes, pw: A.pw}); } }
    if (now() - HB.ambT > 100){ HB.ambT = now(); const l = Object.entries(HB.bots).filter(([id]) => !A.out.includes(id)).map(([id, b]) => [id, Math.round(b.x), Math.round(b.y), Math.round(b.a * 100), b.mv ? 1 : 0, b.f]); if (l.length) PNet.raw({t: "amb", l, ts: now()}); }
    if (HB.dirty && now() - HB.hpT > 200){ HB.dirty = false; HB.hpT = now(); send({t: "ahp", hp: rnd(A.hp), mx: A.mx, out: A.out, f: A.feed.slice(-4)}); }
    if (hostTick(G)) PNet.refresh();
  }
  /* alone against bots they grow with you: a little sharper the more rounds you have won */
  const soloLv = () => PNet.P && PNet.P.solo ? Math.min(1, ((PG.st && PG.st.nsWins) || 0) / 30) : .5;
  const botSkill = () => .47 + soloLv() * .16 + Math.random() * .4;
  const rnd = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
  function hostHit(vic, d, by, k){
    const G = hostG(), mg = hostMg(), A = mg && mg.ar; if (!A || A.ph !== "fight" || !A.ids.includes(vic) || A.out.includes(vic) || !(d > 0)) return;
    if (A.team && by && by !== vic && A.team[by] && A.team[by] === A.team[vic]) return;
    if (k){ const key = vic + "|" + k; if (HB.seen.has(key)) return; HB.seen.add(key); if (HB.seen.size > 6000) HB.seen.clear(); }
    d = Math.min(90, d); A.hp[vic] = Math.max(0, A.hp[vic] - d); A.lh[vic] = now(); if (by && by !== vic && A.dmg[by] != null) A.dmg[by] += d; HB.dirty = true;
    if (by && by !== vic && HB.bots[by]) HB.bots[by].sup = Math.min(1, HB.bots[by].sup + d / CLS[A.cls[by]].sc);
    if (A.hp[vic] <= 0){ A.out.push(vic); if (A.cubes){ const q = posOf(vic); if (q) cubeAdd(A, q.x, q.y, (A.pw[vic] || 0) + 1); } if (by && by !== vic && A.kills[by] != null) A.kills[by]++; const kb = by && by !== vic && A.ids.includes(by) ? by : ""; A.feed.push([kb, vic, kb ? A.cls[kb] : "gas"]); if (A.feed.length > 8) A.feed.shift();
      if (kb && HB.bots[kb] && Math.random() < .35) setTimeout(() => send({t: "aem", w: kb, e: ["😎", "GG", "😂", "🔥"][Math.floor(Math.random() * 4)]}), 500);
      HB.hpT = now(); HB.dirty = false; send({t: "ahp", hp: rnd(A.hp), mx: A.mx, out: A.out, f: A.feed.slice(-4), ko: vic}); hostTick(G); PNet.refresh(); }
  }
  function regen(A, dt){ A.ids.forEach(id => { if (A.out.includes(id) || A.hp[id] >= A.mx[id]) return; if (now() - (A.lh[id] || 0) > 3000 && now() - (A.ls[id] || 0) > 3000){ A.hp[id] = Math.min(A.mx[id], A.hp[id] + A.mx[id] * .14 * dt); HB.dirty = true; } }); }
  const posOf = id => { if (id === PNet.me && C.me) return C.me; const b = HB.bots[id]; if (b) return b; const p = C.AP[id]; return p && p.dx != null ? {x: p.dx, y: p.dy} : null; };
  const velOf = id => { const b = C.AP[id] && C.AP[id].buf; if (!b || b.length < 2) return {x: 0, y: 0}; const p = b[b.length - 2], q = b[b.length - 1], dt = Math.max(30, q.t - p.t) / 1000; return {x: (q.x - p.x) / dt, y: (q.y - p.y) / dt}; };
  /* can the one at "from" see "id"? Fog hides, unless close, or the one in it just shot or got hit */
  const revealed = id => now() - (C.shotAt[id] || 0) < REVEAL || now() - (C.hitAt[id] || 0) < REVEAL;
  const seenFrom = (from, id, q) => { q = q || posOf(id); if (!q) return false; if (fogAt(q.x, q.y) < 0 || revealed(id)) return true; return !!from && Math.hypot(q.x - from.x, q.y - from.y) < SEE; };
  /* bots: keep their distance, strafe, shoot what they see, hide in the fog when hurt, run from the gas */
  function botsStep(A, dt){
    const el = now() - A.fight, gr = gasR(el);
    for (const id in HB.bots){ const b = HB.bots[id]; b.px = b.x; b.py = b.y; b.ut = now(); if (A.out.includes(id)){ b.mv = 0; continue; } const cl = CLS[A.cls[id]];
      b.rl += dt * 1000; while (b.am < AMMO && b.rl >= cl.rl){ b.am++; b.rl -= cl.rl; } if (b.am >= AMMO) b.rl = 0; b.cd -= dt * 1000;
      if (b.dash){ dashStep(b, id, dt, A); continue; }
      if (b.kb && b.kb.until > now()){ const nx = b.x + b.kb.vx * dt, ny = b.y + b.kb.vy * dt; if (walkA(nx, b.y)) b.x = nx; if (walkA(b.x, ny)) b.y = ny; }
      let best = null; A.ids.forEach(o => { if (o === id || A.out.includes(o) || (A.team && A.team[o] === A.team[id])) return; const q = posOf(o); if (!q || !seenFrom(b, o, q)) return; const d = Math.hypot(q.x - b.x, q.y - b.y), los = d < 900 && (clear(b, q) || (cl.lob && d < cl.rg * 1.05)), sc = d - (los ? 260 : 0); if (!best || sc < best.sc) best = {id: o, q, d, los, sc}; });
      let gx = 0, gy = 0; const outGas = Math.hypot(b.x - GC.x, b.y - GC.y) > gr - 60, low = A.hp[id] / A.mx[id] < .38;
      const go = t => { const w = wayTo(b, t), dx = w.x - b.x, dy = w.y - b.y, d = Math.hypot(dx, dy) || 1; gx = dx / d; gy = dy / d; };
      /* hurt and nobody close: off into the nearest fog to heal */
      if (low && !outGas && !(best && best.d < 260)){ let fi = -1, fd = 1e9; FOG.forEach((P, i) => { const m = fogMid(i), d = Math.hypot(m.x - b.x, m.y - b.y), gd = Math.hypot(m.x - GC.x, m.y - GC.y); if (gd < gr - 80 && d < fd){ fd = d; fi = i; } });
        if (fi >= 0 && fogAt(b.x, b.y) !== fi){ go(fogMid(fi)); b.hide = 1; } else if (fi >= 0){ b.hide = 1; } }
      else b.hide = 0;
      if (b.hide && fogAt(b.x, b.y) >= 0 && !(best && best.d < 260)){ gx = gy = 0; }
      else if (outGas) go(GC);
      else if (best && best.los && !b.hide){ const want = cl.rg * (cl.cone ? .5 : .68), dx = best.q.x - b.x, dy = best.q.y - b.y, d = best.d || 1, k = d > want ? 1 : d < want * .55 ? -.8 : 0;
        if (now() > b.strT){ b.strT = now() + 500 + Math.random() * 900; if (Math.random() < .45) b.str *= -1; } gx = dx / d * k - dy / d * b.str * .85; gy = dy / d * k + dx / d * b.str * .85; }
      else if (!b.hide && A.cubes && (() => { let cb = null, cd = 1e9; A.cubes.forEach(c => { const d = Math.hypot(c.x - b.x, c.y - b.y); if (d < cd && d < (best ? 260 : 700) && Math.hypot(c.x - GC.x, c.y - GC.y) < gr - 40){ cd = d; cb = c; } }); if (cb){ go(cb); return true; } return false; })()) {}
      else if (best && !b.hide) go(best.q);
      else if (!b.hide && el > 4000){ const t = {x: GC.x + Math.cos(id.length + el / 9000) * 140, y: GC.y + Math.sin(id.length + el / 9000) * 120}; if (Math.hypot(t.x - b.x, t.y - b.y) > 120) go(t); }
      const m = Math.hypot(gx, gy); b.mv = m > .1 ? 1 : 0;
      if (b.mv){ const sp = SPD * cl.sp * .92 * dt, nx = b.x + gx / m * sp, ny = b.y + gy / m * sp; let moved = false; if (walkA(nx, b.y)){ b.x = nx; moved = true; } if (walkA(b.x, ny)){ b.y = ny; moved = true; } if (!moved){ b.str *= -1; b.strT = now() + 700; } if (Math.abs(gx) > .1) b.f = gx < 0 ? -1 : 1; }
      if (best && best.los){ if (!b.seen) b.seen = now(); b.a = Math.atan2(best.q.y - b.y, best.q.x - b.x); } else b.seen = 0;
      /* against bots alone they react a bit slower and miss a bit more, so a round isn't over in ten seconds */
      const easy = PNet.P && PNet.P.solo && best && best.id === PNet.me;
      if (best && best.los && b.seen && now() - b.seen > (easy ? 600 : 380)){
        const v = velOf(best.id), aim = sp2 => { const tt = cl.lob ? cl.lob / 1000 : sp2 ? best.d / sp2 : 0, ax = best.q.x + v.x * tt * b.skill, ay = best.q.y + v.y * tt * b.skill; return Math.atan2(ay - b.y, ax - b.x) + (Math.random() - .5) * .34 * (1.35 - b.skill) * (easy ? 1.5 : 1); };
        const su = cl.su, inSup = A.cls[id] === "fire" ? best.d < su.rg * .85 : A.cls[id] === "melee" ? best.d < su.rg * .9 : best.d < (su.rg || cl.rg) * .9;
        if (b.sup >= 1 && inSup && Math.random() < .08){ const a = aim(su.v || cl.v); b.sup = 0; b.a = a; b.f = Math.cos(a) < 0 ? -1 : 1; A.ls[id] = now(); send(Object.assign({t: "as", by: id, k: id.slice(-3) + (++C.seq), c: A.cls[id], s: 1, x: Math.round(b.x), y: Math.round(b.y), a: Math.round(a * 1000) / 1000}, cl.lob ? {r: Math.round(best.d + (Math.random() - .5) * 40 * (1.35 - b.skill))} : {})); }
        else if (best.d < cl.rg * (cl.cone ? .95 : .92) && b.am >= 1 && b.cd <= 0){ const a = aim(cl.v); b.am--; b.cd = cl.cd + 200 + Math.random() * 600 + (easy ? 420 - soloLv() * 260 : 0); b.a = a; b.f = Math.cos(a) < 0 ? -1 : 1;
          A.ls[id] = now(); send(Object.assign({t: "as", by: id, k: id.slice(-3) + (++C.seq), c: A.cls[id], x: Math.round(b.x), y: Math.round(b.y), a: Math.round(a * 1000) / 1000}, cl.lob ? {r: Math.round(best.d + (Math.random() - .5) * 50 * (1.35 - b.skill))} : {})); } }
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
    mg.win = rank[0] || null; mg.done = now(); mg.end = now() + BAN; s.dw = s.dw || {};
    if (A.team && mg.win){ mg.winTeam = A.team[mg.win]; A.ids.forEach(id => { if (A.team[id] === mg.winTeam && !isBot(id)) s.dw[id] = (s.dw[id] || 0) + 1; }); if (mg.winTeam === "b") s.dw[mg.win] = (s.dw[mg.win] || 0) + 1; }
    else if (mg.win) s.dw[mg.win] = (s.dw[mg.win] || 0) + 1;
    G.sk++; s.snd = {k: "s" + G.sk, n: "mgwin"};
    if (s.arena){ s.arK = s.arK || {}; A.ids.forEach(id => { s.arK[id] = (s.arK[id] || 0) + (A.kills[id] || 0); }); mg.perk = null; }
    else { mg.perk = mg.win ? {opts: perkOpts(G, mg.win), until: now() + N().RES + BAN + PERK, pick: null} : null;
      s.meet.until = now() + N().RES + BAN + (+G.opts.meet || 60) * 1000;
      if (mg.win && isBot(mg.win) && mg.perk){ const o = mg.perk.opts[Math.floor(Math.random() * mg.perk.opts.length)], R = revivable(G); hostAct(G, mg.win, {a: "arperk", v: o, t: R[Math.floor(Math.random() * R.length)]}); } }
    send({t: "ahp", hp: rnd(A.hp), mx: A.mx, out: A.out, f: A.feed.slice(-4)});
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
    return {map: A.map || 0, team: A.team || null, ph: A.ph, ids: A.ids, cls: A.cls, hp: rnd(A.hp), mx: A.mx, cubes: A.cubes || [], pw: A.pw || {}, out: A.out, sp: A.sp, feed: A.feed.slice(-4), kills: A.kills, pickLeft: Math.max(0, A.pickEnd - now()), pk: A.pk || PICK, fightEl: A.fight ? now() - A.fight : 0, left: A.end ? Math.max(0, A.end - now()) : 0,
      perk: P2 ? (id === mg.win ? {opts: P2.opts, pick: P2.pick, t: P2.t || null, left: Math.max(0, P2.until - now()), rev: P2.opts.includes("revive") ? revivable(G) : []} : {pick: !!P2.pick}) : null};
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
  const C = {emo: {}, cubes: [], pw: {}, cgT: {}, on: false, seed: null, A: null, me: null, am: AMMO, rl: 0, cd: 0, sup: 0, seq: 0, AP: {}, proj: [], fx: [], fields: [], trail: [], pops: [], sent: 0, sentP: null, moveP: null, aimP: null, supP: null, keys: {}, dot: 0, dotT: 0, dotBy: "", burn: 0, burnBy: "", hurtT: 0, shake: 0, hitAt: {}, shotAt: {}, kb: null, L: null, t0: 0, pickEnd: 0, pickDur: PICK, fightT0: 0, endAt: 0, doneAt: 0, started: false, hpT: 0, outShown: false, lastTr: {}, sndT: {}, kbDone: {}, v: null};
  const me = () => PNet.me;
  const NPo = () => N().NP;
  function reset(keep){ Object.assign(C, {winTeam: null, cubes: [], pw: {}, cgT: {}, seed: null, A: null, me: null, proj: [], fx: [], fields: [], trail: [], pops: [], AP: {}, moveP: null, aimP: null, supP: null, started: false, doneAt: 0, outShown: false, lastTr: {}, burn: 0, dot: 0, sup: 0, kb: null, hitAt: {}, shotAt: {}, kbDone: {}, picked: 0, win: null});
    if (!keep) leaveLayer(); else if (C.L){ const r = C.L.querySelector(".ar-res"); if (r){ r.classList.remove("on"); r._h = null; } } }
  const amIn = () => C.A && C.A.ids.includes(me());
  const alive = id => C.A && C.A.ids.includes(id) && !C.A.out.includes(id);
  const fighting = () => C.A && C.A.ph === "fight" && C.started && alive(me()) && C.me;
  /* where someone is on this screen: me exactly, the host's bots exactly, everyone else smoothed */
  const pos = id => id === me() && C.me ? C.me : isHost() && HB.bots[id] ? HB.bots[id].D || HB.bots[id] : C.AP[id] && C.AP[id].dx != null ? {x: C.AP[id].dx, y: C.AP[id].dy} : C.A && C.A.sp[id] ? C.A.sp[id] : null;
  const isHost = () => !!(PNet.P && PNet.P.isHost);
  const mate = (a, b) => !!(a && b && a !== b && C.A && C.A.team && C.A.team[a] && C.A.team[a] === C.A.team[b]);
  const authOf = by => by === me() || (isHost() && !!HB.bots[by]);
  const visible = id => { if (id === me() || !C.me || !alive(me()) || mate(id, me())) return true; return seenFrom(C.me, id, pos(id)); };
  /* sounds: from NP's little synth (quiet when the game sound is off), softer when it's far away */
  function snd(n, at){ const x = NPo().sfx, d = at && C.me ? Math.hypot(at.x - C.me.x, at.y - C.me.y) : 0, g = Math.max(.15, 1 - d / 900); if (now() - (C.sndT[n] || 0) < 45) return; C.sndT[n] = now(); try {
    if (n === "shot"){ x.noise(0, .14, 2600, 400, .2 * g, "lowpass"); x.tone(0, 170, 55, .1, .12 * g, "square"); }
    else if (n === "rock"){ x.noise(0, .38, 500, 1900, .13 * g, "bandpass", 2); }
    else if (n === "boom"){ x.noise(0, .55, 1000, 50, .36 * g, "lowpass"); x.tone(0, 95, 32, .45, .3 * g, "sine"); }
    else if (n === "melee"){ x.noise(0, .1, 3200, 700, .16 * g, "highpass"); x.tone(.03, 150, 60, .1, .2 * g, "sine"); }
    else if (n === "fire"){ x.noise(0, .32, 900, 2600, .14 * g, "bandpass", .7); }
    else if (n === "snipe"){ x.tone(0, 1900, 260, .14, .09 * g, "sawtooth"); x.noise(0, .09, 5000, 1400, .14 * g, "highpass"); }
    else if (n === "super"){ x.chord(0, [64, 71, 76], .3, .08 * g, "sawtooth"); x.noise(0, .35, 400, 3000, .18 * g, "bandpass", 1.2); }
    else if (n === "ready"){ x.chord(0, [76, 83], .18, .05, "triangle"); x.chord(.12, [79, 86], .25, .05, "triangle"); }
    else if (n === "hurt"){ x.tone(0, 230, 80, .14, .2, "square"); }
    else if (n === "hit"){ x.tone(0, 680, 320, .06, .07, "square"); }
    else if (n === "ko"){ x.chord(0, [60, 63, 67], .45, .07, "sawtooth"); x.noise(0, .4, 1800, 200, .2, "lowpass"); }
    else if (n === "cube"){ x.chord(0, [72, 79, 84], .22, .06, "triangle"); }
    else if (n === "empty"){ x.tone(0, 320, 300, .04, .05, "square"); }
    else if (n === "go"){ x.chord(0, [67, 71, 74], .25, .07, "square"); x.chord(.22, [72, 76, 79], .45, .07, "square"); }
    else if (n === "win"){ x.chord(0, [60, 64, 67], .3, .07, "triangle"); x.chord(.25, [65, 69, 72], .3, .07, "triangle"); x.chord(.5, [72, 76, 79], .7, .08, "triangle"); }
  } catch(e) {} }

  /* the view from the host: phases, health, classes */
  function view(v){
    C.v = v; const mg = v && v.phase === "meet" && v.meet && v.meet.mg; if (!mg || mg.g !== "arena" || !mg.ar){ if (C.seed != null || C.on) reset(); return; }
    const a = mg.ar; setLay(a.map || 0); if (C.seed !== mg.seed){ reset(!!v.arena); C.seed = mg.seed; C.t0 = now() - (mg.el || 0); }
    const A = C.A || (C.A = {hp: {}, mx: {}, out: [], feed: []}); A.team = a.team || null; A.ph = a.ph; A.ids = a.ids; A.cls = a.cls; A.sp = a.sp; A.kills = a.kills || {}; A.perk = a.perk;
    if (now() - C.hpT > 500){ A.hp = Object.assign({}, a.hp); A.out = a.out.slice(); A.feed = a.feed || []; A.mx = a.mx; C.cubes = a.cubes || []; C.pw = a.pw || {}; }
    const pe = now() + a.pickLeft; if (Math.abs(pe - C.pickEnd) > 250) C.pickEnd = pe; C.pickDur = a.pk || PICK;
    if (a.ph === "fight"){ const f0 = now() - a.fightEl; if (!C.fightT0 || Math.abs(f0 - C.fightT0) > 250) C.fightT0 = f0; C.endAt = now() + a.left; if (!C.started) start(); }
    if (mg.done && !C.doneAt){ C.doneAt = now(); C.win = mg.win; C.winTeam = mg.winTeam || null; if (v.arena && amIn()) reward(C.winTeam ? C.A.team && C.A.team[me()] === C.winTeam : mg.win === me()); const iw = C.winTeam ? C.A.team && C.A.team[me()] === C.winTeam : mg.win === me();
      banner(C.winTeam ? (C.winTeam === "h" ? `👑 ${T("You won!", "Ihr habt gewonnen!")}` : `🤖 ${T("The bots win", "Die Bots gewinnen")}`) : mg.win ? `👑 ${esc(NPo().nm(mg.win))}` : T("Draw", "Unentschieden"), iw ? "win" : ""); snd(iw ? "win" : "ko"); if (iw) Haptic.go([30, 50, 30, 50, 80]); }
  }
  /* Nat Stars on its own counts like the other games: XP, and a win is a daily win */
  function reward(won){ const k = (C.A.kills || {})[me()] || 0, solo = PNet.P && PNet.P.solo; let xp = (won ? 20 : 6) + k * 4; if (solo) xp = Math.round(xp / 2);
    PG.st.nsWins = (PG.st.nsWins || 0) + (won ? 1 : 0); PG.st.nsKills = (PG.st.nsKills || 0) + k; try { PG.persist(); } catch(e) {}
    setTimeout(() => { try { if (typeof addXP === "function") addXP(xp, "natstars"); if (won && typeof natWin === "function") natWin("natstars"); } catch(e) {} }, 1800); }
  /* the first few fights: where to touch, what the yellow button and the fog do */
  function hint(){ const n = PG.st.nsHint || 0, box = C.L && C.L.querySelector(".ar-tip"); if (n >= 3 || !box) return; PG.st.nsHint = n + 1; try { PG.persist(); } catch(e) {}
    box.innerHTML = `<span class="t-mv">👆 ${T("Drag = run", "Ziehen = laufen")}</span><span class="t-fire">🎯 ${T("Drag = aim · tap = auto", "Ziehen = zielen · Tippen = Auto")}</span><span class="t-sup">⭐ ${T("Super charges when you hit", "Super lädt durch Treffer")}</span><span class="t-fog">🌫️ ${T("Invisible in the fog", "Im Nebel unsichtbar")} · ⚡ ${T("Cubes make you stronger", "Würfel machen stärker")}</span>`;
    box.classList.add("on"); clearTimeout(C.tipT); C.tipT = setTimeout(() => box.classList.remove("on"), 6500); }
  function start(){
    C.started = true; const sp = C.A.sp[me()]; C.me = sp ? {x: sp.x, y: sp.y, a: 0, f: 1, mv: false} : null; C.am = AMMO; C.rl = 0; C.cd = 0; C.sup = 0; C.cls = C.A.cls[me()] || "shot";
    if (amIn()){ banner(T("GO!", "LOS!"), "go"); snd("go"); Haptic.go([20, 40, 20]); hint(); }
  }
  /* the arena takes the screen once the wheel has stopped, until the winner has been shown (on its own: for good) */
  function active(){ const v = NPo().v, mg = v && v.phase === "meet" && v.meet && v.meet.mg; if (!mg || mg.g !== "arena" || !C.A || C.seed !== mg.seed){ if (C.on && !(v && v.arena && v.phase === "meet")) leaveLayer(); return C.on; }
    const on = (v.arena || now() - C.t0 >= N().SPIN) && !(C.doneAt && now() - C.doneAt > BAN && !v.arena); if (on && !C.on) enter(); if (!on && C.on) leaveLayer(); return on; }
  function hold(mg){ if (C.v && C.v.arena) return 1e9; const extra = mg.win === me() && C.A && C.A.perk && !C.A.perk.pick ? PERK : 0; return N().RES + BAN + extra; }

  /* ---- the layer above the station: class pick, sticks, health, kills ---- */
  function enter(){
    C.on = true; const NP = NPo(); if (!NP.el) return; NP.el.classList.add("arena"); NP.joy = null; try { Focus.set(true); } catch(e) {}
    let L = C.L; if (!L || !L.isConnected){ L = C.L = document.createElement("div"); L.className = "ar-l";
      L.innerHTML = `<div class="ar-hud"><span class="ar-rd"></span><span class="ar-t"></span><span class="ar-n"></span><span class="ar-gas">☠️ ${T("Gas", "Gas")}</span><span class="ar-sp" hidden>👀 ${T("Watching", "Zuschauen")}</span></div><div class="ar-feed"></div><div class="ar-ban"></div><div class="ar-pick"></div><div class="ar-joy"><i></i></div>
        <div class="ar-sup"><b></b><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/></svg></div><div class="ar-fire"><b></b><span class="ar-am"><i><u></u></i><i><u></u></i><i><u></u></i></span></div><div class="ar-res"></div><div class="ar-tip"></div><button class="ar-emb" aria-label="Emote">😀</button><div class="ar-emp">${EMO.map(e => `<button data-em="${e}">${e}</button>`).join("")}</div>`;
      NP.el.appendChild(L); wire(L); }
    pickDraw(true);
  }
  function leaveLayer(){ if (C.on) try { Focus.set(false); } catch(e) {} C.on = false; const NP = NPo(); if (NP && NP.el) NP.el.classList.remove("arena"); if (Q.d0 && NP && NP.rs){ Q.d0 = 0; try { NP.rs(); } catch(e) {} } if (C.L){ C.L.remove(); C.L = null; } C.moveP = C.aimP = C.supP = null; }
  function banner(txt, cls){ C.ban = {txt, cls, t: now()}; const b = C.L && C.L.querySelector(".ar-ban"); if (b){ b.className = "ar-ban on " + (cls || ""); b.innerHTML = txt; b.style.animation = "none"; void b.offsetWidth; b.style.animation = ""; } }
  function wire(L){
    const gw = () => NPo().el.offsetWidth, LOC = N().LOC, joy = L.querySelector(".ar-joy"), knob = joy.firstChild, fb = L.querySelector(".ar-fire"), fk = fb.firstChild, sb = L.querySelector(".ar-sup"), sk = sb.firstChild;
    const emb = L.querySelector(".ar-emb"), emp = L.querySelector(".ar-emp");
    emb.onclick = () => { Sound.tap(); emp.classList.toggle("on"); };
    emp.onclick = e => { const b = e.target.closest("[data-em]"); if (!b) return; emp.classList.remove("on"); if (now() - (C.emT || 0) < 1500) return; C.emT = now(); send({t: "aem", e: b.dataset.em}); Haptic.go(8); };
    L.addEventListener("pointerdown", e => { if (e.target.closest("button")) return; emp.classList.remove("on"); e.preventDefault(); const p = LOC(e);
      if (e.target.closest(".ar-sup")){ if (C.supP || C.sup < 1 || !fighting()) return; C.supP = {x0: p.x, y0: p.y, dx: 0, dy: 0, id: e.pointerId, man: false}; sb.classList.add("on"); }
      else if (p.x < gw() * .45){ if (C.moveP) return; C.moveP = {x0: p.x, y0: p.y, dx: 0, dy: 0, id: e.pointerId}; joy.style.left = p.x + "px"; joy.style.top = p.y + "px"; joy.classList.add("on"); knob.style.transform = "translate(-50%,-50%)"; }
      else { if (C.aimP) return; C.aimP = {x0: p.x, y0: p.y, dx: 0, dy: 0, id: e.pointerId, man: false}; fb.classList.add("on"); fb.style.left = (p.x - 55) + "px"; fb.style.top = (p.y - 55) + "px"; fk.style.transform = ""; }
      try { L.setPointerCapture(e.pointerId); } catch(_) {} });
    L.addEventListener("pointermove", e => { const p = LOC(e);
      if (C.moveP && e.pointerId === C.moveP.id){ let dx = p.x - C.moveP.x0, dy = p.y - C.moveP.y0; const d = Math.hypot(dx, dy), m = 56; if (d > m){ dx *= m / d; dy *= m / d; } C.moveP.dx = dx / m; C.moveP.dy = dy / m; knob.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`; }
      const st = (P2, k) => { let dx = p.x - P2.x0, dy = p.y - P2.y0; const d = Math.hypot(dx, dy); if (d > 16) P2.man = true; P2.dx = dx; P2.dy = dy; const kk = Math.min(1, 40 / Math.max(1, d)); k.style.transform = `translate(${dx * kk}px,${dy * kk}px)`; };
      if (C.aimP && e.pointerId === C.aimP.id) st(C.aimP, fk);
      if (C.supP && e.pointerId === C.supP.id) st(C.supP, sk); });
    const up = e => { if (C.moveP && e.pointerId === C.moveP.id){ C.moveP = null; joy.classList.remove("on"); }
      if (C.aimP && e.pointerId === C.aimP.id){ const a = C.aimP; C.aimP = null; fb.classList.remove("on"); fb.style.left = fb.style.top = ""; fk.style.transform = "";
        if (e.type === "pointerup") { if (a.man) fire(Math.atan2(a.dy, a.dx), false, Math.hypot(a.dx, a.dy)); else autoFire(); } }
      if (C.supP && e.pointerId === C.supP.id){ const a = C.supP; C.supP = null; sb.classList.remove("on"); sk.style.transform = "";
        if (e.type === "pointerup") { if (a.man) fire(Math.atan2(a.dy, a.dx), true, Math.hypot(a.dx, a.dy)); else autoFire(true); } } };
    L.addEventListener("pointerup", up); L.addEventListener("pointercancel", up);
    L.addEventListener("click", e => { const b = e.target.closest("[data-arc]"); if (b) return pick(b.dataset.arc); const x = e.target.closest("[data-arx]"); if (!x) return; Sound.tap();
      if (x.dataset.arx === "lobby") NPo().act({a: "tolobby"}); if (x.dataset.arx === "quit") NPo().openPanel && NPo().openPanel("quit"); });
    if (!C.kd){ C.kd = e => { if (!C.on) return; if (/^(Arrow|Key[WASD])/.test(e.code)){ C.keys[e.code] = 1; e.preventDefault(); } if (e.code === "Space"){ e.preventDefault(); autoFire(); } if (e.code === "KeyE" || e.code === "KeyQ"){ e.preventDefault(); autoFire(true); } }; C.ku = e => { delete C.keys[e.code]; };
      window.addEventListener("keydown", C.kd); window.addEventListener("keyup", C.ku); }
  }
  function pick(k){ if (!CLS[k] || !C.A || C.A.ph !== "pick" || !amIn()) return; C.A.cls[me()] = k; PG.st.arCls = k; try { PG.persist(); } catch(e) {} Sound.tap(); Haptic.go(10); NPo().act({a: "arcl", v: k}); pickDraw(true); }
  function pickDraw(force){
    const box = C.L && C.L.querySelector(".ar-pick"); if (!box) return; const A = C.A, on = A && A.ph === "pick"; box.classList.toggle("on", !!on); if (!on) return;
    if (amIn() && !C.picked){ C.picked = 1; const k = CLS[PG.st.arCls] ? PG.st.arCls : KEYS[Math.floor(Math.random() * KEYS.length)]; if (A.cls[me()] !== k){ A.cls[me()] = k; NPo().act({a: "arcl", v: k}); } }
    const left = Math.max(0, C.pickEnd - now()), mine = A.cls[me()];
    const sig = JSON.stringify(A.cls) + amIn();
    if (force || box._sig !== sig){ box._sig = sig; const P = NPo().pl();
      box.innerHTML = `<div class="ar-pt">⭐ ${amIn() ? T("Pick your fighter", "Wähl deinen Kämpfer") : "👻 " + T("You're watching", "Du schaust zu")}</div><div class="ar-cards">${KEYS.map(k => { const c = CLS[k], who = A.ids.filter(id => A.cls[id] === k);
        return `<button class="ar-card ${mine === k ? "sel" : ""}" data-arc="${k}" ${amIn() ? "" : "disabled"}><span class="e">${c.e}</span><b>${esc(nm(c))}</b><small>${esc(T(c.sen, c.sde))}</small><em>${c.su.e} ${esc(nm(c.su))}</em><i class="hp">❤ ${c.hp}</i><span class="who">${who.slice(0, 5).map(id => `<span class="np-hd sm">${headOf(id, P)}</span>`).join("")}</span></button>`; }).join("")}</div><div class="ar-pbar"><i></i></div>`; }
    const bar = box.querySelector(".ar-pbar i"); if (bar) bar.style.width = Math.min(100, left / (C.pickDur || PICK) * 100) + "%";
  }
  const HC = {};
  function headOf(id, P){ const p = (P || NPo().pl()).find(x => x.id === id), k = id + (p && p.av ? JSON.stringify(p.av).length : 0); if (HC[k]) return HC[k]; try { return HC[k] = avatarSVG(Object.assign({}, p && p.av || {}, {aura: "none", pet: "none"}), {head: true, size: 22}); } catch(e) { return ""; } }
  function hud(){
    const L = C.L; if (!L || !C.A) return; const A = C.A, n = A.ids.filter(id => !A.out.includes(id)).length, v = C.v || {};
    const t = A.ph === "fight" ? `⏱ ${Math.max(0, Math.ceil((C.endAt - now()) / 1000))}` : A.ph === "pick" ? `⏱ ${Math.ceil(Math.max(0, C.pickEnd - now()) / 1000)}` : "⏱ 0";
    const set = (s, tx) => { const e = L.querySelector(s); if (e.textContent !== tx) e.textContent = tx; };
    set(".ar-t", t); set(".ar-n", `🧍 ${n}`); const rd = L.querySelector(".ar-rd"); rd.hidden = !v.arena; if (v.arena) set(".ar-rd", `⭐ ${T("Round", "Runde")} ${v.arRound || 1} · ${T(LAY.en, LAY.de)}`);
    L.querySelector(".ar-gas").classList.toggle("on", A.ph === "fight" && now() - C.fightT0 > GAS0 - 2000);
    { const sp = L.querySelector(".ar-sp"), on = A.ph === "fight" && (!amIn() || A.out.includes(me())); if (sp.hidden === on) sp.hidden = !on; }
    const fh = (A.feed || []).slice(-3).map(([by, vic, c]) => `<div>${by ? `<b>${esc(NPo().nm(by))}</b> ${CLS[c] ? CLS[c].e : "💀"} ` : "☠️ "}<b>${esc(NPo().nm(vic))}</b></div>`).join(""), fe = L.querySelector(".ar-feed"); if (fe._h !== fh){ fe._h = fh; fe.innerHTML = fh; }
    const fb = L.querySelector(".ar-fire"), sb = L.querySelector(".ar-sup"), show = !!fighting(); fb.style.display = sb.style.display = show ? "" : "none";
    if (show){ const cl = CLS[C.cls], b = fb.firstChild; if (b.textContent !== cl.e) b.textContent = cl.e; fb.querySelectorAll(".ar-am i").forEach((x, i) => { const f = i < C.am ? 1 : i === C.am ? Math.round(Math.min(1, C.rl / cl.rl) * 20) / 20 : 0; if (x._f !== f){ x._f = f; x.firstChild.style.transform = `scaleX(${f})`; x.classList.toggle("full", f >= 1); } });
      const s2 = sb.firstChild; if (s2.textContent !== cl.su.e) s2.textContent = cl.su.e; sb.classList.toggle("ready", C.sup >= 1); const so = String(Math.round(289 * (1 - Math.min(1, C.sup)))); if (sb._so !== so){ sb._so = so; sb.querySelector("circle").style.strokeDashoffset = so; } }
    if (amIn() && A.out.includes(me()) && !C.outShown && !C.doneAt){ C.outShown = true; const place = A.ids.length - A.out.indexOf(me()); banner(`💀 ${T("Out!", "Raus!")}<small>${T("Place", "Platz")} ${place}</small>`, "out"); }
    pickDraw(); resDraw();
  }
  /* on its own: between rounds the table, the countdown and the way back to the lobby */
  function resDraw(){
    const box = C.L && C.L.querySelector(".ar-res"), v = C.v; if (!box) return; const on = !!(v && v.arena && C.doneAt && now() - C.doneAt > 1700); box.classList.toggle("on", on); if (!on) return;
    const P = NPo().pl(), W = v.arWins || {}, K = v.arK || {}, ids = (C.A.ids || []).slice().sort((a, b) => (W[b] || 0) - (W[a] || 0) || (K[b] || 0) - (K[a] || 0)), left = Math.max(0, Math.ceil((C.doneAt + NEXT - now()) / 1000));
    const h = `<div class="ar-rbox"><div class="ar-rt">${C.winTeam ? (C.winTeam === "h" ? `👑 <b>${T("You", "Ihr")}</b> ${T("win round", "gewinnt Runde")} ${v.arRound || 1}` : `🤖 <b>${T("The bots", "Die Bots")}</b> ${T("win round", "gewinnen Runde")} ${v.arRound || 1}`) : C.win ? `👑 <b>${esc(NPo().nm(C.win))}</b> ${T("wins round", "gewinnt Runde")} ${v.arRound || 1}` : T("Draw", "Unentschieden")}</div>
      <div class="ar-rl ${ids.length > 4 ? "two" : ""}">${ids.map((id, i) => `<div class="${id === me() ? "me" : ""}"><span class="r">${i + 1}</span><span class="np-hd">${headOf(id, P)}</span><b>${esc(NPo().nm(id))}</b><span class="w">🏆 ${W[id] || 0}</span><span class="k">💀 ${K[id] || 0}</span></div>`).join("")}</div>
      <div class="ar-rn">${T("Next round in", "Nächste Runde in")} <b>${left}</b> · ${(() => { const L2 = LAYS[(LAYS.indexOf(LAY) + 1) % LAYS.length]; return T(L2.en, L2.de); })()}</div><div class="ar-rb">${v.host && !(PNet.P && PNet.P.solo) ? `<button class="btn ghost" data-arx="lobby">↩︎ ${T("To the lobby", "Zur Lobby")}</button>` : ""}<button class="btn ghost" data-arx="quit">🚪 ${T("Leave", "Raus")}</button></div></div>`;
    if (box._h !== h){ box._h = h; box.innerHTML = h; }
  }

  /* ---- shooting ---- */
  function nearestEnemy(rg, lob){ let best = null; C.A.ids.forEach(id => { if (id === me() || !alive(id) || !visible(id) || mate(id, me())) return; const q = pos(id); if (!q) return; const d = Math.hypot(q.x - C.me.x, q.y - C.me.y); if (d > rg) return; if (!lob && !clear(C.me, q)) return; if (!best || d < best.d) best = {id, q, d}; }); return best; }
  function autoFire(su){ if (!fighting()) return; const cl = CLS[C.cls], s2 = su ? cl.su : cl, t = nearestEnemy((s2.rg || cl.rg) * 1.12, !!cl.lob);
    if (!t) return fire(C.me.a || 0, su); const v = velOf(t.id), sp = s2.v || cl.v, tt = cl.lob ? cl.lob / 1000 : sp ? t.d / sp : 0, tx = t.q.x + v.x * tt, ty = t.q.y + v.y * tt; C.autoLine = {x: t.q.x, y: t.q.y, t: now()};
    fire(Math.atan2(ty - C.me.y, tx - C.me.x), su, cl.lob ? -Math.hypot(tx - C.me.x, ty - C.me.y) : 0); }
  /* how far a throw goes: the stick's length (or, negative, an exact distance from the auto aim) */
  const throwDist = (cl, su, len) => { const rg = su && cl.su.rg ? cl.su.rg : cl.rg; if (len < 0) return Math.min(rg, Math.max(70, -len)); return len ? rg * Math.max(.25, Math.min(1, (len - 16) / 70)) : rg * .75; };
  function fire(a, su, len){
    if (!fighting()) return; const cl = CLS[C.cls];
    if (su){ if (C.sup < 1) return; C.sup = 0; } else { if (C.am < 1 || C.cd > 0){ if (C.am < 1) snd("empty"); return; } C.am--; C.cd = cl.cd; }
    C.me.a = a; C.me.f = Math.cos(a) < 0 ? -1 : 1;
    send(Object.assign({t: "as", by: me(), k: me().slice(0, 3) + (++C.seq), c: C.cls, x: Math.round(C.me.x), y: Math.round(C.me.y), a: Math.round(a * 1000) / 1000}, su ? {s: 1} : {}, cl.lob ? {r: Math.round(throwDist(cl, su, len || 0))} : {})); Haptic.go(su ? [15, 20, 25] : 8);
  }
  /* a shot happens (ours too): bullets fly, fists and flames hit at once. Whoever fired decides the hits */
  function shot(m){
    const cl = CLS[m.c]; if (!cl || !C.A) return; const a = +m.a || 0, by = m.by, su = !!m.s, au = authOf(by); C.shotAt[by] = now();
    let from = {x: +m.x, y: +m.y}; if (by !== me()){ const p = C.AP[by]; if (p){ p.a = a; p.f = Math.cos(a) < 0 ? -1 : 1; p.shotT = now(); if (p.dx != null && Math.hypot(p.dx - from.x, p.dy - from.y) < 140 && !HB.bots[by]) from = {x: p.dx, y: p.dy}; } }
    if (su){ snd("super", from); C.fx.push({k: "sup", x: from.x, y: from.y, t: now()}); }
    else C.fx.push({k: "flash", x: from.x + Math.cos(a) * 30, y: from.y + Math.sin(a) * 30, a, t: now(), c: m.c});
    const hitList = (r, cone) => C.A.ids.filter(id => { if (id === by || !alive(id) || mate(id, by)) return false; const q = pos(id); if (!q) return false; const d = Math.hypot(q.x - from.x, q.y - from.y); if (d > r + BODY) return false;
      if (cone && angDiff(Math.atan2(q.y - from.y, q.x - from.x), a) > cone + Math.atan2(BODY, Math.max(1, d))) return false; return clear(from, q); });
    if (su && m.c === "melee"){ snd("melee", from); if (by === me() && C.me) C.me.dash = {a, until: now() + cl.su.dur, hit: {}, k: m.k}; else if (isHost() && HB.bots[by]) HB.bots[by].dash = {a, until: now() + cl.su.dur, hit: {}, k: m.k}; return; }
    if (su && m.c === "fire"){ snd("fire", from); C.fx.push({k: "ring", x: from.x, y: from.y, t: now(), rg: cl.su.rg});
      if (au) hitList(cl.su.rg).forEach(id => hitOut(id, cl.su.dmg, m.k + ":" + id, by, {burn: 1}));
      for (let i = 0; i < 8; i++){ const aa = i * Math.PI / 4, x = from.x + Math.cos(aa) * cl.su.rg * .7, y = from.y + Math.sin(aa) * cl.su.rg * .7; if (inAr(x, y)) C.fields.push({x, y, r: 46, until: now() + 2200, by, t: now()}); }
      return; }
    if (cl.lob){ const s2 = su ? Object.assign({}, cl, cl.su) : cl, d = Math.min(s2.rg, Math.max(40, +m.r || s2.rg * .75)); snd("rock", from);
      C.proj.push({k: m.k, by, c: m.c, su, lob: 1, x0: from.x, y0: from.y, x1: from.x + Math.cos(a) * d, y1: from.y + Math.sin(a) * d, x: from.x, y: from.y, t: now(), dur: cl.lob * (.6 + .4 * d / s2.rg), au, done: {}});
      return; }
    if (cl.cone){ snd(m.c === "melee" ? "melee" : "fire", from); C.fx.push({k: m.c === "melee" ? "swipe" : "flame", x: from.x, y: from.y, a, t: now(), rg: cl.rg, cone: cl.cone});
      if (au) hitList(cl.rg, cl.cone).forEach(id => hitOut(id, cl.dmg, m.k + ":" + id, by, cl.burn ? {burn: 1} : null));
      return; }
    snd(m.c, from);
    const s2 = su ? Object.assign({}, cl, cl.su) : cl, n = s2.n || 1;
    for (let i = 0; i < n; i++){ const aa = a + (n > 1 ? (i - (n - 1) / 2) * s2.spr : 0);
      C.proj.push({k: m.k + ":" + i, sk: m.k, by, c: m.c, su, x: from.x + Math.cos(aa) * 16, y: from.y + Math.sin(aa) * 16, vx: Math.cos(aa) * s2.v, vy: Math.sin(aa) * s2.v, tr: 0, rg: s2.rg, r: s2.r || cl.r, t: now(), au, pierce: su && m.c === "snipe", done: {}}); }
  }
  const dmgOf = p => { const cl = CLS[p.c]; if (p.su && cl.su.dmg) return cl.su.dmg; return p.c === "snipe" ? Math.round(cl.dmg + cl.far * Math.min(1, p.tr / cl.rg)) : cl.dmg; };
  /* a hit that this phone decides: tell everyone (the host keeps the health) */
  function hitOut(v, d, k, by, ex){ if (!(d > 0) || !C.A || !alive(v) || mate(v, by)) return; if (by && by !== v) d *= 1 + CUBE * (C.pw[by] || 0); const m = {t: "ah", v, by: by || "", d: Math.round(d), k};
    if (ex && ex.burn) m.b = 1; if (ex && ex.kx != null){ m.kx = Math.round(ex.kx); m.ky = Math.round(ex.ky); }
    send(m); if (by === me() && v !== me()){ const was = C.sup; C.sup = Math.min(1, C.sup + d / CLS[C.cls].sc); if (was < 1 && C.sup >= 1){ snd("ready"); Haptic.go([10, 30, 10]); } } }
  /* something touches a body */
  function bodyAt(p){ const ids = C.A.ids; for (let i = 0; i < ids.length; i++){ const id = ids[i]; if (id === p.by || !alive(id) || p.done[id] || mate(id, p.by)) continue; const q = pos(id); if (!q) continue; if (Math.hypot(q.x - p.x, q.y - p.y) < BODY + p.r) return id; } return null; }
  function boom(p, direct){
    const cl = CLS.rock; snd("boom", p); C.fx.push({k: "boom", x: p.x, y: p.y, t: now()}); C.shake = Math.max(C.shake, C.me && Math.hypot(p.x - C.me.x, p.y - C.me.y) < 400 ? 10 : 3);
    if (p.au) C.A.ids.forEach(id => { if (id === direct || id === p.by || !alive(id) || mate(id, p.by)) return; const q = pos(id); if (q && Math.hypot(q.x - p.x, q.y - p.y) < cl.splash + BODY * .5 && clear(p, {x: q.x + (p.x - q.x) * .1, y: q.y + (p.y - q.y) * .1})) hitOut(id, cl.sdmg, p.k + "x" + id, p.by); });
    C.fields.push({x: p.x, y: p.y, r: 64, until: now() + cl.field, by: p.by, t: now()});
  }
  /* the leap: fly forward, everyone you touch gets hit once */
  function dashStep(o, id, dt, A){
    const d = o.dash, sp = CLS.melee.su.rg / (CLS.melee.su.dur / 1000), nx = o.x + Math.cos(d.a) * sp * dt, ny = o.y + Math.sin(d.a) * sp * dt;
    if (walkA(nx, o.y)) o.x = nx; if (walkA(o.x, ny)) o.y = ny; o.mv = 1; o.f = Math.cos(d.a) < 0 ? -1 : 1;
    (A || C.A).ids.forEach(t => { if (t === id || d.hit[t] || !alive(t) || mate(t, id)) return; const q = pos(t); if (q && Math.hypot(q.x - o.x, q.y - o.y) < BODY * 2 + 18){ d.hit[t] = 1; hitOut(t, CLS.melee.su.dmg, d.k + ":" + t, id, {kx: Math.cos(d.a) * 70, ky: Math.sin(d.a) * 70}); } });
    if (now() >= d.until){ o.dash = null; C.fx.push({k: "land", x: o.x, y: o.y, t: now()}); snd("boom", o); }
  }
  /* what hurts where I stand: fire, the fire trail, burning, the gas */
  function hazards(q, id, el, gr){
    let dps = 0, by = ""; const t = now();
    C.fields.forEach(f => { if (f.by !== id && !mate(f.by, id) && f.until > t && Math.hypot(q.x - f.x, q.y - f.y) < f.r){ dps = Math.max(dps, 26); by = f.by; } });
    let tr = 0; C.trail.forEach(p => { if (p.by !== id && !mate(p.by, id) && t - p.t < 1800 && Math.hypot(q.x - p.x, q.y - p.y) < 30){ tr = 24; by = by || p.by; } }); dps += tr;
    if (id === me() && C.burn > t){ dps += 7; by = by || C.burnBy; } const o = HB.dot[id]; if (o && o.burn > t){ dps += 7; by = by || o.burnBy; }
    if (el >= GAS0 && Math.hypot(q.x - GC.x, q.y - GC.y) > gr){ dps += 22; }
    return {dps, by};
  }
  function onMsg(m){
    if (!m || !m.t) return;
    if (m.t === "afl" || m.t === "abr"){ FX.msg(m); return; }
    if (!C.A){ return; }
    const host = isHost();
    if (m.t === "am"){ if (m.id !== me()) onPos(m.id, +m.x, +m.y, (+m.a || 0) / 100, m.f, m.m, clk(m.id, m.ts)); }
    else if (m.t === "amb"){ if (!host && Array.isArray(m.l)){ const st = clk(m.id, m.ts); m.l.forEach(([id, x, y, a, mv, f]) => onPos(id, x, y, a / 100, f, mv, st)); } }
    else if (m.t === "as"){ if (host){ const mg = hostMg(); if (mg && mg.ar.ids.includes(m.by)) mg.ar.ls[m.by] = now(); } shot(m); }
    else if (m.t === "ah"){ const v = m.v || m.id, d = +m.d || 0;
      if (host) hostHit(v, d, m.by && C.A.ids.includes(m.by) ? m.by : "", m.k ? String(m.k).slice(0, 32) : null);
      C.hitAt[v] = now(); if (!(d > 0)) return;
      if (v === me()) hurtFx(d, m);
      else { const q = pos(v); if (q) C.pops.push({x: q.x, y: q.y - 120, txt: "-" + d, t: now(), mine: m.by === me()}); if (m.by === me()) snd("hit", q);
        if (host && HB.bots[v]){ const b = HB.bots[v]; if (m.b){ const o = HB.dot[v] || (HB.dot[v] = {d: 0, t: now(), by: m.by}); o.burn = now() + CLS.fire.burn; o.burnBy = m.by; } if (m.kx != null) b.kb = {vx: m.kx / .16, vy: m.ky / .16, until: now() + 160}; } } }
    else if (m.t === "aem"){ const who = m.w && isBot(m.w) ? m.w : m.id; if (EMO.includes(m.e)){ C.emo[who] = {e: m.e, t: now()}; if (who !== me()) snd("hit"); } }
    else if (m.t === "acu"){ const had = C.pw[me()] || 0; C.cubes = m.c || []; C.pw = m.pw || {}; if ((C.pw[me()] || 0) > had){ snd("cube"); Haptic.go(12); C.fx.push({k: "cube", x: C.me ? C.me.x : 0, y: C.me ? C.me.y : 0, t: now()}); } }
    else if (m.t === "acg"){ if (host){ const mg = hostMg(); if (mg && mg.ar.cubes && mg.ar.ph === "fight") cubeGrab(mg.ar, m.id, +m.k); } }
    else if (m.t === "ahp"){ if (m.mx) C.A.mx = m.mx; C.A.hp = Object.assign({}, m.hp); C.A.out = (m.out || []).slice(); C.A.feed = m.f || []; C.hpT = now();
      if (m.ko){ const q = pos(m.ko); if (q) C.fx.push({k: "ko", x: q.x, y: q.y, t: now()}); snd("ko", q); if (m.ko === me()) Haptic.go([60, 40, 120]); } }
  }
  function hurtFx(d, m){
    if (!alive(me()) || !C.me) return; if (C.A.hp[me()] != null) C.A.hp[me()] = Math.max(1, C.A.hp[me()] - d); C.hpT = now();
    if (m.b){ C.burn = now() + CLS.fire.burn; C.burnBy = m.by; } if (m.kx != null) C.kb = {vx: m.kx / .16, vy: m.ky / .16, until: now() + 160};
    if (m.by === me()) return; /* my own fire or gas: no big fuss */
    C.hurtT = now(); C.shake = Math.max(C.shake, d > 20 ? 9 : 6); C.pops.push({x: C.me.x, y: C.me.y - 120, txt: "-" + Math.round(d), t: now(), me: 1}); snd("hurt"); Haptic.go(d > 20 ? 25 : 10);
  }
  /* the sender's clock mapped onto mine: the quickest message so far sets the offset, so late ones don't make people jump */
  const OFF = {};
  function clk(from, ts){ const r = now(); if (!(ts > 0)) return r; const d = r - ts, o = OFF[from]; OFF[from] = o == null || d < o || d - o > 2000 ? d : o + (d - o) * .01; return ts + OFF[from]; }
  function onPos(id, x, y, a, f, mv, st){ const p = C.AP[id] || (C.AP[id] = {buf: [], dx: x, dy: y}), t = st || now(), b = p.buf, l = b[b.length - 1]; if (l && (Math.hypot(l.x - x, l.y - y) > 300 || t < l.t - 500)) b.length = 0;
    if (l && t <= l.t && b.length) return; b.push({t, x, y}); if (b.length > 10) b.shift(); p.a = a; p.f = f || 1; p.mv = !!mv; p.t = now(); }

  const Q = {n: 0, sum: 0, d0: 0};
  function quality(dt){ const NP = NPo(); if (!NP.cv || !C.A || C.A.ph !== "fight" || now() - C.fightT0 < 2000) { Q.n = Q.sum = 0; return; } Q.sum += dt; if (++Q.n < 90) return; const avg = Q.sum / Q.n; Q.n = Q.sum = 0;
    if (avg > 1 / 45 && NP.dpr > 1.05){ const w = NP.cv.width / NP.dpr, h = NP.cv.height / NP.dpr, d = Math.max(1, Math.round((NP.dpr - .34) * 100) / 100); if (!Q.d0) Q.d0 = NP.dpr; NP.cv.width = Math.round(w * d); NP.cv.height = Math.round(h * d); NP.dpr = d; } }
  function step(dt){
    if (!C.A) return; quality(dt); const A = C.A, t = now(), el = t - C.fightT0, gr = A.ph === "fight" ? gasR(el) : 99999;
    if (fighting()){ const cl = CLS[C.cls]; let ix = 0, iy = 0;
      if (C.me.dash) dashStep(C.me, me(), dt);
      else {
        if (C.moveP){ ix = C.moveP.dx; iy = C.moveP.dy; } const k = C.keys; if (k.ArrowLeft || k.KeyA) ix -= 1; if (k.ArrowRight || k.KeyD) ix += 1; if (k.ArrowUp || k.KeyW) iy -= 1; if (k.ArrowDown || k.KeyS) iy += 1;
        const m = Math.hypot(ix, iy); if (m > 1){ ix /= m; iy /= m; } C.me.mv = m > .05;
        if (C.me.mv){ const sp = SPD * cl.sp * dt, nx = C.me.x + ix * sp, ny = C.me.y + iy * sp; if (walkA(nx, C.me.y)) C.me.x = nx; if (walkA(C.me.x, ny)) C.me.y = ny; if (Math.abs(ix) > .1) C.me.f = ix < 0 ? -1 : 1; if (!(C.aimP && C.aimP.man) && !(C.supP && C.supP.man)) C.me.a = Math.atan2(iy, ix); }
        if (C.kb && C.kb.until > t){ const nx = C.me.x + C.kb.vx * dt, ny = C.me.y + C.kb.vy * dt; if (walkA(nx, C.me.y)) C.me.x = nx; if (walkA(C.me.x, ny)) C.me.y = ny; } }
      if (C.aimP && C.aimP.man) C.me.a = Math.atan2(C.aimP.dy, C.aimP.dx); if (C.supP && C.supP.man) C.me.a = Math.atan2(C.supP.dy, C.supP.dx);
      C.rl += dt * 1000; while (C.am < AMMO && C.rl >= cl.rl){ C.am++; C.rl -= cl.rl; } if (C.am >= AMMO) C.rl = 0; C.cd -= dt * 1000;
      const moved = !C.sentP || Math.hypot(C.me.x - C.sentP.x, C.me.y - C.sentP.y) > 2 || Math.abs(C.me.a - C.sentP.a) > .15, gap = C.me.dash ? 50 : 95;
      if ((moved && t - C.sent > gap) || t - C.sent > 800){ C.sent = t; C.sentP = {x: C.me.x, y: C.me.y, a: C.me.a}; PNet.raw({t: "am", x: Math.round(C.me.x), y: Math.round(C.me.y), a: Math.round(C.me.a * 100), f: C.me.f, m: C.me.mv ? 1 : 0, ts: t}); }
      for (const cb of C.cubes) if (Math.hypot(cb.x - C.me.x, cb.y - C.me.y) < 38 && t - (C.cgT[cb.k] || 0) > 600){ C.cgT[cb.k] = t; send({t: "acg", k: cb.k}); }
      const h = hazards(C.me, me(), el, gr); if (h.dps > 0){ C.dot += h.dps * dt; C.dotBy = h.by || C.dotBy; } if (t - C.dotT > 300 && C.dot >= 1){ hitOut(me(), Math.round(C.dot), "d" + me().slice(0, 3) + t, C.dotBy || me()); C.dot = 0; C.dotT = t; C.dotBy = ""; }
    }
    /* everyone else, a moment behind so it stays smooth; a little ahead when a message is late */
    if (isHost()) for (const id in HB.bots){ const b = HB.bots[id], k = b.ut ? Math.min(1, (t - b.ut) / 50) : 1, D = b.D || (b.D = {x: b.x, y: b.y}); D.x = b.px != null ? b.px + (b.x - b.px) * k : b.x; D.y = b.py != null ? b.py + (b.y - b.py) * k : b.y; }
    const rt = t - LAG; for (const id in C.AP){ if (isHost() && HB.bots[id]) continue; const p = C.AP[id], b = p.buf; if (!b || !b.length) continue;
      if (rt <= b[0].t){ p.dx = b[0].x; p.dy = b[0].y; continue; } const l = b[b.length - 1];
      if (rt >= l.t){ const q = b[b.length - 2], ex = Math.min(100, rt - l.t); if (q && l.t > q.t && p.mv){ const f = ex / (l.t - q.t); p.dx = l.x + (l.x - q.x) * Math.min(1, f); p.dy = l.y + (l.y - q.y) * Math.min(1, f); } else { p.dx = l.x; p.dy = l.y; } continue; }
      let i = b.length - 1; while (i > 0 && b[i - 1].t > rt) i--; const a0 = b[i - 1] || b[0], b0 = b[i], f = (rt - a0.t) / Math.max(1, b0.t - a0.t); p.dx = a0.x + (b0.x - a0.x) * f; p.dy = a0.y + (b0.y - a0.y) * f; }
    /* the fire-trail class leaves flames where it walks */
    if (A.ph === "fight") A.ids.forEach(id => { if (A.cls[id] !== "fire" || !alive(id)) return; const q = pos(id); if (!q) return; const l = C.lastTr[id]; if (!l || Math.hypot(l.x - q.x, l.y - q.y) > 34){ C.lastTr[id] = {x: q.x, y: q.y}; C.trail.push({x: q.x, y: q.y, by: id, t}); } });
    prune(C.trail, p => t - p.t < 1800); prune(C.fields, f => f.until > t);
    /* bombs */
    for (const p of C.proj){ if (!p.lob || p.dead) continue; const k = Math.min(1, (t - p.t) / p.dur); p.x = p.x0 + (p.x1 - p.x0) * k; p.y = p.y0 + (p.y1 - p.y0) * k;
      if (k >= 1){ p.dead = 1; const cl = CLS[p.c], s2 = p.su ? Object.assign({}, cl, cl.su) : cl; snd("boom", p); C.fx.push({k: "boom", x: p.x1, y: p.y1, t, big: p.su}); C.shake = Math.max(C.shake, C.me && Math.hypot(p.x1 - C.me.x, p.y1 - C.me.y) < 400 ? (p.su ? 14 : 9) : 3);
        if (p.au) C.A.ids.forEach(id => { if (id === p.by || !alive(id) || mate(id, p.by)) return; const q = pos(id); if (!q) return; const dd = Math.hypot(q.x - p.x1, q.y - p.y1); if (dd > s2.splash + BODY * .6) return;
          const kb = p.su && s2.kb ? {kx: (q.x - p.x1) / (dd || 1) * s2.kb, ky: (q.y - p.y1) / (dd || 1) * s2.kb} : null; hitOut(id, s2.dmg, p.k + ":" + id, p.by, kb); }); } }
    /* bullets */
    for (const p of C.proj){ if (p.dead || p.lob) continue; const sp = Math.hypot(p.vx, p.vy) * dt, n = Math.max(1, Math.ceil(sp / 10));
      for (let i = 0; i < n; i++){ p.x += p.vx * dt / n; p.y += p.vy * dt / n; p.tr += sp / n;
        if (!inAr(p.x, p.y) || shotSolid(p.x, p.y) || p.tr >= p.rg){ p.dead = 1; if (p.c === "rock") boom(p, null); else C.fx.push({k: "spark", x: p.x, y: p.y, t}); break; }
        const id = bodyAt(p); if (id){ p.done[id] = 1; C.hitAt[id] = t;
          if (p.au){ const kb = p.su && p.c === "shot" && !C.kbDone[p.sk + id] ? (C.kbDone[p.sk + id] = 1, {kx: p.vx / Math.hypot(p.vx, p.vy) * CLS.shot.su.kb, ky: p.vy / Math.hypot(p.vx, p.vy) * CLS.shot.su.kb}) : null; hitOut(id, dmgOf(p), p.k, p.by, kb); }
          if (p.pierce){ C.fx.push({k: "spark", x: p.x, y: p.y, t, hit: 1}); continue; }
          p.dead = 1; if (p.c === "rock") boom(p, id); else C.fx.push({k: "spark", x: p.x, y: p.y, t, hit: 1}); break; } } }
    prune(C.proj, p => !p.dead && t - p.t < 3000); prune(C.fx, f => t - f.t < 800); prune(C.pops, p => t - p.t < 900);
    if (Object.keys(C.kbDone).length > 300) C.kbDone = {};
    C.shake *= Math.pow(.02, dt);
    if (t - (C.hudT || 0) > 120){ C.hudT = t; hud(); }
  }

  /* ---- drawing: the station is drawn once into a picture, people and fog are cached bitmaps ---- */
  const MC = {cv: null, s: 0, x0: 300, y0: -180, w: 1940, h: 1480, n: 0, at: 0};
  setTimeout(() => { try { if (N() && N().ROOMS) setLay(0); } catch(e) {} }, 0);
  function mapCache(z){
    const S = Math.max(.5, Math.min(1.5, z)); if (MC.cv && Math.abs(MC.s - S) / S < .2 && !(MC.n === 1 && now() - MC.at > 1500 && !(C.A && C.A.ph === "fight"))) return MC;
    const NP = NPo(), cv = MC.cv || document.createElement("canvas"); cv.width = Math.ceil(MC.w * S); cv.height = Math.ceil(MC.h * S); const c = cv.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = "#0B0C12"; c.fillRect(0, 0, cv.width, cv.height);
    c.setTransform(S, 0, 0, S, -MC.x0 * S, -MC.y0 * S);
    c.fillStyle = "#fff"; N().STARS.forEach(([x, y, r, a]) => { c.globalAlpha = .2 + a * .5; c.fillRect(x, y, r * 1.6, r * 1.6); }); c.globalAlpha = 1;
    const {AREAS, ROOMS, HALLS} = N(); c.fillStyle = "#211F1C"; AREAS.forEach(a => c.fillRect(a.x - 14, a.y - 14, a.w + 28, a.h + 28)); AREAS.forEach(a => { c.fillStyle = "#33302C"; c.fillRect(a.x, a.y, a.w, a.h); });
    try { ROOMS.forEach(r => NP.floor(c, r)); HALLS.forEach(a => { c.fillStyle = "#2B2926"; c.fillRect(a.x, a.y, a.w, a.h); }); NP.walls(c); NP.props(c); } catch(e) {}
    c.fillStyle = "rgba(5,6,10,.8)"; AREAS.forEach(a => { if (!areas().includes(a)) c.fillRect(a.x - 14, a.y - 14, a.w + 28, a.h + 28); });
    MC.cv = cv; MC.s = S; MC.n++; MC.at = now(); return MC;
  }
  const SPR = {};
  const sprite = (k, w, h, fn) => { if (SPR[k]) return SPR[k]; const cv = document.createElement("canvas"); cv.width = w; cv.height = h; fn(cv.getContext("2d")); return SPR[k] = cv; };
  const emo = (e, px) => sprite("e" + e + px, px * 2, px * 2, c => { c.font = `${px * 1.5}px system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(e, px, px * 1.08); });
  const emoAt = (c, e, x, y, px) => c.drawImage(emo(e, px >= 40 ? 64 : 32), x - px / 2, y - px / 2, px, px);
  const cubeSpr = () => sprite("cube", 64, 64, c => { const g = c.createLinearGradient(0, 4, 0, 60); g.addColorStop(0, "#C9F57E"); g.addColorStop(1, "#4E9E26"); c.fillStyle = g; c.beginPath(); if (c.roundRect) c.roundRect(6, 6, 52, 52, 12); else c.rect(6, 6, 52, 52); c.fill();
    c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 3; c.stroke(); c.fillStyle = "#fff"; c.beginPath(); c.moveTo(36, 12); c.lineTo(20, 36); c.lineTo(31, 36); c.lineTo(27, 53); c.lineTo(45, 27); c.lineTo(34, 27); c.closePath(); c.fill(); });
  const fireSpr = () => sprite("fire", 64, 64, c => { const g = c.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, "rgba(255,220,120,1)"); g.addColorStop(.5, "rgba(255,120,40,.8)"); g.addColorStop(1, "rgba(255,80,30,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
  const fireBlob = (c, x, y, r, a) => { if (a <= 0) return; c.globalAlpha = Math.min(1, a); c.drawImage(fireSpr(), x - r, y - r * .62, r * 2, r * 1.24); c.globalAlpha = 1; };
  /* one picture per fog patch: soft grey-green puffs */
  function fogSpr(i){ const key = "fog" + LAY.id + i; return SPR[key] || (SPR[key] = (() => {
    const P = FOG[i], x0 = Math.min(...P.map(c => c[0] - c[2])) - 24, y0 = Math.min(...P.map(c => c[1] - c[2])) - 34, x1 = Math.max(...P.map(c => c[0] + c[2])) + 24, y1 = Math.max(...P.map(c => c[1] + c[2])) + 14, S = 1.5;
    const cv = document.createElement("canvas"); cv.width = Math.ceil((x1 - x0) * S); cv.height = Math.ceil((y1 - y0) * S); const c = cv.getContext("2d"), R = rngOf(i * 977 + 13 + LAY.id.length * 31); c.scale(S, S); c.translate(-x0, -y0);
    P.forEach(([x, y, r]) => { const g = c.createRadialGradient(x, y, r * .2, x, y, r + 16); g.addColorStop(0, "rgba(120,150,140,.92)"); g.addColorStop(.75, "rgba(110,140,130,.82)"); g.addColorStop(1, "rgba(100,130,120,0)"); c.fillStyle = g; c.beginPath(); c.arc(x, y, r + 16, 0, 7); c.fill(); });
    P.forEach(([x, y, r]) => { for (let k = 0; k < 7; k++){ const an = R() * 7, rr = R() * r * .8, px = x + Math.cos(an) * rr, py = y + Math.sin(an) * rr * .8 - 10, pr = 14 + R() * 18, g = c.createRadialGradient(px, py - pr * .3, 2, px, py, pr);
      g.addColorStop(0, "rgba(190,215,205,.55)"); g.addColorStop(1, "rgba(160,190,180,0)"); c.fillStyle = g; c.beginPath(); c.arc(px, py, pr, 0, 7); c.fill(); } });
    return {cv, x0, y0, w: x1 - x0, h: y1 - y0}; })()); }
  /* people: the avatar as a bitmap, the name as a bitmap */
  const BMP = {}, TAG = {};
  function body(p){ const im = N().avImg(p.id, p.av), k = im.src.length + ":" + im.src.slice(-40), b = BMP[p.id]; if (b && b.k === k) return b.cv; if (!(im.complete && im.naturalWidth)) return b ? b.cv : null;
    const cv = document.createElement("canvas"); cv.width = 150; cv.height = 192; try { cv.getContext("2d").drawImage(im, 0, 0, 150, 192); } catch(e) { return null; } BMP[p.id] = {k, cv}; return cv; }
  function tag(p, self){ const k = p.id + "|" + p.name + "|" + (self ? 1 : 0); if (TAG[k]) return TAG[k]; const cv = document.createElement("canvas"), c = cv.getContext("2d"), f = "800 30px Figtree,system-ui,sans-serif"; c.font = f; const w = Math.ceil(c.measureText(p.name).width) + 24;
    cv.width = w; cv.height = 40; c.font = f; c.fillStyle = self ? "rgba(79,122,42,.9)" : "rgba(20,19,17,.72)"; rr(c, 0, 0, w, 40, 20); c.fill(); c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(p.name, w / 2, 21); return TAG[k] = {cv, w: w / 2, h: 20}; }
  function fig(c, x, y, p, o){
    const h = 118, w = h * 200 / 256, bob = o.mv ? Math.sin(now() / 90 + (p.id.charCodeAt(1) || 0)) * 3 : 0, cv = body(p);
    c.fillStyle = "rgba(0,0,0,.32)"; c.beginPath(); c.ellipse(x, y + 16, 26, 8, 0, 0, 7); c.fill();
    if (o.mate){ c.strokeStyle = "rgba(79,163,255,.9)"; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y + 16, 30, 10, 0, 0, 7); c.stroke(); }
    else if (o.me){ c.strokeStyle = "rgba(143,196,88,.85)"; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y + 16, 30, 10, 0, 0, 7); c.stroke(); }
    else { c.strokeStyle = "rgba(233,87,63,.75)"; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y + 16, 30, 10, 0, 0, 7); c.stroke(); }
    if (cv){ if (o.f < 0){ c.save(); c.translate(x, 0); c.scale(-1, 1); c.drawImage(cv, -w / 2, y - h + 18 + bob, w, h); c.restore(); } else c.drawImage(cv, x - w / 2, y - h + 18 + bob, w, h); }
    else { c.fillStyle = "#BAB5AC"; c.beginPath(); c.arc(x, y - 30, 26, 0, 7); c.fill(); }
    if (o.flash){ c.globalAlpha = .5; c.fillStyle = "#fff"; c.beginPath(); c.ellipse(x, y - 40, 34, 58, 0, 0, 7); c.fill(); c.globalAlpha = 1; }
    const tg = tag(p, o.me); c.drawImage(tg.cv, x - tg.w / 2, y + 26, tg.w, tg.h);
  }
  const NUMF = "900 14px Figtree, system-ui, sans-serif";
  function render(){
    const NP = NPo(), c = NP.ctx, cv = NP.cv; if (!c || !C.A) return; const d = NP.dpr, A = C.A, cw = cv.width, ch = cv.height, t = now();
    let cam = C.me && alive(me()) ? C.me : null;
    if (!cam){ const k = (A.feed || []).slice().reverse().find(f => f[1] === me()), fol = A.team ? A.ids.find(id => alive(id) && mate(id, me())) || (k && k[0] && alive(k[0]) ? k[0] : null) : k && k[0] && alive(k[0]) ? k[0] : A.ids.filter(alive).sort((a, b) => (A.hp[b] || 0) - (A.hp[a] || 0))[0]; cam = (fol && pos(fol)) || C.me || GC; }
    const spec = !(C.me && alive(me())), z = Math.min(Math.sqrt(cw * ch / 1.11e6), ch / 680, 1.05 * d) * (spec ? .84 : 1), sh = C.shake > .5 ? C.shake * d : 0;
    const ox = cw / 2 - cam.x * z + (Math.random() - .5) * sh, oy = ch / 2 - (cam.y - 40) * z + (Math.random() - .5) * sh;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = "#0B0C12"; c.fillRect(0, 0, cw, ch);
    const M = mapCache(z); c.setTransform(z, 0, 0, z, ox, oy); c.imageSmoothingEnabled = true;
    { const vx0 = Math.max(M.x0, -ox / z), vy0 = Math.max(M.y0, -oy / z), vx1 = Math.min(M.x0 + M.w, (cw - ox) / z), vy1 = Math.min(M.y0 + M.h, (ch - oy) / z);
      if (vx1 > vx0 && vy1 > vy0) c.drawImage(M.cv, (vx0 - M.x0) * M.s, (vy0 - M.y0) * M.s, (vx1 - vx0) * M.s, (vy1 - vy0) * M.s, vx0, vy0, vx1 - vx0, vy1 - vy0); }
    const pulse = (Math.sin(t / 200) + 1) / 2; c.fillStyle = `rgba(226,82,62,${.55 + pulse * .35})`; bars().forEach(o => { const vert = o.x2 - o.x1 < o.y2 - o.y1; if (vert) c.fillRect((o.x1 + o.x2) / 2 - 5, o.y1, 10, o.y2 - o.y1); else c.fillRect(o.x1, (o.y1 + o.y2) / 2 - 5, o.x2 - o.x1, 10); });
    /* fire on the floor */
    C.fields.forEach(f => { const k = Math.min(1, (f.until - t) / 600); fireBlob(c, f.x, f.y, f.r, .6 * k); });
    C.trail.forEach(p => { const k = 1 - (t - p.t) / 1800; fireBlob(c, p.x, p.y, 26, .55 * k); });
    /* energy cubes */
    C.cubes.forEach(cb => { const bob = Math.sin(t / 260 + cb.k) * 4, s2 = 30 + Math.min(4, cb.n - 1) * 3; c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.ellipse(cb.x, cb.y + 10, s2 * .55, 7, 0, 0, 7); c.fill(); c.drawImage(cubeSpr(), cb.x - s2 / 2, cb.y - s2 - 6 + bob, s2, s2);
      if (cb.n > 1){ if (c.font !== NUMF) c.font = NUMF; c.textAlign = "center"; c.fillStyle = "#fff"; c.fillText("×" + cb.n, cb.x, cb.y - s2 - 12 + bob); } });
    /* the gas closing in */
    if (A.ph === "fight"){ const gr = gasR(t - C.fightT0); if (gr < 2000){ c.save(); c.beginPath(); c.rect(MC.x0, MC.y0, MC.w, MC.h); c.arc(GC.x, GC.y, gr, 0, Math.PI * 2, true); c.fillStyle = `rgba(88,200,92,${.26 + pulse * .08})`; c.fill("evenodd"); c.strokeStyle = "rgba(150,240,130,.85)"; c.lineWidth = 6; c.setLineDash([22, 14]); c.lineDashOffset = -t / 40; c.beginPath(); c.arc(GC.x, GC.y, gr, 0, Math.PI * 2); c.stroke(); c.restore(); } }
    /* aiming: where the shot will go */
    const aimP = C.supP && C.supP.man ? C.supP : C.aimP && C.aimP.man ? C.aimP : null;
    if (fighting() && aimP){ const cl = CLS[C.cls], su = aimP === C.supP, s2 = su ? Object.assign({}, cl, cl.su) : cl, a = C.me.a, x = C.me.x, y = C.me.y - 30; c.save(); c.globalAlpha = .32; c.fillStyle = su ? "#FFD15C" : "#fff"; c.strokeStyle = c.fillStyle;
      if (su && C.cls === "fire"){ c.beginPath(); c.arc(C.me.x, C.me.y, s2.rg, 0, 7); c.fill(); }
      else if (cl.lob){ const dd = throwDist(cl, su, Math.hypot(aimP.dx, aimP.dy)), lx = C.me.x + Math.cos(a) * dd, ly = C.me.y + Math.sin(a) * dd, sp2 = su ? cl.su.splash : cl.splash; c.lineWidth = 4; c.setLineDash([10, 8]); c.beginPath(); c.moveTo(C.me.x, C.me.y - 30); c.quadraticCurveTo((C.me.x + lx) / 2, (C.me.y + ly) / 2 - 140, lx, ly); c.stroke(); c.setLineDash([]); c.beginPath(); c.ellipse(lx, ly, sp2, sp2 * .62, 0, 0, 7); c.fill(); }
      else if (s2.cone || (s2.n || 1) > 1){ const w = s2.cone || s2.spr * ((s2.n || 1) / 2 + .4); c.beginPath(); c.moveTo(x, y); c.arc(x, y, s2.rg, a - w, a + w); c.closePath(); c.fill(); }
      else { c.lineWidth = (s2.r || 10) * 2.4; c.lineCap = "round"; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * s2.rg, y + Math.sin(a) * s2.rg); c.stroke(); if (cl.splash){ c.beginPath(); c.arc(x + Math.cos(a) * s2.rg, y + Math.sin(a) * s2.rg, cl.splash, 0, 7); c.fill(); } } c.restore(); }
    if (C.autoLine && t - C.autoLine.t < 200 && C.me){ c.strokeStyle = "rgba(255,255,255,.5)"; c.lineWidth = 3; c.setLineDash([8, 8]); c.beginPath(); c.moveTo(C.me.x, C.me.y - 30); c.lineTo(C.autoLine.x, C.autoLine.y - 30); c.stroke(); c.setLineDash([]); }
    /* people */
    const P = NP.pl(), myFog = C.me && alive(me()) ? fogAt(C.me.x, C.me.y) : -1;
    const list = A.ids.filter(id => (A.ph !== "fight" || alive(id) || (C.hitAt[id] && t - C.hitAt[id] < 400)) && visible(id)).map(id => { const q = pos(id), p = C.AP[id], b = isHost() && HB.bots[id];
      return q && {id, x: q.x, y: q.y, f: id === me() && C.me ? C.me.f : b ? b.f : p ? p.f : 1, mv: id === me() && C.me ? C.me.mv : b ? b.mv : p ? p.mv : 0}; }).filter(Boolean).sort((a, b) => a.y - b.y);
    list.forEach(q => { const id = q.id, p = P.find(x => x.id === id) || {id, name: "?"}, self = id === me(), out = A.out.includes(id), inF = fogAt(q.x, q.y) >= 0;
      c.globalAlpha = out ? .4 : inF ? .62 : 1;
      fig(c, q.x, q.y, p, {f: q.f, mv: q.mv, me: self, mate: mate(id, me()), flash: C.hitAt[id] && t - C.hitAt[id] < 110});
      c.globalAlpha = 1;
      if ((self && C.burn > t) || (HB.dot[id] && HB.dot[id].burn > t)) emoAt(c, "🔥", q.x + Math.sin(t / 90) * 6, q.y - 74, 30);
      const em = C.emo[id]; if (em && t - em.t < 2200){ const k = Math.min(1, (t - em.t) / 160), yy = q.y - 172 - (1 - k) * 12; c.globalAlpha = t - em.t > 1900 ? (2200 - (t - em.t)) / 300 : 1; c.fillStyle = "#fff"; rr(c, q.x - 26, yy - 26, 52, 46, 14); c.fill(); c.beginPath(); c.moveTo(q.x - 7, yy + 19); c.lineTo(q.x, yy + 28); c.lineTo(q.x + 7, yy + 19); c.fill();
        if (em.e === "GG"){ c.fillStyle = "#1b1a18"; c.font = "900 22px Figtree,system-ui,sans-serif"; c.textAlign = "center"; c.fillText("GG", q.x, yy + 6); c.font = NUMF; } else emoAt(c, em.e, q.x, yy - 3, 32); c.globalAlpha = 1; }
      if (A.ph === "fight" && !out){ const hp = A.hp[id] || 0, mx = A.mx[id] || 1, w = 74, y = q.y - 124, f = Math.max(0, Math.min(1, hp / mx)); c.fillStyle = "rgba(10,10,14,.85)"; rr(c, q.x - w / 2 - 3, y - 3, w + 6, self ? 26 : 16, 6); c.fill();
        c.fillStyle = self ? "#7FD04A" : mate(id, me()) ? "#4FA3FF" : "#E9573F"; rr(c, q.x - w / 2, y, w * f, 10, 5); c.fill(); if (c.font !== NUMF) c.font = NUMF; c.textAlign = "center"; c.fillStyle = "#fff"; c.fillText(Math.ceil(hp), q.x, y - 6);
        const ce = CLS[A.cls[id]]; if (ce) emoAt(c, ce.e, q.x - w / 2 - 15, y + 5, 20);
        const pw = C.pw[id] || 0; if (pw){ c.drawImage(cubeSpr(), q.x + w / 2 + 6, y - 6, 18, 18); c.textAlign = "left"; c.fillStyle = "#B8F07A"; c.fillText(pw, q.x + w / 2 + 26, y + 8); c.textAlign = "center"; }
        /* my reload bar right under my health, like in Brawl Stars */
        if (self){ const sw = (w - 4) / AMMO; for (let i = 0; i < AMMO; i++){ const f2 = i < C.am ? 1 : i === C.am ? Math.min(1, C.rl / CLS[C.cls].rl) : 0; c.fillStyle = "rgba(255,255,255,.14)"; c.fillRect(q.x - w / 2 + i * (sw + 2), y + 13, sw, 7); if (f2 > 0){ c.fillStyle = f2 >= 1 ? "#F2A33A" : "#9b6a2a"; c.fillRect(q.x - w / 2 + i * (sw + 2), y + 13, sw * f2, 7); } }
          if (C.sup >= 1) emoAt(c, CLS[C.cls].su.e, q.x - w / 2 - 15, y + 26, 22); } } });
    /* bullets and bangs */
    C.proj.forEach(p => { const y = p.y - 34;
      if (p.lob){ const k = Math.min(1, (t - p.t) / p.dur), hgt = Math.sin(k * Math.PI) * (120 + Math.hypot(p.x1 - p.x0, p.y1 - p.y0) * .25), rr2 = p.su ? CLS.bomb.su.splash : CLS.bomb.splash;
        c.strokeStyle = `rgba(255,90,60,${.35 + k * .4})`; c.lineWidth = 3; c.setLineDash([8, 7]); c.beginPath(); c.ellipse(p.x1, p.y1, rr2, rr2 * .62, 0, 0, 7); c.stroke(); c.setLineDash([]);
        c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.ellipse(p.x, p.y, 12, 5, 0, 0, 7); c.fill(); emoAt(c, p.su ? "☄️" : "🧨", p.x, p.y - 30 - hgt, p.su ? 44 : 32); return; }
      if (p.c === "rock"){ c.save(); c.translate(p.x, y); c.rotate(Math.atan2(p.vy, p.vx)); c.fillStyle = "rgba(200,200,200,.35)"; for (let i = 1; i < 5; i++){ c.beginPath(); c.arc(-i * 12, Math.sin(t / 40 + i) * 3, 5 + i, 0, 7); c.fill(); } c.fillStyle = "#E9573F"; rr(c, -14, -7, 28, 14, 7); c.fill(); c.fillStyle = "#FFD15C"; c.beginPath(); c.arc(-16, 0, 5, 0, 7); c.fill(); c.restore(); }
      else if (p.c === "snipe"){ c.strokeStyle = p.su ? "#FFD15C" : "#fff"; c.lineWidth = p.su ? 8 : 4; c.beginPath(); c.moveTo(p.x - p.vx * .025, y - p.vy * .025); c.lineTo(p.x, y); c.stroke(); }
      else { c.fillStyle = p.su ? "#FF9A3C" : "#FFD15C"; c.beginPath(); c.arc(p.x, y, p.su ? 8 : 7, 0, 7); c.fill(); c.fillStyle = "rgba(255,209,92,.35)"; c.beginPath(); c.arc(p.x - p.vx * .012, y - p.vy * .012, 5, 0, 7); c.fill(); } });
    C.fx.forEach(f => { const k = (t - f.t) / 700;
      if (f.k === "boom"){ const r = (20 + k * 90) * (f.big ? 1.5 : 1); c.fillStyle = `rgba(255,170,60,${Math.max(0, .7 * (1 - k))})`; c.beginPath(); c.arc(f.x, f.y - 20, r, 0, 7); c.fill(); if (k < .5){ c.fillStyle = `rgba(255,240,180,${.8 * (1 - k * 2)})`; c.beginPath(); c.arc(f.x, f.y - 20, r * .5, 0, 7); c.fill(); } }
      else if (f.k === "spark"){ if (k < .5){ c.fillStyle = f.hit ? `rgba(255,255,255,${1 - k * 2})` : `rgba(255,209,92,${1 - k * 2})`; for (let i = 0; i < 5; i++){ const an = i * 1.3 + f.t, r = k * 40; c.beginPath(); c.arc(f.x + Math.cos(an) * r, f.y - 34 + Math.sin(an) * r, 3, 0, 7); c.fill(); } } }
      else if (f.k === "flash"){ if (k < .15){ c.fillStyle = "rgba(255,230,150,.9)"; c.beginPath(); c.arc(f.x, f.y - 34, 14, 0, 7); c.fill(); } }
      else if (f.k === "sup"){ if (k < .6){ c.strokeStyle = `rgba(255,209,92,${.9 * (1 - k / .6)})`; c.lineWidth = 8; c.beginPath(); c.arc(f.x, f.y - 30, 30 + k * 80, 0, 7); c.stroke(); } }
      else if (f.k === "ring"){ if (k < .7){ const kk = k / .7; c.strokeStyle = `rgba(255,120,40,${.85 * (1 - kk)})`; c.lineWidth = 26 * (1 - kk) + 4; c.beginPath(); c.ellipse(f.x, f.y, f.rg * (.3 + kk * .7), f.rg * (.3 + kk * .7) * .7, 0, 0, 7); c.stroke(); } }
      else if (f.k === "land"){ if (k < .5){ const kk = k / .5; c.strokeStyle = `rgba(255,255,255,${.8 * (1 - kk)})`; c.lineWidth = 6; c.beginPath(); c.ellipse(f.x, f.y + 10, 30 + kk * 70, (30 + kk * 70) * .4, 0, 0, 7); c.stroke(); } }
      else if (f.k === "swipe"){ if (k < .45){ const kk = k / .45; c.strokeStyle = `rgba(255,255,255,${.85 * (1 - kk)})`; c.lineWidth = 12; c.lineCap = "round"; c.beginPath(); c.arc(f.x, f.y - 34, f.rg * .8, f.a - f.cone + kk * .3, f.a + f.cone * (kk * 2 - 1)); c.stroke(); } }
      else if (f.k === "flame"){ if (k < .5){ const kk = k / .5; for (let i = 0; i < 12; i++){ const an = f.a + (((i * 7919) % 100) / 100 - .5) * f.cone * 1.8, r = f.rg * (.25 + .75 * ((i * 37 % 100) / 100)) * Math.min(1, kk * 2.2); fireBlob(c, f.x + Math.cos(an) * r, f.y - 34 + Math.sin(an) * r, 14 + kk * 14, .9 * (1 - kk)); } } }
      else if (f.k === "cube"){ if (k < .6){ const kk = k / .6; c.strokeStyle = `rgba(184,240,122,${.9 * (1 - kk)})`; c.lineWidth = 5; c.beginPath(); c.ellipse(f.x, f.y + 10, 24 + kk * 50, (24 + kk * 50) * .4, 0, 0, 7); c.stroke(); } }
      else if (f.k === "ko"){ c.globalAlpha = Math.max(0, 1 - k); emoAt(c, "💀", f.x, f.y - 92 - k * 40, 44 + k * 30); c.globalAlpha = 1; } });
    /* the fog on top: whoever is inside is hidden; mine turns see-through */
    if (!SPR.clip){ SPR.clip = new Path2D(); areas().forEach(a => SPR.clip.rect(a.x, a.y, a.w, a.h)); } c.save(); c.clip(SPR.clip);
    for (let i = 0; i < FOG.length; i++){ const F = fogSpr(i); c.globalAlpha = i === myFog ? .38 : .93 + Math.sin(t / 900 + i) * .05; c.drawImage(F.cv, F.x0, F.y0 + Math.sin(t / 1300 + i * 2) * 2, F.w, F.h); } c.globalAlpha = 1; c.restore();
    C.pops.forEach(p => { const k = (t - p.t) / 900; c.globalAlpha = Math.max(0, 1 - k); c.font = `900 ${p.mine ? 26 : 22}px Figtree,system-ui,sans-serif`; c.textAlign = "center"; c.lineWidth = 4; c.strokeStyle = "rgba(0,0,0,.6)"; c.strokeText(p.txt, p.x, p.y - k * 40); c.fillStyle = p.me ? "#ff6a55" : p.mine ? "#FFD15C" : "#fff"; c.fillText(p.txt, p.x, p.y - k * 40); c.globalAlpha = 1; });
    c.setTransform(1, 0, 0, 1, 0, 0);
    /* inside the fog you see little: darkness around a small circle */
    if (myFog >= 0){ const sx = C.me.x * z + ox, sy = (C.me.y - 40) * z + oy, g = c.createRadialGradient(sx, sy, VIS * z * .7, sx, sy, VIS * z * 1.25); g.addColorStop(0, "rgba(8,12,14,0)"); g.addColorStop(1, "rgba(8,12,14,.8)"); c.fillStyle = g; c.fillRect(0, 0, cw, ch); }
    /* the screen goes red when you're hit or nearly dead */
    const hk = Math.max(0, 1 - (t - C.hurtT) / 400), low = fighting() && (A.hp[me()] || 0) / (A.mx[me()] || 1) < .3 ? .25 + pulse * .2 : 0, red = Math.max(hk * .5, low);
    if (red > 0){ const g = c.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * .3, cw / 2, ch / 2, Math.max(cw, ch) * .7); g.addColorStop(0, "rgba(200,30,20,0)"); g.addColorStop(1, `rgba(200,30,20,${red})`); c.fillStyle = g; c.fillRect(0, 0, cw, ch); }
  }
  const rr = (c, x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, Math.max(0, w), h, r); else c.rect(x, y, Math.max(0, w), h); };

  /* ---- the result at a Natposter meeting: places and, for the winner, the secret bonus ---- */
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

  /* ---------------- bonus effects in a Natposter round: the fire trail ---------------- */
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
  PG.arena = {CLS, PERKS, PICK, FIGHT, NEXT, LAYS, setLay, hostInit, hostTick, hostAct, hostView, applyPerk, client, fx: FX, stopHost};
  PG.onArena = m => onMsg(m);
  if (PG.ART) PG.ART.arena = ["⭐", "#E9A92B"];
  window.__ar = () => ({on: C.on, team: C.A && C.A.team, ph: C.A && C.A.ph, me: C.me && {x: Math.round(C.me.x), y: Math.round(C.me.y)}, hp: C.A && C.A.hp, out: C.A && C.A.out, cls: C.A && C.A.cls, am: C.am, sup: C.sup, proj: C.proj.length, bots: Object.keys(HB.bots).length, fog: C.me ? fogAt(C.me.x, C.me.y) : -1});
  window.__arFire = (a, su, len) => a == null ? autoFire(su) : fire(a, su, len);
  window.__arMove = (dx, dy) => { C.moveP = dx == null ? null : {dx, dy, id: -1}; };
  window.__arTo = (x, y) => { if (C.me){ C.me.x = x; C.me.y = y; } };
  window.__arSeen = id => { const q = pos(id); return q && {x: Math.round(q.x), y: Math.round(q.y), vis: visible(id)}; };
  window.__arSup = v => { C.sup = v; };
  window.__arBot = (id, x, y) => { const b = HB.bots[id]; if (b){ b.x = b.px = x; b.y = b.py = y; } };
  window.__arFreeze = v => { HB.freeze = !!v; };

  const css = document.createElement("style"); css.textContent = `
.np.arena .np-ov,.np.arena .np-bar,.np.arena .np-emob,.np.arena .np-emos,.np.arena .np-mapb,.np.arena .np-btns,.np.arena .np-tasks,.np.arena .np-tbar,.np.arena .np-alert,.np.arena .np-ev,.np.arena .np-joy,.np.arena .np-lob,.np.arena .np-panel:not(.on){display:none!important}
.np.arena .np-cv{filter:none!important}.np.arena .np-top{z-index:8}
.ar-l{position:absolute;inset:0;z-index:6;touch-action:none;-webkit-user-select:none;user-select:none}
.ar-hud{position:absolute;top:calc(var(--st,0px) + 12px);left:calc(50% + (var(--sl,0px) - var(--sr,0px)) / 2);transform:translateX(-50%);display:flex;gap:8px;pointer-events:none}
.ar-hud span{background:rgba(20,19,17,.8);border-radius:12px;padding:6px 12px;font:900 17px var(--display);color:#fff;white-space:nowrap}
.ar-hud .ar-rd{background:rgba(233,169,43,.92);color:#2a1d05}.ar-hud [hidden]{display:none}
.ar-hud .ar-gas{display:none;background:#2f7a33}.ar-hud .ar-gas.on{display:block;animation:arPulse 1s ease-in-out infinite}
@keyframes arPulse{50%{transform:scale(1.08)}}
.ar-feed{position:absolute;top:calc(var(--st,0px) + 62px);right:calc(var(--sr,0px) + 12px);display:flex;flex-direction:column;gap:4px;align-items:flex-end;pointer-events:none}
.ar-feed div{background:rgba(20,19,17,.72);border-radius:10px;padding:3px 9px;font:700 13px var(--body);color:#ddd}.ar-feed b{color:#fff}
.ar-ban{position:absolute;left:0;right:0;top:30%;text-align:center;pointer-events:none;font:900 56px var(--display);color:#fff;text-shadow:0 5px 0 rgba(0,0,0,.35);opacity:0;display:flex;flex-direction:column;align-items:center}
.ar-ban small{font:800 20px var(--body);opacity:.85;margin-top:4px}
.ar-ban.on{animation:arBan 1.8s ease-out forwards}.ar-ban.go{color:#9BE25A}.ar-ban.out{color:#ff7a66}.ar-ban.win{color:#FFD15C}
@keyframes arBan{0%{opacity:0;transform:scale(1.6)}12%{opacity:1;transform:scale(1)}75%{opacity:1}100%{opacity:0;transform:translateY(-20px)}}
.ar-pick{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(6,7,12,.82);padding:calc(var(--st,0px) + 10px) calc(var(--sr,0px) + 10px) calc(var(--sb,0px) + 10px) calc(var(--sl,0px) + 10px)}
.ar-pick.on{display:flex}
.ar-pt{font:900 24px var(--display);color:#fff}
.ar-cards{display:flex;gap:8px;justify-content:center;flex-wrap:nowrap;max-width:100%}
.ar-card{width:min(124px,14.8vw);min-width:0;flex:0 1 auto;padding:10px 6px 8px;border-radius:16px;background:var(--panel,#1e1d1b);border:3px solid rgba(255,255,255,.06);display:flex;flex-direction:column;align-items:center;gap:3px;color:#fff;font:800 14px var(--body);transition:transform .15s,border-color .15s}
.ar-card .e{font-size:38px;line-height:1.1}.ar-card small{color:var(--muted,#aaa);font-weight:700;font-size:11px;line-height:1.2;text-align:center;min-height:26px}
.ar-card em{font-style:normal;font-size:11px;font-weight:800;color:#FFD15C;text-align:center;line-height:1.15}
.ar-card .hp{font-style:normal;font-size:12px;color:#ff8a78}.ar-card .who{display:flex;gap:2px;min-height:24px}.ar-card .who .np-hd{width:24px;height:24px;overflow:hidden;border-radius:50%}.ar-card .who svg{width:100%;height:100%;display:block}
.ar-card.sel{border-color:var(--go-hi,#8FC458);transform:translateY(-5px);box-shadow:0 8px 24px rgba(127,178,74,.25)}
.ar-pbar{width:min(420px,70%);height:6px;background:rgba(255,255,255,.12);border-radius:3px;overflow:hidden}.ar-pbar i{display:block;height:100%;background:var(--go-hi,#8FC458);transition:width .12s linear}
.ar-joy{position:absolute;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;background:rgba(244,242,238,.08);border:2px solid rgba(244,242,238,.18);display:none;pointer-events:none}.ar-joy.on{display:block}
.ar-joy i{position:absolute;left:50%;top:50%;width:52px;height:52px;border-radius:50%;background:rgba(244,242,238,.35);transform:translate(-50%,-50%)}
.ar-fire{position:absolute;right:calc(var(--sr,0px) + 28px);bottom:calc(var(--sb,0px) + 34px);width:110px;height:110px;border-radius:50%;background:rgba(226,82,62,.16);border:3px solid rgba(226,82,62,.5);pointer-events:none;display:flex;align-items:center;justify-content:center}
.ar-fire.on{background:rgba(226,82,62,.26)}
.ar-fire b{width:60px;height:60px;border-radius:50%;background:rgba(226,82,62,.9);display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 4px 0 rgba(0,0,0,.3)}
.ar-am{position:absolute;bottom:-17px;display:flex;gap:4px}.ar-am i{width:26px;height:8px;border-radius:4px;background:rgba(255,255,255,.18);overflow:hidden;display:block}.ar-am u{display:block;height:100%;width:100%;transform:scaleX(0);transform-origin:left center;background:#9b6a2a;will-change:transform}.ar-am i.full u{background:#F2A33A}
.ar-sup{position:absolute;right:calc(var(--sr,0px) + 150px);bottom:calc(var(--sb,0px) + 26px);width:76px;height:76px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(20,19,17,.55);border:3px solid rgba(255,209,92,.25);touch-action:none}
.ar-sup b{width:52px;height:52px;border-radius:50%;background:rgba(120,110,90,.6);display:flex;align-items:center;justify-content:center;font-size:26px;filter:grayscale(.8);pointer-events:none;transition:transform .12s}
.ar-sup svg{position:absolute;inset:-3px;width:calc(100% + 6px);height:calc(100% + 6px);transform:rotate(-90deg);pointer-events:none}.ar-sup circle{fill:none;stroke:#FFD15C;stroke-width:7;stroke-dasharray:289;stroke-dashoffset:289;stroke-linecap:round;transition:stroke-dashoffset .2s}
.ar-sup.ready{border-color:#FFD15C;animation:arSup 1s ease-in-out infinite}.ar-sup.ready b{background:#E9A92B;filter:none;box-shadow:0 4px 0 rgba(0,0,0,.3)}.ar-sup.on b{transform:scale(1.12)}
@keyframes arSup{50%{box-shadow:0 0 22px 4px rgba(255,209,92,.55)}}
.ar-tip{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .4s}.ar-tip.on{opacity:1}
.ar-tip span{position:absolute;background:rgba(255,255,255,.94);color:#1b1a18;font:800 13px var(--body);padding:6px 10px;border-radius:11px;white-space:nowrap;line-height:1.2;box-shadow:0 6px 18px rgba(0,0,0,.35)}
.ar-tip .t-mv{left:calc(var(--sl,0px) + 24px);bottom:calc(var(--sb,0px) + 120px)}
.ar-tip .t-fire{right:calc(var(--sr,0px) + 18px);bottom:calc(var(--sb,0px) + 156px)}
.ar-tip .t-sup{right:calc(var(--sr,0px) + 120px);bottom:calc(var(--sb,0px) + 112px);background:#FFD15C}
.ar-tip .t-fog{left:50%;top:calc(var(--st,0px) + 70px);transform:translateX(-50%);white-space:nowrap}
.ar-tip.on span{animation:arTip 1.4s ease-in-out infinite alternate}@keyframes arTip{to{translate:0 -5px}}
.ar-emb{position:absolute;top:calc(var(--st,0px) + 12px);right:calc(var(--sr,0px) + 12px);width:44px;height:44px;border-radius:14px;border:0;background:rgba(20,19,17,.8);font-size:24px;z-index:2}
.ar-emp{position:absolute;top:calc(var(--st,0px) + 62px);right:calc(var(--sr,0px) + 12px);display:none;grid-template-columns:repeat(4,46px);gap:6px;padding:8px;border-radius:16px;background:rgba(20,19,17,.92);z-index:3}.ar-emp.on{display:grid}
.ar-emp button{width:46px;height:46px;border-radius:12px;border:0;background:rgba(255,255,255,.08);font:900 22px var(--display);color:#fff}.ar-emp button:active{transform:scale(.92)}
.ar-feed{top:calc(var(--st,0px) + 64px)!important}
.ar-res{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(6,7,12,.72);padding:calc(var(--st,0px) + 12px) calc(var(--sr,0px) + 12px) calc(var(--sb,0px) + 12px) calc(var(--sl,0px) + 12px);z-index:3}
.ar-res.on{display:flex;animation:arIn .3s ease-out}@keyframes arIn{from{opacity:0;transform:scale(.96)}}
.ar-rbox{background:var(--panel,#1e1d1b);border-radius:20px;padding:14px 16px;width:min(440px,100%);max-height:100%;overflow:auto;color:#fff;display:flex;flex-direction:column;gap:10px;box-shadow:0 18px 50px rgba(0,0,0,.5)}
.ar-rt{font:900 20px var(--display);text-align:center}.ar-rt b{color:#FFD15C}
.ar-rl{display:flex;flex-direction:column;gap:4px}.ar-rl>div{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:12px;background:rgba(255,255,255,.04);font:800 15px var(--body)}
.ar-rl>div.me{background:rgba(127,178,74,.18)}.ar-rl .r{width:20px;text-align:center;color:var(--muted,#aaa)}.ar-rl b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ar-rl .w{color:#FFD15C}.ar-rl .k{color:#ff9a88;min-width:44px;text-align:right}
.ar-rl .np-hd{width:28px;height:28px;border-radius:50%;overflow:hidden;flex:none}.ar-rl .np-hd svg{width:100%;height:100%;display:block}
.ar-rn{text-align:center;font:800 15px var(--body);color:var(--muted,#aaa)}.ar-rn b{color:#fff;font-size:20px}
.ar-rb{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.ar-perk{margin:6px 0}.ar-pq{font:900 16px var(--body);margin:4px 0 8px}
.ar-pks{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.ar-pk{display:flex;align-items:center;gap:8px;text-align:left;padding:10px;border-radius:14px;background:rgba(255,255,255,.06);border:2px solid rgba(255,255,255,.08);color:#fff}
.ar-pk span{font-size:28px}.ar-pk b{display:block;font:900 14px var(--body)}.ar-pk small{display:block;color:var(--muted,#aaa);font-size:11px;line-height:1.25}
.ar-pk:active{transform:scale(.97)}.ar-pk.done{border-color:var(--go-hi,#8FC458);justify-content:center;max-width:360px;margin:0 auto}
.ar-rv{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}.ar-rv button{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px;border-radius:12px;background:rgba(255,255,255,.06);color:#fff;border:2px solid rgba(255,255,255,.08)}
.ar-rbox:has(.two){width:min(660px,100%)}.ar-rl.two{display:grid;grid-template-columns:1fr 1fr;gap:4px 8px}
.np.arena .ar-l:has(.ar-res.on) .ar-feed{display:none}
.np.rot .ar-card{width:min(124px,14.8vh)}.ar-card b,.ar-card em{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (max-width:420px){.np.rot .ar-card{padding:6px 4px}.np.rot .ar-card .e{font-size:30px}.np.rot .ar-card small{display:none}.np.rot .ar-pt{font-size:20px}.np.rot .ar-card b{font-size:13px}}
@media (max-height:400px){.ar-fire{width:92px;height:92px;right:calc(var(--sr,0px) + 20px);bottom:calc(var(--sb,0px) + 28px)}.ar-fire b{width:50px;height:50px;font-size:24px}.ar-sup{width:64px;height:64px;right:calc(var(--sr,0px) + 124px);bottom:calc(var(--sb,0px) + 20px)}.ar-sup b{width:44px;height:44px;font-size:22px}
  .ar-tip span{font-size:12px;padding:5px 8px}.ar-tip .t-fire{bottom:calc(var(--sb,0px) + 132px)}.ar-tip .t-sup{right:calc(var(--sr,0px) + 100px);bottom:calc(var(--sb,0px) + 92px)}.ar-hud span{font-size:15px;padding:5px 10px}}
@media (max-height:420px){.ar-card{padding:6px 4px}.ar-card .e{font-size:30px}.ar-card small{display:none}.ar-card b{font-size:13px}.ar-pt{font-size:20px}.ar-pk{padding:7px 8px}.ar-pk span{font-size:24px}.ar-pq{margin:2px 0 6px}.ar-rbox{padding:10px 12px;gap:6px}.ar-rl>div{padding:3px 8px}}
.np-duel:has(.ar-pks) .du-rank>div:nth-child(n+4),.np-duel:has(.ar-rv) .du-rank>div:nth-child(n+4){display:none}
`; document.head.appendChild(css);
})();
