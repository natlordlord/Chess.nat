/* ===== Chess.nat Tippspiel: tip the result, nothing else.
   Football (Deutschland, Bayern, Bundesliga, Champions League, DFB-Pokal) and the UFC title fights.
   One tip per game, changeable until kick-off and saved on the server the moment you change it (tipp_pick).
   Points like Kicktipp: exact score 4 · right goal difference 3 · right winner or draw 2 · UFC: right winner 3.
   Fixtures and live scores come from the edge function "tipp" (ESPN, every minute); Nat-KI tips along. ===== */
(() => {
  const de = () => typeof I18N === "undefined" || I18N.lang === "de";
  const T = (en, dg) => de() ? dg : en;
  const sb = () => window.ChessSite && window.ChessSite.sb;
  const meId = () => (typeof Social !== "undefined" && Social.me) || (window.ChessSite && ChessSite.storedUid ? ChessSite.storedUid() : null);
  const h = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const bay = n => /bayern/i.test(n || "");
  const COMP = {"nt": ["🇩🇪", T("Germany", "Deutschland")], "ger.1": ["⚽", "Bundesliga"], "uefa.champions": ["⭐", "Champions League"], "ger.dfb_pokal": ["🏆", "DFB-Pokal"], "ufc": ["🥊", T("UFC title fight", "UFC-Titelkampf")], "lol": ["🎮", "League of Legends"]};
  const FILTERS = [["all", T("All", "Alle")], ["nt", "🇩🇪 " + T("Germany", "Deutschland")], ["bay", "⭐ Bayern"], ["ger.1", "Bundesliga"], ["uefa.champions", "Champions League"], ["ger.dfb_pokal", "DFB-Pokal"], ["ufc", "🥊 UFC"], ["lol", "🎮 LoL"]];
  /* short club names, so a row never wraps ("Bayern" instead of "FC Bayern München") */
  const SN = {"FC Bayern München": "Bayern", "FC Bayern": "Bayern", "Bayern München": "Bayern", "Borussia Dortmund": "Dortmund", "Borussia Mönchengladbach": "Gladbach", "Bayer 04 Leverkusen": "Leverkusen", "Bayer Leverkusen": "Leverkusen", "RB Leipzig": "Leipzig", "Eintracht Frankfurt": "Frankfurt", "VfB Stuttgart": "Stuttgart", "SC Freiburg": "Freiburg", "TSG Hoffenheim": "Hoffenheim", "TSG 1899 Hoffenheim": "Hoffenheim", "1. FC Union Berlin": "Union Berlin", "Union Berlin": "Union Berlin", "SV Werder Bremen": "Bremen", "Werder Bremen": "Bremen", "VfL Wolfsburg": "Wolfsburg", "1. FSV Mainz 05": "Mainz", "Mainz 05": "Mainz", "FC Augsburg": "Augsburg", "1. FC Heidenheim 1846": "Heidenheim", "1. FC Heidenheim": "Heidenheim", "FC St. Pauli": "St. Pauli", "1. FC Köln": "Köln", "Hamburger SV": "HSV", "VfL Bochum": "Bochum", "Holstein Kiel": "Kiel", "SC Paderborn 07": "Paderborn", "SV Elversberg": "Elversberg", "Real Madrid": "Real Madrid", "FC Barcelona": "Barcelona", "Paris Saint-Germain": "Paris SG", "Manchester City": "Man City", "Manchester United": "Man United", "Atlético Madrid": "Atlético", "Atletico Madrid": "Atlético", "Inter Mailand": "Inter", "Internazionale": "Inter", "Tottenham Hotspur": "Tottenham", "Newcastle United": "Newcastle", "Bosnien-Herzegowina": "Bosnien"};
  const sn = n => { n = String(n || ""); if (SN[n]) return SN[n]; if (n.length <= 14) return n; const x = n.replace(/^(1\. )?(FC|SC|SV|VfB|VfL|TSG|RB|FSV|SpVgg|SSV|AFC|CF) /, "").replace(/ (FC|CF|SC|\d{2,4})$/, "").trim(); return x || n; };
  const last = n => String(n || "").split(" ").pop();
  const dk = d => { const x = new Date(d); return x.getFullYear() + "-" + (x.getMonth() + 1) + "-" + x.getDate(); };
  const dayName = t => { const d = new Date(t), n = new Date(), k = dk(d), y = new Date(n); y.setDate(n.getDate() + 1); const yy = new Date(n); yy.setDate(n.getDate() - 1);
    if (k === dk(n)) return T("Today", "Heute"); if (k === dk(y)) return T("Tomorrow", "Morgen"); if (k === dk(yy)) return T("Yesterday", "Gestern");
    return d.toLocaleDateString(de() ? "de-DE" : "en-GB", {weekday: "long", day: "numeric", month: "long"}); };
  const dayShort = t => { const d = new Date(t), n = new Date(), dd = Math.round((new Date(d.toDateString()) - new Date(n.toDateString())) / 864e5);
    return dd === 0 ? T("Today", "Heute") : dd === 1 ? T("Tomorrow", "Morgen") : d.toLocaleDateString(de() ? "de-DE" : "en-GB", {weekday: "short"}); };
  const hm = t => new Date(t).toLocaleTimeString(de() ? "de-DE" : "en-GB", {hour: "2-digit", minute: "2-digit"});
  const haptic = p => { try { if (typeof Haptic !== "undefined") Haptic.go(p); else if (navigator.vibrate) navigator.vibrate(p); } catch(e) {} };
  const tap = () => { try { Sound.tap(); } catch(e) {} };

  /* what is tipped at all: football, and the UFC title fights (five rounds on a numbered card) */
  const tippable = e => e && e.state !== "canc" && (e.sport === "fb" || e.sport === "lol" || (e.sport === "mma" && e.meta && e.meta.title));
  /* tipped by winner (3 points) instead of a score: UFC title fights and the big League of Legends series */
  const isW = e => e.sport === "mma" || e.sport === "lol", wn = (e, n) => e.sport === "lol" ? String(n || "") : last(n), ico = e => e.sport === "lol" ? "🎮" : "🥊";
  const open = e => e.state === "pre" && Date.parse(e.start_at) > Date.now();
  /* the same rule as the database (tipp_pts) */
  const ptsOf = (e, p) => { if (!p || !e || e.state === "pre") return null;
    if (isW(e)){ const w = e.state === "post" && e.meta ? e.meta.winner : null; return w ? (p.w === w ? 3 : 0) : null; }
    const reg = e.state === "post" && e.meta && Array.isArray(e.meta.reg) ? e.meta.reg : null, rh = reg ? +reg[0] : e.score_h, ra = reg ? +reg[1] : e.score_a;
    if (p.sh == null || p.sa == null || rh == null || ra == null) return null;
    if (p.sh === rh && p.sa === ra) return 4; const s = Math.sign(p.sh - p.sa); if (s !== Math.sign(rh - ra)) return 0;
    return rh !== ra && p.sh - p.sa === rh - ra ? 3 : 2; };
  const tipText = (e, p) => !p ? "" : isW(e) ? wn(e, p.w === "a" ? e.home : e.away) : `${p.sh}:${p.sa}`;
  const full = (e, pt) => pt === 4 || (isW(e) && pt === 3);
  const ptsBadge = (pt, live, top) => pt == null ? "" : `<span class="tq-p p${pt} ${top ? "p4" : ""} ${live ? "live" : ""}">${top ? "🎯 " : ""}${live ? T("now ", "gerade ") : ""}+${pt}</span>`;

  const Tipp = {
    ev: [], picks: {}, table: [], tab: "tip", loaded: false, loadT: 0, who: null, err: false,
    sel: (() => { try { const v = JSON.parse(localStorage.getItem("chessnat-tipp-sel") || "[]"); return new Set(v.filter(k => FILTERS.some(f => f[0] === k))); } catch(e) { return new Set(); } })(),
    saveSel(){ try { localStorage.setItem("chessnat-tipp-sel", JSON.stringify([...this.sel])); } catch(e) {} },
    /* games from three weeks back to 40 days ahead, and my tips */
    async load(){
      const c = sb(); if (!c) throw new Error("offline");
      const me = meId(), from = new Date(Date.now() - 21 * 864e5).toISOString(), to = new Date(Date.now() + 40 * 864e5).toISOString();
      const [e, p] = await Promise.all([
        c.from("tipp_events").select("id,sport,comp,name,home,away,home_logo,away_logo,start_at,state,clock,score_h,score_a,meta,fav").gte("start_at", from).lte("start_at", to).order("start_at"),
        me ? c.from("tipp_picks").select("event_id,sh,sa,w,updated_at").eq("user_id", me) : Promise.resolve({data: []})]);
      if (e.error) throw e.error;
      this.ev = (e.data || []).filter(tippable).sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
      const P = {}; (p.data || []).forEach(r => P[r.event_id] = {sh: r.sh, sa: r.sa, w: r.w}); Object.assign(P, this.pending || {}); this.picks = P;
      this.who = me; this.loaded = true; this.loadT = Date.now(); this.err = false;
      if (me) try { localStorage.setItem("chessnat-tipp-cache", JSON.stringify({who: me, t: Date.now(), ev: this.ev, picks: this.picks})); } catch(e) {}
      if (me && !this.claimed){ this.claimed = true; this.claim(); }
    },
    /* the last list on this phone: the home card and the page show it at once, fresh data follows */
    fromCache(){ const me = meId(); if (!me || this.who === me) return this.who === me; try { const c = JSON.parse(localStorage.getItem("chessnat-tipp-cache") || "null");
      if (c && c.who === me && Date.now() - c.t < 36 * 3600e3 && Array.isArray(c.ev)){ this.ev = c.ev; this.picks = Object.assign({}, c.picks || {}, this.pending || {}); this.who = me; this.loaded = true; this.loadT = 0; return true; } } catch(e) {} return false; },
    /* the old Natcoin bets are gone: their open stakes come back once */
    async claim(){ const c = sb(); if (!c || !meId()) return; try { const {data} = await c.rpc("tipp_claim"); if (data && data.sum > 0 && typeof natEarn === "function"){ natEarn(data.sum); toast(T(`💰 Your old stakes are back: +${data.sum} Natcoins`, `💰 Deine alten Einsätze sind zurück: +${data.sum} Natcoins`), 3600); } } catch(e) {} },
    async loadTable(){ const c = sb(); if (!c) return; const {data, error} = await c.rpc("tipp_table"); if (!error) this.table = data || []; },
    myRow(){ return this.table.find(r => r.uid && r.uid === meId()); },
    mine(id){ return this.picks[id] || null; },
    /* save right away; the newest change wins, a slow answer for an older one is ignored */
    pending: {}, seq: {},
    async save(e, p){
      const c = sb(); if (!c || !meId()) throw new Error("not signed in");
      const n = (this.seq[e.id] || 0) + 1; this.seq[e.id] = n; this.pending[e.id] = p; this.picks[e.id] = p;
      const {error} = await c.rpc("tipp_pick", isW(e) ? {p_event: e.id, p_w: p.w} : {p_event: e.id, p_h: p.sh, p_a: p.sa});
      if (this.seq[e.id] !== n) return "stale";
      delete this.pending[e.id];
      if (error) throw error;
      return "ok";
    },
  };
  window.Tipp = Tipp;
  const errText = er => { const m = String((er && er.message) || er || "");
    if (/closed/.test(m)) return T("Too late – it has started.", "Zu spät – schon angepfiffen.");
    if (/not signed in/.test(m)) return T("Sign in to tip.", "Zum Tippen bitte anmelden.");
    return T("Couldn't save. Check your connection.", "Konnte nicht speichern. Verbindung prüfen."); };

  Views.tipp = {
    mount(main, arg){
      this.main = main; this.arg = arg || {}; if (this.arg.tab) Tipp.tab = this.arg.tab; if (this.arg.open || this.arg.quick) Tipp.tab = "tip";
      main.innerHTML = `<div class="page tp"><div class="tp-head"><h1 class="h-title" style="margin:0">${T("Tipping game", "Tippspiel")}</h1><button class="tp-pts" id="tppts" hidden></button></div>
        <div class="seg tp-tabs" id="tptabs">${[["tip", T("Tip", "Tippen")], ["res", T("Results", "Ergebnisse")], ["table", T("Table", "Rangliste")]].map(([k, l]) => `<button data-tab="${k}" class="${Tipp.tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
        <div class="chips tp-chips" id="tpchips">${FILTERS.map(([k, l]) => `<button class="chip ${(k === "all" ? !Tipp.sel.size : Tipp.sel.has(k)) ? "on" : ""}" data-f="${k}">${l}</button>`).join("")}</div>
        <div id="tpbody"><div class="tp-empty">${T("Loading…", "Lädt…")}</div></div></div>`;
      main.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { if (Tipp.tab === b.dataset.tab) return; tap(); Tipp.tab = b.dataset.tab;
        main.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("on", x === b)); this.render(true); if (Tipp.tab === "table") this.loadTable(); });
      main.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { tap(); const k = b.dataset.f; if (k === "all") Tipp.sel.clear(); else if (Tipp.sel.has(k)) Tipp.sel.delete(k); else Tipp.sel.add(k); Tipp.saveSel();
        main.querySelectorAll("[data-f]").forEach(x => x.classList.toggle("on", x.dataset.f === "all" ? !Tipp.sel.size : Tipp.sel.has(x.dataset.f))); this.render(true); });
      main.querySelector("#tppts").onclick = () => { tap(); main.querySelector('[data-tab="table"]').click(); };
      this.pre = Tipp.fromCache() && Tipp.ev.length > 0; if (this.pre) this.render(true);
      this.refresh(true).then(() => this.loadTable());
      clearInterval(this.iv); this.iv = setInterval(() => { if (App.route !== "tipp") return clearInterval(this.iv); if (!document.hidden) this.refresh(); }, 30000);
    },
    unmount(){ clearInterval(this.iv); },
    async refresh(first){
      try { await Tipp.load(); } catch(e) { Tipp.err = true; }
      if (App.route !== "tipp" || !this.main || !this.main.isConnected) return;
      if (!first && Tipp.tab === "tip" && Date.now() - (this.busyT || 0) < 8000) return;
      this.render(first && !this.pre); this.pre = false;
      if (first && (this.arg.open || this.arg.quick)) this.focus(this.arg.open || this.arg.quick);
    },
    async loadTable(){ await Tipp.loadTable(); if (App.route !== "tipp") return; this.pill(); if (Tipp.tab === "table") this.render(); },
    pill(){ const b = this.main && this.main.querySelector("#tppts"), r = Tipp.myRow(); if (!b) return; b.hidden = !r; if (r) b.innerHTML = `🏆 <b>${r.pts}</b> ${T("pts", "Punkte")}`; },
    shown(){ const S = Tipp.sel; return Tipp.ev.filter(e => !S.size || [...S].some(k => k === "bay" ? bay(e.home) || bay(e.away) : k === "nt" ? e.comp === "nt" : e.comp === k)); },
    focus(id){ const el = this.main.querySelector(`[data-ev="${CSS.escape(id)}"]`); if (!el){ if (Tipp.sel.size){ Tipp.sel.clear(); Tipp.saveSel(); this.main.querySelectorAll("[data-f]").forEach(x => x.classList.toggle("on", x.dataset.f === "all")); this.render(); const e2 = this.main.querySelector(`[data-ev="${CSS.escape(id)}"]`); if (e2) return this.focus(id); } return; }
      el.scrollIntoView({block: "center", behavior: "smooth"}); el.classList.add("hl"); setTimeout(() => el.classList.remove("hl"), 2200); },
    render(anim){
      const body = this.main && this.main.querySelector("#tpbody"); if (!body) return;
      const chips = this.main.querySelector("#tpchips"); chips.hidden = Tipp.tab === "table";
      let html;
      if (!Tipp.loaded && Tipp.err) html = `<div class="tp-empty">📡 ${T("No connection.", "Keine Verbindung.")}<br><button class="btn ghost sm" data-retry style="margin-top:10px">↻ ${T("Try again", "Nochmal")}</button></div>`;
      else if (!Tipp.loaded) html = `<div class="tp-empty">${T("Loading…", "Lädt…")}</div>`;
      else html = Tipp.tab === "tip" ? this.tipHTML() : Tipp.tab === "res" ? this.resHTML() : this.tableHTML();
      if (body._h === html && !anim) return; body._h = html;
      /* keep the scroll and the stepper that is being tapped calm: only swap what changed */
      body.innerHTML = html; if (anim){ body.classList.remove("tp-in"); void body.offsetWidth; body.classList.add("tp-in"); }
      this.wire(body); this.pill();
    },
    /* ---------- Tippen ---------- */
    tipHTML(){
      const me = meId(), list = this.shown().filter(open);
      const signin = me ? "" : `<div class="tp-sign"><b>${T("Sign in to tip", "Zum Tippen anmelden")}</b><span>${T("So your tips are saved and count.", "Damit deine Tipps gespeichert werden und zählen.")}</span><button class="btn go sm" data-signin>${T("Sign in", "Anmelden")}</button></div>`;
      if (!list.length) return signin + `<div class="tp-empty">${T("No games right now.", "Gerade keine Spiele.")}</div>`;
      const todo = me ? list.filter(e => !Tipp.mine(e.id)).length : 0;
      let out = signin + `<div class="tp-rules">🎯 ${T("Exact", "Genau")} <b>4</b> · ${T("Goal difference", "Tordifferenz")} <b>3</b> · ${T("Winner", "Sieger")} <b>2</b>${todo ? `<span class="tp-todo">${todo} ${T("open", "offen")}</span>` : me ? `<span class="tp-todo done">✓ ${T("all tipped", "alles getippt")}</span>` : ""}</div>`, day = "";
      list.slice(0, 80).forEach(e => { const d = dayName(e.start_at); if (d !== day){ day = d; out += `<div class="tp-day">${h(d)}</div>`; } out += this.cardHTML(e); });
      return out;
    },
    cardHTML(e){
      const p = Tipp.mine(e.id), c = COMP[e.comp] || ["⚽", ""], fav = e.comp === "nt" || bay(e.home) || bay(e.away) || (isW(e));
      const top = `<div class="tq-top"><span>${hm(e.start_at)} · ${c[0]} ${h(e.sport === "mma" ? T("Title fight", "Titelkampf") : e.sport === "lol" ? (e.name || c[1]) : c[1])}</span><span class="tq-ok" data-ok>${p ? "✓ " + T("Saved", "Gespeichert") : ""}</span></div>`;
      if (isW(e)) return `<div class="tq ${fav ? "fav" : ""} ${p ? "done" : ""}" data-ev="${h(e.id)}">${top}<div class="tq-f">${["a", "b"].map(s => `<button class="tq-fb ${p && p.w === s ? "on" : ""}" data-w="${s}"><b>${h(s === "a" ? e.home : e.away)}</b>${e.meta && e.meta.rec ? `<small>${h((e.meta.rec[s === "a" ? 0 : 1]) || "")}</small>` : ""}</button>`).join(`<span class="tq-vs">vs</span>`)}</div></div>`;
      const row = (s, nm, lg) => `<div class="tq-r">${lg ? `<img class="tq-lg" src="${h(lg)}" alt="" loading="lazy">` : `<span class="tq-lg tq-lg0"></span>`}<span class="tq-n">${h(sn(nm))}</span>
        <div class="tq-st" data-s="${s}"><button data-d="-1" aria-label="−">−</button><b class="${p ? "" : "e"}">${p ? p[s === "h" ? "sh" : "sa"] : "?"}</b><button data-d="1" aria-label="+">+</button></div></div>`;
      return `<div class="tq ${fav ? "fav" : ""} ${p ? "done" : ""}" data-ev="${h(e.id)}">${top}${row("h", e.home, e.home_logo)}${row("a", e.away, e.away_logo)}</div>`;
    },
    /* ---------- Ergebnisse ---------- */
    resHTML(){
      const now = Date.now(), L = this.shown().filter(e => e.state === "in" || e.state === "post" || (e.state === "pre" && Date.parse(e.start_at) <= now));
      const live = L.filter(e => e.state !== "post"), done = L.filter(e => e.state === "post").sort((a, b) => Date.parse(b.start_at) - Date.parse(a.start_at));
      if (!live.length && !done.length) return `<div class="tp-empty">${T("No results yet.", "Noch keine Ergebnisse.")}</div>`;
      let out = ""; if (live.length) out += `<div class="tp-day live">● Live</div>` + live.map(e => this.resRow(e)).join("");
      let day = ""; done.forEach(e => { const d = dayName(e.start_at); if (d !== day){ day = d; out += `<div class="tp-day">${h(d)}</div>`; } out += this.resRow(e); });
      return out;
    },
    resRow(e){
      const p = Tipp.mine(e.id), pt = ptsOf(e, p), lv = e.state !== "post", reg = !lv && e.meta && Array.isArray(e.meta.reg) ? e.meta.reg : null;
      const sc = `${reg ? reg[0] : e.score_h ?? "–"}:${reg ? reg[1] : e.score_a ?? "–"}`, win = e.state === "post" && e.meta ? e.meta.winner : null;
      const mid = isW(e) ? `<span class="tr-n">${win === "a" ? "🏆 " : ""}${h(wn(e, e.home))}</span><b class="tr-s sm">${e.sport === "lol" && e.score_h != null ? e.score_h + ":" + e.score_a : "vs"}</b><span class="tr-n r">${h(wn(e, e.away))}${win === "b" ? " 🏆" : ""}</span>`
        : `<span class="tr-n">${h(sn(e.home))}</span><b class="tr-s">${sc}</b><span class="tr-n r">${h(sn(e.away))}</span>`;
      const mine = p ? `${T("Your tip", "Dein Tipp")} <b>${h(tipText(e, p))}</b>` : `<span class="dim">${T("No tip", "Kein Tipp")}</span>`;
      return `<button class="tr ${lv ? "live" : ""} ${full(e, pt) ? "hit" : ""}" data-det="${h(e.id)}"><div class="tr-top"><span>${lv ? `<i class="tp-dot"></i>${h(e.clock || "Live")}` : hm(e.start_at)} · ${(COMP[e.comp] || ["⚽"])[0]}</span></div>
        <div class="tr-m">${mid}</div><div class="tr-f"><span>${mine}</span>${ptsBadge(pt, lv && !isW(e), full(e, pt))}</div></button>`;
    },
    /* ---------- Rangliste ---------- */
    tableHTML(){
      const B = Tipp.table, me = meId();
      const head = r => { if (r.bot === "ki") return `<span class="tp-av ki">🤖</span>`; try { if (r.uid && typeof Social !== "undefined" && Social.data && Social.data.players && Social.data.players[r.uid]) return `<span class="tp-av">${Social.face(Social.P(r.uid), 40)}</span>`; if (typeof avatarSVG === "function") return `<span class="tp-av">${avatarSVG(Object.assign({}, r.avatar || {}, {aura: "none", pet: "none"}), {head: true, size: 40})}</span>`; } catch(e) {} return `<span class="tp-av"></span>`; };
      const rows = B.length ? B.map((r, i) => `<div class="tp-br ${r.uid && r.uid === me ? "me" : ""}"><span class="tp-rk">${i < 3 && r.pts > 0 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>${head(r)}<div class="grow"><b>${h(r.bot === "ki" ? "Nat-KI" : r.name)}${r.uid && r.uid === me ? ` <span class="pill go">${T("You", "Du")}</span>` : ""}</b><small>${r.n ? `${r.n} ${T("tipped", "getippt")}${r.exact ? ` · 🎯 ${r.exact}× ${T("exact", "genau")}` : ""}` : T("waiting for the first result", "wartet aufs erste Ergebnis")}</small></div><span class="tp-bp">${r.pts}<small>${T("pts", "P.")}</small></span></div>`).join("")
        : `<div class="tp-empty">${T("No tips yet.", "Noch keine Tipps.")}</div>`;
      return `<div class="tp-board">${rows}</div><div class="tp-rules big">🎯 ${T("Exact score", "Genaues Ergebnis")} <b>4</b><br>${T("Right goal difference", "Richtige Tordifferenz")} <b>3</b><br>${T("Right winner or draw", "Richtiger Sieger oder Unentschieden")} <b>2</b><br>🥊 ${T("UFC: right winner", "UFC: richtiger Sieger")} <b>3</b></div>
        <div class="tp-inv"><button class="btn ghost sm" data-share>📨 ${T("Invite friends", "Freunde einladen")}</button></div>`;
    },
    /* ---------- taps ---------- */
    wire(body){
      const rt = body.querySelector("[data-retry]"); if (rt) rt.onclick = () => { tap(); this.refresh(true); };
      const si = body.querySelector("[data-signin]"); if (si) si.onclick = () => { tap(); App.go("account"); };
      const shb = body.querySelector("[data-share]"); if (shb) shb.onclick = async () => { tap(); const url = location.origin + "/#tipp", text = T("Tip the results with me on Chess.nat", "Tipp mit mir die Ergebnisse auf Chess.nat ⚽");
        try { if (navigator.share){ await navigator.share({title: "Tippspiel", text, url}); return; } } catch(e) { return; }
        try { await navigator.clipboard.writeText(text + " " + url); toast(T("Link copied", "Link kopiert")); } catch(e) {} };
      body.querySelectorAll("[data-det]").forEach(b => b.onclick = () => { tap(); this.detail(b.dataset.det); });
      body.querySelectorAll(".tq[data-ev]").forEach(card => {
        const e = Tipp.ev.find(x => x.id === card.dataset.ev); if (!e) return;
        card.querySelectorAll("[data-w]").forEach(b => b.onclick = () => this.change(card, e, {w: b.dataset.w}));
        card.querySelectorAll(".tq-st button").forEach(b => b.onclick = ev => { ev.stopPropagation(); const s = b.closest(".tq-st").dataset.s, d = +b.dataset.d, p0 = Tipp.mine(e.id);
          let sh = p0 ? p0.sh : null, sa = p0 ? p0.sa : null;
          /* the first tap starts at 0:0, then + and − move one side */
          if (sh == null || sa == null){ sh = 0; sa = 0; if (d > 0){ if (s === "h") sh = 1; else sa = 1; } }
          else if (s === "h") sh = Math.max(0, Math.min(20, sh + d)); else sa = Math.max(0, Math.min(20, sa + d));
          this.change(card, e, {sh, sa}); });
      });
    },
    change(card, e, p){
      if (!meId()){ toast(T("Sign in to tip.", "Zum Tippen bitte anmelden.")); return; }
      if (!open(e)){ toast(T("Too late – it has started.", "Zu spät – schon angepfiffen.")); return; }
      tap(); haptic(8); this.busyT = Date.now();
      /* show it at once; save shortly after the last tap */
      if (isW(e)) card.querySelectorAll("[data-w]").forEach(b => b.classList.toggle("on", b.dataset.w === p.w));
      else card.querySelectorAll(".tq-st").forEach(st => { const b = st.querySelector("b"), v = String(st.dataset.s === "h" ? p.sh : p.sa); if (b.textContent !== v){ b.textContent = v; b.classList.remove("bump", "e"); void b.offsetWidth; b.classList.add("bump"); } });
      Tipp.picks[e.id] = p; Tipp.pending[e.id] = p; card.classList.add("done");
      const ok = card.querySelector("[data-ok]"); ok.textContent = "…"; ok.className = "tq-ok wait";
      clearTimeout(card._t); card._t = setTimeout(async () => {
        try { const r = await Tipp.save(e, p); if (r === "stale") return; ok.textContent = "✓ " + T("Saved", "Gespeichert"); ok.className = "tq-ok"; this.todo(); }
        catch(er){ ok.textContent = "⚠️ " + errText(er); ok.className = "tq-ok bad"; toast(errText(er), 3000); }
      }, isW(e) ? 50 : 650);
    },
    todo(){ const t = this.main && this.main.querySelector(".tp-todo"); if (!t) return; const n = this.shown().filter(open).filter(e => !Tipp.mine(e.id)).length; t.className = "tp-todo" + (n ? "" : " done"); t.textContent = n ? `${n} ${T("open", "offen")}` : `✓ ${T("all tipped", "alles getippt")}`; },
    /* everyone's tips on a game (once it has started) */
    async detail(id){
      const e = Tipp.ev.find(x => x.id === id); if (!e) return; const c = sb(); let rows = [];
      if (c && meId()) try { const {data} = await c.rpc("tipp_event_picks", {p_event: id}); rows = data || []; } catch(er) {}
      const lv = e.state !== "post", reg = !lv && e.meta && Array.isArray(e.meta.reg) ? e.meta.reg : null;
      const sc = isW(e) ? (e.meta && e.meta.winner ? `🏆 ${h(e.meta.winner === "a" ? e.home : e.away)}` : "vs") : `${reg ? reg[0] : e.score_h ?? "–"}:${reg ? reg[1] : e.score_a ?? "–"}`;
      const list = rows.length ? rows.map(r => `<div class="tp-ot ${r.uid && r.uid === meId() ? "me" : ""}"><b>${r.bot === "ki" ? "🤖 Nat-KI" : h(r.name)}</b><span class="tp-otip">${h(isW(e) ? wn(e, r.w === "a" ? e.home : e.away) : `${r.sh}:${r.sa}`)}</span>${ptsBadge(r.pts, lv && !isW(e), full(e, r.pts))}</div>`).join("")
        : `<div class="tp-empty" style="padding:16px">${T("Nobody tipped this one.", "Hier hat keiner getippt.")}</div>`;
      detailSheet(`<div class="tp-det"><div class="tq-top"><span>${h((COMP[e.comp] || ["", ""]).join(" "))}</span><span>${lv ? h(e.clock || "Live") : dayName(e.start_at) + " · " + hm(e.start_at)}</span></div>
        <div class="tr-m big"><span class="tr-n">${h(isW(e) ? e.home : sn(e.home))}</span><b class="tr-s ${isW(e) ? "sm" : ""}">${sc}</b><span class="tr-n r">${h(isW(e) ? e.away : sn(e.away))}</span></div>
        <div class="tp-others">${list}</div></div>`);
    },
  };

  /* ---------- the card on the home screen: only games you haven't tipped, plus your live and fresh results ---------- */
  function homeHTML(){
    const now = Date.now(), me = meId(); if (!me || Tipp.who !== me) return "";
    const live = Tipp.ev.filter(e => (e.state === "in" || (e.state === "pre" && Date.parse(e.start_at) <= now)) && Tipp.mine(e.id)).slice(0, 2);
    const fresh = Tipp.ev.filter(e => e.state === "post" && Tipp.mine(e.id) && now - Date.parse(e.start_at) < 20 * 3600e3).slice(-1);
    const next = Tipp.ev.filter(e => open(e) && Date.parse(e.start_at) > now + 60e3 && Date.parse(e.start_at) < now + 4 * 864e5 && (e.fav || e.comp === "nt" || bay(e.home) || bay(e.away) || isW(e)) && !Tipp.mine(e.id))
      .slice(0, Math.max(0, 3 - live.length - fresh.length));
    if (!live.length && !next.length && !fresh.length) return "";
    const nm = e => isW(e) ? `${ico(e)} ${h(wn(e, e.home))} – ${h(wn(e, e.away))}` : `${e.comp === "nt" ? "🇩🇪 " : bay(e.home) || bay(e.away) ? "⭐ " : ""}${h(sn(e.home))} – ${h(sn(e.away))}`;
    const score = e => isW(e) ? "" : ` <b>${e.score_h ?? 0}:${e.score_a ?? 0}</b> `;
    return `<div class="th-h">⚽ ${T("Tipping game", "Tippspiel")}</div>`
      + live.map(e => { const p = Tipp.mine(e.id), pt = ptsOf(e, p); return `<button class="th-row live" data-th="${h(e.id)}" data-tab="res"><span class="th-t">● ${h(e.clock || "Live")}</span><span class="th-m">${isW(e) ? nm(e) : `${h(sn(e.home))}${score(e)}${h(sn(e.away))}`}</span><span class="th-tip ${pt === 4 ? "ok" : pt ? "" : "out"}">${h(tipText(e, p))}${pt != null ? ` · ${pt}` : ""}</span></button>`; }).join("")
      + fresh.map(e => { const p = Tipp.mine(e.id), pt = ptsOf(e, p), reg = e.meta && Array.isArray(e.meta.reg) ? e.meta.reg : [e.score_h, e.score_a]; return `<button class="th-row" data-th="${h(e.id)}" data-tab="res"><span class="th-t">${T("Final", "Ende")}</span><span class="th-m">${isW(e) ? nm(e) : `${h(sn(e.home))} <b>${reg[0]}:${reg[1]}</b> ${h(sn(e.away))}`}</span><span class="th-tip ${pt === 4 || (isW(e) && pt === 3) ? "ok" : pt ? "" : "out"}">${pt === 4 || (isW(e) && pt === 3) ? "🎯 " : ""}+${pt ?? 0}</span></button>`; }).join("")
      + next.map(e => `<button class="th-row" data-th="${h(e.id)}"><span class="th-t">${h(dayShort(e.start_at))}<br>${hm(e.start_at)}</span><span class="th-m">${nm(e)}</span><span class="th-go">${T("Tip", "Tippen")}</span></button>`).join("");
  }
  window.homeTipp = async el => {
    if (!el) return;
    const fill = () => { if (!el.isConnected) return; const x = homeHTML(); if (el._h === x) return; el._h = x; el.innerHTML = x; el.hidden = !x;
      el.querySelectorAll("[data-th]").forEach(b => b.onclick = () => { tap(); App.go("tipp", b.dataset.tab ? {tab: b.dataset.tab} : {open: b.dataset.th}); }); };
    /* with your tips at hand (in memory or this phone's copy) it is there in the very first frame;
       otherwise only once you're signed in and your tips are loaded (else it would ask for games you already tipped),
       and after the calorie card above has settled, so nothing above it jumps */
    if (meId() && Tipp.fromCache()) fill();
    if (!el._h){
      let n = 0; while (!meId() && el.isConnected && n++ < 24) await new Promise(r => setTimeout(r, 500));
      if (!meId() || !el.isConnected) return;
      n = 0; while (typeof Kcal !== "undefined" && !Kcal.loaded && !Kcal.prof && el.isConnected && n++ < 16) await new Promise(r => setTimeout(r, 250));
    }
    if (Tipp.who === meId() && Date.now() - (Tipp.loadT || 0) < 120000) return fill();
    try { await Tipp.load(); } catch(e) { return; } fill(); };

  const css = document.createElement("style"); css.textContent = `
.page.tp{max-width:760px}.tp{padding-bottom:96px;overflow-x:clip}
.tp-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.tp-pts{border:0;background:var(--panel-2);color:var(--fg);border-radius:999px;padding:7px 14px;font:800 14px var(--body);cursor:pointer}.tp-pts b{font:900 17px var(--display);color:var(--go-hi,var(--go))}.tp-pts[hidden]{display:none}
.tp-tabs{display:flex;width:100%}.tp-tabs button{flex:1;white-space:nowrap}
.tp-chips{flex-wrap:nowrap;overflow-x:auto;margin:12px -4px 4px;padding:2px 4px 4px;scrollbar-width:none;overscroll-behavior-x:contain}.tp-chips::-webkit-scrollbar{display:none}.tp-chips .chip{flex:none}.tp-chips[hidden]{display:none}
@media (hover:hover) and (pointer:fine) and (min-width:760px){.tp-chips{flex-wrap:wrap;overflow:visible;gap:6px}}
#tpbody.tp-in{animation:tpIn .25s ease-out}@keyframes tpIn{from{opacity:0;transform:translateY(6px)}}
.tp-empty{color:var(--muted);text-align:center;padding:40px 10px;line-height:1.5}
.tp-sign{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;background:color-mix(in srgb,var(--go) 14%,var(--panel));border:1px solid color-mix(in srgb,var(--go) 45%,var(--line));border-radius:14px;padding:12px 14px;margin:10px 0 4px}
.tp-sign b{width:100%;font:900 15px var(--body)}.tp-sign span{flex:1;min-width:160px;color:var(--muted);font-size:13px}
.tp-rules{display:flex;align-items:center;gap:6px;flex-wrap:wrap;color:var(--muted);font:700 12.5px var(--body);margin:10px 2px 0}.tp-rules b{color:var(--fg)}
.tp-rules.big{display:block;line-height:1.9;font-size:13.5px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-top:14px}
.tp-todo{margin-left:auto;background:var(--go);color:#fff;border-radius:999px;padding:3px 10px;font:900 12px var(--body)}.tp-todo.done{background:var(--panel-2);color:var(--muted)}
.tp-day{font:800 12px var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:16px 2px 7px}.tp-day.live{color:#e5484d}
.tq{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:10px 12px 8px;margin-bottom:8px;transition:border-color .25s,box-shadow .25s}
.tq.fav{border-color:color-mix(in srgb,#DC052D 45%,var(--line))}.tq.done{border-color:color-mix(in srgb,var(--go) 55%,var(--line))}
.tq.hl{box-shadow:0 0 0 3px color-mix(in srgb,var(--go) 60%,transparent)}
.tq-top{display:flex;justify-content:space-between;align-items:center;gap:8px;font:700 12px var(--body);color:var(--muted);margin-bottom:4px}.tq-top>span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tq-ok{flex:none;color:var(--go-hi,var(--go));font-weight:800}.tq-ok.wait{color:var(--muted)}.tq-ok.bad{color:#e5484d;white-space:normal;text-align:right}
.tq-r{display:flex;align-items:center;gap:10px;padding:4px 0}.tq-lg{width:26px;height:26px;object-fit:contain;flex:none}.tq-lg0{border-radius:50%;background:var(--panel-3,var(--panel-2))}
.tq-n{flex:1;min-width:0;font:800 16px var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tq-st{display:flex;align-items:center;gap:4px;flex:none}.tq-st button{width:40px;height:40px;border:0;border-radius:12px;background:var(--panel-2);color:var(--fg);font:900 22px/1 var(--display);cursor:pointer;touch-action:manipulation;box-shadow:inset 0 -3px 0 rgba(0,0,0,.22)}
.tq-st button:active{transform:scale(.92)}.tq-st b{width:36px;text-align:center;font:900 26px var(--display);font-variant-numeric:tabular-nums}
.tq.done .tq-st b{color:var(--go-hi,var(--go))}.tq-st b.e{color:var(--muted);opacity:.45;font-size:22px}.tq-st b.bump{animation:tqBump .25s cubic-bezier(.3,1.6,.5,1)}@keyframes tqBump{from{transform:scale(1.35)}}
.tq-f{display:flex;align-items:stretch;gap:8px;margin:6px 0 4px}.tq-vs{align-self:center;color:var(--muted);font:900 13px var(--body)}
.tq-fb{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:2px;border:2px solid var(--line);background:var(--panel-2);color:var(--fg);border-radius:14px;padding:12px 6px;cursor:pointer}
.tq-fb b{font:900 15px var(--body);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tq-fb small{color:var(--muted);font:700 11.5px var(--body)}
.tq-fb.on{border-color:var(--go);background:color-mix(in srgb,var(--go) 22%,var(--panel-2))}
.tr{display:block;width:100%;text-align:left;font:inherit;color:var(--fg);background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:10px 12px;margin-bottom:8px;cursor:pointer}
.tr.live{border-color:color-mix(in srgb,#e5484d 50%,var(--line))}.tr.hit{border-color:#d9a53a;background:color-mix(in srgb,#E9B64A 10%,var(--panel))}
.tr-top{font:700 12px var(--body);color:var(--muted)}.tr.live .tr-top{color:#e5484d}
.tp-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#e5484d;margin-right:5px;vertical-align:1px;animation:tpDot 1.4s ease-in-out infinite}@keyframes tpDot{50%{opacity:.3}}
.tr-m{display:flex;align-items:center;gap:10px;margin:6px 0}.tr-n{flex:1;min-width:0;font:800 15.5px var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tr-n.r{text-align:right}
.tr-s{flex:none;font:900 24px var(--display);font-variant-numeric:tabular-nums;min-width:56px;text-align:center}.tr-s.sm{font-size:15px;min-width:0}
.tr-m.big .tr-s{font-size:34px}.tr-m.big .tr-n{font-size:17px}
.tr-f{display:flex;align-items:center;justify-content:space-between;gap:8px;font:700 13px var(--body);color:var(--muted)}.tr-f b{color:var(--fg);font-family:var(--display)}
.tq-p{flex:none;font:900 13px var(--body);padding:3px 9px;border-radius:999px;background:var(--panel-2);color:var(--muted)}
.tq-p.p2,.tq-p.p3{background:var(--go);color:#fff}.tq-p.p4{background:linear-gradient(180deg,#E9B64A,#c9921f);color:#fff}.tq-p.live{animation:tpDot 2s ease-in-out infinite}
.tp-board{display:flex;flex-direction:column;gap:6px;margin-top:12px}
.tp-br{display:flex;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:8px 12px}.tp-br.me{border-color:var(--go)}
.tp-br .grow{flex:1;display:flex;flex-direction:column;min-width:0}.tp-br b{font:900 15px var(--display);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tp-br small{color:var(--muted);font:700 12px var(--body)}
.tp-rk{width:26px;text-align:center;font:900 15px var(--display);color:var(--muted);flex:none}
.tp-av{width:40px;height:40px;display:grid;place-items:center;flex:none;font-size:26px;overflow:hidden;border-radius:50%}
.tp-bp{font:900 22px var(--display);flex:none}.tp-bp small{font:800 12px var(--body);color:var(--muted);margin-left:3px}
.tp-inv{display:flex;justify-content:center;margin-top:12px}
.tp-others{margin:6px 0 4px}.tp-ot{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;background:var(--panel-2);margin-top:5px}.tp-ot.me{outline:2px solid color-mix(in srgb,var(--go) 70%,transparent)}
.tp-ot b{flex:1;min-width:0;font:800 14px var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tp-otip{font:900 17px var(--display);min-width:44px;text-align:right}
.tp-det .tq-top{margin-top:4px}
.th-home{padding:12px 14px!important;display:flex;flex-direction:column;gap:6px}.th-home[hidden]{display:none}.th-home .th-h{font:900 13px var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.th-row{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:14px;border:0;background:var(--panel-2);color:var(--fg);text-align:left;cursor:pointer;font:inherit}.th-row:active{transform:scale(.98)}
.th-t{flex:none;font:800 12px/1.25 var(--body);color:var(--muted);min-width:44px;text-align:center}.th-row.live .th-t{color:#e5484d}
.th-m{flex:1;min-width:0;font:800 15px var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.th-m b{font-family:var(--display);margin:0 2px}
.th-go{flex:none;background:var(--go);color:#fff;font:900 14px var(--body);padding:7px 12px;border-radius:10px;box-shadow:inset 0 -3px 0 rgba(0,0,0,.2)}
.th-tip{flex:none;font:900 15px var(--display);padding:6px 10px;border-radius:10px;background:var(--go);color:#fff}.th-tip.ok{background:linear-gradient(180deg,#E9B64A,#c9921f)}.th-tip.out{background:var(--panel-3,var(--panel));color:var(--muted)}
.pg-gt.tp-tile .pg-art{font-size:34px}`;
  document.head.appendChild(css);
})();
