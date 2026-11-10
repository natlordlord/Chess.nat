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
    {id: "as", room: "bri", x: 2150, y: 640, g: "numbers", de: "Systeme prüfen", en: "Run checks"}, {id: "dl", room: "lab", x: 1460, y: 1300, g: "upload", de: "Daten laden", en: "Download data"}];
  const FIX = {lights: {x: 650, y: 1410, g: "switches"}, ra: {x: 100, y: 650, g: "hold"}, rb: {x: 380, y: 650, g: "hold"}};
  const BTN = {x: 1280, y: 340};
  const VIS = {crew: 340, dark: 125, imp: 470};
  const SPEED = 270, KILL_R = 115, USE_R = 95, REPORT_R = 150, VENT_R = 75;
  const roomAt = (x, y) => ROOMS.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  const inA = (x, y) => AREAS.some(a => x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h);
  const walk = (x, y) => inA(x - RAD, y) && inA(x + RAD, y) && inA(x, y - RAD) && inA(x, y + RAD + 6) && inA(x - RAD * .7, y + RAD * .7) && inA(x + RAD * .7, y + RAD * .7);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const RN = r => T(r.en, r.de);
  const spawnAt = (i, n) => { const a = i / Math.max(1, n) * Math.PI * 2 - Math.PI / 2; return {x: Math.round(BTN.x + Math.cos(a) * 150), y: Math.round(BTN.y + 20 + Math.sin(a) * 120)}; };

  /* positions of everyone, fed by "mv" messages and by this phone's own movement */
  const POS = {};
  PG.onMv = m => { if (!m || !m.id) return; const p = POS[m.id] || (POS[m.id] = {x: m.x, y: m.y, dx: m.x, dy: m.y}); p.x = +m.x || 0; p.y = +m.y || 0; p.g = !!m.g; p.v = !!m.v; p.f = m.f || 1; p.t = now(); p.mv = !!m.m; };

  /* ---------------- the host's game ---------------- */
  PG.online.natposter = {min: 4, max: 15, note: ["Like the space classic: crew does tasks, the Natposter kills in secret. Everyone walks around on their own phone.", "Wie der Weltraum-Klassiker: Die Crew löst Aufgaben, der Natposter tötet heimlich. Jeder läuft auf seinem eigenen Handy herum."],
    opts: [{k: "imps", l: ["Natposters", "Natposter"], d: "auto", c: [["auto", "Auto"], [1, "1"], [2, "2"], [3, "3"]]},
      {k: "cd", l: ["Kill cooldown", "Kill-Abklingzeit"], d: 30, c: [[20, "20 s"], [30, "30 s"], [45, "45 s"]]},
      {k: "tasks", l: ["Tasks each", "Aufgaben pro Person"], d: 5, c: [[3, "3"], [5, "5"], [7, "7"]]},
      {k: "meet", l: ["Meeting time", "Meeting-Zeit"], d: 90, c: [[60, "60 s"], [90, "90 s"], [120, "120 s"]]},
      {k: "conf", l: ["Reveal ejected role", "Rolle beim Rauswurf zeigen"], d: 1, c: [[1, ["Yes", "Ja"]], [0, ["No", "Nein"]]]}],
    start(G){
      const n = G.ids.length, o = G.opts, k = o.imps === "auto" ? (n <= 6 ? 1 : n <= 10 ? 2 : 3) : Math.min(+o.imps, Math.max(1, Math.floor((n - 1) / 2)));
      const imps = PG.shuffle(G.ids).slice(0, k), s = G.s = {phase: "play", round: ((G.s && G.s.round) || 0) + 1, imps, alive: {}, tasks: {}, done: {}, bodies: [], killAt: {}, emer: {}, sab: null, sabAt: now() + 15000, mc: 0, spawnK: 1, log: []};
      G.ids.forEach((id, i) => { s.alive[id] = true; s.done[id] = {}; s.emer[id] = 1; s.killAt[id] = now() + 12000;
        s.tasks[id] = PG.shuffle(TASKS.map(t => t.id)).slice(0, o.tasks); const sp = spawnAt(i, n); POS[id] = Object.assign(POS[id] || {}, sp, {g: false, v: false}); });
      s.spawn = Object.fromEntries(G.ids.map((id, i) => [id, spawnAt(i, n)]));
      s.intro = now() + 5000; s.snd = {k: "s" + (++G.sk), n: "reveal"};
    },
    crewIds(G){ return G.ids.filter(id => !G.s.imps.includes(id)); },
    prog(G){ const s = G.s, c = this.crewIds(G); let tot = 0, d = 0; c.forEach(id => { tot += s.tasks[id].length; d += s.tasks[id].filter(t => s.done[id][t]).length; }); return {tot, d}; },
    win(G){ const s = G.s; if (s.phase === "end") return true;
      const A = G.ids.filter(id => s.alive[id]), I = A.filter(id => s.imps.includes(id)).length, C = A.length - I, p = this.prog(G);
      let w = null; if (I === 0) w = "crew"; else if (p.tot && p.d >= p.tot) w = "tasks"; else if (I >= C) w = "imp";
      if (!w) return false; s.phase = "end"; s.win = w; s.sab = null; G.sk++; s.snd = {k: "s" + G.sk, n: w === "imp" ? "lose" : "cheer"}; return true; },
    meeting(G, by, body){ const s = G.s; s.phase = "meet"; s.mc++; s.meet = {by, body, until: now() + G.opts.meet * 1000, votes: {}, start: now()}; if (s.sab && s.sab.type === "lights") {} G.sk++; s.snd = {k: "s" + G.sk, n: "meet"}; },
    tally(G){ const s = G.s, c = {}; Object.values(s.meet.votes).forEach(v => { c[v] = (c[v] || 0) + 1; });
      const top = Object.entries(c).filter(([k]) => k !== "skip").sort((a, b) => b[1] - a[1]); const skip = c.skip || 0;
      const out = top.length && top[0][1] > skip && !(top[1] && top[1][1] === top[0][1]) ? top[0][0] : null;
      s.lastVotes = Object.assign({}, s.meet.votes); s.eject = {id: out, imp: out ? s.imps.includes(out) : false, until: now() + 6500, left: out ? s.imps.filter(x => s.alive[x] && x !== out).length : s.imps.filter(x => s.alive[x]).length};
      if (out) s.alive[out] = false; s.phase = "eject"; s.meet = null; G.sk++; s.snd = {k: "s" + G.sk, n: "eject"}; },
    resume(G){ const s = G.s; s.bodies = []; s.spawnK++; const A = G.ids; s.spawn = Object.fromEntries(A.map((id, i) => [id, spawnAt(i, A.length)])); A.forEach(id => { Object.assign(POS[id] || (POS[id] = {}), s.spawn[id]); s.killAt[id] = now() + G.opts.cd * 1000; });
      if (s.sab && s.sab.type === "reactor") s.sab = null; s.sabAt = Math.max(s.sabAt, now() + 10000); s.phase = "play"; if (!this.win(G)) {} },
    tick(G){ const s = G.s; let ch = false;
      if (s.phase === "play" && s.sab && s.sab.type === "reactor" && now() >= s.sab.until){ s.phase = "end"; s.win = "boom"; s.sab = null; G.sk++; s.snd = {k: "s" + G.sk, n: "lose"}; ch = true; }
      if (s.phase === "meet" && (now() >= s.meet.until || G.ids.filter(id => s.alive[id]).every(id => s.meet.votes[id]))){ this.tally(G); ch = true; }
      if (s.phase === "eject" && now() >= s.eject.until){ s.eject = null; this.resume(G); this.win(G); ch = true; }
      return ch || s.phase === "meet" || s.phase === "eject" || (s.phase === "play" && (!!s.sab || now() < s.intro)); },
    act(G, id, a, api){ const s = G.s, me = POS[id] || {x: 0, y: 0}, alive = s.alive[id], imp = s.imps.includes(id);
      if (a.a === "again" && id === G.host && s.phase === "end"){ this.start(G); return; }
      if (s.phase === "meet" && a.a === "vote" && alive && !s.meet.votes[id] && (a.v === "skip" || s.alive[a.v])){ s.meet.votes[id] = a.v; return; }
      if (s.phase !== "play" || now() < s.intro) return;
      if (a.a === "kill" && imp && alive && now() >= s.killAt[id] && !me.v){ const t = a.v, tp = POS[t];
        if (!t || !s.alive[t] || s.imps.includes(t) || !tp || dist(me, tp) > KILL_R * 1.35) return;
        s.alive[t] = false; s.bodies.push({id: t, x: Math.round(tp.x), y: Math.round(tp.y)}); s.killAt[id] = now() + G.opts.cd * 1000; s.log.push([now(), id, t]);
        s.killed = s.killed || {}; s.killed[t] = {by: id, k: ++G.sk}; s.ps = s.ps || {}; s.ps[id] = {k: "p" + (++G.sk), n: "kill"}; s.ps[t] = {k: "p" + (++G.sk), n: "died"}; this.win(G); return; }
      if (a.a === "report" && alive){ const b = s.bodies.find(x => x.id === a.v); if (!b || dist(me, b) > REPORT_R * 1.35) return; this.meeting(G, id, a.v); return; }
      if (a.a === "button" && alive && s.emer[id] > 0 && dist(me, BTN) < USE_R * 1.8 && !(s.sab && s.sab.type === "reactor")){ s.emer[id]--; this.meeting(G, id, null); return; }
      if (a.a === "task" && !imp && s.tasks[id].includes(a.v) && !s.done[id][a.v]){ s.done[id][a.v] = 1; this.win(G); return; }
      if (a.a === "sab" && imp && !s.sab && now() >= s.sabAt && ["lights", "reactor"].includes(a.v)){ s.sab = {type: a.v, until: a.v === "reactor" ? now() + 45000 : 0, ra: 0, rb: 0}; s.sabAt = now() + 35000; G.sk++; s.snd = {k: "s" + G.sk, n: a.v === "lights" ? "dark" : "alarm"}; return; }
      if (a.a === "fix" && s.sab){ if (s.sab.type === "lights" && a.v === "lights"){ s.sab = null; G.sk++; s.snd = {k: "s" + G.sk, n: "light"}; }
        else if (s.sab.type === "reactor" && (a.v === "ra" || a.v === "rb")){ s.sab[a.v] = 1; if (s.sab.ra && s.sab.rb){ s.sab = null; G.sk++; s.snd = {k: "s" + G.sk, n: "fixed"}; } } return; }
    },
    view(G, id, api){ const s = G.s, imp = s.imps.includes(id), p = this.prog(G);
      return {custom: "np", k: "np" + s.round, phase: s.phase, round: s.round, alive: !!s.alive[id], imp, mates: imp ? s.imps : [], tasks: imp ? [] : s.tasks[id].map(t => [t, !!s.done[id][t]]),
        fake: imp ? s.tasks[id] : [], prog: p.tot ? p.d / p.tot : 0, bodies: s.bodies, kill: imp ? Math.max(0, s.killAt[id] - now()) : 0, emer: s.emer[id], intro: Math.max(0, s.intro - now()),
        sab: s.sab ? {type: s.sab.type, left: s.sab.until ? Math.max(0, s.sab.until - now()) : 0, ra: s.sab.ra, rb: s.sab.rb} : null, sabCd: imp ? Math.max(0, s.sabAt - now()) : 0,
        meet: s.meet ? {by: s.meet.by, body: s.meet.body, left: Math.max(0, s.meet.until - now()), voted: Object.keys(s.meet.votes), my: s.meet.votes[id] || null} : null,
        eject: s.eject ? {id: s.eject.id, imp: s.eject.imp, conf: !!G.opts.conf, left: s.eject.left, votes: s.lastVotes} : null,
        deadList: G.ids.filter(x => !s.alive[x]), killedBy: s.killed && s.killed[id] ? s.killed[id] : null,
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

  const NP = {el: null, v: null, m: null, act: null, raf: 0, me: {x: BTN.x, y: BTN.y + 150, f: 1}, joy: null, keys: {}, sent: 0, lastSend: {}, mini: null, vent: null, spawnK: 0, shown: {}, sndK: null, lastStep: 0, zoom: 1, mapOpen: false,
    draw(body, v, m, act){
      this.v = v; this.m = m; this.act = act; const t = now();
      this.ends = {kill: t + (v.kill || 0), meet: v.meet ? t + v.meet.left : 0, sab: v.sab && v.sab.left ? t + v.sab.left : 0, sabCd: t + (v.sabCd || 0)};
      if (v.round !== this.introRound){ this.introRound = v.round; this.introEnd = t + (v.intro || 0); }
      if (!this.el || !this.el.isConnected) this.mount();
      if (v.spawn && v.spawn.k !== this.spawnK){ this.spawnK = v.spawn.k; this.me.x = v.spawn.x; this.me.y = v.spawn.y; this.vent = null; this.closeMini(); this.send(true); }
      if (v.snd && v.snd.k !== this.sndK){ this.sndK = v.snd.k; this.sound(v.snd.n); }
      this.hud();
    },
    stop(){ cancelAnimationFrame(this.raf); this.raf = 0; if (this.el) this.el.remove(); this.el = null; document.documentElement.classList.remove("np-on"); window.removeEventListener("keydown", this.kd); window.removeEventListener("keyup", this.ku); window.removeEventListener("resize", this.rs); },
    sound(n){ const fx = Sound.fx && Sound.fx();
      if (n === "kill"){ Sound.play("Capture", 1); Haptic.go([60, 40, 60]); }
      else if (n === "died"){ Sound.play("Capture", 1); Sound.play("Defeat", .6); Haptic.go([200, 80, 300]); }
      else if (n === "meet"){ if (fx){ [0, .32, .64].forEach(t => { Sound.note(76, t, .25, .12, "pluck"); Sound.note(72, t + .16, .25, .12, "pluck"); }); } Haptic.go([80, 60, 80, 60, 80]); }
      else if (n === "eject"){ if (fx) Sound.air(0, 1.4, 900, 120, .12, .8); }
      else if (n === "alarm"){ if (fx) [0, .5, 1, 1.5].forEach(t => Sound.note(81, t, .3, .1, "pluck")); Haptic.go([100, 100, 100, 100, 100]); }
      else if (n === "dark"){ if (fx) Sound.air(0, .6, 1200, 80, .1, 1); Haptic.go(60); }
      else if (n === "light" || n === "fixed"){ Sound.right ? Sound.right() : Sound.play("Move"); }
      else if (n === "cheer"){ PG.cheer(4); Sound.play("Victory", .7); } else if (n === "lose"){ Sound.play("Defeat", .8); } else if (n === "reveal"){ Sound.unlock && Sound.unlock(); }
      else if (n === "task"){ Sound.xp ? Sound.xp() : Sound.right(); } },
    mount(){
      this.stop(); const el = this.el = document.createElement("div"); el.className = "np"; el.setAttribute("data-notr", "");
      el.innerHTML = `<canvas class="np-cv"></canvas><div class="np-top"><button class="np-menu" data-x="menu">☰</button><div class="np-bar"><i></i><span>${T("TASKS", "AUFGABEN")}</span></div><button class="np-mapb" data-x="map">${icon("map", 20)}</button></div>
        <div class="np-tasks"></div><div class="np-alert"></div><div class="np-joy"><i></i></div><div class="np-btns"></div><div class="np-ov"></div><div class="np-mini"></div>`;
      document.body.appendChild(el); document.documentElement.classList.add("np-on");
      this.cv = el.querySelector("canvas"); this.ctx = this.cv.getContext("2d");
      this.rs = () => { const d = Math.min(2, window.devicePixelRatio || 1); this.cv.width = innerWidth * d; this.cv.height = innerHeight * d; this.dpr = d; this.zoom = Math.max(.5, Math.min(1.2, Math.min(innerWidth, innerHeight) / 560)); };
      this.rs(); window.addEventListener("resize", this.rs);
      /* joystick: touch anywhere on the left part of the screen */
      const joy = el.querySelector(".np-joy"), knob = joy.querySelector("i");
      const startJ = (x, y, pid) => { this.joy = {x0: x, y0: y, dx: 0, dy: 0, pid}; joy.style.left = x + "px"; joy.style.top = y + "px"; joy.classList.add("on"); knob.style.transform = "translate(-50%,-50%)"; };
      const moveJ = (x, y) => { const j = this.joy; if (!j) return; let dx = x - j.x0, dy = y - j.y0; const d = Math.hypot(dx, dy), m = 56; if (d > m){ dx *= m / d; dy *= m / d; } j.dx = dx / m; j.dy = dy / m; knob.style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`; };
      const endJ = () => { this.joy = null; joy.classList.remove("on"); };
      this.cv.addEventListener("pointerdown", e => { if (this.mini || this.v && this.v.phase !== "play") return; e.preventDefault(); startJ(e.clientX, e.clientY, e.pointerId); try { this.cv.setPointerCapture(e.pointerId); } catch(_) {} });
      this.cv.addEventListener("pointermove", e => { if (this.joy && e.pointerId === this.joy.pid) moveJ(e.clientX, e.clientY); });
      ["pointerup", "pointercancel"].forEach(t => this.cv.addEventListener(t, e => { if (this.joy && e.pointerId === this.joy.pid) endJ(); }));
      this.kd = e => { if (/^(Arrow|Key[WASD])/.test(e.code)){ this.keys[e.code] = 1; e.preventDefault(); } if (e.code === "KeyE" || e.code === "Space") { const b = this.el && this.el.querySelector(".np-act.main"); if (b) b.click(); } if (e.code === "KeyQ"){ const b = this.el && this.el.querySelector('[data-x="kill"]'); if (b) b.click(); } };
      this.ku = e => { delete this.keys[e.code]; };
      window.addEventListener("keydown", this.kd); window.addEventListener("keyup", this.ku);
      el.addEventListener("click", e => { const b = e.target.closest("[data-x]"); if (!b || b.disabled) return; Sound.tap(); this.click(b.dataset.x, b.dataset.v); });
      let last = performance.now(); const loop = t => { const dt = Math.min(.05, (t - last) / 1000); last = t; try { this.step(dt); this.render(); } catch(err) { console.error(err); } this.raf = requestAnimationFrame(loop); };
      this.raf = requestAnimationFrame(loop);
    },
    ghost(){ return this.v && !this.v.alive; },
    left(k){ return Math.max(0, ((this.ends || {})[k] || 0) - now()); },
    intro(){ return now() < (this.introEnd || 0); },
    near(x, y, r){ return dist(this.me, {x, y}) <= r; },
    step(dt){
      const v = this.v; if (!v) return;
      let ix = 0, iy = 0;
      if (v.phase === "play" && !this.mini && !this.vent && !this.intro()){
        if (this.joy){ ix = this.joy.dx; iy = this.joy.dy; }
        const k = this.keys; if (k.ArrowLeft || k.KeyA) ix -= 1; if (k.ArrowRight || k.KeyD) ix += 1; if (k.ArrowUp || k.KeyW) iy -= 1; if (k.ArrowDown || k.KeyS) iy += 1;
        const m = Math.hypot(ix, iy); if (m > 1){ ix /= m; iy /= m; }
      }
      const moving = Math.abs(ix) + Math.abs(iy) > .05, me = this.me;
      if (moving){ const sp = SPEED * (this.ghost() ? 1.15 : 1) * dt, nx = me.x + ix * sp, ny = me.y + iy * sp;
        if (this.ghost()){ me.x = Math.max(20, Math.min(W - 20, nx)); me.y = Math.max(20, Math.min(H - 20, ny)); }
        else { if (walk(nx, me.y)) me.x = nx; if (walk(me.x, ny)) me.y = ny; }
        if (Math.abs(ix) > .1) me.f = ix < 0 ? -1 : 1;
        if (!this.ghost() && now() - this.lastStep > 330){ this.lastStep = now(); Sound.play("Move", .12); } }
      me.mv = moving; this.send();
      /* smooth everyone else towards where they said they are */
      Object.entries(POS).forEach(([id, p]) => { if (id === PNet.me) return; if (p.dx == null || Math.hypot(p.dx - p.x, p.dy - p.y) > 400){ p.dx = p.x; p.dy = p.y; } p.dx += (p.x - p.dx) * Math.min(1, dt * 12); p.dy += (p.y - p.dy) * Math.min(1, dt * 12); });
      POS[PNet.me] = Object.assign(POS[PNet.me] || {}, {x: me.x, y: me.y, dx: me.x, dy: me.y, g: this.ghost(), v: !!this.vent, f: me.f, mv: moving});
      if (now() - (this.hudT || 0) > 250){ this.hudT = now(); this.hud(); }
    },
    send(force){ const me = this.me, t = now(), l = this.lastSend, ch = Math.abs(me.x - (l.x || 0)) + Math.abs(me.y - (l.y || 0)) > 2 || !!this.vent !== !!l.v || this.ghost() !== !!l.g;
      if (force || (ch && t - this.sent > 120) || t - this.sent > 1200){ this.sent = t; this.lastSend = {x: me.x, y: me.y, v: !!this.vent, g: this.ghost()}; PNet.raw({t: "mv", x: Math.round(me.x), y: Math.round(me.y), f: me.f, g: this.ghost() ? 1 : 0, v: this.vent ? 1 : 0, m: me.mv ? 1 : 0}); } },
    /* who/what is close enough for the buttons */
    targets(){
      const v = this.v, me = this.me, out = {}; if (!v || v.phase !== "play") return out;
      const players = (this.m && this.m.players || []).filter(p => p.id !== PNet.me);
      if (v.imp && v.alive && !this.vent){ let best = null; players.forEach(p => { const q = POS[p.id]; if (!q || q.g || q.v || v.mates.includes(p.id) || v.deadList.includes(p.id)) return; const d = dist(me, {x: q.dx, y: q.dy}); if (d <= KILL_R && (!best || d < best.d)) best = {id: p.id, d}; }); out.kill = best; }
      if (v.alive){ const b = v.bodies.find(b => dist(me, b) <= REPORT_R); if (b) out.report = b; }
      if (v.alive && dist(me, BTN) < USE_R * 1.5) out.button = true;
      if (v.imp && v.alive){ const vt = VENTS.find(x => dist(me, x) <= VENT_R); if (vt || this.vent) out.vent = vt || true; }
      if (v.sab){ if (v.sab.type === "lights" && dist(me, FIX.lights) <= USE_R) out.fix = "lights"; if (v.sab.type === "reactor"){ if (!v.sab.ra && dist(me, FIX.ra) <= USE_R) out.fix = "ra"; if (!v.sab.rb && dist(me, FIX.rb) <= USE_R) out.fix = "rb"; } }
      const mine = (v.imp ? v.fake.map(t => [t, false]) : v.tasks).filter(([t, d]) => !d).map(([t]) => TASKS.find(x => x.id === t)).find(t => dist(me, t) <= USE_R);
      if (mine) out.task = mine;
      return out;
    },
    click(x, val){
      const v = this.v, t = this.targets();
      if (x === "menu") return this.menu();
      if (x === "map") { this.mapOpen = !this.mapOpen; this.hud(); return; }
      if (x === "kill" && t.kill && this.left("kill") <= 0) return this.act({a: "kill", v: t.kill.id});
      if (x === "report" && t.report) return this.act({a: "report", v: t.report.id});
      if (x === "use"){
        if (t.fix) return this.openMini(FIX[t.fix].g, () => this.act({a: "fix", v: t.fix}));
        if (t.task) return this.openMini(t.task.g, () => { if (!v.imp){ this.act({a: "task", v: t.task.id}); this.sound("task"); } }, t.task);
        if (t.button && v.emer > 0) return this.act({a: "button"});
        if (t.button) return toast(T("You've used your emergency meeting.", "Du hast dein Notfall-Meeting schon benutzt."));
      }
      if (x === "vent"){ if (this.vent){ this.vent = null; this.send(true); Sound.play("Move", .7); } else if (t.vent && t.vent.id){ this.vent = t.vent.id; this.me.x = t.vent.x; this.me.y = t.vent.y; this.send(true); Sound.play("Capture", .5); } this.hud(); return; }
      if (x === "vgo"){ const vt = VENTS.find(q => q.id === val); if (vt){ this.vent = vt.id; this.me.x = vt.x; this.me.y = vt.y; this.send(true); Sound.play("Move", .5); this.hud(); } return; }
      if (x === "sab") return this.act({a: "sab", v: val});
      if (x === "vote") return this.act({a: "vote", v: val});
      if (x === "again") return this.act({a: "again"});
      if (x === "lobby") return this.act({a: "lobby"});
    },
    menu(){
      const v = this.v; const sh = detailSheet(`<h3 style="margin:0 0 8px">Natposter</h3><p class="muted" style="margin:0 0 12px">${T("Move with the stick on the left (or WASD). Use = E, Kill = Q.", "Laufen mit dem Stick links (oder WASD). Benutzen = E, Töten = Q.")}</p>
        ${v.host ? `<button class="btn" data-m="lobby" style="width:100%;margin-bottom:8px">${T("End game · back to the lobby", "Spiel beenden · zurück zur Lobby")}</button>` : ""}
        <button class="btn" data-m="leave" style="width:100%">${T("Leave", "Verlassen")}</button>`);
      sh.el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { sh.close(); if (b.dataset.m === "lobby") this.act({a: "lobby"}); else { PNet.leave(); App.go("games"); } });
    },
    /* ---- HUD: task bar, task list, buttons, overlays ---- */
    hud(){
      const v = this.v, el = this.el; if (!v || !el) return;
      el.classList.toggle("ghost", !v.alive); el.classList.toggle("imp", v.imp);
      el.querySelector(".np-bar i").style.width = Math.round(v.prog * 100) + "%";
      const tl = el.querySelector(".np-tasks"), tasksHtml = v.imp ? `<b class="np-red">${T("Natposter", "Natposter")}</b><small>${T("Kill, vent, sabotage. Don't get caught.", "Töten, Schächte, Sabotage. Nicht erwischen lassen.")}</small>${v.mates.length > 1 ? `<small>${T("Team: ", "Team: ")}${v.mates.filter(x => x !== PNet.me).map(x => esc(PNet.nameOf(x))).join(", ")}</small>` : ""}`
        : `${!v.alive ? `<b>👻 ${T("You're a ghost: finish your tasks", "Du bist ein Geist: mach deine Aufgaben")}</b>` : ""}${v.tasks.map(([t, d]) => { const k = TASKS.find(x => x.id === t), r = ROOMS.find(x => x.id === k.room); return `<div class="${d ? "done" : ""}">${esc(RN(r))}: ${esc(T(k.en, k.de))}</div>`; }).join("")}`;
      if (tl._h !== tasksHtml){ tl._h = tasksHtml; tl.innerHTML = tasksHtml; }
      /* alerts: sabotage */
      const al = el.querySelector(".np-alert"), sab = v.sab, alH = sab ? (sab.type === "reactor" ? `☢️ ${T("Reactor meltdown", "Reaktor-Kernschmelze")} <b>${Math.ceil(this.left("sab") / 1000)}</b> <small>${T("Hold both panels in the reactor", "Beide Platten im Reaktor halten")} ${sab.ra ? "✓" : "○"} ${sab.rb ? "✓" : "○"}</small>` : `💡 ${T("Lights out! Fix them in Electrical", "Licht aus! In der Elektrik reparieren")}`) : "";
      if (al._h !== alH){ al._h = alH; al.innerHTML = alH; al.classList.toggle("on", !!alH); }
      if (sab && sab.type === "reactor" && Math.ceil(this.left("sab") / 1000) !== this.lastAlarm){ this.lastAlarm = Math.ceil(this.left("sab") / 1000); if (this.lastAlarm % 2 === 0 && Sound.fx && Sound.fx()) Sound.note(81, 0, .2, .07, "pluck"); if (this.lastAlarm <= 10) Haptic.go(30); }
      /* action buttons */
      const t = this.targets(), bt = el.querySelector(".np-btns"), B = [];
      if (v.phase === "play"){
        if (this.vent){ const vt = VENTS.find(q => q.id === this.vent); vt.to.forEach(o => B.push(`<button class="np-act" data-x="vgo" data-v="${o}">➜<span>${esc(RN(roomAt(VENTS.find(q => q.id === o).x, VENTS.find(q => q.id === o).y)))}</span></button>`)); B.push(`<button class="np-act main on" data-x="vent">⬆<span>${T("Out", "Raus")}</span></button>`); }
        else {
          if (v.imp && v.alive) B.push(`<button class="np-act kill ${t.kill && this.left("kill") <= 0 ? "on" : ""}" data-x="kill" ${t.kill && this.left("kill") <= 0 ? "" : "disabled"}>🔪<span>${this.left("kill") > 0 ? Math.ceil(this.left("kill") / 1000) : T("Kill", "Töten")}</span></button>`);
          if (v.imp && v.alive) B.push(`<button class="np-act ${t.vent ? "on" : ""}" data-x="vent" ${t.vent ? "" : "disabled"}>🕳️<span>${T("Vent", "Schacht")}</span></button>`);
          if (v.alive) B.push(`<button class="np-act rep ${t.report ? "on" : ""}" data-x="report" ${t.report ? "" : "disabled"}>📣<span>${T("Report", "Melden")}</span></button>`);
          const use = t.fix || t.task || t.button; B.push(`<button class="np-act main ${use ? "on" : ""}" data-x="use" ${use ? "" : "disabled"}>${t.button && !t.task && !t.fix ? "🚨" : "✋"}<span>${t.button && !t.task && !t.fix ? T("Meeting", "Meeting") : T("Use", "Benutzen")}</span></button>`);
        }
      }
      const bh = B.join(""); if (bt._h !== bh){ bt._h = bh; bt.innerHTML = bh; }
      this.overlay();
    },
    overlay(){
      const v = this.v, ov = this.el.querySelector(".np-ov"), P = this.m.players, nm = id => esc(PNet.nameOf(id)), HC = this.hc || (this.hc = {}), head = id => { const p = P.find(x => x.id === id), k = id + (p && p.av ? JSON.stringify(p.av).length : 0); if (HC[k]) return HC[k]; try { return HC[k] = avatarSVG(Object.assign({}, p && p.av || {}, {aura: "none", pet: "none"}), {head: true, size: 54}); } catch(e) { return ""; } };
      let h = "";
      if (v.phase === "play" && this.intro()) h = `<div class="np-card ${v.imp ? "imp" : ""}"><div class="np-k">${T("You are", "Du bist")}</div><div class="np-big">${v.imp ? "Natposter" : T("Crew", "Crew")}</div><div class="np-face">${head(PNet.me)}</div><p>${v.imp ? T("Kill the crew without getting caught.", "Töte die Crew, ohne erwischt zu werden.") + (v.mates.length > 1 ? "<br>" + T("Team: ", "Team: ") + v.mates.filter(x => x !== PNet.me).map(nm).join(", ") : "") : T("Do your tasks. Find the Natposter.", "Erledige deine Aufgaben. Finde den Natposter.")}</p></div>`;
      if (v.phase === "play" && v.killedBy && !this.shown["k" + v.killedBy.k]){ h = `<div class="np-card imp"><div class="np-face">${head(v.killedBy.by)}</div><div class="np-big">${T("You were killed", "Du wurdest getötet")}</div><p>${T("You're a ghost now. Finish your tasks!", "Du bist jetzt ein Geist. Mach deine Aufgaben fertig!")}</p><button class="btn go" data-x="seen" data-v="k${v.killedBy.k}">OK</button></div>`; }
      if (v.phase === "meet"){ const m = v.meet, alive = P.filter(p => !v.deadList.includes(p.id) && v.views !== 0), canVote = v.alive && !m.my;
        h = `<div class="np-meet"><div class="np-k">${m.body ? "💀 " + T("Body reported", "Leiche gemeldet") : "🚨 " + T("Emergency meeting", "Notfall-Meeting")}</div><div class="np-big" style="font-size:22px">${m.body ? T(`${nm(m.by)} found ${nm(m.body)}`, `${nm(m.by)} hat ${nm(m.body)} gefunden`) : T(`called by ${nm(m.by)}`, `einberufen von ${nm(m.by)}`)}</div>
          <div class="np-tm">${Math.ceil(this.left("meet") / 1000)}</div>
          <div class="np-vgrid">${P.map(p => { const dead = v.deadList.includes(p.id); return `<button class="np-vote ${m.my === p.id ? "sel" : ""} ${dead ? "dead" : ""}" data-x="vote" data-v="${esc(p.id)}" ${!canVote || dead || p.id === PNet.me && false ? "disabled" : ""}><span class="np-hd">${head(p.id)}</span><b>${esc(p.name)}</b>${m.voted.includes(p.id) ? `<i>✓</i>` : ""}${dead ? `<i>✝</i>` : ""}</button>`; }).join("")}</div>
          <button class="btn ${m.my === "skip" ? "go" : ""}" data-x="vote" data-v="skip" ${canVote ? "" : "disabled"}>${T("Skip vote", "Überspringen")}</button>
          <p class="muted" style="margin:6px 0 0">${!v.alive ? T("Ghosts don't vote.", "Geister stimmen nicht ab.") : m.my ? T("Voted. Talk it out!", "Abgestimmt. Redet drüber!") : T("Talk, then vote.", "Redet, dann stimmt ab.")}</p></div>`; }
      if (v.phase === "eject"){ const e = v.eject;
        h = `<div class="np-eject">${e.id ? `<div class="np-float">${head(e.id)}</div>` : ""}<div class="np-big">${e.id ? (e.conf ? (e.imp ? T(`${nm(e.id)} was a Natposter.`, `${nm(e.id)} war ein Natposter.`) : T(`${nm(e.id)} was not a Natposter.`, `${nm(e.id)} war kein Natposter.`)) : T(`${nm(e.id)} was ejected.`, `${nm(e.id)} wurde rausgeworfen.`)) : T("Nobody was ejected.", "Niemand wurde rausgeworfen.")}</div>
          ${e.conf ? `<p>${T(`${e.left} Natposter${e.left === 1 ? "" : "s"} left.`, `Noch ${e.left} Natposter übrig.`)}</p>` : ""}</div>`; }
      if (v.phase === "end"){ const crew = v.win !== "imp" && v.win !== "boom", mine = crew !== v.imp;
        h = `<div class="np-card ${crew ? "" : "imp"}"><div class="np-k">${mine ? T("Victory", "Sieg") : T("Defeat", "Niederlage")}</div><div class="np-big">${crew ? (v.win === "tasks" ? T("Crew wins: all tasks done", "Crew gewinnt: alle Aufgaben erledigt") : T("Crew wins", "Die Crew gewinnt")) : v.win === "boom" ? T("Reactor exploded. Natposter wins", "Reaktor explodiert. Natposter gewinnt") : T("Natposter wins", "Natposter gewinnt")}</div>
          <div class="np-faces">${v.imps.map(id => `<span><span class="np-hd">${head(id)}</span><b>${nm(id)}</b></span>`).join("")}</div><p>${T(v.imps.length > 1 ? "were the Natposters" : "was the Natposter", v.imps.length > 1 ? "waren die Natposter" : "war der Natposter")}</p>
          ${v.host ? `<button class="btn go big" data-x="again">${T("Play again", "Nochmal")}</button><button class="btn ghost" data-x="lobby" style="margin-top:6px">${T("Lobby", "Lobby")}</button>` : `<p class="muted">${T("Waiting for the host…", "Warte auf den Gastgeber…")}</p>`}</div>`; }
      if (this.mapOpen && v.phase === "play") h = this.mapHTML();
      if (ov._h !== h){ ov._h = h; ov.innerHTML = h; ov.classList.toggle("on", !!h); ov.querySelectorAll('[data-x="seen"]').forEach(b => b.onclick = e => { e.stopPropagation(); this.shown[b.dataset.v.slice(0)] = 1; this.shown[b.dataset.v] = 1; this.overlay(); });
        if (v.phase === "meet" || v.phase === "eject" || v.phase === "end") this.closeMini(); }
      if (v.killedBy && this.shown["k" + v.killedBy.k] === undefined && ov.querySelector('[data-x="seen"]')) {}
    },
    mapHTML(){ const v = this.v, s = 0.13, mine = (v.imp ? [] : v.tasks).filter(([t, d]) => !d).map(([t]) => TASKS.find(x => x.id === t));
      return `<div class="np-map"><div class="np-k">${T("Map", "Karte")}</div><svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">${AREAS.map(a => `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="#3D3A35" stroke="#211F1C" stroke-width="10"/>`).join("")}
        ${ROOMS.map(r => `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2}" fill="#BAB5AC" font-size="44" font-weight="800" text-anchor="middle" font-family="Figtree,sans-serif">${esc(RN(r))}</text>`).join("")}
        ${mine.map(t => `<circle cx="${t.x}" cy="${t.y}" r="26" fill="#E9B64A"/>`).join("")}${v.sab ? Object.entries(FIX).filter(([k]) => v.sab.type === "lights" ? k === "lights" : k !== "lights").map(([k, f]) => `<circle cx="${f.x}" cy="${f.y}" r="34" fill="#E2523E"/>`).join("") : ""}
        <circle cx="${this.me.x}" cy="${this.me.y}" r="34" fill="#8FC458" stroke="#fff" stroke-width="8"/></svg>
        ${v.imp && v.alive ? `<div class="np-sab"><button class="btn ${this.left("sabCd") > 0 || v.sab ? "" : "go"}" data-x="sab" data-v="lights" ${this.left("sabCd") > 0 || v.sab ? "disabled" : ""}>💡 ${T("Lights", "Licht")}</button><button class="btn ${this.left("sabCd") > 0 || v.sab ? "" : "go"}" data-x="sab" data-v="reactor" ${this.left("sabCd") > 0 || v.sab ? "disabled" : ""}>☢️ ${T("Reactor", "Reaktor")}</button>${this.left("sabCd") > 0 ? `<small>${Math.ceil(this.left("sabCd") / 1000)} s</small>` : ""}</div>` : ""}
        <button class="btn ghost" data-x="map">${T("Close", "Schließen")}</button></div>`; },
    /* ---- the world ---- */
    render(){
      const v = this.v, c = this.ctx, cv = this.cv; if (!v || !c) return;
      const d = this.dpr, z = this.zoom * d, me = this.me, cw = cv.width, ch = cv.height;
      c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = "#0B0C12"; c.fillRect(0, 0, cw, ch);
      const ox = cw / 2 - me.x * z, oy = ch / 2 - me.y * z;
      /* stars, slower than the station */
      c.fillStyle = "#fff"; STARS.forEach(([x, y, r, a]) => { const sx = (x - me.x * .35) * z * .6 + cw / 2, sy = (y - me.y * .35) * z * .6 + ch / 2; if (sx < -5 || sy < -5 || sx > cw + 5 || sy > ch + 5) return; c.globalAlpha = .25 + a * .6; c.fillRect(sx, sy, r * d, r * d); });
      c.globalAlpha = 1; c.setTransform(z, 0, 0, z, ox, oy);
      /* hull */
      c.fillStyle = "#211F1C"; AREAS.forEach(a => { c.fillRect(a.x - 14, a.y - 14, a.w + 28, a.h + 28); });
      AREAS.forEach(a => { c.fillStyle = "#33302C"; c.fillRect(a.x, a.y, a.w, a.h); });
      ROOMS.forEach(r => this.floor(c, r));
      HALLS.forEach(a => { c.fillStyle = "#2B2926"; c.fillRect(a.x, a.y, a.w, a.h); c.fillStyle = "rgba(127,178,74,.18)"; if (a.w > a.h) c.fillRect(a.x, a.y + a.h / 2 - 2, a.w, 4); else c.fillRect(a.x + a.w / 2 - 2, a.y, 4, a.h); });
      this.props(c);
      ROOMS.forEach(r => { c.fillStyle = "rgba(244,242,238,.32)"; c.font = "800 22px Figtree,system-ui,sans-serif"; c.textAlign = "left"; c.fillText(RN(r).toUpperCase(), r.x + 14, r.y + 30); });
      /* vents (the Natposter sees them clearly) */
      VENTS.forEach(vt => { c.fillStyle = "#1B1A18"; c.fillRect(vt.x - 26, vt.y - 18, 52, 36); c.strokeStyle = v.imp ? "#8FC458" : "#4a4640"; c.lineWidth = 3; for (let i = -12; i <= 12; i += 8){ c.beginPath(); c.moveTo(vt.x - 20, vt.y + i * .9); c.lineTo(vt.x + 20, vt.y + i * .9); c.stroke(); } });
      /* task stations and fix panels */
      const mine = v.imp ? v.fake : v.tasks.filter(([t, dn]) => !dn).map(([t]) => t), pulse = (Math.sin(now() / 250) + 1) / 2;
      TASKS.forEach(t => { const my = mine.includes(t.id); c.fillStyle = "#1B1A18"; c.fillRect(t.x - 22, t.y - 22, 44, 44); c.fillStyle = my && !v.imp ? `rgba(233,182,74,${.55 + pulse * .45})` : "#4a4640"; c.fillRect(t.x - 14, t.y - 14, 28, 28); });
      if (v.sab) Object.entries(FIX).forEach(([k, f]) => { if (v.sab.type === "lights" ? k !== "lights" : k === "lights" || v.sab[k]) return; c.fillStyle = `rgba(226,82,62,${.5 + pulse * .5})`; c.beginPath(); c.arc(f.x, f.y, 26, 0, 7); c.fill(); });
      /* bodies */
      v.bodies.forEach(b => { const p = this.m.players.find(x => x.id === b.id); this.figure(c, b.x, b.y, p, {body: true}); });
      /* people */
      const R0 = !v.alive ? 99999 : v.imp ? VIS.imp : v.sab && v.sab.type === "lights" ? VIS.dark : VIS.crew;
      const list = this.m.players.map(p => ({p, q: p.id === PNet.me ? Object.assign({}, POS[p.id] || {}, {dx: me.x, dy: me.y}) : POS[p.id]})).filter(o => o.q && o.q.dx != null).sort((a, b) => a.q.dy - b.q.dy);
      list.forEach(({p, q}) => { const self = p.id === PNet.me, gh = q.g || (v.deadList.includes(p.id) && !v.bodies.some(b => b.id === p.id) && false);
        if (!self){ if (q.v) return; if (q.g && v.alive) return; if (v.alive && dist(me, {x: q.dx, y: q.dy}) > R0 + 20) return; if (now() - (q.t || 0) > 15000) return; }
        if (self && this.vent) return;
        this.figure(c, q.dx, q.dy, p, {ghost: q.g, f: q.f, mv: q.mv, red: v.imp && v.mates.includes(p.id) && !self, me: self}); });
      /* darkness outside your sight */
      c.setTransform(1, 0, 0, 1, 0, 0);
      if (v.alive){ const rad = R0 * z, g = c.createRadialGradient(cw / 2, ch / 2, rad * .55, cw / 2, ch / 2, rad); g.addColorStop(0, "rgba(6,7,12,0)"); g.addColorStop(1, "rgba(6,7,12,.93)"); c.fillStyle = g; c.fillRect(0, 0, cw, ch); }
      if (this.vent){ c.fillStyle = "rgba(6,7,12,.55)"; c.fillRect(0, 0, cw, ch); }
      if (v.sab && v.sab.type === "reactor"){ c.fillStyle = `rgba(226,82,62,${.08 + pulse * .12})`; c.fillRect(0, 0, cw, ch); }
    },
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
      /* the chess lounge: a big knight */
      const kn = pieceImg("wn"); if (kn.complete && kn.naturalWidth) c.drawImage(kn, 730, 740, 120, 120); const bk = pieceImg("bk"); if (bk.complete && bk.naturalWidth) c.drawImage(bk, 860, 700, 70, 70);
    },
    figure(c, x, y, p, o){
      const im = avImg(p.id, p.av), h = 118, w = h * 200 / 256, bob = o.mv ? Math.sin(now() / 90) * 3 : 0;
      c.save(); c.translate(x, y);
      if (o.body){ c.globalAlpha = .9; c.fillStyle = "rgba(226,82,62,.35)"; c.beginPath(); c.ellipse(0, 10, 46, 16, 0, 0, 7); c.fill(); c.rotate(-Math.PI / 2); if (im.complete && im.naturalWidth) { c.filter = "grayscale(.6) brightness(.8)"; c.drawImage(im, -w / 2 - 20, -h + 30, w, h); c.filter = "none"; } c.restore(); return; }
      if (o.ghost){ c.globalAlpha = .45; y += Math.sin(now() / 400) * 6; }
      c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.ellipse(0, 16, 26, 8, 0, 0, 7); c.fill();
      if (o.me){ c.strokeStyle = "rgba(143,196,88,.8)"; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 16, 30, 10, 0, 0, 7); c.stroke(); }
      if ((o.f || 1) < 0) c.scale(-1, 1);
      if (im.complete && im.naturalWidth) c.drawImage(im, -w / 2, -h + 18 + bob, w, h); else { c.fillStyle = "#BAB5AC"; c.beginPath(); c.arc(0, -30, 26, 0, 7); c.fill(); }
      if ((o.f || 1) < 0) c.scale(-1, 1);
      c.font = "800 15px Figtree,system-ui,sans-serif"; c.textAlign = "center"; const tw = c.measureText(p.name).width + 12; c.fillStyle = "rgba(20,19,17,.72)"; c.beginPath(); c.roundRect ? c.roundRect(-tw / 2, -h + bob - 2, tw, 20, 10) : c.rect(-tw / 2, -h + bob - 2, tw, 20); c.fill(); c.fillStyle = o.red ? "#F07B68" : "#fff"; c.fillText(p.name, 0, -h + 13 + bob);
      c.restore();
    },
    /* ---------------- minigames ---------------- */
    closeMini(){ if (this.mini){ this.mini.stop && this.mini.stop(); this.mini = null; } const m = this.el && this.el.querySelector(".np-mini"); if (m){ m.innerHTML = ""; m.classList.remove("on"); } },
    openMini(g, done, task){
      this.closeMini(); const box = this.el.querySelector(".np-mini"), me = {stop: null}; this.mini = me; this.joy = null;
      const finish = () => { Haptic.go([20, 30, 20]); box.querySelector(".np-mg").classList.add("ok"); setTimeout(() => { if (this.mini === me){ this.closeMini(); done(); } }, 450); };
      box.classList.add("on");
      box.innerHTML = `<div class="np-mg"><div class="np-mgh"><b>${esc(task ? T(task.en, task.de) : g === "hold" ? T("Hold the panel", "Platte halten") : T("Fix it", "Reparieren"))}</b><button class="np-x" data-c>×</button></div><div class="np-mgb"></div></div>`;
      box.querySelector("[data-c]").onclick = () => { Sound.tap(); this.closeMini(); };
      (MG[g] || MG.hold)(box.querySelector(".np-mgb"), finish, me);
    }
  };
  NP.kd = NP.ku = NP.rs = () => {};
  window.__npTo = p => { NP.me.x = p.x; NP.me.y = p.y; NP.send(true); };
  window.__npToId = id => { const q = POS[id]; if (q) window.__npTo({x: q.x + 30, y: q.y}); };
  window.__npOpen = g => NP.openMini(g, () => {}); window.__npClose = () => NP.closeMini();
  PG.custom.np = {draw: (b, v, m, a) => NP.draw(b, v, m, a), stop: () => NP.stop()};

  /* the minigames: short, all in the app's look */
  const MG = {
    wires(el, done){ const C = ["#E2523E", "#5AA3E0", "#E9B64A", "#8FC458"], R2 = PG.shuffle([0, 1, 2, 3]), con = {};
      el.innerHTML = `<div class="np-wires"><svg viewBox="0 0 300 240"></svg>${C.map((c, i) => `<i class="l" data-l="${i}" style="top:${20 + i * 55}px;background:${c}"></i>`).join("")}${R2.map((c, i) => `<i class="r" data-r="${c}" style="top:${20 + i * 55}px;background:${C[c]}"></i>`).join("")}</div>`;
      const svg = el.querySelector("svg"), box = el.querySelector(".np-wires"); let drag = null;
      const pt = e => { const r = box.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 300, (e.clientY - r.top) / r.height * 240]; };
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
      cd.addEventListener("pointerdown", e => { e.preventDefault(); d = {x0: e.clientX, t0: now()}; try { cd.setPointerCapture(e.pointerId); } catch(_) {} });
      cd.addEventListener("pointermove", e => { if (!d) return; const max = tr.clientWidth - cd.clientWidth; const x = Math.max(0, Math.min(max, e.clientX - d.x0)); cd.style.transform = `translateX(${x}px)`; d.x = x; d.max = max; });
      cd.addEventListener("pointerup", () => { if (!d) return; const ms = now() - d.t0, ok = d.x >= d.max - 4; cd.style.transform = ""; if (!ok) msg.textContent = T("All the way through!", "Ganz durchziehen!"); else if (ms < 450) msg.textContent = T("Too fast. Try again.", "Zu schnell. Nochmal."); else if (ms > 1600) msg.textContent = T("Too slow. Try again.", "Zu langsam. Nochmal."); else { done(); return; } Sound.wrong(); d = null; }); },
    chess(el, done){
      /* mate in one, on the app's own board colours and pieces */
      const L = ["6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", "k7/8/1K6/8/8/8/8/7Q w - - 0 1", "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1", "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1", "5rk1/5ppp/8/8/8/8/1Q3PPP/6K1 w - - 0 1", "7k/7p/8/8/8/8/6R1/1R4K1 w - - 0 1"];
      const g = new Chess(PG.pick(L)); let sel = null;
      const draw = (msg) => { const B = g.board(); el.innerHTML = `<div class="np-board">${B.map((row, r) => row.map((p, f) => { const sq = "abcdefgh"[f] + (8 - r); return `<div class="sq ${(r + f) % 2 ? "d" : "l"} ${sel === sq ? "sel" : ""}" data-q="${sq}">${p ? `<i class="np-pc pc ${p.color}${p.type}"></i>` : ""}</div>`; }).join("")).join("")}</div><p class="muted">${msg || T("White to move: find the checkmate", "Weiß am Zug: Finde das Matt")}</p>`;
        el.querySelectorAll("[data-q]").forEach(d => d.onclick = () => { const q = d.dataset.q, p = g.get(q);
          if (p && p.color === "w"){ sel = q; Sound.play("Move", .3); return draw(); }
          if (!sel) return; const m = g.move({from: sel, to: q, promotion: "q"}); sel = null; if (!m) return draw();
          if (g.in_checkmate()){ Sound.play("Mate", .9); draw(T("Checkmate!", "Schachmatt!")); done(); return; }
          Sound.wrong(); g.undo(); draw(T("Not mate. Try again.", "Kein Matt. Nochmal.")); }); };
      draw(); }
  };

  /* ---------------- look ---------------- */
  const css = `.np{position:fixed;inset:0;z-index:2700;background:#0B0C12;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;color:var(--fg);font-family:var(--body)}
html.np-on .tabbar,html.np-on .pg-pill{display:none!important}
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
.np-act.on{opacity:1}.np-act.main.on{background:var(--go);box-shadow:inset 0 -5px 0 var(--go-deep)}.np-act.kill.on{background:var(--bad);box-shadow:inset 0 -5px 0 #a8382a}.np-act.rep.on{background:#E9B64A;color:#2A1E05}
.np-act:active{transform:scale(.94)}
.np-ov{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(6,7,12,.72);padding:16px;z-index:5}
.np-ov.on{display:flex}
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
.np-board{display:grid;grid-template-columns:repeat(8,1fr);border-radius:6px;overflow:hidden;width:min(100%,calc(100dvh - 130px));margin:0 auto;aspect-ratio:1}.np-board .sq{position:relative;cursor:pointer}.np-board .sq.l{background:var(--sq-l)}.np-board .sq.d{background:var(--sq-d)}.np-board .sq.sel{box-shadow:inset 0 0 0 100px var(--hl-sel)}
.np-pc{position:absolute!important;inset:0;width:100%!important;height:100%!important;transform:none!important;pointer-events:none}
.np.ghost .np-cv{filter:saturate(.6)}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  /* in the Games list: online only */
  PG.add({id: "natposter", icon: "spy", name: ["Natposter", "Natposter"], tag: ["New", "Neu", "bad"], sub: ["Space station. Tasks. One of you is a traitor.", "Raumstation. Aufgaben. Einer von euch ist ein Verräter."], meta: ["4–15 players · own phones", "4–15 Spieler · eigene Handys"],
    mount(ctx){ setTimeout(() => App.go("lobby", PNet.P && PNet.P.isHost ? undefined : {host: true, game: "natposter"}), 0); }});
})();
