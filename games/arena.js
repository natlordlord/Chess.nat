/* ===== Nat Stars: a Brawl-Stars-style showdown on its own big meadow.
   Grass, stone walls, ponds, bushes to hide in and crates full of power cubes: shoot a crate open, grab the green cube,
   get more health and more damage. The gas closes in slowly, the last one standing wins.
   It runs on its own (round after round) and as the minigame at a Natposter meeting (the winner picks a secret bonus).
   Network: every phone moves itself ("am") and says when it shoots ("as"). Whoever fired decides what the shot hit
   and says so ("ah" for people, "ach" for crates; the host does it for the bots). The gas where you stand you report yourself.
   The host keeps the health ("ahp"), the crates ("acr"), the cubes ("acu"), runs the bots ("amb") and decides who is out. ===== */
(() => {
  const {T} = PG, now = () => Date.now(), N = () => PG.npx;
  const PICK = 6500, PICK2 = 4200, FIGHT = 150000, PERK = 7000, BAN = 2600, NEXT = BAN + 6500, BODY = 26, SPD = 255;
  const TS = 64, MW = 44, MH = 44, WW = MW * TS, WH = MH * TS, GC = {x: WW / 2, y: WH / 2};
  const LAG = 110, SEE = 170, SMALLB = 12, REVEAL = 1000, AMMO = 3, CHG = 1100, CRATE = 72;
  /* the gas: on its own a round is long and the gas slow; a meeting fight is short and starts closer together */
  const gasPlan = (arena, n) => arena ? {a: 28000, b: 128000, r0: Math.min(2000, Math.max(1350, 1150 + 95 * n)), r1: 190, fl: FIGHT} : {a: 14000, b: 50000, r0: Math.min(1250, 760 + 50 * n), r1: 150, fl: 60000};
  let GZ = gasPlan(true, 6);
  const CLS = {
    shot: {c: "#E9573F", en: "Shotgun", de: "Schrotflinte", sen: "Close · 5 pellets", sde: "Nah · 5 Kugeln", hp: 170, sp: 1, rl: 1450, cd: 380, rg: 330, n: 5, spr: .12, v: 1050, dmg: 12, r: 7, sc: 130,
      su: {en: "Big bang", de: "Großer Knall", n: 9, spr: .085, v: 1150, dmg: 14, rg: 380, kb: 90}},
    bomb: {c: "#F2A33A", en: "Bomber", de: "Bomber", sen: "Throws over walls", sde: "Wirft über Wände", hp: 125, sp: 1, rl: 1700, cd: 480, rg: 440, lob: 680, dmg: 32, splash: 66, sc: 110,
      su: {en: "Mega bomb", de: "Megabombe", dmg: 48, splash: 120, kb: 80, rg: 470}},
    snipe: {c: "#4FA3FF", en: "Sniper", de: "Scharfschütze", sen: "Hold to charge · hits hard", sde: "Halten = aufladen · trifft hart", hp: 110, sp: .95, rl: 1900, cd: 450, rg: 820, n: 1, v: 1500, dmg: 18, chg: 66, r: 6, sc: 120,
      su: {en: "Piercer", de: "Durchschuss", v: 2400, rg: 1000, dmg: 78, r: 10}},
    punch: {c: "#B65CE0", en: "Boxer", de: "Boxer", sen: "Punches · very close", sde: "Schlägt · ganz nah", hp: 270, sp: 1.12, rl: 850, cd: 330, rg: 100, cone: .62, dmg: 22, jabs: 3, sc: 120,
      su: {en: "Body slam", de: "Sprungschlag", at: 1, rg: 340, dmg: 55, splash: 115, kb: 95, dur: 520}},
    gun: {c: "#2FB39A", en: "Revolver", de: "Revolver", sen: "6 shots in a row · far", sde: "6 Schüsse am Stück · weit", hp: 135, sp: 1, rl: 1600, cd: 480, rg: 640, n: 6, gap: 65, v: 1350, dmg: 10, r: 6, sc: 140,
      su: {en: "Bullet storm", de: "Kugelhagel", n: 12, gap: 55, v: 1500, rg: 760, dmg: 13}},
    rang: {c: "#7FB84A", en: "Boomerang", de: "Bumerang", sen: "Through crates & enemies · back again", sde: "Durch Kisten & Gegner · und zurück", hp: 150, sp: 1.02, rl: 1500, cd: 450, rg: 470, v: 900, dmg: 24, r: 15, sc: 120,
      su: {en: "Triple", de: "Dreifach", n: 3, spr: .32, dmg: 28, rg: 520}},
    zap: {off: 1, c: "#E0B321", en: "Lightning", de: "Blitz", sen: "Jumps to 3 enemies", sde: "Springt auf 3 Gegner", hp: 130, sp: 1, rl: 1650, cd: 450, rg: 440, dmg: 30, jump: 210, chain: [30, 22, 16], sc: 115,
      su: {en: "Thunderstorm", de: "Gewitter", at: 1, rg: 520, splash: 140, dmg: 20, hits: 5, every: 420}}};
  /* the lightning stays in the code (old rounds) but is no longer offered */
  const KEYS = Object.keys(CLS).filter(k => !CLS[k].off);
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

  /* ---------------- the fighters' pictures: one white weapon on a coloured tile, drawn as SVG (cards, buttons) and as bitmaps (the arena) ---------------- */
  const OUT = 'stroke="#1d1b18" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke"';
  const GLY = {
    shot: `<g transform="rotate(-24 32 32)" fill="#fff" ${OUT}><path d="M2 30L17 26l2 11-14 5z"/><rect x="16" y="25" width="19" height="11" rx="2"/><rect x="32" y="25" width="29" height="6" rx="2"/><rect x="36" y="32" width="17" height="6" rx="3"/><path d="M21 35h7l-3 11h-7z"/></g>`,
    bomb: `<g fill="#fff" ${OUT}><path d="M29 20c-1-9 7-14 16-11l-1 4c-7-2-11 1-11 7z"/><rect x="21" y="18" width="14" height="9" rx="2"/><circle cx="28" cy="41" r="18"/></g><path d="M19 37a10 10 0 0 1 7-7" fill="none" stroke="#1d1b18" stroke-opacity=".3" stroke-width="3.5" stroke-linecap="round"/><path d="M49 1l2.6 6.4L58 10l-6.4 2.6L49 19l-2.6-6.4L40 10l6.4-2.6z" fill="#FFD15C" ${OUT}/>`,
    snipe: `<g fill="none" stroke-linecap="round"><g stroke="#1d1b18" stroke-width="11"><circle cx="32" cy="32" r="18"/><path d="M32 5v13M32 46v13M5 32h13M46 32h13"/></g><g stroke="#fff" stroke-width="5.5"><circle cx="32" cy="32" r="18"/><path d="M32 5v13M32 46v13M5 32h13M46 32h13"/></g></g><circle cx="32" cy="32" r="5" fill="#fff" ${OUT}/>`,
    punch: `<g fill="#fff" ${OUT}><rect x="17" y="46" width="28" height="13" rx="3"/><path d="M11 30c0-12 9-19 20-19h8c11 0 18 8 18 19v5c0 8-6 13-14 13H27c-9 0-16-6-16-14z"/></g><path d="M18 34c7 3 14 2 19-4M17 52h28" fill="none" stroke="#1d1b18" stroke-width="3" stroke-linecap="round"/>`,
    gun: `<g transform="rotate(-14 32 32)" fill="#fff" ${OUT}><rect x="29" y="21" width="31" height="8" rx="2"/><path d="M12 33h12l-4 23H7z"/><path d="M11 18h21v15h-7l-3 4H11z"/><rect x="22" y="24" width="16" height="12" rx="4"/><path d="M8 13h7v7H8z"/></g>`,
    rang: `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19Q19 41 32 47Q45 41 55 19" stroke="#1d1b18" stroke-width="16"/><path d="M9 19Q19 41 32 47Q45 41 55 19" stroke="#fff" stroke-width="9.5"/></g>`,
    zap: `<path d="M38 3L13 36h15l-6 25 29-36H35l9-22z" fill="#fff" ${OUT}/>`};
  /* in the hand the sniper holds a rifle, not the crosshair */
  const HAND = {snipe: `<g transform="rotate(-8 32 32)" fill="#fff" ${OUT}><path d="M2 35l12-5 3 8-12 4z"/><rect x="13" y="29" width="16" height="8" rx="2"/><rect x="26" y="30" width="36" height="4" rx="2"/><rect x="16" y="21" width="17" height="6" rx="3"/><path d="M19 36h6l-2 9h-6z"/></g>`};
  const shade = (hx, f) => { const n = parseInt(hx.slice(1), 16), m = v => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f); return `rgb(${m(n >> 16)},${m(n >> 8 & 255)},${m(n & 255)})`; };
  let BID = 0;
  function badge(k, su){ const c = CLS[k]; if (!c) return ""; const col = su ? "#E9A92B" : c.c, id = "arg" + (++BID);
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="${id}" cx="30%" cy="22%" r="90%"><stop offset="0" stop-color="${shade(col, .38)}"/><stop offset=".6" stop-color="${col}"/><stop offset="1" stop-color="${shade(col, -.38)}"/></radialGradient></defs><rect x="1" y="1" width="62" height="62" rx="17" fill="url(#${id})"/><path d="M8 18c0-6 4-10 10-10h28c6 0 10 4 10 10v2C40 14 24 14 8 22z" fill="#fff" opacity=".2"/><g transform="translate(9 9) scale(.72)">${GLY[k]}</g></svg>`; }
  const glyph = k => GLY[k] ? `<svg viewBox="0 0 64 64" aria-hidden="true">${GLY[k]}</svg>` : "";
  const IMG = {};
  const svgImg = (key, svg) => { let im = IMG[key]; if (!im){ im = IMG[key] = new Image(); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" ')); } return im.complete && im.naturalWidth ? im : null; };
  const wpnImg = k => svgImg("w" + k, `<svg viewBox="0 0 64 64">${HAND[k] || GLY[k]}</svg>`), badImg = k => svgImg("b" + k, badge(k));

  /* ---------------- the maps: 44 × 44 tiles, mirrored four times like a Showdown map. Grass, walls, ponds, bushes, crates ---------------- */
  const LAYS = [
    {id: "wiese", en: "Meadow", de: "Wiese", seed: 11, wall: 6, water: 1, bush: 7, crate: 5},
    {id: "schlucht", en: "Canyon", de: "Schlucht", seed: 23, wall: 9, water: 0, bush: 5, crate: 5},
    {id: "teiche", en: "Ponds", de: "Teiche", seed: 37, wall: 4, water: 3, bush: 6, crate: 5},
    {id: "dschungel", en: "Jungle", de: "Dschungel", seed: 51, wall: 5, water: 1, bush: 11, crate: 5}];
  const MAPS = {};
  let LAY = null, MP = null, FOG = [];
  function genMap(L){
    const R = rngOf(L.seed * 7919 + 17), H = MW / 2, q = new Uint8Array(H * H), qc = new Uint8Array(H * H), ri = n => Math.floor(R() * n);
    const ok = (i, j) => i >= 0 && j >= 0 && i < H && j < H, used = (i, j) => ok(i, j) && !!(q[j * H + i] || qc[j * H + i]);
    const free = (i, j, w, h, m) => { if (i < 0 || j < 0 || i + w > H || j + h > H) return false; for (let y = j - m; y < j + h + m; y++) for (let x = i - m; x < i + w + m; x++) if (used(x, y)) return false; return true; };
    const set = (i, j, v) => { if (ok(i, j)) q[j * H + i] = v; };
    const box = (i, j) => { if (ok(i, j) && !q[j * H + i]) qc[j * H + i] = 1; };
    /* the middle: a big bush with crates all around it (every crate here is four on the map) */
    for (let j = 20; j < 22; j++) for (let i = 20; i < 22; i++) set(i, j, 3);
    box(21, 18); box(18, 21); box(19, 19);
    if (R() < .5){ set(17, 17, 1); set(17, 18, 1); set(18, 17, 1); } else { set(16, 20, 1); set(16, 21, 1); set(20, 16, 1); set(21, 16, 1); }
    let n = 0, tries = 0;
    while (n < L.wall && tries++ < 500){ const blk = R() < .2, len = 2 + ri(4), hor = R() < .5, w = blk ? 2 : hor ? len : 1, h = blk ? 2 : hor ? 1 : len, i = 1 + ri(H - w - 1), j = 1 + ri(H - h - 1);
      if ((i + w > 15 && j + h > 15) || !free(i, j, w, h, 2)) continue;
      for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) set(x, y, 1);
      if (!blk && R() < .45){ const e = R() < .5, ex = hor ? (e ? i : i + w - 1) : (e ? i - 1 : i + 1), ey = hor ? (e ? j - 1 : j + 1) : (R() < .5 ? j : j + h - 1); if (ok(ex, ey) && !used(ex, ey)) set(ex, ey, 1); }
      n++; }
    n = tries = 0;
    while (n < L.water && tries++ < 400){ const w = 2 + ri(3), h = 2 + ri(2), i = 2 + ri(H - w - 3), j = 2 + ri(H - h - 3);
      if ((i + w > 14 && j + h > 14) || !free(i, j, w, h, 2)) continue;
      for (let y = j; y < j + h; y++) for (let x = i; x < i + w; x++) if (!((x === i || x === i + w - 1) && (y === j || y === j + h - 1) && w > 2 && h > 2 && R() < .5)) set(x, y, 2);
      n++; }
    /* crates: one, two or three together, never too close to the next group */
    const cl = [], SH = [[[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [1, 1]]]; n = tries = 0;
    while (n < L.crate && tries++ < 800){ const s = SH[ri(SH.length)], i = 1 + ri(H - 4), j = 1 + ri(H - 4);
      if ((i > 13 && j > 13) || cl.some(([a, b]) => Math.abs(a - i) + Math.abs(b - j) < 6) || !s.every(([dx, dy]) => free(i + dx, j + dy, 1, 1, 1))) continue;
      s.forEach(([dx, dy]) => box(i + dx, j + dy)); cl.push([i, j]); n++; }
    /* bushes: grown blobs, every second one right next to a crate group */
    n = tries = 0;
    while (n < L.bush && tries++ < 500){ let i, j; if (n % 2 && cl.length){ const c0 = cl[ri(cl.length)]; i = c0[0] + ri(5) - 2; j = c0[1] + ri(5) - 2; } else { i = 1 + ri(H - 2); j = 1 + ri(H - 2); }
      if (!ok(i, j) || used(i, j)) continue; const sz = 4 + ri(7); let c = 0, x = i, y = j;
      for (let s = 0; s < sz * 4 && c < sz; s++){ if (ok(x, y) && !used(x, y)){ q[y * H + x] = 3; c++; } const d = ri(4); x += [1, -1, 0, 0][d]; y += [0, 0, 1, -1][d]; if (!ok(x, y)){ x = i; y = j; } }
      n++; }
    const g = new Uint8Array(MW * MH), c0 = new Uint8Array(MW * MH);
    for (let j = 0; j < H; j++) for (let i = 0; i < H; i++) for (const [x, y] of [[i, j], [MW - 1 - i, j], [i, MH - 1 - j], [MW - 1 - i, MH - 1 - j]]){ g[y * MW + x] = q[j * H + i]; c0[y * MW + x] = qc[j * H + i]; }
    /* nothing walled in: what can't be reached from the middle turns to rock */
    const nb = c => { const x = c % MW; return [x > 0 ? c - 1 : -1, x < MW - 1 ? c + 1 : -1, c - MW, c + MW].filter(d => d >= 0 && d < MW * MH); };
    const seen = new Uint8Array(MW * MH), st = [(MH / 2) * MW + MW / 2]; seen[st[0]] = 1;
    while (st.length){ const c = st.pop(); for (const d of nb(c)) if (!seen[d] && g[d] !== 1 && g[d] !== 2){ seen[d] = 1; st.push(d); } }
    for (let c = 0; c < MW * MH; c++) if (!seen[c] && g[c] !== 1 && g[c] !== 2){ g[c] = 1; c0[c] = 0; }
    const cr = [], ca0 = new Int16Array(MW * MH);
    for (let c = 0; c < MW * MH; c++) if (c0[c]){ ca0[c] = cr.length + 1; cr.push({x: (c % MW + .5) * TS, y: (Math.floor(c / MW) + .5) * TS, c}); }
    const fa = new Int16Array(MW * MH), fog = [];
    for (let s0 = 0; s0 < MW * MH; s0++){ if (g[s0] !== 3 || fa[s0]) continue; const cells = [], st2 = [s0]; fa[s0] = fog.length + 1;
      while (st2.length){ const c = st2.pop(); cells.push(c); for (const d of nb(c)) if (g[d] === 3 && !fa[d]){ fa[d] = fog.length + 1; st2.push(d); } }
      const P = cells.map(c => [(c % MW + .5) * TS, (Math.floor(c / MW) + .5) * TS]); fog.push({P, mid: {x: P.reduce((s, p) => s + p[0], 0) / P.length, y: P.reduce((s, p) => s + p[1], 0) / P.length}}); }
    const bt = []; for (let c = 0; c < MW * MH; c++) if (g[c] === 3) bt.push(c);
    return {L, g, ca0, ca: ca0.slice(), cr, fa, fog, bt};
  }
  function setLay(i){ const L = LAYS[((i | 0) % LAYS.length + LAYS.length) % LAYS.length]; if (L === LAY && MP) return; LAY = L; MP = MAPS[L.id] || (MAPS[L.id] = genMap(L)); FOG = MP.fog; MC.ch.clear(); PF.clear(); }
  function resetCrates(){ if (!MP) setLay(0); MP.ca.set(MP.ca0); PF.clear(); }
  const cell = (x, y) => x >= 0 && y >= 0 && x < WW && y < WH ? Math.floor(y / TS) * MW + Math.floor(x / TS) : -1;
  const inAr = (x, y) => x >= 0 && y >= 0 && x < WW && y < WH;
  const bodySolid = (x, y) => { const c = cell(x, y); if (c < 0) return true; const g = MP.g[c]; return g === 1 || g === 2 || MP.ca[c] > 0; };
  const shotSolid = (x, y, sk) => { const c = cell(x, y); return c < 0 || (c !== sk && (MP.g[c] === 1 || MP.ca[c] > 0)); };
  const crateAt = (x, y) => { const c = cell(x, y); return c < 0 ? -1 : MP.ca[c] - 1; };
  const walkA = (x, y) => !bodySolid(x, y) && !bodySolid(x - 20, y) && !bodySolid(x + 20, y) && !bodySolid(x, y - 20) && !bodySolid(x, y + 20) && !bodySolid(x - 14, y - 14) && !bodySolid(x + 14, y - 14) && !bodySolid(x - 14, y + 14) && !bodySolid(x + 14, y + 14);
  /* nothing solid between a and b (sk: a crate cell that is the target itself) */
  const clear = (a, b, sk) => { const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 14); for (let i = 1; i < n; i++) if (shotSolid(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n, sk)) return false; return true; };
  const walkLine = (a, b) => { const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 22); for (let i = 1; i <= n; i++) if (!walkA(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false; return true; };
  const rayEnd = (a, an, rg) => { const dx = Math.cos(an), dy = Math.sin(an); for (let s = 16; s < rg; s += 12){ const x = a.x + dx * s, y = a.y + dy * s, c = cell(x, y); if (c < 0 || MP.g[c] === 1) return {x, y, cr: -1}; if (MP.ca[c]) return {x, y, cr: MP.ca[c] - 1}; } return {x: a.x + dx * rg, y: a.y + dy * rg, cr: -1}; };
  const gasR = el => el < GZ.a ? 99999 : GZ.r0 - (GZ.r0 - GZ.r1) * Math.min(1, (el - GZ.a) / (GZ.b - GZ.a));
  const prune = (a, f) => { let j = 0; for (let i = 0; i < a.length; i++) if (f(a[i])) a[j++] = a[i]; a.length = j; };
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return Math.abs(d); };
  /* the bots' way: straight when nothing is in the way, else down a distance field over the tiles */
  const PF = new Map();
  const passC = c => MP.g[c] !== 1 && MP.g[c] !== 2 && !MP.ca[c];
  function field(goal){ let f = PF.get(goal); if (f) return f; f = new Int16Array(MW * MH).fill(-1); f[goal] = 0; const qq = [goal];
    for (let h = 0; h < qq.length; h++){ const c = qq[h], x = c % MW, d = f[c] + 1; if (x > 0 && f[c - 1] < 0 && passC(c - 1)){ f[c - 1] = d; qq.push(c - 1); } if (x < MW - 1 && f[c + 1] < 0 && passC(c + 1)){ f[c + 1] = d; qq.push(c + 1); }
      if (c >= MW && f[c - MW] < 0 && passC(c - MW)){ f[c - MW] = d; qq.push(c - MW); } if (c + MW < MW * MH && f[c + MW] < 0 && passC(c + MW)){ f[c + MW] = d; qq.push(c + MW); } }
    if (PF.size > 40) PF.delete(PF.keys().next().value); PF.set(goal, f); return f; }
  function wayTo(from, to){
    if (walkLine(from, to)) return to; const s = cell(from.x, from.y), g = cell(to.x, to.y); if (s < 0 || g < 0) return to;
    const f = field(g); if (f[s] < 0) return to; let c = s, best = null;
    for (let k = 0; k < 6 && f[c] > 0; k++){ const x = c % MW; let nb = -1; for (const n of [x > 0 ? c - 1 : -1, x < MW - 1 ? c + 1 : -1, c - MW, c + MW]) if (n >= 0 && n < MW * MH && f[n] >= 0 && f[n] < f[c] && (nb < 0 || f[n] < f[nb])) nb = n;
      if (nb < 0) break; c = nb; const p = {x: (c % MW + .5) * TS, y: (Math.floor(c / MW) + .5) * TS}; if (k === 0 || walkLine(from, p)) best = p; else break; }
    return best || to; }
  function nearFree(x, y){ const i0 = Math.floor(x / TS), j0 = Math.floor(y / TS); for (let r = 0; r < 14; r++) for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++){ if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r) continue; const px = (i + .5) * TS, py = (j + .5) * TS; if (inAr(px, py) && walkA(px, py)) return {x: px, y: py}; } return {x: GC.x, y: GC.y}; }
  /* everyone starts on a ring inside the gas, evenly spread */
  function spawns(n, R, r0){ const a0 = R() * Math.PI * 2, rad = Math.min(r0 * .78, WW / 2 - 150), out = []; for (let i = 0; i < n; i++){ const a = a0 + i / n * Math.PI * 2; out.push(nearFree(GC.x + Math.cos(a) * rad, GC.y + Math.sin(a) * rad)); } return out; }
  /* bushes, like Brawl Stars: inside you are hidden from everyone outside (unless you just shot or got hit).
     From inside you still see the whole map; only other people in the bushes you see just a few steps around you,
     or everyone in the same bush when it is a small one */
  const fogAt = (x, y) => { const c = cell(x, y); return c < 0 || !MP ? -1 : MP.fa[c] - 1; };
  const fogMid = i => FOG[i].mid;

  /* ---------------- the host: health, crates, cubes, bots, who is out, the bonus ---------------- */
  const HB = {bots: {}, seen: new Set(), int: 0, hpT: 0, dirty: false, dot: {}, ambT: 0};
  const hostG = () => { const P = PNet.P; return P && P.isHost && P.G && P.G.s ? P.G : null; };
  const hostMg = () => { const G = hostG(), mg = G && G.s.meet && G.s.meet.mg; return mg && mg.g === "arena" && mg.ar ? mg : null; };
  /* everything said about the arena also reaches this own screen */
  const send = m => { PNet.raw(m); onMsg(Object.assign({id: PNet.me}, m)); };
  function hostInit(G, mg){
    const s = G.s, map = s.arena ? ((s.arRound || 1) - 1) % LAYS.length : (mg.seed >>> 0) % LAYS.length; setLay(map); resetCrates();
    const ids = G.ids.filter(id => s.alive[id]), gz = GZ = gasPlan(!!s.arena, ids.length), sp = spawns(ids.length, rngOf(mg.seed), gz.r0), pk = s.arena && (s.arRound || 0) > 1 ? PICK2 : PICK;
    /* together against the bots: all people one team, the bots the other */
    const team = s.arena && G.opts && G.opts.team === "coop" && ids.some(isBot) && ids.some(id => !isBot(id)) ? Object.fromEntries(ids.map(id => [id, isBot(id) ? "b" : "h"])) : null;
    mg.ar = {map, gz, team, ph: "pick", pickEnd: mg.t0 + N().SPIN + pk, pk, fight: 0, end: 0, ids, hp: {}, mx: {}, cls: {}, out: [], sp: Object.fromEntries(ids.map((id, i) => [id, sp[i]])), dmg: {}, kills: {}, lh: {}, ls: {}, feed: [], crb: [], crh: {}};
    (s.bots || []).forEach(b => { if (ids.includes(b.id)) mg.ar.cls[b.id] = KEYS[Math.floor(Math.random() * KEYS.length)]; });
    mg.end = mg.ar.pickEnd + gz.fl; HB.seen.clear(); HB.bots = {}; HB.dot = {}; HB.crd = false;
  }
  function stopHost(){ clearInterval(HB.int); HB.int = 0; }
  function hostTick(G){
    const s = G.s, mg = s.meet && s.meet.mg; if (!mg || mg.g !== "arena" || !mg.ar || mg.done){ stopHost(); return false; }
    const A = mg.ar; let ch = false;
    if (!HB.int) HB.int = setInterval(() => { try { hostLoop(); } catch(e) { console.error(e); } }, 50);
    if (A.ph === "pick" && now() >= A.pickEnd){ A.ph = "fight"; A.fight = now(); A.end = now() + (A.gz || GZ).fl; mg.end = A.end;
      A.ids.forEach(id => { if (!KEYS.includes(A.cls[id])) A.cls[id] = KEYS[Math.floor(Math.random() * KEYS.length)]; A.mx[id] = A.hp[id] = Math.round(CLS[A.cls[id]].hp * hpF(A, id)); A.dmg[id] = 0; A.kills[id] = 0; A.lh[id] = A.ls[id] = 0; });
      botsInit(s, A); A.cubes = []; A.pw = {}; A.cseq = 0; ch = true; }
    /* a new host after a handover takes the bots over where they were */
    if (A.ph === "fight" && !Object.keys(HB.bots).length && (s.bots || []).some(b => A.ids.includes(b.id))) botsInit(s, A);
    /* someone who left is out */
    if (A.ph === "fight") A.ids.forEach(id => { if ((s.gone || {})[id] && !A.out.includes(id)){ A.out.push(id); ch = true; } });
    if (A.ph === "fight"){ const alive = A.ids.filter(id => !A.out.includes(id)), humans = A.ids.filter(id => !isBot(id) && !(s.gone || {})[id]), teams = A.team ? new Set(alive.map(id => A.team[id])).size : alive.length;
      if (teams <= 1 || now() >= A.end || (humans.length && !alive.some(id => humans.includes(id)) && alive.length)){ finish(G, mg); ch = true; } }
    return ch;
  }
  /* power cubes, like Brawl Stars but harder: each one +15 % health and +15 % damage (up to 12), whoever is knocked out drops theirs.
     With 10 cubes you have 2.5× the health and hit 2.5× as hard, so farming crates really pays off */
  const CUBE = .15, CUBES = 12;
  function cubeAdd(A, x, y, n){ A.cubes.push({k: ++A.cseq, x: Math.round(x), y: Math.round(y), n: n || 1}); HB.cdirty = true; }
  function cubeGrab(A, id, k){ const i = A.cubes.findIndex(c => c.k === k); if (i < 0 || A.out.includes(id)) return; const c = A.cubes[i], q = posOf(id); if (!q || Math.hypot(q.x - c.x, q.y - c.y) > 90) return;
    A.cubes.splice(i, 1); const was = A.pw[id] || 0, now2 = Math.min(CUBES, was + c.n), base = Math.round(CLS[A.cls[id]].hp * hpF(A, id)); A.pw[id] = now2; A.mx[id] = Math.round(base * (1 + CUBE * now2)); A.hp[id] = Math.min(A.mx[id], A.hp[id] + base * CUBE * (now2 - was)); HB.dirty = true; HB.cdirty = true; }
  /* a crate takes a hit; broken, it leaves a cube */
  function hostCrate(A, i, d, k){ if (!MP || !MP.cr[i] || !A.crb || A.crb.includes(i) || !(d > 0) || A.ph !== "fight") return; if (k){ const key = "c" + i + "|" + k; if (HB.seen.has(key)) return; HB.seen.add(key); }
    const hp = (A.crh[i] == null ? CRATE : A.crh[i]) - Math.min(220, d); if (hp > 0){ A.crh[i] = hp; HB.crd = true; return; }
    delete A.crh[i]; A.crb.push(i); const cr = MP.cr[i]; if (A.cubes) cubeAdd(A, cr.x, cr.y, 1); HB.crT = 0; HB.crd = true; }
  function botsInit(s, A){ HB.bots = {}; (s.bots || []).forEach(b => { if (!A.ids.includes(b.id)) return; const q = C.AP[b.id], p = q && q.dx != null ? {x: q.dx, y: q.dy} : A.sp[b.id];
    HB.bots[b.id] = {x: p.x, y: p.y, a: 0, f: 1, mv: 0, am: AMMO, rl: 0, cd: 600 + Math.random() * 900, str: Math.random() < .5 ? -1 : 1, strT: 0, seen: 0, skill: botSkill(), sup: 0, dash: null, kb: null, hide: 0, chS: 0}; }); }
  function hostLoop(){
    const G = hostG(), mg = hostMg(); if (!G || !mg || mg.done){ stopHost(); return; }
    const A = mg.ar; if (A.ph === "pick"){ if (now() >= A.pickEnd && hostTick(G)) PNet.refresh(); return; }
    if (A.ph !== "fight") return;
    const dt = .05; if (!HB.freeze) botsStep(A, dt); regen(A, dt); botHazards(A, dt);
    if (HB.crd && now() - (HB.crT || 0) > 120){ HB.crd = false; HB.crT = now(); send({t: "acr", b: A.crb.slice(), h: rnd(A.crh)}); }
    if (A.cubes){ for (const id in HB.bots){ if (A.out.includes(id)) continue; const b = HB.bots[id], c = A.cubes.find(c => Math.hypot(c.x - b.x, c.y - b.y) < 38); if (c) cubeGrab(A, id, c.k); }
      if (HB.cdirty){ HB.cdirty = false; send({t: "acu", c: A.cubes, pw: A.pw}); } }
    if (now() - HB.ambT > 100){ HB.ambT = now(); const l = Object.entries(HB.bots).filter(([id]) => !A.out.includes(id)).map(([id, b]) => [id, Math.round(b.x), Math.round(b.y), Math.round(b.a * 100), b.mv ? 1 : 0, b.f, b.chS ? Math.round(Math.min(1, (now() - b.chS) / CHG) * 100) : 0]); if (l.length) PNet.raw({t: "amb", l, ts: now()}); }
    if (HB.dirty && now() - HB.hpT > 200){ HB.dirty = false; HB.hpT = now(); send({t: "ahp", hp: rnd(A.hp), mx: A.mx, out: A.out, f: A.feed.slice(-4)}); }
    if (hostTick(G)) PNet.refresh();
  }
  /* alone against bots they grow with you: a little sharper the more rounds you have won */
  const soloLv = () => PNet.P && PNet.P.solo ? Math.min(1, ((PG.st && PG.st.nsWins) || 0) / 30) : .5;
  const botSkill = () => .47 + soloLv() * .16 + Math.random() * .4;
  /* together against bots: when the bots outnumber the people, each bot is a bit softer */
  const hpF = (A, id) => { if (!A.team || !isBot(id)) return 1; const nb = A.ids.filter(isBot).length, nh = A.ids.length - nb; return nb ? Math.max(.7, Math.min(1, nh / nb + .2)) : 1; };
  const rnd = o => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, Math.round(v)]));
  function hostHit(vic, d, by, k){
    const G = hostG(), mg = hostMg(), A = mg && mg.ar; if (!A || A.ph !== "fight" || !A.ids.includes(vic) || A.out.includes(vic) || !(d > 0)) return;
    if (A.team && by && by !== vic && A.team[by] && A.team[by] === A.team[vic]) return;
    if (k){ const key = vic + "|" + k; if (HB.seen.has(key)) return; HB.seen.add(key); if (HB.seen.size > 6000) HB.seen.clear(); }
    d = Math.min(220, d); A.hp[vic] = Math.max(0, A.hp[vic] - d); A.lh[vic] = now(); if (by && by !== vic && A.dmg[by] != null) A.dmg[by] += d; HB.dirty = true;
    if (by && by !== vic && HB.bots[by]) HB.bots[by].sup = Math.min(1, HB.bots[by].sup + d / CLS[A.cls[by]].sc);
    if (A.hp[vic] <= 0){ A.out.push(vic); if (A.cubes){ const q = posOf(vic); if (q) cubeAdd(A, q.x, q.y, (A.pw[vic] || 0) + 1); } if (by && by !== vic && A.kills[by] != null) A.kills[by]++; const kb = by && by !== vic && A.ids.includes(by) ? by : ""; A.feed.push([kb, vic, kb ? A.cls[kb] : "gas"]); if (A.feed.length > 8) A.feed.shift();
      if (kb && HB.bots[kb] && Math.random() < .35) setTimeout(() => send({t: "aem", w: kb, e: ["😎", "GG", "😂", "🔥"][Math.floor(Math.random() * 4)]}), 500);
      HB.hpT = now(); HB.dirty = false; send({t: "ahp", hp: rnd(A.hp), mx: A.mx, out: A.out, f: A.feed.slice(-4), ko: vic}); hostTick(G); PNet.refresh(); }
  }
  function regen(A, dt){ A.ids.forEach(id => { if (A.out.includes(id) || A.hp[id] >= A.mx[id]) return; if (now() - (A.lh[id] || 0) > 3000 && now() - (A.ls[id] || 0) > 3000){ A.hp[id] = Math.min(A.mx[id], A.hp[id] + A.mx[id] * .14 * dt); HB.dirty = true; } }); }
  const posOf = id => { if (id === PNet.me && C.me) return C.me; const b = HB.bots[id]; if (b) return b; const p = C.AP[id]; return p && p.dx != null ? {x: p.dx, y: p.dy} : null; };
  const velOf = id => { const b = C.AP[id] && C.AP[id].buf; if (!b || b.length < 2) return {x: 0, y: 0}; const p = b[b.length - 2], q = b[b.length - 1], dt = Math.max(30, q.t - p.t) / 1000; return {x: (q.x - p.x) / dt, y: (q.y - p.y) / dt}; };
  /* can the one at "from" see "id"? A bush hides, unless close, or the one in it just shot or got hit */
  const revealed = id => now() - (C.shotAt[id] || 0) < REVEAL || now() - (C.hitAt[id] || 0) < REVEAL;
  const smallBush = i => i >= 0 && !!FOG[i] && FOG[i].P.length <= SMALLB;
  const seenFrom = (from, id, q) => { q = q || posOf(id); if (!q) return false; const fq = fogAt(q.x, q.y); if (fq < 0 || revealed(id)) return true; if (!from) return false;
    if (smallBush(fq) && fogAt(from.x, from.y) === fq) return true; return Math.hypot(q.x - from.x, q.y - from.y) < SEE; };
  /* bots: keep their distance (the boxer rushes in), strafe, shoot what they see, break crates when nobody is around, hide in bushes when hurt, run from the gas */
  const WANT = {shot: .5, bomb: .75, snipe: .8, punch: .2, gun: .72, rang: .66, zap: .66};
  function botShoot(id, b, A, a, ex, su, easy){ const k = A.cls[id], cl = CLS[k]; if (!su){ b.am--; b.cd = cl.cd + 200 + Math.random() * 600 + (easy ? 420 - soloLv() * 260 : 0); } b.a = a; b.f = Math.cos(a) < 0 ? -1 : 1; A.ls[id] = now();
    send(Object.assign({t: "as", by: id, k: id.slice(-3) + (++C.seq), c: k, x: Math.round(b.x), y: Math.round(b.y), a: Math.round(a * 1000) / 1000}, su ? {s: 1} : {}, ex || {})); }
  function botCrate(b, gr){ let best = null, bd = 900; for (const cr of MP.cr){ if (!MP.ca[cr.c]) continue; const d = Math.hypot(cr.x - b.x, cr.y - b.y); if (d < bd && Math.hypot(cr.x - GC.x, cr.y - GC.y) < gr - 60){ bd = d; best = cr; } } return best && {x: best.x, y: best.y, c: best.c, d: bd}; }
  const botSync = (id, b) => { const p = C.AP[id] || (C.AP[id] = {buf: []}); p.dx = b.x; p.dy = b.y; p.a = b.a; p.f = b.f; p.mv = b.mv; p.t = now(); p.chg = b.chS ? Math.min(1, (now() - b.chS) / CHG) : 0; };
  function botsStep(A, dt){
    const el = now() - A.fight, gr = gasR(el);
    for (const id in HB.bots){ const b = HB.bots[id]; b.px = b.x; b.py = b.y; b.ut = now(); if (A.out.includes(id)){ b.mv = 0; continue; } const k = A.cls[id], cl = CLS[k];
      b.rl += dt * 1000; while (b.am < AMMO && b.rl >= cl.rl){ b.am++; b.rl -= cl.rl; } if (b.am >= AMMO) b.rl = 0; b.cd -= dt * 1000;
      if (b.dash){ dashStep(b); botSync(id, b); continue; }
      if (b.kb && b.kb.until > now()){ const nx = b.x + b.kb.vx * dt, ny = b.y + b.kb.vy * dt; if (walkA(nx, b.y)) b.x = nx; if (walkA(b.x, ny)) b.y = ny; }
      let best = null; A.ids.forEach(o => { if (o === id || A.out.includes(o) || (A.team && A.team[o] === A.team[id])) return; const q = posOf(o); if (!q || !seenFrom(b, o, q)) return; const d = Math.hypot(q.x - b.x, q.y - b.y); if (d > 950) return; const los = d < 1000 && (clear(b, q) || (cl.lob && d < cl.rg * 1.05)), sc = d - (los ? 260 : 0); if (!best || sc < best.sc) best = {id: o, q, d, los, sc}; });
      let gx = 0, gy = 0, box = null; const outGas = Math.hypot(b.x - GC.x, b.y - GC.y) > gr - 60, low = A.hp[id] / A.mx[id] < .38;
      const go = t => { const w = wayTo(b, t), dx = w.x - b.x, dy = w.y - b.y, d = Math.hypot(dx, dy) || 1; gx = dx / d; gy = dy / d; };
      /* hurt and nobody close: off into the nearest bush to heal */
      if (low && !outGas && !(best && best.d < 260)){ let fi = -1, fd = 1e9; FOG.forEach((P, i) => { const m = fogMid(i), d = Math.hypot(m.x - b.x, m.y - b.y), gd = Math.hypot(m.x - GC.x, m.y - GC.y); if (gd < gr - 80 && d < fd){ fd = d; fi = i; } });
        if (fi >= 0 && fogAt(b.x, b.y) !== fi){ go(fogMid(fi)); b.hide = 1; } else if (fi >= 0){ b.hide = 1; } }
      else b.hide = 0;
      if (b.hide && fogAt(b.x, b.y) >= 0 && !(best && best.d < 260)){ gx = gy = 0; }
      else if (outGas) go(GC);
      else if (best && best.los && !b.hide){ const dx = best.q.x - b.x, dy = best.q.y - b.y, d = best.d || 1;
        if (k === "punch"){ if (clear(b, best.q) && walkLine(b, best.q)){ gx = dx / d; gy = dy / d; } else go(best.q); if (d < 70){ gx *= .2; gy *= .2; } }
        else { const want = cl.rg * WANT[k], kk = d > want ? 1 : d < want * .55 ? -.8 : 0; if (now() > b.strT){ b.strT = now() + 500 + Math.random() * 900; if (Math.random() < .45) b.str *= -1; } gx = dx / d * kk - dy / d * b.str * .85; gy = dy / d * kk + dx / d * b.str * .85; } }
      else if (!b.hide && A.cubes && (() => { let cb = null, cd = 1e9; A.cubes.forEach(c => { const d = Math.hypot(c.x - b.x, c.y - b.y); if (d < cd && d < (best ? 260 : 800) && Math.hypot(c.x - GC.x, c.y - GC.y) < gr - 40){ cd = d; cb = c; } }); if (cb){ go(cb); return true; } return false; })()) {}
      else if (best && !b.hide) go(best.q);
      else if (!b.hide && (box = botCrate(b, gr))){ if (box.d > (k === "punch" ? 78 : cl.rg * .78) || !(cl.lob || clear(b, box, box.c))) go(box); }
      else if (!b.hide && el > 4000){ const t = {x: GC.x + Math.cos(id.length + el / 9000) * 160, y: GC.y + Math.sin(id.length + el / 9000) * 140}; if (Math.hypot(t.x - b.x, t.y - b.y) > 120) go(t); }
      const m = Math.hypot(gx, gy); b.mv = m > .1 ? 1 : 0;
      if (b.mv){ const sp = SPD * cl.sp * (b.chS ? .55 : 1) * .92 * dt, nx = b.x + gx / m * sp, ny = b.y + gy / m * sp; let moved = false; if (walkA(nx, b.y)){ b.x = nx; moved = true; } if (walkA(b.x, ny)){ b.y = ny; moved = true; } if (!moved){ b.str *= -1; b.strT = now() + 700; } if (Math.abs(gx) > .1) b.f = gx < 0 ? -1 : 1; }
      if (best && best.los){ if (!b.seen) b.seen = now(); b.a = Math.atan2(best.q.y - b.y, best.q.x - b.x); } else b.seen = 0;
      /* against bots alone they react a bit slower and miss a bit more, so a round isn't over in ten seconds */
      const easy = PNet.P && PNet.P.solo && best && best.id === PNet.me;
      if (best && best.los && b.seen && now() - b.seen > (easy ? 600 : 380)){
        const v = velOf(best.id), aim = sp2 => { const tt = cl.lob ? cl.lob / 1000 : sp2 ? best.d / sp2 : 0, ax = best.q.x + v.x * tt * b.skill, ay = best.q.y + v.y * tt * b.skill; return Math.atan2(ay - b.y, ax - b.x) + (Math.random() - .5) * .34 * (1.35 - b.skill) * (easy ? 1.5 : 1); };
        const su = cl.su, sr = su.rg || cl.rg;
        if (b.sup >= 1 && best.d < sr * .9 && Math.random() < .08){ const a = aim(su.v || cl.v); b.sup = 0; b.chS = 0; botShoot(id, b, A, a, cl.lob || su.at ? {r: Math.round(best.d + (Math.random() - .5) * 40 * (1.35 - b.skill))} : null, true); }
        else if (best.d < (k === "punch" ? cl.rg + BODY - 4 : cl.rg * .92) && b.am >= 1 && b.cd <= 0){
          if (k === "snipe" && best.d > 300 && !b.chS) b.chS = now();
          if (k !== "snipe" || !b.chS || now() - b.chS > CHG * (.55 + .45 * b.skill)){ const a = aim(k === "zap" ? 0 : cl.v), ex = cl.lob ? {r: Math.round(best.d + (Math.random() - .5) * 50 * (1.35 - b.skill))} : k === "snipe" ? {ch: b.chS ? Math.round(Math.min(1, (now() - b.chS) / CHG) * 100) : 0} : k === "zap" ? zapPath(b, a, id) : null; b.chS = 0; botShoot(id, b, A, a, ex, false, easy); } } }
      else if (box && b.am >= 2 && b.cd <= 0 && box.d < (k === "punch" ? 100 : cl.rg * .9) && (cl.lob || clear(b, box, box.c))){ const a = Math.atan2(box.y - b.y, box.x - b.x); b.chS = 0; botShoot(id, b, A, a, cl.lob ? {r: Math.round(box.d)} : k === "zap" ? zapPath(b, a, id) : k === "snipe" ? {ch: 0} : null); }
      else if (!(best && best.los)) b.chS = 0;
      botSync(id, b); }
  }
  /* the gas also hurts the bots */
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
    if (a.a === "arcl"){ if (A.ph === "pick" && A.ids.includes(id) && KEYS.includes(a.v)) A.cls[id] = a.v; return true; }
    if (a.a === "arperk"){ const P2 = mg.perk; if (!mg.done || !P2 || P2.pick || id !== mg.win || !P2.opts.includes(a.v)) return true;
      if (a.v === "revive"){ if (!revivable(G).includes(a.t)) return true; P2.t = a.t; }
      P2.pick = a.v; s.perkNext = {id, k: a.v, t: P2.t || null}; return true; }
    return false;
  }
  function hostView(G, mg, id){
    const A = mg.ar, P2 = mg.perk;
    return {map: A.map || 0, gz: A.gz || null, team: A.team || null, ph: A.ph, ids: A.ids, cls: A.cls, hp: rnd(A.hp), mx: A.mx, cubes: A.cubes || [], pw: A.pw || {}, crb: A.crb || [], crh: rnd(A.crh), out: A.out, sp: A.sp, feed: A.feed.slice(-4), kills: A.kills, pickLeft: Math.max(0, A.pickEnd - now()), pk: A.pk || PICK, fightEl: A.fight ? now() - A.fight : 0, left: A.end ? Math.max(0, A.end - now()) : 0,
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
  const C = {emo: {}, cubes: [], pw: {}, cgT: {}, on: false, seed: null, A: null, me: null, am: AMMO, rl: 0, cd: 0, sup: 0, seq: 0, AP: {}, proj: [], fx: [], pops: [], jabs: [], burst: [], storms: [], jump: {}, lunge: {}, glow: {}, cubeT: {}, crb: new Set(), crh: {}, crf: {}, crg: {}, crT: 0, chg: null, scr: null,
    sent: 0, sentP: null, moveP: null, aimP: null, supP: null, keys: {}, dot: 0, dotT: 0, dotBy: "", hurtT: 0, shake: 0, hitAt: {}, shotAt: {}, kb: null, L: null, t0: 0, pickEnd: 0, pickDur: PICK, fightT0: 0, endAt: 0, doneAt: 0, started: false, hpT: 0, outShown: false, sndT: {}, kbDone: {}, v: null};
  const me = () => PNet.me;
  const NPo = () => N().NP;
  function reset(keep){ Object.assign(C, {rew: null, fin: 0, winTeam: null, cubes: [], pw: {}, cgT: {}, seed: null, A: null, me: null, proj: [], fx: [], pops: [], jabs: [], burst: [], storms: [], jump: {}, lunge: {}, glow: {}, cubeT: {}, crb: new Set(), crh: {}, crf: {}, crg: {}, crT: 0, chg: null, AP: {}, moveP: null, aimP: null, supP: null, started: false, doneAt: 0, outShown: false, dot: 0, sup: 0, kb: null, hitAt: {}, shotAt: {}, kbDone: {}, picked: 0, win: null});
    resetCrates(); if (!keep) leaveLayer(); else if (C.L){ const r = C.L.querySelector(".ar-res"); if (r){ r.classList.remove("on"); r._h = null; } } }
  const amIn = () => C.A && C.A.ids.includes(me());
  const alive = id => C.A && C.A.ids.includes(id) && !C.A.out.includes(id);
  const fighting = () => C.A && C.A.ph === "fight" && C.started && alive(me()) && C.me;
  /* where someone is on this screen: me exactly, the host's bots exactly, everyone else smoothed */
  const pos = id => id === me() && C.me ? C.me : isHost() && HB.bots[id] ? HB.bots[id].D || HB.bots[id] : C.AP[id] && C.AP[id].dx != null ? {x: C.AP[id].dx, y: C.AP[id].dy} : C.A && C.A.sp[id] ? C.A.sp[id] : null;
  const isHost = () => !!(PNet.P && PNet.P.isHost);
  const mate = (a, b) => !!(a && b && a !== b && C.A && C.A.team && C.A.team[a] && C.A.team[a] === C.A.team[b]);
  const authOf = by => by === me() || (isHost() && !!HB.bots[by]);
  const visible = id => { if (id === me() || !C.me || !alive(me()) || mate(id, me())) return true; return seenFrom(C.me, id, pos(id)); };
  const chgNow = () => C.chg ? Math.min(1, (now() - C.chg.t0) / CHG) : 0;
  /* sounds: from NP's little synth (quiet when the game sound is off), softer when it's far away */
  function snd(n, at, v){ const x = NPo().sfx, d = at && C.me ? Math.hypot(at.x - C.me.x, at.y - C.me.y) : 0, g = Math.max(.12, 1 - d / 1000); if (now() - (C.sndT[n] || 0) < 40) return; C.sndT[n] = now(); v = v || 0; try {
    if (n === "shot"){ x.noise(0, .26, 3200, 260, .34 * g, "lowpass"); x.tone(0, 150, 42, .18, .24 * g, "square"); x.noise(.3, .045, 2600, 2200, .1 * g, "bandpass", 3); x.noise(.38, .05, 1700, 1500, .1 * g, "bandpass", 3); }
    else if (n === "gun"){ x.noise(0, .1, 4800, 700, .24 * g, "lowpass"); x.tone(0, 520, 150, .07, .12 * g, "square"); }
    else if (n === "snipe"){ x.tone(0, 1800, 200, .2, .12 * g, "sawtooth"); x.noise(0, .16, 7000, 900, .24 * g, "highpass"); if (v > .5){ x.tone(0, 110, 38, .45, .3 * g * v, "sine"); x.noise(0, .55, 1400, 120, .2 * g * v, "lowpass"); } }
    else if (n === "charge"){ x.tone(0, 260, 980, CHG / 1000, .045, "triangle"); }
    else if (n === "full"){ x.chord(0, [88, 95], .14, .05, "square"); }
    else if (n === "throw"){ x.noise(0, .26, 450, 1900, .15 * g, "bandpass", 2); x.noise(.05, .32, 6500, 5000, .035 * g, "highpass"); }
    else if (n === "boom"){ x.noise(0, .6, 1100, 50, .4 * g, "lowpass"); x.tone(0, 100, 30, .5, .32 * g, "sine"); }
    else if (n === "slam"){ x.noise(0, .7, 900, 40, .45 * g, "lowpass"); x.tone(0, 80, 28, .6, .4 * g, "sine"); x.noise(.02, .2, 2500, 600, .15 * g, "bandpass", 1); }
    else if (n === "punch"){ x.noise(0, .1, 800, 2800, .16 * g, "bandpass", 1.3); }
    else if (n === "thud"){ x.tone(0, 170, 52, .14, .32 * g, "sine"); x.noise(0, .07, 1600, 300, .22 * g, "lowpass"); }
    else if (n === "rang"){ for (let i = 0; i < 4; i++) x.noise(i * .09, .08, 700, 1500, .09 * g, "bandpass", 5); }
    else if (n === "zap"){ x.tone(0, 2000, 160, .18, .13 * g, "sawtooth"); x.noise(0, .24, 8000, 2600, .18 * g, "highpass"); x.tone(.03, 900, 2600, .08, .05 * g, "square"); }
    else if (n === "storm"){ x.noise(0, .8, 700, 60, .32 * g, "lowpass"); x.tone(0, 2200, 300, .12, .06 * g, "sawtooth"); x.tone(0, 70, 36, .5, .2 * g, "sine"); }
    else if (n === "crack"){ x.noise(0, .07, 1900, 700, .16 * g, "bandpass", 2); x.tone(0, 260, 170, .05, .07 * g, "square"); }
    else if (n === "crate"){ x.noise(0, .4, 1500, 180, .34 * g, "lowpass"); x.noise(.02, .14, 3200, 1100, .17 * g, "bandpass", 2); x.tone(0, 190, 70, .22, .22 * g, "triangle"); x.chord(.1, [84, 91, 96], .3, .035 * g, "triangle"); }
    /* the power cube: a thump, a rising charge-up sweep and a bright chord that climbs with every cube you hold */
    else if (n === "cube"){ const s = Math.min(10, v), k = Math.pow(2, s / 24); x.tone(0, 130, 65, .16, .22 * g, "sine"); x.tone(0, 220 * k, 1150 * k, .32, .09 * g, "sawtooth"); x.noise(0, .34, 500, 6000, .12 * g, "bandpass", 1.4); x.chord(.14, [76 + s, 83 + s, 88 + s], .4, .065 * g, "triangle"); x.tone(.17, 1320 * k, 1980 * k, .3, .045 * g, "sine"); }
    else if (n === "pick"){ x.noise(0, .035, 5000, 3500, .12, "highpass"); x.tone(0, 600 + v * 60, 900 + v * 90, .08, .09, "square"); x.chord(.06, [72 + v * 2, 79 + v * 2], .18, .05, "triangle"); }
    else if (n === "super"){ x.chord(0, [64, 71, 76], .3, .08 * g, "sawtooth"); x.noise(0, .35, 400, 3000, .18 * g, "bandpass", 1.2); }
    else if (n === "ready"){ x.chord(0, [76, 83], .18, .05, "triangle"); x.chord(.12, [79, 86], .25, .05, "triangle"); }
    else if (n === "hurt"){ x.tone(0, 230, 80, .14, .2, "square"); }
    else if (n === "hit"){ x.tone(0, 680, 320, .06, .08, "square"); }
    else if (n === "ko"){ x.chord(0, [60, 63, 67], .45, .07, "sawtooth"); x.noise(0, .4, 1800, 200, .2, "lowpass"); }
    else if (n === "final"){ x.tone(0, 98, 98, .5, .12, "sawtooth"); x.tone(.45, 131, 131, .5, .12, "sawtooth"); x.chord(.9, [55, 62, 67], .9, .06, "sawtooth"); x.noise(.9, .8, 300, 2000, .12, "bandpass", .8); }
    else if (n === "empty"){ x.tone(0, 320, 300, .04, .05, "square"); }
    else if (n === "go"){ x.chord(0, [67, 71, 74], .25, .07, "square"); x.chord(.22, [72, 76, 79], .45, .07, "square"); }
    else if (n === "win"){ x.chord(0, [60, 64, 67], .3, .07, "triangle"); x.chord(.25, [65, 69, 72], .3, .07, "triangle"); x.chord(.5, [72, 76, 79], .7, .08, "triangle"); }
  } catch(e) {} }

  /* crates broken somewhere: gone from the map, with planks flying (not when catching up after joining) */
  function applyCrates(b, h, silent){ if (!MP) return; let ch = false; (b || []).forEach(i => { i = +i; const cr = MP.cr[i]; if (!cr || C.crb.has(i)) return; C.crb.add(i); MP.ca[cr.c] = 0; ch = true;
      if (!silent){ C.fx.push({k: "crate", x: cr.x, y: cr.y, t: now(), d: 950, s: i}); snd("crate", cr); if (C.me && Math.hypot(cr.x - C.me.x, cr.y - C.me.y) < 320) C.shake = Math.max(C.shake, 5); } });
    if (ch) PF.clear(); if (h) C.crh = h; }
  function setCubes(list){ const had = new Set(C.cubes.map(c => c.k)); C.cubes = list || []; C.cubes.forEach(c => { if (!had.has(c.k) && !C.cubeT[c.k]) C.cubeT[c.k] = now(); }); }
  /* the view from the host: phases, health, classes */
  function view(v){
    C.v = v; const mg = v && v.phase === "meet" && v.meet && v.meet.mg; if (!mg || mg.g !== "arena" || !mg.ar){ if (C.seed != null || C.on) reset(); return; }
    const a = mg.ar; setLay(a.map || 0); if (C.seed !== mg.seed){ reset(!!v.arena); C.seed = mg.seed; C.t0 = now() - (mg.el || 0); }
    if (a.gz) GZ = a.gz;
    const A = C.A || (C.A = {hp: {}, mx: {}, out: [], feed: []}); A.team = a.team || null; A.ph = a.ph; A.ids = a.ids; A.cls = a.cls; A.sp = a.sp; A.kills = a.kills || {}; A.perk = a.perk;
    if (now() - C.hpT > 500){ A.hp = Object.assign({}, a.hp); A.out = a.out.slice(); A.feed = a.feed || []; A.mx = a.mx; setCubes(a.cubes); C.pw = a.pw || {}; }
    if (a.crb) applyCrates(a.crb, now() - C.crT > 500 ? a.crh : null, !C.started);
    const pe = now() + a.pickLeft; if (Math.abs(pe - C.pickEnd) > 250) C.pickEnd = pe; C.pickDur = a.pk || PICK;
    if (a.ph === "fight"){ const f0 = now() - a.fightEl; if (!C.fightT0 || Math.abs(f0 - C.fightT0) > 250) C.fightT0 = f0; C.endAt = now() + a.left; if (!C.started) start(); }
    if (mg.done && !C.doneAt){ C.doneAt = now(); C.win = mg.win; C.winTeam = mg.winTeam || null; C.chg = null; if (v.arena && amIn()) reward(C.winTeam ? C.A.team && C.A.team[me()] === C.winTeam : mg.win === me()); const iw = C.winTeam ? C.A.team && C.A.team[me()] === C.winTeam : mg.win === me();
      banner(C.winTeam ? (C.winTeam === "h" ? `👑 ${T("You won!", "Ihr habt gewonnen!")}` : `🤖 ${T("The bots win", "Die Bots gewinnen")}`) : mg.win ? `👑 ${esc(NPo().nm(mg.win))}` : T("Draw", "Unentschieden"), iw ? "win" : ""); snd(iw ? "win" : "ko"); if (iw) Haptic.go([30, 50, 30, 50, 80]); }
  }
  /* Nat Stars on its own counts like the other games: XP, and a win is a daily win */
  function reward(won){ const k = (C.A.kills || {})[me()] || 0, solo = PNet.P && PNet.P.solo; let xp = (won ? 20 : 6) + k * 4; if (solo) xp = Math.round(xp / 2); C.rew = {xp, won, k};
    PG.st.nsWins = (PG.st.nsWins || 0) + (won ? 1 : 0); PG.st.nsKills = (PG.st.nsKills || 0) + k;
    /* trophies per fighter: shown on the pick cards */
    const my = C.A.cls && C.A.cls[me()]; if (won && my){ PG.st.nsCls = PG.st.nsCls || {}; PG.st.nsCls[my] = (PG.st.nsCls[my] || 0) + 1; } try { PG.persist(); } catch(e) {}
    setTimeout(() => { try { if (typeof addXP === "function") addXP(xp, "natstars"); if (won && typeof natWin === "function") natWin("natstars"); } catch(e) {} }, 1800); }
  /* the first few fights: where to touch, what the yellow button, the crates and the bushes do */
  function hint(){ const n = PG.st.nsHint2 || 0, box = C.L && C.L.querySelector(".ar-tip"); if (n >= 3 || !box) return; PG.st.nsHint2 = n + 1; try { PG.persist(); } catch(e) {}
    const mo = matchMedia("(pointer: fine)").matches && !matchMedia("(pointer: coarse)").matches, sn = C.cls === "snipe";
    box.innerHTML = `<span class="t-mv">${mo ? "⌨️ " + T("WASD = run", "WASD = laufen") : "👆 " + T("Drag = run", "Ziehen = laufen")}</span><span class="t-fire">🎯 ${sn ? (mo ? T("Hold the mouse = charge", "Maus halten = aufladen") : T("Hold = charge, let go = shoot", "Halten = aufladen, loslassen = Schuss")) : mo ? T("Click = shoot · right-click = super", "Klick = schießen · Rechtsklick = Super") : T("Drag = aim · tap = auto", "Ziehen = zielen · Tippen = Auto")}</span><span class="t-sup">⭐ ${T("Super charges when you hit", "Super lädt durch Treffer")}</span><span class="t-fog">📦 ${T("Shoot crates: power cubes", "Kisten abschießen: Power-Würfel")} · 🌿 ${T("Hidden in bushes", "Im Busch unsichtbar")}</span>`;
    box.classList.add("on"); clearTimeout(C.tipT); C.tipT = setTimeout(() => box.classList.remove("on"), 6500); }
  function start(){
    C.started = true; const sp = C.A.sp[me()]; C.me = sp ? {x: sp.x, y: sp.y, a: 0, f: 1, mv: false} : null; C.am = AMMO; C.rl = 0; C.cd = 0; C.sup = 0; C.chg = null; C.cls = C.A.cls[me()] || "shot";
    if (amIn()){ banner(T("GO!", "LOS!"), "go"); snd("go"); Haptic.go([20, 40, 20]); hint(); }
  }
  /* the arena takes the screen once the wheel has stopped, until the winner has been shown (on its own: for good) */
  function active(){ const v = NPo().v, mg = v && v.phase === "meet" && v.meet && v.meet.mg; if (!mg || mg.g !== "arena" || !C.A || C.seed !== mg.seed){ if (C.on && !(v && v.arena && v.phase === "meet")) leaveLayer(); return C.on; }
    const on = (v.arena || now() - C.t0 >= N().SPIN) && !(C.doneAt && now() - C.doneAt > BAN && !v.arena); if (on && !C.on) enter(); if (!on && C.on) leaveLayer(); return on; }
  function hold(mg){ if (C.v && C.v.arena) return 1e9; const extra = mg.win === me() && C.A && C.A.perk && !C.A.perk.pick ? PERK : 0; return N().RES + BAN + extra; }

  /* ---- the layer above the arena: fighter pick, sticks, health, kills ---- */
  function enter(){
    C.on = true; const NP = NPo(); if (!NP.el) return; NP.el.classList.add("arena"); NP.joy = null; try { Focus.set(true); } catch(e) {}
    let L = C.L; if (!L || !L.isConnected){ L = C.L = document.createElement("div"); L.className = "ar-l"; L.lang = (window.I18N && I18N.lang) || "de";
      L.innerHTML = `<div class="ar-hud"><span class="ar-rd"></span><span class="ar-t"></span><span class="ar-n"></span><span class="ar-gas">☠️ ${T("Gas", "Gas")}</span><span class="ar-sp" hidden>👀 ${T("Watching", "Zuschauen")}</span></div><div class="ar-feed"></div><div class="ar-ban"></div><div class="ar-pick"></div><div class="ar-joy"><i></i></div>
        <div class="ar-sup"><b></b><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/></svg></div><div class="ar-fire"><b></b><span class="ar-am"><i><u></u></i><i><u></u></i><i><u></u></i></span></div><div class="ar-res"></div><div class="ar-tip"></div><button class="ar-emb" aria-label="Emote">😀</button><div class="ar-emp">${EMO.map(e => `<button data-em="${e}">${e}</button>`).join("")}</div>`;
      NP.el.appendChild(L); wire(L); }
    pickDraw(true);
  }
  function leaveLayer(){ if (C.on) try { Focus.set(false); } catch(e) {} C.on = false; const NP = NPo(); if (NP && NP.el) NP.el.classList.remove("arena"); if (Q.d0 && NP && NP.rs){ Q.d0 = 0; try { NP.rs(); } catch(e) {} } if (C.L){ C.L.remove(); C.L = null; } C.moveP = C.aimP = C.supP = null; C.chg = null; }
  function banner(txt, cls){ C.ban = {txt, cls, t: now()}; const b = C.L && C.L.querySelector(".ar-ban"); if (b){ b.className = "ar-ban on " + (cls || ""); b.innerHTML = txt; b.style.animation = "none"; void b.offsetWidth; b.style.animation = ""; }
    /* the top hint sits where the banner shows: step aside while it plays */
    const tp = C.L && C.L.querySelector(".ar-tip"); if (tp){ tp.classList.add("ban"); clearTimeout(C.banT); C.banT = setTimeout(() => tp.classList.remove("ban"), 1900); } }
  /* the sniper: holding the fire button (or the mouse, or space) charges the next shot */
  function startChg(){ if (C.cls !== "snipe" || !fighting() || C.am < 1 || C.chg) return; C.chg = {t0: now()}; snd("charge"); }
  function wire(L){
    const gw = () => NPo().el.offsetWidth, LOC = N().LOC, joy = L.querySelector(".ar-joy"), knob = joy.firstChild, fb = L.querySelector(".ar-fire"), fk = fb.firstChild, sb = L.querySelector(".ar-sup"), sk = sb.firstChild;
    const emb = L.querySelector(".ar-emb"), emp = L.querySelector(".ar-emp");
    emb.onclick = () => { Sound.tap(); emp.classList.toggle("on"); };
    emp.onclick = e => { const b = e.target.closest("[data-em]"); if (!b) return; emp.classList.remove("on"); if (now() - (C.emT || 0) < 1500) return; C.emT = now(); send({t: "aem", e: b.dataset.em}); Haptic.go(8); };
    /* with a mouse (laptop, PC): WASD/arrows walk, click shoots where the pointer is, right-click fires the super */
    const mouseShot = (e, su, ch) => { const p = LOC(e), zc = C.z || 1, s = C.scr || {x: gw() / 2, y: NPo().el.offsetHeight / 2}; if (!C.me || !fighting()) return;
      const dx = p.x - s.x, dy = p.y - s.y; fire(Math.atan2(dy, dx), su, Math.hypot(dx, dy) / zc, ch); };
    const unpress = () => L.querySelectorAll(".ar-card.press").forEach(b => b.classList.remove("press"));
    L.addEventListener("contextmenu", e => { if (e.target.closest("button")) return; e.preventDefault(); if (C.sup >= 1) mouseShot(e, true); });
    L.addEventListener("pointerdown", e => { const cb = e.target.closest(".ar-card"); if (cb && !cb.disabled) cb.classList.add("press");
      if (e.pointerType === "mouse" && !e.target.closest("button,.ar-sup,.ar-fire,.ar-res,.ar-pick,.ar-emp")){ e.preventDefault(); emp.classList.remove("on"); if (e.button === 0){ if (C.cls === "snipe" && fighting()){ startChg(); C.mHold = {e, sn: 1}; } else { mouseShot(e); C.mHold = {e, t: now(), sh: ev => mouseShot(ev)}; } } return; }
      if (e.target.closest("button")) return; emp.classList.remove("on"); e.preventDefault(); const p = LOC(e);
      if (e.target.closest(".ar-sup")){ if (C.supP || C.sup < 1 || !fighting()) return; C.supP = {x0: p.x, y0: p.y, dx: 0, dy: 0, id: e.pointerId, man: false}; sb.classList.add("on"); }
      else if (p.x < gw() * .45){ if (C.moveP) return; C.moveP = {x0: p.x, y0: p.y, dx: 0, dy: 0, id: e.pointerId}; joy.style.left = p.x + "px"; joy.style.top = p.y + "px"; joy.classList.add("on"); knob.style.transform = "translate(-50%,-50%)"; }
      else { if (C.aimP) return; C.aimP = {x0: p.x, y0: p.y, dx: 0, dy: 0, id: e.pointerId, man: false}; fb.classList.add("on"); fb.style.left = (p.x - 55) + "px"; fb.style.top = (p.y - 55) + "px"; fk.style.transform = ""; startChg(); }
      try { L.setPointerCapture(e.pointerId); } catch(_) {} });
    L.addEventListener("pointermove", e => { if (C.mHold && e.pointerType === "mouse") C.mHold.e = e; const p = LOC(e);
      if (C.moveP && e.pointerId === C.moveP.id){ let dx = p.x - C.moveP.x0, dy = p.y - C.moveP.y0; const d = Math.hypot(dx, dy), m = 56; if (d > m){ dx *= m / d; dy *= m / d; } C.moveP.dx = dx / m; C.moveP.dy = dy / m; knob.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`; }
      const st = (P2, k) => { let dx = p.x - P2.x0, dy = p.y - P2.y0; const d = Math.hypot(dx, dy); if (d > 16) P2.man = true; P2.dx = dx; P2.dy = dy; const kk = Math.min(1, 40 / Math.max(1, d)); k.style.transform = `translate(${dx * kk}px,${dy * kk}px)`; };
      if (C.aimP && e.pointerId === C.aimP.id) st(C.aimP, fk);
      if (C.supP && e.pointerId === C.supP.id) st(C.supP, sk); });
    const up = e => { unpress(); if (e.pointerType === "mouse"){ if (C.mHold && C.mHold.sn && e.type === "pointerup"){ const ch = chgNow(), ev = C.mHold.e; C.chg = null; mouseShot(ev, false, ch); } else if (C.mHold && C.mHold.sn) C.chg = null; C.mHold = null; }
      if (C.moveP && e.pointerId === C.moveP.id){ C.moveP = null; joy.classList.remove("on"); }
      if (C.aimP && e.pointerId === C.aimP.id){ const a = C.aimP, ch = chgNow(); C.aimP = null; C.chg = null; fb.classList.remove("on"); fb.style.left = fb.style.top = ""; fk.style.transform = "";
        if (e.type === "pointerup") { if (a.man) fire(Math.atan2(a.dy, a.dx), false, Math.hypot(a.dx, a.dy), ch); else autoFire(false, ch); } }
      if (C.supP && e.pointerId === C.supP.id){ const a = C.supP; C.supP = null; sb.classList.remove("on"); sk.style.transform = "";
        if (e.type === "pointerup") { if (a.man) fire(Math.atan2(a.dy, a.dx), true, Math.hypot(a.dx, a.dy)); else autoFire(true); } } };
    L.addEventListener("pointerup", up); L.addEventListener("pointercancel", up);
    L.addEventListener("click", e => { const b = e.target.closest("[data-arc]"); if (b) return pick(b.dataset.arc); const x = e.target.closest("[data-arx]"); if (!x) return; Sound.tap();
      if (x.dataset.arx === "lobby") NPo().act({a: "tolobby"}); if (x.dataset.arx === "quit") NPo().openPanel && NPo().openPanel("quit"); });
    if (!C.kd){ C.kd = e => { if (!C.on) return; if (/^(Arrow|Key[WASD])/.test(e.code)){ C.keys[e.code] = 1; e.preventDefault(); }
        if (e.code === "Space"){ e.preventDefault(); if (!e.repeat){ if (C.cls === "snipe") startChg(); else autoFire(); } } if (e.code === "KeyE" || e.code === "KeyQ"){ e.preventDefault(); autoFire(true); }
        /* on the pick screen, 1–7 picks a fighter */
        const dg = /^Digit([1-9])$/.exec(e.code); if (dg && C.A && C.A.ph === "pick" && KEYS[+dg[1] - 1] && !/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || "")) pick(KEYS[+dg[1] - 1]); };
      C.ku = e => { delete C.keys[e.code]; if (e.code === "Space" && C.chg){ const ch = chgNow(); C.chg = null; autoFire(false, ch); } };
      window.addEventListener("keydown", C.kd); window.addEventListener("keyup", C.ku); }
  }
  function pick(k){ if (!KEYS.includes(k) || !C.A || C.A.ph !== "pick" || !amIn()) return; C.A.cls[me()] = k; PG.st.arCls = k; try { PG.persist(); } catch(e) {} snd("pick", null, KEYS.indexOf(k)); Haptic.go(12); NPo().act({a: "arcl", v: k}); pickDraw();
    const b = C.L && C.L.querySelector(`.ar-card[data-arc="${k}"]`); if (b){ b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); } }
  /* the cards are built once and then only updated, so a tap never lands on a card that is being replaced */
  function pickDraw(force){
    const box = C.L && C.L.querySelector(".ar-pick"); if (!box) return; const A = C.A, on = A && A.ph === "pick"; box.classList.toggle("on", !!on); if (!on) return;
    if (amIn() && !C.picked){ C.picked = 1; const k = KEYS.includes(PG.st.arCls) ? PG.st.arCls : KEYS[Math.floor(Math.random() * KEYS.length)]; if (A.cls[me()] !== k){ A.cls[me()] = k; NPo().act({a: "arcl", v: k}); } }
    const left = Math.max(0, C.pickEnd - now()), mine = A.cls[me()], inn = !!amIn();
    if (!box._built || box._in !== inn){ box._built = 1; box._in = inn;
      box.innerHTML = `<div class="ar-pt">${inn ? T("Pick your fighter", "Wähl deinen Kämpfer") : "👻 " + T("You're watching", "Du schaust zu")}</div><div class="ar-cards">${KEYS.map((k, ki) => { const c = CLS[k];
        return `<button class="ar-card" data-arc="${k}" style="--c:${c.c}" ${inn ? "" : "disabled"}><kbd class="ar-kb">${ki + 1}</kbd><span class="ar-ok">✓</span><span class="ar-pic">${badge(k)}</span><b>${esc(nm(c))}</b><small>${esc(T(c.sen, c.sde))}</small><em>★ ${esc(nm(c.su))}</em><i class="hp">♥ ${c.hp}<u></u></i><span class="who"></span></button>`; }).join("")}</div><div class="ar-pbar"><i></i></div>`; }
    const P = NPo().pl();
    box.querySelectorAll(".ar-card").forEach(b => { const k = b.dataset.arc, sel = mine === k; if (b.classList.contains("sel") !== sel) b.classList.toggle("sel", sel);
      const tr = (PG.st.nsCls || {})[k], u = b.querySelector(".hp u"), ut = tr ? "🏆 " + tr : ""; if (u.textContent !== ut) u.textContent = ut;
      const who = A.ids.filter(id => A.cls[id] === k), wk = who.join(","), w = b.querySelector(".who"); if (w._k !== wk){ w._k = wk; w.innerHTML = who.slice(0, 5).map(id => `<span class="np-hd sm">${headOf(id, P)}</span>`).join(""); } });
    const bar = box.querySelector(".ar-pbar i"); if (bar) bar.style.width = Math.min(100, left / (C.pickDur || PICK) * 100) + "%";
  }
  const HC = {};
  function headOf(id, P){ const p = (P || NPo().pl()).find(x => x.id === id), k = id + (p && p.av ? JSON.stringify(p.av).length : 0); if (HC[k]) return HC[k]; try { return HC[k] = avatarSVG(Object.assign({}, p && p.av || {}, {aura: "none", pet: "none"}), {head: true, size: 22}); } catch(e) { return ""; } }
  const fIco = k => CLS[k] ? `<span class="ar-fi" style="--c:${CLS[k].c}">${glyph(k)}</span>` : "💀";
  function hud(){
    const L = C.L; if (!L || !C.A) return; const A = C.A, n = A.ids.filter(id => !A.out.includes(id)).length, v = C.v || {};
    const t = A.ph === "fight" ? `⏱ ${Math.max(0, Math.ceil((C.endAt - now()) / 1000))}` : A.ph === "pick" ? `⏱ ${Math.ceil(Math.max(0, C.pickEnd - now()) / 1000)}` : "⏱ 0";
    const set = (s, tx) => { const e = L.querySelector(s); if (e.textContent !== tx) e.textContent = tx; };
    set(".ar-t", t); set(".ar-n", `🧍 ${n}`); const rd = L.querySelector(".ar-rd"); rd.hidden = !v.arena; if (v.arena) set(".ar-rd", `⭐ ${T("Round", "Runde")} ${v.arRound || 1} · ${T(LAY.en, LAY.de)}`);
    L.querySelector(".ar-gas").classList.toggle("on", A.ph === "fight" && now() - C.fightT0 > GZ.a - 2000);
    { const sp = L.querySelector(".ar-sp"), on = A.ph === "fight" && (!amIn() || A.out.includes(me())); if (sp.hidden === on) sp.hidden = !on; }
    const fh = (A.feed || []).slice(-3).map(([by, vic, c]) => `<div>${by ? `<b>${esc(NPo().nm(by))}</b> ${fIco(c)} ` : "☠️ "}<b>${esc(NPo().nm(vic))}</b></div>`).join(""), fe = L.querySelector(".ar-feed"); if (fe._h !== fh){ fe._h = fh; fe.innerHTML = fh; }
    const fb = L.querySelector(".ar-fire"), sb = L.querySelector(".ar-sup"), show = !!fighting(); fb.style.display = sb.style.display = show ? "" : "none";
    if (show){ const cl = CLS[C.cls]; if (fb._k !== C.cls){ fb._k = C.cls; fb.style.setProperty("--c", cl.c); fb.firstChild.innerHTML = glyph(C.cls); sb.firstChild.innerHTML = glyph(C.cls); }
      fb.querySelectorAll(".ar-am i").forEach((x, i) => { const f = i < C.am ? 1 : i === C.am ? Math.round(Math.min(1, C.rl / cl.rl) * 20) / 20 : 0; if (x._f !== f){ x._f = f; x.firstChild.style.transform = `scaleX(${f})`; x.classList.toggle("full", f >= 1); } });
      fb.classList.toggle("chg", !!C.chg); sb.classList.toggle("ready", C.sup >= 1); const so = String(Math.round(289 * (1 - Math.min(1, C.sup)))); if (sb._so !== so){ sb._so = so; sb.querySelector("circle").style.strokeDashoffset = so; } }
    if (amIn() && A.out.includes(me()) && !C.outShown && !C.doneAt){ C.outShown = true; const place = A.ids.length - A.out.indexOf(me()); banner(`💀 ${T("Out!", "Raus!")}<small>${T("Place", "Platz")} ${place}</small>`, "out"); }
    pickDraw(); resDraw();
  }
  /* on its own: between rounds the table, the countdown and the way back to the lobby */
  function resDraw(){
    const box = C.L && C.L.querySelector(".ar-res"), v = C.v; if (!box) return; const on = !!(v && v.arena && C.doneAt && now() - C.doneAt > 1700); box.classList.toggle("on", on); if (!on) return;
    const P = NPo().pl(), W = v.arWins || {}, K = v.arK || {}, ids = (C.A.ids || []).slice().sort((a, b) => (W[b] || 0) - (W[a] || 0) || (K[b] || 0) - (K[a] || 0)), left = Math.max(0, Math.ceil((C.doneAt + NEXT - now()) / 1000));
    const h = `<div class="ar-rbox"><div class="ar-rt">${C.winTeam ? (C.winTeam === "h" ? `👑 <b>${T("You", "Ihr")}</b> ${T("win round", "gewinnt Runde")} ${v.arRound || 1}` : `🤖 <b>${T("The bots", "Die Bots")}</b> ${T("win round", "gewinnen Runde")} ${v.arRound || 1}`) : C.win ? `👑 <b>${esc(NPo().nm(C.win))}</b> ${T("wins round", "gewinnt Runde")} ${v.arRound || 1}` : T("Draw", "Unentschieden")}</div>${C.rew ? `<div class="ar-rw">${(() => { const oi = (C.A.out || []).indexOf(me()), pl = C.rew.won ? 1 : oi < 0 ? 0 : (C.A.ids || []).length - oi; return !C.A.team && !C.rew.won && pl > 1 ? `${T("Place", "Platz")} ${pl} · ` : ""; })()}+${C.rew.xp} XP${C.rew.won ? " · 🏆 +1" : ""}${C.rew.k ? ` · 💀 ${C.rew.k}` : ""}</div>` : ""}
      <div class="ar-rl ${ids.length > 4 ? "two" : ""}">${ids.map((id, i) => `<div class="${id === me() ? "me" : ""}"><span class="r">${i + 1}</span><span class="np-hd">${headOf(id, P)}</span><b>${esc(NPo().nm(id))}</b><span class="w">🏆 ${W[id] || 0}</span><span class="k">💀 ${K[id] || 0}</span></div>`).join("")}</div>
      <div class="ar-rn">${T("Next round in", "Nächste Runde in")} <b>${left}</b> · ${(() => { const L2 = LAYS[(LAYS.indexOf(LAY) + 1) % LAYS.length]; return T(L2.en, L2.de); })()}</div><div class="ar-rb">${v.host && !(PNet.P && PNet.P.solo) ? `<button class="btn ghost" data-arx="lobby">↩︎ ${T("To the lobby", "Zur Lobby")}</button>` : ""}<button class="btn ghost" data-arx="quit">🚪 ${T("Leave", "Raus")}</button></div></div>`;
    if (box._h !== h){ box._h = h; box.innerHTML = h; }
  }

  /* ---- shooting ---- */
  function nearestEnemy(rg, noLos){ let best = null; C.A.ids.forEach(id => { if (id === me() || !alive(id) || !visible(id) || mate(id, me())) return; const q = pos(id); if (!q) return; const d = Math.hypot(q.x - C.me.x, q.y - C.me.y); if (d > rg) return; if (!noLos && !clear(C.me, q)) return; if (!best || d < best.d) best = {id, q, d}; }); return best; }
  function nearCrate(rg, noLos){ let best = null; for (const cr of MP.cr){ if (!MP.ca[cr.c]) continue; const d = Math.hypot(cr.x - C.me.x, cr.y - C.me.y); if (d > rg + 28 || (best && d >= best.d)) continue; if (!noLos && !clear(C.me, cr, cr.c)) continue; best = {x: cr.x, y: cr.y, d}; } return best; }
  /* the tap: aims at the nearest enemy you can see, else at the nearest crate */
  function autoFire(su, ch){ if (!fighting()) return; const cl = CLS[C.cls], s2 = su ? cl.su : cl, at = !!(cl.lob || (su && cl.su.at)), rg = (s2.rg || cl.rg) * 1.12 + (C.cls === "punch" && !su ? BODY : 0), t = nearestEnemy(rg, at);
    if (!t){ const cb = !su && nearCrate(C.cls === "punch" ? cl.rg + 10 : cl.rg, at); if (cb) return fire(Math.atan2(cb.y - C.me.y, cb.x - C.me.x), su, at ? -cb.d : 0, ch); return fire(C.me.a || 0, su, 0, ch); }
    const v = velOf(t.id), sp = s2.v || cl.v, tt = cl.lob ? cl.lob / 1000 : at ? .3 : C.cls === "zap" || C.cls === "punch" ? 0 : sp ? t.d / sp : 0, tx = t.q.x + v.x * tt, ty = t.q.y + v.y * tt; C.autoLine = {x: t.q.x, y: t.q.y, t: now()};
    fire(Math.atan2(ty - C.me.y, tx - C.me.x), su, at ? -Math.hypot(tx - C.me.x, ty - C.me.y) : 0, ch); }
  /* how far a throw (or a jump, or a storm) goes: the stick's length, or, negative, an exact distance from the auto aim */
  const throwDist = (cl, su, len) => { const rg = su && cl.su.rg ? cl.su.rg : cl.rg; if (len < 0) return Math.min(rg, Math.max(70, -len)); return len ? rg * Math.max(.25, Math.min(1, (len - 16) / 70)) : rg * .75; };
  /* the lightning: the first enemy along the aim, then up to two more close to the last one */
  function zapPath(from, a, by){ const cl = CLS.zap; let cur = null, bd = 1e9;
    C.A.ids.forEach(id => { if (id === by || !alive(id) || mate(id, by)) return; const q = pos(id); if (!q) return; const d = Math.hypot(q.x - from.x, q.y - from.y); if (d > cl.rg + BODY || angDiff(Math.atan2(q.y - from.y, q.x - from.x), a) > .2 + Math.atan2(BODY, Math.max(1, d)) || !clear(from, q)) return; if (d < bd){ bd = d; cur = id; } });
    if (!cur){ const e = rayEnd(from, a, cl.rg); return {tg: [], ex: Math.round(e.x), ey: Math.round(e.y), cr: e.cr}; }
    const tg = [cur]; while (tg.length < 3){ const l = pos(tg[tg.length - 1]); let nx = null, nd = 1e9; C.A.ids.forEach(id => { if (tg.includes(id) || id === by || !alive(id) || mate(id, by)) return; const q = pos(id); if (!q) return; const d = Math.hypot(q.x - l.x, q.y - l.y); if (d < cl.jump && d < nd && clear(l, q)){ nd = d; nx = id; } }); if (!nx) break; tg.push(nx); }
    return {tg}; }
  function fire(a, su, len, ch){
    if (!fighting()) return; const cl = CLS[C.cls];
    if (su){ if (C.sup < 1) return; C.sup = 0; } else { if (C.am < 1 || C.cd > 0){ if (C.am < 1) snd("empty"); return; } C.am--; C.cd = cl.cd; }
    C.me.a = a; C.me.f = Math.cos(a) < 0 ? -1 : 1;
    const m = {t: "as", by: me(), k: me().slice(0, 3) + (++C.seq), c: C.cls, x: Math.round(C.me.x), y: Math.round(C.me.y), a: Math.round(a * 1000) / 1000};
    if (su) m.s = 1; if (cl.lob || (su && cl.su.at)) m.r = Math.round(throwDist(cl, su, len || 0));
    if (C.cls === "snipe" && !su) m.ch = Math.round(Math.min(1, ch || 0) * 100);
    if (C.cls === "zap" && !su) Object.assign(m, zapPath(C.me, a, me()));
    send(m); Haptic.go(su ? [15, 20, 25] : C.cls === "snipe" && ch > .9 ? [12, 20, 12] : 8);
  }
  /* a shot happens (ours too): bullets fly, fists and lightning hit at once. Whoever fired decides the hits */
  function shot(m){
    const cl = CLS[m.c]; if (!cl || !C.A) return; const a = +m.a || 0, by = m.by, su = !!m.s, au = authOf(by), t = now(); C.shotAt[by] = t;
    let from = {x: +m.x, y: +m.y}; if (by !== me()){ const p = C.AP[by]; if (p){ p.a = a; p.f = Math.cos(a) < 0 ? -1 : 1; p.shotT = t; p.chg = 0; if (p.dx != null && Math.hypot(p.dx - from.x, p.dy - from.y) < 140 && !HB.bots[by]) from = {x: p.dx, y: p.dy}; } }
    if (su){ snd("super", from); C.fx.push({k: "sup", x: from.x, y: from.y, t}); }
    const s2 = su ? Object.assign({}, cl, cl.su) : cl;
    if (m.c === "punch"){
      if (su){ const d = Math.min(s2.rg, Math.max(60, +m.r || s2.rg * .75)); let x1 = from.x + Math.cos(a) * d, y1 = from.y + Math.sin(a) * d; for (let i = 0; i < 24 && !walkA(x1, y1); i++){ x1 -= Math.cos(a) * 14; y1 -= Math.sin(a) * 14; } if (!walkA(x1, y1)){ x1 = from.x; y1 = from.y; }
        const J = {x0: from.x, y0: from.y, x1, y1, t0: t, dur: s2.dur, k: m.k, au}; C.jump[by] = J; if (by === me() && C.me) C.me.dash = J; else if (isHost() && HB.bots[by]) HB.bots[by].dash = J; return; }
      for (let i = 0; i < cl.jabs; i++) C.jabs.push({at: t + i * 115, by, a, k: m.k + ":" + i, i, au}); return; }
    if (m.c === "zap"){
      if (su){ const d = Math.min(s2.rg, Math.max(60, +m.r || s2.rg * .75)); C.storms.push({x: from.x + Math.cos(a) * d, y: from.y + Math.sin(a) * d, by, au, k: m.k, t0: t, n: 0}); snd("zap", from); return; }
      const tg = (Array.isArray(m.tg) ? m.tg : []).filter(id => C.A.ids.includes(id)).slice(0, 3), pts = [[from.x + Math.cos(a) * 22, from.y - 36 + Math.sin(a) * 22]];
      tg.forEach((id, i) => { const q = pos(id); if (!q) return; pts.push([q.x, q.y - 42]); C.hitAt[id] = t; if (au) hitOut(id, cl.chain[i] || 12, m.k + ":" + id, by); });
      if (!tg.length){ pts.push([m.ex != null ? +m.ex : from.x + Math.cos(a) * cl.rg, (m.ey != null ? +m.ey : from.y + Math.sin(a) * cl.rg) - 36]); const ci = m.cr != null ? +m.cr : -1; if (ci >= 0 && MP.cr[ci]){ crateFx(ci); if (au) hitCrate(ci, cl.dmg, m.k + "c", by); } }
      C.fx.push({k: "zap", pts, t, d: 260}); snd("zap", from); return; }
    if (cl.lob){ const d = Math.min(s2.rg, Math.max(40, +m.r || s2.rg * .75)); snd("throw", from);
      C.proj.push({k: m.k, by, c: m.c, su, lob: 1, x0: from.x, y0: from.y, x1: from.x + Math.cos(a) * d, y1: from.y + Math.sin(a) * d, x: from.x, y: from.y, t, dur: cl.lob * (.6 + .4 * d / s2.rg), au, done: {}}); return; }
    if (m.c === "gun"){ for (let i = 0; i < s2.n; i++) C.burst.push({at: t + i * s2.gap, by, a, k: m.k + ":" + i, i, su, au, x: i ? null : from.x, y: i ? null : from.y}); return; }
    if (m.c === "rang"){ snd("rang", from); const n = s2.n || 1; for (let i = 0; i < n; i++){ const aa = a + (n > 1 ? (i - (n - 1) / 2) * s2.spr : 0); C.proj.push({k: m.k + ":" + i, by, c: m.c, su, rang: 1, x: from.x + Math.cos(aa) * 16, y: from.y + Math.sin(aa) * 16, vx: Math.cos(aa) * cl.v, vy: Math.sin(aa) * cl.v, tr: 0, rg: s2.rg, r: cl.r, t, au, done: {}, cd: {}}); } return; }
    /* shotgun pellets and the sniper's bullet (faster and fatter the longer it was charged) */
    const ch = m.c === "snipe" && !su ? Math.max(0, Math.min(100, +m.ch || 0)) : 0, n = s2.n || 1;
    snd(m.c === "snipe" ? "snipe" : "shot", from, ch / 100); C.fx.push({k: "flash", x: from.x + Math.cos(a) * 30, y: from.y + Math.sin(a) * 30, a, t, big: m.c === "shot" || ch > 60});
    for (let i = 0; i < n; i++){ const aa = a + (n > 1 ? (i - (n - 1) / 2) * s2.spr : 0), v = s2.v * (1 + ch / 200);
      C.proj.push({k: m.k + ":" + i, sk: m.k, by, c: m.c, su, ch, x: from.x + Math.cos(aa) * 16, y: from.y + Math.sin(aa) * 16, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, tr: 0, rg: s2.rg, r: (s2.r || cl.r) + ch / 25, t, au, pierce: su && m.c === "snipe", done: {}, cd: {}}); }
  }
  const dmgOf = p => { const cl = CLS[p.c]; if (p.su && cl.su.dmg) return cl.su.dmg; if (p.c === "snipe") return Math.round(cl.dmg + cl.chg * Math.pow((p.ch || 0) / 100, 1.3)); return cl.dmg; };
  /* a hit that this phone decides: tell everyone (the host keeps the health) */
  function hitOut(v, d, k, by, ex){ if (!(d > 0) || !C.A || !alive(v) || mate(v, by)) return; if (by && by !== v) d *= 1 + CUBE * (C.pw[by] || 0); const m = {t: "ah", v, by: by || "", d: Math.round(d), k};
    if (ex && ex.kx != null){ m.kx = Math.round(ex.kx); m.ky = Math.round(ex.ky); }
    send(m); if (by === me() && v !== me()){ const was = C.sup; C.sup = Math.min(1, C.sup + d / CLS[C.cls].sc); if (was < 1 && C.sup >= 1){ snd("ready"); Haptic.go([10, 30, 10]); } } }
  function hitCrate(i, d, k, by){ if (!(d > 0) || i < 0 || C.crb.has(i) || !MP.cr[i]) return; if (by) d *= 1 + CUBE * (C.pw[by] || 0); send({t: "ach", i, d: Math.round(d), k: String(k).slice(0, 32)}); }
  /* every screen shows the hit on a crate at once: it shakes, flashes, chips fly */
  function crateFx(i){ const cr = MP.cr[i]; if (!cr || t0Crf(i)) return; C.crf[i] = now(); C.fx.push({k: "chip", x: cr.x, y: cr.y, t: now(), d: 420}); snd("crack", cr); }
  const t0Crf = i => now() - (C.crf[i] || 0) < 30;
  const hitCone = (from, a, r, cone, by, sky) => C.A.ids.filter(id => { if (id === by || !alive(id) || mate(id, by)) return false; const q = pos(id); if (!q) return false; const d = Math.hypot(q.x - from.x, q.y - from.y); if (d > r + BODY) return false;
    if (cone && angDiff(Math.atan2(q.y - from.y, q.x - from.x), a) > cone + Math.atan2(BODY, Math.max(1, d))) return false; return sky || clear(from, q); });
  function cratesIn(x, y, r, a, cone){ const out = [], i0 = Math.max(0, Math.floor((x - r - TS) / TS)), i1 = Math.min(MW - 1, Math.floor((x + r + TS) / TS)), j0 = Math.max(0, Math.floor((y - r - TS) / TS)), j1 = Math.min(MH - 1, Math.floor((y + r + TS) / TS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){ const c = j * MW + i, k = MP.ca[c]; if (!k) continue; const cx = (i + .5) * TS, cy = (j + .5) * TS, d = Math.hypot(cx - x, cy - y); if (d > r + 30) continue; if (cone != null && d > 20 && angDiff(Math.atan2(cy - y, cx - x), a) > cone + Math.atan2(32, d)) continue; out.push(k - 1); }
    return out; }
  /* something touches a body */
  function bodyAt(p){ const ids = C.A.ids; for (let i = 0; i < ids.length; i++){ const id = ids[i]; if (id === p.by || !alive(id) || p.done[id] || mate(id, p.by)) continue; const q = pos(id); if (!q) continue; if (Math.hypot(q.x - p.x, q.y - p.y) < BODY + p.r) return id; } return null; }
  /* the boxer's jump: through the air, he lands where it was aimed */
  function dashStep(o){ const d = o.dash, k = Math.min(1, (now() - d.t0) / d.dur); o.x = d.x0 + (d.x1 - d.x0) * k; o.y = d.y0 + (d.y1 - d.y0) * k; o.mv = 1; o.f = d.x1 < d.x0 ? -1 : 1; if (k >= 1) o.dash = null; }
  function landed(J, by, t){ const su = CLS.punch.su, p = {x: J.x1, y: J.y1}; C.fx.push({k: "slam", x: p.x, y: p.y, t, d: 700}); snd("slam", p); C.shake = Math.max(C.shake, C.me && Math.hypot(p.x - C.me.x, p.y - C.me.y) < 450 ? 14 : 3);
    cratesIn(p.x, p.y, su.splash).forEach(i => { crateFx(i); if (J.au) hitCrate(i, 60, J.k + "c" + i, by); });
    if (J.au) hitCone(p, 0, su.splash, 0, by, true).forEach(id => { const q = pos(id), dd = Math.hypot(q.x - p.x, q.y - p.y) || 1; hitOut(id, su.dmg, J.k + ":" + id, by, {kx: (q.x - p.x) / dd * su.kb, ky: (q.y - p.y) / dd * su.kb}); }); }
  /* one punch of the three: a short cone right in front */
  function jab(j, t){ const by = j.by, q = pos(by); if (!q || !alive(by)) return; const cl = CLS.punch; C.lunge[by] = t; C.fx.push({k: "jab", x: q.x, y: q.y, a: j.a, t, i: j.i, d: 220}); snd("punch", q);
    cratesIn(q.x, q.y, cl.rg, j.a, cl.cone).forEach(i => { crateFx(i); if (j.au) hitCrate(i, cl.dmg, j.k + "c" + i, by); });
    if (j.au) hitCone(q, j.a, cl.rg, cl.cone, by).forEach(id => hitOut(id, cl.dmg, j.k + ":" + id, by, {kx: Math.cos(j.a) * 20, ky: Math.sin(j.a) * 20})); }
  /* the thunderstorm: a strike every 0.42 s on everyone under the cloud */
  function strike(s, t){ const su = CLS.zap.su, R = rngOf(s.n * 131 + s.t0), an = R() * 7, rr2 = R() * su.splash * .6, x = s.x + Math.cos(an) * rr2, y = s.y + Math.sin(an) * rr2 * .7;
    C.fx.push({k: "bolt", x, y, t, d: 380}); snd("storm", s); if (C.me && Math.hypot(s.x - C.me.x, s.y - C.me.y) < 500) C.shake = Math.max(C.shake, 5);
    cratesIn(s.x, s.y, su.splash).forEach(i => { crateFx(i); if (s.au) hitCrate(i, su.dmg, s.k + "c" + s.n + "_" + i, s.by); });
    if (s.au) hitCone(s, 0, su.splash, 0, s.by, true).forEach(id => hitOut(id, su.dmg, s.k + ":" + s.n + ":" + id, s.by)); }
  /* what hurts where I stand: the gas */
  function hazards(q, id, el, gr){ return {dps: el >= GZ.a && Math.hypot(q.x - GC.x, q.y - GC.y) > gr ? 24 : 0, by: ""}; }
  function onMsg(m){
    if (!m || !m.t) return;
    if (m.t === "afl" || m.t === "abr"){ FX.msg(m); return; }
    if (!C.A){ return; }
    const host = isHost();
    if (m.t === "am"){ if (m.id !== me()) onPos(m.id, +m.x, +m.y, (+m.a || 0) / 100, m.f, m.m, clk(m.id, m.ts), (+m.c || 0) / 100); }
    else if (m.t === "amb"){ if (!host && Array.isArray(m.l)){ const st = clk(m.id, m.ts); m.l.forEach(([id, x, y, a, mv, f, c]) => onPos(id, x, y, a / 100, f, mv, st, (+c || 0) / 100)); } }
    else if (m.t === "as"){ if (host){ const mg = hostMg(); if (mg && mg.ar.ids.includes(m.by)) mg.ar.ls[m.by] = now(); } shot(m); }
    else if (m.t === "ah"){ const v = m.v || m.id, d = +m.d || 0;
      if (host) hostHit(v, d, m.by && C.A.ids.includes(m.by) ? m.by : "", m.k ? String(m.k).slice(0, 32) : null);
      C.hitAt[v] = now(); if (!(d > 0)) return; const pu = C.A.cls && C.A.cls[m.by] === "punch";
      if (v === me()) hurtFx(d, m, pu);
      else { const q = pos(v); if (q) C.pops.push({x: q.x, y: q.y - 120, txt: "-" + d, t: now(), mine: m.by === me()}); if (m.by === me()) snd(pu ? "thud" : "hit", q);
        if (host && HB.bots[v] && m.kx != null) HB.bots[v].kb = {vx: m.kx / .16, vy: m.ky / .16, until: now() + 160}; } }
    else if (m.t === "ach"){ if (host){ const mg = hostMg(); if (mg) hostCrate(mg.ar, +m.i, +m.d || 0, m.k ? String(m.k).slice(0, 40) : null); } }
    else if (m.t === "acr"){ C.crT = now(); applyCrates(m.b, m.h, false); }
    else if (m.t === "aem"){ const who = m.w && isBot(m.w) ? m.w : m.id; if (EMO.includes(m.e)){ C.emo[who] = {e: m.e, t: now()}; if (who !== me()) snd("hit"); } }
    else if (m.t === "acu"){ const old = C.pw || {}; setCubes(m.c); C.pw = m.pw || {};
      /* someone grabbed a cube: a green burst; mine with the charge-up sound and a buzz */
      for (const id in C.pw){ const n2 = C.pw[id] || 0, n1 = old[id] || 0; if (n2 <= n1) continue; const q = id === me() ? C.me : pos(id); C.glow[id] = now(); if (q) C.fx.push({k: "power", x: q.x, y: q.y, t: now(), d: 820, me: id === me()});
        if (id === me()){ snd("cube", null, n2); Haptic.go([10, 30, 18]); if (q) C.pops.push({x: q.x, y: q.y - 150, txt: "+" + (n2 - n1), t: now(), cube: 1}); } else snd("cube", q, n2); } }
    else if (m.t === "acg"){ if (host){ const mg = hostMg(); if (mg && mg.ar.cubes && mg.ar.ph === "fight") cubeGrab(mg.ar, m.id, +m.k); } }
    else if (m.t === "ahp"){ if (m.mx) C.A.mx = m.mx; C.A.hp = Object.assign({}, m.hp); C.A.out = (m.out || []).slice(); C.A.feed = m.f || []; C.hpT = now();
      if (m.ko){ const q = pos(m.ko); if (q) C.fx.push({k: "ko", x: q.x, y: q.y, t: now()}); snd("ko", q); if (m.ko === me()){ Haptic.go([60, 40, 120]); C.chg = null; }
        /* your KO: a big gold pop over the fallen one and a short buzz */
        const lf = (m.f || [])[(m.f || []).length - 1]; if (q && m.ko !== me() && lf && lf[0] === me() && lf[1] === m.ko){ C.pops.push({x: q.x, y: q.y - 150, txt: "💀 KO!", t: now(), mine: 1, ko: 1}); Haptic.go([15, 30, 15]); }
        /* two left: the final duel */
        const al = C.A.ids.filter(id => !C.A.out.includes(id)); if (!C.A.team && al.length === 2 && C.A.ids.length > 2 && C.A.ph === "fight" && !C.fin){ C.fin = 1; setTimeout(() => { if (C.A && C.A.ph === "fight"){ banner("⚔️ " + T("Final duel!", "Finale!") + `<small>${esc(NPo().nm(al[0]))} vs ${esc(NPo().nm(al[1]))}</small>`, al.includes(me()) ? "win" : ""); snd("final"); if (al.includes(me())) Haptic.go([40, 60, 40]); } }, 700); } } }
  }
  function hurtFx(d, m, pu){
    if (!alive(me()) || !C.me) return; if (C.A.hp[me()] != null) C.A.hp[me()] = Math.max(1, C.A.hp[me()] - d); C.hpT = now();
    if (m.kx != null) C.kb = {vx: m.kx / .16, vy: m.ky / .16, until: now() + 160};
    if (m.by === me() || !m.by) return; /* the gas: no big fuss */
    C.hurtT = now(); C.shake = Math.max(C.shake, d > 20 ? 9 : 6); C.pops.push({x: C.me.x, y: C.me.y - 120, txt: "-" + Math.round(d), t: now(), me: 1}); snd(pu ? "thud" : "hurt"); Haptic.go(d > 20 ? 25 : 10);
  }
  /* the sender's clock mapped onto mine: the quickest message so far sets the offset, so late ones don't make people jump */
  const OFF = {};
  function clk(from, ts){ const r = now(); if (!(ts > 0)) return r; const d = r - ts, o = OFF[from]; OFF[from] = o == null || d < o || d - o > 2000 ? d : o + (d - o) * .01; return ts + OFF[from]; }
  function onPos(id, x, y, a, f, mv, st, chg){ const p = C.AP[id] || (C.AP[id] = {buf: [], dx: x, dy: y}), t = st || now(), b = p.buf, l = b[b.length - 1]; if (l && (Math.hypot(l.x - x, l.y - y) > 300 || t < l.t - 500)) b.length = 0;
    p.chg = chg || 0; if (l && t <= l.t && b.length) return; b.push({t, x, y}); if (b.length > 10) b.shift(); p.a = a; p.f = f || 1; p.mv = !!mv; p.t = now(); }

  const Q = {n: 0, sum: 0, d0: 0};
  function quality(dt){ const NP = NPo(); if (!NP.cv || !C.A || C.A.ph !== "fight" || now() - C.fightT0 < 1200) { Q.n = Q.sum = 0;
      /* tablets and big retina screens start at 1.5× instead of 2×: still sharp, and no stutter in the first seconds */
      if (NP.cv && C.A && C.A.ph === "fight" && NP.dpr > 1.5){ const w0 = NP.cv.width / NP.dpr, h0 = NP.cv.height / NP.dpr; if (w0 * h0 > 5e5){ NP.cv.width = Math.round(w0 * 1.5); NP.cv.height = Math.round(h0 * 1.5); NP.dpr = 1.5; } }
      return; } Q.sum += Math.min(.25, dt);
    /* judge every 60 frames, or after a second when it's slow, so a struggling tablet is smooth within a few seconds */
    if (++Q.n < 60 && !(Q.sum > 1 && Q.n >= 10)) return; const avg = Q.sum / Q.n; Q.n = Q.sum = 0;
    /* big screens (tablets) may go a little below 1:1, the picture stays sharp enough and it runs smooth */
    const w0 = NP.cv.width / NP.dpr, h0 = NP.cv.height / NP.dpr, floor = w0 * h0 > 5e5 ? .75 : 1;
    if (avg > 1 / 45 && NP.dpr > floor + .05){ const w = w0, h = h0, d = Math.max(floor, Math.round((NP.dpr - (avg > 1 / 20 ? .75 : avg > 1 / 28 ? .5 : .34)) * 100) / 100); if (!Q.d0) Q.d0 = NP.dpr; NP.cv.width = Math.round(w * d); NP.cv.height = Math.round(h * d); NP.dpr = d; } }
  function step(dt){
    if (!C.A) return; quality(dt); const A = C.A, t = now(), el = t - C.fightT0, gr = A.ph === "fight" ? gasR(el) : 99999;
    if (fighting()){ const cl = CLS[C.cls]; let ix = 0, iy = 0;
      if (C.me.dash) dashStep(C.me);
      else {
        if (C.mHold && C.mHold.sh && C.am >= 1 && C.cd <= 0) C.mHold.sh(C.mHold.e);
        if (C.moveP){ ix = C.moveP.dx; iy = C.moveP.dy; } const k = C.keys; if (k.ArrowLeft || k.KeyA) ix -= 1; if (k.ArrowRight || k.KeyD) ix += 1; if (k.ArrowUp || k.KeyW) iy -= 1; if (k.ArrowDown || k.KeyS) iy += 1;
        const m = Math.hypot(ix, iy); if (m > 1){ ix /= m; iy /= m; } C.me.mv = m > .05;
        if (C.me.mv){ const sp = SPD * cl.sp * (C.chg ? .55 : 1) * dt, nx = C.me.x + ix * sp, ny = C.me.y + iy * sp; if (walkA(nx, C.me.y)) C.me.x = nx; if (walkA(C.me.x, ny)) C.me.y = ny; if (Math.abs(ix) > .1) C.me.f = ix < 0 ? -1 : 1; if (!(C.aimP && C.aimP.man) && !(C.supP && C.supP.man) && !C.mHold) C.me.a = Math.atan2(iy, ix); }
        if (C.kb && C.kb.until > t){ const nx = C.me.x + C.kb.vx * dt, ny = C.me.y + C.kb.vy * dt; if (walkA(nx, C.me.y)) C.me.x = nx; if (walkA(C.me.x, ny)) C.me.y = ny; } }
      if (C.aimP && C.aimP.man) C.me.a = Math.atan2(C.aimP.dy, C.aimP.dx); if (C.supP && C.supP.man) C.me.a = Math.atan2(C.supP.dy, C.supP.dx);
      if (C.mHold && C.mHold.sn && C.scr){ const NP = NPo(), p = N().LOC(C.mHold.e); C.me.a = Math.atan2(p.y - C.scr.y, p.x - C.scr.x); }
      if (C.chg && !C.chg.full && t - C.chg.t0 >= CHG){ C.chg.full = 1; snd("full"); Haptic.go(8); }
      C.rl += dt * 1000; while (C.am < AMMO && C.rl >= cl.rl){ C.am++; C.rl -= cl.rl; } if (C.am >= AMMO) C.rl = 0; C.cd -= dt * 1000;
      const cq = C.chg ? Math.round(chgNow() * 10) : 0, moved = !C.sentP || Math.hypot(C.me.x - C.sentP.x, C.me.y - C.sentP.y) > 2 || Math.abs(C.me.a - C.sentP.a) > .15 || C.sentP.c !== cq, gap = C.me.dash ? 50 : 95;
      if ((moved && t - C.sent > gap) || t - C.sent > 800){ C.sent = t; C.sentP = {x: C.me.x, y: C.me.y, a: C.me.a, c: cq}; PNet.raw(Object.assign({t: "am", x: Math.round(C.me.x), y: Math.round(C.me.y), a: Math.round(C.me.a * 100), f: C.me.f, m: C.me.mv ? 1 : 0, ts: t}, cq ? {c: cq * 10} : {})); }
      for (const cb of C.cubes) if (Math.hypot(cb.x - C.me.x, cb.y - C.me.y) < 40 && t - (C.cubeT[cb.k] || 0) > 350 && t - (C.cgT[cb.k] || 0) > 600){ C.cgT[cb.k] = t; send({t: "acg", k: cb.k}); }
      const h = hazards(C.me, me(), el, gr); if (h.dps > 0){ C.dot += h.dps * dt; C.dotBy = h.by || C.dotBy; } if (t - C.dotT > 300 && C.dot >= 1){ hitOut(me(), Math.round(C.dot), "d" + me().slice(0, 3) + t, C.dotBy || ""); C.dot = 0; C.dotT = t; C.dotBy = ""; }
    }
    /* everyone else, a moment behind so it stays smooth; a little ahead when a message is late */
    if (isHost()) for (const id in HB.bots){ const b = HB.bots[id], k = b.ut ? Math.min(1, (t - b.ut) / 50) : 1, D = b.D || (b.D = {x: b.x, y: b.y}); D.x = b.px != null ? b.px + (b.x - b.px) * k : b.x; D.y = b.py != null ? b.py + (b.y - b.py) * k : b.y; }
    const rt = t - LAG; for (const id in C.AP){ if (isHost() && HB.bots[id]) continue; const p = C.AP[id], b = p.buf; if (!b || !b.length) continue;
      if (rt <= b[0].t){ p.dx = b[0].x; p.dy = b[0].y; continue; } const l = b[b.length - 1];
      if (rt >= l.t){ const q = b[b.length - 2], ex = Math.min(100, rt - l.t); if (q && l.t > q.t && p.mv){ const f = ex / (l.t - q.t); p.dx = l.x + (l.x - q.x) * Math.min(1, f); p.dy = l.y + (l.y - q.y) * Math.min(1, f); } else { p.dx = l.x; p.dy = l.y; } continue; }
      let i = b.length - 1; while (i > 0 && b[i - 1].t > rt) i--; const a0 = b[i - 1] || b[0], b0 = b[i], f = (rt - a0.t) / Math.max(1, b0.t - a0.t); p.dx = a0.x + (b0.x - a0.x) * f; p.dy = a0.y + (b0.y - a0.y) * f; }
    /* what happens a little later: the boxer's punches, the revolver's bullets, storm strikes, the landing */
    for (const j of C.jabs) if (!j.done && t >= j.at){ j.done = 1; jab(j, t); } prune(C.jabs, j => !j.done);
    for (const b of C.burst){ if (b.done || t < b.at) continue; b.done = 1; const q = b.x != null ? {x: b.x, y: b.y} : pos(b.by); if (!q || !alive(b.by)) continue; const cl = CLS.gun, s2 = b.su ? Object.assign({}, cl, cl.su) : cl, aa = b.a + (((b.i * 37) % 7) - 3) * .007;
      C.proj.push({k: b.k, sk: b.k, by: b.by, c: "gun", su: b.su, x: q.x + Math.cos(aa) * 16, y: q.y + Math.sin(aa) * 16, vx: Math.cos(aa) * s2.v, vy: Math.sin(aa) * s2.v, tr: 0, rg: s2.rg, r: cl.r, t, au: b.au, done: {}, cd: {}});
      C.fx.push({k: "flash", x: q.x + Math.cos(aa) * 30, y: q.y + Math.sin(aa) * 30, a: aa, t}); snd("gun", q); }
    prune(C.burst, b => !b.done);
    { const su = CLS.zap.su; for (const s of C.storms) while (s.n < su.hits && t - s.t0 >= (s.n + 1) * su.every){ s.n++; strike(s, t); } prune(C.storms, s => s.n < su.hits || t - s.t0 < (su.hits + 1) * su.every); }
    for (const id in C.jump){ const J = C.jump[id]; if (!J.landed && t >= J.t0 + J.dur){ J.landed = 1; landed(J, id, t); } if (t > J.t0 + J.dur + 400) delete C.jump[id]; }
    /* bombs */
    for (const p of C.proj){ if (!p.lob || p.dead) continue; const k = Math.min(1, (t - p.t) / p.dur); p.x = p.x0 + (p.x1 - p.x0) * k; p.y = p.y0 + (p.y1 - p.y0) * k;
      if (k >= 1){ p.dead = 1; const cl = CLS[p.c], s2 = p.su ? Object.assign({}, cl, cl.su) : cl; snd("boom", {x: p.x1, y: p.y1}); C.fx.push({k: "boom", x: p.x1, y: p.y1, t, big: p.su}); C.shake = Math.max(C.shake, C.me && Math.hypot(p.x1 - C.me.x, p.y1 - C.me.y) < 400 ? (p.su ? 14 : 9) : 3);
        cratesIn(p.x1, p.y1, s2.splash).forEach(i => { crateFx(i); if (p.au) hitCrate(i, s2.dmg, p.k + "c" + i, p.by); });
        if (p.au) C.A.ids.forEach(id => { if (id === p.by || !alive(id) || mate(id, p.by)) return; const q = pos(id); if (!q) return; const dd = Math.hypot(q.x - p.x1, q.y - p.y1); if (dd > s2.splash + BODY * .6) return;
          const kb = p.su && s2.kb ? {kx: (q.x - p.x1) / (dd || 1) * s2.kb, ky: (q.y - p.y1) / (dd || 1) * s2.kb} : null; hitOut(id, s2.dmg, p.k + ":" + id, p.by, kb); }); } }
    /* bullets and boomerangs: walls stop them, crates take the hit; the boomerang cuts through crates and people and only turns at a wall or its range */
    const turn = p => { p.back = 1; p.done = {}; p.tr = 0; };
    for (const p of C.proj){ if (p.dead || p.lob) continue;
      if (p.rang && p.back){ const q = pos(p.by); if (q && alive(p.by)){ const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, v = CLS.rang.v * 1.08; p.vx = dx / d * v; p.vy = dy / d * v; if (d < 34){ p.dead = 1; continue; } } }
      const sp = Math.hypot(p.vx, p.vy) * dt, n = Math.max(1, Math.ceil(sp / 10)), bk = p.back ? "b" : "";
      for (let i = 0; i < n; i++){ p.x += p.vx * dt / n; p.y += p.vy * dt / n; p.tr += sp / n;
        const ci = crateAt(p.x, p.y);
        if (ci >= 0 && !p.cd[ci + bk]){ p.cd[ci + bk] = 1; crateFx(ci); if (p.au) hitCrate(ci, dmgOf(p), p.k + "c" + ci + bk, p.by);
          if (p.rang || p.pierce) continue; p.dead = 1; C.fx.push({k: "spark", x: p.x, y: p.y, t}); break; }
        const c = cell(p.x, p.y); if (c < 0 || MP.g[c] === 1 || p.tr >= p.rg){ if (p.rang && !p.back){ turn(p); break; } p.dead = 1; C.fx.push({k: "spark", x: p.x, y: p.y, t}); break; }
        const id = bodyAt(p); if (id){ p.done[id] = 1; C.hitAt[id] = t;
          if (p.au){ const kb = p.su && p.c === "shot" && !C.kbDone[p.sk + id] ? (C.kbDone[p.sk + id] = 1, {kx: p.vx / Math.hypot(p.vx, p.vy) * CLS.shot.su.kb, ky: p.vy / Math.hypot(p.vx, p.vy) * CLS.shot.su.kb}) : null; hitOut(id, dmgOf(p), p.k + bk, p.by, kb); }
          if (p.pierce || p.rang){ C.fx.push({k: "spark", x: p.x, y: p.y, t, hit: 1}); continue; }
          p.dead = 1; C.fx.push({k: "spark", x: p.x, y: p.y, t, hit: 1}); break; } } }
    prune(C.proj, p => !p.dead && t - p.t < 3000); prune(C.fx, f => t - f.t < (f.d || 800)); prune(C.pops, p => t - p.t < 900);
    if (Object.keys(C.kbDone).length > 300) C.kbDone = {};
    C.shake *= Math.pow(.02, dt);
    if (t - (C.hudT || 0) > 120){ C.hudT = t; hud(); }
  }

  /* ---- drawing: the map is drawn once in 512 px pieces, crates, cubes, people and bushes on top ---- */
  const CK = 512, CE = 2, MC = {s: 0, ch: new Map(), lay: null};
  const hash = (i, j, k) => { let h = Math.imul(i + 9973, 374761393) ^ Math.imul(j + 7919, 668265263) ^ Math.imul((k || 0) + 31, 2147483629); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const tt = (i, j) => i < 0 || j < 0 || i >= MW || j >= MH ? (i >= -1 && j >= -1 && i <= MW && j <= MH ? 9 : 8) : MP.g[j * MW + i];
  const solidT = v => v === 1 || v === 9;
  const rrr = (c, x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };
  function drawTiles(c, i0, j0, i1, j1){
    /* grass in a soft checkerboard, a few tufts, now and then a flower or a stone */
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){ const v = tt(i, j), x = i * TS, y = j * TS;
      if (v === 8 || v === 9){ c.fillStyle = "#24221E"; c.fillRect(x, y, TS, TS); continue; }
      c.fillStyle = (i + j) % 2 ? "#679941" : "#6FA347"; c.fillRect(x, y, TS, TS); if (v === 2 || v === 1) continue;
      const h = hash(i, j); c.strokeStyle = "rgba(38,78,24,.32)"; c.lineWidth = 2.4; c.lineCap = "round";
      for (let k = 0; k < 2 + Math.floor(h * 3); k++){ const tx = x + 8 + hash(i, j, k + 1) * 48, ty = y + 12 + hash(i, j, k + 7) * 44; c.beginPath(); c.moveTo(tx - 4, ty - 6); c.lineTo(tx, ty); c.lineTo(tx + 4, ty - 7); c.stroke(); }
      if (h > .93){ const fx = x + 14 + hash(i, j, 21) * 36, fy = y + 14 + hash(i, j, 22) * 36; c.fillStyle = h > .965 ? "#F4E37A" : "#F6F1E7"; for (let k = 0; k < 5; k++){ c.beginPath(); c.arc(fx + Math.cos(k * 1.26) * 4, fy + Math.sin(k * 1.26) * 4, 3, 0, 7); c.fill(); } c.fillStyle = "#E9A92B"; c.beginPath(); c.arc(fx, fy, 2.4, 0, 7); c.fill(); }
      else if (h < .035){ const sx = x + 16 + hash(i, j, 23) * 30, sy = y + 18 + hash(i, j, 24) * 30; c.fillStyle = "#8E877C"; c.beginPath(); c.ellipse(sx, sy, 8, 5.5, 0, 0, 7); c.fill(); c.fillStyle = "rgba(255,255,255,.25)"; c.beginPath(); c.ellipse(sx - 2, sy - 2, 4, 2.4, 0, 0, 7); c.fill(); } }
    /* ponds: blue with a dark bank on top and light foam along the edges */
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){ if (tt(i, j) !== 2) continue; const x = i * TS, y = j * TS, w = (a, b) => tt(a, b) === 2;
      c.fillStyle = "#3C8DB4"; c.fillRect(x, y, TS, TS); c.fillStyle = "rgba(10,40,70,.28)"; if (!w(i, j - 1)) c.fillRect(x, y, TS, 12);
      c.fillStyle = "rgba(205,240,255,.6)"; if (!w(i, j + 1)) c.fillRect(x, y + TS - 4, TS, 4); if (!w(i - 1, j)) c.fillRect(x, y, 3, TS); if (!w(i + 1, j)) c.fillRect(x + TS - 3, y, 3, TS);
      c.strokeStyle = "rgba(255,255,255,.24)"; c.lineWidth = 2; c.beginPath(); c.arc(x + 18 + hash(i, j, 3) * 28, y + 24 + hash(i, j, 4) * 24, 7 + hash(i, j, 5) * 5, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    /* walls and the hedge around the map: a raised block with a shadow, a front and a lit top */
    c.fillStyle = "rgba(0,0,0,.2)"; for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (solidT(tt(i, j))) c.fillRect(i * TS + 9, j * TS + 4, TS, TS);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){ const v = tt(i, j); if (!solidT(v)) continue; const x = i * TS, y = j * TS, H2 = 18, hg = v === 9, h = hash(i, j, 9), nb = (di, dj) => solidT(tt(i + di, j + dj));
      if (!nb(0, 1)){ c.fillStyle = hg ? "#22461F" : h < .5 ? "#6E6559" : "#685F54"; c.fillRect(x, y + TS - H2, TS, H2); c.fillStyle = "rgba(0,0,0,.2)"; c.fillRect(x, y + TS - 4, TS, 4); if (!hg){ c.fillStyle = "rgba(0,0,0,.14)"; c.fillRect(x + 18 + h * 24, y + TS - H2, 2, H2); } }
      const r = 12, tl = !nb(-1, 0) && !nb(0, -1) ? r : 0, tr = !nb(1, 0) && !nb(0, -1) ? r : 0;
      c.fillStyle = hg ? "#356F31" : h < .33 ? "#A89E8F" : h < .66 ? "#A2988A" : "#ADA394"; rrr(c, x, y - H2, TS, TS, [tl, tr, 0, 0]); c.fill();
      if (!nb(0, -1)){ c.fillStyle = hg ? "rgba(150,210,110,.32)" : "rgba(255,255,255,.24)"; c.fillRect(x + (tl ? 9 : 0), y - H2, TS - (tl ? 9 : 0) - (tr ? 9 : 0), 4); }
      if (hg){ c.fillStyle = "rgba(110,180,80,.45)"; for (let k = 0; k < 3; k++){ c.beginPath(); c.arc(x + 12 + hash(i, j, k + 30) * 40, y - 6 + hash(i, j, k + 40) * 36, 7 + hash(i, j, k + 50) * 5, 0, 7); c.fill(); } }
      else if (h > .45){ c.strokeStyle = "rgba(70,60,48,.3)"; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 12 + h * 22, y - 8); c.lineTo(x + 24 + h * 12, y + 8); c.lineTo(x + 18 + h * 22, y + 26); c.stroke(); } }
  }
  function chunk(ci, cj){ const key = ci + "," + cj, S = MC.s; let cv = MC.ch.get(key); if (cv){ MC.ch.delete(key); MC.ch.set(key, cv); return cv; }
    cv = document.createElement("canvas"); cv.width = Math.ceil((CK + CE * 2) * S); cv.height = cv.width; const c = cv.getContext("2d"); c.setTransform(S, 0, 0, S, -(ci * CK - CE) * S, -(cj * CK - CE) * S);
    drawTiles(c, ci * 8 - 1, cj * 8 - 1, ci * 8 + 9, cj * 8 + 10);
    if (MC.ch.size >= 36) MC.ch.delete(MC.ch.keys().next().value); MC.ch.set(key, cv); return cv; }
  function drawMap(c, z, ox, oy, cw, ch){ const S = Math.max(.5, Math.min(1.5, z)); if (!MC.s || Math.abs(MC.s - S) / S > .2 || MC.lay !== LAY){ MC.ch.clear(); MC.s = S; MC.lay = LAY; }
    const i0 = Math.floor(-ox / z / CK), i1 = Math.floor((cw - ox) / z / CK), j0 = Math.floor(-oy / z / CK), j1 = Math.floor((ch - oy) / z / CK);
    for (let j = Math.max(-1, j0); j <= Math.min(Math.ceil(WH / CK), j1); j++) for (let i = Math.max(-1, i0); i <= Math.min(Math.ceil(WW / CK), i1); i++) c.drawImage(chunk(i, j), i * CK - CE, j * CK - CE, CK + CE * 2, CK + CE * 2); }
  const SPR = {};
  const sprite = (k, w, h, fn) => { if (SPR[k]) return SPR[k]; const cv = document.createElement("canvas"); cv.width = w; cv.height = h; fn(cv.getContext("2d")); return SPR[k] = cv; };
  const emo = (e, px) => sprite("e" + e + px, px * 2, px * 2, c => { c.font = `${px * 1.5}px system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(e, px, px * 1.08); });
  const emoAt = (c, e, x, y, px) => c.drawImage(emo(e, px >= 40 ? 64 : 32), x - px / 2, y - px / 2, px, px);
  /* the crate: a wooden power box with iron corners and a glowing green cube on the front; cracked when half broken */
  const crateSpr = dmg => sprite("crate" + dmg, 128, 144, c => { c.scale(2, 2);
    c.fillStyle = "rgba(0,0,0,.28)"; c.beginPath(); c.ellipse(35, 64, 31, 7, 0, 0, 7); c.fill();
    c.fillStyle = "#8A5530"; c.fillRect(5, 30, 54, 32); c.fillStyle = "#73452A"; c.fillRect(5, 40, 54, 2); c.fillRect(5, 51, 54, 2); c.fillStyle = "rgba(0,0,0,.2)"; c.fillRect(5, 56, 54, 6);
    c.fillStyle = "#B97C45"; c.fillRect(5, 14, 54, 16); c.fillStyle = "#A2683A"; c.fillRect(22, 14, 2, 16); c.fillRect(40, 14, 2, 16); c.fillStyle = "rgba(255,230,190,.35)"; c.fillRect(5, 14, 54, 3);
    c.fillStyle = "#3E3B37"; c.fillRect(5, 14, 8, 48); c.fillRect(51, 14, 8, 48); c.fillStyle = "#9C958B"; [[9, 20], [55, 20], [9, 55], [55, 55]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 1.6, 0, 7); c.fill(); });
    c.strokeStyle = "#2A1B10"; c.lineWidth = 2.5; c.strokeRect(5, 14, 54, 48); c.beginPath(); c.moveTo(5, 30); c.lineTo(59, 30); c.stroke();
    const g = c.createRadialGradient(32, 46, 2, 32, 46, 17); g.addColorStop(0, "rgba(170,255,120,.6)"); g.addColorStop(1, "rgba(170,255,120,0)"); c.fillStyle = g; c.fillRect(14, 30, 36, 32);
    cube3d(c, 32, 47, 7.5, .62);
    if (dmg){ c.strokeStyle = "rgba(30,15,5,.75)"; c.lineWidth = 1.6; c.beginPath(); c.moveTo(14, 31); c.lineTo(20, 38); c.lineTo(17, 45); c.moveTo(48, 31); c.lineTo(44, 36); c.lineTo(50, 42); c.lineTo(46, 50); c.moveTo(30, 15); c.lineTo(34, 21); c.lineTo(31, 28); c.stroke(); } });
  /* the power cube in 3D: it turns slowly, lit from the top left, a lightning bolt on every side */
  const CF = [[0, 0, 1, 1, 0, 0, 0, 1, 0], [0, 0, -1, -1, 0, 0, 0, 1, 0], [1, 0, 0, 0, 0, -1, 0, 1, 0], [-1, 0, 0, 0, 0, 1, 0, 1, 0], [0, 1, 0, 1, 0, 0, 0, 0, -1], [0, -1, 0, 1, 0, 0, 0, 0, 1]];
  const BOLT = [[.18, -.82], [-.42, .1], [-.04, .1], [-.2, .82], [.44, -.16], [.04, -.16], [.24, -.82]], LIT = [-.37, .74, .56];
  function cube3d(c, x, y, s, rot){
    const cs = Math.cos(rot), sn = Math.sin(rot), ct = Math.cos(.62), st = Math.sin(.62);
    const R = (X, Y, Z) => { const x1 = X * cs + Z * sn, z1 = -X * sn + Z * cs; return [x1, Y * ct - z1 * st, Y * st + z1 * ct]; };
    const F = CF.map(f => { const n = R(f[0], f[1], f[2]), u = R(f[3], f[4], f[5]), v = R(f[6], f[7], f[8]); return {n, u, v}; }).filter(f => f.n[2] > .02).sort((a, b) => a.n[2] - b.n[2]);
    c.lineJoin = "round";
    for (const f of F){ const P = (a, b) => [x + (f.n[0] + f.u[0] * a + f.v[0] * b) * s, y - (f.n[1] + f.u[1] * a + f.v[1] * b) * s], lam = Math.max(0, f.n[0] * LIT[0] + f.n[1] * LIT[1] + f.n[2] * LIT[2]), m = (a, b) => Math.round(a + (b - a) * lam);
      const quad = k => { c.beginPath(); [[-k, -k], [k, -k], [k, k], [-k, k]].forEach(([a, b], i) => { const p = P(a, b); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.closePath(); };
      /* a bevelled face: dark rim, a lit inner panel with a gloss from its top corner, the bolt with a dark outline */
      quad(1); c.fillStyle = `rgb(${m(24, 92)},${m(84, 190)},${m(18, 54)})`; c.fill(); c.strokeStyle = "rgba(10,44,8,.9)"; c.lineWidth = Math.max(1.2, s * .12); c.stroke();
      const p0 = P(-.8, .8), p1 = P(.8, -.8), g = c.createLinearGradient(p0[0], p0[1], p1[0], p1[1]); g.addColorStop(0, `rgb(${m(70, 214)},${m(150, 255)},${m(40, 150)})`); g.addColorStop(1, `rgb(${m(34, 120)},${m(110, 214)},${m(22, 70)})`);
      quad(.76); c.fillStyle = g; c.fill(); c.strokeStyle = `rgba(230,255,190,${.25 + lam * .45})`; c.lineWidth = Math.max(.8, s * .06); c.stroke();
      c.beginPath(); BOLT.forEach(([a, b], i) => { const p = P(a * .62, -b * .62); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.closePath();
      c.strokeStyle = "rgba(14,60,10,.85)"; c.lineWidth = Math.max(1, s * .16); c.stroke(); c.fillStyle = `rgba(255,255,240,${.75 + lam * .25})`; c.fill();
      if (lam > .55){ const h0 = P(-.7, .7), h1 = P(-.15, .7), h2 = P(-.7, .15); c.fillStyle = `rgba(255,255,255,${(lam - .55) * .9})`; c.beginPath(); c.moveTo(h0[0], h0[1]); c.lineTo(h1[0], h1[1]); c.lineTo(h2[0], h2[1]); c.closePath(); c.fill(); } } }
  /* little four-point sparkles that twinkle around something valuable */
  const sparkle = (c, x, y, r, al) => { if (al <= .02) return; c.fillStyle = `rgba(255,255,230,${al})`; c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fill(); };
  const glowSpr = () => sprite("cglow", 96, 96, c => { const g = c.createRadialGradient(48, 48, 4, 48, 48, 48); g.addColorStop(0, "rgba(170,255,110,.75)"); g.addColorStop(.45, "rgba(120,230,70,.28)"); g.addColorStop(1, "rgba(120,230,70,0)"); c.fillStyle = g; c.fillRect(0, 0, 96, 96); });
  const fireSpr = () => sprite("fire", 64, 64, c => { const g = c.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, "rgba(255,220,120,1)"); g.addColorStop(.5, "rgba(255,120,40,.8)"); g.addColorStop(1, "rgba(255,80,30,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
  const fireBlob = (c, x, y, r, a) => { if (a <= 0) return; c.globalAlpha = Math.min(1, a); c.drawImage(fireSpr(), x - r, y - r * .62, r * 2, r * 1.24); c.globalAlpha = 1; };
  /* bushes like in Brawl Stars: every tile its own raised square clump of long pointed leaves, light tips, a dark front where the bush ends */
  const BV = 5;
  const bushSpr = (v, front) => sprite("bush" + v + (front ? "f" : ""), 176, 208, c => { c.scale(2, 2); c.translate(12, 36); const R = rngOf(v * 131 + 7), L = TS;
    c.fillStyle = "rgba(0,0,0,.22)"; rrr(c, 2, 2, L, L - 2, 12); c.fill();
    if (front){ const g = c.createLinearGradient(0, L - 18, 0, L); g.addColorStop(0, "#2F6E2C"); g.addColorStop(1, "#1E4B1F"); c.fillStyle = g; rrr(c, 0, L - 20, L, 20, [0, 0, 10, 10]); c.fill();
      c.strokeStyle = "rgba(120,190,90,.35)"; c.lineWidth = 2; c.lineCap = "round"; for (let k = 0; k < 5; k++){ const x = 6 + k * 13 + R() * 4; c.beginPath(); c.moveTo(x, L - 15); c.lineTo(x + 2, L - 4); c.stroke(); } }
    const top = c.createLinearGradient(0, -14, 0, L - 14); top.addColorStop(0, "#62AE43"); top.addColorStop(1, "#3B8233"); c.fillStyle = top; rrr(c, 0, -14, L, L, 12); c.fill(); c.strokeStyle = "rgba(22,62,22,.55)"; c.lineWidth = 2; c.stroke();
    const leaf = (bx, by, an, len, w) => { const tx = bx + Math.cos(an) * len, ty = by + Math.sin(an) * len, mx = (bx + tx) / 2, my = (by + ty) / 2, px = -Math.sin(an) * w, py = Math.cos(an) * w;
      c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(mx + px, my + py, tx, ty); c.quadraticCurveTo(mx - px, my - py, bx, by); c.closePath(); };
    const LV = []; for (let k = 0; k < 17; k++) LV.push([3 + R() * 58, -8 + R() * 52, -Math.PI / 2 + (R() - .5) * 1.5, 17 + R() * 13, 5.5 + R() * 3]); LV.sort((a, b) => a[1] - b[1]);
    LV.forEach(([bx, by, an, len, w]) => { leaf(bx, by, an, len, w); c.strokeStyle = "#22521E"; c.lineWidth = 3.2; c.lineJoin = "round"; c.stroke();
      const g = c.createLinearGradient(bx, by, bx + Math.cos(an) * len, by + Math.sin(an) * len); g.addColorStop(0, "#3A8530"); g.addColorStop(.55, "#68B447"); g.addColorStop(1, "#A6DB66"); c.fillStyle = g; c.fill();
      c.strokeStyle = "rgba(220,250,170,.4)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(an) * len * .8, by + Math.sin(an) * len * .8); c.stroke(); });
    const hl = c.createRadialGradient(18, -2, 2, 18, -2, 34); hl.addColorStop(0, "rgba(230,255,180,.22)"); hl.addColorStop(1, "rgba(230,255,180,0)"); c.fillStyle = hl; c.fillRect(-12, -36, 88, 70); });
  /* people: the avatar as a bitmap, the name as a bitmap */
  const BMP = {}, TAG = {};
  function body(p){ const im = N().avImg(p.id, p.av), k = im.src.length + ":" + im.src.slice(-40), b = BMP[p.id]; if (b && b.k === k) return b.cv; if (!(im.complete && im.naturalWidth)) return b ? b.cv : null;
    const cv = document.createElement("canvas"); cv.width = 150; cv.height = 192; try { cv.getContext("2d").drawImage(im, 0, 0, 150, 192); } catch(e) { return null; } BMP[p.id] = {k, cv}; return cv; }
  function tag(p, self){ const k = p.id + "|" + p.name + "|" + (self ? 1 : 0); if (TAG[k]) return TAG[k]; const cv = document.createElement("canvas"), c = cv.getContext("2d"), f = "800 30px Figtree,system-ui,sans-serif"; c.font = f; const w = Math.ceil(c.measureText(p.name).width) + 24;
    cv.width = w; cv.height = 40; c.font = f; c.fillStyle = self ? "rgba(79,122,42,.9)" : "rgba(20,19,17,.72)"; rr(c, 0, 0, w, 40, 20); c.fill(); c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(p.name, w / 2, 21); return TAG[k] = {cv, w: w / 2, h: 20}; }
  /* a fighter: shadow and ring on the ground, the avatar (in the air while jumping), the weapon in the hand pointing where they aim */
  function fig(c, x, y, p, o){
    const pw = Math.min(CUBES, o.pw || 0), h = 118, w = h * 200 / 256, bob = o.mv && !o.jh ? Math.sin(now() / 90 + (p.id.charCodeAt(1) || 0)) * 3 : 0, cv = body(p), jh = o.jh || 0, sc = (1 + jh / 900) * (1 + pw * .025);
    c.fillStyle = "rgba(0,0,0,.32)"; c.beginPath(); c.ellipse(x, y + 16, 26 * (1 - jh / 400), 8 * (1 - jh / 400), 0, 0, 7); c.fill();
    c.strokeStyle = o.mate ? "rgba(79,163,255,.9)" : o.me ? "rgba(143,196,88,.85)" : "rgba(233,87,63,.75)"; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y + 16, 30, 10, 0, 0, 7); c.stroke();
    if (pw){ const k = pw / CUBES, pu = (Math.sin(now() / 260) + 1) / 2; c.strokeStyle = `rgba(150,245,90,${.35 + k * .5})`; c.lineWidth = 2 + k * 4; c.beginPath(); c.ellipse(x, y + 16, 36 + k * 14 + pu * 4, 12 + k * 5 + pu * 1.5, 0, 0, 7); c.stroke();
      c.save(); c.globalAlpha *= .25 + k * .5; c.drawImage(glowSpr(), x - 60 - k * 30, y - 100 - k * 30, 120 + k * 60, 140 + k * 50); c.restore(); }
    const a = o.a || 0, bx = x + Math.cos(a) * (o.lu || 0) * 12, by = y - jh, im = o.k && !(o.k === "punch" && o.lu > .05) ? wpnImg(o.k) : null, behind = Math.sin(a) < -.35;
    const weapon = () => { if (!im) return; const s = o.k === "punch" ? 30 : 38, hx = bx + Math.cos(a) * 24, hy = by - 36 + Math.sin(a) * 14; c.save(); c.translate(hx, hy); if (o.k === "punch") c.rotate(a + Math.PI / 2); else if (o.k !== "bomb" && o.k !== "zap"){ c.rotate(a); if (Math.cos(a) < 0) c.scale(1, -1); } c.drawImage(im, -s / 2, -s / 2, s, s); c.restore(); };
    if (o.glow > 0){ c.globalAlpha = o.glow * .9; c.drawImage(glowSpr(), bx - 70, by - 120, 140, 150); c.globalAlpha = 1; }
    if (behind) weapon();
    if (cv){ if (o.f < 0){ c.save(); c.translate(bx, 0); c.scale(-1, 1); c.drawImage(cv, -w * sc / 2, by - h * sc + 18 + bob, w * sc, h * sc); c.restore(); } else c.drawImage(cv, bx - w * sc / 2, by - h * sc + 18 + bob, w * sc, h * sc); }
    else { c.fillStyle = "#BAB5AC"; c.beginPath(); c.arc(bx, by - 30, 26, 0, 7); c.fill(); }
    if (!behind) weapon();
    if (o.flash){ c.globalAlpha = .5; c.fillStyle = "#fff"; c.beginPath(); c.ellipse(bx, by - 40, 34, 58, 0, 0, 7); c.fill(); c.globalAlpha = 1; }
    const tg = tag(p, o.me); c.drawImage(tg.cv, x - tg.w / 2, y + 26, tg.w, tg.h);
  }
  const bombAt = (c, x, y, s, t) => { c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = "#2B2A30"; c.beginPath(); c.arc(0, 0, 13, 0, 7); c.fill(); c.strokeStyle = "#111"; c.lineWidth = 2; c.stroke(); c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.arc(-4, -5, 4, 0, 7); c.fill(); c.fillStyle = "#58565A"; c.fillRect(-4, -17, 8, 5);
    c.strokeStyle = "#C9A46A"; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, -17); c.quadraticCurveTo(5, -24, 10, -22); c.stroke(); const fl = .7 + Math.sin(t / 30) * .3; c.fillStyle = "#FFD15C"; c.beginPath(); c.arc(10, -22, 4 * fl, 0, 7); c.fill(); c.fillStyle = "#FF7A2F"; c.beginPath(); c.arc(10, -22, 2.2 * fl, 0, 7); c.fill(); c.restore(); };
  const rangPath = c => { c.beginPath(); c.moveTo(-18, -9); c.quadraticCurveTo(-8, 10, 0, 12); c.quadraticCurveTo(8, 10, 18, -9); };
  /* a jagged lightning line, the same zigzag for the glow and the core within a frame */
  function jag(c, pts, amp, col, lw, seed){ const R = rngOf(seed); c.strokeStyle = col; c.lineWidth = lw; c.lineJoin = "round"; c.lineCap = "round"; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (let s = 1; s < pts.length; s++){ const [ax, ay] = pts[s - 1], [bx, by] = pts[s], d = Math.hypot(bx - ax, by - ay), n = Math.max(2, Math.ceil(d / 24)), px = -(by - ay) / (d || 1), py = (bx - ax) / (d || 1);
      for (let k = 1; k <= n; k++){ const f = k / n, o = k === n ? 0 : (R() - .5) * 2 * amp; c.lineTo(ax + (bx - ax) * f + px * o, ay + (by - ay) * f + py * o); } } c.stroke(); }
  const NUMF = "900 14px Figtree, system-ui, sans-serif";
  const CNF = "900 12px Figtree, system-ui, sans-serif";
  /* where a ray along "an" stops: a wall always, a crate unless the shot goes through crates */
  const rayTo = (a, an, rg, thruCr) => { if (!thruCr) return rayEnd(a, an, rg); const dx = Math.cos(an), dy = Math.sin(an); for (let s = 16; s < rg; s += 12){ const x = a.x + dx * s, y = a.y + dy * s, c = cell(x, y); if (c < 0 || MP.g[c] === 1) return {x, y}; } return {x: a.x + dx * rg, y: a.y + dy * rg}; };
  function aimDraw(c, aimP, su, t){
    const cl = CLS[C.cls], s2 = su ? Object.assign({}, cl, cl.su) : cl, a = C.me.a, o = {x: C.me.x, y: C.me.y + 8}, rgb = su ? "255,209,92" : "255,255,255", thru = C.cls === "rang";
    const col = al => `rgba(${rgb},${al})`, run = (t / 900) % 1;
    c.save(); c.lineJoin = "round"; c.lineCap = "round";
    if (cl.lob || (su && cl.su.at)){
      const dd = throwDist(cl, su, Math.hypot(aimP.dx, aimP.dy)), lx = o.x + Math.cos(a) * dd, ly = o.y + Math.sin(a) * dd, sp2 = s2.splash || 60, jmp = C.cls === "punch", hh = (jmp ? 190 : 130) + dd * .12;
      /* the arc: dots that grow out from the hand and fade in, running gently towards the landing */
      const n = Math.max(8, Math.round(dd / 34)); for (let i = 1; i < n; i++){ const k = (i + run) / n; if (k >= 1) continue; const x = o.x + (lx - o.x) * k, y = o.y - 30 + (ly - o.y + 30) * k - Math.sin(k * Math.PI) * hh;
        c.fillStyle = col(.18 + .5 * Math.sin(k * Math.PI * .5 + .3)); c.beginPath(); c.arc(x, y, 3.5 + k * 3, 0, 7); c.fill(); }
      /* the landing: soft fill, bright rim, a second ring pulsing out */
      const g = c.createRadialGradient(lx, ly, 2, lx, ly, sp2); g.addColorStop(0, col(.08)); g.addColorStop(.7, col(.2)); g.addColorStop(1, col(.38));
      c.fillStyle = g; c.beginPath(); c.ellipse(lx, ly, sp2, sp2 * .62, 0, 0, 7); c.fill(); c.strokeStyle = col(.85); c.lineWidth = 3.5; c.stroke();
      const pk = (t / 700) % 1; c.strokeStyle = col(.5 * (1 - pk)); c.lineWidth = 2.5; c.beginPath(); c.ellipse(lx, ly, sp2 * (.35 + pk * .65), sp2 * .62 * (.35 + pk * .65), 0, 0, 7); c.stroke();
      c.strokeStyle = col(.7); c.lineWidth = 3; c.beginPath(); c.moveTo(lx - 9, ly); c.lineTo(lx + 9, ly); c.moveTo(lx, ly - 6); c.lineTo(lx, ly + 6); c.stroke(); }
    else if (s2.cone || (s2.spr && (s2.n || 1) > 1)){
      /* a fan: built from rays so walls cut it, filled with a fade from the brawler outwards */
      const w = s2.cone || s2.spr * ((s2.n || 1) / 2 + .4), r = s2.rg + (s2.cone ? BODY : 0), N2 = 18, pts = [];
      for (let i = 0; i <= N2; i++){ const an = a - w + 2 * w * i / N2, e = rayTo(o, an, r, thru); pts.push([e.x, e.y]); }
      const g = c.createRadialGradient(o.x, o.y, 10, o.x, o.y, r); g.addColorStop(0, col(.46)); g.addColorStop(.75, col(.2)); g.addColorStop(1, col(.06));
      c.beginPath(); c.moveTo(o.x, o.y); pts.forEach(p => c.lineTo(p[0], p[1])); c.closePath(); c.fillStyle = g; c.fill();
      c.strokeStyle = col(.55); c.lineWidth = 2.5; c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(pts[0][0], pts[0][1]); c.moveTo(o.x, o.y); c.lineTo(pts[N2][0], pts[N2][1]); c.stroke();
      /* the bright rim only where the shot reaches its full range, so a wall doesn't get a jagged outline */
      c.strokeStyle = col(.75); c.lineWidth = 3.5; c.beginPath(); let pen = false; pts.forEach(p => { const full = Math.hypot(p[0] - o.x, p[1] - o.y) > r - 14; if (full){ pen ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); } pen = full; }); c.stroke();
      /* one line per pellet, faint, so you see how the shot spreads */
      if ((s2.n || 1) > 1 && !s2.cone){ c.strokeStyle = col(.16); c.lineWidth = 2; for (let i = 0; i < s2.n; i++){ const an = a + (i - (s2.n - 1) / 2) * s2.spr, e = rayTo(o, an, r, thru); c.beginPath(); c.moveTo(o.x + Math.cos(an) * 30, o.y + Math.sin(an) * 30); c.lineTo(e.x, e.y); c.stroke(); } }
      for (let k = 0; k < 3; k++){ const f = ((k / 3 + run) % 1), d = 40 + f * (r - 60); chev(c, o.x + Math.cos(a) * d, o.y + Math.sin(a) * d, a, 9, col(.55 * Math.sin(f * Math.PI))); } }
    else {
      /* a straight shot: a band as wide as the bullet, fading towards its end, with a bright tip where it stops */
      const e = rayTo(o, a, s2.rg, thru), L = Math.hypot(e.x - o.x, e.y - o.y), hw = Math.max(9, (s2.r || 8) * 1.6), px = -Math.sin(a), py = Math.cos(a);
      const g = c.createLinearGradient(o.x, o.y, e.x, e.y); g.addColorStop(0, col(.5)); g.addColorStop(.7, col(.24)); g.addColorStop(1, col(.1));
      const x0 = o.x + Math.cos(a) * 18, y0 = o.y + Math.sin(a) * 18;
      c.beginPath(); c.moveTo(x0 + px * hw * .6, y0 + py * hw * .6); c.lineTo(e.x + px * hw, e.y + py * hw); c.arc(e.x, e.y, hw, a + Math.PI / 2, a - Math.PI / 2, true); c.lineTo(x0 - px * hw * .6, y0 - py * hw * .6); c.closePath(); c.fillStyle = g; c.fill();
      c.strokeStyle = col(.5); c.lineWidth = 2; c.stroke();
      c.fillStyle = col(.8); c.beginPath(); c.arc(e.x, e.y, hw * .45, 0, 7); c.fill();
      for (let k = 0; k < 3; k++){ const f = ((k / 3 + run) % 1), d = 30 + f * Math.max(0, L - 50); chev(c, o.x + Math.cos(a) * d, o.y + Math.sin(a) * d, a, hw * .75, col(.6 * Math.sin(f * Math.PI))); } }
    c.restore(); }
  const chev = (c, x, y, a, s, st) => { c.strokeStyle = st; c.lineWidth = 3; c.beginPath(); c.moveTo(x - Math.cos(a) * s + Math.cos(a + Math.PI / 2) * s, y - Math.sin(a) * s + Math.sin(a + Math.PI / 2) * s); c.lineTo(x, y); c.lineTo(x - Math.cos(a) * s - Math.cos(a + Math.PI / 2) * s, y - Math.sin(a) * s - Math.sin(a + Math.PI / 2) * s); c.stroke(); };
  function render(){
    const NP = NPo(), c = NP.ctx, cv = NP.cv; if (!c || !C.A) return; if (!MP) setLay(0); const d = NP.dpr, A = C.A, cw = cv.width, ch = cv.height, t = now();
    let cam = C.me && alive(me()) ? C.me : null;
    if (!cam){ const k = (A.feed || []).slice().reverse().find(f => f[1] === me()), fol = A.team ? A.ids.find(id => alive(id) && mate(id, me())) || (k && k[0] && alive(k[0]) ? k[0] : null) : k && k[0] && alive(k[0]) ? k[0] : A.ids.filter(alive).sort((a, b) => (A.hp[b] || 0) - (A.hp[a] || 0))[0]; cam = (fol && pos(fol)) || C.me || GC; }
    const spec = !(C.me && alive(me())), z = Math.min(Math.sqrt(cw * ch / 1.11e6) * 1.12, ch / 610, 1.15 * d) * (spec ? .84 : 1), _zc = (C.z = z / d), sh = C.shake > .5 ? C.shake * d : 0;
    /* the camera follows, but stops a little past the edge of the map */
    const vw = cw / z, vh = ch / z, mg = 140; let cx = cam.x, cy = cam.y - 40; cx = vw >= WW + mg * 2 ? WW / 2 : Math.max(vw / 2 - mg, Math.min(WW - vw / 2 + mg, cx)); cy = vh >= WH + mg * 2 ? WH / 2 : Math.max(vh / 2 - mg, Math.min(WH - vh / 2 + mg, cy));
    const ox = cw / 2 - cx * z + (Math.random() - .5) * sh, oy = ch / 2 - cy * z + (Math.random() - .5) * sh;
    if (C.me) C.scr = {x: (C.me.x * z + ox) / d, y: (C.me.y * z + oy) / d};
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = "#24221E"; c.fillRect(0, 0, cw, ch);
    c.setTransform(z, 0, 0, z, ox, oy); c.imageSmoothingEnabled = true; drawMap(c, z, ox, oy, cw, ch);
    const pulse = (Math.sin(t / 200) + 1) / 2, vx0 = -ox / z - 90, vx1 = (cw - ox) / z + 90, vy0 = -oy / z - 90, vy1 = (ch - oy) / z + 140, inV = (x, y) => x > vx0 && x < vx1 && y > vy0 && y < vy1;
    /* crates: shake and flash when hit */
    const bars = []; MP.cr.forEach((cr, i) => { if (!MP.ca[cr.c] || !inV(cr.x, cr.y)) return; const hp = C.crh[i], hit = t - (C.crf[i] || 0), sx = hit < 140 ? (Math.random() - .5) * 7 : 0;
      c.drawImage(crateSpr(hp != null && hp < CRATE * .5 ? 1 : 0), cr.x - 32 + sx, cr.y - 32, 64, 72); if (hit < 110){ c.globalAlpha = .5 * (1 - hit / 110); c.fillStyle = "#fff"; c.fillRect(cr.x - 27 + sx, cr.y - 18, 54, 48); c.globalAlpha = 1; }
      bars.push([i, cr, sx, hp]); });
    /* the crates' life, like in Brawl Stars: a bar with the number in it on the lid, drawn over all crates so a stack stays readable; the part just lost fades out */
    if (c.font !== CNF) c.font = CNF; c.textAlign = "center"; c.textBaseline = "middle";
    bars.forEach(([i, cr, sx, hp]) => { const left = hp == null ? CRATE : Math.max(0, hp), f = left / CRATE, w = 50, bx = cr.x - w / 2 + sx, by = cr.y - 30, gh = C.crg[i] || (C.crg[i] = {f, t: 0});
      if (gh.f > f && !gh.t) gh.t = t; if (gh.t && t - gh.t > 260){ gh.f = Math.max(f, gh.f - (t - gh.t - 260) / 900); if (gh.f <= f){ gh.f = f; gh.t = 0; } }
      c.fillStyle = "rgba(10,10,14,.85)"; rr(c, bx - 2, by - 2, w + 4, 16, 6); c.fill();
      if (gh.f > f){ c.fillStyle = "rgba(255,255,255,.75)"; rr(c, bx, by, w * gh.f, 12, 5); c.fill(); }
      if (f > 0){ c.fillStyle = f > .5 ? "#5FBE3A" : f > .25 ? "#E8B42E" : "#E9573F"; rr(c, bx, by, w * f, 12, 5); c.fill(); c.fillStyle = "rgba(255,255,255,.28)"; c.fillRect(bx + 3, by + 1.5, Math.max(0, w * f - 6), 2.5); }
      c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,.7)"; c.strokeText(Math.ceil(left), cr.x + sx, by + 6.5); c.fillStyle = "#fff"; c.fillText(Math.ceil(left), cr.x + sx, by + 6.5); });
    c.textBaseline = "alphabetic";
    /* power cubes: pop out of the crate with a hop, then float and turn */
    C.cubes.forEach(cb => { if (!inV(cb.x, cb.y)) return; const age = t - (C.cubeT[cb.k] || 0), pk = age < 520 ? age / 520 : 1, hop = Math.sin(pk * Math.PI) * 46 * (1 - pk * .3), sc = pk < 1 ? Math.min(1.15, .25 + pk * 1.05) : 1, bob = Math.sin(t / 260 + cb.k) * 4, s2 = (12 + Math.min(4, cb.n - 1) * 1.5) * sc, cy2 = cb.y - 28 + bob - hop;
      c.fillStyle = "rgba(0,0,0,.28)"; c.beginPath(); c.ellipse(cb.x, cb.y + 10, 20 * sc, 6 * sc, 0, 0, 7); c.fill(); c.globalAlpha = .7 + pulse * .3; c.drawImage(glowSpr(), cb.x - 48 * sc, cy2 - 48 * sc, 96 * sc, 96 * sc); c.globalAlpha = 1;
      c.strokeStyle = `rgba(170,255,110,${.35 + pulse * .3})`; c.lineWidth = 2.5; c.beginPath(); c.ellipse(cb.x, cb.y + 10, 24 * sc, 8 * sc, 0, 0, 7); c.stroke();
      cube3d(c, cb.x, cy2, s2, t / 650 + cb.k);
      for (let i = 0; i < 3; i++){ const ph = (t / 900 + i / 3 + cb.k * .37) % 1, an = i * 2.1 + cb.k; sparkle(c, cb.x + Math.cos(an) * s2 * 2.1, cy2 + Math.sin(an) * s2 * 1.5 - ph * 10, 3 + 4 * Math.sin(ph * Math.PI), .95 * Math.sin(ph * Math.PI)); }
      if (cb.n > 1){ if (c.font !== NUMF) c.font = NUMF; c.textAlign = "center"; c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,.6)"; c.strokeText("×" + cb.n, cb.x, cy2 - s2 * 1.9); c.fillStyle = "#fff"; c.fillText("×" + cb.n, cb.x, cy2 - s2 * 1.9); } });
    /* the gas closing in */
    if (A.ph === "fight"){ const gr = gasR(t - C.fightT0); if (gr < 4000){ c.save(); c.beginPath(); c.rect(-600, -600, WW + 1200, WH + 1200); c.arc(GC.x, GC.y, gr, 0, Math.PI * 2, true); c.fillStyle = `rgba(88,200,92,${.26 + pulse * .08})`; c.fill("evenodd"); c.strokeStyle = "rgba(150,240,130,.85)"; c.lineWidth = 6; c.setLineDash([22, 14]); c.lineDashOffset = -t / 40; c.beginPath(); c.arc(GC.x, GC.y, gr, 0, Math.PI * 2); c.stroke(); c.restore(); } }
    /* aiming, like in Brawl Stars: a soft shape on the ground that fades out towards its end, bright edges, little arrows running out,
       stopped by walls (the boomerang's goes through crates); throws and the jump get a dotted arc and a pulsing landing ring */
    const aimP = C.supP && C.supP.man ? C.supP : C.aimP && C.aimP.man ? C.aimP : null;
    if (fighting() && aimP) aimDraw(c, aimP, aimP === C.supP, t);
    if (C.autoLine && t - C.autoLine.t < 200 && C.me){ c.strokeStyle = "rgba(255,255,255,.5)"; c.lineWidth = 3; c.setLineDash([8, 8]); c.beginPath(); c.moveTo(C.me.x, C.me.y - 30); c.lineTo(C.autoLine.x, C.autoLine.y - 30); c.stroke(); c.setLineDash([]); }
    /* people: those on open ground first, then the bushes, then those you can see inside a bush (see-through) */
    const P = NP.pl(), myFog = C.me && alive(me()) ? fogAt(C.me.x, C.me.y) : -1;
    const list = A.ids.filter(id => (A.ph !== "fight" || alive(id) || (C.hitAt[id] && t - C.hitAt[id] < 400)) && visible(id)).map(id => { const q = pos(id), p = C.AP[id], b = isHost() && HB.bots[id], mi = id === me() && C.me; if (!q) return null;
      const J = C.jump[id], jk = J && t < J.t0 + J.dur ? (t - J.t0) / J.dur : -1, lt = t - (C.lunge[id] || 0);
      return {id, x: q.x, y: q.y, f: mi ? C.me.f : b ? b.f : p ? p.f : 1, mv: mi ? C.me.mv : b ? b.mv : p ? p.mv : 0, a: mi ? C.me.a : b ? b.a : p ? p.a || 0 : 0, jh: jk >= 0 ? Math.sin(jk * Math.PI) * 130 : 0, lu: lt < 170 ? Math.sin(lt / 170 * Math.PI) : 0, ch: mi ? chgNow() : p ? p.chg || 0 : 0, bush: fogAt(q.x, q.y) >= 0}; }).filter(Boolean).sort((a, b) => a.y - b.y);
    const laser = (x, y, a, k, mine) => { const e = rayEnd({x, y}, a, CLS.snipe.rg); c.save(); c.strokeStyle = mine ? `rgba(130,195,255,${.3 + k * .6})` : `rgba(255,80,60,${.25 + k * .55})`; c.lineWidth = 2 + k * 4; c.lineCap = "round"; if (k < 1) c.setLineDash([14, 10]); c.beginPath(); c.moveTo(x + Math.cos(a) * 30, y - 34 + Math.sin(a) * 30); c.lineTo(e.x, e.y - 34); c.stroke(); c.restore(); };
    const drawP = q => { const id = q.id, p = P.find(x => x.id === id) || {id, name: "?"}, self = id === me(), out = A.out.includes(id), y0 = q.y - q.jh;
      if (q.ch > 0 && !out && A.cls[id] === "snipe") laser(q.x, q.y, q.a, q.ch, self);
      c.globalAlpha = out ? .4 : q.bush ? .74 : 1;
      fig(c, q.x, q.y, p, {pw: out ? 0 : C.pw[id] || 0, f: q.f, mv: q.mv, me: self, mate: mate(id, me()), flash: C.hitAt[id] && t - C.hitAt[id] < 110, k: A.ph === "fight" && !out ? A.cls[id] : null, a: q.a, jh: q.jh, lu: q.lu, glow: Math.max(0, 1 - (t - (C.glow[id] || 0)) / 700)});
      c.globalAlpha = 1;
      if (self && q.ch > 0){ c.strokeStyle = q.ch >= 1 ? "#A9D6FF" : "rgba(169,214,255,.75)"; c.lineWidth = q.ch >= 1 ? 6 : 4; c.beginPath(); c.ellipse(q.x, q.y + 16, 38, 14, 0, -Math.PI / 2, -Math.PI / 2 + q.ch * Math.PI * 2); c.stroke(); }
      const em = C.emo[id]; if (em && t - em.t < 2200){ const k = Math.min(1, (t - em.t) / 160), yy = y0 - 172 - (1 - k) * 12; c.globalAlpha = t - em.t > 1900 ? (2200 - (t - em.t)) / 300 : 1; c.fillStyle = "#fff"; rr(c, q.x - 26, yy - 26, 52, 46, 14); c.fill(); c.beginPath(); c.moveTo(q.x - 7, yy + 19); c.lineTo(q.x, yy + 28); c.lineTo(q.x + 7, yy + 19); c.fill();
        if (em.e === "GG"){ c.fillStyle = "#1b1a18"; c.font = "900 22px Figtree,system-ui,sans-serif"; c.textAlign = "center"; c.fillText("GG", q.x, yy + 6); c.font = NUMF; } else emoAt(c, em.e, q.x, yy - 3, 32); c.globalAlpha = 1; }
      if (A.ph === "fight" && !out){ const hp = A.hp[id] || 0, mx = A.mx[id] || 1, w = 74, y = y0 - 124, f = Math.max(0, Math.min(1, hp / mx)); c.fillStyle = "rgba(10,10,14,.85)"; rr(c, q.x - w / 2 - 3, y - 3, w + 6, self ? 26 : 16, 6); c.fill();
        c.fillStyle = self ? "#7FD04A" : mate(id, me()) ? "#4FA3FF" : "#E9573F"; rr(c, q.x - w / 2, y, w * f, 10, 5); c.fill(); if (c.font !== NUMF) c.font = NUMF; c.textAlign = "center"; c.fillStyle = "#fff"; c.fillText(Math.ceil(hp), q.x, y - 6);
        const bi = badImg(A.cls[id]); if (bi) c.drawImage(bi, q.x - w / 2 - 27, y - 7, 22, 22);
        const pw = C.pw[id] || 0; if (pw){ cube3d(c, q.x + w / 2 + 13, y + 3, 7.5, .7 + t / 1400); c.textAlign = "left"; c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,.7)"; c.strokeText(pw, q.x + w / 2 + 25, y + 9); c.fillStyle = "#B8F07A"; c.fillText(pw, q.x + w / 2 + 25, y + 9); c.textAlign = "center"; }
        /* my reload bar right under my health, like in Brawl Stars */
        if (self){ const sw = (w - 4) / AMMO; for (let i = 0; i < AMMO; i++){ const f2 = i < C.am ? 1 : i === C.am ? Math.min(1, C.rl / CLS[C.cls].rl) : 0; c.fillStyle = "rgba(255,255,255,.14)"; c.fillRect(q.x - w / 2 + i * (sw + 2), y + 13, sw, 7); if (f2 > 0){ c.fillStyle = f2 >= 1 ? "#F2A33A" : "#9b6a2a"; c.fillRect(q.x - w / 2 + i * (sw + 2), y + 13, sw * f2, 7); } }
          if (C.sup >= 1){ c.fillStyle = "#FFD15C"; c.beginPath(); for (let i = 0; i < 10; i++){ const r = i % 2 ? 5 : 11, an = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(q.x - w / 2 - 15 + Math.cos(an) * r, y + 28 + Math.sin(an) * r); } c.closePath(); c.fill(); } } } };
    list.forEach(q => { if (!q.bush) drawP(q); });
    /* bombs, bullets, boomerangs */
    C.proj.forEach(p => { const y = p.y - 34;
      if (p.lob){ const k = Math.min(1, (t - p.t) / p.dur), hgt = Math.sin(k * Math.PI) * (120 + Math.hypot(p.x1 - p.x0, p.y1 - p.y0) * .25), rr2 = p.su ? CLS.bomb.su.splash : CLS.bomb.splash;
        c.strokeStyle = `rgba(255,90,60,${.35 + k * .4})`; c.lineWidth = 3; c.setLineDash([8, 7]); c.beginPath(); c.ellipse(p.x1, p.y1, rr2, rr2 * .62, 0, 0, 7); c.stroke(); c.setLineDash([]);
        c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.ellipse(p.x, p.y, 12, 5, 0, 0, 7); c.fill(); bombAt(c, p.x, p.y - 30 - hgt, p.su ? 1.5 : 1.05, t); return; }
      if (p.c === "snipe"){ const k = (p.ch || 0) / 100; c.strokeStyle = p.su ? "#FFD15C" : k > .6 ? "#A9D6FF" : "#fff"; c.lineWidth = p.su ? 9 : 4 + k * 5; c.lineCap = "round"; c.beginPath(); c.moveTo(p.x - p.vx * .03, y - p.vy * .03); c.lineTo(p.x, y); c.stroke(); }
      else if (p.c === "gun"){ c.strokeStyle = p.su ? "#FFB347" : "#FFE08A"; c.lineWidth = 6; c.lineCap = "round"; c.beginPath(); c.moveTo(p.x - p.vx * .018, y - p.vy * .018); c.lineTo(p.x, y); c.stroke(); }
      else if (p.c === "rang"){ c.save(); c.translate(p.x, y); c.rotate(t / 45); if (p.su) c.scale(1.15, 1.15); c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = "#1d1b18"; c.lineWidth = 13; rangPath(c); c.stroke(); c.strokeStyle = CLS.rang.c; c.lineWidth = 7; rangPath(c); c.stroke(); c.restore(); }
      else { c.fillStyle = p.su ? "#FF9A3C" : "#FFD15C"; c.beginPath(); c.arc(p.x, y, p.su ? 8 : 7, 0, 7); c.fill(); c.fillStyle = "rgba(255,209,92,.35)"; c.beginPath(); c.arc(p.x - p.vx * .012, y - p.vy * .012, 5, 0, 7); c.fill(); } });
    C.fx.forEach(f => { const k = (t - f.t) / (f.d || 700), sd = Math.floor(t / 50) + Math.floor(f.t);
      if (f.k === "boom"){ const r = (20 + k * 90) * (f.big ? 1.5 : 1); c.fillStyle = `rgba(255,170,60,${Math.max(0, .7 * (1 - k))})`; c.beginPath(); c.arc(f.x, f.y - 20, r, 0, 7); c.fill(); if (k < .5){ c.fillStyle = `rgba(255,240,180,${.8 * (1 - k * 2)})`; c.beginPath(); c.arc(f.x, f.y - 20, r * .5, 0, 7); c.fill(); } }
      else if (f.k === "spark"){ if (k < .5){ c.fillStyle = f.hit ? `rgba(255,255,255,${1 - k * 2})` : `rgba(255,209,92,${1 - k * 2})`; for (let i = 0; i < 5; i++){ const an = i * 1.3 + f.t, r = k * 40; c.beginPath(); c.arc(f.x + Math.cos(an) * r, f.y - 34 + Math.sin(an) * r, 3, 0, 7); c.fill(); } } }
      else if (f.k === "flash"){ if (k < .15){ c.fillStyle = "rgba(255,230,150,.9)"; c.beginPath(); c.arc(f.x, f.y - 34, f.big ? 20 : 13, 0, 7); c.fill(); } }
      else if (f.k === "sup"){ if (k < .6){ c.strokeStyle = `rgba(255,209,92,${.9 * (1 - k / .6)})`; c.lineWidth = 8; c.beginPath(); c.arc(f.x, f.y - 30, 30 + k * 80, 0, 7); c.stroke(); } }
      else if (f.k === "chip"){ const s = (t - f.t) / 1000; c.globalAlpha = Math.max(0, 1 - k); for (let i = 0; i < 5; i++){ const an = -Math.PI / 2 + (i - 2) * .6, px = f.x + Math.cos(an) * 110 * s * .7, py = f.y - 22 + Math.sin(an) * 150 * s + 600 * s * s; c.fillStyle = i % 2 ? "#B97C45" : "#7A4A28"; c.fillRect(px - 3, py - 2, 6, 4); } c.globalAlpha = 1; }
      else if (f.k === "crate"){ const R = rngOf(f.s * 31 + 7), s = (t - f.t) / 1000;
        if (k < .7){ const kk = k / .7; c.fillStyle = `rgba(205,185,150,${.5 * (1 - kk)})`; for (let i = 0; i < 7; i++){ const an = i * .9 + R(), r = 14 + kk * 50; c.beginPath(); c.arc(f.x + Math.cos(an) * r, f.y - 8 + Math.sin(an) * r * .55, 14 + kk * 16, 0, 7); c.fill(); } }
        if (k < .32){ const kk = k / .32, r = 30 + kk * 95, g = c.createRadialGradient(f.x, f.y - 20, 4, f.x, f.y - 20, r); g.addColorStop(0, `rgba(200,255,150,${.85 * (1 - kk)})`); g.addColorStop(1, "rgba(120,230,80,0)"); c.fillStyle = g; c.beginPath(); c.arc(f.x, f.y - 20, r, 0, 7); c.fill(); }
        for (let i = 0; i < 9; i++){ const an = R() * Math.PI * 2, sp = 90 + R() * 170, vz = 240 + R() * 260, px = f.x + Math.cos(an) * sp * s, pz = Math.max(0, vz * s - 950 * s * s), py = f.y + Math.sin(an) * sp * s * .6 - pz, rot = R() * 6 + s * (R() * 16 - 8);
          c.save(); c.globalAlpha = Math.max(0, 1 - k * k); c.translate(px, py); c.rotate(rot); c.fillStyle = i % 3 ? "#A86C3A" : "#7A4A28"; c.fillRect(-11, -3.5, 22, 7); c.strokeStyle = "#2A1B10"; c.lineWidth = 1.5; c.strokeRect(-11, -3.5, 22, 7); if (i % 4 === 0){ c.fillStyle = "#3E3B37"; c.fillRect(-11, -3.5, 6, 7); } c.restore(); } }
      else if (f.k === "power"){ c.strokeStyle = `rgba(155,240,95,${.9 * (1 - k)})`; c.lineWidth = 6 * (1 - k) + 1; c.beginPath(); c.ellipse(f.x, f.y + 10, 20 + k * 70, (20 + k * 70) * .4, 0, 0, 7); c.stroke();
        if (k < .5){ const kk = k / .5, g = c.createLinearGradient(0, f.y - 230, 0, f.y + 10); g.addColorStop(0, "rgba(170,255,120,0)"); g.addColorStop(1, `rgba(170,255,120,${.55 * (1 - kk)})`); c.fillStyle = g; c.fillRect(f.x - 32 * (1 - kk * .5), f.y - 230, 64 * (1 - kk * .5), 240); }
        c.fillStyle = `rgba(190,255,140,${Math.max(0, 1 - k)})`; for (let i = 0; i < 12; i++){ const an = i * .52 + f.t, r = 54 * (1 - k), px = f.x + Math.cos(an) * r, py = f.y - 40 + Math.sin(an) * r * .5 - k * 110 * ((i % 3) + 1) / 3; c.save(); c.translate(px, py); c.rotate(k * 6 + i); c.fillRect(-4, -4, 8, 8); c.restore(); } }
      else if (f.k === "jab"){ if (k < 1){ const ext = Math.sin(Math.min(1, k * 1.4) * Math.PI), side = (f.i % 2 ? 1 : -1) * 13, dist = 26 + ext * 64, px = f.x + Math.cos(f.a) * dist - Math.sin(f.a) * side, py = f.y - 38 + Math.sin(f.a) * dist * .9 + Math.cos(f.a) * side * .5, im = wpnImg("punch");
          c.strokeStyle = `rgba(255,255,255,${.5 * ext})`; c.lineWidth = 10; c.lineCap = "round"; c.beginPath(); c.moveTo(px - Math.cos(f.a) * 30 * ext, py - Math.sin(f.a) * 27 * ext); c.lineTo(px, py); c.stroke();
          if (im){ c.save(); c.translate(px, py); c.rotate(f.a + Math.PI / 2); c.drawImage(im, -19, -19, 38, 38); c.restore(); }
          if (k > .25 && k < .62){ const kk = (k - .25) / .37, ex = f.x + Math.cos(f.a) * 98, ey = f.y - 38 + Math.sin(f.a) * 88; c.strokeStyle = `rgba(255,255,255,${.9 * (1 - kk)})`; c.lineWidth = 4; for (let i = 0; i < 6; i++){ const an = i * 1.047 + f.i; c.beginPath(); c.moveTo(ex + Math.cos(an) * (8 + kk * 10), ey + Math.sin(an) * (8 + kk * 10)); c.lineTo(ex + Math.cos(an) * (16 + kk * 18), ey + Math.sin(an) * (16 + kk * 18)); c.stroke(); } } } }
      else if (f.k === "zap"){ c.globalAlpha = Math.max(0, 1 - k); jag(c, f.pts, 10, "rgba(255,226,120,.5)", 10, sd); jag(c, f.pts, 10, "#fff", 3.2, sd); c.globalAlpha = 1; }
      else if (f.k === "bolt"){ c.globalAlpha = Math.max(0, 1 - k); const pts = [[f.x + 40, f.y - 470], [f.x - 10, f.y - 240], [f.x, f.y - 6]]; jag(c, pts, 16, "rgba(255,226,120,.5)", 12, sd); jag(c, pts, 16, "#fff", 4, sd);
        c.fillStyle = `rgba(255,240,170,${.6 * (1 - k)})`; c.beginPath(); c.ellipse(f.x, f.y, 40 + k * 30, (40 + k * 30) * .45, 0, 0, 7); c.fill(); c.globalAlpha = 1; }
      else if (f.k === "slam"){ const R2 = CLS.punch.su.splash; c.strokeStyle = `rgba(255,255,255,${.85 * (1 - k)})`; c.lineWidth = 10 * (1 - k) + 2; c.beginPath(); c.ellipse(f.x, f.y + 8, R2 * (.3 + k * .9), R2 * (.3 + k * .9) * .45, 0, 0, 7); c.stroke();
        c.fillStyle = `rgba(205,185,150,${.45 * (1 - k)})`; for (let i = 0; i < 8; i++){ const an = i * .785, r = R2 * (.4 + k * .7); c.beginPath(); c.arc(f.x + Math.cos(an) * r, f.y + 8 + Math.sin(an) * r * .45, 12 + k * 14, 0, 7); c.fill(); } }
      else if (f.k === "land"){ if (k < .5){ const kk = k / .5; c.strokeStyle = `rgba(255,255,255,${.8 * (1 - kk)})`; c.lineWidth = 6; c.beginPath(); c.ellipse(f.x, f.y + 10, 30 + kk * 70, (30 + kk * 70) * .4, 0, 0, 7); c.stroke(); } }
      else if (f.k === "ko"){ c.globalAlpha = Math.max(0, 1 - k); emoAt(c, "💀", f.x, f.y - 92 - k * 40, 44 + k * 30); c.globalAlpha = 1; } });
    /* the bushes on top, tile by tile: whoever is inside is hidden. When I am in a bush, the leaves around me turn see-through
       (a small bush completely), so I see who is close; the rest of the map stays fully visible */
    { const sm = smallBush(myFog), mv = C.me && C.me.mv;
      for (const ce of MP.bt){ const i = ce % MW, j = (ce - i) / MW, x = i * TS, y = j * TS; if (x > vx1 || x + TS < vx0 || y - 40 > vy1 || y + TS < vy0) continue;
        let al = 1, sw = Math.sin(t / 1100 + i * 1.7 + j * .9) * 1.1;
        if (myFog >= 0){ const d = Math.hypot(x + TS / 2 - C.me.x, y + TS / 2 - C.me.y), k = sm && MP.fa[ce] - 1 === myFog ? 1 : Math.max(0, Math.min(1, (SEE + 50 - d) / 80)); al = 1 - .64 * k; if (mv && d < 60) sw += Math.sin(t / 55 + i) * 2.4; }
        c.globalAlpha = al; c.drawImage(bushSpr(hash(i, j, 77) * BV | 0, j === MH - 1 || MP.g[ce + MW] !== 3), x - 12 + sw, y - 36, 88, 104); } c.globalAlpha = 1; }
    list.forEach(q => { if (q.bush) drawP(q); });
    /* thunderstorms: a dark cloud over a dashed circle */
    C.storms.forEach(s => { const su = CLS.zap.su, age = t - s.t0, k = Math.min(1, age / 250), out = Math.max(0, 1 - (age - su.hits * su.every) / 400); c.save(); c.globalAlpha = k * out;
      c.strokeStyle = "rgba(255,226,120,.75)"; c.lineWidth = 4; c.setLineDash([12, 10]); c.lineDashOffset = -t / 30; c.beginPath(); c.ellipse(s.x, s.y, su.splash, su.splash * .62, 0, 0, 7); c.stroke(); c.setLineDash([]); c.fillStyle = "rgba(255,226,120,.08)"; c.fill();
      c.fillStyle = "rgba(42,44,60,.8)"; for (let i = 0; i < 6; i++){ const an = i * 1.05 + t / 1200; c.beginPath(); c.arc(s.x + Math.cos(an) * 62, s.y - 175 + Math.sin(an) * 18, 46, 0, 7); c.fill(); } c.restore(); });
    C.pops.forEach(p => { const k = (t - p.t) / 900; c.globalAlpha = Math.max(0, 1 - k); c.font = `900 ${p.ko ? 36 : p.mine || p.cube ? 26 : 22}px Figtree,system-ui,sans-serif`; c.textAlign = "center"; c.lineWidth = 4; c.strokeStyle = "rgba(0,0,0,.6)"; c.strokeText(p.txt, p.x, p.y - k * 40); c.fillStyle = p.cube ? "#A6F06A" : p.me ? "#ff6a55" : p.mine ? "#FFD15C" : "#fff"; c.fillText(p.txt, p.cube ? p.x - 12 : p.x, p.y - k * 40); if (p.cube) cube3d(c, p.x + 16, p.y - k * 40 - 10, 9, .7 + k * 2); c.globalAlpha = 1; });
    c.setTransform(1, 0, 0, 1, 0, 0);
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
  PG.arena = {CLS, PERKS, PICK, FIGHT, NEXT, LAYS, setLay, hostInit, hostTick, hostAct, hostView, applyPerk, client, fx: FX, stopHost, icon: badge, glyph};
  PG.onArena = m => onMsg(m);
  if (PG.ART) PG.ART.arena = ["⭐", "#E9A92B"];
  window.__ar = () => ({on: C.on, team: C.A && C.A.team, ph: C.A && C.A.ph, me: C.me && {x: Math.round(C.me.x), y: Math.round(C.me.y)}, hp: C.A && C.A.hp, out: C.A && C.A.out, cls: C.A && C.A.cls, am: C.am, sup: C.sup, proj: C.proj.length, bots: Object.keys(HB.bots).length, fog: C.me ? fogAt(C.me.x, C.me.y) : -1, kop: C.pops.filter(p => p.ko).length, dpr: NPo().dpr, qn: Q.n, crates: MP ? MP.cr.length : 0, broken: C.crb.size, cubes: C.cubes.length, pw: C.pw[me()] || 0, map: LAY && LAY.id});
  window.__arFire = (a, su, len, ch) => a == null ? autoFire(su, ch) : fire(a, su, len, ch);
  window.__arMove = (dx, dy) => { C.moveP = dx == null ? null : {dx, dy, id: -1}; };
  window.__arTo = (x, y) => { if (C.me){ C.me.x = x; C.me.y = y; } };
  window.__arSeen = id => { const q = pos(id); return q && {x: Math.round(q.x), y: Math.round(q.y), vis: visible(id)}; };
  window.__arSup = v => { C.sup = v; };
  window.__arAim = (dx, dy, su) => { const P2 = dx == null ? null : {x0: 0, y0: 0, dx, dy, man: true, id: -2}; if (su) C.supP = P2; else C.aimP = P2; };
  window.__arBot = (id, x, y) => { const b = HB.bots[id]; if (b){ b.x = b.px = x; b.y = b.py = y; } };
  window.__arFreeze = v => { HB.freeze = !!v; };
  /* test helpers: the nearest crate, a free spot next to it, the map */
  window.__arCrate = () => { if (!C.me || !MP) return null; let best = null; MP.cr.forEach((cr, i) => { if (!MP.ca[cr.c]) return; const d = Math.hypot(cr.x - C.me.x, cr.y - C.me.y); if (!best || d < best.d) best = {i, x: cr.x, y: cr.y, d}; }); return best; };
  window.__arFree = (x, y) => nearFree(x, y);
  window.__arMap = () => MP && {g: Array.from(MP.g), cr: MP.cr.map(c => [c.x, c.y]), w: MW, h: MH, ts: TS};

  const css = document.createElement("style"); css.textContent = `
.np.arena .np-ov,.np.arena .np-bar,.np.arena .np-emob,.np.arena .np-emos,.np.arena .np-mapb,.np.arena .np-btns,.np.arena .np-tasks,.np.arena .np-tbar,.np.arena .np-alert,.np.arena .np-ev,.np.arena .np-joy,.np.arena .np-lob,.np.arena .np-panel:not(.on){display:none!important}
.np.arena .np-cv{filter:none!important}.np.arena .np-top{z-index:8}
.ar-l{position:absolute;inset:0;z-index:6;touch-action:none;-webkit-user-select:none;user-select:none}
.ar-hud{position:absolute;top:calc(var(--st,0px) + 12px);left:calc(50% + (var(--sl,0px) - var(--sr,0px)) / 2);transform:translateX(-50%);display:flex;gap:8px;pointer-events:none}
.ar-hud span{background:rgba(20,19,17,.8);border-radius:12px;padding:6px 12px;font:900 17px var(--display);color:#fff;white-space:nowrap}
.ar-hud .ar-rd{background:rgba(233,169,43,.92);color:#2a1d05}.ar-hud [hidden]{display:none}
.ar-hud .ar-gas{display:none;background:#2f7a33}.ar-hud .ar-gas.on{display:block;animation:arPulse 1s ease-in-out infinite}
@keyframes arPulse{50%{transform:scale(1.08)}}
.ar-feed{position:absolute;top:calc(var(--st,0px) + 64px);right:calc(var(--sr,0px) + 12px);display:flex;flex-direction:column;gap:4px;align-items:flex-end;pointer-events:none}
.ar-feed div{background:rgba(20,19,17,.72);border-radius:10px;padding:3px 9px;font:700 13px var(--body);color:#ddd;display:flex;align-items:center;gap:5px}.ar-feed b{color:#fff}
.ar-fi{display:inline-flex;width:20px;height:20px;border-radius:6px;background:var(--c);padding:2px;box-sizing:border-box;flex:none}.ar-fi svg{width:100%;height:100%;display:block}
.ar-ban{position:absolute;left:0;right:0;top:max(calc(var(--st,0px) + 58px),14%);text-align:center;pointer-events:none;font:900 clamp(32px,min(10vh,10vw),56px) var(--display);color:#fff;text-shadow:0 5px 0 rgba(0,0,0,.35);opacity:0;display:flex;flex-direction:column;align-items:center}
.ar-ban small{font:800 clamp(15px,min(4.4vh,4.4vw),20px) var(--body);margin-top:2px;text-shadow:0 2px 0 rgba(0,0,0,.45)}
.ar-ban.on{animation:arBan 1.8s ease-out forwards}.ar-ban.go{color:#9BE25A}.ar-ban.out{color:#ff7a66}.ar-ban.win{color:#FFD15C}
@keyframes arBan{0%{opacity:0;transform:scale(1.6)}12%{opacity:1;transform:scale(1)}75%{opacity:1}100%{opacity:0;transform:translateY(-20px)}}
.ar-pick{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(ellipse at 50% 30%,rgba(40,38,34,.9),rgba(6,7,12,.92));padding:calc(var(--st,0px) + 10px) calc(var(--sr,0px) + 10px) calc(var(--sb,0px) + 10px) calc(var(--sl,0px) + 10px)}
.ar-pick.on{display:flex}
.ar-pt{font:900 24px var(--display);color:#fff;letter-spacing:-.01em}
.ar-cards{display:flex;gap:8px;justify-content:center;flex-wrap:nowrap;max-width:100%;padding-top:8px}
.ar-card{--c:#8FC458;position:relative;width:min(140px,calc((100vw - var(--sl,0px) - var(--sr,0px) - 66px) / 6));min-width:0;flex:0 1 auto;padding:10px 5px 9px;border-radius:18px;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 22%,#262420) 0%,#1e1d1b 62%);border:2px solid rgba(255,255,255,.08);display:flex;flex-direction:column;align-items:center;gap:3px;color:#fff;font:800 14px var(--body);box-shadow:0 5px 0 rgba(0,0,0,.45);transition:transform .14s cubic-bezier(.3,1.6,.5,1),box-shadow .14s,border-color .15s,background .15s;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.ar-card .ar-pic{width:min(66px,86%);aspect-ratio:1;display:block;filter:drop-shadow(0 4px 0 rgba(0,0,0,.35));transition:transform .2s cubic-bezier(.3,1.6,.5,1)}.ar-card .ar-pic svg{width:100%;height:100%;display:block}
.ar-card.press,.ar-card:active{transform:translateY(4px) scale(.96);box-shadow:0 1px 0 rgba(0,0,0,.45)}
.ar-card.sel{border-color:var(--c);background:linear-gradient(180deg,color-mix(in srgb,var(--c) 50%,#262420) 0%,#1e1d1b 74%);box-shadow:0 5px 0 color-mix(in srgb,var(--c) 50%,#000),0 0 28px color-mix(in srgb,var(--c) 45%,transparent);transform:translateY(-6px)}
.ar-card.sel .ar-pic{transform:scale(1.1) rotate(-5deg)}.ar-card.sel.press{transform:translateY(-1px) scale(.97)}
.ar-card.pop{animation:arPop .36s cubic-bezier(.3,1.6,.5,1)}@keyframes arPop{0%{transform:translateY(3px) scale(.9)}60%{transform:translateY(-9px) scale(1.06)}100%{transform:translateY(-6px) scale(1)}}
.ar-ok{position:absolute;top:-9px;right:-7px;width:24px;height:24px;border-radius:50%;background:var(--c);color:#fff;font:900 14px/24px var(--body);text-align:center;box-shadow:0 2px 0 rgba(0,0,0,.4);transform:scale(0);transition:transform .22s cubic-bezier(.3,1.6,.5,1);z-index:1}.ar-card.sel .ar-ok{transform:scale(1)}
.ar-card b{font-size:min(14px,1.88vmax);letter-spacing:-.015em;margin-top:2px}.ar-card small{color:var(--muted,#aaa);font-weight:700;font-size:11px;line-height:1.2;text-align:center;min-height:26px}
.ar-card em{font-style:normal;font-size:min(11px,1.55vmax);font-weight:800;color:#FFD15C;text-align:center;line-height:1.15}
.ar-card b,.ar-card em{max-width:100%;overflow:hidden;text-align:center;white-space:normal;-webkit-hyphens:auto;hyphens:auto;overflow-wrap:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.12}
.ar-kb{display:none}@media (hover:hover) and (pointer:fine){.ar-kb{display:block;position:absolute;top:6px;left:8px;font:800 11px var(--mono,monospace);color:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.25);border-radius:5px;padding:1px 5px}}
@media (pointer:fine){.ar-l{cursor:crosshair}.ar-l button,.ar-l .ar-card{cursor:pointer}.ar-card:not(.sel):hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--c) 60%,transparent)}}
.ar-card .hp{font-style:normal;font-size:12px;color:#ff8a78;font-weight:900}.ar-card .hp u{text-decoration:none;color:#FFD34A;margin-left:4px}
.ar-card .who{display:flex;gap:0;min-height:24px;max-width:100%}.ar-card .who .np-hd+.np-hd{margin-left:-6px;box-shadow:0 0 0 2px var(--panel,#1e1d1b)}.ar-card .who .np-hd{width:24px;height:24px;overflow:hidden;border-radius:50%}.ar-card .who svg{width:100%;height:100%;display:block}
@media (min-width:1000px) and (min-height:640px){.ar-card{width:150px;padding:14px 8px 10px;font-size:16px;gap:4px}.ar-card b{font-size:16px}.ar-card .ar-pic{width:78px}.ar-card small,.ar-card em{font-size:12.5px}.ar-card .hp{font-size:14px}.ar-cards{gap:12px}}
.ar-pbar{width:min(420px,70%);height:6px;background:rgba(255,255,255,.12);border-radius:3px;overflow:hidden}.ar-pbar i{display:block;height:100%;background:var(--go-hi,#8FC458);transition:width .12s linear}
.ar-joy{position:absolute;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;background:rgba(244,242,238,.08);border:2px solid rgba(244,242,238,.18);display:none;pointer-events:none}.ar-joy.on{display:block}
.ar-joy i{position:absolute;left:50%;top:50%;width:52px;height:52px;border-radius:50%;background:rgba(244,242,238,.35);transform:translate(-50%,-50%)}
.ar-fire{--c:#E9573F;position:absolute;right:calc(var(--sr,0px) + 28px);bottom:calc(var(--sb,0px) + 34px);width:110px;height:110px;border-radius:50%;background:color-mix(in srgb,var(--c) 16%,transparent);border:3px solid color-mix(in srgb,var(--c) 55%,transparent);pointer-events:none;display:flex;align-items:center;justify-content:center}
.ar-fire.on{background:color-mix(in srgb,var(--c) 28%,transparent)}.ar-fire.chg{box-shadow:0 0 0 6px rgba(169,214,255,.35),0 0 26px rgba(169,214,255,.55)}
.ar-fire b{width:62px;height:62px;border-radius:50%;background:var(--c);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 0 rgba(0,0,0,.3)}.ar-fire b svg{width:40px;height:40px}
.ar-am{position:absolute;bottom:-17px;display:flex;gap:4px}.ar-am i{width:26px;height:8px;border-radius:4px;background:rgba(255,255,255,.18);overflow:hidden;display:block}.ar-am u{display:block;height:100%;width:100%;transform:scaleX(0);transform-origin:left center;background:#9b6a2a;will-change:transform}.ar-am i.full u{background:#F2A33A}
.ar-sup{position:absolute;right:calc(var(--sr,0px) + 150px);bottom:calc(var(--sb,0px) + 26px);width:76px;height:76px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(20,19,17,.55);border:3px solid rgba(255,209,92,.25);touch-action:none}
.ar-sup b{width:52px;height:52px;border-radius:50%;background:rgba(120,110,90,.6);display:flex;align-items:center;justify-content:center;filter:grayscale(.8);pointer-events:none;transition:transform .12s}.ar-sup b svg{width:32px;height:32px}
.ar-sup svg{pointer-events:none}.ar-sup>svg{position:absolute;inset:-3px;width:calc(100% + 6px);height:calc(100% + 6px);transform:rotate(-90deg)}.ar-sup circle{fill:none;stroke:#FFD15C;stroke-width:7;stroke-dasharray:289;stroke-dashoffset:289;stroke-linecap:round;transition:stroke-dashoffset .2s}
.ar-sup.ready{border-color:#FFD15C;animation:arSup 1s ease-in-out infinite}.ar-sup.ready b{background:#E9A92B;filter:none;box-shadow:0 4px 0 rgba(0,0,0,.3)}.ar-sup.on b{transform:scale(1.12)}
@keyframes arSup{50%{box-shadow:0 0 22px 4px rgba(255,209,92,.55)}}
.ar-tip{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .4s}.ar-tip.on{opacity:1}
.ar-tip span{position:absolute;background:rgba(255,255,255,.94);color:#1b1a18;font:800 13px var(--body);padding:6px 10px;border-radius:11px;white-space:nowrap;line-height:1.2;box-shadow:0 6px 18px rgba(0,0,0,.35)}
.ar-tip .t-mv{left:calc(var(--sl,0px) + 24px);bottom:calc(var(--sb,0px) + 120px)}
.ar-tip .t-fire{right:calc(var(--sr,0px) + 18px);bottom:calc(var(--sb,0px) + 156px)}
.ar-tip .t-sup{right:calc(var(--sr,0px) + 120px);bottom:calc(var(--sb,0px) + 112px);background:#FFD15C}
.ar-tip .t-fog{left:50%;top:calc(var(--st,0px) + 70px);transform:translateX(-50%);white-space:nowrap;background:#B8F07A}.ar-tip.ban .t-fog{opacity:0;transition:opacity .2s}
.ar-tip.on span{animation:arTip 1.4s ease-in-out infinite alternate}@keyframes arTip{to{translate:0 -5px}}
.ar-emb{position:absolute;top:calc(var(--st,0px) + 12px);right:calc(var(--sr,0px) + 12px);width:44px;height:44px;border-radius:14px;border:0;background:rgba(20,19,17,.8);font-size:24px;z-index:2}
.ar-emp{position:absolute;top:calc(var(--st,0px) + 62px);right:calc(var(--sr,0px) + 12px);display:none;grid-template-columns:repeat(4,46px);gap:6px;padding:8px;border-radius:16px;background:rgba(20,19,17,.92);z-index:3}.ar-emp.on{display:grid}
.ar-emp button{width:46px;height:46px;border-radius:12px;border:0;background:rgba(255,255,255,.08);font:900 22px var(--display);color:#fff}.ar-emp button:active{transform:scale(.92)}
.ar-res{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(6,7,12,.72);padding:calc(var(--st,0px) + 12px) calc(var(--sr,0px) + 12px) calc(var(--sb,0px) + 12px) calc(var(--sl,0px) + 12px);z-index:3}
.ar-res.on{display:flex;animation:arIn .3s ease-out}@keyframes arIn{from{opacity:0;transform:scale(.96)}}
.ar-rbox{background:var(--panel,#1e1d1b);border-radius:20px;padding:14px 16px;width:min(440px,100%);max-height:100%;overflow:auto;color:#fff;display:flex;flex-direction:column;gap:10px;box-shadow:0 18px 50px rgba(0,0,0,.5)}
.ar-rt{font:900 20px var(--display);text-align:center}.ar-rt b{color:#FFD15C}
.ar-rl{display:flex;flex-direction:column;gap:4px}.ar-rl>div{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:12px;background:rgba(255,255,255,.04);font:800 15px var(--body)}
.ar-rl>div.me{background:rgba(127,178,74,.18)}.ar-rl .r{width:20px;text-align:center;color:var(--muted,#aaa)}.ar-rl b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ar-rl .w{color:#FFD15C;min-width:44px;text-align:right;white-space:nowrap}.ar-rl .k{color:#ff9a88;min-width:44px;text-align:right;white-space:nowrap}.ar-rl .w,.ar-rl .k,.ar-rl .r{font-variant-numeric:tabular-nums}
.ar-rl .np-hd{width:28px;height:28px;border-radius:50%;overflow:hidden;flex:none}.ar-rl .np-hd svg{width:100%;height:100%;display:block}
.ar-rn{text-align:center;font:800 15px var(--body);color:var(--muted,#aaa)}.ar-rn b{color:#fff;font-size:20px}
.ar-rb{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.ar-perk{margin:6px 0}.ar-pq{font:900 16px var(--body);margin:4px 0 8px}
.ar-pks{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.ar-pk{display:flex;align-items:center;gap:8px;text-align:left;padding:10px;border-radius:14px;background:rgba(255,255,255,.06);border:2px solid rgba(255,255,255,.08);color:#fff}
.ar-pk span{font-size:28px}.ar-pk b{display:block;font:900 14px var(--body)}.ar-pk small{display:block;color:var(--muted,#aaa);font-size:11px;line-height:1.25}
.ar-pk:active{transform:scale(.97)}.ar-pk.done{border-color:var(--go-hi,#8FC458);justify-content:center;max-width:360px;margin:0 auto}
.ar-rv{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}.ar-rv button{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px;border-radius:12px;background:rgba(255,255,255,.06);color:#fff;border:2px solid rgba(255,255,255,.08)}
.ar-rw{text-align:center;font:900 14px var(--body);color:#9BE25A;margin:-2px 0 8px}.ar-rbox:has(.two){width:min(660px,100%)}.ar-rl.two{display:grid;grid-template-columns:1fr 1fr;gap:4px 8px}
.np.arena .ar-l:has(.ar-res.on) .ar-feed{display:none}
/* polish: frosted HUD chips, glossy sticks, a result box and fighter cards that match the rest of the app */
.ar-hud span,.ar-feed div,.ar-emb,.ar-emp{-webkit-backdrop-filter:blur(10px) saturate(1.3);backdrop-filter:blur(10px) saturate(1.3);box-shadow:inset 0 0 0 1px rgba(255,255,255,.09),0 4px 14px rgba(0,0,0,.25)}
.ar-hud span{background:rgba(20,19,17,.62);border-radius:14px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.ar-hud .ar-rd{background:linear-gradient(180deg,#F6C24A,#E9A92B);box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 4px 14px rgba(0,0,0,.25)}
.ar-hud .ar-gas{background:linear-gradient(180deg,#3E9A43,#2f7a33)}
.ar-feed div{background:rgba(20,19,17,.58);animation:arFeed .28s cubic-bezier(.3,1.5,.5,1) both}@keyframes arFeed{from{opacity:0;transform:translateX(18px)}}
.ar-emb{background:rgba(20,19,17,.62);transition:transform .12s}.ar-emb:active{transform:scale(.9)}
.ar-emp{background:rgba(20,19,17,.8);animation:arIn .16s ease-out}
.ar-pick{background:radial-gradient(ellipse at 50% 22%,rgba(58,62,44,.94),rgba(10,11,14,.95) 70%)}
.ar-pt{font-size:26px;text-shadow:0 3px 0 rgba(0,0,0,.35)}
.ar-card{border-color:rgba(255,255,255,.1);box-shadow:0 5px 0 rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.1)}
.ar-pbar{height:8px;border-radius:4px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}.ar-pbar i{border-radius:4px;background:linear-gradient(90deg,#7FB24A,#B8F07A)}
.ar-joy{background:radial-gradient(circle,rgba(244,242,238,.04) 40%,rgba(244,242,238,.12));border-color:rgba(244,242,238,.26);box-shadow:0 0 0 6px rgba(0,0,0,.08)}
.ar-joy i{background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.75),rgba(244,242,238,.32));box-shadow:0 4px 10px rgba(0,0,0,.3)}
.ar-fire{background:radial-gradient(circle,color-mix(in srgb,var(--c) 10%,transparent) 45%,color-mix(in srgb,var(--c) 26%,transparent));transition:background-color .12s}
.ar-fire b{background:radial-gradient(circle at 35% 28%,color-mix(in srgb,var(--c) 70%,#fff),var(--c) 58%,color-mix(in srgb,var(--c) 70%,#000));box-shadow:0 5px 0 rgba(0,0,0,.32),inset 0 2px 0 rgba(255,255,255,.3);transition:transform .08s}
.ar-fire.on b{box-shadow:0 2px 0 rgba(0,0,0,.32),inset 0 2px 0 rgba(255,255,255,.3)}
.ar-am i{box-shadow:inset 0 0 0 1px rgba(0,0,0,.35);height:9px}.ar-am i.full u{background:linear-gradient(180deg,#FFC457,#F2A33A)}
.ar-sup{background:rgba(20,19,17,.5);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.ar-sup.ready b{background:radial-gradient(circle at 35% 28%,#FFE59A,#E9A92B 60%,#B97C12);box-shadow:0 4px 0 rgba(0,0,0,.3),inset 0 2px 0 rgba(255,255,255,.4)}
.ar-tip span{border-radius:13px}
.ar-res{-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.ar-rbox{border-radius:22px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.08)}
.ar-rt{font-size:22px;letter-spacing:-.01em}.ar-rw{display:inline-block;align-self:center;background:rgba(155,226,90,.12);border-radius:999px;padding:4px 12px;margin:-2px 0 4px}
.ar-rl>div{padding:6px 10px;border-radius:13px}.ar-rl>div.me{box-shadow:inset 0 0 0 1.5px rgba(143,196,88,.5)}
.ar-rl>div:first-child .r{color:#FFD15C}
.ar-pk,.ar-rv button{transition:transform .12s,border-color .15s}
.np-rules .ar-ri{display:block;width:40px;height:40px;margin:0 auto 4px}.np-rules .ar-ri svg{width:100%;height:100%;display:block}
.np.rot .ar-card{width:min(132px,calc((100vh - 66px) / 6))}
@media (max-width:760px),(max-height:420px){.ar-cards{gap:5px}.ar-card{border-width:2px;border-radius:15px}}
@media (max-width:420px){.np.rot .ar-card{padding:6px 3px}.np.rot .ar-card small{display:none}.np.rot .ar-pt{font-size:20px}.np.rot .ar-card b{font-size:min(12px,1.75vmax)}}
@media (max-height:400px){.ar-fire{width:92px;height:92px;right:calc(var(--sr,0px) + 20px);bottom:calc(var(--sb,0px) + 28px)}.ar-fire b{width:52px;height:52px}.ar-fire b svg{width:34px;height:34px}.ar-sup{width:64px;height:64px;right:calc(var(--sr,0px) + 124px);bottom:calc(var(--sb,0px) + 20px)}.ar-sup b{width:44px;height:44px}
  .ar-tip span{font-size:12px;padding:5px 8px}.ar-tip .t-fire{bottom:calc(var(--sb,0px) + 132px)}.ar-tip .t-sup{right:calc(var(--sr,0px) + 100px);bottom:calc(var(--sb,0px) + 92px)}.ar-hud span{font-size:15px;padding:5px 10px}}
@media (max-height:420px){.ar-card{padding:7px 3px 6px}.ar-card .ar-pic{width:min(46px,80%)}.ar-card small{display:none}.ar-card b{font-size:min(12.5px,1.8vmax)}.ar-pt{font-size:20px}.ar-pick{gap:8px}.ar-pk{padding:7px 8px}.ar-pk span{font-size:24px}.ar-pq{margin:2px 0 6px}.ar-rbox{padding:10px 12px;gap:6px}.ar-rl>div{padding:3px 8px}}
.np-duel:has(.ar-pks) .du-rank>div:nth-child(n+4),.np-duel:has(.ar-rv) .du-rank>div:nth-child(n+4){display:none}
`; document.head.appendChild(css);
})();
