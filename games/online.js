/* ===== Online versions of the party games. They run on the host's phone; every phone gets its own view.
   An engine: {min, max, opts, start(G, api), act(G, pid, a, api), view(G, pid, api), tick(G, api)}.
   G.ids = players in seat order, G.s = the game's state. Texts are plain text with *bold*. ===== */
(() => {
  const {T} = PG;
  const D = PG.data;
  const shuf = PG.shuffle, pick = PG.pick;
  const now = () => Date.now();
  const snd = (G, n) => { G.sk = (G.sk || 0) + 1; G.s.snd = {k: "s" + G.sk, n}; };
  const psnd = (G, id, n) => { G.sk = (G.sk || 0) + 1; G.s.ps = G.s.ps || {}; G.s.ps[id] = {k: "p" + G.sk, n}; };
  const sndOf = (G, id) => { const a = G.s.snd, b = G.s.ps && G.s.ps[id]; return !a ? b : !b ? a : (+a.k.slice(1) > +b.k.slice(1) ? a : b); };
  const timer = (G, secs) => { G.s.until = now() + secs * 1000; G.s.tk = (G.s.tk || 0) + 1; };
  const tview = G => G.s.until ? {k: "t" + G.s.tk, left: Math.max(0, G.s.until - now())} : null;
  const isHost = (G, id) => id === G.host;
  const nm = (api, id) => api.name(id);
  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "");
  const L = pair => PG.de() ? pair[0] : (pair[1] || pair[0]);
  const LVL = {k: "lv", l: ["Level", "Stufe"], d: "mix", c: [["chill", "Chill"], ["party", "Party"], ["spicy", "18+"], ["mix", "Mix"]]};
  const lvls = o => o.lv === "mix" ? ["chill", "party"] : o.lv === "spicy" ? ["party", "spicy"] : [o.lv];
  const deck = (key, src, o) => { const list = lvls(o).flatMap(l => src[l].map(t => [l, t])); return PG.draw("on-" + key + ":" + o.lv, list); };
  const scoreRows = (G, api, pts) => G.ids.map(id => ({l: nm(api, id), r: pts[id] || 0})).sort((a, b) => b.r - a.r);
  const fillP = (G, api, t, me) => { const o = G.ids.filter(x => x !== me); return t.replace(/\{p\}/g, () => "*" + nm(api, pick(o.length ? o : G.ids)) + "*"); };

  /* ================= Imposter ================= */
  const IMP_CATS = () => Object.keys(D.imp.CATS);
  PG.online.imposter = {min: 3, max: 24,
    opts: [{k: "mode", l: ["Mode", "Modus"], d: "classic", c: [["classic", ["Classic", "Klassisch"]], ["under", "Undercover"], ["agent", ["Agent (places)", "Agent (Orte)"]]]},
      {k: "cat", l: ["Category", "Kategorie"], d: "mix", c: () => [["mix", "Mix"], ...IMP_CATS().map(k => [k, [D.imp.CATS[k][1], D.imp.CATS[k][0]]])]},
      {k: "imp", l: ["Imposters", "Imposter"], d: 1, c: [[1, "1"], [2, "2"], [3, "3"]]},
      {k: "time", l: ["Talk time", "Diskussionszeit"], d: 3, c: [[0, ["No timer", "Ohne Uhr"]], [2, "2 min"], [3, "3 min"], [5, "5 min"]]}],
    start(G){ G.s.pts = G.s.pts || {}; this.round(G); },
    round(G){
      const o = G.opts, n = G.ids.length, k = Math.max(1, Math.min(o.imp, Math.floor((n - 1) / 2)));
      const pts = G.s.pts || {}; G.s = {pts, phase: "talk", imps: shuf(G.ids).slice(0, k), votes: {}, starter: pick(G.ids), round: (G.s.round || 0) + 1};
      const s = G.s;
      if (o.mode === "under"){ const pr = PG.draw("on-imp:pairs", D.imp.PAIRS); const f = Math.random() < .5; s.word = f ? pr[1] : pr[0]; s.other = f ? pr[0] : pr[1]; }
      else if (o.mode === "agent") s.word = PG.draw("on-imp:places", D.imp.PLACES);
      else { s.cat = o.cat === "mix" ? pick(["food", "animals", "places", "things", "party", "jobs", "sport", "movies"]) : o.cat; s.word = PG.draw("on-imp:" + s.cat, D.imp.words(s.cat)); }
      if (o.time) timer(G, o.time * 60); else s.until = 0;
      snd(G, "reveal");
    },
    card(G, id){ const s = G.s, o = G.opts, imp = s.imps.includes(id), k = "c" + s.round;
      if (o.mode === "under") return {k, lab: T("Your word", "Dein Wort"), big: L(imp ? s.other : s.word)};
      if (o.mode === "agent") return imp ? {k, bad: true, em: "🕵️", big: T("Agent", "Agent"), sm: [T("You don't know the place. Find out where you are without getting caught.", "Du kennst den Ort nicht. Finde heraus, wo ihr seid, ohne aufzufliegen.")]} : {k, lab: T("You are at", "Ihr seid hier"), big: L(s.word), sm: [T("Find the agent.", "Findet den Agenten.")]};
      const cn = T(D.imp.CATS[s.cat][1], D.imp.CATS[s.cat][0]);
      return imp ? {k, bad: true, em: "🕵️", big: "Imposter", sm: [T("Category: ", "Kategorie: ") + "*" + cn + "*", s.imps.length > 1 ? T(`${s.imps.length} imposters this round.`, `${s.imps.length} Imposter diese Runde.`) : T("Blend in!", "Misch dich unter!")]} : {k, lab: T("The word", "Das Wort"), big: L(s.word), sm: [cn]};
    },
    tick(G){ const s = G.s; if (s.phase === "talk" && s.until && now() >= s.until){ s.phase = "vote"; s.until = 0; snd(G, "notify"); return true; }
      if (s.phase === "vote" && Object.keys(s.votes).length >= (s.voters || G.ids).length) { this.tally(G); return true; } },
    tally(G){ const s = G.s, c = {}; Object.values(s.votes).forEach(v => { c[v] = (c[v] || 0) + 1; });
      const max = Math.max(...Object.values(c)), top = Object.keys(c).filter(k => c[k] === max);
      s.lastVotes = Object.assign({}, s.votes);
      if (top.length > 1 && !s.runoff){ s.runoff = top; s.votes = {}; snd(G, "notify"); return; }
      s.acc = top.length > 1 ? null : top[0]; s.counts = c;
      const caught = s.acc && s.imps.includes(s.acc);
      if (caught && G.opts.mode !== "under"){ s.phase = "guess"; snd(G, "unlock"); }
      else this.finish(G, false);
    },
    finish(G, guessed){ const s = G.s, caught = s.acc && s.imps.includes(s.acc);
      if (caught && !guessed) G.ids.forEach(id => { if (!s.imps.includes(id)) s.pts[id] = (s.pts[id] || 0) + 1; });
      else s.imps.forEach(id => { s.pts[id] = (s.pts[id] || 0) + (caught ? 1 : 2); });
      s.crew = caught && !guessed; s.phase = "result"; snd(G, s.crew ? "cheer" : "lose"); },
    act(G, id, a){ const s = G.s;
      if (a.a === "vote" && s.phase === "talk" && isHost(G, id)){ s.phase = "vote"; s.until = 0; snd(G, "notify"); }
      else if (a.a === "pick" && s.phase === "vote"){ if (s.runoff && !s.runoff.includes(a.v)) return; if (a.v === id) return; s.votes[id] = a.v; }
      else if (a.a === "guess" && s.phase === "guess" && id === s.acc){ const g = (a.f && a.f.g) || ""; s.guess = g;
        const ok = [s.word[0], s.word[1]].some(w => norm(w) && norm(w) === norm(g)); if (ok){ this.finish(G, true); } else s.phase = "judge"; }
      else if (a.a === "judge" && s.phase === "judge" && isHost(G, id)) this.finish(G, a.v === "1");
      else if (a.a === "next" && s.phase === "result" && isHost(G, id)) this.round(G);
    },
    view(G, id, api){ const s = G.s, o = G.opts, card = Object.assign(this.card(G, id), {mini: s.phase !== "talk"}), imp = s.imps.includes(id);
      const base = {snd: sndOf(G, id)};
      if (s.phase === "talk") return Object.assign(base, {k: "talk" + s.round, who: T(`Round ${s.round}`, `Runde ${s.round}`), card, timer: tview(G),
        say: T(`${nm(api, s.starter)} starts.`, `${nm(api, s.starter)} beginnt.`), small: o.mode === "agent" ? T("Ask each other questions about the place, one after the other.", "Stellt euch reihum Fragen über den Ort.") : T("Going round, everyone says one word that fits. Out loud, in person.", "Reihum sagt jeder ein Wort, das passt. Laut, in echt."),
        btns: isHost(G, id) ? [{a: "vote", l: T("Start the vote", "Abstimmung starten"), s: "go"}] : []});
      if (s.phase === "vote"){ const done = s.votes[id] != null, opts = (s.runoff || G.ids).filter(x => x !== id);
        return Object.assign(base, {k: "vote" + s.round + (s.runoff ? "r" : ""), card, say: s.runoff ? T("Tie! Vote again between these.", "Gleichstand! Stimmt nochmal zwischen diesen ab.") : T("Who is the imposter?", "Wer ist der Imposter?"),
          small: T(`${Object.keys(s.votes).length} of ${G.ids.length} have voted.`, `${Object.keys(s.votes).length} von ${G.ids.length} haben abgestimmt.`),
          pick: {act: "pick", opts: opts.map(x => ({v: x, l: nm(api, x), sel: s.votes[id] === x}))}, foot: done ? T("You can still change your vote.", "Du kannst deine Stimme noch ändern.") : ""}); }
      if (s.phase === "guess") return id === s.acc ? Object.assign(base, {k: "guess" + s.round, emo: "🎯", say: T("Caught! Last chance:", "Erwischt! Letzte Chance:"), small: o.mode === "agent" ? T("Where are you?", "Wo seid ihr?") : T("What's the word?", "Wie heißt das Wort?"), input: {act: "guess", fields: [{k: "g", l: T("Your guess", "Dein Tipp")}]}, btns: [{a: "guess", l: T("Guess", "Raten"), s: "go"}]})
        : Object.assign(base, {k: "guessw" + s.round, emo: "🎯", say: T(`Caught: ${nm(api, s.acc)}!`, `Erwischt: ${nm(api, s.acc)}!`), small: T("Now they get one guess at the word…", "Jetzt darf er oder sie einmal das Wort raten…")});
      if (s.phase === "judge") return Object.assign(base, {k: "judge" + s.round, emo: "🤔", say: T(`${nm(api, s.acc)} guesses: “${s.guess}”`, `${nm(api, s.acc)} tippt: „${s.guess}“`), small: T(`The word was *${L(s.word)}*.`, `Das Wort war *${L(s.word)}*.`),
        btns: isHost(G, id) ? [{a: "judge", v: "1", l: T("Counts as right", "Zählt als richtig")}, {a: "judge", v: "0", l: T("Wrong", "Falsch"), s: "go"}] : [], foot: isHost(G, id) ? "" : T("The host decides.", "Der Gastgeber entscheidet.")});
      const names = s.imps.map(x => nm(api, x)).join(" & ");
      return Object.assign(base, {k: "res" + s.round, emo: s.crew ? "🎉" : "🕵️", name: s.crew ? T("The group wins!", "Die Gruppe gewinnt!") : T("The imposter wins!", "Der Imposter gewinnt!"), nameSize: 30,
        small: (s.acc ? T(`Voted out: ${nm(api, s.acc)}. `, `Rausgewählt: ${nm(api, s.acc)}. `) : T("Nobody was voted out. ", "Niemand wurde rausgewählt. ")) + T(`Imposter: *${names}* · ${o.mode === "agent" ? "Place" : "Word"}: *${L(s.word)}*`, `Imposter: *${names}* · ${o.mode === "agent" ? "Ort" : "Wort"}: *${L(s.word)}*`) + (s.other ? T(` · imposter's word: *${L(s.other)}*`, ` · Wort des Imposters: *${L(s.other)}*`) : "") + (s.guess ? T(` · guess: “${s.guess}”`, ` · Tipp: „${s.guess}“`) : ""),
        list: {t: T("Points", "Punkte"), rows: scoreRows(G, api, s.pts).map(r => Object.assign(r, {c: imp && s.imps.includes(id) ? "" : ""}))},
        btns: isHost(G, id) ? [{a: "next", l: T("Next round", "Nächste Runde"), s: "go"}] : [], foot: isHost(G, id) ? "" : T("Waiting for the host…", "Warte auf den Gastgeber…")});
    }};

  /* ================= Werwolf (no game master: everyone acts on their own phone) ================= */
  const R = () => D.ww.ROLES;
  const RN = k => T(R()[k].n[0], R()[k].n[1]);
  PG.online.werwolf = {min: 5, max: 24, note: ["No game master needed: everyone does their night action secretly on their own phone.", "Kein Spielleiter nötig: Jeder macht seine Nachtaktion heimlich auf dem eigenen Handy."],
    opts: [{k: "roles", l: ["Roles", "Rollen"], d: "auto", c: [["auto", ["Recommended", "Empfohlen"]], ["basic", ["Seer & witch", "Seherin & Hexe"]], ["all", ["All roles", "Alle Rollen"]]]},
      {k: "wolves", l: ["Werewolves", "Werwölfe"], d: "auto", c: [["auto", "Auto"], [1, "1"], [2, "2"], [3, "3"], [4, "4"]]},
      {k: "time", l: ["Talk time per day", "Diskussionszeit pro Tag"], d: 3, c: [[0, ["No timer", "Ohne Uhr"]], [2, "2 min"], [3, "3 min"], [5, "5 min"], [8, "8 min"]]},
      {k: "dead", l: ["Reveal roles of the dead", "Rollen von Toten zeigen"], d: 1, c: [[1, ["Yes", "Ja"]], [0, ["No", "Nein"]]]}],
    start(G){
      const n = G.ids.length, o = G.opts, rec = D.ww.recommend(n);
      const roles = {wolf: o.wolves === "auto" ? rec.wolf : Math.min(+o.wolves, Math.floor((n - 1) / 2)), seer: 1, witch: o.roles === "auto" ? rec.witch : 1, hunter: o.roles === "all" ? 1 : o.roles === "auto" ? rec.hunter : 0, cupid: o.roles === "all" ? 1 : o.roles === "auto" ? rec.cupid : 0, guard: o.roles === "all" ? 1 : o.roles === "auto" ? rec.guard : 0};
      const bag = []; Object.entries(roles).forEach(([k, c]) => { for (let i = 0; i < c; i++) bag.push(k); }); while (bag.length > n) bag.splice(bag.lastIndexOf(bag.find(x => x !== "wolf")), 1); while (bag.length < n) bag.push("vill");
      const r = shuf(bag), P = {}; G.ids.forEach((id, i) => { P[id] = {role: r[i], alive: true, lover: null}; });
      G.s = {P, phase: "cards", ready: {}, night: 0, day: 0, heal: true, poison: true, lastProt: null, log: [], news: []};
      snd(G, "reveal");
    },
    alive(G){ return G.ids.filter(id => G.s.P[id].alive); },
    has(G, k){ return G.ids.some(id => G.s.P[id].role === k); },
    roleAlive(G, k){ return G.ids.some(id => G.s.P[id].role === k && G.s.P[id].alive); },
    card(G, id, api){ const p = G.s.P[id], r = R()[p.role], mates = p.role === "wolf" ? G.ids.filter(x => x !== id && G.s.P[x].role === "wolf").map(x => nm(api, x)) : [];
      return {k: "role", bad: p.role === "wolf", em: r.e, big: RN(p.role), lab: T("Your role", "Deine Rolle"), sm: [T(r.d[0], r.d[1])].concat(mates.length ? [T("Your pack: ", "Dein Rudel: ") + "*" + mates.join(", ") + "*"] : []).concat(p.lover ? ["💘 " + T("In love with ", "Verliebt in ") + "*" + nm(api, p.lover) + "*"] : [])}; },
    /* ---- night ---- */
    nightStart(G){ const s = G.s; s.night++; s.phase = "night"; s.acts = {}; s.wolf = {}; s.seen = {}; s.prot = null; s.victim = null; s.healed = false; s.poisoned = null; s.until = 0; snd(G, "night"); },
    task(G, id){ const s = G.s, p = s.P[id]; if (!p.alive) return null;
      if (p.role === "wolf") return "wolf"; if (p.role === "seer") return "seer"; if (p.role === "guard") return "guard"; if (p.role === "cupid" && s.night === 1) return "cupid"; return "dummy"; },
    nightDone(G){ const s = G.s; return this.alive(G).every(id => s.acts[id]); },
    afterA(G){ const s = G.s;
      /* the pack's choice: most wolf votes, a tie is decided by chance */
      const c = {}; Object.values(s.wolf).forEach(v => { c[v] = (c[v] || 0) + 1; }); const mx = Math.max(0, ...Object.values(c)), top = Object.keys(c).filter(k => c[k] === mx);
      s.victim = top.length ? pick(top) : null;
      if (this.has(G, "witch")){ s.phase = "witch"; if (!this.roleAlive(G, "witch")) s.until = now() + 4000 + Math.random() * 5000; else s.until = 0; }
      else this.morning(G);
    },
    morning(G){ const s = G.s, dead = [];
      if (s.victim && s.victim !== s.prot && !s.healed) dead.push(s.victim);
      if (s.poisoned && !dead.includes(s.poisoned)) dead.push(s.poisoned);
      s.news = []; s.queue = dead.map(id => ({id, why: "night"})); s.phase = "morning"; s.until = 0; snd(G, "day");
      this.flush(G);
    },
    /* deaths one by one: lovers follow, the hunter shoots first */
    flush(G){ const s = G.s;
      while (s.queue.length){ const {id, why} = s.queue.shift(); const p = s.P[id]; if (!p.alive) continue; p.alive = false; s.news.push({id, why}); snd(G, "death");
        if (p.lover && s.P[p.lover].alive) s.queue.unshift({id: p.lover, why: "lover"});
        if (p.role === "hunter"){ s.hunter = id; s.phaseAfter = s.phase; s.phase = "hunter"; return; } }
      s.win = this.winner(G); if (s.win){ s.phase = "end"; snd(G, s.win === "wolves" ? "lose" : "cheer"); }
    },
    winner(G){ const A = this.alive(G), W = A.filter(id => G.s.P[id].role === "wolf").length, V = A.length - W, lov = A.filter(id => G.s.P[id].lover);
      if (A.length === 2 && lov.length === 2 && (G.s.P[lov[0]].role === "wolf") !== (G.s.P[lov[1]].role === "wolf")) return "love";
      if (W === 0) return "village"; if (W >= V) return "wolves"; return null; },
    dayStart(G){ const s = G.s; s.day++; s.phase = "day"; s.ready = {}; s.votes = {}; s.runoff = null; if (G.opts.time) timer(G, G.opts.time * 60); else s.until = 0; snd(G, "notify"); },
    tally(G){ const s = G.s, c = {}; Object.entries(s.votes).forEach(([k, v]) => { if (v !== "none") c[v] = (c[v] || 0) + 1; });
      s.lastVotes = Object.assign({}, s.votes); const mx = Math.max(0, ...Object.values(c)), top = Object.keys(c).filter(k => c[k] === mx);
      if (!mx){ s.out = null; s.phase = "verdict"; return; }
      if (top.length > 1 && !s.runoff){ s.runoff = top; s.votes = {}; snd(G, "notify"); return; }
      s.out = top.length > 1 ? null : top[0]; s.phase = "verdict"; },
    tick(G){ const s = G.s;
      if (s.phase === "witch" && s.until && now() >= s.until){ this.morning(G); return true; }
      if (s.phase === "day" && s.until && now() >= s.until){ s.phase = "vote"; s.until = 0; s.votes = {}; snd(G, "notify"); return true; }
      if (s.phase === "vote" && this.alive(G).every(id => s.votes[id] != null)){ this.tally(G); return true; }
      if (s.phase === "night" && this.nightDone(G)){ this.afterA(G); return true; }
    },
    act(G, id, a, api){ const s = G.s, p = s.P[id], host = isHost(G, id);
      if (a.a === "ready" && s.phase === "cards"){ s.ready[id] = 1; if (G.ids.every(x => s.ready[x])) this.nightStart(G); return; }
      if (a.a === "go" && host && s.phase === "cards"){ this.nightStart(G); return; }
      if (s.phase === "night" && p.alive && !s.acts[id]){ const t = this.task(G, id);
        if (t === "wolf" && a.a === "pick"){ if (s.P[a.v] && s.P[a.v].alive && s.P[a.v].role !== "wolf") s.wolf[id] = a.v; return; }
        if (t === "wolf" && a.a === "done" && s.wolf[id]){ s.acts[id] = 1; return; }
        if (t === "seer" && a.a === "pick" && !s.seen[id] && a.v !== id && s.P[a.v] && s.P[a.v].alive){ s.seen[id] = a.v; G.s.log.push([s.night, "seer", a.v]); psnd(G, id, "reveal"); return; }
        if (t === "seer" && a.a === "done" && s.seen[id]){ s.acts[id] = 1; return; }
        if (t === "guard" && a.a === "pick" && a.v !== s.lastProt && s.P[a.v] && s.P[a.v].alive){ s.prot = a.v; s.lastProt = a.v; s.acts[id] = 1; return; }
        if (t === "cupid" && a.a === "pick" && s.P[a.v]){ s.cup = s.cup || []; if (s.cup.includes(a.v)) s.cup = s.cup.filter(x => x !== a.v); else { s.cup.push(a.v); if (s.cup.length > 2) s.cup.shift(); } return; }
        if (t === "cupid" && a.a === "done" && s.cup && s.cup.length === 2){ const [x, y] = s.cup; s.P[x].lover = y; s.P[y].lover = x; s.acts[id] = 1; psnd(G, x, "heart"); psnd(G, y, "heart"); return; }
        if (t === "dummy" && a.a === "pick" && s.P[a.v]){ s.acts[id] = 1; return; }
      }
      if (s.phase === "witch" && p.alive && p.role === "witch"){
        if (a.a === "heal" && s.heal && s.victim){ s.healed = a.v === "1"; if (s.healed) s.heal = false; s.wDone1 = true; return; }
        if (a.a === "pick" && s.poison && a.v !== id && s.P[a.v] && s.P[a.v].alive){ s.wPick = s.wPick === a.v ? null : a.v; return; }
        if (a.a === "done"){ if (s.wPick){ s.poisoned = s.wPick; s.poison = false; } s.wPick = null; s.wDone1 = false; this.morning(G); return; }
      }
      if (s.phase === "hunter" && id === s.hunter && a.a === "pick" && s.P[a.v] && s.P[a.v].alive){ s.queue.unshift({id: a.v, why: "shot"}); s.phase = s.phaseAfter; s.hunter = null; this.flush(G); return; }
      if (a.a === "next" && host){ if (s.phase === "morning") return this.dayStart(G); if (s.phase === "verdict"){ if (s.out){ s.news = []; s.queue = [{id: s.out, why: "vote"}]; s.phase = "lynch"; this.flush(G); if (s.phase === "lynch") snd(G, "death"); return; } return this.nightStart(G); }
        if (s.phase === "lynch") return this.nightStart(G); if (s.phase === "day"){ s.phase = "vote"; s.until = 0; s.votes = {}; return; } }
      if (s.phase === "day" && a.a === "ready" && p.alive){ s.ready[id] = 1; if (this.alive(G).every(x => s.ready[x])){ s.phase = "vote"; s.until = 0; s.votes = {}; snd(G, "notify"); } return; }
      if (s.phase === "vote" && a.a === "pick" && p.alive && (a.v === "none" || (s.P[a.v] && s.P[a.v].alive))){ if (s.runoff && a.v !== "none" && !s.runoff.includes(a.v)) return; s.votes[id] = a.v; return; }
      if (a.a === "again" && host && s.phase === "end") this.start(G);
    },
    deathsText(G, api){ const s = G.s; return s.news.map(({id, why}) => { const r = G.opts.dead ? ` (${RN(s.P[id].role)} ${R()[s.P[id].role].e})` : "";
      return (why === "lover" ? T(`${nm(api, id)} dies of a broken heart`, `${nm(api, id)} stirbt vor Kummer`) : why === "shot" ? T(`The hunter takes ${nm(api, id)} with him`, `Der Jäger nimmt ${nm(api, id)} mit in den Tod`) : why === "vote" ? T(`The village sends ${nm(api, id)} away`, `Das Dorf schickt ${nm(api, id)} fort`) : T(`${nm(api, id)} died tonight`, `${nm(api, id)} ist heute Nacht gestorben`)) + r + "."; }).join("\n"); },
    view(G, id, api){ const s = G.s, p = s.P[id], host = isHost(G, id), card = Object.assign(this.card(G, id, api), {mini: G.s.phase !== "cards"}), base = {snd: sndOf(G, id), night: ["night", "witch"].includes(s.phase)};
      const A = this.alive(G), others = A.filter(x => x !== id), opt = (list, sel, mark) => list.map(x => ({v: x, l: nm(api, x), sel: Array.isArray(sel) ? sel.includes(x) : sel === x, mark: mark ? mark(x) : ""}));
      const deadNote = !p.alive ? T("You are dead ✝. Watch, but don't give anything away.", "Du bist tot ✝. Schau zu, aber verrate nichts.") : "";
      if (s.phase === "cards") return Object.assign(base, {k: "cards", who: T("Your secret role", "Deine geheime Rolle"), card, say: T("Look at your card, then tap Ready.", "Schau dir deine Karte an und tippe dann auf Bereit."), small: T(`${Object.keys(s.ready).length} of ${G.ids.length} ready.`, `${Object.keys(s.ready).length} von ${G.ids.length} bereit.`),
        btns: [{a: "ready", l: s.ready[id] ? T("Ready ✓", "Bereit ✓") : T("Ready", "Bereit"), s: s.ready[id] ? "" : "go", dis: !!s.ready[id]}].concat(host ? [{a: "go", l: T("Start the night now", "Nacht jetzt starten"), s: "ghost"}] : [])});
      if (s.phase === "night"){
        const head = {k: "n" + s.night + id, emo: "🌙", who: T(`Night ${s.night}`, `Nacht ${s.night}`), card};
        if (!p.alive) return Object.assign(base, head, {say: T("The village sleeps.", "Das Dorf schläft."), small: deadNote});
        if (s.acts[id]) return Object.assign(base, head, {k: head.k + "w", say: T("Done. Sleep tight…", "Erledigt. Schlaf gut…"), small: T("Waiting for the others. Stay quiet!", "Warte auf die anderen. Psst, alle sind still!")});
        const t = this.task(G, id);
        if (t === "wolf"){ const mates = A.filter(x => s.P[x].role === "wolf"), marks = x => { const by = mates.filter(w => s.wolf[w] === x).map(w => nm(api, w)); return by.length ? "🐺 " + by.join(", ") : ""; };
          return Object.assign(base, head, {say: T("Werewolves, choose your victim.", "Werwölfe, wählt euer Opfer."), small: T("Your pack sees your choice. Agree on one person (most votes wins).", "Dein Rudel sieht deine Wahl. Einigt euch auf eine Person (die meisten Stimmen zählen)."),
            pick: {act: "pick", opts: opt(A.filter(x => s.P[x].role !== "wolf"), s.wolf[id], marks)}, btns: [{a: "done", l: T("Done", "Fertig"), s: "go", dis: !s.wolf[id]}]}); }
        if (t === "seer"){ const v = s.seen[id]; if (v){ const w = s.P[v].role === "wolf";
            return Object.assign(base, head, {say: T("The seer sees:", "Die Seherin sieht:"), big: {k: nm(api, v), q: R()[s.P[v].role].e + " " + RN(s.P[v].role), c: w ? "bad" : "light"}, btns: [{a: "done", l: T("Got it", "Verstanden"), s: "go"}]}); }
          return Object.assign(base, head, {say: T("Seer, whose card do you want to see?", "Seherin, wessen Karte willst du sehen?"), pick: {act: "pick", opts: opt(others, null)}}); }
        if (t === "guard") return Object.assign(base, head, {say: T("Guardian, who do you protect tonight?", "Beschützer, wen beschützt du heute Nacht?"), small: s.lastProt ? T(`Not ${nm(api, s.lastProt)} again.`, `Nicht nochmal ${nm(api, s.lastProt)}.`) : "", pick: {act: "pick", opts: opt(A.filter(x => x !== s.lastProt), null)}});
        if (t === "cupid") return Object.assign(base, head, {say: T("Cupid, pick two people who fall in love.", "Amor, wähle zwei Menschen, die sich verlieben."), small: T("If one dies, the other dies too.", "Stirbt einer, stirbt auch der andere."), pick: {act: "pick", opts: opt(G.ids, s.cup || [])}, btns: [{a: "done", l: T("They're in love", "Die zwei sind verliebt"), s: "go", dis: !(s.cup && s.cup.length === 2)}]});
        return Object.assign(base, head, {say: T("Who do you suspect?", "Wen verdächtigst du?"), small: T("Everyone taps someone at night, so nobody can tell who has a special role.", "Nachts tippt jeder jemanden an, damit niemand merkt, wer eine Spezialrolle hat."), pick: {act: "pick", opts: opt(others, null)}});
      }
      if (s.phase === "witch"){ const head = {k: "w" + s.night + id, emo: "🌙", who: T(`Night ${s.night}`, `Nacht ${s.night}`), card};
        if (p.alive && p.role === "witch"){ const v = s.victim;
          return Object.assign(base, head, {k: head.k + (s.wDone1 ? "b" : "a"), emo: "🧪", say: v ? T(`Tonight's victim: ${nm(api, v)}.`, `Opfer dieser Nacht: ${nm(api, v)}.`) : T("The wolves chose nobody.", "Die Wölfe haben niemanden gewählt."),
            small: [s.heal && v && !s.wDone1 ? T("Save them with your healing potion?", "Mit dem Heiltrank retten?") : !s.heal ? T("Healing potion: used up.", "Heiltrank: verbraucht.") : s.healed ? T("You save them ✓", "Du rettest das Opfer ✓") : "", s.poison ? T("Poison someone? Tap a name (optional).", "Jemanden vergiften? Tippe einen Namen an (freiwillig).") : T("Poison: used up.", "Gifttrank: verbraucht.")].filter(Boolean).join("\n"),
            pick: s.poison && (s.wDone1 || !s.heal || !v) ? {act: "pick", title: "☠️ " + T("Poison", "Gifttrank"), opts: opt(others, s.wPick)} : null,
            btns: s.heal && v && !s.wDone1 ? [{a: "heal", v: "1", l: T("Heal", "Heilen")}, {a: "heal", v: "0", l: T("Don't heal", "Nicht heilen"), s: "go"}] : [{a: "done", l: s.wPick ? T(`Poison ${nm(api, s.wPick)}`, `${nm(api, s.wPick)} vergiften`) : T("Done", "Fertig"), s: s.wPick ? "bad" : "go"}]}); }
        return Object.assign(base, head, {say: T("The night isn't over yet…", "Die Nacht ist noch nicht vorbei…"), small: p.alive ? T("Someone is still awake. Stay quiet.", "Jemand ist noch wach. Psst.") : deadNote}); }
      if (s.phase === "hunter") return id === s.hunter ? Object.assign(base, {k: "hunt" + id + s.news.length, emo: "🏹", say: T("You're the hunter and you're dying. Who do you take with you?", "Du bist der Jäger und stirbst. Wen nimmst du mit?"), small: this.deathsText(G, api), pick: {act: "pick", opts: opt(A, null)}})
        : Object.assign(base, {k: "huntw" + s.news.length, emo: "🏹", say: T("The hunter takes aim…", "Der Jäger legt an…"), small: this.deathsText(G, api)});
      if (s.phase === "morning") return Object.assign(base, {k: "m" + s.night, emo: "🌅", who: T(`Morning ${s.night}`, `Morgen ${s.night}`), say: s.news.length ? this.deathsText(G, api) : T("Nobody died last night!", "Heute Nacht ist niemand gestorben!"), small: deadNote, card,
        btns: host ? [{a: "next", l: T("On to the day", "Weiter zum Tag"), s: "go"}] : [], foot: host ? "" : T("The host continues.", "Der Gastgeber macht weiter.")});
      if (s.phase === "day") return Object.assign(base, {k: "d" + s.day, emo: "☀️", who: T(`Day ${s.day}`, `Tag ${s.day}`), say: T("Discuss: who's a werewolf?", "Diskutiert: Wer ist ein Werwolf?"), small: (deadNote ? deadNote + "\n" : "") + T(`Alive: ${A.map(x => nm(api, x)).join(", ")}`, `Leben noch: ${A.map(x => nm(api, x)).join(", ")}`), timer: tview(G), card,
        btns: (p.alive ? [{a: "ready", l: s.ready[id] ? T("Ready to vote ✓", "Bereit zur Abstimmung ✓") : T("Ready to vote", "Bereit zur Abstimmung"), s: s.ready[id] ? "" : "go", dis: !!s.ready[id]}] : []).concat(host ? [{a: "next", l: T("Vote now", "Jetzt abstimmen"), s: "ghost"}] : [])});
      if (s.phase === "vote"){ const list = s.runoff || A; const n = Object.keys(s.votes).length;
        return Object.assign(base, {k: "v" + s.day + (s.runoff ? "r" : ""), emo: "🗳️", say: s.runoff ? T("Tie! Vote again between these.", "Gleichstand! Stichwahl zwischen diesen.") : T("Who should leave the village?", "Wer soll das Dorf verlassen?"), small: T(`${n} of ${A.length} have voted.`, `${n} von ${A.length} haben abgestimmt.`) + (deadNote ? "\n" + deadNote : ""),
          pick: p.alive ? {act: "pick", opts: opt(list, s.votes[id]).concat(s.runoff ? [] : [{v: "none", l: T("Nobody", "Niemand"), sel: s.votes[id] === "none"}])} : null}); }
      if (s.phase === "verdict"){ const rows = Object.entries(s.lastVotes || {}).map(([k, v]) => ({l: nm(api, k), s: "→ " + (v === "none" ? T("nobody", "niemand") : nm(api, v))}));
        return Object.assign(base, {k: "vd" + s.day, emo: s.out ? "⚖️" : "🤝", say: s.out ? T(`The village chose ${nm(api, s.out)}.`, `Das Dorf hat ${nm(api, s.out)} gewählt.`) : T("No majority. Nobody leaves today.", "Keine Mehrheit. Heute geht niemand."), list: {t: T("Votes", "Stimmen"), rows},
          btns: host ? [{a: "next", l: s.out ? T("Reveal", "Aufdecken") : T("Night falls", "Die Nacht bricht herein"), s: "go"}] : []}); }
      if (s.phase === "lynch") return Object.assign(base, {k: "l" + s.day, emo: "✝️", say: this.deathsText(G, api), small: deadNote, btns: host ? [{a: "next", l: T("Night falls", "Die Nacht bricht herein"), s: "go"}] : []});
      if (s.phase === "end"){ const w = s.win, mine = w === "village" ? p.role !== "wolf" && !(p.lover && w === "love") : w === "wolves" ? p.role === "wolf" : !!p.lover;
        return Object.assign(base, {k: "end", emo: w === "village" ? "🏡" : w === "wolves" ? "🐺" : "💘", name: w === "village" ? T("The village wins!", "Das Dorf gewinnt!") : w === "wolves" ? T("The werewolves win!", "Die Werwölfe gewinnen!") : T("The lovers win!", "Die Verliebten gewinnen!"), nameSize: 30,
          small: mine ? T("You won 🎉", "Du hast gewonnen 🎉") : T("You lost.", "Du hast verloren."), list: {t: T("Who was who", "Wer war wer"), rows: G.ids.map(x => ({e: R()[s.P[x].role].e, l: nm(api, x) + (s.P[x].lover ? " 💘" : ""), s: RN(s.P[x].role) + (s.P[x].alive ? "" : " · ✝"), d: !s.P[x].alive}))},
          btns: host ? [{a: "again", l: T("Play again", "Nochmal spielen"), s: "go"}] : []}); }
      return {k: "x", say: "…"};
    }};

  /* ================= Wer würde eher ================= */
  PG.online.likely = {min: 3, max: 24, opts: [LVL],
    start(G){ G.s = {n: 0, tot: {}}; this.card(G); },
    card(G){ const s = G.s; s.n++; s.q = deck("likely", D.cards.LIKELY, G.opts); s.votes = {}; s.phase = "vote"; snd(G, "reveal"); },
    tick(G){ const s = G.s; if (s.phase === "vote" && G.ids.every(id => s.votes[id])){ this.reveal(G); return true; } },
    reveal(G){ const s = G.s, c = {}; Object.values(s.votes).forEach(v => { c[v] = (c[v] || 0) + 1; }); s.c = c; const mx = Math.max(...Object.values(c)); s.top = Object.keys(c).filter(k => c[k] === mx); s.top.forEach(k => { s.tot[k] = (s.tot[k] || 0) + 1; }); s.phase = "res"; snd(G, "cheer"); },
    act(G, id, a){ const s = G.s; if (a.a === "pick" && s.phase === "vote" && G.ids.includes(a.v)) s.votes[id] = a.v; else if (a.a === "show" && isHost(G, id) && s.phase === "vote" && Object.keys(s.votes).length) this.reveal(G); else if (a.a === "next" && isHost(G, id)) this.card(G); },
    view(G, id, api){ const s = G.s, big = {k: s.q[0] === "spicy" ? "18+" : s.q[0], q: s.q[1]}, base = {snd: sndOf(G, id)};
      if (s.phase === "vote") return Object.assign(base, {k: "v" + s.n, big, small: T(`${Object.keys(s.votes).length} of ${G.ids.length} have chosen.`, `${Object.keys(s.votes).length} von ${G.ids.length} haben gewählt.`), pick: {act: "pick", opts: G.ids.map(x => ({v: x, l: nm(api, x), sel: s.votes[id] === x}))}, btns: isHost(G, id) ? [{a: "show", l: T("Show results now", "Ergebnis jetzt zeigen"), s: "ghost"}] : []});
      return Object.assign(base, {k: "r" + s.n, big, name: s.top.map(x => nm(api, x)).join(" & ") + "!", nameSize: 36, list: {rows: Object.entries(s.c).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({l: nm(api, k), s: G.ids.filter(x => s.votes[x] === k).map(x => nm(api, x)).join(", "), r: v}))},
        btns: isHost(G, id) ? [{a: "next", l: T("Next card", "Nächste Karte"), s: "go"}] : []});
    }};

  /* ================= Ich hab noch nie ================= */
  PG.online.never = {min: 2, max: 24, opts: [LVL],
    start(G){ G.s = {n: 0, tot: {}}; this.card(G); },
    card(G){ const s = G.s; s.n++; s.q = deck("never", D.cards.NEVER, G.opts); s.ans = {}; s.phase = "ask"; snd(G, "reveal"); },
    tick(G){ const s = G.s; if (s.phase === "ask" && G.ids.every(id => s.ans[id])){ this.reveal(G); return true; } },
    reveal(G){ const s = G.s; G.ids.forEach(id => { if (s.ans[id] === "y") s.tot[id] = (s.tot[id] || 0) + 1; }); s.phase = "res"; snd(G, Object.values(s.ans).some(v => v === "y") ? "unlock" : "plop"); },
    act(G, id, a){ const s = G.s; if (a.a === "ans" && s.phase === "ask") s.ans[id] = a.v; else if (a.a === "show" && isHost(G, id) && s.phase === "ask") this.reveal(G); else if (a.a === "next" && isHost(G, id)) this.card(G); },
    view(G, id, api){ const s = G.s, big = {k: s.q[0] === "spicy" ? "18+" : s.q[0], q: s.q[1]}, base = {snd: sndOf(G, id)};
      if (s.phase === "ask") return Object.assign(base, {k: "a" + s.n, big, small: T("Secretly: have you done it? Everyone sees it once all have answered.", "Heimlich: Hast du es schon gemacht? Alle sehen es, sobald jeder geantwortet hat."), foot: T(`${Object.keys(s.ans).length} of ${G.ids.length} answered.`, `${Object.keys(s.ans).length} von ${G.ids.length} haben geantwortet.`),
        btns: [{a: "ans", v: "y", l: "🙋 " + T("I have", "Hab ich schon"), s: s.ans[id] === "y" ? "go" : ""}, {a: "ans", v: "n", l: "🙅 " + T("Never", "Noch nie"), s: s.ans[id] === "n" ? "go" : ""}].concat(isHost(G, id) ? [{a: "show", l: T("Reveal now", "Jetzt aufdecken"), s: "ghost"}] : []), btnsCol: isHost(G, id)});
      const yes = G.ids.filter(x => s.ans[x] === "y");
      return Object.assign(base, {k: "r" + s.n, big, name: yes.length ? T(`${yes.length} have done it`, `${yes.length} haben es schon gemacht`) : T("Nobody! 😇", "Niemand! 😇"), nameSize: 26, small: yes.length ? "🍻 " + yes.map(x => nm(api, x)).join(", ") + T(" drink!", " trinken!") : "",
        list: {t: T("Confession table", "Geständnis-Tabelle"), rows: scoreRows(G, api, s.tot)}, btns: isHost(G, id) ? [{a: "next", l: T("Next card", "Nächste Karte"), s: "go"}] : []});
    }};

  /* ================= Wahrheit oder Pflicht ================= */
  PG.online.tod = {min: 2, max: 24, opts: [LVL],
    start(G){ G.s = {turn: -1, pts: {}, n: 0}; this.next(G); },
    next(G){ const s = G.s; s.turn = (s.turn + 1) % G.ids.length; s.who = G.ids[s.turn]; s.phase = "choose"; s.n++; s.q = null; snd(G, "plop"); },
    act(G, id, a, api){ const s = G.s;
      if (a.a === "td" && s.phase === "choose" && (id === s.who || isHost(G, id))){ const k = a.v === "r" ? (Math.random() < .5 ? "t" : "d") : a.v; s.kind = k; const c = deck(k === "t" ? "tod-t" : "tod-d", k === "t" ? D.cards.TRUTH : D.cards.DARE, G.opts); s.q = [c[0], fillP(G, api, c[1], s.who)]; s.phase = "card"; snd(G, "reveal"); }
      else if (a.a === "res" && s.phase === "card" && (id === s.who || isHost(G, id))){ s.pts[s.who] = (s.pts[s.who] || 0) + (a.v === "1" ? 1 : -1); snd(G, a.v === "1" ? "xp" : "wrong"); this.next(G); }
      else if (a.a === "skip" && isHost(G, id)) this.next(G); },
    view(G, id, api){ const s = G.s, mine = id === s.who, base = {snd: sndOf(G, id)}, who = nm(api, s.who);
      if (s.phase === "choose") return Object.assign(base, {k: "c" + s.n, who: T("Up now", "Jetzt dran"), name: mine ? T("You!", "Du!") : who, say: mine ? T("Truth or dare?", "Wahrheit oder Pflicht?") : T(`${who} is choosing…`, `${who} wählt…`),
        btns: mine || isHost(G, id) ? [{a: "td", v: "t", l: "😇 " + T("Truth", "Wahrheit")}, {a: "td", v: "d", l: "😈 " + T("Dare", "Pflicht"), s: "go"}].concat(mine ? [{a: "td", v: "r", l: T("Random", "Zufall"), s: "ghost"}] : []) : [], list: Object.keys(s.pts).length ? {t: T("Points", "Punkte"), rows: scoreRows(G, api, s.pts)} : null});
      return Object.assign(base, {k: "q" + s.n, who: who + " · " + (s.kind === "t" ? T("Truth", "Wahrheit") : T("Dare", "Pflicht")), big: {k: s.q[0] === "spicy" ? "18+" : s.q[0], q: s.q[1]},
        btns: mine || isHost(G, id) ? [{a: "res", v: "0", l: T("Chicken out", "Kneifen")}, {a: "res", v: "1", l: T("Done", "Erledigt"), s: "go"}] : [], foot: mine ? "" : T(`${who} has to do it. Watch closely!`, `${who} muss ran. Schaut genau hin!`)});
    }};

  /* ================= Tick-Tack-Bumm: the bomb jumps from phone to phone ================= */
  PG.online.bomb = {min: 3, max: 24, opts: [{k: "mode", l: ["Task", "Aufgabe"], d: "syl", c: [["syl", ["Word with syllable", "Wort mit Silbe"]], ["cat", ["Name something", "Begriff aus Kategorie"]]]}],
    start(G){ G.s = {n: 0, boom: (G.s && G.s.boom) || {}}; this.round(G); },
    round(G){ const s = G.s; s.n++; s.task = G.opts.mode === "syl" ? PG.draw("on-bomb-syl", D.bomb.SYL) : PG.draw("on-bomb-cat", D.bomb.KAT); s.holder = pick(G.ids); s.t0 = now(); s.fuse = 20000 + Math.random() * 40000; s.phase = "live"; s.passes = 0; snd(G, "notify"); },
    tick(G){ const s = G.s; if (s.phase === "live" && now() - s.t0 >= s.fuse){ s.phase = "boom"; s.boom[s.holder] = (s.boom[s.holder] || 0) + 1; snd(G, "boom"); return true; } return s.phase === "live"; },
    act(G, id, a){ const s = G.s; if (a.a === "pick" && s.phase === "live" && id === s.holder && a.v !== id && G.ids.includes(a.v)){ s.holder = a.v; s.passes++; psnd(G, a.v, "plop"); } else if (a.a === "next" && isHost(G, id) && s.phase === "boom") this.round(G); },
    view(G, id, api){ const s = G.s, base = {snd: sndOf(G, id)}, task = {k: G.opts.mode === "syl" ? T("A word with", "Ein Wort mit") : T("Name something:", "Nenne etwas:"), q: G.opts.mode === "syl" ? "…" + s.task + "…" : s.task, size: G.opts.mode === "syl" ? 56 : 26};
      if (s.phase === "live"){ const heat = Math.min(1, (now() - s.t0) / s.fuse);
        if (id === s.holder) return Object.assign(base, {k: "h" + s.n + "-" + s.passes, emo: "💣", who: T("You have the bomb!", "Du hast die Bombe!"), big: task, ticking: Math.round(heat * 10) / 10, say: T("Say a word, then pass it on:", "Sag ein Wort und gib sie weiter:"), pick: {act: "pick", opts: G.ids.filter(x => x !== id).map(x => ({v: x, l: nm(api, x)}))}});
        return Object.assign(base, {k: "o" + s.n + "-" + s.passes, emo: "😬", who: T("The bomb is with", "Die Bombe hat"), name: nm(api, s.holder), big: task, small: T("Be ready, it could come to you any second.", "Mach dich bereit, sie kann jeden Moment zu dir kommen.")}); }
      return Object.assign(base, {k: "b" + s.n, emo: "💥", name: id === s.holder ? T("BOOM! You!", "BUMM! Du!") : T(`BOOM! ${nm(api, s.holder)}!`, `BUMM! ${nm(api, s.holder)}!`), nameSize: 34, list: {t: T("Explosions", "Explosionen"), rows: scoreRows(G, api, s.boom)}, btns: isHost(G, id) ? [{a: "next", l: T("New bomb", "Neue Bombe"), s: "go"}] : []});
    }};

  /* ================= Tabu: the explainer's phone shows the card, the other team's phones watch for forbidden words ================= */
  PG.online.tabu = {min: 4, max: 24, opts: [{k: "secs", l: ["Time per turn", "Zeit pro Zug"], d: 60, c: [[45, "45 s"], [60, "60 s"], [90, "90 s"]]}, {k: "goal", l: ["Play to", "Spielen bis"], d: 20, c: [[10, "10"], [20, "20"], [30, "30"]]}],
    start(G){ const ids = shuf(G.ids); G.s = {team: {}, sc: [0, 0], turn: 0, k: [0, 0], phase: "ready", n: 0}; ids.forEach((id, i) => { G.s.team[id] = i % 2; }); this.pickExpl(G); },
    members(G, t){ return G.ids.filter(id => G.s.team[id] === t); },
    pickExpl(G){ const s = G.s, t = s.turn % 2, m = this.members(G, t); s.expl = m[s.k[t] % m.length]; s.phase = "ready"; s.n++; s.until = 0; },
    tick(G){ const s = G.s; if (s.phase === "turn" && now() >= s.until){ const t = s.turn % 2; s.sc[t] += s.pts; s.phase = "sum"; s.until = 0; s.won = s.sc[t] >= G.opts.goal ? t : -1; snd(G, s.won >= 0 ? "cheer" : "notify"); return true; } },
    act(G, id, a){ const s = G.s, t = s.turn % 2;
      if (a.a === "go" && s.phase === "ready" && (id === s.expl || isHost(G, id))){ s.phase = "turn"; s.pts = 0; s.log = []; s.card = PG.draw("on-tabu", D.tabu); timer(G, G.opts.secs); snd(G, "notify"); }
      else if (s.phase === "turn" && ["ok", "skip"].includes(a.a) && id === s.expl){ s.log.push([s.card.w, a.a === "ok" ? 1 : 0]); if (a.a === "ok"){ s.pts++; psnd(G, id, "xp"); } s.card = PG.draw("on-tabu", D.tabu); }
      else if (s.phase === "turn" && a.a === "bad" && s.team[id] !== t){ s.log.push([s.card.w, -1]); s.pts--; snd(G, "wrong"); s.card = PG.draw("on-tabu", D.tabu); }
      else if (a.a === "next" && s.phase === "sum" && isHost(G, id)){ if (s.won >= 0){ this.start(G); return; } s.k[t]++; s.turn++; this.pickExpl(G); } },
    view(G, id, api){ const s = G.s, t = s.turn % 2, mine = s.team[id], base = {snd: sndOf(G, id)}, teamName = k => T(k ? "Team B" : "Team A", k ? "Team B" : "Team A");
      const stats = [[String(s.sc[0]), teamName(0) + (mine === 0 ? " · " + T("you", "du") : "")], [String(s.sc[1]), teamName(1) + (mine === 1 ? " · " + T("you", "du") : "")]];
      const team = k => this.members(G, k).map(x => nm(api, x)).join(", ");
      if (s.phase === "ready") return Object.assign(base, {k: "r" + s.n, who: teamName(t), name: id === s.expl ? T("You explain!", "Du erklärst!") : nm(api, s.expl), say: id === s.expl ? T("Your team guesses. The others watch for forbidden words.", "Dein Team rät. Die anderen passen auf verbotene Wörter auf.") : mine === t ? T(`${nm(api, s.expl)} explains, you guess!`, `${nm(api, s.expl)} erklärt, du rätst!`) : T("You watch for forbidden words.", "Du passt auf verbotene Wörter auf."),
        stats, small: T(`Team A: ${team(0)}\nTeam B: ${team(1)}`, `Team A: ${team(0)}\nTeam B: ${team(1)}`), btns: id === s.expl || isHost(G, id) ? [{a: "go", l: T("Start the clock", "Uhr starten"), s: "go"}] : []});
      if (s.phase === "turn"){ const card = {k: T("Explain", "Erkläre"), q: s.card.w, size: 34, sub: s.card.f};
        if (id === s.expl) return Object.assign(base, {k: "e" + s.n, timer: tview(G), big: card, stats: [[String(s.pts), T("this turn", "diesen Zug")]], btns: [{a: "skip", l: T("Skip", "Weiter")}, {a: "ok", l: T("Got it", "Richtig"), s: "go"}]});
        if (mine !== t) return Object.assign(base, {k: "w" + s.n, timer: tview(G), big: card, say: T("Forbidden word said?", "Verbotenes Wort gefallen?"), btns: [{a: "bad", l: T("Taboo!", "Tabu!"), s: "bad"}]});
        return Object.assign(base, {k: "g" + s.n, timer: tview(G), emo: "🤔", name: T("Guess!", "Rate!"), say: T(`${nm(api, s.expl)} is explaining.`, `${nm(api, s.expl)} erklärt.`), stats: [[String(s.pts), T("this turn", "diesen Zug")]]}); }
      return Object.assign(base, {k: "s" + s.n, emo: s.won >= 0 ? "🏆" : "⏱️", name: s.won >= 0 ? T(`${teamName(s.won)} wins!`, `${teamName(s.won)} gewinnt!`) : (s.pts > 0 ? "+" : "") + s.pts, nameSize: s.won >= 0 ? 32 : 52, stats,
        list: {rows: (s.log || []).map(([w, k]) => ({l: w, r: k > 0 ? "+1" : k < 0 ? "−1" : "–", c: k > 0 ? "go" : k < 0 ? "bad" : ""}))}, btns: isHost(G, id) ? [{a: "next", l: s.won >= 0 ? T("New game", "Neues Spiel") : T("Next team", "Nächstes Team"), s: "go"}] : []});
    }};

  /* ================= Stadt-Land-Fluss: everyone types on their own phone, the app scores ================= */
  const SLF = ["Stadt", "Land", "Fluss", "Name", "Tier", "Beruf"];
  PG.online.slf = {min: 2, max: 24, opts: [{k: "secs", l: ["Time", "Zeit"], d: 120, c: [[90, "1:30"], [120, "2 min"], [180, "3 min"], [0, ["Until STOP", "Bis STOPP"]]]}, {k: "cats", l: ["Categories", "Kategorien"], d: "6", c: [["4", "Stadt, Land, Fluss, Name"], ["6", ["+ Animal, Job", "+ Tier, Beruf"]], ["8", ["+ Brand, Celebrity", "+ Marke, Promi"]]]}],
    cats(G){ return G.opts.cats === "4" ? SLF.slice(0, 4) : G.opts.cats === "8" ? SLF.concat(["Marke", "Promi"]) : SLF; },
    start(G){ G.s = {n: 0, pts: {}, used: []}; this.round(G); },
    round(G){ const s = G.s, left = D.slf.LETTERS.filter(l => !s.used.includes(l)); s.L = pick(left.length ? left : D.slf.LETTERS); s.used.push(s.L); s.n++; s.ans = {}; s.phase = "write"; s.veto = {}; if (G.opts.secs) timer(G, G.opts.secs); else s.until = 0; snd(G, "reveal"); },
    stop(G){ const s = G.s; if (s.phase !== "write") return; s.phase = "collect"; s.until = now() + 4000; snd(G, "notify"); },
    score(G){ const s = G.s, cats = this.cats(G); s.res = {};
      cats.forEach((c, ci) => { const vals = {}; G.ids.forEach(id => { const raw = ((s.ans[id] || {})["c" + ci] || "").trim(); const ok = raw && norm(raw)[0] === norm(s.L) && !s.veto[id + ":" + ci]; vals[id] = {raw, n: ok ? norm(raw) : null}; });
        const valid = G.ids.filter(id => vals[id].n); G.ids.forEach(id => { const v = vals[id]; v.p = !v.n ? 0 : valid.length === 1 ? 20 : valid.some(o => o !== id && vals[o].n === v.n) ? 5 : 10; }); s.res[ci] = vals; });
      s.round = {}; G.ids.forEach(id => { s.round[id] = cats.reduce((a, c, ci) => a + s.res[ci][id].p, 0); }); },
    tick(G){ const s = G.s;
      if (s.phase === "write" && s.until && now() >= s.until){ this.stop(G); return true; }
      if (s.phase === "collect" && (now() >= s.until || G.ids.every(id => s.ans[id]))){ s.phase = "review"; s.until = 0; this.score(G); snd(G, "xp"); return true; } },
    act(G, id, a){ const s = G.s;
      if (a.a === "stop" && s.phase === "write"){ s.ans[id] = a.f || {}; this.stop(G); }
      else if (a.a === "send" && (s.phase === "collect" || s.phase === "write")) s.ans[id] = a.f || {};
      else if (a.a === "veto" && s.phase === "review" && isHost(G, id)){ s.veto[a.v] = !s.veto[a.v]; this.score(G); }
      else if (a.a === "next" && s.phase === "review" && isHost(G, id)){ G.ids.forEach(x => { s.pts[x] = (s.pts[x] || 0) + s.round[x]; }); this.round(G); }
      else if (a.a === "end" && s.phase === "review" && isHost(G, id)){ G.ids.forEach(x => { s.pts[x] = (s.pts[x] || 0) + s.round[x]; }); s.phase = "final"; snd(G, "cheer"); } },
    view(G, id, api){ const s = G.s, cats = this.cats(G), base = {snd: sndOf(G, id)};
      if (s.phase === "write") return Object.assign(base, {k: "w" + s.n, who: T(`Round ${s.n}`, `Runde ${s.n}`), name: s.L, nameSize: 96, timer: tview(G), input: {act: "stop", fields: cats.map((c, i) => ({k: "c" + i, l: c}))}, btns: [{a: "stop", l: "STOPP!", s: "bad"}], foot: T("Whoever taps STOP ends the round for everyone.", "Wer STOPP tippt, beendet die Runde für alle.")});
      if (s.phase === "collect") return Object.assign(base, {k: "w" + s.n, name: "STOPP!", nameSize: 52, say: T("Pens down! Sending your answers…", "Stifte weg! Deine Antworten werden abgegeben…"), input: {act: "send", fields: cats.map((c, i) => ({k: "c" + i, l: c})), lock: true, auto: !s.ans[id]}});
      if (s.phase === "review"){ const host = isHost(G, id);
        return Object.assign(base, {k: "r" + s.n, who: T(`Letter ${s.L}`, `Buchstabe ${s.L}`), say: T(`You: +${s.round[id]}`, `Du: +${s.round[id]}`), small: host ? T("Tap a wrong answer to give it 0 points.", "Tippe eine falsche Antwort an, um ihr 0 Punkte zu geben.") : T("20 = only you · 10 = unique · 5 = same as someone", "20 = nur du · 10 = einzigartig · 5 = gleich wie jemand"),
          lists: cats.map((c, ci) => ({t: c, rows: G.ids.map(x => { const v = s.res[ci][x]; return {l: nm(api, x), s: v.raw || "–", r: v.p, c: v.p ? "go" : "", d: !v.p, a: host && v.raw ? "veto" : null, v: x + ":" + ci}; })})),
          list: {t: T("Total", "Gesamt"), rows: G.ids.map(x => ({l: nm(api, x), r: (s.pts[x] || 0) + s.round[x]})).sort((a, b) => b.r - a.r)},
          btns: host ? [{a: "next", l: T("Next letter", "Nächster Buchstabe"), s: "go"}, {a: "end", l: T("Finish game", "Spiel beenden"), s: "ghost"}] : []}); }
      return Object.assign(base, {k: "f", emo: "🏆", name: scoreRows(G, api, s.pts)[0].l, nameSize: 32, small: T(`wins after ${s.n} rounds`, `gewinnt nach ${s.n} Runden`), list: {rows: scoreRows(G, api, s.pts)}, btns: isHost(G, id) ? [{a: "again", l: T("New game", "Neues Spiel"), s: "go"}] : []});
    }};
  const slfAct = PG.online.slf.act; PG.online.slf.act = function(G, id, a, api){ if (a.a === "again" && isHost(G, id)) return this.start(G); return slfAct.call(this, G, id, a, api); };

  /* ================= Vier gewinnt: two phones ================= */
  PG.online.four = {min: 2, max: 24, note: ["The first two players play, everyone else watches.", "Die ersten zwei spielen, alle anderen schauen zu."],
    start(G){ const pl = G.s && G.s.pl ? G.s.pl.slice().reverse() : G.ids.slice(0, 2); G.s = {pl, b: Array.from({length: 7}, () => Array(6).fill(0)), turn: 1, over: 0, win: null, last: null, n: ((G.s && G.s.n) || 0) + 1}; },
    act(G, id, a){ const s = G.s; if (a.a === "drop" && !s.over && s.pl[s.turn - 1] === id){ const c = +a.v, r = D.c4.drop(s.b, c, s.turn); if (r < 0) return; s.last = [c, r]; snd(G, "plop");
        const w = D.c4.winLine(s.b, s.turn); if (w){ s.over = s.turn; s.win = w; snd(G, "cheer"); } else if (s.b.every(col => col[5])){ s.over = 3; snd(G, "notify"); } else s.turn = 3 - s.turn; }
      else if (a.a === "again" && isHost(G, id) && s.over) this.start(G); },
    view(G, id, api){ const s = G.s, me = s.pl.indexOf(id) + 1, base = {snd: sndOf(G, id)};
      const head = s.over ? (s.over === 3 ? T("Draw", "Unentschieden") : me === s.over ? T("You win! 🎉", "Du gewinnst! 🎉") : T(`${nm(api, s.pl[s.over - 1])} wins!`, `${nm(api, s.pl[s.over - 1])} gewinnt!`)) : me === s.turn ? T("Your move", "Du bist dran") : T(`${nm(api, s.pl[s.turn - 1])} to move`, `${nm(api, s.pl[s.turn - 1])} ist dran`);
      return Object.assign(base, {k: "c4-" + s.n, say: head, c4: {b: s.b, win: s.win, last: s.last, mine: me, turn: s.turn, over: !!s.over, names: s.pl.map(x => nm(api, x))}, btns: s.over && isHost(G, id) ? [{a: "again", l: T("Play again", "Nochmal"), s: "go"}] : []});
    }};
})();
