/* ===== Chess.nat Nations League (League A), a tab of the Tippspiel: the four groups as live tables, for every team what has to
   happen (every score of the games still to play, ranked with UEFA's tie-breakers: points, then head-to-head, then goal
   difference …), a "what if" with your own scores, and the bracket from the quarter-finals to the Final Four.
   Data: public.nl_state (edge function "tipp", every 5 minutes); live scores come from the Tippspiel's games (every minute). ===== */
(() => {
  const de = () => typeof I18N === "undefined" || I18N.lang === "de";
  const T = (en, dg) => de() ? dg : en;
  const sb = () => window.ChessSite && window.ChessSite.sb;
  const h = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const tap = () => { try { Sound.tap(); } catch(e) {} };
  const hm = t => new Date(t).toLocaleTimeString(de() ? "de-DE" : "en-GB", {hour: "2-digit", minute: "2-digit"});
  const day = t => { const d = new Date(t), dd = Math.round((new Date(d.toDateString()) - new Date(new Date().toDateString())) / 864e5);
    return dd === 0 ? T("Today", "Heute") : dd === 1 ? T("Tomorrow", "Morgen") : dd === -1 ? T("Yesterday", "Gestern") : d.toLocaleDateString(de() ? "de-DE" : "en-GB", {weekday: "short", day: "numeric", month: "numeric"}); };
  /* German grammar for country names: "gegen die Türkei", "die Niederlande gewinnen" */
  const ART = {"Niederlande": "die Niederlande", "Türkei": "die Türkei", "Schweiz": "die Schweiz", "Ukraine": "die Ukraine", "Slowakei": "die Slowakei", "USA": "die USA"};
  const PL = {"Niederlande": 1, "USA": 1};
  const art = n => de() ? (ART[n] || n) : n;
  const wins = n => de() ? (PL[n] ? "gewinnen" : "gewinnt") : (PL[n] ? "win" : "wins");

  /* ---------- the table, with UEFA's order: points; if level, the games between those teams (points, goal difference, goals),
     again for any teams still level; then goal difference, goals, away goals, wins, away wins in all games ---------- */
  const stats = (ids, ms) => { const S = {}; ids.forEach(t => S[t] = {sp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, agf: 0, aw: 0, gd: 0});
    ms.forEach(m => { const H = S[m.h], A = S[m.a]; if (!H || !A) return; const x = +m.sh, y = +m.sa;
      H.sp++; A.sp++; H.gf += x; H.ga += y; A.gf += y; A.ga += x; A.agf += y;
      if (x > y){ H.w++; H.pts += 3; A.l++; } else if (x < y){ A.w++; A.aw++; A.pts += 3; H.l++; } else { H.d++; A.d++; H.pts++; A.pts++; } });
    ids.forEach(t => S[t].gd = S[t].gf - S[t].ga); return S; };
  const cmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i]; return 0; };
  const part = (ids, key) => { const out = []; ids.slice().sort((a, b) => cmp(key(a), key(b))).forEach(t => { const L = out[out.length - 1]; if (L && !cmp(key(L[0]), key(t))) L.push(t); else out.push([t]); }); return out; };
  function order(ids, played){
    const S = stats(ids, played);
    const h2h = g => { if (g.length < 2) return [g];
      const s = stats(g, played.filter(m => g.includes(m.h) && g.includes(m.a))), p = part(g, t => [s[t].pts, s[t].gd, s[t].gf]);
      if (p.length > 1) return p.flatMap(h2h);
      return part(g, t => [S[t].gd, S[t].gf, S[t].agf, S[t].w, S[t].aw]); };
    return {S, blocks: part(ids, t => [S[t].pts]).flatMap(h2h)};
  }
  /* where each team stands: [best, worst] place (two places when even the away wins don't split them: then fair play decides) */
  const places = blocks => { const P = {}; let i = 0; blocks.forEach(b => { b.forEach(t => P[t] = [i + 1, i + b.length]); i += b.length; }); return P; };
  const counted = m => m.state === "post" || m.state === "in";

  /* ---------- every way the games still to play can end ---------- */
  function scenarios(g){
    const done = g.m.filter(m => m.state === "post"), rest = g.m.filter(m => m.state !== "post" && m.state !== "canc"), k = rest.length;
    /* up to two games: every score up to five more goals each; three: up to four; more: just win, draw or defeat */
    const R = k <= 2 ? 6 : k === 3 ? 5 : 0;
    const opts = rest.map(m => { const lh = m.state === "in" ? +m.sh || 0 : 0, la = m.state === "in" ? +m.sa || 0 : 0;
      if (!R){ const mx = Math.max(lh, la); return [[Math.max(lh, la + 1), la], [mx, mx], [lh, Math.max(la, lh + 1)]]; }
      const o = []; for (let x = lh; x < lh + R; x++) for (let y = la; y < la + R; y++) o.push([x, y]); return o; });
    const res = [], acc = [];
    const rec = i => { if (i === k){ const pl = done.concat(rest.map((m, j) => ({h: m.h, a: m.a, sh: acc[j][0], sa: acc[j][1]})));
        res.push({sc: acc.slice(), pos: places(order(g.teams, pl).blocks)}); return; }
      for (const s of opts[i]){ acc[i] = s; rec(i + 1); } };
    rec(0);
    return {rest, res, rough: !R};
  }
  const cls = s => s[0] > s[1] ? 0 : s[0] === s[1] ? 1 : 2;
  /* for one team: by its own result (rows) and the other game's result (columns): which places are possible */
  function teamScen(g, X){
    const sc = g.sc || (g.sc = scenarios(g)), own = sc.rest.findIndex(m => m.h === X || m.a === X);
    const oth = sc.rest.map((m, i) => i).filter(i => sc.rest[i].h !== X && sc.rest[i].a !== X);
    const simple = sc.rest.filter(m => m.h === X || m.a === X).length <= 1 && oth.length <= 1;
    const cells = {}, A = {own: own >= 0 ? sc.rest[own] : null, other: simple && oth.length ? sc.rest[oth[0]] : null, cells, n: 0, nin: 0, nout: 0, top: 0, lo: 9, hi: 0, rough: sc.rough};
    sc.res.forEach(r => { const p = r.pos[X]; if (!p) return;
      const row = own < 0 ? 0 : (sc.rest[own].h === X ? cls(r.sc[own]) : 2 - cls(r.sc[own])), col = A.other ? cls(r.sc[oth[0]]) : 0, key = row + "|" + col;
      const c = cells[key] || (cells[key] = {row, col, n: 0, nin: 0, nout: 0, lo: 9, hi: 0});
      const goals = r.sc.reduce((s, x) => s + x[0] + x[1], 0), isIn = p[1] <= 2, isOut = p[0] >= 3;
      for (const o of [c, A]){ o.n++; if (isIn) o.nin++; if (isOut) o.nout++; o.lo = Math.min(o.lo, p[0]); o.hi = Math.max(o.hi, p[1]); }
      if (p[1] === 1) A.top++;
      if (isIn && (!c.exIn || goals < c.exIn.g)) c.exIn = {g: goals, sc: r.sc};
      if (isOut && (!c.exOut || goals < c.exOut.g)) c.exOut = {g: goals, sc: r.sc}; });
    Object.values(cells).forEach(c => c.st = c.n === c.nin ? "in" : c.n === c.nout ? "out" : "mix");
    A.st = A.n && A.n === A.nin ? "in" : A.n && A.n === A.nout ? "out" : "open"; A.first = A.n > 0 && A.top === A.n;
    return A;
  }
  /* "die Türkei gegen Frankreich gewinnt", "Belgien gegen Italien nicht gewinnt" … (for the columns in s: 0 home win, 1 draw, 2 away win) */
  function cond(m, s){
    if (!m) return T("the other games go right", "die anderen Spiele passen");
    const H = NL.nm(m.h), A = NL.nm(m.a), k = s.slice().sort().join("");
    if (de()) return {"0": `${art(H)} gegen ${art(A)} ${wins(H)}`, "2": `${art(A)} gegen ${art(H)} ${wins(A)}`, "1": `${art(H)} und ${art(A)} unentschieden spielen`,
      "01": `${art(A)} gegen ${art(H)} nicht ${wins(A)}`, "12": `${art(H)} gegen ${art(A)} nicht ${wins(H)}`, "02": `${H}–${A} nicht unentschieden endet`}[k] || "";
    return {"0": `${H} beat ${A}`, "2": `${A} beat ${H}`, "1": `${H} and ${A} draw`, "01": `${A} don't beat ${H}`, "12": `${H} don't beat ${A}`, "02": `${H}–${A} isn't a draw`}[k] || "";
  }
  const RES = () => [T("Win", "Sieg"), T("Draw", "Remis"), T("Defeat", "Niederlage")];
  const placeTxt = (lo, hi) => lo === hi ? (lo === 3 ? T(" (3rd → play-off)", " (Platz 3 → Relegation)") : lo === 4 ? T(" (4th → relegated)", " (Platz 4 → Abstieg)") : "") : "";
  /* the sentences: mode "in" = what has to happen so X goes through, "out" = so X goes out */
  function says(g, X, A, mode){
    const name = NL.nm(X), opp = A.own ? NL.nm(A.own.h === X ? A.own.a : A.own.h) : null;
    if (A.st === "in") return [mode === "in" ? `✅ ${A.first ? T(`${name} have won the group.`, `${name} ist sicher Gruppensieger.`) : T(`${name} are through to the quarter-finals.`, `${name} ist sicher im Viertelfinale.`)}`
      : T(`😒 ${name} are through for sure. Sadly.`, `😒 ${name} ist sicher weiter. Leider.`)];
    if (A.st === "out") return [mode === "in" ? T(`❌ ${name} can't reach the quarter-finals any more.`, `❌ ${name} kann das Viertelfinale nicht mehr erreichen.`) + placeTxt(A.lo, A.hi)
      : T(`🎉 ${name} are out!`, `🎉 ${name} ist raus!`) + placeTxt(A.lo, A.hi)];
    const rows = [0, 1, 2].filter(r => Object.values(A.cells).some(c => c.row === r)), lines = [];
    rows.forEach(r => { const cs = Object.values(A.cells).filter(c => c.row === r), ins = cs.filter(c => c.st === "in").map(c => c.col), outs = cs.filter(c => c.st === "out").map(c => c.col), mix = cs.filter(c => c.st === "mix").map(c => c.col);
      const lo = Math.min(...cs.map(c => c.lo)), hi = Math.max(...cs.map(c => c.hi)), first = cs.every(c => c.hi === 1);
      let v, ic;
      if (ins.length === cs.length){ ic = mode === "in" ? "✅" : "😒"; v = mode === "in" ? T("through for sure", "sicher weiter") + (first ? T(" as group winners", " als Gruppensieger") : "") : T("through", "weiter"); }
      else if (outs.length === cs.length){ ic = mode === "in" ? "❌" : "😈"; v = (mode === "in" ? T("out", "raus") : T("out!", "raus!")) + placeTxt(lo, hi); }
      else { const p = []; ic = "🤞";
        if (mode === "in" && ins.length) p.push(`${T("through only if", "weiter nur, wenn")} ${cond(A.other, ins)}`);
        if (mode === "out" && outs.length){ ic = "😈"; p.push(`${T("out if", "raus, wenn")} ${cond(A.other, outs)}`); }
        if (mix.length) p.push(`${T("the goals decide if", "die Tore entscheiden, wenn")} ${cond(A.other, mix)}`);
        if (!p.length) p.push(mode === "in" ? T("out", "raus") : T("through", "weiter"));
        v = p.join(T("; ", "; ")); }
      const L = lines.find(x => x.v === v && x.ic === ic); if (L) L.r.push(r); else lines.push({r: [r], v, ic}); });
    return lines.map(L => `${L.ic} ${A.own ? L.r.map(r => RES()[r]).join(T(" or ", " oder ")) + (opp ? ` ${T("against", "gegen")} ${art(opp)}` : "") : T("Done playing", "Fertig gespielt")}: ${L.v}`);
  }

  const NL = window.NL = {
    d: null, t: 0, sub: (() => { try { return localStorage.getItem("chessnat-nl-sub") || "groups"; } catch(e) { return "groups"; } })(), what: {},
    nm(id){ const t = this.d && this.d.teams && this.d.teams[id]; return t ? t.name : "?"; },
    logo(id, cl = "nl-lg"){ const t = this.d && this.d.teams && this.d.teams[id]; return t && t.logo ? `<img class="${cl}" src="${h(t.logo)}" alt="" loading="lazy">` : `<span class="${cl} nl-lg0"></span>`; },
    byName(n){ const t = this.d && Object.values(this.d.teams || {}).find(x => x.name === n); return t ? t.id : null; },
    fromCache(){ if (this.d) return true; try { const c = JSON.parse(localStorage.getItem("chessnat-nl") || "null"); if (c && Array.isArray(c.matches)){ this.d = c; return true; } } catch(e) {} return false; },
    async load(force){
      if (!force && Date.now() - this.t < 25000) return; const c = sb(); if (!c) return;
      const {data, error} = await c.from("nl_state").select("data,updated_at").eq("id", "A").limit(1); if (error || !data || !data[0]) return;
      this.d = data[0].data; this.t = Date.now(); this.memo = null; try { localStorage.setItem("chessnat-nl", JSON.stringify(this.d)); } catch(e) {}
    },
    /* the games, with the Tippspiel's fresher live score where it has the game */
    matches(){ const by = {}; ((window.Tipp && Tipp.ev) || []).forEach(e => by[e.id] = e);
      return ((this.d && this.d.matches) || []).map(m => { const e = by[m.id]; if (!e || (e.state === "pre" && m.state !== "pre")) return m;
        return Object.assign({}, m, {state: e.state, sh: e.score_h, sa: e.score_a, clock: e.clock}); }); },
    groups(){
      const M = this.matches(), sig = JSON.stringify(M.map(m => [m.state, m.sh, m.sa]));
      if (this.memo && this.memo.sig === sig) return this.memo.G;
      const G = {}; M.filter(m => m.grp).forEach(m => { const g = G[m.grp] || (G[m.grp] = {id: m.grp, teams: [], m: []}); g.m.push(m); [m.h, m.a].forEach(t => { if (!g.teams.includes(t)) g.teams.push(t); }); });
      const list = Object.values(G).sort((a, b) => a.id.localeCompare(b.id));
      list.forEach(g => { const pl = g.m.filter(counted), o = order(g.teams, pl); g.now = o; g.P = places(o.blocks);
        g.live = g.m.filter(m => m.state === "in"); g.left = g.m.filter(m => m.state !== "post" && m.state !== "canc"); g.A = {};
        g.teams.forEach(t => g.A[t] = teamScen(g, t)); });
      this.memo = {sig, G: list}; return list;
    },
    groupOf(t){ return this.groups().find(g => g.teams.includes(t)); },

    /* ---------- the tab ---------- */
    html(){
      if (!this.d) return `<div class="tp-empty">${this.err ? `📡 ${T("No connection.", "Keine Verbindung.")}` : T("Loading…", "Lädt…")}</div>`;
      const sub = `<div class="seg nl-sub">${[["groups", T("Groups", "Gruppen")], ["tree", T("Bracket", "Turnierbaum")]].map(([k, l]) => `<button data-nlsub="${k}" class="${this.sub === k ? "on" : ""}">${l}</button>`).join("")}</div>`;
      return sub + (this.sub === "tree" ? this.treeHTML() : this.groupsHTML());
    },
    groupsHTML(){
      const G = this.groups(); if (!G.length) return `<div class="tp-empty">${T("No Nations League games yet.", "Noch keine Nations-League-Spiele.")}</div>`;
      const live = G.flatMap(g => g.live).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
      let out = live.length ? `<div class="tp-day live">● Live</div>` + live.map(m => this.gameRow(m)).join("") : "";
      out += this.hero();
      out += G.map(g => this.groupHTML(g)).join("");
      out += `<div class="nl-leg"><span class="z12"></span>${T("Quarter-finals", "Viertelfinale")}<span class="z3"></span>${T("Play-off (League B)", "Relegation (gegen Liga B)")}<span class="z4"></span>${T("Relegated", "Abstieg")}</div>
        <div class="nl-note">${T("Level on points: the games between those teams count first (points, goal difference, goals), then all games. Tap a team: what has to happen?", "Bei Punktgleichheit zählen zuerst die Spiele gegeneinander (Punkte, Tordifferenz, Tore), dann alle Spiele. Tipp auf ein Team: Was muss passieren?")}</div>`;
      return out;
    },
    /* Germany: what has to happen to go through; France: what has to happen so they go out */
    hero(){
      const ger = this.byName("Deutschland"), fra = this.byName("Frankreich"), out = [];
      const card = (X, mode) => { const g = this.groupOf(X); if (!g) return ""; const A = g.A[X], p = g.P[X], lv = g.live.some(m => m.h === X || m.a === X);
        const head = mode === "in" ? T(`${this.nm(X)} go through if …`, `${this.nm(X)} kommt weiter, wenn …`) : T(`${this.nm(X)} go out if …`, `${this.nm(X)} fliegt raus, wenn …`);
        const now = `${lv ? `<i class="tp-dot"></i>${T("Live now", "Live gerade")}` : T("Now", "Stand jetzt")}: ${T("place", "Platz")} ${p[0]}${p[1] > p[0] ? "–" + p[1] : ""}`;
        return `<button class="nl-hero ${mode} ${A.st}" data-nlteam="${h(X)}"><div class="nl-hh">${this.logo(X, "nl-lg big")}<b>${A.st === "open" ? h(head) : h(this.nm(X))}</b><span>${now}</span></div>
          <div class="nl-says">${says(g, X, A, mode).map(s => `<div>${h(s)}</div>`).join("")}</div></button>`; };
      if (ger) out.push(card(ger, "in")); if (fra) out.push(card(fra, "out"));
      return out.join("");
    },
    gameRow(m){
      const lv = m.state === "in", p = window.Tipp ? Tipp.mine(m.id) : null, ev = window.Tipp && Tipp.ev.find(e => e.id === m.id);
      const right = lv || m.state === "post" ? (p ? `<span class="nl-mt">${T("Your tip", "Dein Tipp")} <b>${p.sh}:${p.sa}</b></span>` : "") : ev && Date.parse(m.date) > Date.now() ? `<span class="nl-go ${p ? "done" : ""}">${p ? `✓ ${p.sh}:${p.sa}` : T("Tip", "Tippen")}</span>` : "";
      return `<button class="nl-m ${lv ? "live" : ""}" data-nlgo="${h(m.id)}"><span class="nl-mtm">${lv ? `<i class="tp-dot"></i>${h(m.clock || "Live")}` : `${h(day(m.date))}<br>${hm(m.date)}`}</span>
        <span class="nl-mn"><span class="nl-nm r">${h(this.nm(m.h))}</span>${this.logo(m.h)}<b>${m.sh == null ? "–:–" : `${m.sh}:${m.sa}`}</b>${this.logo(m.a)}<span class="nl-nm">${h(this.nm(m.a))}</span></span>${right}</button>`;
    },
    tableHTML(g, P, S, me, opt = {}){
      const order = g.teams.slice().sort((a, b) => P[a][0] - P[b][0] || this.nm(a).localeCompare(this.nm(b)));
      return `<div class="nl-tb"><div class="nl-tr hd"><span>#</span><span>${T("Team", "Team")}</span><span>${T("P", "Sp")}</span><span>${T("Goals", "Tore")}</span><span>+/−</span><span>${T("Pts", "Pkt")}</span></div>`
        + order.map(t => { const s = S[t], p = P[t], A = g.A[t], lv = !opt.sim && g.live.find(m => m.h === t || m.a === t);
          const q = opt.sim ? "" : A.st === "in" ? `<i class="nl-q in">${A.first ? "1." : "✓"}</i>` : A.st === "out" ? `<i class="nl-q out">✗</i>` : "";
          return `<${opt.sim ? "div" : "button"} class="nl-tr z${p[0]} ${t === me ? "me" : ""}" ${opt.sim ? "" : `data-nlteam="${h(t)}"`}><span class="nl-rk">${p[0]}${p[1] > p[0] ? "*" : ""}</span><span class="nl-tm">${this.logo(t)}<span class="nl-tn">${h(this.nm(t))}</span>${q}${lv ? `<i class="tp-dot"></i>` : ""}</span>
            <span>${s.sp}</span><span>${s.gf}:${s.ga}</span><span>${s.gd > 0 ? "+" : ""}${s.gd}</span><b>${s.pts}</b></${opt.sim ? "div" : "button"}>`; }).join("") + `</div>`;
    },
    groupHTML(g){
      const left = g.left.filter(m => m.state !== "in").sort((a, b) => Date.parse(a.date) - Date.parse(b.date)), ger = g.teams.includes(this.byName("Deutschland"));
      return `<div class="nl-g ${ger ? "ger" : ""}"><div class="nl-gh"><b>${T("Group", "Gruppe")} ${h(g.id)}</b><span>${g.left.length ? `${g.left.length} ${g.left.length === 1 ? T("game left", "Spiel offen") : T("games left", "Spiele offen")}` : T("finished", "fertig")}</span></div>
        ${this.tableHTML(g, g.P, g.now.S)}${left.length ? `<div class="nl-left">${left.map(m => this.gameRow(m)).join("")}</div>` : ""}</div>`;
    },

    /* ---------- the bracket ---------- */
    treeHTML(){
      const G = this.groups(), ko = (this.d && this.d.ko) || [];
      const rnd = r => /quarter/i.test(r) ? "qf" : /semi/i.test(r) ? "sf" : /third|3rd/i.test(r) ? "3rd" : /final/i.test(r) ? "f" : "qf";
      const ties = {qf: [], sf: [], f: [], "3rd": []};
      ko.forEach(m => { const k = rnd(m.round || ""), t = ties[k].find(x => (x.a === m.h && x.b === m.a) || (x.a === m.a && x.b === m.h));
        if (t) t.legs.push(m); else ties[k].push({a: m.h, b: m.a, legs: [m]}); });
      const sure = (g, t, place) => { const A = g.A[t]; return place === 1 ? A.first : A.st === "in" && A.lo === 2 && A.hi === 2; };
      const slot = (t, label, ok, sc) => t ? `<button class="nl-sl ${ok ? "ok" : ""}" data-nlteam="${h(t)}">${this.logo(t)}<span class="nl-nm">${h(this.nm(t))}</span>${sc != null ? `<b>${sc}</b>` : ok ? `<i>✓</i>` : `<i class="q">?</i>`}</button>`
        : `<div class="nl-sl tbd"><span class="nl-nm">${h(label)}</span></div>`;
      /* a tie (two legs in the quarter-finals): goals over both games, penalties if needed */
      const tie = (x, i, lbl) => { if (!x) return `<div class="nl-bx tbd">${lbl[2] ? slot(lbl[2], "", lbl[3]) : slot(null, lbl[0])}${slot(null, lbl[1])}</div>`;
        const g = side => x.legs.reduce((s, m) => s + (m.state === "pre" ? 0 : (m.h === side ? +m.sh : +m.sa) || 0), 0), started = x.legs.some(m => m.state !== "pre");
        const last = x.legs[x.legs.length - 1], pen = last && last.pen && last.pen[0] != null ? (last.h === x.a ? last.pen : [last.pen[1], last.pen[0]]) : null;
        const won = x.legs.every(m => m.state === "post") && last ? (last.win === "h" ? last.h : last.win === "a" ? last.a : null) : null;
        const lv = x.legs.some(m => m.state === "in"), id = (x.legs.find(m => m.state !== "post") || last).id;
        return `<div class="nl-bx ${lv ? "live" : ""}" data-nlgo="${h(id)}">${slot(x.a, "", won === x.a, started ? g(x.a) + (pen ? ` (${pen[0]})` : "") : null)}${slot(x.b, "", won === x.b, started ? g(x.b) + (pen ? ` (${pen[1]})` : "") : null)}
          <small>${lv ? `<i class="tp-dot"></i>Live` : x.legs.length > 1 ? T("2 legs", "Hin & Rück") : h(day(x.legs[0].date))}</small></div>`; };
      /* before the draw: group winners and runners-up as they stand */
      const seeds = G.map(g => { const o = g.teams.slice().sort((a, b) => g.P[a][0] - g.P[b][0]); return {g, w: o[0], r: o[1]}; });
      let pre = "";
      if (!ties.qf.length) pre = `<div class="nl-tl">${T("In the quarter-finals – as it stands", "Im Viertelfinale – Stand jetzt")}</div><div class="nl-seeds">${seeds.map(s => `<div class="nl-seed"><small>${T("Group", "Gruppe")} ${h(s.g.id)}</small>${slot(s.w, "", sure(s.g, s.w, 1))}${slot(s.r, "", sure(s.g, s.r, 2))}</div>`).join("")}</div>
        <div class="nl-note">${T("✓ = certain. Quarter-finals in March 2027 (two legs): each group winner meets a runner-up from another group, drawn after the league phase. The four winners play the Final Four in June 2027.", "✓ = sicher. Viertelfinale im März 2027 (Hin- und Rückspiel): jeder Gruppensieger gegen einen Zweiten aus einer anderen Gruppe, ausgelost nach der Gruppenphase. Die vier Sieger spielen im Juni 2027 das Final Four.")}</div>`;
      const col = (n, list, lbl) => `<div class="nl-col">${Array.from({length: n}, (_, i) => tie(list[i], i, lbl(i))).join("")}</div>`;
      const qfL = i => { const s = seeds[i]; return [T("Group winner", "Gruppensieger"), T("Runner-up (draw)", "Zweiter (Los)"), s && s.w, s && sure(s.g, s.w, 1)]; };
      return pre + `<div class="nl-br"><div class="nl-ct">${T("Quarter-finals", "Viertelfinale")}</div><div class="nl-ct">${T("Semi-finals", "Halbfinale")}</div><div class="nl-ct">${T("Final", "Finale")}</div>
        ${col(4, ties.qf, qfL)}${col(2, ties.sf, () => [T("QF winner", "Sieger VF"), T("QF winner", "Sieger VF")])}${col(1, ties.f, () => [T("SF winner", "Sieger HF"), T("SF winner", "Sieger HF")])}</div><div class="nl-cup">🏆 ${T("Nations League winner", "Nations-League-Sieger")}: <b>${(() => { const f = ties.f[0], m = f && f.legs[0]; return m && m.state === "post" && m.win ? h(this.nm(m.win === "h" ? m.h : m.a)) : "?"; })()}</b></div>`;
    },

    /* ---------- taps ---------- */
    wire(body, view){
      body.querySelectorAll("[data-nlsub]").forEach(b => b.onclick = () => { if (this.sub === b.dataset.nlsub) return; tap(); this.sub = b.dataset.nlsub; try { localStorage.setItem("chessnat-nl-sub", this.sub); } catch(e) {} view.render(true); });
      body.querySelectorAll("[data-nlteam]").forEach(b => b.onclick = ev => { ev.stopPropagation(); tap(); this.sheet(b.dataset.nlteam, view); });
      body.querySelectorAll("[data-nlgo]").forEach(b => b.onclick = () => { tap(); this.go(b.dataset.nlgo, view); });
    },
    /* a game: still open → tip it (the Tippen tab, scrolled to it); started → everybody's tips */
    go(id, view){ const e = window.Tipp && Tipp.ev.find(x => x.id === id); if (!e) return;
      if (e.state === "pre" && Date.parse(e.start_at) > Date.now()){ const b = view.main.querySelector('[data-tab="tip"]'); if (b) b.click(); setTimeout(() => view.focus(id), 60); }
      else view.detail(id); },

    /* ---------- one team: what has to happen, and "what if" with your own scores ---------- */
    sheet(X, view){
      const g = this.groupOf(X); if (!g) return; const A = g.A[X], p = g.P[X], lv = g.live.some(m => m.h === X || m.a === X);
      const st = A.st === "in" ? (A.first ? T("Group winners ✅", "Gruppensieger ✅") : T("Quarter-finals ✅", "Viertelfinale ✅")) : A.st === "out" ? T("No quarter-final ❌", "Kein Viertelfinale ❌") + placeTxt(A.lo, A.hi) : T("Still open", "Noch offen");
      const mode = X === this.byName("Frankreich") ? "out" : "in";
      const nowCls = p[1] <= 2 ? "ok" : p[0] >= 3 ? "bad" : "";
      const mx = this.matrix(g, X, A);
      const sim = g.left.length ? `<div class="nl-h4">${T("What if?", "Was wäre wenn?")}</div><div class="nl-note" style="margin-top:0">${T("Set the scores yourself – the table follows.", "Stell die Ergebnisse selbst ein – die Tabelle rechnet mit.")}</div><div class="nl-sim" data-sim></div>` : "";
      const html = `<div class="nl-sh"><div class="nl-shh">${this.logo(X, "nl-lg big")}<div><b>${h(this.nm(X))}</b><small>${T("Group", "Gruppe")} ${h(g.id)} · ${h(st)}</small></div></div>
        <div class="nl-now ${nowCls}">${lv ? `<i class="tp-dot"></i>${T("Live now", "Live gerade")}` : T("Now", "Stand jetzt")}: ${T("place", "Platz")} ${p[0]}${p[1] > p[0] ? "–" + p[1] : ""} · ${g.now.S[X].pts} ${T("pts", "Punkte")}</div>
        <div class="nl-h4">${mode === "out" ? T(`What has to happen so ${this.nm(X)} go out?`, `Was muss passieren, damit ${this.nm(X)} rausfliegt?`) : T(`What has to happen so ${this.nm(X)} go through?`, `Was muss passieren, damit ${this.nm(X)} weiterkommt?`)}</div>
        <div class="nl-says">${says(g, X, A, mode).map(s => `<div>${h(s)}</div>`).join("")}</div>${mx}${A.rough ? `<div class="nl-note">${T("Several games left: counted as win, draw or defeat; goals can still change things.", "Mehrere Spiele offen: gerechnet mit Sieg, Remis, Niederlage; die Tore können noch etwas ändern.")}</div>` : ""}
        ${sim}</div>`;
      const s = detailSheet(html), el = s.el.querySelector("[data-sim]");
      if (el) this.simRender(el, g, X);
    },
    /* rows: X's own result, columns: the other game – the possible places in each */
    matrix(g, X, A){
      const cs = Object.values(A.cells); if (!cs.length || (cs.length === 1 && !A.own)) return "";
      const rows = [0, 1, 2].filter(r => cs.some(c => c.row === r)), cols = A.other ? [0, 1, 2] : [0];
      const cur = m => m && m.state === "in" ? cls([+m.sh, +m.sa]) : null, ro = A.own ? cur(A.own) : null, rown = ro == null ? null : (A.own.h === X ? ro : 2 - ro), co = A.other ? cur(A.other) : 0;
      const opp = A.own ? this.nm(A.own.h === X ? A.own.a : A.own.h) : "";
      const head = A.other ? [`${this.nm(A.other.h)} ${T("win", "gewinnt")}`, T("Draw", "Remis"), `${this.nm(A.other.a)} ${T("win", "gewinnt")}`] : [T("whatever else", "egal wie die anderen spielen")];
      const cell = c => { if (!c) return `<span class="nl-c"></span>`; const t = c.lo === c.hi ? c.lo + "." : `${c.lo}.–${c.hi}.`;
        const sub = c.st === "in" ? T("QF", "VF") : c.st === "out" ? (c.lo >= 4 ? T("down", "Abstieg") : c.hi <= 3 ? T("play-off", "Releg.") : T("out", "raus")) : T("goals", "Tore");
        const now = rown != null && c.row === rown && (co != null && c.col === co);
        return `<span class="nl-c ${c.st} ${now ? "now" : ""}"><b>${t}</b><small>${sub}</small></span>`; };
      return `<div class="nl-mx" style="grid-template-columns:minmax(64px,auto) repeat(${cols.length},1fr)"><span class="nl-mh l">${A.own ? T("vs ", "gegen ") + h(art(opp)) : ""}</span>${head.map(x => `<span class="nl-mh">${h(x)}</span>`).join("")}
        ${rows.map(r => `<span class="nl-mr">${A.own ? RES()[r] : ""}</span>${cols.map(c => cell(A.cells[r + "|" + c])).join("")}`).join("")}</div>`;
    },
    simRender(el, g, X){
      const val = m => this.what[m.id] || (m.state === "in" ? [+m.sh || 0, +m.sa || 0] : null);
      const pl = g.m.filter(m => m.state === "post").concat(g.left.map(m => { const v = val(m); return v ? {h: m.h, a: m.a, sh: v[0], sa: v[1]} : null; }).filter(Boolean));
      const o = order(g.teams, pl), P = places(o.blocks), p = P[X];
      const pl2 = `${T("place", "Platz")} ${p[0]}${p[1] > p[0] ? "–" + p[1] : ""}`;
      const verdict = p[1] <= 2 ? `${pl2} · ${p[1] === 1 ? T("group winners ✅", "Gruppensieger ✅") : T("quarter-finals ✅", "Viertelfinale ✅")}` : p[0] >= 3 ? `${pl2} → ${p[0] === 3 && p[1] === 3 ? T("play-off ⚠️", "Relegation ⚠️") : p[0] >= 4 ? T("relegated ⬇️", "Abstieg ⬇️") : T("out ❌", "raus ❌")}` : `${pl2} · ${T("level – fair play decides", "gleichauf – Fairplay entscheidet")}`;
      const row = (m, s, t, v) => `<div class="tq-r">${this.logo(t)}<span class="tq-n">${h(this.nm(t))}</span><div class="tq-st" data-s="${s}"><button data-d="-1" aria-label="−">−</button><b class="${v ? "" : "e"}">${v ? v[s === "h" ? 0 : 1] : "?"}</b><button data-d="1" aria-label="+">+</button></div></div>`;
      el.innerHTML = g.left.map(m => { const v = val(m); return `<div class="nl-sm" data-m="${h(m.id)}"><div class="nl-smt">${m.state === "in" ? `<i class="tp-dot"></i>${T("Live", "Live")} ${h(m.clock || "")}` : `${h(day(m.date))} · ${hm(m.date)}`}</div>${row(m, "h", m.h, v)}${row(m, "a", m.a, v)}</div>`; }).join("")
        + `<div class="nl-simv ${p[1] <= 2 ? "ok" : p[0] >= 3 ? "bad" : ""}">${h(this.nm(X))}: ${h(verdict)}</div>`
        + this.tableHTML(Object.assign({}, g, {live: []}), P, o.S, X, {sim: true})
        + `<div class="nl-simr"><button class="btn ghost sm" data-reset>↺ ${T("Back to now", "Zurück auf Stand jetzt")}</button></div>`;
      el.querySelectorAll(".nl-sm").forEach(row => { const m = g.left.find(x => x.id === row.dataset.m);
        row.querySelectorAll("button[data-d]").forEach(b => b.onclick = () => { tap(); const s = b.closest(".tq-st").dataset.s, d = +b.dataset.d, v0 = val(m);
          let v = v0 ? v0.slice() : null; if (!v){ v = [0, 0]; if (d > 0) v[s === "h" ? 0 : 1] = 1; } else { const i = s === "h" ? 0 : 1; v[i] = Math.max(0, Math.min(15, v[i] + d)); }
          this.what[m.id] = v; this.simRender(el, g, X); }); });
      const r = el.querySelector("[data-reset]"); if (r) r.onclick = () => { tap(); g.left.forEach(m => delete this.what[m.id]); this.simRender(el, g, X); };
    },
  };
  /* for the tests: the ranking on its own */
  NL._order = (ids, ms) => places(order(ids, ms).blocks);

  const css = document.createElement("style"); css.textContent = `
.nl-sub{display:flex;width:100%;margin:12px 0 4px}.nl-sub button{flex:1}
.nl-hero{display:block;width:100%;text-align:left;font:inherit;color:var(--fg);background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:12px 14px;margin:10px 0 4px;cursor:pointer}
.nl-hero.in{border-color:color-mix(in srgb,#2BA84A 45%,var(--line))}.nl-hero.out{border-color:color-mix(in srgb,#5b6cff 45%,var(--line))}
.nl-hh{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.nl-hh b{flex:1;min-width:150px;font:900 16px var(--body)}.nl-hh span{font:800 12px var(--body);color:var(--muted)}
.nl-says{display:flex;flex-direction:column;gap:5px;margin-top:8px;font:700 14px/1.35 var(--body)}
.nl-lg{width:22px;height:22px;object-fit:contain;flex:none;border-radius:3px}.nl-lg.big{width:34px;height:34px}.nl-lg0{display:inline-block;border-radius:50%;background:var(--panel-2)}
.nl-g{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:10px 10px 8px;margin-top:12px}.nl-g.ger{border-color:color-mix(in srgb,#DC052D 40%,var(--line))}
.nl-gh{display:flex;justify-content:space-between;align-items:baseline;padding:0 4px 6px}.nl-gh b{font:900 16px var(--display)}.nl-gh span{font:700 12px var(--body);color:var(--muted)}
.nl-tb{display:flex;flex-direction:column;gap:3px}
.nl-tr{display:grid;grid-template-columns:22px minmax(0,1fr) 26px 46px 34px 34px;align-items:center;gap:4px;width:100%;padding:7px 6px;border:0;border-left:4px solid transparent;border-radius:10px;background:var(--panel-2);color:var(--fg);font:700 14px var(--body);text-align:center;cursor:pointer}
.nl-tr.hd{background:none;cursor:default;font:800 11px var(--body);color:var(--muted);text-transform:uppercase;letter-spacing:.04em;padding:0 6px}.nl-tr.hd span:nth-child(2){text-align:left}
.nl-tr.z1,.nl-tr.z2{border-left-color:#2BA84A}.nl-tr.z3{border-left-color:#E9A23B}.nl-tr.z4{border-left-color:#E5484D}.nl-tr.me{outline:2px solid color-mix(in srgb,var(--go) 70%,transparent)}
.nl-tr b{font:900 16px var(--display)}.nl-rk{color:var(--muted);font-weight:900}
.nl-tm{display:flex;align-items:center;gap:7px;min-width:0;text-align:left}.nl-tn{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:800}
.nl-q{font:900 11px var(--body);font-style:normal;border-radius:999px;padding:1px 6px;flex:none}.nl-q.in{background:#2BA84A;color:#fff}.nl-q.out{background:var(--panel-3,var(--panel));color:var(--muted)}
.nl-left{display:flex;flex-direction:column;gap:5px;margin-top:8px}
.nl-m{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--fg);font:inherit;cursor:pointer;margin-bottom:6px;text-align:left}
.nl-left .nl-m{margin:0;background:var(--panel-2);border-color:transparent}.nl-m.live{border-color:color-mix(in srgb,#e5484d 50%,var(--line))}
.nl-mtm{flex:none;min-width:44px;font:800 11.5px/1.25 var(--body);color:var(--muted);text-align:center}.nl-m.live .nl-mtm{color:#e5484d}
.nl-mn{flex:1;min-width:0;display:flex;align-items:center;gap:6px;font:800 14px var(--body)}.nl-mn .nl-nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nl-mn .nl-nm.r{text-align:right}
.nl-mn b{flex:none;font:900 18px var(--display);min-width:40px;text-align:center;font-variant-numeric:tabular-nums}
.nl-go{flex:none;background:var(--go);color:#fff;font:900 13px var(--body);padding:6px 10px;border-radius:10px}.nl-go.done{background:var(--panel-3,var(--panel));color:var(--go-hi,var(--go))}.nl-mt{flex:none;font:700 12px var(--body);color:var(--muted)}.nl-mt b{color:var(--fg)}
.nl-leg{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;margin:14px 4px 0;font:700 12px var(--body);color:var(--muted)}.nl-leg span{width:10px;height:10px;border-radius:3px}.nl-leg .z12{background:#2BA84A}.nl-leg .z3{background:#E9A23B}.nl-leg .z4{background:#E5484D}
.nl-note{margin:8px 4px 0;font:600 12.5px/1.45 var(--body);color:var(--muted)}
.nl-sh{padding:0 2px 6px}.nl-shh{display:flex;align-items:center;gap:12px;margin:2px 0 10px}.nl-shh b{display:block;font:900 20px var(--display)}.nl-shh small{color:var(--muted);font:700 13px var(--body)}
.nl-now{padding:9px 12px;border-radius:12px;background:var(--panel-2);font:800 14px var(--body)}.nl-now.ok{background:color-mix(in srgb,#2BA84A 18%,var(--panel-2))}.nl-now.bad{background:color-mix(in srgb,#E5484D 16%,var(--panel-2))}
.nl-h4{font:900 15px var(--body);margin:16px 2px 6px}
.nl-mx{display:grid;gap:4px;margin-top:12px;align-items:stretch}.nl-mh{font:800 11px/1.2 var(--body);color:var(--muted);text-align:center;align-self:end;padding-bottom:2px}.nl-mh.l{text-align:left}
.nl-mr{font:800 12.5px var(--body);align-self:center}
.nl-c{display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:10px;padding:6px 2px;background:var(--panel-2);min-height:44px}.nl-c b{font:900 16px var(--display)}.nl-c small{font:800 10.5px var(--body);opacity:.85}
.nl-c.in{background:color-mix(in srgb,#2BA84A 30%,var(--panel-2))}.nl-c.out{background:color-mix(in srgb,#E5484D 24%,var(--panel-2))}.nl-c.mix{background:repeating-linear-gradient(135deg,color-mix(in srgb,#2BA84A 26%,var(--panel-2)) 0 8px,color-mix(in srgb,#E9A23B 26%,var(--panel-2)) 8px 16px)}
.nl-c.now{outline:2px solid var(--fg)}
.nl-sim{display:flex;flex-direction:column;gap:6px}.nl-sm{background:var(--panel-2);border-radius:14px;padding:6px 10px 4px}.nl-sm .tq-r{padding:3px 0}.nl-sm .tq-st button{background:var(--panel);width:38px;height:38px}
.nl-smt{font:700 11.5px var(--body);color:var(--muted)}
.nl-simv{padding:9px 12px;border-radius:12px;background:var(--panel-2);font:900 14px var(--body);margin-top:4px}.nl-simv.ok{background:color-mix(in srgb,#2BA84A 22%,var(--panel-2))}.nl-simv.bad{background:color-mix(in srgb,#E5484D 18%,var(--panel-2))}
.nl-sim .nl-tr{cursor:default}.nl-simr{display:flex;justify-content:center;margin-top:4px}
.nl-tl{font:800 12px var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:16px 2px 7px}
.nl-seeds{display:grid;grid-template-columns:1fr 1fr;gap:8px}.nl-seed{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:8px;display:flex;flex-direction:column;gap:5px}.nl-seed small{font:800 11px var(--body);color:var(--muted)}
.nl-sl{display:flex;align-items:center;gap:6px;width:100%;border:0;border-radius:9px;background:var(--panel-2);color:var(--fg);padding:5px 7px;font:800 13px var(--body);cursor:pointer;text-align:left;min-height:32px}
.nl-sl .nl-nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}.nl-sl i{font-style:normal;font-weight:900;color:#2BA84A}.nl-sl i.q{color:var(--muted)}.nl-sl b{font:900 15px var(--display)}.nl-sl.ok{background:color-mix(in srgb,#2BA84A 20%,var(--panel-2))}
.nl-sl.tbd{cursor:default;color:var(--muted);font-weight:700;font-size:11.5px;border:1px dashed var(--line);background:none;min-height:28px}
.nl-br{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:6px 8px;margin-top:18px}
.nl-col{display:flex;flex-direction:column;justify-content:space-around;gap:8px;position:relative}.nl-ct{font:800 11px var(--body);color:var(--muted);text-transform:uppercase;letter-spacing:.05em;text-align:center;align-self:end}
.nl-bx{display:flex;flex-direction:column;gap:4px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:5px;position:relative;cursor:pointer}.nl-bx.tbd{cursor:default}.nl-bx.live{border-color:#e5484d}
.nl-bx small{font:700 10.5px var(--body);color:var(--muted);text-align:center}
.nl-col+.nl-col .nl-bx::before{content:"";position:absolute;left:-9px;top:50%;width:8px;border-top:2px solid var(--line)}
.nl-cup{margin:14px 4px 0;padding:12px 14px;border-radius:14px;background:linear-gradient(180deg,color-mix(in srgb,#E9B64A 22%,var(--panel)),var(--panel));border:1px solid color-mix(in srgb,#E9B64A 50%,var(--line));font:800 14px var(--body);text-align:center}
@media (max-width:380px){.nl-tr{grid-template-columns:20px minmax(0,1fr) 22px 40px 30px 30px;font-size:13px}.nl-br{gap:6px}.nl-sl{font-size:12px;padding:5px}}`;
  document.head.appendChild(css);
})();
