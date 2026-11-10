/* ===== Natposter: our own space-station game. Crew does tasks, the Natposter kills, vents and sabotages.
   Everyone plays on their own phone (online lobby). Your own Chess.nat avatar walks around.
   - Every phone moves its own figure and sends its position ("mv", ~8 times a second while moving).
   - The host's phone decides everything else: roles, kills, bodies, tasks, meetings, votes, sabotage, who wins.
   Same look as the app: the dark panels, the green, the board colours, the pawn plop. ===== */
(() => {
  const {T} = PG, now = () => Date.now();

  /* ---------------- the station ---------------- */
  const R = (id, de, en, x, y, w, h, floor) => ({id, de, en, x, y, w, h, floor});
  const ROOMS = [
    R("med", "Krankenstation", "Medbay", 300, 140, 400, 340, "tile"), R("caf", "Kantine", "Cafeteria", 1000, 120, 560, 440, "plank"), R("com", "Funkraum", "Comms", 1860, 140, 340, 340, "grid"),
    R("rea", "Reaktor", "Reactor", 60, 620, 360, 360, "grid"), R("chess", "Schach-Lounge", "Chess lounge", 600, 640, 380, 320, "board"), R("sto", "Lager", "Storage", 1100, 640, 380, 360, "plank"),
    R("o2", "Sauerstoff", "Oxygen", 1620, 660, 320, 280, "tile"), R("bri", "Brücke", "Bridge", 2080, 600, 360, 400, "grid"),
    R("ele", "Elektrik", "Electrical", 300, 1120, 400, 320, "grid"), R("lab", "Labor", "Lab", 1000, 1120, 500, 340, "tile"), R("nav", "Navigation", "Navigation", 1760, 1120, 400, 320, "grid")];
  const HALLS = [[700, 260, 300, 120], [1560, 260, 300, 120], [1230, 556, 120, 88], [300, 476, 120, 148], [416, 760, 188, 120], [976, 760, 128, 120], [1476, 760, 148, 120], [1936, 760, 148, 120],
    [2080, 476, 120, 128], [300, 976, 120, 148], [1180, 996, 120, 128], [696, 1240, 308, 120], [1496, 1240, 268, 120], [2080, 996, 80, 128]].map(([x, y, w, h]) => ({x, y, w, h}));
  const AREAS = ROOMS.concat(HALLS);
  const W = 2500, H = 1580, RAD = 20;
  const VENTS = [{id: "rea", x: 130, y: 700, to: ["ele"]}, {id: "ele", x: 380, y: 1390, to: ["rea"]}, {id: "med", x: 360, y: 210, to: ["chess"]}, {id: "chess", x: 920, y: 910, to: ["med"]},
    {id: "com", x: 2140, y: 420, to: ["nav", "bri"]}, {id: "nav", x: 2100, y: 1390, to: ["com", "bri"]}, {id: "bri", x: 2390, y: 660, to: ["com", "nav"]},
    {id: "caf", x: 1070, y: 500, to: ["sto"]}, {id: "sto", x: 1420, y: 950, to: ["caf"]}, {id: "lab", x: 1440, y: 1410, to: ["o2"]}, {id: "o2", x: 1880, y: 890, to: ["lab"]}];
  const TASKS = [
    {id: "w1", room: "ele", x: 470, y: 1150, g: "wires", de: "Kabel reparieren", en: "Fix wiring"}, {id: "w2", room: "caf", x: 1500, y: 150, g: "wires", de: "Kabel reparieren", en: "Fix wiring"},
    {id: "w3", room: "nav", x: 1810, y: 1150, g: "wires", de: "Kabel reparieren", en: "Fix wiring"}, {id: "up", room: "com", x: 2040, y: 175, g: "upload", de: "Daten senden", en: "Upload data"},
    {id: "ch", room: "chess", x: 790, y: 690, g: "chess", de: "Matt in 1", en: "Mate in 1"}, {id: "sw", room: "rea", x: 110, y: 930, g: "switches", de: "Kühlung an", en: "Cooling on"},
    {id: "nu", room: "lab", x: 1250, y: 1150, g: "numbers", de: "Proben sortieren", en: "Sort samples"}, {id: "id", room: "bri", x: 2400, y: 950, g: "swipe", de: "Ausweis scannen", en: "Swipe card"},
    {id: "sc", room: "med", x: 520, y: 430, g: "scan", de: "Körperscan", en: "Body scan"}, {id: "fu", room: "sto", x: 1150, y: 960, g: "hold", de: "Treibstoff tanken", en: "Refuel"},
    {id: "fi", room: "o2", x: 1780, y: 690, g: "switches", de: "Filter wechseln", en: "Change filters"}, {id: "co", room: "nav", x: 2110, y: 1300, g: "course", de: "Kurs setzen", en: "Chart course"},
    {id: "as", room: "bri", x: 2150, y: 640, g: "numbers", de: "Systeme prüfen", en: "Run checks"}, {id: "dl", room: "lab", x: 1460, y: 1300, g: "upload", de: "Daten laden", en: "Download data"},
    {id: "ast", room: "bri", x: 2260, y: 960, g: "asteroids", de: "Asteroiden abwehren", en: "Clear asteroids"}, {id: "tr", room: "sto", x: 1430, y: 690, g: "trash", de: "Müll entsorgen", en: "Empty trash"}];
  const STA = {cams: {x: 1920, y: 440}, admin: {x: 2300, y: 860}, vitals: {x: 640, y: 196}};
  const FIX = {lights: {x: 650, y: 1410, g: "switches", s: "lights"}, ra: {x: 100, y: 650, g: "hold", s: "reactor"}, rb: {x: 380, y: 650, g: "hold", s: "reactor"},
    oa: {x: 1680, y: 900, g: "code", s: "o2"}, ob: {x: 2120, y: 900, g: "code", s: "o2"}, comms: {x: 2150, y: 230, g: "tune", s: "comms"}};
  const SABS = ["lights", "reactor", "o2", "comms"], CRIT = {reactor: 1, o2: 1};
  const KILLS = ["stab", "head", "chess", "shot", "bite"];
  /* the minigame at an emergency meeting: a wheel picks it, everybody plays, the winner's vote counts twice */
  const DUELS = {react: {d: 6000, e: "⚡", en: "Reaction", de: "Reaktion"}, tap: {d: 5000, e: "👆", en: "Tap race", de: "Tipp-Rennen"}, snake: {d: 15000, e: "🐍", en: "Snake", de: "Snake"},
    mate: {d: 20000, e: "♞", en: "Mate in 1", de: "Matt in 1"}, song: {d: 15000, e: "🎵", en: "Name that song", de: "Songraten"}};
  const SPIN = 2800, RES = 3200;
  const MATES = ["6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", "k7/8/1K6/8/8/8/8/7Q w - - 0 1", "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1", "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1", "5rk1/5ppp/8/8/8/8/1Q3PPP/6K1 w - - 0 1", "7k/7p/8/8/8/8/6R1/1R4K1 w - - 0 1"];
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const botScore = g => g === "react" ? -(260 + Math.random() * 380) : g === "tap" ? 14 + Math.floor(Math.random() * 20) : g === "snake" ? Math.floor(Math.random() * 9) : g === "mate" ? (Math.random() < .7 ? -(4000 + Math.random() * 12000) : -99999) : (Math.random() < .45 ? -(2000 + Math.random() * 7000) : -99999);
  /* songs: 30-second previews from Apple's public search, only the first seconds are played */
  const SONG_Q = ["Taylor Swift", "Ed Sheeran", "Apache 207", "Cro", "Helene Fischer", "The Weeknd", "Dua Lipa", "Rihanna", "Queen", "ABBA", "Coldplay", "Peter Fox", "Miley Cyrus", "Harry Styles", "Bruno Mars", "Eminem", "Linkin Park", "Michael Jackson", "Kraftklub", "Sido", "Billie Eilish", "Imagine Dragons", "Adele", "David Guetta"];
  const songPick = () => new Promise((res, rej) => { const cb = "__npS" + Math.random().toString(36).slice(2), sc = document.createElement("script");
    const done = () => { clearTimeout(to); try { delete window[cb]; } catch(e) {} sc.remove(); }, to = setTimeout(() => { done(); rej(new Error("timeout")); }, 2600);
    window[cb] = d => { done(); const seen = {}, L = PG.shuffle((d && d.results || []).filter(r => r.previewUrl && r.trackName && /^https:\/\/[a-z0-9.-]+\.(apple|mzstatic)\.com\//.test(r.previewUrl)).filter(r => { const k = r.trackName.toLowerCase().replace(/\s*\(.*$/, ""); if (seen[k]) return false; seen[k] = 1; return true; }));
      if (L.length < 4) return rej(new Error("few")); const pick = L.slice(0, 4), a = Math.floor(Math.random() * 4); res({url: pick[a].previewUrl, opts: pick.map(r => r.trackName.replace(/\s*\((feat|ft)\..*$/i, "").slice(0, 50)), a, by: String(pick[a].artistName || "").slice(0, 40)}); };
    sc.onerror = () => { done(); rej(new Error("net")); }; sc.src = `https://itunes.apple.com/search?term=${encodeURIComponent(PG.pick(SONG_Q))}&entity=song&limit=40&country=DE&callback=${cb}`; document.head.appendChild(sc); });
  /* quick chat in meetings: only ready-made lines, so nothing anyone types ever shows on another phone */
  const IN = {med: "in der Krankenstation", caf: "in der Kantine", com: "im Funkraum", rea: "im Reaktor", chess: "in der Schach-Lounge", sto: "im Lager", o2: "im Sauerstoffraum", bri: "auf der Brücke", ele: "in der Elektrik", lab: "im Labor", nav: "in der Navigation", hall: "im Gang"};
  const EMO = ["😱", "🤔", "🙄", "😂", "🔪", "👀", "🤫", "😤"];
  const SAY = {where: 1, body: 1, nothing: 1, self: 1, skip: 1, sus: 1, with: 1, vent: 1, emo: 1};
  const roomIn = id => { const r = ROOMS.find(x => x.id === id); return T(r ? "in " + r.en : "in a hallway", IN[id] || IN.hall); };
  /* crew events: a few people have to stand on the plates together and hold for 3 seconds */
  const EVS = [{id: "lift", room: "sto", de: "Frachtlift hochfahren", en: "Raise the cargo lift", c: {x: 1290, y: 830}},
    {id: "dock", room: "nav", de: "Andockklammern lösen", en: "Release the docking clamps", c: {x: 1940, y: 1250}},
    {id: "cool", room: "lab", de: "Probe gemeinsam kühlen", en: "Cool the sample together", c: {x: 1250, y: 1210}}];
  const padsOf = (e, n) => [[-110, 0], [110, 0], [0, 100]].slice(0, n).map(([dx, dy]) => ({x: e.c.x + dx, y: e.c.y + dy}));
  const needFix = (sab, k) => !!sab && FIX[k] && FIX[k].s === sab.type && !sab[k];
  const BTN = {x: 1280, y: 340};
  const VIS = {crew: 340, dark: 125, imp: 470};
  const SPEED = 270, KILL_R = 115, USE_R = 95, REPORT_R = 150, VENT_R = 75;
  /* doors: the doorway between a room and each hall that touches it */
  const DOORS = {}; ROOMS.forEach(r => { DOORS[r.id] = HALLS.map(hl => { const x1 = Math.max(r.x, hl.x), x2 = Math.min(r.x + r.w, hl.x + hl.w), y1 = Math.max(r.y, hl.y), y2 = Math.min(r.y + r.h, hl.y + hl.h);
    if (x1 > x2 + 1 || y1 > y2 + 1) return null; const vert = x2 - x1 < y2 - y1; return vert ? {x: (x1 + x2) / 2 - 12, y: y1, w: 24, h: y2 - y1} : {x: x1, y: (y1 + y2) / 2 - 12, w: x2 - x1, h: 24}; }).filter(Boolean); });
  let CLOSED = [];
  const blocked = (x, y) => CLOSED.some(d => x > d.x - RAD && x < d.x + d.w + RAD && y > d.y - RAD && y < d.y + d.h + RAD);
  const roomAt = (x, y) => ROOMS.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  const inA = (x, y) => AREAS.some(a => x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h);
  const walk = (x, y) => !blocked(x, y) && inA(x - RAD, y) && inA(x + RAD, y) && inA(x, y - RAD) && inA(x, y + RAD + 6) && inA(x - RAD * .7, y + RAD * .7) && inA(x + RAD * .7, y + RAD * .7);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const RN = r => T(r.en, r.de);
  const spawnAt = (i, n) => { const a = i / Math.max(1, n) * Math.PI * 2 - Math.PI / 2; return {x: Math.round(BTN.x + Math.cos(a) * 150), y: Math.round(BTN.y + 20 + Math.sin(a) * 120)}; };

  /* the station as a graph: rooms and halls that touch, the doorway between them */
  const ADJ = AREAS.map((a, i) => AREAS.map((b, j) => j).filter(j => { if (j === i) return false; const b = AREAS[j], x1 = Math.max(a.x, b.x), x2 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.max(a.y, b.y), y2 = Math.min(a.y + a.h, b.y + b.h); return x1 <= x2 + 1 && y1 <= y2 + 1 && (x2 - x1 > 30 || y2 - y1 > 30); }));
  const areaOf = (x, y) => AREAS.findIndex(a => x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h);
  const mid = a => ({x: a.x + a.w / 2, y: a.y + a.h / 2});
  const door = (a, b) => { const x1 = Math.max(a.x, b.x), x2 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.max(a.y, b.y), y2 = Math.min(a.y + a.h, b.y + b.h); return {x: (x1 + x2) / 2, y: (y1 + y2) / 2}; };
  function route(from, to){
    const s0 = areaOf(from.x, from.y), t0 = areaOf(to.x, to.y); if (s0 < 0 || t0 < 0 || s0 === t0) return [to];
    const prev = {[s0]: -1}, q = [s0]; while (q.length){ const i = q.shift(); if (i === t0) break; ADJ[i].forEach(j => { if (prev[j] === undefined){ prev[j] = i; q.push(j); } }); }
    if (prev[t0] === undefined) return [to]; const chain = []; for (let i = t0; i !== -1; i = prev[i]) chain.unshift(i);
    const w = []; for (let k = 0; k + 1 < chain.length; k++){ const a = AREAS[chain[k]], b = AREAS[chain[k + 1]]; w.push(door(a, b)); if (k + 1 < chain.length - 1) w.push(mid(b)); } w.push(to); return w;
  }

  /* positions of everyone, fed by "mv" messages and by this phone's own movement */
  const POS = {};
  PG.onMv = m => { if (m && m.t === "mvb" && Array.isArray(m.l)){ m.l.forEach(([id, x, y, f, g, mv, sc]) => PG.onMv({id, x, y, f, g, m: mv, sc})); return; } if (!m || !m.id) return; const p = POS[m.id] || (POS[m.id] = {x: m.x, y: m.y, dx: m.x, dy: m.y}); const x = +m.x || 0, y = +m.y || 0, t = now(); p.buf = p.buf || []; const last = p.buf[p.buf.length - 1]; if (last && Math.hypot(last.x - x, last.y - y) > 320) p.buf = []; p.buf.push({t, x, y}); if (p.buf.length > 8) p.buf.shift();
    if (!!m.v !== !!p.v) p.vt = t; p.x = x; p.y = y; p.g = !!m.g; p.v = !!m.v; p.f = m.f || 1; p.t = t; p.mv = !!m.m; p.sc = !!m.sc; };

  /* ---------------- practice bots: the app's chess bots, run by the host's phone ---------------- */
  const BOT = {G: null, id: 0, last: 0, mem: {},
    list(G){ return (G.s.bots || []); },
    run(G, api){ this.G = G; if (this.id) return; this.last = now(); this.id = setInterval(() => { try { this.step(api); } catch(e) { console.error(e); } }, 100); },
    stop(){ clearInterval(this.id); this.id = 0; this.mem = {}; },
    step(api){
      const G = this.G; if (!G || !G.s || !PNet.P || !PNet.P.G || PNet.P.G !== G){ this.stop(); return; }
      const s = G.s, dt = (now() - this.last) / 1000; this.last = now(); const eng = PG.online.natposter, out = [];
      this.list(G).forEach(b => { const id = b.id, p = POS[id] || (POS[id] = Object.assign({}, s.spawn[id])), m = this.mem[id] || (this.mem[id] = {path: [], wait: 0, goal: null}), alive = s.alive[id], imp = s.imps.includes(id);
        if (s.phase === "meet" && alive && (m.said || 0) < 2 && now() - (s.meet.mg ? s.meet.mg.end + RES : s.meet.start) > (m.st || (m.st = 1800 + Math.random() * 6500))){ m.said = (m.said || 0) + 1; m.st = now() - (s.meet.mg ? s.meet.mg.end + RES : s.meet.start) + 2500 + Math.random() * 7000; const r = roomAt(p.x, p.y), bd = s.meet.body && s.bodies.find(x => x.id === s.meet.body), others = G.ids.filter(x => x !== id && s.alive[x]);
          const line = m.said === 2 ? (Math.random() < .55 ? "emo|" + Math.floor(Math.random() * EMO.length) : Math.random() < .5 ? "skip" : "nothing")
            : s.meet.by === id && bd ? "body|" + ((roomAt(bd.x, bd.y) || {}).id || "hall") : m.sus && s.alive[m.sus] && Math.random() < .7 ? "sus|" + m.sus : imp && Math.random() < .35 ? (Math.random() < .5 ? "self" : "sus|" + PG.pick(others.filter(x => !s.imps.includes(x)))) : Math.random() < .2 && others.length ? "with|" + PG.pick(others) : "where|" + ((r || {}).id || "hall");
          eng.act(G, id, {a: "say", v: line}, api); api.push(); }
        if (s.phase === "meet"){ m.path = []; m.goal = null; if (alive && !s.meet.votes[id] && now() - (s.meet.mg ? s.meet.mg.end + RES : s.meet.start) > (m.vt || (m.vt = 4000 + Math.random() * 12000))){ const sus = m.sus && s.alive[m.sus] && m.sus !== id ? m.sus : null; const opts = G.ids.filter(x => s.alive[x] && x !== id && !(imp && s.imps.includes(x)));
            eng.act(G, id, {a: "vote", v: sus && Math.random() < .7 ? sus : Math.random() < .45 ? "skip" : PG.pick(opts) || "skip"}, api); api.push(); } return; }
        m.vt = 0; m.said = 0; m.st = 0; if (s.phase !== "play" || now() < s.intro){ if (s.spawn[id] && m.sk !== s.spawnK){ m.sk = s.spawnK; Object.assign(p, s.spawn[id]); m.path = []; m.goal = null; } out.push([id, p.x, p.y, p.f || 1, alive ? 0 : 1, 0]); return; }
        if (s.spawn[id] && m.sk !== s.spawnK){ m.sk = s.spawnK; Object.assign(p, s.spawn[id]); m.path = []; m.goal = null; }
        const crewSeen = r => G.ids.filter(x => x !== id && s.alive[x] && !s.imps.includes(x) && POS[x] && dist(p, POS[x]) < r);
        /* the Natposter bot: kill someone who is alone, now and then switch the lights off */
        if (imp && alive){
          if (!s.sab && now() >= s.sabAt && Math.random() < .002){ eng.act(G, id, {a: "sab", v: PG.pick(["lights", "lights", "comms", "reactor", "o2"])}, api); api.push(); }
          if (now() >= s.killAt[id]){ const t = crewSeen(500).find(x => G.ids.filter(y => y !== id && y !== x && s.alive[y] && POS[y] && dist(POS[y], POS[x]) < 380).length === 0);
            if (t){ if (dist(p, POS[t]) <= KILL_R * .8){ eng.act(G, id, {a: "kill", v: t}, api); api.push(); m.path = []; m.goal = null; m.wait = 1.5; } else { m.path = [{x: POS[t].x, y: POS[t].y}]; m.goal = {hunt: t}; } } }
        }
        /* crew bots report what they see and fix sabotage */
        if (m.goal && m.goal.ev != null && !s.ev){ m.goal = null; m.path = []; m.wait = 0; }
        if (alive && s.ev && !(m.goal && (m.goal.ev != null || m.goal.fix || m.goal.hunt || m.goal.body)) && Math.random() < (imp ? .004 : .012)){ const taken = this.list(G).filter(b2 => b2.id !== id && this.mem[b2.id] && this.mem[b2.id].goal && this.mem[b2.id].goal.ev != null).map(b2 => this.mem[b2.id].goal.ev);
          const i = s.ev.pads.findIndex((pd, j) => !taken.includes(j)); if (i >= 0){ m.path = route(p, s.ev.pads[i]); m.goal = {ev: i}; m.wait = 0; } }
        if (alive && !imp){ const body = s.bodies.find(bd => dist(p, bd) < (s.sab && s.sab.type === "lights" ? VIS.dark : VIS.crew));
          if (body && (m.bseen && m.bseen.id === body.id ? now() >= m.bseen.t : (m.bseen = {id: body.id, t: now() + 900 + Math.random() * 1600}, false))){ if (dist(p, body) <= REPORT_R * .8){ m.sus = G.ids.filter(x => x !== id && s.alive[x] && POS[x] && dist(POS[x], body) < 420).sort(() => Math.random() - .5)[0] || null; eng.act(G, id, {a: "report", v: body.id}, api); api.push(); return; } if (!m.goal || !m.goal.body){ m.path = route(p, body); m.goal = {body: body.id}; } }
          if (s.sab && (!m.goal || !m.goal.fix)){ const keys = Object.keys(FIX).filter(k => needFix(s.sab, k)), taken = k => this.list(G).some(b2 => b2.id !== id && this.mem[b2.id] && this.mem[b2.id].goal && this.mem[b2.id].goal.fix === k);
            const k = keys.find(k2 => !taken(k2)) || PG.pick(keys); if (k && Math.random() < .02){ m.path = route(p, FIX[k]); m.goal = {fix: k}; } }
        }
        if (m.wait > 0){ m.wait -= dt; if (m.wait <= 0 && m.goal && m.goal.task && !imp){ eng.act(G, id, {a: "task", v: m.goal.task}, api); api.push(); m.goal = null; } if (m.wait <= 0 && m.goal && m.goal.fix){ if (m.goal.fix !== "ra" && m.goal.fix !== "rb"){ eng.act(G, id, {a: "fix", v: m.goal.fix}, api); api.push(); m.goal = null; } else if (s.sab && s.sab.type === "reactor" && (m.holdT = (m.holdT || 0) + 1) < 400){ m.wait = .5; eng.act(G, id, {a: "hold", v: m.goal.fix}, api); api.push(); } else { m.goal = null; m.holdT = 0; } } out.push([id, Math.round(p.x), Math.round(p.y), p.f || 1, alive ? 0 : 1, 0, m.goal && m.goal.task === "sc" ? 1 : 0]); PG.onMv({id, x: p.x, y: p.y, f: p.f || 1, g: alive ? 0 : 1, m: 0, sc: m.goal && m.goal.task === "sc" ? 1 : 0}); return; }
        if (!m.path.length){
          if (m.goal && m.goal.ev != null && s.ev){ m.wait = 1; }
          else if (m.goal && m.goal.task){ m.wait = 5 + Math.random() * 5; }
          else if (m.goal && m.goal.fix && s.sab){ m.wait = 2.5; }
          else if (m.goal && m.goal.walk){ m.goal = null; m.wait = .4 + Math.random() * 2.2; if (Math.random() < .5) p.f = -(p.f || 1); }
          else { m.goal = null; const left = s.tasks[id].filter(t => !s.done[id][t]); const tk = TASKS.find(t => t.id === (imp ? PG.pick(s.tasks[id]) : left[0]));
            if (tk && Math.random() < (imp ? .6 : .55)){ m.goal = {task: imp ? null : tk.id}; m.path = route(p, {x: tk.x + (Math.random() * 30 - 15), y: tk.y + 40}); }
            else { const r = PG.pick(ROOMS); m.path = route(p, {x: r.x + 40 + Math.random() * (r.w - 80), y: r.y + 50 + Math.random() * (r.h - 90)}); m.goal = {walk: 1}; } }
        }
        const w = m.path[0]; if (w){ const dx = w.x - p.x, dy = w.y - p.y, d = Math.hypot(dx, dy), sp = SPEED * (+G.opts.spd || 1) * .72 * dt * (alive ? 1 : 1.1);
          if (d <= sp){ p.x = w.x; p.y = w.y; m.path.shift(); } else { p.x += dx / d * sp; p.y += dy / d * sp; if (Math.abs(dx) > 2) p.f = dx < 0 ? -1 : 1; } }
        PG.onMv({id, x: p.x, y: p.y, f: p.f || 1, g: alive ? 0 : 1, m: w ? 1 : 0});
        out.push([id, Math.round(p.x), Math.round(p.y), p.f || 1, alive ? 0 : 1, w ? 1 : 0]);
      });
      if (out.length && now() - (this.sent || 0) > 180){ this.sent = now(); PNet.raw({t: "mvb", l: out}); }
    }};

  /* ---------------- the host's game ---------------- */
  PG.online.natposter = {min: 4, max: 15, note: ["Like the space classic: crew does tasks, the Natposter kills in secret. Everyone walks around on their own phone.", "Wie der Weltraum-Klassiker: Die Crew löst Aufgaben, der Natposter tötet heimlich. Jeder läuft auf seinem eigenen Handy herum."],
    opts: [{k: "role", solo: true, l: ["Your role", "Deine Rolle"], d: "rnd", c: [["rnd", ["Random", "Zufall"]], ["crew", "Crew"], ["imp", "Natposter"]]},
      {k: "bots", solo: true, l: ["Bots", "Bots"], d: 5, c: [[3, "3"], [5, "5"], [7, "7"]]},
      {k: "fill", online: true, l: ["Fill up with bots", "Mit Bots auffüllen"], d: 0, c: [[0, ["No", "Nein"]], [2, "+2"], [4, "+4"], [6, "+6"]]},
      {k: "imps", l: ["Natposters", "Natposter"], d: "auto", c: [["auto", "Auto"], [1, "1"], [2, "2"], [3, "3"]]},
      {k: "cd", l: ["Kill cooldown", "Kill-Abklingzeit"], d: 25, c: [[15, "15 s"], [25, "25 s"], [35, "35 s"]]},
      {k: "tasks", l: ["Tasks each", "Aufgaben pro Person"], d: 5, c: [[3, "3"], [5, "5"], [7, "7"]]},
      {k: "meet", l: ["Meeting time", "Meeting-Zeit"], d: 60, c: [[45, "45 s"], [60, "60 s"], [90, "90 s"]]},
      {k: "spd", l: ["Speed", "Tempo"], d: 1, c: [[.8, ["Slow", "Langsam"]], [1, ["Normal", "Normal"]], [1.25, ["Fast", "Schnell"]]]},
      {k: "vis", l: ["Crew vision", "Sicht der Crew"], d: 1, c: [[.75, ["Small", "Klein"]], [1, ["Normal", "Normal"]], [1.4, ["Wide", "Weit"]]]},
      {k: "duel", l: ["Minigame at emergency meetings (winner votes twice)", "Minispiel im Notfall-Meeting (Gewinner hat 2 Stimmen)"], d: 1, c: [[1, ["Yes", "Ja"]], [0, ["No", "Nein"]]]},
      {k: "conf", l: ["Reveal ejected role", "Rolle beim Rauswurf zeigen"], d: 1, c: [[1, ["Yes", "Ja"]], [0, ["No", "Nein"]]]}],
    extra(o, solo){ return solo ? +o.bots || 0 : +o.fill || 0; },
    start(G){
      BOT.stop(); G.ids = G.ids.filter(x => !/^bot-/.test(x));
      const bots = (typeof BOTS !== "undefined" ? PG.shuffle(BOTS.slice(0, 20)) : []).slice(0, G.solo ? +G.opts.bots || 0 : +G.opts.fill || 0).map((b, i) => ({id: "bot-" + i, name: b.name, av: (() => { try { return botCfg(b); } catch(e) { return null; } })()}));
      bots.forEach(b => G.ids.push(b.id));
      const n = G.ids.length, o = G.opts, k = o.imps === "auto" ? (n <= 6 ? 1 : n <= 10 ? 2 : 3) : Math.min(+o.imps, Math.max(1, Math.floor((n - 1) / 2)));
      const imps = PG.shuffle(G.ids).slice(0, k), host = G.host;
      /* practice: play the side you want */
      if (G.solo && o.role === "imp" && !imps.includes(host)) imps[0] = host;
      if (G.solo && o.role === "crew" && imps.includes(host)){ const pool = G.ids.filter(x => x !== host && !imps.includes(x)); imps[imps.indexOf(host)] = PG.pick(pool); }
      const s = G.s = {bots, phase: "play", round: ((G.s && G.s.round) || 0) + 1, imps, alive: {}, tasks: {}, done: {}, bodies: [], killAt: {}, emer: {}, sab: null, sabAt: now() + 15000, mc: 0, spawnK: 1, log: [], gid: Math.random().toString(36).slice(2, 8), ev: null, evAt: now() + 50000 + Math.random() * 30000};
      G.ids.forEach((id, i) => { s.alive[id] = true; s.done[id] = {}; s.emer[id] = 1; s.killAt[id] = now() + 5000 + Math.max(15000, o.cd * 700);
        s.tasks[id] = PG.shuffle(TASKS.map(t => t.id)).slice(0, o.tasks); const sp = spawnAt(i, n); POS[id] = Object.assign(POS[id] || {}, sp, {g: false, v: false}); });
      s.spawn = Object.fromEntries(G.ids.map((id, i) => [id, spawnAt(i, n)]));
      s.intro = now() + 3500; s.snd = {k: "s" + (++G.sk), n: "reveal"};
    },
    crewIds(G){ return G.ids.filter(id => !G.s.imps.includes(id)); },
    prog(G){ const s = G.s, c = this.crewIds(G); let tot = 0, d = 0; c.forEach(id => { tot += s.tasks[id].length; d += s.tasks[id].filter(t => s.done[id][t]).length; }); return {tot, d}; },
    win(G){ const s = G.s; if (s.phase === "end") return true;
      const A = G.ids.filter(id => s.alive[id]), I = A.filter(id => s.imps.includes(id)).length, C = A.length - I, p = this.prog(G);
      let w = null; if (I === 0) w = "crew"; else if (p.tot && p.d >= p.tot) w = "tasks"; else if (I >= C) w = "imp";
      if (!w) return false; s.phase = "end"; s.win = w; s.sab = null; G.sk++; s.snd = {k: "s" + G.sk, n: w === "imp" ? "lose" : "cheer"}; return true; },
    meeting(G, by, body){ const s = G.s; s.ev = null; s.evAt = Math.max(s.evAt || 0, now() + 60000); s.phase = "meet"; s.mc++; s.meet = {by, body, until: now() + G.opts.meet * 1000, votes: {}, start: now()};
      if (!body && +(G.opts.duel == null ? 1 : G.opts.duel) !== 0){ const g = PG.pick(Object.keys(DUELS)), mg = s.meet.mg = {g, seed: Math.floor(Math.random() * 1e9), t0: now() + 1800, sc: {}, at: {}}; mg.end = mg.t0 + SPIN + DUELS[g].d; s.meet.until += 1800 + SPIN + DUELS[g].d + RES;
        if (g === "song") songPick().then(q => { if (s.meet && s.meet.mg === mg && mg.g === "song"){ mg.song = q; PNet.refresh(); } }).catch(() => {}); } if (s.sab && s.sab.type === "lights") {} G.sk++; s.snd = {k: "s" + G.sk, n: "meet"}; },
    tally(G){ const s = G.s, c = {}; const W = s.meet.mg && s.meet.mg.win; Object.entries(s.meet.votes).forEach(([who, v]) => { c[v] = (c[v] || 0) + (who === W ? 2 : 1); });
      const top = Object.entries(c).filter(([k]) => k !== "skip").sort((a, b) => b[1] - a[1]); const skip = c.skip || 0;
      const out = top.length && top[0][1] > skip && !(top[1] && top[1][1] === top[0][1]) ? top[0][0] : null;
      s.lastVotes = Object.assign({}, s.meet.votes); s.eject = {id: out, imp: out ? s.imps.includes(out) : false, start: now(), until: now() + 7600, left: out ? s.imps.filter(x => s.alive[x] && x !== out).length : s.imps.filter(x => s.alive[x]).length};
      if (out) s.alive[out] = false; s.phase = "eject"; s.meet = null; G.sk++; s.snd = {k: "s" + G.sk, n: "eject"}; },
    resume(G){ const s = G.s; s.bodies = []; s.spawnK++; const A = G.ids; s.spawn = Object.fromEntries(A.map((id, i) => [id, spawnAt(i, A.length)])); A.forEach(id => { Object.assign(POS[id] || (POS[id] = {}), s.spawn[id]); s.killAt[id] = now() + G.opts.cd * 1000; });
      if (s.sab && CRIT[s.sab.type]) s.sab = null; s.doors = {}; s.sabAt = Math.max(s.sabAt, now() + 10000); s.phase = "play"; if (!this.win(G)) {} },
    tick(G, api){ const s = G.s; let ch = false; if (s.bots && s.bots.length && s.phase !== "end") BOT.run(G, api); if (s.phase === "end") BOT.stop();
      if (s.phase === "play" && s.sab && CRIT[s.sab.type] && now() >= s.sab.until){ s.phase = "end"; s.win = s.sab.type === "o2" ? "o2" : "boom"; s.sab = null; G.sk++; s.snd = {k: "s" + G.sk, n: "lose"}; ch = true; }
      if (s.phase === "meet" && s.meet.mg && !s.meet.mg.done){ const mg = s.meet.mg;
        if (mg.g === "song" && !mg.song && now() > mg.t0 + SPIN - 300){ s.meet.until -= DUELS.song.d - DUELS.tap.d; mg.g = "tap"; mg.end = mg.t0 + SPIN + DUELS.tap.d; ch = true; }
        if (now() >= mg.end + 700){ (s.bots || []).forEach(b => { if (s.alive[b.id] && mg.sc[b.id] == null){ mg.sc[b.id] = botScore(mg.g); mg.at[b.id] = now(); } });
          const A = G.ids.filter(x => s.alive[x] && mg.sc[x] != null).sort((a, b) => mg.sc[b] - mg.sc[a] || (mg.at[a] || 0) - (mg.at[b] || 0)); mg.win = A[0] && mg.sc[A[0]] > -9000 ? A[0] : null; mg.done = now(); G.sk++; s.snd = {k: "s" + G.sk, n: "mgwin"}; ch = true; } }
      if (s.phase === "meet" && (now() >= s.meet.until || G.ids.filter(id => s.alive[id]).every(id => s.meet.votes[id]))){ this.tally(G); ch = true; }
      if (s.phase === "eject" && now() >= s.eject.until){ s.eject = null; this.resume(G); this.win(G); ch = true; }
      if (s.doors) for (const k in s.doors) if (s.doors[k] <= now()){ delete s.doors[k]; ch = true; }
      /* crew events */
      if (s.phase === "play" && now() > s.intro){ const A = G.ids.filter(x => s.alive[x] && POS[x] && !POS[x].v && !POS[x].g);
        if (!s.ev && !s.sab && now() >= (s.evAt || 0) && A.length >= 3){ const e = PG.pick(EVS), n = A.length >= 6 ? 3 : 2; s.ev = {id: e.id, room: e.room, de: e.de, en: e.en, pads: padsOf(e, n), until: now() + 40000, hold: 0, occ: []}; G.sk++; s.snd = {k: "s" + G.sk, n: "evstart"}; ch = true; }
        else if (s.ev){ const E = s.ev, occ = E.pads.map(pd => A.find(x => dist(POS[x], pd) < 52) || null), full = occ.every(Boolean) && new Set(occ).size === occ.length; E.occ = occ.map(Boolean);
          if (full){ E.hold = E.hold || now(); if (now() - E.hold >= 3000){ occ.forEach(x => { if (s.imps.includes(x)) return; const t = s.tasks[x].find(t2 => !s.done[x][t2]); if (t) s.done[x][t] = 1; });
            s.evRes = {ok: 1, k: ++G.sk, by: occ}; s.ev = null; s.evAt = now() + 80000 + Math.random() * 40000; s.snd = {k: "s" + G.sk, n: "evok"}; this.win(G); } } else E.hold = 0;
          if (s.ev && now() >= E.until){ s.ev = null; s.evAt = now() + 70000 + Math.random() * 40000; s.evRes = {ok: 0, k: ++G.sk}; }
          ch = true; } }
      return ch || s.phase === "meet" || s.phase === "eject" || (s.phase === "play" && (!!s.sab || now() < s.intro || (s.doors && Object.keys(s.doors).length > 0))); },
    act(G, id, a, api){ const s = G.s, me = POS[id] || {x: 0, y: 0}, alive = s.alive[id], imp = s.imps.includes(id);
      if (a.a === "again" && id === G.host && s.phase === "end"){ this.start(G); return; }
      if (s.phase === "meet" && a.a === "say" && alive && typeof a.v === "string" && a.v.length < 40){ const M = s.meet, [pk, x0] = a.v.split("|"), x = x0 || ""; if (!SAY[pk]) return;
        M.chat = M.chat || []; M.cnt = M.cnt || {}; M.last = M.last || {}; if ((M.cnt[id] || 0) >= 14 || now() - (M.last[id] || 0) < 1100) return;
        const ok = pk === "emo" ? /^[0-9]$/.test(x) && +x < EMO.length : (pk === "where" || pk === "body") ? (x === "hall" || ROOMS.some(r => r.id === x)) : (pk === "sus" || pk === "with" || pk === "vent") ? G.ids.includes(x) && x !== id : x === "";
        if (!ok) return; M.chat.push([id, pk, x]); if (M.chat.length > 40) M.chat.shift(); M.cnt[id] = (M.cnt[id] || 0) + 1; M.last[id] = now(); return; }
      if (s.phase === "meet" && a.a === "mgs" && alive && s.meet.mg && !s.meet.mg.done && s.meet.mg.sc[id] == null && typeof a.v === "number" && isFinite(a.v)){ s.meet.mg.sc[id] = Math.max(-1e6, Math.min(1e6, a.v)); s.meet.mg.at[id] = now(); return; }
      if (s.phase === "meet" && a.a === "vote" && s.meet.mg && !s.meet.mg.done) return;
      if (s.phase === "meet" && a.a === "vote" && alive && !s.meet.votes[id] && (a.v === "skip" || s.alive[a.v])){ s.meet.votes[id] = a.v; return; }
      if (s.phase !== "play" || now() < s.intro) return;
      if (a.a === "kill" && imp && alive && now() >= s.killAt[id] && !me.v){ const t = a.v, tp = POS[t];
        if (!t || !s.alive[t] || s.imps.includes(t) || !tp || dist(me, tp) > KILL_R * 1.35) return;
        const kv = PG.pick(KILLS), dbl = s.log.some(l => now() - l[0] < 4000 && l[1] !== id);
        s.alive[t] = false; s.bodies.push({id: t, x: Math.round(tp.x), y: Math.round(tp.y), k: kv}); s.killAt[id] = now() + G.opts.cd * 1000; s.log.push([now(), id, t]);
        s.killed = s.killed || {}; s.killed[t] = {by: id, k: ++G.sk, v: kv}; s.ps = s.ps || {}; s.ps[id] = {k: "p" + (++G.sk), n: "kill"}; s.ps[t] = {k: "p" + (++G.sk), n: "died"};
        if (dbl){ s.dbl = {k: ++G.sk}; s.imps.forEach(x => { if (x !== t) s.ps[x] = {k: "p" + (++G.sk), n: "double"}; }); }
        this.win(G); return; }
      if (a.a === "report" && alive){ const b = s.bodies.find(x => x.id === a.v); if (!b || dist(me, b) > REPORT_R * 1.35) return; this.meeting(G, id, a.v); return; }
      if (a.a === "button" && alive && s.emer[id] > 0 && dist(me, BTN) < USE_R * 1.8 && !(s.sab && CRIT[s.sab.type])){ s.emer[id]--; this.meeting(G, id, null); return; }
      if (a.a === "task" && !imp && s.tasks[id].includes(a.v) && !s.done[id][a.v]){ s.done[id][a.v] = 1; this.win(G); return; }
      if (a.a === "sab" && imp && !s.sab && now() >= s.sabAt && SABS.includes(a.v)){ s.sab = {type: a.v, until: CRIT[a.v] ? now() + (a.v === "o2" ? 40000 : 45000) : 0}; s.sabAt = now() + 35000; G.sk++; s.snd = {k: "s" + G.sk, n: a.v === "lights" ? "dark" : a.v === "comms" ? "static" : "alarm"}; return; }
      if (a.a === "door" && imp && now() >= (s.doorAt || 0) && ROOMS.some(r => r.id === a.v)){ s.doors = s.doors || {}; s.doors[a.v] = now() + 10000; s.doorAt = now() + 22000; G.sk++; s.snd = {k: "s" + G.sk, n: "door"}; return; }
      if (a.a === "hold" && s.sab && s.sab.type === "reactor" && (a.v === "ra" || a.v === "rb") && dist(me, FIX[a.v]) < USE_R * 1.6){ s.sab.h = s.sab.h || {}; s.sab.h[a.v] = {id, until: now() + 1400};
        const A = s.sab.h.ra, B = s.sab.h.rb, two = G.ids.filter(x => s.alive[x]).length >= 5;
        if (!two){ s.sab[a.v] = 1; } else if (A && B && A.until > now() && B.until > now() && A.id !== B.id){ s.sab.ra = s.sab.rb = 1; }
        if (s.sab.ra && s.sab.rb){ s.sab = null; G.sk++; s.snd = {k: "s" + G.sk, n: "fixed"}; } return; }
      if (a.a === "fix" && alive && s.sab && FIX[a.v] && FIX[a.v].s === s.sab.type && a.v !== "ra" && a.v !== "rb" && dist(me, FIX[a.v]) < USE_R * 1.8){
        if (s.sab.type === "o2"){ s.sab[a.v] = 1; if (s.sab.oa && s.sab.ob){ s.sab = null; G.sk++; s.snd = {k: "s" + G.sk, n: "fixed"}; } return; }
        s.sab = null; G.sk++; s.snd = {k: "s" + G.sk, n: "light"}; return; }
      if (a.a === "fix" && s.sab){
        if (s.sab.type === "reactor" && (a.v === "ra" || a.v === "rb")){ s.sab[a.v] = 1; if (s.sab.ra && s.sab.rb){ s.sab = null; G.sk++; s.snd = {k: "s" + G.sk, n: "fixed"}; } } return; }
    },
    view(G, id, api){ const s = G.s, imp = s.imps.includes(id), p = this.prog(G);
      return {gid: s.gid, nImp: s.imps.length, custom: "np", k: "np" + s.round, phase: s.phase, round: s.round, alive: !!s.alive[id], imp, mates: imp ? s.imps : [], tasks: imp ? [] : s.tasks[id].map(t => [t, !!s.done[id][t]]),
        fake: imp ? s.tasks[id] : [], prog: p.tot ? p.d / p.tot : 0, bodies: s.bodies, kill: imp ? Math.max(0, s.killAt[id] - now()) : 0, emer: s.emer[id], intro: Math.max(0, s.intro - now()),
        sab: s.sab ? {type: s.sab.type, left: s.sab.until ? Math.max(0, s.sab.until - now()) : 0, ra: s.sab.ra, rb: s.sab.rb, oa: s.sab.oa, ob: s.sab.ob} : null, spd: +G.opts.spd || 1, vis: +G.opts.vis || 1, sabCd: imp ? Math.max(0, s.sabAt - now()) : 0,
        meet: s.meet ? {mg: s.meet.mg ? {g: s.meet.mg.g, seed: s.meet.mg.seed, el: now() - s.meet.mg.t0, d: DUELS[s.meet.mg.g].d, done: !!s.meet.mg.done, win: s.meet.mg.win || null, sc: s.meet.mg.sc, song: s.meet.mg.song || null} : null, chat: s.meet.chat || [], by: s.meet.by, body: s.meet.body, left: Math.max(0, s.meet.until - now()), voted: Object.keys(s.meet.votes), my: s.meet.votes[id] || null} : null,
        eject: s.eject ? {id: s.eject.id, imp: s.eject.imp, conf: !!G.opts.conf, left: s.eject.left, votes: s.lastVotes, shown: now() - s.eject.start, tot: s.eject.until - s.eject.start} : null, meetTot: G.opts.meet * 1000,
        ev: s.ev ? {id: s.ev.id, room: s.ev.room, de: s.ev.de, en: s.ev.en, pads: s.ev.pads, occ: s.ev.occ, left: Math.max(0, s.ev.until - now()), hold: s.ev.hold ? now() - s.ev.hold : 0} : null, evRes: s.evRes || null, dbl: imp && s.dbl ? s.dbl : null,
        doors: s.doors ? Object.fromEntries(Object.entries(s.doors).filter(([k, t]) => t > now()).map(([k, t]) => [k, t - now()])) : {}, doorCd: imp ? Math.max(0, (s.doorAt || 0) - now()) : 0,
        held: s.sab && s.sab.h ? {ra: !!(s.sab.h.ra && s.sab.h.ra.until > now()), rb: !!(s.sab.h.rb && s.sab.h.rb.until > now())} : null, two: G.ids.filter(x => s.alive[x]).length >= 5,
        bots: s.bots || [], deadList: G.ids.filter(x => !s.alive[x]), killedBy: s.killed && s.killed[id] ? s.killed[id] : null,
        win: s.phase === "end" ? s.win : null, imps: s.phase === "end" ? s.imps : null, spawn: s.spawn && s.spawn[id] ? Object.assign({k: s.spawnK}, s.spawn[id]) : null, host: id === G.host,
        snd: (() => { const a = s.snd, b = s.ps && s.ps[id]; return !a ? b : !b ? a : (+String(a.k).slice(1) > +String(b.k).slice(1) ? a : b); })()};
    }};

  /* ---------------- this phone: the screen, the joystick, the buttons ---------------- */
  const IMG = {}; const img = (key, src) => { if (IMG[key]) return IMG[key]; const i = new Image(); i.src = src; IMG[key] = i; return i; };
  const avImg = (pid, av) => { const k = "av:" + pid + ":" + (av ? JSON.stringify(av).length : 0); if (IMG[k]) return IMG[k];
    let svg = ""; try { svg = avatarSVG(Object.assign({}, av || {}, {aura: "none", pet: "none"}), {fit: true}); } catch(e) {}
    svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ').replace('width="100%" height="100%"', 'width="200" height="256"');
    return img(k, "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)); };
  const pieceImg = cls => { if (IMG[cls]) return IMG[cls]; const e = document.createElement("i"); e.className = "pc " + cls; e.style.cssText = "position:absolute;left:-99px"; document.body.appendChild(e); const u = (getComputedStyle(e).backgroundImage.match(/url\("?(.*?)"?\)$/) || [])[1]; e.remove(); return img(cls, u || ""); };
  const STARS = Array.from({length: 260}, () => [Math.random() * (W + 800) - 400, Math.random() * (H + 800) - 400, Math.random() * 1.6 + .3, Math.random()]);

  /* landscape: the game is always played sideways; on a phone held upright the whole screen is turned */
  const LOC = e => NP.rot ? {x: e.clientY, y: innerWidth - e.clientX} : {x: e.clientX, y: e.clientY};
  const REL = (e, el) => { const p = LOC(e); let x = 0, y = 0, n = el; while (n && n !== NP.el){ x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return {x: p.x - x, y: p.y - y}; };
  const NP = {dust: [], el: null, v: null, m: null, act: null, raf: 0, me: {x: BTN.x, y: BTN.y + 150, f: 1}, joy: null, keys: {}, sent: 0, lastSend: {}, mini: null, vent: null, spawnK: 0, shown: {}, sndK: null, lastStep: 0, zoom: 1, mapOpen: false,
    draw(body, v, m, act){
      if (v.phase === "lobby" && this.v && this.v.phase !== "lobby") this.lobbyIn = 0;
      if (v.gid && v.gid !== this.gid){ this.gid = v.gid; this.shown = {}; this.deathT = {}; this.evShow = null; this.dblT = 0; }
      this.v = v; this.m = m; this.act = act; const t = now();
      if (v.phase === "lobby" && !this.lobbyIn){ this.lobbyIn = 1; this.me.x = BTN.x - 160 + Math.random() * 320; this.me.y = BTN.y + 140 + Math.random() * 40; this.vent = null; this.closeMini(); this.send(true); }
      this.ends = {kill: t + (v.kill || 0), meet: v.meet ? t + v.meet.left : 0, sab: v.sab && v.sab.left ? t + v.sab.left : 0, sabCd: t + (v.sabCd || 0)};
      CLOSED = Object.keys(v.doors || {}).flatMap(k => DOORS[k] || []); this.ends.doorCd = t + (v.doorCd || 0); if (v.eject) this.ejectT = t - (v.eject.shown || 0);
      if (v.round !== this.introRound){ this.introRound = v.round; this.introEnd = t + (v.intro || 0); }
      if (!this.el || !this.el.isConnected) this.mount();
      if (v.spawn && v.spawn.k !== this.spawnK){ this.spawnK = v.spawn.k; this.me.x = v.spawn.x; this.me.y = v.spawn.y; this.vent = null; this.closeMini(); this.send(true); }
      if (v.snd && v.snd.k !== this.sndK){ this.sndK = v.snd.k; this.sound(v.snd.n); }
      this.hud();
    },
    full(){ if (PG.st.npNoFull) return; const d = document.documentElement; try { if (document.fullscreenElement || document.webkitFullscreenElement) return;
        const go = d.requestFullscreen ? d.requestFullscreen({navigationUI: "hide"}) : d.webkitRequestFullscreen ? d.webkitRequestFullscreen() : null;
        if (go && go.then) go.then(() => { try { screen.orientation && screen.orientation.lock && screen.orientation.lock("landscape").catch(() => {}); } catch(e) {} }).catch(() => {}); } catch(e) {} },
    /* only when the page really reaches under the status bar may the game be as tall as the screen */
    sat(){ try { const d = document.createElement("div"); d.style.cssText = "position:fixed;top:0;left:0;width:1px;height:env(safe-area-inset-top,0px);height:max(env(safe-area-inset-top,0px),env(safe-area-inset-left,0px),env(safe-area-inset-right,0px));visibility:hidden"; document.body.appendChild(d); const h = d.offsetHeight; d.remove(); return h; } catch(e) { return 0; } },
    unfull(){ try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen(); } catch(e) {} },
    stop(){ cancelAnimationFrame(this.raf); this.raf = 0; if (this.el){ this.el.remove(); this.unfull(); } this.el = null; this.fullTried = 0; if (this.pop) window.removeEventListener("popstate", this.pop, true); document.documentElement.classList.remove("np-on"); window.removeEventListener("keydown", this.kd); window.removeEventListener("keyup", this.ku); window.removeEventListener("resize", this.rs); },
    /* synth sounds, all through the app's sound engine (respects the sound switch) */
    sfx: {
      ac(){ return Sound.fx && Sound.fx() ? Sound.ac : null; },
      noise(t, dur, f0, f1, gain, type = "bandpass", q = 1){ const ac = this.ac(); if (!ac) return; const n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), t0 = ac.currentTime + t; s.buffer = b; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
        g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(.08, dur / 3)); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur); s.connect(f); f.connect(g); g.connect(ac.destination); s.start(t0); },
      tone(t, f0, f1, dur, gain, type = "sine"){ const ac = this.ac(); if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + t; o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
        g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + .02); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur); o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + .05); },
      chord(t, notes, dur, gain, type){ notes.forEach(m => this.tone(t, 440 * Math.pow(2, (m - 69) / 12), 440 * Math.pow(2, (m - 69) / 12), dur, gain, type)); }
    },
    roleSound(imp){ const x = this.sfx; Haptic.go(imp ? [40, 60, 160] : [30, 50, 30]);
      x.noise(0, .7, 5200, 2800, .14, "bandpass", .7); /* psst */
      if (imp){ x.tone(.85, 70, 40, 2.4, .22, "sawtooth"); x.chord(.85, [45, 48, 51], 2.2, .06, "triangle"); x.noise(.85, 1.6, 300, 60, .08, "lowpass"); x.chord(1.6, [57, 60, 63], 1.6, .045, "sine"); }
      else { x.chord(.85, [60, 64, 67], 1.6, .06, "triangle"); x.chord(1.15, [67, 72, 76], 1.6, .05, "sine"); x.noise(.85, 1, 2000, 6000, .03, "highpass"); } },
    sound(n){ const x = this.sfx;
      if (n === "kill"){ this.killFx = now(); x.noise(0, .12, 6000, 2000, .25, "highpass"); x.noise(.05, .35, 900, 120, .3, "lowpass"); x.tone(.05, 160, 50, .4, .3); Haptic.go([60, 40, 120]); this.flash(); }
      else if (n === "died"){ const kv = (this.v && this.v.killedBy && this.v.killedBy.v) || "stab", hit = (t, f = 900) => { x.noise(t, .12, 6000, 2000, .22, "highpass"); x.noise(t + .03, .45, f, 80, .32, "lowpass"); setTimeout(() => { Haptic.go(90); this.flash(); }, t * 1000); };
        x.noise(0, .5, 300, 80, .12, "lowpass"); x.tone(0, 90, 50, .6, .12, "sine");
        if (kv === "stab") [0, 1, 2, 3, 4].forEach(i => hit(.6 + i * .28, 700));
        else if (kv === "head"){ x.noise(.55, .25, 9000, 4000, .25, "highpass"); hit(.6, 1200); x.noise(.8, 1.2, 1500, 300, .12, "bandpass", .5); }
        else if (kv === "chess"){ x.noise(.7, .45, 2500, 400, .08, "bandpass"); x.tone(1.12, 70, 28, .9, .5, "sine"); hit(1.12, 400); }
        else if (kv === "shot"){ x.noise(1, .08, 8000, 3000, .5, "highpass"); x.noise(1, .6, 2000, 60, .45, "lowpass"); x.tone(1, 160, 40, .4, .3, "square"); setTimeout(() => { Haptic.go([120]); this.flash(); }, 1000); }
        else if (kv === "bite"){ x.tone(.3, 60, 120, 1.2, .1, "sawtooth"); hit(1.5, 500); x.noise(1.6, .3, 600, 100, .3, "lowpass"); }
        x.chord(2.3, [38, 41, 44], 2, .07, "sawtooth"); this.slash = now(); }
      else if (n === "double"){ this.dblT = now(); x.noise(0, .12, 6000, 2000, .25, "highpass"); x.noise(.05, .35, 900, 120, .3, "lowpass"); x.tone(.05, 160, 50, .4, .3); x.chord(.35, [45, 48, 52], 1.2, .06, "sawtooth"); x.chord(.55, [57, 60, 64], 1, .05, "square"); Haptic.go([60, 40, 60, 40, 160]); this.flash(); }
      else if (n === "mgwin"){ x.chord(0, [60, 64, 67], .25, .07, "square"); x.chord(.22, [64, 67, 72], .25, .07, "square"); x.chord(.44, [67, 72, 76], .9, .08, "triangle"); Haptic.go([30, 40, 30, 40, 90]); }
      else if (n === "evstart"){ x.chord(0, [67, 71, 74], .5, .06, "triangle"); x.chord(.25, [69, 73, 76], .6, .06, "triangle"); Haptic.go([30, 40, 30]); }
      else if (n === "evok"){ PG.cheer(2); x.chord(0, [64, 68, 71, 76], 1.2, .06, "triangle"); Haptic.go([20, 30, 20, 30, 60]); }
      else if (n === "meet"){ this.banner = {t: now()}; [0, .45, .9, 1.35].forEach(t => { x.tone(t, 880, 660, .4, .12, "square"); }); Haptic.go([80, 60, 80, 60, 80]); }
      else if (n === "eject"){ x.noise(0, 2.2, 800, 90, .14, "lowpass", .6); x.tone(.2, 300, 60, 2, .05, "sine"); }
      else if (n === "alarm"){ [0, .5, 1, 1.5].forEach(t => x.tone(t, 760, 760, .3, .1, "square")); Haptic.go([100, 100, 100, 100, 100]); }
      else if (n === "dark"){ x.tone(0, 220, 55, .7, .2, "sawtooth"); x.noise(0, .6, 1200, 80, .1, "lowpass"); Haptic.go(60); }
      else if (n === "static"){ x.noise(0, 1.1, 3000, 800, .12, "bandpass", .4); x.tone(.1, 1200, 300, .5, .04, "square"); Haptic.go([30, 30, 30]); }
      else if (n === "door"){ x.noise(0, .25, 400, 120, .25, "lowpass"); x.tone(.02, 90, 60, .25, .2, "square"); Haptic.go(40); }
      else if (n === "light" || n === "fixed"){ x.chord(0, [72, 76, 79], .6, .07, "triangle"); }
      else if (n === "cheer"){ PG.cheer(4); x.chord(0, [60, 64, 67, 72], 1.8, .06, "triangle"); } else if (n === "lose"){ x.chord(0, [48, 51, 55], 2.2, .07, "sawtooth"); x.tone(0, 110, 40, 2, .15); }
      else if (n === "reveal"){ this.roleSound(this.v && this.v.imp); }
      else if (n === "task"){ Sound.xp ? Sound.xp() : Sound.right(); } },
    mount(){
      this.stop(); const el = this.el = document.createElement("div"); el.className = "np"; el.setAttribute("data-notr", "");
      el.innerHTML = `<canvas class="np-cv"></canvas><div class="np-top"><button class="np-menu np-quit" data-x="quit">🚪</button><div class="np-bar"><i></i><span>${T("TASKS", "AUFGABEN")}</span></div><button class="np-mapb" data-x="map">${icon("map", 20)}<span>${T("Map", "Karte")}</span></button></div>
        <div class="np-tasks"></div><div class="np-alert"></div><div class="np-ev"></div><div class="np-lob"></div><div class="np-tbar"><i></i><span></span></div><div class="np-joy"><i></i></div><div class="np-btns"></div><div class="np-ov"></div><div class="np-mini"></div>`;
      document.body.appendChild(el); document.documentElement.classList.add("np-on"); this.full();
      this.pop = e => { if (!this.el || document.querySelector(".dsheet:not(.out)")) return; e.stopImmediatePropagation(); try { history.pushState({r: App.route}, "", "#" + App.route); } catch(_) {} toast(T("To leave: ☰ → Leave", "Zum Verlassen: ☰ → Verlassen")); };

      el.addEventListener("pointerdown", () => { if (!this.fullTried){ this.fullTried = 1; this.full(); }
        if (!this.audio){ try { const a = this.audio = new Audio(); a.setAttribute("playsinline", ""); a.preload = "auto"; a.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="; a.play().then(() => a.pause()).catch(() => {}); } catch(e) {} } }, true);
      el.querySelector(".np-ov").addEventListener("click", e => { if (this.mapOpen && !e.target.closest(".np-map")){ this.mapOpen = false; this.hud(); } });
      el.querySelector(".np-mini").addEventListener("click", e => { if (e.target.classList.contains("np-mini") && this.mini && this.mini.light){ Sound.tap(); this.closeMini(); } });
      this.cv = el.querySelector("canvas"); this.ctx = this.cv.getContext("2d");
      this.rs = () => { const d = Math.min(2, window.devicePixelRatio || 1), up = innerHeight > innerWidth, sat = this.sat(), big = navigator.standalone && sat > 0, IH = Math.max(innerHeight, big && up ? screen.height : 0), IW = Math.max(innerWidth, big && !up ? screen.height : 0), rot = PG.st.npPortrait ? false : up, w = rot ? IH : IW, h = rot ? IW : IH; this.rot = rot; el.classList.toggle("rot", rot); el.classList.toggle("land", w > h); el.style.setProperty("--h", h + "px"); el.style.width = w + "px"; el.style.height = h + "px"; this.cv.width = w * d; this.cv.height = h * d; this.dpr = d; this.zoom = Math.max(.5, Math.min(1.2, Math.min(w, h) / 560)); };
      this.rs(); window.addEventListener("resize", this.rs);
      /* joystick: touch anywhere on the left part of the screen */
      const joy = el.querySelector(".np-joy"), knob = joy.querySelector("i");
      const startJ = (x, y, pid) => { this.joy = {x0: x, y0: y, dx: 0, dy: 0, pid}; joy.style.left = x + "px"; joy.style.top = y + "px"; joy.classList.add("on"); knob.style.transform = "translate(-50%,-50%)"; };
      const moveJ = (x, y) => { const j = this.joy; if (!j) return; let dx = x - j.x0, dy = y - j.y0; const d = Math.hypot(dx, dy), m = 56; if (d > m){ dx *= m / d; dy *= m / d; } j.dx = dx / m; j.dy = dy / m; knob.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`; };
      const endJ = () => { this.joy = null; joy.classList.remove("on"); };
      this.cv.addEventListener("pointerdown", e => { if (this.mini || this.v && this.v.phase !== "play" && this.v.phase !== "lobby") return; e.preventDefault(); const l = LOC(e); startJ(l.x, l.y, e.pointerId); try { this.cv.setPointerCapture(e.pointerId); } catch(_) {} });
      this.cv.addEventListener("pointermove", e => { if (this.joy && e.pointerId === this.joy.pid){ const l = LOC(e); moveJ(l.x, l.y); } });
      ["pointerup", "pointercancel"].forEach(t => this.cv.addEventListener(t, e => { if (this.joy && e.pointerId === this.joy.pid) endJ(); }));
      this.kd = e => { if (/^(Arrow|Key[WASD])/.test(e.code)){ this.keys[e.code] = 1; e.preventDefault(); } if (e.code === "KeyE" || e.code === "Space") { const b = this.el && this.el.querySelector(".np-act.main"); if (b) b.click(); } if (e.code === "KeyQ"){ const b = this.el && this.el.querySelector('[data-x="kill"]'); if (b) b.click(); } };
      this.ku = e => { delete this.keys[e.code]; };
      window.addEventListener("keydown", this.kd); window.addEventListener("keyup", this.ku);
      const FAST = ".np-btns,.np-top,.np-lob";
      el.addEventListener("pointerdown", e => { const b = e.target.closest("[data-x]"); if (!b || b.disabled || !b.closest(FAST)) return; e.preventDefault(); b._pd = now(); b.classList.add("pr"); setTimeout(() => b.classList.remove("pr"), 140); Sound.tap(); this.lastBtn = b; this.click(b.dataset.x, b.dataset.v); });
      el.addEventListener("click", e => { const b = e.target.closest("[data-x]"); if (!b || b.disabled) return; if (b.closest(FAST) && now() - (b._pd || 0) < 800) return; Sound.tap(); this.lastBtn = b; this.click(b.dataset.x, b.dataset.v); });
      let last = performance.now(); const loop = t => { const dt = Math.min(.05, (t - last) / 1000); last = t; try { this.step(dt); this.render(); } catch(err) { console.error(err); } this.raf = requestAnimationFrame(loop); };
      this.raf = requestAnimationFrame(loop);
    },
    ghost(){ return this.v && !this.v.alive; },
    flash(){ if (!this.el) return; this.el.classList.remove("flash"); void this.el.offsetWidth; this.el.classList.add("flash"); },
    pl(){ return ((this.m && this.m.players) || []).concat((this.v && this.v.bots) || []); },
    nm(id){ const p = this.pl().find(x => x.id === id); return p ? p.name : "?"; },
    left(k){ return Math.max(0, ((this.ends || {})[k] || 0) - now()); },
    intro(){ return now() < (this.introEnd || 0); },
    near(x, y, r){ return dist(this.me, {x, y}) <= r; },
    onPad(pd){ return this.pl().some(p => { const q = p.id === PNet.me ? this.me : POS[p.id]; if (!q || q.g || q.v || (this.v.deadList || []).includes(p.id)) return false; return dist({x: q.dx != null ? q.dx : q.x, y: q.dy != null ? q.dy : q.y}, pd) < 52; }); },
    step(dt){
      const v = this.v; if (!v) return;
      let ix = 0, iy = 0;
      if ((v.phase === "play" || v.phase === "lobby") && !this.mini && !this.vent && !this.intro()){
        if (this.joy){ ix = this.joy.dx; iy = this.joy.dy; }
        const k = this.keys; if (k.ArrowLeft || k.KeyA) ix -= 1; if (k.ArrowRight || k.KeyD) ix += 1; if (k.ArrowUp || k.KeyW) iy -= 1; if (k.ArrowDown || k.KeyS) iy += 1;
        const m = Math.hypot(ix, iy); if (m > 1){ ix /= m; iy /= m; }
      }
      const moving = Math.abs(ix) + Math.abs(iy) > .05, me = this.me;
      if (moving){ const sp = SPEED * (v.spd || 1) * (this.ghost() ? 1.15 : 1) * dt, nx = me.x + ix * sp, ny = me.y + iy * sp;
        if (this.ghost()){ me.x = Math.max(20, Math.min(W - 20, nx)); me.y = Math.max(20, Math.min(H - 20, ny)); }
        else { if (walk(nx, me.y)) me.x = nx; if (walk(me.x, ny)) me.y = ny; }
        if (Math.abs(ix) > .1) me.f = ix < 0 ? -1 : 1;
        if (!this.ghost() && now() - this.lastStep > 300){ this.lastStep = now(); this.step2 = !this.step2; if (Sound.fx && Sound.fx()){ const ac = Sound.ac, t0 = ac.currentTime, n = Math.floor(ac.sampleRate * .045), bf = ac.createBuffer(1, n, ac.sampleRate), dd = bf.getChannelData(0); for (let i = 0; i < n; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); const src = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); src.buffer = bf; fl.type = "lowpass"; fl.frequency.value = this.step2 ? 520 : 440; g.gain.value = .05; src.connect(fl); fl.connect(g); g.connect(ac.destination); src.start(t0); } } }
      me.mv = moving; this.send();
      /* smooth everyone else towards where they said they are */
      const rt = now() - 230;
      Object.entries(POS).forEach(([id, p]) => { if (id === PNet.me) return; const b = p.buf;
        if (!b || !b.length){ p.dx = p.x; p.dy = p.y; return; }
        if (rt <= b[0].t){ p.dx = b[0].x; p.dy = b[0].y; return; }
        let i = b.length - 1; while (i > 0 && b[i - 1].t > rt) i--;
        const a = b[i - 1] || b[0], c = b[i];
        if (rt >= c.t){ /* nothing newer yet: keep going a little in the same direction, then stop */ const pr = b[b.length - 2]; const k = pr && c.t - pr.t > 0 ? Math.min(rt - c.t, 150) / (c.t - pr.t) : 0; p.dx = c.x + (pr ? (c.x - pr.x) * k : 0); p.dy = c.y + (pr ? (c.y - pr.y) * k : 0); return; }
        const f = (rt - a.t) / Math.max(1, c.t - a.t); p.dx = a.x + (c.x - a.x) * f; p.dy = a.y + (c.y - a.y) * f;
        p.mv = Math.hypot(c.x - a.x, c.y - a.y) > 2; });
      { const q0 = POS[PNet.me]; if (q0 && !!q0.v !== !!this.vent) q0.vt = now(); }
      POS[PNet.me] = Object.assign(POS[PNet.me] || {}, {x: me.x, y: me.y, dx: me.x, dy: me.y, g: this.ghost(), v: !!this.vent, f: me.f, mv: moving, sc: !!(this.mini && this.mini.g === "scan")});
      if (now() - (this.hudT || 0) > 250){ this.hudT = now(); this.hud(); }
    },
    send(force){ const me = this.me, t = now(), l = this.lastSend, sc = !!(this.mini && this.mini.g === "scan"), ch = Math.abs(me.x - (l.x || 0)) + Math.abs(me.y - (l.y || 0)) > 2 || !!this.vent !== !!l.v || this.ghost() !== !!l.g || sc !== !!l.sc;
      if (force || (ch && t - this.sent > 190) || t - this.sent > 1500){ this.sent = t; this.lastSend = {x: me.x, y: me.y, v: !!this.vent, g: this.ghost(), sc}; PNet.raw({t: "mv", x: Math.round(me.x), y: Math.round(me.y), f: me.f, g: this.ghost() ? 1 : 0, v: this.vent ? 1 : 0, m: me.mv ? 1 : 0, sc: sc ? 1 : 0}); } },
    /* who/what is close enough for the buttons */
    targets(){
      const v = this.v, me = this.me, out = {}; if (!v || v.phase !== "play") return out;
      const players = this.pl().filter(p => p.id !== PNet.me);
      if (v.imp && v.alive && !this.vent){ let best = null; players.forEach(p => { const q = POS[p.id]; if (!q || q.g || q.v || v.mates.includes(p.id) || v.deadList.includes(p.id)) return; const d = dist(me, {x: q.dx, y: q.dy}); if (d <= KILL_R && (!best || d < best.d)) best = {id: p.id, d}; }); out.kill = best; }
      if (v.alive){ const b = v.bodies.find(b => dist(me, b) <= REPORT_R); if (b) out.report = b; }
      if (v.alive && dist(me, BTN) < USE_R * 1.5) out.button = true;
      if (v.imp && v.alive){ const vt = VENTS.find(x => dist(me, x) <= VENT_R); if (vt || this.vent) out.vent = vt || true; }
      if (v.alive) Object.keys(FIX).forEach(k => { if (needFix(v.sab, k) && dist(me, FIX[k]) <= USE_R) out.fix = k; });
      const mine = (v.imp ? v.fake.map(t => [t, false]) : v.tasks).filter(([t, d]) => !d).map(([t]) => TASKS.find(x => x.id === t)).find(t => dist(me, t) <= USE_R);
      if (mine) out.task = mine;
      if (v.alive && dist(me, STA.cams) <= USE_R) out.cams = true; if (dist(me, STA.admin) <= USE_R) out.admin = true; if (dist(me, STA.vitals) <= USE_R) out.vitals = true;
      return out;
    },
    click(x, val){
      const v = this.v, t = this.targets();
      if (x === "menu") return this.menu();
      if (x === "quit" || x === "leave"){ const b = this.lastBtn && this.lastBtn.isConnected ? this.lastBtn : this.el.querySelector(".np-quit"); if (b._orig == null) b._orig = b.innerHTML; this.quitN = (now() - (this.quitT || 0) < 2500 ? this.quitN || 0 : 0) + 1; this.quitT = now(); Haptic.go(20);
        if (this.quitN >= 3){ this.quitN = 0; b.innerHTML = "👋"; setTimeout(() => { PNet.leave(); App.go("games"); }, 380); return; }
        b.classList.add("arm"); b.innerHTML = x === "leave" ? `🚪<span>${T(`${3 - this.quitN}× more`, `Noch ${3 - this.quitN}×`)}</span>` : `🚪<small>${3 - this.quitN}×</small>`; toast(T(`Tap ${3 - this.quitN} more time${3 - this.quitN > 1 ? "s" : ""} to leave`, `Noch ${3 - this.quitN}× tippen zum Verlassen`), 1600);
        clearTimeout(this.quitTm); this.quitTm = setTimeout(() => { this.quitN = 0; if (b.isConnected){ b.classList.remove("arm"); b.innerHTML = b._orig; } b._orig = null; }, 2500); return; }
      if (x === "map") { this.mapOpen = !this.mapOpen; this.hud(); return; }
      if (x === "kill" && t.kill && this.left("kill") <= 0) return this.act({a: "kill", v: t.kill.id});
      if (x === "report" && t.report) return this.act({a: "report", v: t.report.id});
      if (x === "use"){
        if (t.fix === "ra" || t.fix === "rb") return this.openMini("reactor", () => {}, {de: "Reaktor stabilisieren", en: "Stabilise reactor", key: t.fix});
        if (t.fix) return this.openMini(FIX[t.fix].g, () => this.act({a: "fix", v: t.fix}), {en: t.fix === "comms" ? "Restore comms" : t.fix === "lights" ? "Fix lights" : "Enter O2 code", de: t.fix === "comms" ? "Funk wiederherstellen" : t.fix === "lights" ? "Licht reparieren" : "O₂-Code eingeben"});
        if (t.task) return this.openMini(t.task.g, () => { if (!v.imp){ this.act({a: "task", v: t.task.id}); this.sound("task"); } }, t.task);
        if (t.cams) return this.openCams();
        if (t.admin) return this.openAdmin();
        if (t.vitals) return this.openVitals();
        if (t.button && v.emer > 0) return this.act({a: "button"});
        if (t.button) return toast(T("You've used your emergency meeting.", "Du hast dein Notfall-Meeting schon benutzt."));
      }
      if (x === "vent"){ if (this.vent){ this.vent = null; this.send(true); Sound.play("Move", .7); } else if (t.vent && t.vent.id){ this.vent = t.vent.id; this.me.x = t.vent.x; this.me.y = t.vent.y; this.send(true); Sound.play("Capture", .5); } this.hud(); return; }
      if (x === "vgo"){ const vt = VENTS.find(q => q.id === val); if (vt){ this.vent = vt.id; this.me.x = vt.x; this.me.y = vt.y; this.send(true); Sound.play("Move", .5); this.hud(); } return; }
      if (x === "sab"){ this.mapOpen = false; return this.act({a: "sab", v: val}); }
      if (x === "door"){ this.mapOpen = false; return this.act({a: "door", v: val}); }
      if (x === "vote") return this.act({a: "vote", v: val});
      if (x === "qc"){ this.qcMode = val || null; this.overlay(); return; }
      if (x === "say"){ this.qcMode = null; Haptic.go(8); this.act({a: "say", v: val}); this.overlay(); return; }
      if (x === "again") return this.act({a: "again"});
      if (["start", "settings", "invite", "look"].includes(x)) return this.act({a: x});
      if (x === "lobby") return this.act({a: "lobby"});
    },
    menu(){
      const v = this.v; const sh = detailSheet(`<h3 style="margin:0 0 8px">Natposter</h3><p class="muted" style="margin:0 0 12px">${T("Move with the stick on the left (or WASD). Use = E, Kill = Q.", "Laufen mit dem Stick links (oder WASD). Benutzen = E, Töten = Q.")}</p>
        ${v.host ? `<button class="btn" data-m="lobby" style="width:100%;margin-bottom:8px">${T("End game · back to the lobby", "Spiel beenden · zurück zur Lobby")}</button>` : ""}
        <button class="btn" data-m="rot" style="width:100%;margin-bottom:8px">${PG.st.npPortrait ? T("Play sideways", "Querformat") : T("Play upright", "Hochformat")}</button>
        <button class="btn" data-m="full" style="width:100%;margin-bottom:8px">${PG.st.npNoFull ? T("Full screen: off", "Vollbild: aus") : T("Full screen: on", "Vollbild: an")}</button>
        <button class="btn" data-m="leave" style="width:100%">${T("Leave", "Verlassen")}</button>`);
      sh.el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { sh.close(); if (b.dataset.m === "rot"){ PG.st.npPortrait = !PG.st.npPortrait; PG.persist(); this.rs(); return; }
        if (b.dataset.m === "full"){ PG.st.npNoFull = !PG.st.npNoFull; PG.persist(); if (PG.st.npNoFull) this.unfull(); else this.full(); return; }
        if (b.dataset.m === "lobby") this.sure(T("End the round for everyone?", "Runde für alle beenden?"), () => this.act({a: "lobby"}));
        else this.sure(T("Really leave?", "Wirklich verlassen?"), () => { PNet.leave(); App.go("games"); }); });
    },
    /* nobody leaves by accident: hold the button for a second */
    sure(title, fn){
      const sh = detailSheet(`<h3 style="margin:0 0 6px">${title}</h3><p class="muted" style="margin:0 0 12px">${T("Hold the red button to confirm.", "Zum Bestätigen den roten Knopf gedrückt halten.")}</p>
        <button class="btn big np-hold"><i></i><span>${T("Hold", "Gedrückt halten")}</span></button><button class="btn ghost" data-no style="width:100%;margin-top:8px">${T("Stay", "Bleiben")}</button>`);
      const b = sh.el.querySelector(".np-hold"), bar = b.querySelector("i"); let t = null;
      const go = e => { e.preventDefault(); b.classList.add("on"); Haptic.go(10); t = setTimeout(() => { Haptic.go([30, 30, 60]); sh.close(); fn(); }, 1100); };
      const up = () => { b.classList.remove("on"); clearTimeout(t); };
      b.addEventListener("pointerdown", go); ["pointerup", "pointerleave", "pointercancel"].forEach(k => b.addEventListener(k, up));
      sh.el.querySelector("[data-no]").onclick = () => sh.close();
    },
    /* ---- HUD: task bar, task list, buttons, overlays ---- */
    hud(){
      const v = this.v, el = this.el; if (!v || !el) return;
      el.classList.toggle("mapon", !!this.mapOpen && v.phase === "play");
      el.classList.toggle("ghost", !v.alive); el.classList.toggle("imp", v.imp); el.classList.toggle("lob", v.phase === "lobby");
      const lb = el.querySelector(".np-lob"), lbH = v.phase === "lobby" ? `<div class="np-lobc"><b>${esc(v.lob.code.toUpperCase())}</b><span>${v.lob.n}${v.lob.fill ? ` + ${v.lob.fill} 🤖` : ""} / 15</span></div>
        <button class="np-lb" data-x="invite">📨<span>${T("Invite", "Einladen")}</span></button><button class="np-lb" data-x="look">👕<span>${T("Look", "Aussehen")}</span></button><button class="np-lb" data-x="settings">⚙️<span>${T("Settings", "Einstellungen")}</span></button><button class="np-lb" data-x="leave">🚪<span>${T("Leave", "Verlassen")}</span></button>
        ${v.host ? `<button class="np-lb go" data-x="start" ${v.lob.n + (v.lob.fill || 0) < v.lob.min ? "disabled" : ""}>▶<span>${v.lob.n + (v.lob.fill || 0) < v.lob.min ? T(`${v.lob.min} needed`, `${v.lob.min} nötig`) : T("Start", "Start")}</span></button>` : `<span class="np-wait">${T("Waiting for the host…", "Warte auf den Gastgeber…")}</span>`}` : "";
      if (lb._h !== lbH && !(this.quitN && now() - (this.quitT || 0) < 2500)){ lb._h = lbH; lb.innerHTML = lbH; }
      const mb = el.querySelector(".np-mapb"), mbH = v.imp ? `<b>⚡</b><span>${this.left("sabCd") > 0 && !v.sab ? Math.ceil(this.left("sabCd") / 1000) + " s" : T("Sabotage", "Sabotage")}</span>` : `${icon("map", 20)}<span>${T("Map", "Karte")}</span>`; if (mb._h !== mbH){ mb._h = mbH; mb.innerHTML = mbH; mb.classList.toggle("imp", v.imp); }
      /* how long until something happens: a bar at the top */
      { const tb = el.querySelector(".np-tbar"); let f = -1, lab = "";
        if (v.phase === "play" && this.intro()){ const l = this.introEnd - now(); f = l / 3500; lab = T("Get ready", "Gleich geht's los"); }
        else if (v.phase === "meet"){ const l = this.left("meet"); f = l / (v.meetTot || 90000); lab = ""; }
        else if (v.phase === "eject" && v.eject){ const l = Math.max(0, (v.eject.tot || 7600) - (now() - (this.ejectT || now()))); f = l / (v.eject.tot || 7600); lab = T(`Back to the station in ${Math.ceil(l / 1000)} s`, `Zurück zur Station in ${Math.ceil(l / 1000)} s`); }
        tb.classList.toggle("on", f >= 0); if (f >= 0){ tb.firstChild.style.width = Math.max(0, Math.min(100, f * 100)) + "%"; if (tb.lastChild.textContent !== lab) tb.lastChild.textContent = lab; tb.lastChild.style.display = lab ? "" : "none"; } }
      /* crew event */
      { const eb = el.querySelector(".np-ev"), E = v.phase === "play" && v.alive ? v.ev : null, R = v.evRes && !this.shown["e" + v.evRes.k] && v.evRes.ok ? v.evRes : null;
        if (R && !this.evShow){ this.evShow = {k: R.k, t: now()}; } const okNow = this.evShow && now() - this.evShow.t < 3500;
        const ebH = E ? `🤝 <b>${esc(T(E.en, E.de))}</b><small>${T(`${E.pads.length} people on the plates · ${RN(ROOMS.find(r => r.id === E.room))}`, `${E.pads.length} Leute auf die Platten · ${RN(ROOMS.find(r => r.id === E.room))}`)} · ${Math.ceil(E.left / 1000)} s ${E.pads.map((pd, i) => this.onPad(pd) ? "🟢" : "⚪").join("")}</small>`
          : okNow ? `🎉 <b>${T("Done together!", "Zusammen geschafft!")}</b><small>${T("Everyone on a plate got a task done", "Jeder auf einer Platte hat eine Aufgabe erledigt")}</small>` : "";
        if (!okNow && this.evShow){ this.shown["e" + this.evShow.k] = 1; this.evShow = null; }
        if (eb._h !== ebH){ eb._h = ebH; eb.innerHTML = ebH; eb.classList.toggle("on", !!ebH); eb.classList.toggle("ok", !E && !!ebH); } }
      el.querySelector(".np-bar i").style.width = (v.sab && v.sab.type === "comms" ? 0 : Math.round(v.prog * 100)) + "%";
      const tl = el.querySelector(".np-tasks"), tasksHtml = v.imp ? `<b class="np-red">${T("Natposter", "Natposter")}</b><small>${T("Kill, vent, sabotage. Don't get caught.", "Töten, Schächte, Sabotage. Nicht erwischen lassen.")}</small>${v.mates.length > 1 ? `<small>${T("Team: ", "Team: ")}${v.mates.filter(x => x !== PNet.me).map(x => esc(this.nm(x))).join(", ")}</small>` : ""}`
        : v.sab && v.sab.type === "comms" ? `<b>📡 ${T("Comms sabotaged", "Funk sabotiert")}</b><small>${T("Your tasks are hidden", "Deine Aufgaben sind versteckt")}</small>` : `${!v.alive ? `<b>👻 ${T("You're a ghost: finish your tasks", "Du bist ein Geist: mach deine Aufgaben")}</b>` : ""}${v.tasks.map(([t, d]) => { const k = TASKS.find(x => x.id === t), r = ROOMS.find(x => x.id === k.room); return `<div class="${d ? "done" : ""}">${esc(RN(r))}: ${esc(T(k.en, k.de))}</div>`; }).join("")}`;
      if (tl._h !== tasksHtml){ tl._h = tasksHtml; tl.innerHTML = tasksHtml; }
      /* alerts: sabotage */
      const al = el.querySelector(".np-alert"), sab = v.sab, alH = sab ? (sab.type === "reactor" ? `☢️ ${T("Reactor meltdown", "Reaktor-Kernschmelze")} <b>${Math.ceil(this.left("sab") / 1000)}</b> <small>${v.two ? T("Two people: hold both panels at once", "Zwei Leute: beide Platten gleichzeitig halten") : T("Hold both panels in the reactor", "Beide Platten im Reaktor halten")} ${sab.ra || (v.held && v.held.ra) ? "✋" : "○"} ${sab.rb || (v.held && v.held.rb) ? "✋" : "○"}</small>` : sab.type === "o2" ? `🫁 ${T("Oxygen depleted", "Sauerstoff leer")} <b>${Math.ceil(this.left("sab") / 1000)}</b> <small>${T("Enter the code in Oxygen and on the Bridge", "Code in Sauerstoff und auf der Brücke eingeben")} ${sab.oa ? "✓" : "○"} ${sab.ob ? "✓" : "○"}</small>`
        : sab.type === "comms" ? `📡 ${T("Comms down! Fix them in Comms", "Funk gestört! Im Funkraum reparieren")}` : `💡 ${T("Lights out! Fix them in Electrical", "Licht aus! In der Elektrik reparieren")}`) : "";
      if (al._h !== alH){ al._h = alH; al.innerHTML = alH; al.classList.toggle("on", !!alH); }
      if (sab && CRIT[sab.type] && Math.ceil(this.left("sab") / 1000) !== this.lastAlarm){ this.lastAlarm = Math.ceil(this.left("sab") / 1000); if (this.lastAlarm % 2 === 0 && Sound.fx && Sound.fx()) Sound.note(81, 0, .2, .07, "pluck"); if (this.lastAlarm <= 10) Haptic.go(30); }
      /* action buttons */
      const t = this.targets(), bt = el.querySelector(".np-btns"), B = [];
      if (v.phase === "play"){
        if (this.vent){ const vt = VENTS.find(q => q.id === this.vent); vt.to.forEach(o => B.push(`<button class="np-act" data-x="vgo" data-v="${o}">➜<span>${esc(RN(roomAt(VENTS.find(q => q.id === o).x, VENTS.find(q => q.id === o).y)))}</span></button>`)); B.push(`<button class="np-act main on" data-x="vent">⬆<span>${T("Out", "Raus")}</span></button>`); }
        else {
          if (v.imp && v.alive) B.push(`<button class="np-act kill ${t.kill && this.left("kill") <= 0 ? "on" : ""}" data-x="kill" ${t.kill && this.left("kill") <= 0 ? "" : "disabled"}>🔪<span>${this.left("kill") > 0 ? Math.ceil(this.left("kill") / 1000) : T("Kill", "Töten")}</span></button>`);
          if (v.imp && v.alive) B.push(`<button class="np-act ${t.vent ? "on" : ""}" data-x="vent" ${t.vent ? "" : "disabled"}>🕳️<span>${T("Vent", "Schacht")}</span></button>`);
          if (v.alive) B.push(`<button class="np-act rep ${t.report ? "on" : ""}" data-x="report" ${t.report ? "" : "disabled"}>📣<span>${T("Report", "Melden")}</span></button>`);
          if (!(v.imp && !v.alive)){ const use = t.fix || t.task || t.cams || t.admin || t.vitals || t.button, ic = t.fix || t.task ? ["✋", T("Use", "Benutzen")] : t.cams ? ["📹", T("Cameras", "Kameras")] : t.admin ? ["🗺️", T("Admin", "Lageplan")] : t.vitals ? ["💓", T("Vitals", "Vitalwerte")] : t.button ? ["🚨", T("Meeting", "Meeting")] : ["✋", T("Use", "Benutzen")]; B.push(`<button class="np-act main ${use ? "on" : ""}" data-x="use" ${use ? "" : "disabled"}>${ic[0]}<span>${ic[1]}</span></button>`); }
        }
      }
      const bh = B.join(""); if (bt._h !== bh){ bt._h = bh; bt.innerHTML = bh; }
      this.overlay();
    },
    overlay(){
      const v = this.v, ov = this.el.querySelector(".np-ov"), P = this.pl(), nm = id => esc(this.nm(id)), HC = this.hc || (this.hc = {}), head = id => { const p = P.find(x => x.id === id), k = id + (p && p.av ? JSON.stringify(p.av).length : 0); if (HC[k]) return HC[k]; try { return HC[k] = avatarSVG(Object.assign({}, p && p.av || {}, {aura: "none", pet: "none"}), {head: true, size: 54}); } catch(e) { return ""; } };
      let h = "";
      if (v.phase === "play" && this.intro()){ const line = v.imp ? v.mates : this.pl().map(p => p.id);
        h = `<div class="np-role ${v.imp ? "imp" : ""}"><div class="np-k">${T("You are", "Du bist")}</div><div class="np-rbig">${v.imp ? "Natposter" : "Crew"}</div><div class="np-lineup">${line.map(id => `<span class="${id === PNet.me ? "me" : ""}"><span class="np-hd">${head(id)}</span><b>${nm(id)}</b></span>`).join("")}</div><p>${v.imp ? T("Kill the crew. Don't get caught.", "Töte die Crew. Lass dich nicht erwischen.") : T(`There ${v.nImp > 1 ? "are" : "is"} ${v.nImp || 1} Natposter${v.nImp > 1 ? "s" : ""} among you.`, `Unter euch ${v.nImp > 1 ? "sind" : "ist"} ${v.nImp || 1} Natposter.`)}</p></div>`; }
      if (v.phase === "play" && v.dbl && now() - (this.dblT || 0) < 1800) h = `<div class="np-dbl">${T("DOUBLE KILL", "DOPPELKILL")}</div>`;
      if (v.phase === "play" && v.killedBy && !this.shown["k" + v.killedBy.k] && (this.deathT = this.deathT || {}) && (this.deathT[v.killedBy.k] = this.deathT[v.killedBy.k] || now()) && now() - this.deathT[v.killedBy.k] < 3200) h = this.deathHTML(v.killedBy);
      else if (v.phase === "play" && v.killedBy && !this.shown["k" + v.killedBy.k]){ h = `<div class="np-killed"><div class="np-kface">${head(v.killedBy.by)}</div><i class="np-slash"></i><i class="np-splat"></i><i class="np-drips">${[8, 19, 33, 47, 58, 71, 86].map((x, i) => `<b style="left:${x}%;--d:${.6 + (i % 3) * .25}s;--h:${30 + (i * 37) % 55}%;width:${6 + (i * 5) % 9}px"></b>`).join("")}</i><div class="np-big">${T("You were killed", "Du wurdest getötet")}</div><p>${T(`by ${nm(v.killedBy.by)}. You're a ghost now: finish your tasks.`, `von ${nm(v.killedBy.by)}. Du bist jetzt ein Geist: Mach deine Aufgaben fertig.`)}</p><button class="btn go" data-x="seen" data-v="k${v.killedBy.k}">OK</button></div>`; }
      if (v.phase === "meet" && this.banner && now() - this.banner.t < 1700){ h = `<div class="np-banner ${v.meet.body ? "body" : ""}"><div>${v.meet.body ? "💀" : "🚨"}</div><b>${v.meet.body ? T("Dead body reported", "Leiche gefunden") : T("Emergency meeting", "Notfall-Meeting")}</b><span>${v.meet.body ? T(`${nm(v.meet.by)} found ${nm(v.meet.body)}`, `${nm(v.meet.by)} hat ${nm(v.meet.body)} gefunden`) : T(`called by ${nm(v.meet.by)}`, `einberufen von ${nm(v.meet.by)}`)}</span></div>`; }
      else if (v.phase === "meet" && v.meet.mg && (!v.meet.mg.done || !this.duelDone || this.duelDone.s !== v.meet.mg.seed || now() - this.duelDone.t < RES)){ h = `<div class="np-duel" data-k="${v.meet.mg.seed}"></div>`; }
      else if (v.phase === "meet"){ const m = v.meet, canVote = v.alive && !m.my, W = m.mg && m.mg.win;
        h = `<div class="np-meet np-mt"><div class="np-ml"><div class="np-mh"><div><div class="np-k">${m.body ? "💀 " + T("Body reported", "Leiche gemeldet") : "🚨 " + T("Emergency meeting", "Notfall-Meeting")}</div><div class="np-big" style="font-size:20px;margin:2px 0 0">${m.body ? T(`${nm(m.by)} found ${nm(m.body)}`, `${nm(m.by)} hat ${nm(m.body)} gefunden`) : T(`called by ${nm(m.by)}`, `einberufen von ${nm(m.by)}`)}</div></div><div class="np-tm" data-cd="meet"></div></div>
          <div class="np-vgrid">${P.map(p => { const dead = v.deadList.includes(p.id); return `<button class="np-vote ${m.my === p.id ? "sel" : ""} ${dead ? "dead" : ""} ${W === p.id ? "crown" : ""}" data-x="vote" data-v="${esc(p.id)}" ${!canVote || dead ? "disabled" : ""}><span class="np-hd">${head(p.id)}</span><b>${esc(p.name)}</b>${W === p.id ? `<em class="np-crown">👑 ×2</em>` : ""}${m.voted.includes(p.id) ? `<i>✓</i>` : ""}${dead ? `<i>✝</i>` : ""}</button>`; }).join("")}</div>
          <div class="np-mfoot"><button class="btn ${m.my === "skip" ? "go" : ""}" data-x="vote" data-v="skip" ${canVote ? "" : "disabled"}>${T("Skip vote", "Überspringen")}</button><span class="muted">${!v.alive ? T("Ghosts don't vote.", "Geister stimmen nicht ab.") : m.my ? T("Voted. Talk it out!", "Abgestimmt. Redet drüber!") : T("Talk, then vote.", "Redet, dann stimmt ab.")}</span></div></div>
          <div class="np-chat"><div class="np-log">${(m.chat || []).map(([id, pk, x], i) => `<div class="np-cm ${id === PNet.me ? "me" : ""} ${i >= (this.chatSeen || 0) ? "new" : ""}"><span class="np-hd sm">${head(id)}</span><div><b>${nm(id)}</b><span>${this.sayText(pk, x)}</span></div></div>`).join("") || `<p class="muted np-c0">${T("Say something…", "Sag was…")}</p>`}</div>${v.alive ? this.qcHTML(m) : ""}</div></div>`; }
      if (v.phase === "eject" && now() - (this.ejectT || 0) < 2800){ const e = v.eject, by = {}; Object.entries(e.votes || {}).forEach(([a, b]) => { (by[b] = by[b] || []).push(a); });
        const row = (id, label, dead) => `<div class="np-vr ${e.id === id ? "out" : ""} ${dead ? "dead" : ""}">${id !== "skip" ? `<span class="np-hd">${head(id)}</span>` : `<span class="np-hd np-skip">⏭</span>`}<b>${label}</b><span class="np-vh">${(by[id] || []).map(x => `<span class="np-hd sm">${head(x)}</span>`).join("")}</span></div>`;
        h = `<div class="np-meet"><div class="np-k">${T("Votes", "Abstimmung")}</div><div class="np-vgrid">${P.map(p => row(p.id, esc(p.name), v.deadList.includes(p.id) && p.id !== e.id)).join("")}</div>${row("skip", T("Skipped", "Übersprungen"))}</div>`; }
      else if (v.phase === "eject"){ const e = v.eject, n0 = e.id ? this.nm(e.id) : "";
        const txt = e.id ? (e.conf ? (e.imp ? T(`${n0} was a Natposter.`, `${n0} war ein Natposter.`) : T(`${n0} was not a Natposter.`, `${n0} war kein Natposter.`)) : T(`${n0} was ejected.`, `${n0} wurde rausgeworfen.`)) : T("Nobody was ejected.", "Niemand wurde rausgeworfen.");
        h = `<div class="np-eject ${e.id ? "" : "none"}"><i class="np-stars"></i><i class="np-stars b"></i>${e.id ? `<div class="np-ejfig">${this.fig(e.id)}</div>` : `<div class="np-ejship">🛸</div>`}
          <div class="np-type" style="--n:${txt.length}">${esc(txt)}</div>${e.conf ? `<p class="np-left">${T(`${e.left} Natposter${e.left === 1 ? "" : "s"} left.`, `Noch ${e.left} Natposter übrig.`)}</p>` : ""}</div>`; }
      if (v.phase === "end"){ const crew = v.win !== "imp" && v.win !== "boom" && v.win !== "o2", mine = crew !== v.imp;
        h = `<div class="np-card ${crew ? "" : "imp"}"><div class="np-k">${mine ? T("Victory", "Sieg") : T("Defeat", "Niederlage")}</div><div class="np-big">${crew ? (v.win === "tasks" ? T("Crew wins: all tasks done", "Crew gewinnt: alle Aufgaben erledigt") : T("Crew wins", "Die Crew gewinnt")) : v.win === "boom" ? T("Reactor exploded. Natposter wins", "Reaktor explodiert. Natposter gewinnt") : v.win === "o2" ? T("Out of oxygen. Natposter wins", "Kein Sauerstoff mehr. Natposter gewinnt") : T("Natposter wins", "Natposter gewinnt")}</div>
          <div class="np-faces">${v.imps.map(id => `<span><span class="np-hd">${head(id)}</span><b>${nm(id)}</b></span>`).join("")}</div><p>${T(v.imps.length > 1 ? "were the Natposters" : "was the Natposter", v.imps.length > 1 ? "waren die Natposter" : "war der Natposter")}</p>
          ${v.host ? `<button class="btn go big" data-x="again">${T("Play again", "Nochmal")}</button><button class="btn ghost" data-x="lobby" style="margin-top:6px">${T("Lobby", "Lobby")}</button>` : `<p class="muted">${T("Waiting for the host…", "Warte auf den Gastgeber…")}</p>`}</div>`; }
      if (this.mapOpen && v.phase === "play") h = this.mapHTML();
      if (v.killedBy && v.phase !== "play" && v.phase !== "end" && !this.shown["k" + v.killedBy.k] && this.deathT && this.deathT[v.killedBy.k] && now() - this.deathT[v.killedBy.k] < 3200) h = this.deathHTML(v.killedBy);
      const kind = h ? (h.match(/class="np-(\w+)/) || [])[1] + (v.phase || "") : "";
      if (ov._h !== h){ ov.classList.toggle("still", kind === ov._kind); ov._kind = kind; ov._h = h; ov.innerHTML = h; ov.classList.toggle("on", !!h); ov.querySelectorAll('[data-x="seen"]').forEach(b => b.onclick = e => { e.stopPropagation(); this.shown[b.dataset.v.slice(0)] = 1; this.shown[b.dataset.v] = 1; this.overlay(); });
        if (v.phase === "meet" || v.phase === "eject" || v.phase === "end") this.closeMini();
        const lg = ov.querySelector(".np-log"); if (lg) lg.scrollTop = lg.scrollHeight; if (v.phase === "meet" && v.meet) this.chatSeen = (v.meet.chat || []).length; }
      if (v.phase === "meet" && v.meet){ const n = (v.meet.chat || []).length; if (n > (this.chatN || 0) && this.chatN != null){ const last = v.meet.chat[n - 1]; if (last && last[0] !== PNet.me){ this.sfx.tone(0, 1200, 900, .08, .05, "sine"); this.sfx.tone(.06, 1500, 1500, .06, .04, "sine"); } } this.chatN = n;
        const sec = Math.ceil(this.left("meet") / 1000); if (sec <= 5 && sec > 0 && sec !== this.lastTick){ this.lastTick = sec; this.sfx.tone(0, sec === 1 ? 660 : 880, sec === 1 ? 660 : 880, .09, .07, "square"); Haptic.go(sec === 1 ? 40 : 12); } }
      else { this.chatN = null; this.qcMode = null; this.chatSeen = 0; }
      this.duelTick(v, ov);
      ov.querySelectorAll("[data-cd]").forEach(e => { const n = Math.ceil(this.left(e.dataset.cd) / 1000); const t = e.dataset.cd === "meet" ? String(n) : n + " s"; if (e.textContent !== t) e.textContent = t; });
    },
    /* minigame at the meeting: wheel, play, result */
    duelTick(v, ov){
      const mg = v.phase === "meet" && v.meet && v.meet.mg, box = ov.querySelector(".np-duel");
      if (mg && mg.done && (!this.duelDone || this.duelDone.s !== mg.seed)) this.duelDone = {s: mg.seed, t: now()};
      if (!mg || !box){ if (this.du && this.du.stop) this.du.stop(); this.du = null; return; }
      let D = this.du; if (!D || D.seed !== mg.seed || D.box !== box){ if (D && D.stop) D.stop(); D = this.du = {seed: mg.seed, box, t0: now() - mg.el, stage: "", g: mg.g}; }
      const t = now() - D.t0, P = this.pl();
      if (D.g !== mg.g){ D.g = mg.g; if (D.stage === "spin") D.stage = ""; }
      if (mg.done){ if (D.stage !== "res"){ if (D.stop) D.stop(); D.stage = "res"; const rows = P.filter(p => mg.sc[p.id] != null).sort((a, b) => mg.sc[b.id] - mg.sc[a.id]), w = mg.win;
          box.innerHTML = `<div class="du-res"><div class="du-k">${DUELS[mg.g].e} ${esc(T(DUELS[mg.g].en, DUELS[mg.g].de))}</div>${w ? `<div class="du-win"><span class="np-hd">${this.headOf(w)}</span><div><b>👑 ${esc(this.nm(w))}</b><span>${T("wins: 2 votes this meeting", "gewinnt: 2 Stimmen in diesem Meeting")}</span></div></div>` : `<div class="du-win"><b>${T("Nobody won", "Keiner hat gewonnen")}</b></div>`}
            <div class="du-rank">${rows.slice(0, 6).map((p, i) => `<div class="${p.id === PNet.me ? "me" : ""}"><span>${i + 1}.</span><b>${esc(p.name)}</b><em>${this.duelFmt(mg.g, mg.sc[p.id])}</em></div>`).join("")}</div>${mg.g === "song" && mg.song ? `<p class="muted">🎵 ${esc(mg.song.opts[mg.song.a])} · ${esc(mg.song.by)}</p>` : ""}</div>`;
          if (w === PNet.me) PG.cheer(3); }
        return; }
      if (t < SPIN){ if (D.stage !== "spin"){ D.stage = "spin"; const keys = Object.keys(DUELS), seq = []; for (let i = 0; i < 5; i++) keys.forEach(k => seq.push(k)); const idx = keys.length * 4 + keys.indexOf(mg.g);
          box.innerHTML = `<div class="du-spin"><div class="du-k">🎲 ${T("Minigame! The winner votes twice", "Minispiel! Der Gewinner hat 2 Stimmen")}</div><div class="du-win2"><div class="du-strip">${seq.map(k => `<div class="du-tile"><span>${DUELS[k].e}</span><b>${esc(T(DUELS[k].en, DUELS[k].de))}</b></div>`).join("")}</div><i class="du-ptr"></i></div></div>`;
          const strip = box.querySelector(".du-strip"), left = Math.max(300, SPIN - t - 500); requestAnimationFrame(() => { strip.style.transition = `transform ${left}ms cubic-bezier(.12,.75,.2,1)`; strip.style.transform = `translateX(calc(50% - ${idx * 132 + 62}px))`; });
          for (let i = 0, at = 0; at < left; i++){ at += 50 + i * i * 2.2; const a2 = at; setTimeout(() => { if (this.du === D && D.stage === "spin") this.sfx.tone(0, 900, 900, .03, .04, "square"); }, a2); }
          setTimeout(() => { if (this.du === D) { this.sfx.chord(0, [72, 76, 79], .4, .06, "triangle"); Haptic.go(30); } }, left); }
        return; }
      if (D.stage === "spin" || !D.stage){ D.stage = "play"; const R = rng(mg.seed), endAt = D.t0 + SPIN + mg.d;
        const fin = sc => { if (D.sent) return; D.sent = 1; D.my = sc; if (v.alive) PNet.act({a: "mgs", v: sc}); const st = box.querySelector(".du-st"); if (st) st.innerHTML = `${T("Your result", "Dein Ergebnis")}: <b>${this.duelFmt(mg.g, sc)}</b> · ${T("waiting…", "warte…")}`; };
        box.innerHTML = `<div class="du-play"><div class="du-k">${DUELS[mg.g].e} ${esc(T(DUELS[mg.g].en, DUELS[mg.g].de))} <span class="du-tl"></span></div><div class="du-g"></div><div class="du-st muted">${v.alive ? "" : "👻 " + T("You're watching", "Du schaust zu")}</div></div>`;
        const g = box.querySelector(".du-g"); D.stop = v.alive ? (this.DG[mg.g] || this.DG.tap).call(this, g, R, fin, mg) : null;
        D.tick = setInterval(() => { const l = Math.max(0, endAt - now()), tl = box.querySelector(".du-tl"); if (tl) tl.textContent = Math.ceil(l / 1000) + " s"; if (l <= 0){ clearInterval(D.tick); if (D.stop){ const s0 = D.stop; D.stop = null; s0(); } } }, 200);
        const oldStop = D.stop; D.stop = () => { clearInterval(D.tick); oldStop && oldStop(); }; }
    },
    headOf(id){ const p = this.pl().find(x => x.id === id); try { return avatarSVG(Object.assign({}, p && p.av || {}, {aura: "none", pet: "none"}), {head: true, size: 44}); } catch(e) { return ""; } },
    duelFmt(g, sc){ if (sc == null) return "–"; if (sc <= -9000) return T("✗", "✗"); return g === "react" ? Math.round(-sc) + " ms" : g === "tap" ? sc + "×" : g === "snake" ? "🍎 " + Math.floor(sc) : (Math.round(-sc / 100) / 10).toFixed(1) + " s"; },
    DG: {
      react(g, R, fin){ const wait = 900 + R() * 3200; let gT = 0, done = false; g.innerHTML = `<button class="du-react">${T("Wait for green…", "Warte auf Grün…")}</button>`; const b = g.firstChild;
        const tm = setTimeout(() => { if (done) return; gT = now(); b.classList.add("go"); b.textContent = T("TAP!", "JETZT!"); Haptic.go(25); }, wait);
        b.addEventListener("pointerdown", e => { e.preventDefault(); if (done) return; done = true; clearTimeout(tm); if (!gT){ b.classList.add("bad"); b.textContent = T("Too early!", "Zu früh!"); Sound.wrong(); fin(-9999); } else { const ms = now() - gT; b.classList.add("ok"); b.textContent = ms + " ms"; Sound.play("Capture", .5); fin(-ms); } });
        return () => { clearTimeout(tm); if (!done){ done = true; fin(-9000); } }; },
      tap(g, R, fin){ let n = 0, on = true; g.innerHTML = `<button class="du-tap"><b>0</b><span>${T("Tap tap tap!", "Tipp, tipp, tipp!")}</span></button>`; const b = g.firstChild, c = b.querySelector("b");
        b.addEventListener("pointerdown", e => { e.preventDefault(); if (!on) return; n++; c.textContent = n; b.classList.remove("hit"); void b.offsetWidth; b.classList.add("hit"); if (n % 5 === 0) Haptic.go(6); this.sfx.tone(0, 500 + Math.min(n, 40) * 18, 500 + Math.min(n, 40) * 18, .04, .03, "square"); });
        return () => { on = false; fin(n); }; },
      snake(g, R, fin){ const CW = 16, CH = 10; let sn = [[4, 5], [3, 5], [2, 5]], dir = [1, 0], nd = [1, 0], food = null, eaten = 0, dead = false;
        g.innerHTML = `<div class="du-snake"><canvas width="${CW * 20}" height="${CH * 20}"></canvas><div class="du-pad"><button data-d="0,-1">▲</button><button data-d="-1,0">◀</button><button data-d="1,0">▶</button><button data-d="0,1">▼</button></div></div>`;
        const cv = g.querySelector("canvas"), c = cv.getContext("2d"); const place = () => { do { food = [Math.floor(R() * CW), Math.floor(R() * CH)]; } while (sn.some(q => q[0] === food[0] && q[1] === food[1])); }; place();
        const turn = d => { if (d[0] === -dir[0] && d[1] === -dir[1]) return; nd = d; };
        g.querySelectorAll("[data-d]").forEach(b => b.addEventListener("pointerdown", e => { e.preventDefault(); turn(b.dataset.d.split(",").map(Number)); Haptic.go(5); }));
        let sw = null; cv.addEventListener("pointerdown", e => { const l = LOC(e); sw = l; }); cv.addEventListener("pointerup", e => { if (!sw) return; const l = LOC(e), dx = l.x - sw.x, dy = l.y - sw.y; sw = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return; turn(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]); });
        const draw = () => { c.fillStyle = "#0B0C12"; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = "#E2523E"; c.beginPath(); c.arc(food[0] * 20 + 10, food[1] * 20 + 10, 7, 0, 7); c.fill(); sn.forEach((q, i) => { c.fillStyle = dead ? "#8C867C" : i ? "#7FB24A" : "#B6E07E"; c.fillRect(q[0] * 20 + 1, q[1] * 20 + 1, 18, 18); }); };
        const id = setInterval(() => { if (dead) return; dir = nd; const h = [sn[0][0] + dir[0], sn[0][1] + dir[1]];
          if (h[0] < 0 || h[1] < 0 || h[0] >= CW || h[1] >= CH || sn.some(q => q[0] === h[0] && q[1] === h[1])){ dead = true; Sound.wrong(); Haptic.go(60); draw(); fin(eaten); return; }
          sn.unshift(h); if (h[0] === food[0] && h[1] === food[1]){ eaten++; Sound.play("Capture", .4); place(); } else sn.pop(); draw(); }, 150); draw();
        return () => { clearInterval(id); if (!dead) fin(eaten + .5); }; },
      mate(g, R, fin){ const ch = new Chess(MATES[Math.floor(R() * MATES.length)]), t0 = now(); let sel = null, pen = 0, done = false;
        const draw = msg => { const B = ch.board(); g.innerHTML = `<div class="np-cboard du-board">${B.map((row, r) => row.map((p, f) => { const sq = "abcdefgh"[f] + (8 - r); return `<div class="sq ${(r + f) % 2 ? "d" : "l"} ${sel === sq ? "sel" : ""}" data-q="${sq}">${p ? `<i class="np-pc pc ${p.color}${p.type}"></i>` : ""}</div>`; }).join("")).join("")}</div><p class="muted" style="margin:4px 0 0">${msg || T("White mates in one", "Weiß setzt matt in 1")}</p>`;
          g.querySelectorAll("[data-q]").forEach(d => d.addEventListener("pointerdown", e => { e.preventDefault(); if (done) return; const q = d.dataset.q, pc = ch.get(q);
            if (pc && pc.color === "w"){ sel = q; Sound.play("Move", .3); return draw(); } if (!sel) return;
            const mv = ch.move({from: sel, to: q, promotion: "q"}); sel = null; if (!mv) return draw();
            if (ch.in_checkmate ? ch.in_checkmate() : ch.isCheckmate()){ done = true; Sound.play("Mate", .8); draw("✓ " + T("Mate!", "Matt!")); fin(-(now() - t0 + pen)); return; }
            ch.undo(); pen += 2000; Sound.wrong(); draw(T("Not mate: +2 s", "Kein Matt: +2 s")); })); };
        draw(); return () => { if (!done){ done = true; fin(-99999); } }; },
      song(g, R, fin, mg){ let done = false, t0 = 0; const au = this.audio;
        const show = () => { const q = this.v && this.v.meet && this.v.meet.mg && this.v.meet.mg.song; if (!q){ g.innerHTML = `<p class="muted">${T("Loading a song…", "Lade einen Song…")}</p>`; return false; }
          g.innerHTML = `<div class="du-song"><div class="du-eq">${"<i></i>".repeat(5)}</div><div class="du-opts">${q.opts.map((o, i) => `<button data-o="${i}">${esc(o)}</button>`).join("")}</div></div>`; t0 = now();
          try { if (au && /^https:\/\/[a-z0-9.-]+\.(apple|mzstatic)\.com\//.test(q.url)){ au.src = q.url; au.currentTime = 0; au.volume = 1; au.play().catch(() => {}); setTimeout(() => { try { if (au.src === q.url) au.pause(); } catch(e) {} }, 7000); } } catch(e) {}
          g.querySelectorAll("[data-o]").forEach(b => b.addEventListener("pointerdown", e => { e.preventDefault(); if (done) return; done = true; const ok = +b.dataset.o === q.a; b.classList.add(ok ? "ok" : "bad"); if (!ok) g.querySelector(`[data-o="${q.a}"]`).classList.add("ok"); ok ? Sound.play("Capture", .6) : Sound.wrong(); fin(ok ? -(now() - t0) : -99999); try { au.pause(); } catch(e) {} }));
          return true; };
        let id = 0; if (!show()) id = setInterval(() => { if (show()) clearInterval(id); }, 300);
        return () => { clearInterval(id); try { au && au.pause(); } catch(e) {} if (!done){ done = true; fin(-99999); } }; }
    },
    sayText(pk, x){ const n = x && esc(this.nm(x));
      return pk === "emo" ? `<span class="np-cemo">${EMO[+x] || "❓"}</span>` : pk === "where" ? T(`I was ${roomIn(x)}.`, `Ich war ${roomIn(x)}.`) : pk === "body" ? T(`The body was ${roomIn(x)}!`, `Die Leiche lag ${roomIn(x)}!`)
        : pk === "nothing" ? T("I didn't see anything.", "Ich hab nichts gesehen.") : pk === "self" ? T("It wasn't me!", "Ich war's nicht!") : pk === "skip" ? T("Let's skip.", "Lasst uns skippen.")
        : pk === "sus" ? T(`${n} is sus!`, `${n} ist verdächtig!`) : pk === "with" ? T(`I was with ${n}.`, `Ich war mit ${n} zusammen.`) : pk === "vent" ? T(`${n} came out of a vent!`, `${n} kam aus dem Schacht!`) : ""; },
    qcHTML(m){ const md = this.qcMode, P = this.pl().filter(p => p.id !== PNet.me && !(this.v.deadList || []).includes(p.id));
      if (md) return `<div class="np-qc"><button class="np-qb" data-x="qc" data-v="">←</button>${P.map(p => `<button class="np-qb" data-x="say" data-v="${md}|${esc(p.id)}">${esc(p.name)}</button>`).join("")}</div>`;
      const r = roomAt(this.me.x, this.me.y), bd = m.body && (this.v.bodies || []).find(b => b.id === m.body), br = bd && roomAt(bd.x, bd.y);
      return `<div class="np-qc">${EMO.map((e, i) => `<button class="np-qb e" data-x="say" data-v="emo|${i}">${e}</button>`).join("")}
        <button class="np-qb" data-x="say" data-v="where|${r ? r.id : "hall"}">📍 ${r ? esc(RN(r)) : T("Hallway", "Gang")}</button>${bd ? `<button class="np-qb" data-x="say" data-v="body|${br ? br.id : "hall"}">💀 ${br ? esc(RN(br)) : T("Hallway", "Gang")}</button>` : ""}
        <button class="np-qb" data-x="qc" data-v="sus">🤨 ${T("Sus…", "Verdächtig…")}</button><button class="np-qb" data-x="qc" data-v="with">🤝 ${T("With…", "War mit…")}</button><button class="np-qb" data-x="qc" data-v="vent">🕳️ ${T("Vented…", "Schacht…")}</button>
        <button class="np-qb" data-x="say" data-v="self">🙅 ${T("Not me", "Nicht ich")}</button><button class="np-qb" data-x="say" data-v="nothing">🤷 ${T("Saw nothing", "Nichts gesehen")}</button><button class="np-qb" data-x="say" data-v="skip">⏭ ${T("Skip", "Skippen")}</button></div>`; },
    fig(id){ const p = this.pl().find(x => x.id === id), k = "f" + id + (p && p.av ? JSON.stringify(p.av).length : 0), HC = this.hc || (this.hc = {}); if (HC[k]) return HC[k];
      try { return HC[k] = avatarSVG(Object.assign({}, p && p.av || {}, {aura: "none", pet: "none"}), {fit: true}); } catch(e) { return ""; } },
    deathHTML(kb){
      const v = kb.v || "stab", p = this.pl().find(x => x.id === PNet.me); let hd = ""; try { hd = avatarSVG(Object.assign({}, p && p.av || {}, {aura: "none", pet: "none"}), {head: true, size: 80}); } catch(e) {}
      const X = {stab: `<i class="np-knife">🔪</i>`, head: `<i class="np-cut"></i><div class="np-head">${hd}</div><i class="np-fount">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<b style="--x:${(i - 4.5) * 16}px;--y:${-50 - (i % 4) * 28}px;animation-delay:${.65 + i * .07}s"></b>`).join("")}</i>`,
        chess: `<i class="np-queen" style="background-image:url('${pieceImg("bq").src}')"></i>`, shot: `<i class="np-gun">🔫</i><i class="np-muzzle"></i><b class="np-bang">BANG!</b>`, bite: `<b class="np-chomp">CHOMP</b><i class="np-bones">🦴</i><i class="np-bones b">🦴</i>`}[v] || "";
      return `<div class="np-death v-${v}"><div class="np-dk">${this.fig(kb.by)}</div><div class="np-dv">${this.fig(PNet.me)}</div>${X}<i class="np-dfl"></i><i class="np-drips">${[8, 19, 33, 47, 58, 71, 86].map((x, i) => `<b style="left:${x}%;--d:${1 + (i % 3) * .25}s;--h:${30 + (i * 37) % 55}%;width:${6 + (i * 5) % 9}px"></b>`).join("")}</i><div class="np-dname">${esc(this.nm(kb.by))}</div></div>`;
    },
    /* the map: as big as the screen allows, centred; tap next to it to close. The Natposter sabotages and shuts doors right on it. */
    mapHTML(){ const v = this.v, mine = (v.imp || (v.sab && v.sab.type === "comms") ? [] : v.tasks).filter(([t, d]) => !d).map(([t]) => TASKS.find(x => x.id === t));
      const cw = (this.el && this.el.clientWidth) || innerWidth, chh = (this.el && this.el.clientHeight) || innerHeight, sc = Math.min((cw - 44) / W, (chh - 44) / H), mw = Math.round(W * sc), mh = Math.round(H * sc);
      const scd = this.left("sabCd"), dcd = this.left("doorCd"), sabOk = scd <= 0 && !v.sab, doorOk = dcd <= 0;
      const SAB = [["lights", "💡", "ele"], ["comms", "📡", "com"], ["reactor", "☢️", "rea"], ["o2", "🫁", "o2"]];
      const imp = v.imp ? SAB.map(([k, e, rid]) => { const r = ROOMS.find(x => x.id === rid), x = r.x + r.w / 2, y = r.y + r.h / 2 + 50;
          return `<g ${sabOk ? `data-x="sab" data-v="${k}"` : ""} class="np-msab ${sabOk ? "" : "off"}"><circle cx="${x}" cy="${y}" r="62" fill="${sabOk ? "#E2523E" : "#4a4640"}" stroke="#211F1C" stroke-width="8"/><text x="${x}" y="${y + 22}" font-size="62" text-anchor="middle">${e}</text></g>`; }).join("")
        + ROOMS.filter(r => r.id !== "caf").map(r => { const x = r.x + r.w - 50, y = r.y + r.h - 50, shut = v.doors && v.doors[r.id];
          return `<g ${doorOk ? `data-x="door" data-v="${r.id}"` : ""} class="np-mdoor ${doorOk ? "" : "off"}"><rect x="${x - 34}" y="${y - 34}" width="68" height="68" rx="14" fill="${shut ? "#7FB24A" : doorOk ? "#5f5a52" : "#3D3A35"}"/><text x="${x}" y="${y + 18}" font-size="46" text-anchor="middle">🚪</text></g>`; }).join("") : "";
      const cd = v.imp && (scd > 0 || dcd > 0) ? `<div class="np-mcd">${scd > 0 ? `⚡ <span data-cd="sabCd"></span>` : ""} ${dcd > 0 ? `🚪 <span data-cd="doorCd"></span>` : ""}</div>` : "";
      return `<div class="np-map np-mapx"><button class="np-x np-mclose" data-x="map">×</button>${cd}<svg viewBox="0 0 ${W} ${H}" style="width:${mw}px!important;height:${mh}px!important;max-height:none!important;max-width:none!important;margin:0!important">${AREAS.map(a => `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="#3D3A35" stroke="#211F1C" stroke-width="10"/>`).join("")}
        ${ROOMS.map(r => `<text x="${r.x + r.w / 2}" y="${r.y + 70}" fill="#BAB5AC" font-size="44" font-weight="800" text-anchor="middle" font-family="Figtree,sans-serif">${esc(RN(r))}</text>`).join("")}
        ${mine.map(t => `<circle cx="${t.x}" cy="${t.y}" r="26" fill="#E9B64A"/>`).join("")}${Object.keys(FIX).filter(k => needFix(v.sab, k)).map(k => `<circle cx="${FIX[k].x}" cy="${FIX[k].y}" r="34" fill="#E2523E"/>`).join("")}${v.ev ? v.ev.pads.map(pd => `<circle cx="${pd.x}" cy="${pd.y}" r="30" fill="#5AD1E0"/>`).join("") : ""}
        ${imp}<circle cx="${this.me.x}" cy="${this.me.y}" r="34" fill="#8FC458" stroke="#fff" stroke-width="8"/></svg></div>`; },
    /* ---- cameras (Comms) and the admin table (Bridge) ---- */
    openCams(){
      this.closeMini(); const box = this.el.querySelector(".np-mini"), me = {stop: null, light: 1}; this.mini = me; this.joy = null; box.classList.add("on");
      if (this.v.sab && this.v.sab.type === "comms") return this.nosig(box);
      const CAM = ["caf", "sto", "nav", "ele"].map(id => ROOMS.find(r => r.id === id));
      box.innerHTML = `<div class="np-mg np-cams"><div class="np-mgh"><b>📹 ${T("Cameras", "Kameras")}</b><button class="np-x" data-c>×</button></div><div class="np-camg">${CAM.map(r => `<div><canvas width="320" height="200"></canvas><span>● ${esc(RN(r))}</span></div>`).join("")}</div></div>`;
      box.querySelector("[data-c]").onclick = () => { Sound.tap(); this.closeMini(); };
      const cvs = [...box.querySelectorAll("canvas")]; Sound.play("Move", .5);
      const tick = () => { cvs.forEach((cv, i) => { const r = CAM[i], c = cv.getContext("2d"), z = Math.min(cv.width / (r.w + 80), cv.height / (r.h + 80)); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = "#0B0C12"; c.fillRect(0, 0, cv.width, cv.height);
        this.scene(c, z, cv.width / 2 - (r.x + r.w / 2) * z, cv.height / 2 - (r.y + r.h / 2) * z, true); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = "rgba(127,178,74,.06)"; for (let y = 0; y < cv.height; y += 4) c.fillRect(0, y, cv.width, 1); }); };
      tick(); const id = setInterval(tick, 200); me.stop = () => clearInterval(id);
    },
    nosig(box){ box.innerHTML = `<div class="np-mg np-cams"><div class="np-mgh"><b>📡 ${T("No signal", "Kein Signal")}</b><button class="np-x" data-c>×</button></div><div class="np-static"></div><p class="muted">${T("Comms are sabotaged", "Der Funk ist sabotiert")}</p></div>`; box.querySelector("[data-c]").onclick = () => { Sound.tap(); this.closeMini(); }; this.sound("static"); },
    openVitals(){
      this.closeMini(); const box = this.el.querySelector(".np-mini"), me = {stop: null, light: 1}; this.mini = me; this.joy = null; box.classList.add("on");
      if (this.v.sab && this.v.sab.type === "comms") return this.nosig(box);
      const P = this.pl(), draw = () => { const v = this.v; box.querySelector(".np-vit").innerHTML = P.map(p => { const dead = v.deadList.includes(p.id); return `<div class="${dead ? "dead" : ""}"><span class="np-hd">${(() => { try { return avatarSVG(Object.assign({}, p.av || {}, {aura: "none", pet: "none"}), {head: true, size: 44}); } catch(e) { return ""; } })()}</span><b>${esc(p.name)}</b><svg viewBox="0 0 120 30"><path d="${dead ? "M0 15H120" : "M0 15H40L48 4L56 26L62 15H120"}" stroke="${dead ? "#E2523E" : "#8FC458"}" stroke-width="3" fill="none"/></svg><small>${dead ? T("DEAD", "TOT") : "OK"}</small></div>`; }).join(""); };
      box.innerHTML = `<div class="np-mg np-cams"><div class="np-mgh"><b>💓 ${T("Vitals", "Vitalwerte")}</b><button class="np-x" data-c>×</button></div><div class="np-vit"></div></div>`;
      box.querySelector("[data-c]").onclick = () => { Sound.tap(); this.closeMini(); };
      draw(); const id = setInterval(draw, 700); me.stop = () => clearInterval(id); Sound.play("Move", .5);
    },
    openAdmin(){
      this.closeMini(); const box = this.el.querySelector(".np-mini"), me = {stop: null, light: 1}; this.mini = me; this.joy = null; box.classList.add("on");
      if (this.v.sab && this.v.sab.type === "comms") return this.nosig(box);
      const draw = () => { const cnt = {}; this.pl().forEach(p => { const q = p.id === PNet.me ? this.me : POS[p.id]; if (!q || q.g || q.v || (this.v.deadList.includes(p.id) && p.id !== PNet.me)) return; const r = roomAt(q.dx != null ? q.dx : q.x, q.dy != null ? q.dy : q.y); if (r) cnt[r.id] = (cnt[r.id] || 0) + 1; });
        this.v.bodies.forEach(b => { const r = roomAt(b.x, b.y); if (r) cnt[r.id] = (cnt[r.id] || 0) + 1; });
        box.querySelector(".np-adm").innerHTML = `<svg viewBox="0 0 ${W} ${H}">${AREAS.map(a => `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="#3D3A35" stroke="#211F1C" stroke-width="10"/>`).join("")}${ROOMS.map(r => `<text x="${r.x + r.w / 2}" y="${r.y + 46}" fill="#8C867C" font-size="38" font-weight="800" text-anchor="middle" font-family="Figtree,sans-serif">${esc(RN(r))}</text>${Array.from({length: cnt[r.id] || 0}, (_, i) => `<circle cx="${r.x + r.w / 2 - ((cnt[r.id] - 1) * 30) + i * 60}" cy="${r.y + r.h / 2 + 20}" r="24" fill="#F4F2EE"/>`).join("")}`).join("")}</svg>`; };
      box.innerHTML = `<div class="np-mg np-cams"><div class="np-mgh"><b>🗺️ ${T("Admin", "Lageplan")}</b><button class="np-x" data-c>×</button></div><div class="np-adm"></div><p class="muted">${T("Who is in which room right now", "Wer gerade in welchem Raum ist")}</p></div>`;
      box.querySelector("[data-c]").onclick = () => { Sound.tap(); this.closeMini(); };
      draw(); const id = setInterval(draw, 500); me.stop = () => clearInterval(id); Sound.play("Move", .5);
    },
    /* ---- the world ---- */
    render(){
      const v = this.v, c = this.ctx, cv = this.cv; if (!v || !c) return;
      const d = this.dpr, z = this.zoom * d, me = this.me, cw = cv.width, ch = cv.height;
      c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = "#0B0C12"; c.fillRect(0, 0, cw, ch);
      const ox = cw / 2 - me.x * z, oy = ch / 2 - me.y * z;
      /* stars, slower than the station */
      c.fillStyle = "#fff"; STARS.forEach(([x, y, r, a]) => { const sx = (x - me.x * .35) * z * .6 + cw / 2, sy = (y - me.y * .35) * z * .6 + ch / 2; if (sx < -5 || sy < -5 || sx > cw + 5 || sy > ch + 5) return; c.globalAlpha = .25 + a * .6; c.fillRect(sx, sy, r * d, r * d); });
      c.globalAlpha = 1;
      const R0 = this.scene(c, z, ox, oy, false);
      this.after(c, cw, ch, z, R0);
    },
    scene(c, z, ox, oy, cam){
      const v = this.v, me = this.me; c.setTransform(z, 0, 0, z, ox, oy);
      /* hull */
      c.fillStyle = "#211F1C"; AREAS.forEach(a => { c.fillRect(a.x - 14, a.y - 14, a.w + 28, a.h + 28); });
      AREAS.forEach(a => { c.fillStyle = "#33302C"; c.fillRect(a.x, a.y, a.w, a.h); });
      ROOMS.forEach(r => this.floor(c, r));
      HALLS.forEach(a => { c.fillStyle = "#2B2926"; c.fillRect(a.x, a.y, a.w, a.h); c.fillStyle = "rgba(127,178,74,.18)"; if (a.w > a.h) c.fillRect(a.x, a.y + a.h / 2 - 2, a.w, 4); else c.fillRect(a.x + a.w / 2 - 2, a.y, 4, a.h); });
      this.walls(c);
      this.props(c);
      ROOMS.forEach(r => { c.fillStyle = "rgba(244,242,238,.32)"; c.font = "800 22px Figtree,system-ui,sans-serif"; c.textAlign = "left"; c.fillText(RN(r).toUpperCase(), r.x + 14, r.y + 30); });
      /* vents (the Natposter sees them clearly) */
      VENTS.forEach(vt => { c.fillStyle = "#1B1A18"; c.fillRect(vt.x - 26, vt.y - 18, 52, 36); c.strokeStyle = v.imp ? "#8FC458" : "#4a4640"; c.lineWidth = 3; for (let i = -12; i <= 12; i += 8){ c.beginPath(); c.moveTo(vt.x - 20, vt.y + i * .9); c.lineTo(vt.x + 20, vt.y + i * .9); c.stroke(); } });
      /* task stations and fix panels */
      const mine = v.imp ? v.fake : v.tasks.filter(([t, dn]) => !dn).map(([t]) => t), pulse = (Math.sin(now() / 250) + 1) / 2;
      TASKS.forEach(t => { const my = mine.includes(t.id); c.fillStyle = "#1B1A18"; c.fillRect(t.x - 22, t.y - 22, 44, 44); c.fillStyle = my && !v.imp ? `rgba(233,182,74,${.55 + pulse * .45})` : "#4a4640"; c.fillRect(t.x - 14, t.y - 14, 28, 28); });
      Object.entries(FIX).forEach(([k, f]) => { c.fillStyle = "#1B1A18"; c.fillRect(f.x - 20, f.y - 20, 40, 40); c.fillStyle = needFix(v.sab, k) ? `rgba(226,82,62,${.5 + pulse * .5})` : "#3a3631"; c.beginPath(); c.arc(f.x, f.y, needFix(v.sab, k) ? 26 : 12, 0, 7); c.fill(); });
      /* crew event plates */
      if (v.ev && v.phase === "play") v.ev.pads.forEach(pd => { const on = this.onPad(pd); c.fillStyle = on ? "rgba(90,209,224,.55)" : `rgba(90,209,224,${.18 + pulse * .2})`; c.beginPath(); c.ellipse(pd.x, pd.y + 6, 50, 22, 0, 0, 7); c.fill(); c.strokeStyle = "#5AD1E0"; c.lineWidth = 4; c.stroke();
        if (v.ev.hold && on){ c.strokeStyle = "#fff"; c.lineWidth = 6; c.beginPath(); c.ellipse(pd.x, pd.y + 6, 56, 26, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, v.ev.hold / 3000)); c.stroke(); } });
      /* vitals monitor in Medbay */
      { const s2 = STA.vitals; c.fillStyle = "#1B1A18"; c.fillRect(s2.x - 44, s2.y - 28, 88, 56); c.fillStyle = "#0c1a0c"; c.fillRect(s2.x - 38, s2.y - 22, 76, 44); c.strokeStyle = "#8FC458"; c.lineWidth = 3; c.beginPath(); const ph = (now() / 8) % 76; c.moveTo(s2.x - 38, s2.y); c.lineTo(s2.x - 38 + ph * .5, s2.y); c.lineTo(s2.x - 38 + ph * .5 + 6, s2.y - 14); c.lineTo(s2.x - 38 + ph * .5 + 12, s2.y + 12); c.lineTo(s2.x - 38 + ph * .5 + 16, s2.y); c.lineTo(s2.x + 38, s2.y); c.stroke(); }
      /* closed doors */
      CLOSED.forEach(dr => { c.fillStyle = "#1B1A18"; c.fillRect(dr.x - 2, dr.y - 2, dr.w + 4, dr.h + 4); c.fillStyle = "#8C867C"; const vert = dr.h > dr.w; for (let k = 0; k < (vert ? dr.h : dr.w); k += 18) vert ? c.fillRect(dr.x + 3, dr.y + k, dr.w - 6, 10) : c.fillRect(dr.x + k, dr.y + 3, 10, dr.h - 6); });
      /* cameras and the admin table */
      c.fillStyle = "#1B1A18"; c.fillRect(STA.cams.x - 40, STA.cams.y - 26, 80, 52); c.fillStyle = "#5AA3E0"; [0, 1, 2, 3].forEach(i => c.fillRect(STA.cams.x - 34 + (i % 2) * 36, STA.cams.y - 20 + Math.floor(i / 2) * 22, 32, 18));
      c.fillStyle = "#1B1A18"; c.fillRect(STA.admin.x - 60, STA.admin.y - 34, 120, 68); c.fillStyle = "rgba(127,178,74,.55)"; c.fillRect(STA.admin.x - 52, STA.admin.y - 26, 104, 52);
      /* bodies */
      v.bodies.forEach(b => { const p = this.pl().find(x => x.id === b.id) || {id: b.id, name: "?"}; this.figure(c, b.x, b.y, p, {body: true, k: b.k}); });
      /* people */
      const R0 = cam ? 99999 : !v.alive ? 99999 : v.imp ? VIS.imp : (v.sab && v.sab.type === "lights" ? VIS.dark : VIS.crew) * (v.vis || 1);
      const list = this.pl().map(p => ({p, q: p.id === PNet.me ? Object.assign({}, POS[p.id] || {}, {dx: me.x, dy: me.y}) : POS[p.id]})).filter(o => o.q && o.q.dx != null).sort((a, b) => a.q.dy - b.q.dy);
      list.forEach(({p, q}) => { const self = p.id === PNet.me, gh = q.g || (v.deadList.includes(p.id) && !v.bodies.some(b => b.id === p.id) && false);
        const vk = this.ventK(q); if (vk > 0){ const vt = VENTS.find(x => dist(x, {x: q.dx, y: q.dy}) < 60); if (vt) this.lid(c, vt, vk); }
        if (!self){ if (q.v && vk >= 1) return; if (q.g && (v.alive || cam)) return; if (v.alive && dist(me, {x: q.dx, y: q.dy}) > R0 + 20) return; if (now() - (q.t || 0) > 15000) return; }
        if (self && ((this.vent && vk >= 1) || (cam && q.g))) return;
        if (q.mv && !q.g && !cam && Math.random() < .25) this.dust.push({x: q.dx + (Math.random() * 20 - 10), y: q.dy + 14, t: now()});
        this.figure(c, q.dx, q.dy, p, {vk: vk < 1 ? vk : 0, sc: q.sc && !q.g, ghost: q.g, f: q.f, mv: q.mv, red: v.imp && v.mates.includes(p.id) && !self, me: self && !cam}); });
      /* little dust clouds where people walk */
      if (!cam){ this.dust = this.dust.filter(p => now() - p.t < 450); this.dust.forEach(p => { const a = 1 - (now() - p.t) / 450; c.fillStyle = `rgba(186,181,172,${a * .35})`; c.beginPath(); c.arc(p.x, p.y, 4 + (1 - a) * 8, 0, 7); c.fill(); }); }
      return R0;
    },
    after(c, cw, ch, z, R0){
      const v = this.v, pulse = (Math.sin(now() / 250) + 1) / 2;
      /* darkness outside your sight */
      c.setTransform(1, 0, 0, 1, 0, 0);
      if (v.alive){ const rad = R0 * z, g = c.createRadialGradient(cw / 2, ch / 2, rad * .55, cw / 2, ch / 2, rad); g.addColorStop(0, "rgba(6,7,12,0)"); g.addColorStop(1, "rgba(6,7,12,.93)"); c.fillStyle = g; c.fillRect(0, 0, cw, ch); }
      if (this.vent){ c.fillStyle = "rgba(6,7,12,.55)"; c.fillRect(0, 0, cw, ch); }
      if (now() - (this.killFx || 0) < 600){ const k = (now() - this.killFx) / 600, d = this.dpr; c.save(); c.globalAlpha = 1 - k; c.strokeStyle = "#fff"; c.shadowColor = "#E2523E"; c.shadowBlur = 20 * d;
        [[-.3, 0], [.05, .12], [.35, -.1]].forEach(([o, dl], i) => { const t2 = Math.min(1, k * 3 - i * .25); if (t2 <= 0) return; c.lineWidth = (9 - i * 2) * d; c.beginPath(); c.moveTo(cw * (.25 + o * .3), ch * (.2 + dl)); c.lineTo(cw * (.25 + o * .3) + cw * .5 * t2, ch * (.2 + dl) + ch * .6 * t2); c.stroke(); });
        c.fillStyle = `rgba(160,20,10,${.35 * (1 - k)})`; c.fillRect(0, 0, cw, ch); c.restore(); }
      if (v.sab && CRIT[v.sab.type]){ c.fillStyle = `rgba(226,82,62,${.08 + pulse * .12})`; c.fillRect(0, 0, cw, ch); }
      if (v.sab && v.sab.type === "comms" && Math.random() < .5){ c.fillStyle = "rgba(255,255,255,.035)"; for (let i = 0; i < 6; i++) c.fillRect(0, Math.random() * ch, cw, 2 + Math.random() * 6 * this.dpr); }
      /* arrows at the edge of the screen: yellow to your tasks, red to what needs fixing */
      if (v.phase === "play" && !this.vent){ const me = this.me, d = this.dpr, pts = [];
        if (!v.imp && !(v.sab && v.sab.type === "comms")) v.tasks.filter(([t, dn]) => !dn).map(([t]) => TASKS.find(x => x.id === t)).sort((a, b) => dist(me, a) - dist(me, b)).slice(0, 3).forEach(t => pts.push([t, "#E9B64A"]));
        Object.keys(FIX).forEach(k => { if (needFix(v.sab, k)) pts.push([FIX[k], "#E2523E"]); });
        if (v.ev && v.alive){ const fr = v.ev.pads.find(pd => !this.onPad(pd)) || v.ev.pads[0]; pts.push([fr, "#5AD1E0"]); }
        const m = 46 * d, cx = cw / 2, cy = ch / 2;
        pts.forEach(([p, col]) => { const sx = cx + (p.x - me.x) * z, sy = cy + (p.y - me.y) * z; if (sx > m && sx < cw - m && sy > m && sy < ch - m) return;
          const dx = sx - cx, dy = sy - cy, k = Math.min((cx - m) / Math.max(1, Math.abs(dx)), (cy - m) / Math.max(1, Math.abs(dy))), ax = cx + dx * k, ay = cy + dy * k, an = Math.atan2(dy, dx);
          c.save(); c.translate(ax, ay); c.rotate(an); c.globalAlpha = .75 + pulse * .25; c.fillStyle = col; c.strokeStyle = "rgba(0,0,0,.6)"; c.lineWidth = 2 * d;
          c.beginPath(); c.moveTo(16 * d, 0); c.lineTo(-10 * d, -12 * d); c.lineTo(-5 * d, 0); c.lineTo(-10 * d, 12 * d); c.closePath(); c.fill(); c.stroke(); c.restore(); }); }
    },
    /* back walls with windows to space, ceiling lights, pipes in the halls */
    walls(c){
      const t = now();
      HALLS.forEach(a => { const hz = a.w > a.h; c.strokeStyle = "#4a4640"; c.lineWidth = 7; c.beginPath(); if (hz){ c.moveTo(a.x, a.y + 12); c.lineTo(a.x + a.w, a.y + 12); } else { c.moveTo(a.x + 12, a.y); c.lineTo(a.x + 12, a.y + a.h); } c.stroke();
        c.strokeStyle = "#5f5a52"; c.lineWidth = 3; c.beginPath(); if (hz){ c.moveTo(a.x, a.y + 24); c.lineTo(a.x + a.w, a.y + 24); } else { c.moveTo(a.x + 24, a.y); c.lineTo(a.x + 24, a.y + a.h); } c.stroke();
        c.fillStyle = "#5f5a52"; for (let k = 40; k < (hz ? a.w : a.h); k += 90) hz ? c.fillRect(a.x + k, a.y + 6, 8, 12) : c.fillRect(a.x + 6, a.y + k, 12, 8); });
      ROOMS.forEach((r, i) => {
        const g = c.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, 10, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * .62); g.addColorStop(0, "rgba(255,236,200,.07)"); g.addColorStop(1, "rgba(255,236,200,0)"); c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
        c.fillStyle = "#45413b"; c.fillRect(r.x, r.y, r.w, 40); c.fillStyle = "rgba(0,0,0,.32)"; c.fillRect(r.x, r.y + 40, r.w, 7); c.fillStyle = "#5f5a52"; c.fillRect(r.x, r.y + 38, r.w, 2);
        const outer = r.y < 200 || r.x + r.w > 2400 || r.y + r.h > 1400;
        if (outer) for (let k = 0, x = r.x + r.w - 100; k < 2 && x > r.x + 200; k++, x -= 130){ c.fillStyle = "#5f5a52"; c.fillRect(x - 4, r.y + 3, 78, 34); c.fillStyle = "#070810"; c.fillRect(x, r.y + 6, 70, 28);
          c.fillStyle = "#fff"; for (let j = 0; j < 5; j++){ const sx = x + ((i * 37 + j * 23 + k * 11) % 66) + 2, sy = r.y + 8 + ((i * 13 + j * 7 + k * 5) % 22); c.globalAlpha = .4 + .5 * Math.abs(Math.sin(t / 900 + j + i)); c.fillRect(sx, sy, 2, 2); } c.globalAlpha = 1; }
        /* a lamp on the wall */
        c.fillStyle = "#F4E7C8"; c.fillRect(r.x + r.w / 2 - 18, r.y + 34, 36, 5); c.fillStyle = "rgba(255,236,200,.035)"; c.beginPath(); c.moveTo(r.x + r.w / 2 - 18, r.y + 39); c.lineTo(r.x + r.w / 2 + 18, r.y + 39); c.lineTo(r.x + r.w / 2 + 70, r.y + 130); c.lineTo(r.x + r.w / 2 - 70, r.y + 130); c.closePath(); c.fill();
      });
    },
    lid(c, vt, k){ c.save(); c.translate(vt.x, vt.y - 18); c.fillStyle = "#070810"; c.fillRect(-24, 2, 48, 32); c.rotate(-Math.min(1, k * 2) * 1.2); c.fillStyle = "#4a4640"; c.fillRect(-26, -4, 52, 8); c.restore(); },
    floor(c, r){
      if (r.floor === "board"){ const n = 40; for (let y = r.y; y < r.y + r.h; y += n) for (let x = r.x; x < r.x + r.w; x += n){ c.fillStyle = ((x - r.x) / n + (y - r.y) / n) % 2 ? "#769656" : "#EEEED2"; c.globalAlpha = .55; c.fillRect(x, y, Math.min(n, r.x + r.w - x), Math.min(n, r.y + r.h - y)); } c.globalAlpha = 1; return; }
      c.fillStyle = r.floor === "plank" ? "#3a3631" : r.floor === "tile" ? "#383530" : "#34312c"; c.fillRect(r.x, r.y, r.w, r.h);
      c.strokeStyle = "rgba(0,0,0,.18)"; c.lineWidth = 2; const n = r.floor === "plank" ? 46 : 56;
      if (r.floor === "plank") for (let y = r.y; y < r.y + r.h; y += n){ c.beginPath(); c.moveTo(r.x, y); c.lineTo(r.x + r.w, y); c.stroke(); }
      else for (let y = r.y; y < r.y + r.h; y += n) for (let x = r.x; x < r.x + r.w; x += n) c.strokeRect(x, y, n, n);
    },
    props(c){
      /* cafeteria table with the emergency button */
      c.fillStyle = "#4a4640"; c.beginPath(); c.arc(BTN.x, BTN.y, 78, 0, 7); c.fill(); c.fillStyle = "#3D3A35"; c.beginPath(); c.arc(BTN.x, BTN.y, 66, 0, 7); c.fill();
      c.fillStyle = "#9b2c20"; c.beginPath(); c.arc(BTN.x, BTN.y + 4, 24, 0, 7); c.fill(); c.fillStyle = "#E2523E"; c.beginPath(); c.arc(BTN.x, BTN.y, 22, 0, 7); c.fill();
      [[1110, 230], [1450, 230], [1110, 470], [1450, 470]].forEach(([x, y]) => { c.fillStyle = "#4a4640"; c.beginPath(); c.arc(x, y, 46, 0, 7); c.fill(); });
      /* reactor core */
      const t = now() / 600; c.fillStyle = "#1B1A18"; c.beginPath(); c.arc(240, 800, 92, 0, 7); c.fill(); const g = c.createRadialGradient(240, 800, 10, 240, 800, 80); g.addColorStop(0, "#d6ffb0"); g.addColorStop(.5, `rgba(127,178,74,${.7 + Math.sin(t) * .2})`); g.addColorStop(1, "rgba(127,178,74,0)"); c.fillStyle = g; c.beginPath(); c.arc(240, 800, 80, 0, 7); c.fill();
      /* medbay beds, lab benches, storage crates, oxygen plants, bridge window */
      c.fillStyle = "#4a4640"; [[340, 250], [340, 340]].forEach(([x, y]) => c.fillRect(x, y, 150, 60)); c.fillStyle = "#F4F2EE"; [[350, 260], [350, 350]].forEach(([x, y]) => c.fillRect(x, y, 40, 40));
      c.fillStyle = "#4a4640"; [[1060, 1250, 160, 60], [1300, 1250, 160, 60], [1060, 1360, 160, 60]].forEach(([x, y, w, h]) => c.fillRect(x, y, w, h)); c.fillStyle = "#5AA3E0"; [[1080, 1262], [1120, 1262], [1320, 1262], [1360, 1262]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y + 18, 12, 0, 7); c.fill(); });
      [[1180, 700], [1260, 700], [1180, 770], [1400, 840], [1330, 900]].forEach(([x, y]) => { c.fillStyle = "#6b5a3e"; c.fillRect(x, y, 64, 56); c.strokeStyle = "#4e4130"; c.lineWidth = 4; c.strokeRect(x + 4, y + 4, 56, 48); c.beginPath(); c.moveTo(x + 4, y + 4); c.lineTo(x + 60, y + 52); c.stroke(); });
      [[1700, 800], [1860, 760], [1800, 880]].forEach(([x, y]) => { c.fillStyle = "#4F7A2A"; c.beginPath(); c.arc(x, y, 30, 0, 7); c.fill(); c.fillStyle = "#7FB24A"; c.beginPath(); c.arc(x - 6, y - 6, 18, 0, 7); c.fill(); });
      c.fillStyle = "#0B0C12"; c.fillRect(2420, 660, 16, 280); c.fillStyle = "#4a4640"; c.fillRect(2240, 760, 120, 70);
      /* comms dish, nav console, electrical panels */
      c.strokeStyle = "#BAB5AC"; c.lineWidth = 6; c.beginPath(); c.arc(1980, 330, 60, Math.PI * .9, Math.PI * 2.1); c.stroke(); c.fillStyle = "#4a4640"; c.fillRect(1900, 1300, 160, 60); c.fillRect(330, 1180, 60, 120); c.fillRect(560, 1180, 60, 120);
      /* comms: server racks with blinking lights */
      [[1880, 200], [1930, 200]].forEach(([x, y], i) => { c.fillStyle = "#1B1A18"; c.fillRect(x, y, 40, 100); for (let j = 0; j < 6; j++){ c.fillStyle = (Math.floor(t * 3 + j * 1.7 + i) % 3) ? "#3a3631" : j % 2 ? "#8FC458" : "#E9B64A"; c.fillRect(x + 6, y + 8 + j * 15, 6, 6); c.fillStyle = "#2B2926"; c.fillRect(x + 16, y + 8 + j * 15, 18, 6); } });
      /* reactor: warning stripes and pipes to the two panels */
      c.save(); c.beginPath(); c.arc(240, 800, 112, 0, 7); c.arc(240, 800, 96, 0, 7, true); c.clip(); for (let a = 0; a < 40; a++){ c.fillStyle = a % 2 ? "#1B1A18" : "#E9B64A"; c.beginPath(); c.moveTo(240, 800); c.arc(240, 800, 120, a * Math.PI / 20, (a + 1) * Math.PI / 20); c.fill(); } c.restore();
      c.strokeStyle = "#5f5a52"; c.lineWidth = 10; c.beginPath(); c.moveTo(150, 730); c.lineTo(110, 680); c.moveTo(330, 730); c.lineTo(370, 680); c.stroke();
      /* electrical: cables along the wall */
      ["#E2523E", "#5AA3E0", "#E9B64A"].forEach((col, i) => { c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.moveTo(310, 1180 + i * 10); for (let x = 310; x < 690; x += 30) c.lineTo(x, 1180 + i * 10 + ((x / 30 + i) % 2 ? 8 : 0)); c.stroke(); });
      /* medbay: a red cross on the floor */
      c.fillStyle = "rgba(226,82,62,.35)"; c.fillRect(585, 300, 70, 22); c.fillRect(609, 276, 22, 70);
      /* oxygen: tanks */
      [[1904, 700], [1904, 770]].forEach(([x, y]) => { c.fillStyle = "#5AA3E0"; c.beginPath(); c.roundRect ? c.roundRect(x, y, 26, 58, 12) : c.rect(x, y, 26, 58); c.fill(); c.fillStyle = "rgba(255,255,255,.35)"; c.fillRect(x + 5, y + 8, 4, 40); });
      /* lab: a centrifuge */
      c.fillStyle = "#1B1A18"; c.beginPath(); c.arc(1440, 1190, 34, 0, 7); c.fill(); c.strokeStyle = "#8FC458"; c.lineWidth = 4; c.beginPath(); c.arc(1440, 1190, 22, t * 4, t * 4 + 4.5); c.stroke();
      /* storage: barrels; bridge: chairs and consoles; navigation: chairs */
      [[1130, 900], [1160, 940], [1450, 680]].forEach(([x, y]) => { c.fillStyle = "#6b4a2e"; c.beginPath(); c.arc(x, y, 20, 0, 7); c.fill(); c.strokeStyle = "#4e3520"; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 14, 0, 7); c.stroke(); });
      [[2200, 760], [2200, 880], [1830, 1370], [2000, 1370]].forEach(([x, y]) => { c.fillStyle = "#4a4640"; c.beginPath(); c.arc(x, y, 18, 0, 7); c.fill(); c.fillStyle = "#5f5a52"; c.fillRect(x - 18, y - 26, 36, 10); });
      c.fillStyle = "#1B1A18"; c.fillRect(2100, 640, 30, 300); for (let j = 0; j < 8; j++){ c.fillStyle = (Math.floor(t * 2 + j) % 4) ? "#5AA3E0" : "#8FC458"; c.fillRect(2106, 652 + j * 36, 18, 10); }
      /* cafeteria: benches */
      [[1110, 230], [1450, 230], [1110, 470], [1450, 470]].forEach(([x, y]) => { c.fillStyle = "#3D3A35"; c.fillRect(x - 56, y + 50, 112, 12); c.fillRect(x - 56, y - 62, 112, 12); });
      /* fans on the walls */
      [[380, 990], [1900, 960], [680, 1160], [2420, 980]].forEach(([x, y]) => { c.fillStyle = "#1B1A18"; c.beginPath(); c.arc(x, y, 26, 0, 7); c.fill(); c.save(); c.translate(x, y); c.rotate(now() / 120); c.fillStyle = "#5f5a52"; for (let k = 0; k < 4; k++){ c.rotate(Math.PI / 2); c.beginPath(); c.ellipse(0, -11, 6, 12, 0, 0, 7); c.fill(); } c.restore(); c.fillStyle = "#8C867C"; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); });
      /* side windows of the reactor and the medbay */
      [[60, 680], [60, 860], [300, 300]].forEach(([x, y], i) => { c.fillStyle = "#5f5a52"; c.fillRect(x, y, 14, 90); c.fillStyle = "#070810"; c.fillRect(x + 3, y + 4, 8, 82); c.fillStyle = "#fff"; [0, 1, 2].forEach(j => { c.globalAlpha = .4 + .5 * Math.abs(Math.sin(now() / 800 + i + j)); c.fillRect(x + 5, y + 14 + j * 26 + i * 4, 2, 2); }); c.globalAlpha = 1; });
      /* hazard stripes in the doorways */
      c.save(); c.globalAlpha = .35; Object.values(DOORS).flat().forEach(dr => { const vert = dr.h > dr.w; for (let k = 0; k < (vert ? dr.h : dr.w); k += 16){ c.fillStyle = (k / 16) % 2 ? "#1B1A18" : "#E9B64A"; vert ? c.fillRect(dr.x + 4, dr.y + k, dr.w - 8, 8) : c.fillRect(dr.x + k, dr.y + 4, 8, dr.h - 8); } }); c.restore();
      /* the chess lounge: a big knight */
      const kn = pieceImg("wn"); if (kn.complete && kn.naturalWidth) c.drawImage(kn, 730, 740, 120, 120); const bk = pieceImg("bk"); if (bk.complete && bk.naturalWidth) c.drawImage(bk, 860, 700, 70, 70);
    },
    faceOf(id, f){ const F = this.faces || (this.faces = {}), t = now(); let e = F[id]; if (!e){ e = F[id] = {v: f, t}; }
      const dt = Math.min(.1, (t - e.t) / 1000); e.t = t; if (e.v !== f){ const d = f - e.v, st = dt * 12; e.v = Math.abs(d) <= st ? f : e.v + Math.sign(d) * st; }
      const v = e.v; return Math.abs(v) < .12 ? (v < 0 ? -.12 : .12) : v; },
    /* how far someone is into a vent: 0 = standing, 1 = gone */
    ventK(q){ const T0 = 380, a = now() - (q.vt || 0); if (q.v) return a >= T0 ? 1 : a / T0; return a >= T0 ? 0 : 1 - a / T0; },
    figure(c, x, y, p, o){
      const im = avImg(p.id, p.av), h = 118, w = h * 200 / 256, bob = o.mv ? Math.sin(now() / 90) * 3 : 0;
      c.save(); c.translate(x, y);
      if (o.body){ const k = o.k || "stab", ok = im.complete && im.naturalWidth;
        c.fillStyle = "#7a1a12"; c.beginPath(); c.ellipse(-6, 14, k === "shot" ? 110 : 70, 24, 0, 0, 7); c.fill(); c.fillStyle = "#a82a1e"; c.beginPath(); c.ellipse(-10, 12, 52, 16, 0, 0, 7); c.fill();
        [[44, -6, 7], [-62, 4, 6], [30, 30, 5], [-30, 32, 4], [58, 22, 4]].forEach(([a, b, r]) => { c.beginPath(); c.arc(a, b, r, 0, 7); c.fill(); });
        c.font = "34px system-ui"; c.textAlign = "center"; c.save(); c.translate(34, 2); c.rotate(.6); c.fillText("🦴", 0, 0); c.restore(); c.globalAlpha = .95;
        if (k === "chess"){ c.save(); c.scale(1.5, .3); if (ok){ c.filter = "grayscale(.6) brightness(.8)"; c.drawImage(im, -w / 2, -h + 50, w, h); c.filter = "none"; } c.restore(); const q = pieceImg("bq"); if (q.complete && q.naturalWidth) c.drawImage(q, -48, -96, 96, 96); c.restore(); return; }
        c.rotate(-Math.PI / 2); c.filter = "grayscale(.6) brightness(.8)";
        const X = -w / 2 - 20, Y = -h + 30, cut = h * .4;
        if (ok){ if (k === "head"){ c.save(); c.beginPath(); c.rect(X, Y + cut, w, h - cut); c.clip(); c.drawImage(im, X, Y, w, h); c.restore(); c.save(); c.translate(-30, 70); c.rotate(2.2); c.beginPath(); c.rect(X, Y, w, cut); c.clip(); c.drawImage(im, X, Y, w, h); c.restore(); }
          else if (k === "bite"){ c.save(); c.beginPath(); c.rect(X, Y + h * .62, w, h * .38); c.clip(); c.drawImage(im, X, Y, w, h); c.restore(); }
          else c.drawImage(im, X, Y, w, h); }
        c.filter = "none";
        if (k === "stab"){ c.font = "40px system-ui"; c.save(); c.translate(-10, 6); c.rotate(.9); c.fillText("🔪", 0, 0); c.restore(); }
        if (k === "bite"){ c.font = "30px system-ui"; c.fillText("🦴", -40, -20); c.fillText("🦴", -10, 30); }
        if (k === "shot"){ c.fillStyle = "#1a0705"; [[-20, 4], [6, -10], [14, 12]].forEach(([a, b]) => { c.beginPath(); c.arc(a, b, 5, 0, 7); c.fill(); }); }
        c.restore(); return; }
      if (o.ghost){ c.globalAlpha = .45; y += Math.sin(now() / 400) * 6; }
      if (o.sc){ const k = (now() / 900) % 1, yy = 10 - k * (h - 10); c.fillStyle = "rgba(127,178,74,.18)"; c.beginPath(); c.ellipse(0, 14, 44, 14, 0, 0, 7); c.fill(); c.fillStyle = "rgba(143,196,88,.55)"; c.fillRect(-40, yy, 80, 5); c.strokeStyle = "rgba(143,196,88,.7)"; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 14, 44, 14, 0, 0, 7); c.stroke(); }
      c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.ellipse(0, 16, 26, 8, 0, 0, 7); c.fill();
      if (o.me){ c.strokeStyle = "rgba(143,196,88,.8)"; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 16, 30, 10, 0, 0, 7); c.stroke(); }
      const fs = this.faceOf(p.id, o.f || 1), vk = o.vk || 0;
      if (vk > 0){ c.save(); c.beginPath(); c.rect(-w, -h * 2, w * 2, h * 2 + 16); c.clip(); c.translate(0, vk * (h - 4)); }
      c.save(); c.scale(fs, 1);
      if (im.complete && im.naturalWidth) c.drawImage(im, -w / 2, -h + 18 + bob, w, h); else { c.fillStyle = "#BAB5AC"; c.beginPath(); c.arc(0, -30, 26, 0, 7); c.fill(); }
      c.restore(); if (vk > 0){ c.restore(); if (vk > .55){ c.restore(); return; } }
      c.font = "800 15px Figtree,system-ui,sans-serif"; c.textAlign = "center"; const tw = c.measureText(p.name).width + 12; c.fillStyle = "rgba(20,19,17,.72)"; c.beginPath(); c.roundRect ? c.roundRect(-tw / 2, -h + bob - 2, tw, 20, 10) : c.rect(-tw / 2, -h + bob - 2, tw, 20); c.fill(); c.fillStyle = o.red ? "#F07B68" : "#fff"; c.fillText(p.name, 0, -h + 13 + bob);
      c.restore();
    },
    /* ---------------- minigames ---------------- */
    closeMini(){ if (this.mini){ this.mini.stop && this.mini.stop(); this.mini = null; } const m = this.el && this.el.querySelector(".np-mini"); if (m){ m.innerHTML = ""; m.classList.remove("on"); } },
    openMini(g, done, task){
      this.closeMini(); const box = this.el.querySelector(".np-mini"), me = {stop: null, g}; this.mini = me; this.joy = null; if (g === "scan") this.send(true);
      const finish = () => { Haptic.go([20, 30, 20]); box.querySelector(".np-mg").classList.add("ok"); setTimeout(() => { if (this.mini === me){ this.closeMini(); done(); } }, 450); };
      box.classList.add("on");
      box.innerHTML = `<div class="np-mg"><div class="np-mgh"><b>${esc(task ? T(task.en, task.de) : g === "hold" ? T("Hold the panel", "Platte halten") : T("Fix it", "Reparieren"))}</b><button class="np-x" data-c>×</button></div><div class="np-mgb"></div></div>`;
      box.querySelector("[data-c]").onclick = () => { Sound.tap(); this.closeMini(); };
      (MG[g] || MG.hold)(box.querySelector(".np-mgb"), finish, me, {act: a => this.act(a), view: () => this.v, key: task && task.key});
    }
  };
  NP.kd = NP.ku = NP.rs = () => {};
  window.__npTo = p => { NP.me.x = p.x; NP.me.y = p.y; NP.send(true); };
  window.__npToId = id => { const q = POS[id]; if (q) window.__npTo({x: q.x + 30, y: q.y}); };
  window.__npDu = () => NP.du && {seed: NP.du.seed, stage: NP.du.stage, t: Date.now() - NP.du.t0, el: NP.v && NP.v.meet && NP.v.meet.mg && NP.v.meet.mg.el};
  window.__npOpen = g => NP.openMini(g, () => {}); window.__npClose = () => NP.closeMini();
  window.__npCams = () => NP.openCams(); window.__npAdmin = () => NP.openAdmin();
  PG.custom.np = {draw: (b, v, m, a) => NP.draw(b, v, m, a), stop: () => NP.stop()};

  /* the minigames: short, all in the app's look */
  const MG = {
    reactor(el, done, me, ctx){ el.innerHTML = `<div class="np-up"><div class="np-hand">✋</div><p class="muted" data-st></p></div>`;
      const h = el.querySelector(".np-hand"), st = el.querySelector("[data-st]"); let id = null;
      const show = () => { const v = ctx.view(), two = v.two, other = ctx.key === "ra" ? "rb" : "ra", held = v.held || {}; if (!v.sab){ done(); return; }
        st.textContent = two ? (held[other] ? T("The other panel is held. Hold on!", "Die andere Platte wird gehalten. Festhalten!") : T("Someone has to hold the other panel at the same time", "Jemand muss gleichzeitig die andere Platte halten")) : T("Press and hold", "Gedrückt halten"); };
      const go = e => { e.preventDefault(); h.classList.add("on"); clearInterval(id); ctx.act({a: "hold", v: ctx.key}); id = setInterval(() => { ctx.act({a: "hold", v: ctx.key}); Haptic.go(12); }, 500); };
      const up = () => { h.classList.remove("on"); clearInterval(id); };
      h.addEventListener("pointerdown", go); ["pointerup", "pointerleave", "pointercancel"].forEach(t => h.addEventListener(t, up));
      show(); const sid = setInterval(show, 300); me.stop = () => { clearInterval(id); clearInterval(sid); }; },
    code(el, done){ const code = String(10000 + Math.floor(Math.random() * 90000)); let got = "";
      el.innerHTML = `<div class="np-code"><div class="np-cl"><div class="np-note">${T("Today's code", "Heutiger Code")}<b>${code}</b></div><div class="np-disp">·····</div></div><div class="np-num np-key">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "✓"].map(n => `<button data-k="${n}">${n}</button>`).join("")}</div></div>`;
      const d = el.querySelector(".np-disp"), show = () => { d.textContent = (got + "·····").slice(0, 5); };
      el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { const k = b.dataset.k; Haptic.go(8);
        if (k === "⌫") got = got.slice(0, -1); else if (k === "✓"){ if (got === code) return done(); Sound.wrong(); d.classList.add("bad"); setTimeout(() => d.classList.remove("bad"), 400); got = ""; } else if (got.length < 5){ got += k; Sound.play("Move", .4); }
        show(); if (got === code) setTimeout(done, 150); }); },
    tune(el, done, me){ const target = 15 + Math.floor(Math.random() * 70); let val = target > 50 ? 5 : 95, ok = 0;
      el.innerHTML = `<div class="np-tune"><svg viewBox="0 0 300 120"><path class="tg" fill="none" stroke="#5AA3E0" stroke-width="3" opacity=".5"/><path class="cur" fill="none" stroke="#8FC458" stroke-width="4"/></svg><input type="range" min="0" max="100" value="${val}"><p class="muted">${T("Match the signal", "Signal angleichen")}</p></div>`;
      const wave = (f, ph) => { let dd = "M0 60"; for (let x = 0; x <= 300; x += 6) dd += ` L${x} ${60 + Math.sin(x / (8 + f / 6) + ph) * (20 + f / 4)}`; return dd; };
      const tg = el.querySelector(".tg"), cur = el.querySelector(".cur"), inp = el.querySelector("input");
      inp.addEventListener("input", () => { val = +inp.value; Haptic.go(4); });
      const id = setInterval(() => { const ph = now() / 300, off = Math.abs(val - target); tg.setAttribute("d", wave(target, ph)); cur.setAttribute("d", wave(val, ph + off / 12)); cur.setAttribute("stroke", off < 4 ? "#8FC458" : "#E2523E");
        if (off < 4){ if (++ok > 8){ clearInterval(id); done(); } } else ok = 0; }, 80); me.stop = () => clearInterval(id); },
    asteroids(el, done, me){ let hit = 0; const need = 10;
      el.innerHTML = `<div class="np-ast"><span class="np-ast-n">0 / ${need}</span></div>`; const box = el.querySelector(".np-ast"), n = box.querySelector(".np-ast-n");
      const spawn = () => { if (!box.isConnected) return; const a = document.createElement("button"); a.className = "np-rock"; a.textContent = "🪨"; const y = 10 + Math.random() * 70; a.style.top = y + "%"; a.style.animationDuration = (2.2 + Math.random() * 1.6) + "s";
        a.onpointerdown = e => { e.preventDefault(); if (a.dataset.x) return; a.dataset.x = 1; a.textContent = "💥"; Sound.play("Capture", .5); Haptic.go(15); hit++; n.textContent = hit + " / " + need; setTimeout(() => a.remove(), 200); if (hit >= need) done(); };
        a.addEventListener("animationend", () => a.remove()); box.appendChild(a); };
      spawn(); const id = setInterval(spawn, 480); me.stop = () => clearInterval(id); },
    trash(el, done, me){ el.innerHTML = `<div class="np-trash"><div class="np-bin"><i></i></div><div class="np-lever"><b></b></div></div><p class="muted">${T("Pull the lever down and hold", "Hebel runterziehen und halten")}</p>`;
      const lv = el.querySelector(".np-lever"), kn = lv.querySelector("b"), fill = el.querySelector(".np-bin i"); let d = null, p = 100, id = null;
      kn.addEventListener("pointerdown", e => { e.preventDefault(); d = {y0: LOC(e).y}; try { kn.setPointerCapture(e.pointerId); } catch(_) {} });
      kn.addEventListener("pointermove", e => { if (!d) return; const max = lv.clientHeight - kn.clientHeight, y = Math.max(0, Math.min(max, LOC(e).y - d.y0)); kn.style.transform = `translateY(${y}px)`; d.down = y >= max - 4;
        if (d.down && !id){ id = setInterval(() => { p -= 4; fill.style.height = Math.max(0, p) + "%"; if (p % 20 === 0) Haptic.go(10); if (p <= 0){ clearInterval(id); done(); } }, 100); } if (!d.down && id){ clearInterval(id); id = null; } });
      kn.addEventListener("pointerup", () => { d = null; kn.style.transform = ""; clearInterval(id); id = null; }); me.stop = () => clearInterval(id); },
    wires(el, done){ const C = ["#E2523E", "#5AA3E0", "#E9B64A", "#8FC458"], R2 = PG.shuffle([0, 1, 2, 3]), con = {};
      el.innerHTML = `<div class="np-wires"><svg viewBox="0 0 300 240"></svg>${C.map((c, i) => `<i class="l" data-l="${i}" style="top:${20 + i * 55}px;background:${c}"></i>`).join("")}${R2.map((c, i) => `<i class="r" data-r="${c}" style="top:${20 + i * 55}px;background:${C[c]}"></i>`).join("")}</div>`;
      const svg = el.querySelector("svg"), box = el.querySelector(".np-wires"); let drag = null;
      const pt = e => { const r = REL(e, box); return [r.x / box.clientWidth * 300, r.y / box.clientHeight * 240]; };
      const draw = (tmp) => { svg.innerHTML = Object.entries(con).map(([l, r]) => `<line x1="34" y1="${42 + l * 55}" x2="266" y2="${42 + R2.indexOf(+r) * 55}" stroke="${C[l]}" stroke-width="12" stroke-linecap="round"/>`).join("") + (tmp ? `<line x1="34" y1="${42 + tmp.l * 55}" x2="${tmp.x}" y2="${tmp.y}" stroke="${C[tmp.l]}" stroke-width="12" stroke-linecap="round"/>` : ""); };
      box.addEventListener("pointerdown", e => { const l = e.target.closest("[data-l]"); if (!l) return; e.preventDefault(); drag = {l: +l.dataset.l}; try { box.setPointerCapture(e.pointerId); } catch(_) {} });
      box.addEventListener("pointermove", e => { if (!drag) return; const [x, y] = pt(e); draw({l: drag.l, x, y}); });
      box.addEventListener("pointerup", e => { if (!drag) return; const [x, y] = pt(e), ri = Math.round((y - 42) / 55); if (x > 200 && ri >= 0 && ri < 4 && R2[ri] === drag.l){ con[drag.l] = R2[ri]; Sound.play("Move", .6); Haptic.go(12); } drag = null; draw(); if (Object.keys(con).length === 4) done(); }); },
    upload(el, done, me){ el.innerHTML = `<div class="np-up"><div class="np-up-ic">📡 ➜ 🛰️</div><div class="bar"><i></i></div><button class="btn go big">${T("Upload", "Hochladen")}</button></div>`;
      const b = el.querySelector("button"), bar = el.querySelector(".bar i"); b.onclick = () => { b.disabled = true; let p = 0; const id = setInterval(() => { p += 2.5; bar.style.width = p + "%"; if (p >= 100){ clearInterval(id); done(); } }, 100); me.stop = () => clearInterval(id); }; },
    hold(el, done, me){ el.innerHTML = `<div class="np-up"><div class="np-hand">✋</div><div class="bar"><i></i></div><p class="muted">${T("Press and hold", "Gedrückt halten")}</p></div>`;
      const h = el.querySelector(".np-hand"), bar = el.querySelector(".bar i"); let p = 0, id = null;
      const go = e => { e.preventDefault(); h.classList.add("on"); clearInterval(id); id = setInterval(() => { p += 4; bar.style.width = Math.min(100, p) + "%"; if (p % 20 === 0) Haptic.go(10); if (p >= 100){ clearInterval(id); done(); } }, 100); };
      const up = () => { h.classList.remove("on"); clearInterval(id); if (p < 100){ p = 0; bar.style.width = "0%"; } };
      h.addEventListener("pointerdown", go); ["pointerup", "pointerleave", "pointercancel"].forEach(t => h.addEventListener(t, up)); me.stop = () => clearInterval(id); },
    scan(el, done, me){ el.innerHTML = `<div class="np-up"><div class="np-scan"><i></i>🧍</div><div class="bar"><i></i></div><p class="muted">${T("Scanning… stand still", "Scan läuft… still stehen")}</p></div>`;
      const bar = el.querySelector(".bar i"); let p = 0; const id = setInterval(() => { p += 2; bar.style.width = p + "%"; if (p >= 100){ clearInterval(id); done(); } }, 100); me.stop = () => clearInterval(id); },
    switches(el, done){ const st = [0, 1, 2, 3, 4].map(() => Math.random() < .6 ? 0 : 1); if (st.every(Boolean)) st[2] = 0;
      const draw = () => { el.innerHTML = `<div class="np-sw">${st.map((s, i) => `<button class="${s ? "on" : ""}" data-s="${i}"><i></i></button>`).join("")}</div>`;
        el.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { st[+b.dataset.s] ^= 1; Sound.play("Move", .5); Haptic.go(10); draw(); if (st.every(Boolean)) done(); }); }; draw(); },
    numbers(el, done){ const order = PG.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]); let next = 1;
      el.innerHTML = `<div class="np-num">${order.map(n => `<button data-n="${n}">${n}</button>`).join("")}</div>`;
      el.querySelectorAll("[data-n]").forEach(b => b.onclick = () => { const n = +b.dataset.n; if (n === next){ b.classList.add("ok"); Sound.play("Move", .5); next++; if (next > 9) done(); } else { Sound.wrong(); next = 1; el.querySelectorAll("[data-n]").forEach(x => x.classList.remove("ok")); } }); },
    course(el, done){ const pts = Array.from({length: 5}, (_, i) => [30 + i * 60 + Math.random() * 20, 30 + Math.random() * 160]); let next = 0;
      el.innerHTML = `<div class="np-course"><svg viewBox="0 0 300 220"><polyline fill="none" stroke="#8FC458" stroke-width="5" stroke-dasharray="8 8" points=""/>${pts.map(([x, y], i) => `<g data-p="${i}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="20" fill="#3D3A35" stroke="#BAB5AC" stroke-width="3"/><text x="${x}" y="${y + 6}" text-anchor="middle" fill="#F4F2EE" font-weight="900" font-size="17">${i + 1}</text></g>`).join("")}</svg></div>`;
      const pl = el.querySelector("polyline"); el.querySelectorAll("[data-p]").forEach(g => g.addEventListener("click", () => { const i = +g.dataset.p; if (i !== next) { Sound.wrong(); return; } g.querySelector("circle").setAttribute("fill", "#7FB24A"); Sound.play("Move", .5); next++; pl.setAttribute("points", pts.slice(0, next).map(p => p.join(",")).join(" ")); if (next === pts.length) done(); })); },
    swipe(el, done){ el.innerHTML = `<div class="np-swipe"><div class="track"><i class="card">🪪</i></div><p class="muted" data-m>${T("Swipe the card at a steady speed", "Zieh die Karte gleichmäßig durch")}</p></div>`;
      const tr = el.querySelector(".track"), cd = el.querySelector(".card"), msg = el.querySelector("[data-m]"); let d = null;
      cd.addEventListener("pointerdown", e => { e.preventDefault(); d = {x0: LOC(e).x, t0: now()}; try { cd.setPointerCapture(e.pointerId); } catch(_) {} });
      cd.addEventListener("pointermove", e => { if (!d) return; const max = tr.clientWidth - cd.clientWidth; const x = Math.max(0, Math.min(max, LOC(e).x - d.x0)); cd.style.transform = `translateX(${x}px)`; d.x = x; d.max = max; });
      cd.addEventListener("pointerup", () => { if (!d) return; const ms = now() - d.t0, ok = d.x >= d.max - 4; cd.style.transform = ""; if (!ok) msg.textContent = T("All the way through!", "Ganz durchziehen!"); else if (ms < 450) msg.textContent = T("Too fast. Try again.", "Zu schnell. Nochmal."); else if (ms > 1600) msg.textContent = T("Too slow. Try again.", "Zu langsam. Nochmal."); else { done(); return; } Sound.wrong(); d = null; }); },
    chess(el, done){
      /* mate in one, on the app's own board colours and pieces */
      const L = ["6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", "k7/8/1K6/8/8/8/8/7Q w - - 0 1", "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1", "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1", "5rk1/5ppp/8/8/8/8/1Q3PPP/6K1 w - - 0 1", "7k/7p/8/8/8/8/6R1/1R4K1 w - - 0 1"];
      const g = new Chess(PG.pick(L)); let sel = null;
      const draw = (msg) => { const B = g.board(); el.innerHTML = `<div class="np-cboard">${B.map((row, r) => row.map((p, f) => { const sq = "abcdefgh"[f] + (8 - r); return `<div class="sq ${(r + f) % 2 ? "d" : "l"} ${sel === sq ? "sel" : ""}" data-q="${sq}">${p ? `<i class="np-pc pc ${p.color}${p.type}"></i>` : ""}</div>`; }).join("")).join("")}</div><p class="muted">${msg || T("White to move: find the checkmate", "Weiß am Zug: Finde das Matt")}</p>`;
        el.querySelectorAll("[data-q]").forEach(d => d.onclick = () => { const q = d.dataset.q, p = g.get(q);
          if (p && p.color === "w"){ sel = q; Sound.play("Move", .3); return draw(); }
          if (!sel) return; const m = g.move({from: sel, to: q, promotion: "q"}); sel = null; if (!m) return draw();
          if (g.in_checkmate()){ Sound.play("Mate", .9); draw(T("Checkmate!", "Schachmatt!")); done(); return; }
          Sound.wrong(); g.undo(); draw(T("Not mate. Try again.", "Kein Matt. Nochmal.")); }); };
      draw(); }
  };

  /* ---------------- look ---------------- */
  const css = `.np{position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2700;background:#0B0C12;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;color:var(--fg);font-family:var(--body)}
html.np-on .tabbar,html.np-on .pg-pill{display:none!important}
html.np-on .dsheet{z-index:2800!important}html.np-on .toast{z-index:2900!important}
.np.mapon .np-top{z-index:8}
.np.rot{transform-origin:top left;transform:rotate(90deg) translateY(-100%)}
.np.rot .np-top{top:10px;left:calc(env(safe-area-inset-top,0px) + 10px);right:calc(env(safe-area-inset-bottom,0px) + 10px)}
.np.rot .np-tasks{top:62px;left:calc(env(safe-area-inset-top,0px) + 10px)}.np.rot .np-alert{top:62px;right:calc(env(safe-area-inset-bottom,0px) + 10px)}
.np.rot .np-btns{bottom:14px;right:calc(env(safe-area-inset-bottom,0px) + 14px)}
.np-cv{position:absolute;inset:0;width:100%;height:100%;display:block}
.np-top{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);left:10px;right:10px;display:flex;gap:8px;align-items:center;pointer-events:none}
.np-top>*{pointer-events:auto}
.np-menu,.np-mapb{width:44px;height:44px;border-radius:12px;border:0;background:rgba(33,31,28,.85);color:var(--fg);font:900 20px var(--body);display:flex;align-items:center;justify-content:center;box-shadow:inset 0 -3px 0 rgba(0,0,0,.3);cursor:pointer}
.np-bar{flex:1;height:26px;border-radius:8px;background:rgba(33,31,28,.85);position:relative;overflow:hidden;box-shadow:inset 0 0 0 2px rgba(0,0,0,.35)}
.np-bar i{position:absolute;inset:0 auto 0 0;background:var(--go);transition:width .4s;width:0}
.np-bar span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:900 12px var(--body);letter-spacing:.12em;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.np-tasks{position:absolute;top:calc(env(safe-area-inset-top,0px) + 62px);left:10px;max-width:min(260px,60vw);background:rgba(33,31,28,.78);border-radius:10px;padding:8px 10px;font:700 12.5px/1.45 var(--body);pointer-events:none}
.np-tasks .done{color:var(--go-hi);text-decoration:line-through;opacity:.8}.np-tasks small{display:block;color:var(--muted);font-weight:600}.np-red{color:#F07B68;font:900 15px var(--display)}
.np-alert{position:absolute;top:calc(env(safe-area-inset-top,0px) + 62px);right:10px;left:auto;max-width:min(300px,50vw);background:var(--bad);color:#fff;border-radius:10px;padding:8px 12px;font:800 13.5px var(--body);display:none;animation:npPulse 1s infinite}
.np-alert.on{display:block}.np-alert small{display:block;font-weight:600;opacity:.9}.np-alert b{font:900 18px var(--mono)}
@keyframes npPulse{50%{filter:brightness(1.25)}}
.np-joy{position:absolute;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;background:rgba(244,242,238,.08);border:2px solid rgba(244,242,238,.18);display:none;pointer-events:none}
.np-joy.on{display:block}.np-joy i{position:absolute;left:50%;top:50%;width:54px;height:54px;border-radius:50%;background:rgba(244,242,238,.35);transform:translate(-50%,-50%)}
.np-btns{position:absolute;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);display:flex;flex-wrap:wrap-reverse;justify-content:flex-end;gap:10px;max-width:220px}
.np-act{width:96px;height:96px;border-radius:22px;border:0;background:rgba(61,58,53,.88);color:var(--fg);font-size:36px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;box-shadow:inset 0 -5px 0 rgba(0,0,0,.3);cursor:pointer;opacity:.45;transition:transform .1s}
.np-act span{font:900 12.5px var(--body);letter-spacing:.04em;text-transform:uppercase}
.np-act.on{opacity:1}
.pg-np-hero{display:block;padding:22px 18px;border-radius:14px;margin-top:8px;min-height:0!important;text-align:left}.pg-np-hero .pg-np-ship{font-size:56px}.np-act.main.on{background:var(--go);box-shadow:inset 0 -5px 0 var(--go-deep)}.np-act.kill.on{background:var(--bad);box-shadow:inset 0 -5px 0 #a8382a}.np-act.rep.on{background:#E9B64A;color:#2A1E05}
.np-act:active,.np-act.pr{transform:scale(.92)}
.np-duel{width:min(620px,100%);background:var(--panel);border-radius:16px;padding:12px;box-shadow:0 14px 40px rgba(0,0,0,.6);text-align:center;max-height:calc(var(--h,100vh) - 20px);overflow:hidden;display:flex;flex-direction:column}
.du-k{font:900 13px var(--body);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:8px;display:flex;justify-content:center;gap:10px}.du-tl{color:var(--fg);font-family:var(--mono)}
.du-win2{position:relative;overflow:hidden;border-radius:12px;background:#1B1A18;padding:10px 0}.du-strip{display:flex;gap:12px;width:max-content;will-change:transform}
.du-tile{width:120px;height:110px;border-radius:14px;background:var(--panel-3);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;flex:0 0 auto}.du-tile span{font-size:46px;line-height:1}.du-tile b{font:800 12px var(--body)}
.du-ptr{position:absolute;left:50%;top:0;bottom:0;width:4px;margin-left:-2px;background:var(--go);box-shadow:0 0 12px var(--go)}
.du-play{display:flex;flex-direction:column;min-height:0;flex:1}.du-g{display:flex;justify-content:center;align-items:center;min-height:0;flex:1}.du-st{margin-top:6px;font-size:13px;min-height:18px}
.du-react{width:100%;height:min(220px,calc(var(--h,100vh) - 140px));border:0;border-radius:16px;background:#7a1a12;color:#fff;font:900 32px var(--display);cursor:pointer;touch-action:none}.du-react.go{background:var(--go)}.du-react.bad{background:#3a1d18}.du-react.ok{background:var(--go-deep)}
.du-tap{width:min(240px,100%);height:min(200px,calc(var(--h,100vh) - 140px));border:0;border-radius:50%;background:var(--go);box-shadow:inset 0 -8px 0 var(--go-deep);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;touch-action:none}.du-tap b{font:900 56px var(--display)}.du-tap span{font:800 13px var(--body)}.du-tap.hit{animation:duHit .12s}
@keyframes duHit{50%{transform:scale(.94)}}
.du-snake{display:flex;gap:10px;align-items:center;justify-content:center}.du-snake canvas{width:min(320px,62vw);height:auto;border-radius:10px;background:#0B0C12;touch-action:none}.np.land .du-snake canvas{width:auto;height:min(200px,calc(var(--h,100vh) - 140px))}
.du-pad{display:grid;grid-template-columns:repeat(3,46px);grid-template-rows:repeat(2,46px);gap:4px}.du-pad button{border:0;border-radius:10px;background:var(--panel-3);color:var(--fg);font-size:18px;touch-action:none}.du-pad [data-d="0,-1"]{grid-column:2}.du-pad [data-d="-1,0"]{grid-column:1;grid-row:2}.du-pad [data-d="0,1"]{grid-column:2;grid-row:2}.du-pad [data-d="1,0"]{grid-column:3;grid-row:2}
.du-board{width:min(260px,calc(var(--h,100vh) - 150px))!important;margin:0 auto}
.du-song{width:100%}.du-eq{display:flex;gap:5px;justify-content:center;height:34px;align-items:flex-end;margin-bottom:8px}.du-eq i{width:8px;background:var(--go);border-radius:3px;animation:duEq .6s ease-in-out infinite alternate}.du-eq i:nth-child(2){animation-delay:.15s}.du-eq i:nth-child(3){animation-delay:.3s}.du-eq i:nth-child(4){animation-delay:.1s}.du-eq i:nth-child(5){animation-delay:.25s}
@keyframes duEq{from{height:6px}to{height:34px}}
.du-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px}.du-opts button{border:0;border-radius:12px;background:var(--panel-3);color:var(--fg);font:800 14px var(--body);padding:12px 8px;cursor:pointer;touch-action:none}.du-opts .ok{background:var(--go)}.du-opts .bad{background:var(--bad)}
.du-res .du-win{display:flex;align-items:center;justify-content:center;gap:12px;margin:6px 0 10px;animation:pgPop .4s}.du-win .np-hd{width:60px;height:60px}.du-win b{display:block;font:900 24px var(--display);color:#E9B64A}.du-win span{font:700 13px var(--body);color:var(--muted)}
.du-rank{display:flex;flex-direction:column;gap:3px;max-width:360px;margin:0 auto;text-align:left}.du-rank>div{display:flex;gap:8px;font:700 14px var(--body);padding:3px 8px;border-radius:8px;background:var(--panel-2)}.du-rank>div.me{outline:2px solid var(--go)}.du-rank b{flex:1}.du-rank em{font-style:normal;font-family:var(--mono)}
.np-crown{position:absolute;left:4px;top:-8px;font-style:normal;font:900 11px var(--body);background:#E9B64A;color:#2A1E05;border-radius:999px;padding:1px 6px}.np-vote.crown{border-color:#E9B64A}
.np-lb.arm{background:var(--bad)!important;animation:npPulse .5s infinite}
.np.land .np-cams{width:min(940px,100%)}.np.land .np-camg{grid-template-columns:repeat(4,minmax(0,1fr))}
.np.land .np-course svg{max-height:calc(var(--h) - 110px);display:block;margin:0 auto;width:auto;max-width:100%}
.np.land .np-ov .np-card{padding:12px 18px}.np.land .np-card .np-big{font-size:24px;margin:2px 0}.np.land .np-card .np-faces .np-hd{width:46px;height:46px}.np.land .np-card p{margin:4px 0 8px}.np.land .np-card .btn.big{min-height:0;padding:9px 14px}
.np.land .np-adm svg{height:calc(var(--h) - 140px);width:100%;display:block;margin:0 auto}.np.land .np-cams>p{margin:2px 0 0;font-size:12px}
.np-quit{position:relative;font-size:19px!important}.np-quit.arm{background:var(--bad)!important;animation:npPulse .5s infinite}.np-quit small{position:absolute;right:-4px;bottom:-4px;background:#fff;color:#a8382a;border-radius:999px;font:900 10px var(--body);padding:1px 4px}
.np-mh{display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;margin-bottom:6px}.np-mh .np-tm{margin:0;font-size:28px}
.np-mfoot{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.np-mfoot .muted{font-size:12.5px}
.np-chat{display:flex;flex-direction:column;gap:6px;background:#1B1A18;border-radius:12px;padding:8px;min-height:0;margin-top:8px}
.np-log{overflow:auto;max-height:110px;display:flex;flex-direction:column;gap:5px;text-align:left;scroll-behavior:smooth}
.np-cm{display:flex;gap:6px;align-items:flex-start;font:600 13px/1.3 var(--body)}.np-cm.new{animation:npIn .25s ease-out}@keyframes npIn{from{transform:translateY(8px);opacity:0}}.np-cm b{display:block;font:800 11.5px var(--body);color:var(--muted)}.np-cm.me b{color:var(--go-hi)}.np-cm .np-hd.sm{width:24px;height:24px;flex:0 0 auto}.np-cemo{font-size:24px;line-height:1}
.np-c0{margin:4px 0;font-size:12.5px}
.np-qc{display:flex;flex-wrap:wrap;gap:5px;max-height:96px;overflow:auto}.np-qb{border:0;border-radius:999px;background:var(--panel-3);color:var(--fg);font:800 12px var(--body);padding:6px 10px;cursor:pointer;white-space:nowrap}.np-qb.e{font-size:18px;padding:3px 7px}.np-qb:active{transform:scale(.94)}
.np .np-ov .np-mt{width:min(920px,100%)}
.np.land .np-mt{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(220px,1fr);gap:12px;align-items:stretch;height:calc(var(--h) - 24px);max-height:calc(var(--h) - 24px);overflow:hidden!important;padding:12px}.np.land .np-ml{overflow:auto;min-height:0}.np.land .np-chat{min-height:0;overflow:hidden}.np.land .np-mt .np-log{flex:1 1 0;min-height:0}
.np.land .np-mt .np-chat{margin-top:0}.np.land .np-mt .np-log{max-height:none;flex:1}.np.land .np-mt .np-qc{max-height:118px}
.np.land .np-mt .np-vgrid{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.np.land .np-mt .np-vote{padding:4px 8px 4px 4px}.np.land .np-mt .np-vote .np-hd{width:34px;height:34px}
.np .np-ov .np-map.np-mapx{display:block!important;position:relative;width:fit-content;height:fit-content;max-width:none;max-height:none;padding:8px;overflow:visible;border-radius:14px}
.np-mapx svg{display:block;border-radius:10px}.np-mapx [data-x]{cursor:pointer}.np-mapx g.off{opacity:.45}
.np-mclose{position:absolute;right:-10px;top:-10px;z-index:2;width:36px;height:36px}
.np-mcd{position:absolute;left:14px;top:14px;z-index:2;background:rgba(20,19,17,.85);border-radius:999px;padding:3px 10px;font:800 12px var(--mono);color:var(--fg)}
.np-tbar{position:absolute;left:0;right:0;top:0;height:6px;background:rgba(255,255,255,.08);z-index:9;display:none;pointer-events:none}.np-tbar.on{display:block}
.np-tbar i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,var(--go),#E9B64A);transition:width .26s linear;box-shadow:0 0 10px rgba(143,196,88,.6)}
.np-tbar span{position:absolute;top:10px;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(20,19,17,.85);border-radius:999px;padding:3px 12px;font:800 12px var(--body);color:var(--fg);letter-spacing:.02em}
.np-ev{position:absolute;top:calc(env(safe-area-inset-top,0px) + 62px);left:50%;transform:translateX(-50%);max-width:min(420px,70%);background:#1f5560;color:#fff;border-radius:10px;padding:7px 12px;font:800 13.5px var(--body);display:none;text-align:center;box-shadow:0 0 0 2px #5AD1E0,0 6px 18px rgba(0,0,0,.4);pointer-events:none}
.np-ev.on{display:block}.np-ev.ok{background:var(--go);box-shadow:0 0 0 2px var(--go-hi)}.np-ev small{display:block;font-weight:600;opacity:.92}.np.rot .np-ev{top:62px}
.np-hold{width:100%;position:relative;overflow:hidden;background:var(--bad)!important;color:#fff!important;box-shadow:inset 0 -4px 0 #a8382a!important;touch-action:none;user-select:none;-webkit-user-select:none}
.np-hold i{position:absolute;inset:0 auto 0 0;width:0;background:rgba(255,255,255,.3);transition:width .1s}.np-hold.on i{width:100%;transition:width 1.1s linear}.np-hold span{position:relative}
.np-dbl{font:900 min(13vw,64px)/1 var(--display);color:#E2523E;text-shadow:0 0 30px rgba(226,82,62,.8),0 4px 0 #5a1e17;letter-spacing:.02em;animation:npDbl 1.8s ease-out both;transform:rotate(-6deg)}
@keyframes npDbl{0%{transform:rotate(-6deg) scale(3);opacity:0}15%{transform:rotate(-6deg) scale(.9);opacity:1}25%{transform:rotate(-6deg) scale(1.05)}80%{opacity:1}100%{opacity:0;transform:rotate(-6deg) scale(1)}}
/* ejection: out into space */
.np-eject{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#04050a;overflow:hidden;container-type:inline-size;width:auto!important}
.np-stars{position:absolute;inset:-10px;background-image:radial-gradient(2px 2px at 20px 30px,#fff,transparent),radial-gradient(1.5px 1.5px at 90px 120px,#cfd8ff,transparent),radial-gradient(1px 1px at 160px 60px,#fff,transparent),radial-gradient(2px 2px at 130px 170px,#fff,transparent),radial-gradient(1px 1px at 60px 180px,#9fb6ff,transparent);background-size:200px 200px;animation:npDrift 9s linear infinite;opacity:.9}
.np-stars.b{background-size:340px 340px;animation-duration:4s;opacity:.5}
@keyframes npDrift{to{background-position:-400px 0}}
.np-ejfig{position:absolute;top:18%;left:0;width:110px;height:140px;animation:npTumble 4.4s linear forwards}.np-ejfig svg{width:100%!important;height:100%!important}
@keyframes npTumble{from{transform:translateX(-160px) rotate(0)}to{transform:translateX(calc(100cqw + 160px)) rotate(900deg)}}
.np-ejship{position:absolute;top:20%;font-size:46px;animation:npShip 4.4s ease-in-out forwards}@keyframes npShip{from{transform:translateX(-60cqw)}to{transform:translateX(60cqw)}}
.np-type{position:relative;margin-top:22%;font:900 min(28px,calc(150cqw / var(--n))) var(--mono);color:#fff;white-space:nowrap;overflow:hidden;width:0;border-right:3px solid #fff;animation:npType calc(var(--n) * 38ms) steps(var(--n)) .5s forwards,npCaret .7s step-end infinite;max-width:96cqw}
@keyframes npType{to{width:calc(var(--n) * 1ch + 4px)}}@keyframes npCaret{50%{border-color:transparent}}
.np-left{position:relative;color:var(--muted);opacity:0;animation:pgFade .4s 1.9s forwards;font:700 15px var(--body)}
@keyframes pgFade{to{opacity:1}}
/* you got killed: a short film */
.np-death{position:relative;width:min(600px,100%);height:min(320px,calc(var(--h,100vh) - 40px));border-radius:18px;overflow:hidden;background:radial-gradient(ellipse at 50% 85%,#3a1410,#120707 70%);box-shadow:0 0 0 3px #7a1a12;animation:npShakeS .45s 1}
.np-death>div svg{width:100%!important;height:100%!important;display:block}
.np-dk,.np-dv{position:absolute;bottom:22px;width:118px;height:150px}.np-dk{left:14%;animation:npLunge2 .9s .2s ease-in-out both;z-index:2}.np-dv{left:56%;transform-origin:50% 92%}
.np-dname{position:absolute;left:14%;bottom:4px;width:118px;text-align:center;font:900 13px var(--body);color:#F07B68}
.np-dfl{position:absolute;inset:0;background:#c0281a;opacity:0;pointer-events:none;animation:npDfl 3s both;z-index:4}
@keyframes npLunge2{35%{transform:translateX(70px) scale(1.08)}60%{transform:translateX(56px)}100%{transform:translateX(66px)}}
@keyframes npDfl{0%,30%{opacity:0}34%{opacity:.6}45%{opacity:0}58%{opacity:.4}72%{opacity:0}}
@keyframes npShakeS{20%{transform:translate(-6px,3px)}40%{transform:translate(6px,-3px)}60%{transform:translate(-4px,2px)}80%{transform:translate(3px,-2px)}}
@keyframes npFall{to{transform:rotate(88deg) translate(-58px,-24px);filter:grayscale(.6) brightness(.7)}}
.v-stab .np-knife{position:absolute;left:51%;bottom:84px;font-size:54px;z-index:3;animation:npStab .28s .55s 5 both}
@keyframes npStab{0%{transform:translateX(-34px) rotate(-30deg)}55%{transform:translateX(16px) rotate(-30deg)}100%{transform:translateX(-34px) rotate(-30deg)}}
.v-stab .np-dv{animation:npJolt .28s .6s 5,npFall .5s 2.1s forwards}@keyframes npJolt{50%{transform:translateX(9px) rotate(5deg)}}
.v-head .np-dv{clip-path:inset(40% 0 0 0);animation:npFall .6s 1.7s forwards}
.v-head .np-head{position:absolute;left:calc(56% + 19px);bottom:112px;width:80px;height:80px;z-index:3;animation:npHeadOff 1.7s .6s cubic-bezier(.3,.7,.6,1) both}.v-head .np-head svg{width:100%!important;height:100%!important}
@keyframes npHeadOff{40%{transform:translate(70px,-120px) rotate(280deg)}100%{transform:translate(130px,40px) rotate(640deg)}}
.v-head .np-cut{position:absolute;left:48%;bottom:148px;width:170px;height:6px;background:#fff;box-shadow:0 0 14px #fff;transform:scaleX(0) rotate(-12deg);animation:npCut .3s .55s forwards;z-index:4}
@keyframes npCut{60%{transform:scaleX(1) rotate(-12deg);opacity:1}100%{transform:scaleX(1) rotate(-12deg);opacity:0}}
.np-fount{position:absolute;left:calc(56% + 56px);bottom:150px;width:1px;height:1px;z-index:3}.np-fount b{position:absolute;width:10px;height:10px;border-radius:50%;background:#b0261a;opacity:0;animation:npFount .9s both}
@keyframes npFount{0%{opacity:1;transform:none}70%{opacity:1}100%{opacity:0;transform:translate(var(--x),var(--y)) scale(.6)}}
.v-chess .np-queen{position:absolute;left:calc(56% - 14px);bottom:16px;width:150px;height:150px;background-size:contain;background-repeat:no-repeat;background-position:center bottom;transform:translateY(-460px);animation:npDrop .42s .7s cubic-bezier(.6,0,1,1) forwards;z-index:3}
@keyframes npDrop{to{transform:translateY(0)}}
.v-chess .np-dv{animation:npSquash .18s 1.1s forwards}@keyframes npSquash{to{transform:scaleY(.16) scaleX(1.6);filter:grayscale(.6) brightness(.7)}}
.np-death.v-chess{animation:npShakeS .45s 1.12s}
.v-shot .np-dk{animation:none}.v-shot .np-gun{position:absolute;left:calc(14% + 96px);bottom:96px;font-size:46px;z-index:3;transform:scaleX(-1);animation:npRecoil .3s 1s}
@keyframes npRecoil{40%{transform:scaleX(-1) translateX(14px) rotate(-18deg)}}
.v-shot .np-muzzle{position:absolute;left:calc(14% + 146px);bottom:104px;width:44px;height:44px;border-radius:50%;background:radial-gradient(#fff,#ffd36b 40%,transparent 70%);opacity:0;animation:npMuz .3s 1s;z-index:3}
@keyframes npMuz{0%{opacity:1;transform:scale(.4)}100%{opacity:0;transform:scale(2.6)}}
.v-shot .np-bang{position:absolute;left:38%;top:12%;font:900 50px var(--display);color:#FFD36B;-webkit-text-stroke:2px #7a1a12;opacity:0;transform:rotate(-8deg) scale(.3);animation:npBang .5s 1s forwards;z-index:5}
@keyframes npBang{50%{opacity:1;transform:rotate(-8deg) scale(1.25)}100%{opacity:1;transform:rotate(-8deg) scale(1)}}
.v-shot .np-dv{animation:npBlown .7s 1.05s cubic-bezier(.2,.8,.4,1) forwards}@keyframes npBlown{to{transform:translateX(50px) rotate(95deg) translate(-58px,-10px);filter:grayscale(.6) brightness(.7)}}
.v-bite .np-dk{animation:npGrow 1.3s .3s ease-in forwards;z-index:3}
@keyframes npGrow{60%{transform:translateX(120px) scale(1.8)}100%{transform:translate(150px,70px) scale(4.6);filter:brightness(.25)}}
.np-death.v-bite::after{content:"";position:absolute;inset:0;background:#000;opacity:0;animation:npBlack .35s 1.45s forwards;z-index:3}@keyframes npBlack{to{opacity:.92}}
.v-bite .np-chomp{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:900 64px var(--display);color:#E2523E;opacity:0;animation:npBang .5s 1.5s forwards;z-index:5}
.v-bite .np-bones{position:absolute;left:44%;top:-50px;font-size:42px;z-index:5;opacity:0;animation:npBones 1s 1.9s forwards}.v-bite .np-bones.b{left:58%;animation-delay:2.1s}
@keyframes npBones{0%{opacity:1;transform:translateY(0) rotate(0)}100%{opacity:1;transform:translateY(250px) rotate(220deg)}}
.np-mapb.imp{background:#5a1e17!important;color:#FFD9D2}.np-mapb b{font-size:18px}
.np-code{display:flex;flex-direction:column;align-items:center;gap:10px}.np-note{background:#F3E39A;color:#3a2f10;padding:8px 14px;border-radius:4px;transform:rotate(-3deg);font:800 12px var(--body);text-align:center;box-shadow:0 4px 10px rgba(0,0,0,.4)}.np-note b{display:block;font:900 28px var(--mono);letter-spacing:.12em}
.np-disp{font:900 32px var(--mono);letter-spacing:.3em;background:#0B0C12;color:#8FC458;border-radius:10px;padding:6px 16px}.np-disp.bad{color:var(--bad);animation:npShake .3s}
.np-key{width:min(260px,100%)}.np-key button{height:52px;font-size:22px}.np-cl{display:flex;flex-direction:column;align-items:center;gap:10px}
.np.land .np-code{flex-direction:row;justify-content:center;gap:22px}.np.land .np-key button{height:calc((var(--h) - 190px) / 4);min-height:36px;max-height:52px}
.np-mg,.np-map{max-height:calc(var(--h,100vh) - 20px);overflow:auto}.np-map svg{max-height:calc(var(--h,100vh) * .5);width:auto!important;max-width:100%;margin-left:auto!important;margin-right:auto!important}
.np.land .np-map{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:0 14px;align-items:center;width:min(860px,100%)}.np.land .np-map>.np-k{grid-column:1/-1}.np.land .np-map svg{max-height:calc(var(--h) - 120px)}.np.land .np-mside .btn{padding:5px 9px;font-size:13px;min-height:0;height:auto}.np.land .np-mside .np-k{margin:4px 0!important;font-size:11px}.np.land .np-mside .np-doors,.np.land .np-mside .np-sab{gap:5px;margin-bottom:4px}.np-mside{display:flex;flex-direction:column;align-items:center}.np-mside .np-sab{flex-wrap:wrap}
.np.land .np-vit{grid-template-columns:repeat(auto-fill,minmax(104px,1fr))}.np.land .np-vit .np-hd{width:34px;height:34px}
@keyframes npShake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.np-tune{display:flex;flex-direction:column;align-items:center;gap:10px}.np-tune svg{width:min(320px,100%);background:#0B0C12;border-radius:12px}.np-tune input{width:min(300px,100%);accent-color:var(--go)}
.np-vit{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}.np-vit>div{display:flex;flex-direction:column;align-items:center;gap:2px;background:#0c1a0c;border-radius:12px;padding:8px}.np-vit>div.dead{background:#2a0f0b}.np-vit b{font:800 13px var(--body)}.np-vit svg{width:100%;height:24px}.np-vit small{font:900 11px var(--mono);color:#8FC458}.np-vit .dead small{color:var(--bad)}
.np-static{height:180px;border-radius:12px;background:repeating-linear-gradient(0deg,#222 0 2px,#555 2px 3px,#111 3px 5px);background-size:100% 7px;animation:npStatic .12s steps(3) infinite}
@keyframes npStatic{to{background-position:0 7px}}
.np-drips{position:absolute;left:0;right:0;top:0;height:100%;pointer-events:none}.np-drips b{position:absolute;top:-4px;height:0;background:linear-gradient(#7a1a12,#a82a1e);border-radius:0 0 8px 8px;animation:npDrip 1.6s var(--d) ease-in forwards;opacity:.9}
@keyframes npDrip{to{height:var(--h)}}
.np-ov{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(6,7,12,.72);padding:16px;z-index:5}
.np-ov.on{display:flex}
.np-lob{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 10px);transform:translateX(-50%);display:none;gap:8px;align-items:center;background:rgba(33,31,28,.88);border-radius:14px;padding:8px;box-shadow:0 8px 20px rgba(0,0,0,.45)}
.np.lob .np-lob{display:flex}.np.lob .np-top,.np.lob .np-tasks,.np.lob .np-btns{display:none}.np.rot .np-lob{top:10px}
.np-lobc{display:flex;flex-direction:column;align-items:center;padding:0 8px;line-height:1.1}.np-lobc b{font:900 20px var(--mono);letter-spacing:.12em}.np-lobc span{font:800 11px var(--body);color:var(--muted)}
.np-lb{display:flex;flex-direction:column;align-items:center;gap:2px;border:0;border-radius:10px;background:var(--panel-3);color:var(--fg);padding:6px 10px;font-size:20px;cursor:pointer;box-shadow:inset 0 -3px 0 rgba(0,0,0,.3)}
.np-lb span{font:800 10.5px var(--body);text-transform:uppercase;letter-spacing:.04em}.np-lb.go{background:var(--go);box-shadow:inset 0 -3px 0 var(--go-deep)}.np-lb[disabled]{opacity:.5}
.np-wait{font:700 12px var(--body);color:var(--muted);padding:0 6px;max-width:110px}
.np-mapb{width:auto!important;padding:0 12px;gap:6px}.np-mapb span{font:900 12px var(--body);letter-spacing:.06em;text-transform:uppercase}
.np-role{text-align:center;width:100%;animation:npRole .9s ease-out}.np-role .np-k{color:#9fb6ff}.np-role.imp .np-k{color:#F07B68}
.np-rbig{font:900 min(16vw,86px)/1 var(--display);color:#8ab4ff;letter-spacing:-.02em;text-shadow:0 0 30px rgba(90,140,255,.45);margin:6px 0 14px}
.np-role.imp .np-rbig{color:#E2523E;text-shadow:0 0 34px rgba(226,82,62,.6)}
.np-lineup{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}.np-lineup>span{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;opacity:.8}.np-lineup>span.me{opacity:1;transform:scale(1.15)}.np-lineup .np-hd{width:54px;height:54px}
.np-role p{color:var(--muted)}
@keyframes npRole{0%{opacity:0;transform:scale(1.3);filter:blur(6px)}100%{opacity:1;transform:none;filter:none}}
.np-killed{position:relative;text-align:center;width:min(440px,100%);background:#1a0c0a;border:2px solid var(--bad);border-radius:16px;padding:22px;overflow:hidden;animation:pgPop .3s}
.np-kface{width:120px;height:120px;margin:0 auto;border-radius:50%;overflow:hidden;background:#3a1d18;animation:npLunge .5s ease-out}
.np-kface .avatar{width:100%!important;height:100%!important}
@keyframes npLunge{0%{transform:scale(.4) translateY(40px)}70%{transform:scale(1.15)}100%{transform:none}}
.np-slash{position:absolute;left:-10%;top:30%;width:120%;height:10px;background:linear-gradient(90deg,transparent,#fff 40%,#fff 60%,transparent);transform:rotate(-24deg) scaleX(0);animation:npSlash .35s .35s ease-out forwards;box-shadow:0 0 16px #fff}
@keyframes npSlash{0%{transform:rotate(-24deg) scaleX(0)}60%{transform:rotate(-24deg) scaleX(1);opacity:1}100%{transform:rotate(-24deg) scaleX(1);opacity:0}}
.np-splat{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 30% 35%,rgba(168,42,30,.85) 0 14%,transparent 15%),radial-gradient(circle at 62% 28%,rgba(168,42,30,.75) 0 7%,transparent 8%),radial-gradient(circle at 70% 55%,rgba(168,42,30,.7) 0 10%,transparent 11%),radial-gradient(circle at 22% 62%,rgba(168,42,30,.6) 0 5%,transparent 6%);opacity:0;animation:npSplat .4s .6s forwards}
@keyframes npSplat{to{opacity:.85}}
.np-killed .np-big,.np-killed p,.np-killed button{position:relative}
.np-banner{width:100%;text-align:center;padding:26px 10px;background:repeating-linear-gradient(-45deg,#3a1d18 0 22px,#2a1411 22px 44px);border-top:4px solid var(--warn);border-bottom:4px solid var(--warn);animation:npBan .5s ease-out}
.np-banner.body{border-color:var(--bad)}.np-banner div{font-size:60px}.np-banner b{display:block;font:900 min(9vw,48px)/1.05 var(--display);text-transform:uppercase;letter-spacing:.02em}.np-banner span{color:var(--muted);font-weight:700}
@keyframes npBan{0%{transform:scaleY(0)}100%{transform:none}}
.np-ov.still .np-card,.np-ov.still .np-meet,.np-ov.still .np-map{animation:none}
.np-hd svg{width:100%!important;height:100%!important;display:block}
.np-card,.np-meet,.np-map{background:var(--panel);border-radius:16px;padding:20px;width:min(440px,100%);max-height:100%;overflow:auto;text-align:center;box-shadow:0 14px 40px rgba(0,0,0,.6);animation:pgPop .3s}
.np-card.imp{background:#3a1d18;border:2px solid var(--bad)}
.np-k{font:800 12px var(--body);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.np-big{font:900 30px/1.15 var(--display);margin:6px 0}
.np-card p,.np-eject p{color:var(--muted);margin:6px 0 12px}
.np-face .avatar,.np-hd .avatar{display:block}
.np-face{width:90px;height:90px;margin:0 auto;border-radius:50%;overflow:hidden;background:var(--panel-2)}
.np-tm{font:700 34px var(--mono);margin:6px auto 10px;background:#1B1A18;border-radius:10px;padding:2px 14px;display:inline-block}
.np-vgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:10px}
@media (orientation:landscape){.np-vgrid{grid-template-columns:repeat(3,minmax(0,1fr))}.np-meet{width:min(640px,100%)}}
.np-vote{display:flex;align-items:center;gap:8px;padding:6px 10px 6px 6px;border-radius:12px;border:2px solid transparent;background:var(--panel-2);color:var(--fg);font:800 14px var(--body);cursor:pointer;position:relative;text-align:left;min-width:0}
.np-vote b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.np-vote.sel{border-color:var(--go-hi);background:rgba(127,178,74,.25)}.np-vote.dead{opacity:.35}.np-vote i{position:absolute;right:8px;top:6px;font-style:normal;color:var(--go-hi);font-weight:900}
.np-hd{width:44px;height:44px;border-radius:50%;overflow:hidden;background:var(--panel-3);flex:0 0 auto;display:inline-block}
.np-faces{display:flex;justify-content:center;gap:14px;margin:8px 0}.np-faces>span{display:flex;flex-direction:column;align-items:center;gap:4px}.np-faces .np-hd{width:64px;height:64px}
.np-eject{text-align:center;width:100%}.np-float{width:110px;height:110px;margin:0 auto 14px;border-radius:50%;overflow:hidden;background:var(--panel-2);animation:npFloat 6s linear forwards}
@keyframes npFloat{0%{transform:translateX(-60vw) rotate(0)}100%{transform:translateX(60vw) rotate(720deg)}}
.np-map svg{display:block;margin:8px 0;border-radius:10px;background:#0B0C12}.np-sab{display:flex;gap:8px;justify-content:center;align-items:center;margin-bottom:8px}
.np-mini{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(6,7,12,.6);padding:16px;z-index:6}.np-mini.on{display:flex}
.np-mg{background:var(--panel);border-radius:16px;padding:14px;width:min(380px,100%);max-height:calc(100dvh - 24px);overflow:auto;box-shadow:0 14px 40px rgba(0,0,0,.6);animation:pgPop .25s;transition:transform .3s,box-shadow .3s}
.np-mg.ok{box-shadow:0 0 0 4px var(--go-hi),0 14px 40px rgba(0,0,0,.6)}
.np-mgh{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font:900 18px var(--display)}
.np-x{width:36px;height:36px;border-radius:50%;border:0;background:var(--panel-3);color:var(--fg);font:900 20px var(--body);cursor:pointer}
.np-mgb{text-align:center}.np-mgb .muted{margin:8px 0 0}
.np-wires{position:relative;height:240px;background:#1B1A18;border-radius:12px;touch-action:none}.np-wires svg{position:absolute;inset:0;width:100%;height:100%}
.np-wires i{position:absolute;width:36px;height:44px;border-radius:8px;cursor:pointer}.np-wires .l{left:8px}.np-wires .r{right:8px}
.np-up{display:flex;flex-direction:column;gap:12px;align-items:center}.np-up-ic{font-size:40px}.np-up .bar{width:100%;height:16px}
.np-hand{width:120px;height:120px;border-radius:24px;background:var(--panel-2);font-size:60px;display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:none;box-shadow:inset 0 -5px 0 rgba(0,0,0,.3)}.np-hand.on{background:var(--go)}
.np-scan{position:relative;width:120px;height:150px;border-radius:14px;background:#1B1A18;font-size:80px;display:flex;align-items:center;justify-content:center;overflow:hidden}.np-scan i{position:absolute;left:0;right:0;height:6px;background:var(--go-hi);box-shadow:0 0 14px var(--go-hi);animation:npScan 1.2s ease-in-out infinite alternate}
@keyframes npScan{0%{top:6px}100%{top:138px}}
.np-sw{display:flex;gap:10px;justify-content:center}.np-sw button{width:50px;height:110px;border-radius:12px;border:0;background:#1B1A18;position:relative;cursor:pointer}.np-sw button i{position:absolute;left:6px;right:6px;height:44px;border-radius:9px;background:#5f5955;bottom:6px;transition:bottom .15s,background .15s}.np-sw button.on i{bottom:60px;background:var(--go)}
.np-num{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.np-num button{height:70px;border-radius:12px;border:0;background:var(--panel-3);color:var(--fg);font:900 26px var(--display);cursor:pointer;box-shadow:inset 0 -4px 0 rgba(0,0,0,.3)}.np-num button.ok{background:var(--go)}
.np-course svg{width:100%;background:#0B0C12;border-radius:12px}
.np-swipe .track{height:90px;border-radius:14px;background:#1B1A18;position:relative;padding:8px;box-shadow:inset 0 3px 8px rgba(0,0,0,.5)}.np-swipe .card{position:absolute;left:8px;top:8px;width:110px;height:74px;border-radius:10px;background:#F4F2EE;font-size:44px;display:flex;align-items:center;justify-content:center;font-style:normal;cursor:grab;touch-action:none}
.np-cboard{display:grid;grid-template-columns:repeat(8,1fr);border-radius:6px;overflow:hidden;width:min(100%,calc(100dvh - 130px));margin:0 auto;aspect-ratio:1}.np-cboard .sq{position:relative;cursor:pointer}.np-cboard .sq.l{background:var(--sq-l)}.np-cboard .sq.d{background:var(--sq-d)}.np-cboard .sq.sel{box-shadow:inset 0 0 0 100px var(--hl-sel)}
.np-pc{position:absolute!important;inset:0;width:100%!important;height:100%!important;transform:none!important;pointer-events:none}
.np.ghost .np-cv{filter:saturate(.6)}
.np::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle,rgba(226,82,62,0) 30%,rgba(226,82,62,.75));opacity:0}
.np.flash::after{animation:npFlash .7s ease-out}
@keyframes npFlash{0%{opacity:1}100%{opacity:0}}
.np-doors{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:6px 0 10px}
.np-cams{width:min(640px,100%)}.np-camg{display:grid;grid-template-columns:1fr 1fr;gap:8px}.np-camg>div{position:relative;border-radius:10px;overflow:hidden;background:#0B0C12}
.np-camg canvas{width:100%;height:auto;display:block}.np-camg span{position:absolute;left:8px;top:6px;font:800 11px var(--body);color:#F07B68;letter-spacing:.06em;text-shadow:0 1px 2px #000}
.np-adm svg{width:100%;height:auto;display:block;border-radius:10px;background:#0B0C12}
.np-vr{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:12px;background:var(--panel-2);text-align:left;min-width:0;flex-wrap:wrap}
.np-vr b{font:800 14px var(--body);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.np-vr.out{box-shadow:0 0 0 2px var(--bad)}.np-vr.dead{opacity:.4}
.np-vh{display:flex;flex-wrap:wrap;gap:2px;width:100%}.np-hd.sm{width:22px;height:22px}
.np-skip{display:inline-flex!important;align-items:center;justify-content:center;font-size:20px}
.np-ast{position:relative;height:230px;border-radius:12px;background:radial-gradient(circle at 30% 40%,#1e2033,#0B0C12);overflow:hidden}
.np-ast-n{position:absolute;left:10px;top:8px;font:900 15px var(--body);color:var(--go-hi)}
.np-rock{position:absolute;left:100%;border:0;background:none;font-size:34px;cursor:pointer;animation:npRock 3s linear forwards;padding:6px}
@keyframes npRock{to{left:-60px;transform:rotate(-360deg)}}
.np-trash{display:flex;gap:16px;justify-content:center;align-items:stretch;height:200px}
.np-bin{width:110px;border-radius:12px;background:#1B1A18;position:relative;overflow:hidden;border:3px solid #4a4640}.np-bin i{position:absolute;left:0;right:0;bottom:0;height:100%;background:linear-gradient(#8c7a55,#5a4b33);transition:height .1s}
.np-lever{width:46px;border-radius:23px;background:#1B1A18;position:relative;padding:4px}.np-lever b{display:block;width:38px;height:56px;border-radius:19px;background:var(--bad);box-shadow:inset 0 -4px 0 rgba(0,0,0,.3);cursor:grab;touch-action:none}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  /* in the Games list: online only */
  PG.add({id: "natposter", icon: "spy", name: ["Natposter", "Natposter"], tag: ["New", "Neu", "bad"], sub: ["Space station. Tasks. One of you is a traitor.", "Raumstation. Aufgaben. Einer von euch ist ein Verräter."], meta: ["4–15 players · own phones", "4–15 Spieler · eigene Handys"],
    mount(ctx){
      ctx.body.innerHTML = `<div class="pg-np pg-np-hero"><span class="pg-np-stars"></span><span class="pg-np-ship">🚀</span><h1 class="h-title" style="position:relative;color:#fff">Natposter</h1><p style="position:relative">${T("Space station. Tasks. One of you is a traitor.", "Raumstation. Aufgaben. Einer von euch ist ein Verräter.")}</p></div>
        <div class="tiles" style="margin-top:12px"><button class="tile" data-np="solo" style="border:1px solid var(--go)"><span class="pg-art" style="--ac:#7B5CD6;background:#7B5CD6">🤖</span><h3>${T("Practice", "Üben")}</h3><p>${T("Just you and bots. Starts right away.", "Nur du und Bots. Geht sofort los.")}</p></button>
          <button class="tile" data-np="friends"><span class="pg-art" style="background:var(--go)">📱</span><h3>${T("With friends", "Mit Freunden")}</h3><p>${T("Everyone on their own phone.", "Jeder am eigenen Handy.")}</p></button></div>`;
      ctx.body.querySelector('[data-np="solo"]').onclick = () => App.go("lobby", {practice: "natposter", opts: {bots: 5}});
      ctx.body.querySelector('[data-np="friends"]').onclick = () => App.go("lobby", PNet.P && PNet.P.isHost && !PNet.P.solo ? undefined : {host: true, game: "natposter"});
    }});
})();
