/* ===== Chess.nat Tippspiel: tip the result, nothing else.
   Football (Deutschland, Bayern, Bundesliga, Champions League, DFB-Pokal, Nations League A) and the UFC title fights.
   The Nations League tab (groups, what has to happen, bracket) is games/nations.js.
   One tip per game, changeable until kick-off and saved on the server the moment you change it (tipp_pick).
   Points like Kicktipp: exact score 4 · right goal difference 3 · right winner or draw 2 · UFC, LoL, library: right winner 3.
   Fixtures and live scores come from the edge function "tipp" (ESPN, every minute) and "tipp-lol" (LoL Esports); Nat-KI tips along.
   The library (📚 Ligen): every league Polymarket lists, followed one by one (tipp_follows); their games come from the edge function
   "tipp-pm" with odds, live score and result. Every game has a source for its result, none is entered by hand without one. ===== */
(() => {
  const de = () => typeof I18N === "undefined" || I18N.lang === "de";
  const T = (en, dg) => de() ? dg : en;
  const sb = () => window.ChessSite && window.ChessSite.sb;
  const meId = () => (typeof Social !== "undefined" && Social.me) || (window.ChessSite && ChessSite.storedUid ? ChessSite.storedUid() : null);
  const h = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const bay = n => /bayern/i.test(n || "");
  const COMP = {"nt": ["🇩🇪", T("Germany", "Deutschland")], "ger.1": ["⚽", "Bundesliga"], "uefa.champions": ["⭐", "Champions League"], "ger.dfb_pokal": ["🏆", "DFB-Pokal"], "ufc": ["🥊", T("UFC title fight", "UFC-Titelkampf")], "lol": ["🎮", "League of Legends"], "uefa.nations": ["🌍", "Nations League"]};
  /* the library's groups (tipp_leagues.grp) */
  const GRP = {fb: ["⚽", "Football", "Fußball"], bk: ["🏀", "Basketball", "Basketball"], es: ["🎮", "Esports", "Esports"], tn: ["🎾", "Tennis", "Tennis"], mma: ["🥊", "Combat sports", "Kampfsport"],
    ih: ["🏒", "Ice hockey", "Eishockey"], af: ["🏈", "American football", "American Football"], hb: ["🤾", "Handball", "Handball"], vb: ["🏐", "Volleyball", "Volleyball"], da: ["🎯", "Darts", "Darts"],
    bb: ["⚾", "Baseball", "Baseball"], tt: ["🏓", "Table tennis", "Tischtennis"], ch: ["♟️", "Chess", "Schach"], ru: ["🏉", "Rugby & Footy", "Rugby & Footy"], cr: ["🏏", "Cricket", "Cricket"], x: ["🏅", "More", "Weitere"]};
  const GORDER = Object.keys(GRP);
  const isPM = e => /^pm:/.test((e && e.comp) || "");
  const lg = e => (Tipp.leagues || {})[String(e.comp || "").slice(3)] || null;
  const comp = e => isPM(e) ? [(GRP[(lg(e) || {}).grp] || GRP.x)[0], (lg(e) || {}).name || e.name || ""] : COMP[e.comp] || ["⚽", ""];
  const fold = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const FILTERS = [["all", T("All", "Alle")], ["nt", "🇩🇪 " + T("Germany", "Deutschland")], ["uefa.nations", "🌍 Nations League"], ["bay", "⭐ Bayern"], ["ger.1", "Bundesliga"], ["uefa.champions", "Champions League"], ["ger.dfb_pokal", "DFB-Pokal"], ["ufc", "🥊 UFC"], ["lol", "🎮 LoL"]];
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
  const tippable = e => e && e.state !== "canc" && (e.sport === "fb" || e.sport === "lol" || e.sport === "pm" || (e.sport === "mma" && e.meta && e.meta.title));
  /* tipped by winner (3 points) instead of a score: UFC title fights and the big League of Legends series */
  /* a Nations League game (Germany's are "nt", the others "uefa.nations") */
  const isNL = e => e.comp === "uefa.nations" || /^espn:uefa\.nations:/.test(e.id || "");
  const isW = e => e.sport === "mma" || e.sport === "lol" || e.sport === "pm", wn = (e, n) => e.sport === "mma" ? last(n) : String(n || ""), ico = e => e.sport === "lol" ? "🎮" : e.sport === "pm" ? comp(e)[0] : "🥊";
  const DRAW = () => T("Draw", "Unentschieden");
  const open = e => e.state === "pre" && Date.parse(e.start_at) > Date.now();
  /* the same rule as the database (tipp_pts) */
  const ptsOf = (e, p) => { if (!p || !e || e.state === "pre") return null;
    if (isW(e)){ const w = e.state === "post" && e.meta ? e.meta.winner : null; return w ? (p.w === w ? 3 : 0) : null; }
    const reg = e.state === "post" && e.meta && Array.isArray(e.meta.reg) ? e.meta.reg : null, rh = reg ? +reg[0] : e.score_h, ra = reg ? +reg[1] : e.score_a;
    if (p.sh == null || p.sa == null || rh == null || ra == null) return null;
    if (p.sh === rh && p.sa === ra) return 4; const s = Math.sign(p.sh - p.sa); if (s !== Math.sign(rh - ra)) return 0;
    return rh !== ra && p.sh - p.sa === rh - ra ? 3 : 2; };
  const tipText = (e, p) => !p ? "" : isW(e) ? (p.w === "d" ? DRAW() : wn(e, p.w === "a" ? e.home : e.away)) : `${p.sh}:${p.sa}`;
  const full = (e, pt) => pt === 4 || (isW(e) && pt === 3);
  const ptsBadge = (pt, live, top) => pt == null ? "" : `<span class="tq-p p${pt} ${top ? "p4" : ""} ${live ? "live" : ""}">${top ? "🎯 " : ""}${live ? T("now ", "gerade ") : ""}+${pt}</span>`;

  const Tipp = {
    ev: [], picks: {}, table: [], tab: "tip", loaded: false, loadT: 0, who: null, err: false,
    sel: (() => { try { const v = JSON.parse(localStorage.getItem("chessnat-tipp-sel") || "[]"); return new Set(v.filter(k => FILTERS.some(f => f[0] === k) || /^pm:/.test(k))); } catch(e) { return new Set(); } })(),
    saveSel(){ try { localStorage.setItem("chessnat-tipp-sel", JSON.stringify([...this.sel])); } catch(e) {} },
    /* games from three weeks back to 40 days ahead, and my tips */
    /* the library: the leagues I follow (with their names), and all leagues once the library is opened */
    leagues: {}, follows: new Set(),
    async loadFollows(){ const c = sb(), me = meId(); if (!c || !me) return; try {
      const {data, error} = await c.from("tipp_follows").select("league,tipp_leagues(key,name,grp,image)").eq("user_id", me); if (error) return;
      this.follows = new Set((data || []).map(r => r.league)); (data || []).forEach(r => { if (r.tipp_leagues) this.leagues[r.league] = Object.assign({}, this.leagues[r.league] || {}, r.tipp_leagues); }); } catch(e) {} },
    async loadLeagues(){ if (this.allL && Date.now() - this.allL < 6 * 3600e3) return; const c = sb(); if (!c) return;
      const {data, error} = await c.from("tipp_leagues").select("key,name,grp,image,rank,builtin").order("rank").order("name"); if (error) throw error;
      (data || []).forEach(r => this.leagues[r.key] = r); this.allL = Date.now(); },
    /* games from three weeks back to 40 days ahead, and my tips; library games only from the leagues I follow (or that I tipped) */
    async load(){
      const c = sb(); if (!c) throw new Error("offline");
      const me = meId(), from = new Date(Date.now() - 21 * 864e5).toISOString(), to = new Date(Date.now() + 40 * 864e5).toISOString();
      const COLS = "id,sport,comp,name,home,away,home_logo,away_logo,start_at,state,clock,score_h,score_a,meta,fav";
      const [e, p] = await Promise.all([
        c.from("tipp_events").select(COLS).gte("start_at", from).lte("start_at", to).not("comp", "like", "pm:%").order("start_at"),
        me ? c.from("tipp_picks").select("event_id,sh,sa,w,updated_at").eq("user_id", me) : Promise.resolve({data: []}), this.loadFollows()]);
      if (e.error) throw e.error;
      let ev = e.data || []; const P = {}; (p.data || []).forEach(r => P[r.event_id] = {sh: r.sh, sa: r.sa, w: r.w});
      const fl = [...this.follows].map(k => `"pm:${k}"`), mine = Object.keys(P).filter(id => /^pm:/.test(id) && !ev.some(x => x.id === id));
      if (fl.length || mine.length){ const q = await c.from("tipp_events").select(COLS).gte("start_at", from).lte("start_at", to)
          .or([fl.length ? `comp.in.(${fl.join(",")})` : "", mine.length ? `id.in.(${mine.map(x => `"${x}"`).join(",")})` : ""].filter(Boolean).join(",")).order("start_at");
        if (!q.error) ev = ev.concat(q.data || []); }
      /* a library game that is already in the Tippspiel for everyone (the same match from ESPN or LoL Esports) shows once */
      const base = ev.filter(x => !isPM(x)), same = (a, b) => Math.abs(Date.parse(a.start_at) - Date.parse(b.start_at)) < 3 * 3600e3
        && [a.home, a.away].every(n => { const w = fold(n).split(/[^a-z0-9]+/).filter(x => x.length > 2)[0]; return w && fold(b.home + " " + b.away).includes(w); });
      ev = ev.filter(x => !isPM(x) || !base.some(b => same(x, b)));
      this.ev = ev.filter(tippable).sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
      Object.assign(P, this.pending || {}); this.picks = P;
      this.who = me; this.loaded = true; this.loadT = Date.now(); this.err = false;
      if (me) try { localStorage.setItem("chessnat-tipp-cache", JSON.stringify({who: me, t: Date.now(), ev: this.ev, picks: this.picks, follows: [...this.follows], leagues: Object.fromEntries([...this.follows].map(k => [k, this.leagues[k]]).filter(x => x[1]))})); } catch(e) {}
      if (me && !this.claimed){ this.claimed = true; this.claim(); }
    },
    /* the last list on this phone: the home card and the page show it at once, fresh data follows */
    fromCache(){ const me = meId(); if (!me || this.who === me) return this.who === me; try { const c = JSON.parse(localStorage.getItem("chessnat-tipp-cache") || "null");
      if (c && c.who === me && Date.now() - c.t < 36 * 3600e3 && Array.isArray(c.ev)){ this.ev = c.ev; this.picks = Object.assign({}, c.picks || {}, this.pending || {}); this.who = me; this.loaded = true; this.loadT = 0;
        if (Array.isArray(c.follows)) this.follows = new Set(c.follows); Object.assign(this.leagues, c.leagues || {}); return true; } } catch(e) {} return false; },
    /* follow a league or stop: saved at once, its games come right after (the server asks Polymarket now, not in ten minutes) */
    async follow(k, on){
      const c = sb(), me = meId(); if (!c || !me) throw new Error("not signed in");
      if (on){ this.follows.add(k); const {error} = await c.from("tipp_follows").insert({user_id: me, league: k}); if (error && !/duplicate|23505/.test(error.message + error.code)){ this.follows.delete(k); throw error; }
        let n = 0; try { const r = await c.functions.invoke("tipp-pm", {body: {league: k}}); n = (r && r.data && r.data.n) || 0; } catch(e) {}
        return n; }
      this.follows.delete(k); this.sel.delete("pm:" + k); this.saveSel();
      const {error} = await c.from("tipp_follows").delete().eq("user_id", me).eq("league", k); if (error){ this.follows.add(k); throw error; } return 0;
    },
    /* the old Natcoin bets are gone: their open stakes come back once */
    async claim(){ const c = sb(); if (!c || !meId()) return; try { const {data} = await c.rpc("tipp_claim"); if (data && data.sum > 0 && typeof natEarn === "function"){ natEarn(data.sum); toast(T(`💰 Your old stakes are back: +${data.sum} Natcoins`, `💰 Deine alten Einsätze sind zurück: +${data.sum} Natcoins`), 3600); } } catch(e) {} },
    /* the table counts finished games; a game that is running counts with its current score on top ("live"), so the order moves while it is played */
    async loadTable(){ const c = sb(); if (!c) return; const {data, error} = await c.rpc("tipp_table"); if (error) return;
      const rows = (data || []).map(r => Object.assign({}, r, {live: 0})), live = this.ev.filter(e => e.state === "in" && !isW(e));
      if (live.length && meId()){ const key = r => r.uid || "bot:" + (r.bot || "");
        const got = await Promise.all(live.map(e => c.rpc("tipp_event_picks", {p_event: e.id}).then(x => x.data || []).catch(() => [])));
        got.flat().forEach(p => { if (p.pts == null) return; let r = rows.find(x => key(x) === key(p));
          if (!r){ r = {uid: p.uid, bot: p.bot, name: p.name, avatar: p.avatar, pts: 0, exact: 0, n: 0, open: 0, live: 0}; rows.push(r); }
          r.live += p.pts; });
        rows.forEach(r => r.pts += r.live); rows.sort((a, b) => b.pts - a.pts || b.exact - a.exact || a.n - b.n); }
      this.table = rows; },
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
      if (typeof NL !== "undefined") NL.fromCache();
      main.innerHTML = `<div class="page tp"><div class="tp-head"><h1 class="h-title" style="margin:0">${T("Tipping game", "Tippspiel")}</h1><button class="tp-pts" id="tppts" hidden></button></div>
        <div class="seg tp-tabs" id="tptabs">${[["tip", T("Tip", "Tippen")], ["res", T("Results", "Ergebnisse")], ["table", T("Table", "Rangliste")], ["nl", `🌍 <span class="tp-nlw">Nations League</span><span class="tp-nln">Nations</span>`]].filter(x => x[0] !== "nl" || typeof NL !== "undefined").map(([k, l]) => `<button data-tab="${k}" class="${Tipp.tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
        <div class="chips tp-chips" id="tpchips"></div>
        <div id="tpbody"><div class="tp-empty">${T("Loading…", "Lädt…")}</div></div></div>`;
      main.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { if (Tipp.tab === b.dataset.tab) return; tap(); Tipp.tab = b.dataset.tab;
        main.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("on", x === b)); this.render(true); if (Tipp.tab === "table") this.loadTable();
        if (Tipp.tab === "nl") NL.load(true).then(() => { if (Tipp.tab === "nl" && App.route === "tipp") this.render(); }, () => {}); });
      this.chips();
      main.querySelector("#tppts").onclick = () => { tap(); main.querySelector('[data-tab="table"]').click(); };
      this.pre = Tipp.fromCache() && Tipp.ev.length > 0; if (this.pre) this.render(true);
      this.refresh(true).then(() => this.loadTable());
      clearInterval(this.iv); this.iv = setInterval(() => { if (App.route !== "tipp") return clearInterval(this.iv); if (!document.hidden) this.refresh(); }, 30000);
    },
    unmount(){ clearInterval(this.iv); },
    async refresh(first){
      try { await Tipp.load(); } catch(e) { Tipp.err = true; }
      if (Tipp.tab === "nl" && typeof NL !== "undefined") try { await NL.load(first); NL.err = false; } catch(e) { NL.err = true; }
      if (App.route !== "tipp" || !this.main || !this.main.isConnected) return;
      if (!first && Tipp.tab === "tip" && Date.now() - (this.busyT || 0) < 8000) return;
      this.render(first && !this.pre); this.pre = false;
      /* while a game runs, the table follows the score */
      if (!first && Tipp.ev.some(e => e.state === "in")) this.loadTable();
      if (first && (this.arg.open || this.arg.quick)) this.focus(this.arg.open || this.arg.quick);
    },
    async loadTable(){ await Tipp.loadTable(); if (App.route !== "tipp") return; this.pill(); if (Tipp.tab === "table") this.render(); },
    pill(){ const b = this.main && this.main.querySelector("#tppts"), r = Tipp.myRow(); if (!b) return; b.hidden = !r; if (r) b.innerHTML = `🏆 <b>${r.pts}</b> ${T("pts", "Punkte")}`; },
    /* the filters: the fixed ones, then one per league I follow, then the library */
    chips(){ const el = this.main && this.main.querySelector("#tpchips"); if (!el) return;
      /* "All", the leagues I follow, the library (in sight without scrolling), then the fixed ones */
      const mine = [...Tipp.follows].filter(k => Tipp.leagues[k]).map(k => ["pm:" + k, `${(GRP[Tipp.leagues[k].grp] || GRP.x)[0]} ${h(Tipp.leagues[k].name)}`]);
      const chip = ([k, l]) => `<button class="chip ${(k === "all" ? !Tipp.sel.size : Tipp.sel.has(k)) ? "on" : ""}" data-f="${h(k)}">${l}</button>`;
      const html = chip(FILTERS[0]) + mine.map(chip).join("") + `<button class="chip tp-libc" data-lib>📚 ${T("Leagues", "Ligen")} <b>＋</b></button>` + FILTERS.slice(1).map(chip).join("");
      if (el._h === html) return; el._h = html; el.innerHTML = html;
      el.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { tap(); const k = b.dataset.f; if (k === "all") Tipp.sel.clear(); else if (Tipp.sel.has(k)) Tipp.sel.delete(k); else Tipp.sel.add(k); Tipp.saveSel();
        el.querySelectorAll("[data-f]").forEach(x => x.classList.toggle("on", x.dataset.f === "all" ? !Tipp.sel.size : Tipp.sel.has(x.dataset.f))); this.render(true); });
      el.querySelector("[data-lib]").onclick = () => { tap(); this.library(); }; },
    shown(){ const S = Tipp.sel; return Tipp.ev.filter(e => !S.size || [...S].some(k => k === "bay" ? bay(e.home) || bay(e.away) : k === "nt" ? e.comp === "nt" : k === "uefa.nations" ? isNL(e) : e.comp === k)); },
    focus(id){ const el = this.main.querySelector(`[data-ev="${CSS.escape(id)}"]`); if (!el){ if (Tipp.sel.size){ Tipp.sel.clear(); Tipp.saveSel(); this.main.querySelectorAll("[data-f]").forEach(x => x.classList.toggle("on", x.dataset.f === "all")); this.render(); const e2 = this.main.querySelector(`[data-ev="${CSS.escape(id)}"]`); if (e2) return this.focus(id); } return; }
      el.scrollIntoView({block: "center", behavior: "smooth"}); el.classList.add("hl"); setTimeout(() => el.classList.remove("hl"), 2200); },
    render(anim){
      const body = this.main && this.main.querySelector("#tpbody"); if (!body) return;
      const chips = this.main.querySelector("#tpchips"); chips.hidden = Tipp.tab === "table" || Tipp.tab === "nl"; this.chips();
      let html;
      if (!Tipp.loaded && Tipp.err) html = `<div class="tp-empty">📡 ${T("No connection.", "Keine Verbindung.")}<br><button class="btn ghost sm" data-retry style="margin-top:10px">↻ ${T("Try again", "Nochmal")}</button></div>`;
      else if (!Tipp.loaded) html = `<div class="tp-empty">${T("Loading…", "Lädt…")}</div>`;
      else html = Tipp.tab === "tip" ? this.tipHTML() : Tipp.tab === "res" ? this.resHTML() : Tipp.tab === "nl" && typeof NL !== "undefined" ? NL.html() : this.tableHTML();
      if (body._h === html && !anim) return; body._h = html;
      /* keep the scroll and the stepper that is being tapped calm: only swap what changed */
      body.innerHTML = html; if (anim){ body.classList.remove("tp-in"); void body.offsetWidth; body.classList.add("tp-in"); }
      this.wire(body); if (Tipp.tab === "nl" && typeof NL !== "undefined") NL.wire(body, this); this.pill();
    },
    /* ---------- Tippen ---------- */
    tipHTML(){
      const me = meId(), list = this.shown().filter(open);
      const signin = me ? "" : `<div class="tp-sign"><b>${T("Sign in to tip", "Zum Tippen anmelden")}</b><span>${T("So your tips are saved and count.", "Damit deine Tipps gespeichert werden und zählen.")}</span><button class="btn go sm" data-signin>${T("Sign in", "Anmelden")}</button></div>`;
      if (!list.length) return signin + `<div class="tp-empty">${T("No games right now.", "Gerade keine Spiele.")}</div>`;
      const todo = me ? list.filter(e => !Tipp.mine(e.id)).length : 0;
      let out = signin + `<div class="tp-rules">🎯 ${T("Exact", "Genau")} <b>4</b> · ${T("Goal difference", "Tordifferenz")} <b>3</b> · ${T("Winner", "Sieger")} <b>2</b>${todo ? `<span class="tp-todo">${todo} ${T("open", "offen")}</span>` : me ? `<span class="tp-todo done">✓ ${T("all tipped", "alles getippt")}</span>` : ""}</div>`, day = "";
      list.slice(0, 120).forEach(e => { const d = dayName(e.start_at); if (d !== day){ day = d; out += `<div class="tp-day">${h(d)}</div>`; } out += this.cardHTML(e); });
      return out;
    },
    cardHTML(e){
      const p = Tipp.mine(e.id), c = comp(e), fav = !isPM(e) && (e.comp === "nt" || bay(e.home) || bay(e.away) || isW(e));
      const grp = isNL(e) && e.meta && e.meta.grp ? ` · ${String(e.meta.grp).replace(/^Group /i, T("Group ", "Gruppe "))}` : isPM(e) && e.meta && e.meta.sub ? ` · ${e.meta.sub}` : "";
      const top = `<div class="tq-top"><span>${hm(e.start_at)} · ${c[0]} ${h(e.sport === "mma" ? T("Title fight", "Titelkampf") : e.sport === "lol" ? (e.name || c[1]) : c[1])}${h(grp)}</span><span class="tq-ok" data-ok>${p ? "✓ " + T("Saved", "Gespeichert") : ""}</span></div>`;
      /* under each side: the record (UFC, LoL), or Polymarket's chance for it (library) */
      const pr = e.meta && Array.isArray(e.meta.p) ? e.meta.p : null, dr = !!(e.meta && e.meta.draw), pc = i => pr && pr[i] != null ? Math.round(pr[i] * 100) + " %" : "";
      const small = s => e.meta && e.meta.rec ? h((e.meta.rec[s === "a" ? 0 : 1]) || "") : pc(s === "a" ? 0 : dr ? 2 : 1);
      if (isW(e)) return `<div class="tq ${fav ? "fav" : ""} ${p ? "done" : ""}" data-ev="${h(e.id)}">${top}<div class="tq-f ${dr ? "dr" : ""}">${["a", "b"].map(s => `<button class="tq-fb ${p && p.w === s ? "on" : ""}" data-w="${s}"><b>${h(s === "a" ? e.home : e.away)}</b>${small(s) ? `<small>${small(s)}</small>` : ""}</button>`)
        .join(dr ? `<button class="tq-fb tq-d ${p && p.w === "d" ? "on" : ""}" data-w="d"><b>${T("Draw", "Remis")}</b>${pc(1) ? `<small>${pc(1)}</small>` : ""}</button>` : `<span class="tq-vs">vs</span>`)}</div></div>`;
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
      const mid = isW(e) ? `<span class="tr-n">${win === "a" ? "🏆 " : ""}${h(wn(e, e.home))}</span><b class="tr-s sm">${(e.sport === "lol" || e.sport === "pm") && e.score_h != null ? e.score_h + ":" + e.score_a : win === "d" ? "🤝" : "vs"}</b><span class="tr-n r">${h(wn(e, e.away))}${win === "b" ? " 🏆" : ""}</span>`
        : `<span class="tr-n">${h(sn(e.home))}</span><b class="tr-s">${sc}</b><span class="tr-n r">${h(sn(e.away))}</span>`;
      const mine = p ? `${T("Your tip", "Dein Tipp")} <b>${h(tipText(e, p))}</b>` : `<span class="dim">${T("No tip", "Kein Tipp")}</span>`;
      return `<button class="tr ${lv ? "live" : ""} ${full(e, pt) ? "hit" : ""}" data-det="${h(e.id)}"><div class="tr-top"><span>${lv ? `<i class="tp-dot"></i>${h(e.clock || "Live")}` : hm(e.start_at)} · ${comp(e)[0]}${isPM(e) ? " " + h(comp(e)[1]) : ""}</span></div>
        <div class="tr-m">${mid}</div><div class="tr-f"><span>${mine}</span>${ptsBadge(pt, lv && !isW(e), full(e, pt))}</div></button>`;
    },
    /* ---------- Rangliste ---------- */
    tableHTML(){
      const B = Tipp.table, me = meId();
      const head = r => { if (r.bot === "ki") return `<span class="tp-av ki">🤖</span>`; try { if (r.uid && typeof Social !== "undefined" && Social.data && Social.data.players && Social.data.players[r.uid]) return `<span class="tp-av">${Social.face(Social.P(r.uid), 40)}</span>`; if (typeof avatarSVG === "function") return `<span class="tp-av">${avatarSVG(Object.assign({}, r.avatar || {}, {aura: "none", pet: "none"}), {head: true, size: 40})}</span>`; } catch(e) {} return `<span class="tp-av"></span>`; };
      const rows = B.length ? B.map((r, i) => `<div class="tp-br ${r.uid && r.uid === me ? "me" : ""}"><span class="tp-rk">${i < 3 && r.pts > 0 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>${head(r)}<div class="grow"><b>${h(r.bot === "ki" ? "Nat-KI" : r.name)}${r.uid && r.uid === me ? ` <span class="pill go">${T("You", "Du")}</span>` : ""}</b><small>${r.n ? `${r.n} ${T("tipped", "getippt")}${r.exact ? ` · 🎯 ${r.exact}× ${T("exact", "genau")}` : ""}` : T("waiting for the first result", "wartet aufs erste Ergebnis")}</small></div><span class="tp-bp">${r.live ? `<i class="tp-lv">+${r.live} live</i>` : ""}${r.pts}<small>${T("pts", "P.")}</small></span></div>`).join("")
        : `<div class="tp-empty">${T("No tips yet.", "Noch keine Tipps.")}</div>`;
      return `<div class="tp-board">${rows}</div><div class="tp-rules big">🎯 ${T("Exact score", "Genaues Ergebnis")} <b>4</b><br>${T("Right goal difference", "Richtige Tordifferenz")} <b>3</b><br>${T("Right winner or draw", "Richtiger Sieger oder Unentschieden")} <b>2</b><br>🥊🎮📚 ${T("UFC, LoL and library games: right winner (or draw)", "UFC, LoL und Bibliothek: richtiger Sieger (oder Remis)")} <b>3</b></div>
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
      const sc = isW(e) ? (e.meta && e.meta.winner ? (e.meta.winner === "d" ? `🤝 ${DRAW()}` : `🏆 ${h(e.meta.winner === "a" ? e.home : e.away)}`) + ((e.sport === "lol" || e.sport === "pm") && e.score_h != null && !lv ? ` · ${e.score_h}:${e.score_a}` : "") : "vs") : `${reg ? reg[0] : e.score_h ?? "–"}:${reg ? reg[1] : e.score_a ?? "–"}`;
      const list = rows.length ? rows.map(r => `<div class="tp-ot ${r.uid && r.uid === meId() ? "me" : ""}"><b>${r.bot === "ki" ? "🤖 Nat-KI" : h(r.name)}</b><span class="tp-otip">${h(isW(e) ? tipText(e, r) : `${r.sh}:${r.sa}`)}</span>${ptsBadge(r.pts, lv && !isW(e), full(e, r.pts))}</div>`).join("")
        : `<div class="tp-empty" style="padding:16px">${T("Nobody tipped this one.", "Hier hat keiner getippt.")}</div>`;
      detailSheet(`<div class="tp-det"><div class="tq-top"><span>${h(comp(e).join(" "))}${isPM(e) && e.meta && e.meta.sub ? " · " + h(e.meta.sub) : ""}</span><span>${lv ? h(e.clock || "Live") : dayName(e.start_at) + " · " + hm(e.start_at)}</span></div>
        <div class="tr-m big"><span class="tr-n">${h(isW(e) ? e.home : sn(e.home))}</span><b class="tr-s ${isW(e) ? "sm" : ""}">${sc}</b><span class="tr-n r">${h(isW(e) ? e.away : sn(e.away))}</span></div>
        <div class="tp-others">${list}</div></div>`);
    },
    /* ---------- the library: every league Polymarket lists, followed with one tap ---------- */
    library(){
      if (!meId()){ toast(T("Sign in to follow leagues.", "Zum Folgen bitte anmelden.")); return; }
      const sh = detailSheet(`<div class="tl"><h2 class="tl-h">📚 ${T("Leagues", "Ligen")}</h2><p class="tl-sub">${T("Follow a league and its games show up here to tip. Odds, live scores and results come from Polymarket on their own.", "Folge einer Liga, ihre Spiele erscheinen hier zum Tippen. Chancen, Live-Stand und Ergebnis kommen automatisch von Polymarket.")}</p>
        <input class="tl-q" id="tlq" type="search" enterkeyhint="search" autocomplete="off" autocorrect="off" placeholder="${T("Search: NBA, Premier League, LoL …", "Suchen: NBA, Premier League, LoL …")}"><div class="tl-list" id="tll"><div class="tp-empty">${T("Loading…", "Lädt…")}</div></div></div>`,
        () => { if (this.dirty && App.route === "tipp"){ this.dirty = false; this.chips(); Tipp.load().then(() => { if (App.route === "tipp") this.render(true); }, () => {}); } });
      const q = sh.el.querySelector("#tlq"), list = sh.el.querySelector("#tll");
      /* the keyboard comes up at once: searching is what you came for */
      try { q.focus(); } catch(e) {}
      const gl = L => GRP[L.grp] || GRP.x;
      const row = L => `<button class="tl-r ${Tipp.follows.has(L.key) ? "on" : ""}" data-k="${h(L.key)}" ${L.builtin ? "disabled" : ""}>${L.image ? `<img src="${h(L.image)}" alt="" loading="lazy">` : `<span class="tl-i">${gl(L)[0]}</span>`}<span class="tl-n">${h(L.name)}</span>${L.builtin ? `<span class="tl-in">${T("always in", "immer dabei")}</span>` : `<span class="tl-sw"></span>`}</button>`;
      const byRank = (a, b) => (a.rank ?? 100) - (b.rank ?? 100) || String(a.name).localeCompare(String(b.name));
      const draw = () => {
        if (!Tipp.allL) return;
        const all = Object.values(Tipp.leagues).filter(L => L && L.key && L.grp), t = fold(q.value.trim());
        let html = "";
        if (t){ const hit = all.filter(L => fold(L.name + " " + L.key + " " + gl(L).slice(1).join(" ")).includes(t)).sort(byRank);
          html = hit.length ? hit.slice(0, 80).map(row).join("") : `<div class="tp-empty">${T("Nothing found.", "Nichts gefunden.")}</div>`; }
        else {
          const mine = all.filter(L => Tipp.follows.has(L.key)).sort(byRank); if (mine.length) html += `<div class="tl-g">${T("Yours", "Deine Ligen")}</div>` + mine.map(row).join("");
          GORDER.forEach(g => { const G = all.filter(L => L.grp === g && !Tipp.follows.has(L.key)).sort(byRank); if (!G.length) return;
            const top = G.filter(L => (L.rank ?? 100) < 100 || L.builtin), shown = this.libOpen && this.libOpen.has(g) ? G : top.length ? top : G.slice(0, 3);
            html += `<div class="tl-g">${GRP[g][0]} ${de() ? GRP[g][2] : GRP[g][1]}</div>` + shown.map(row).join("")
              + (G.length > shown.length ? `<button class="tl-more" data-more="${g}">${T("Show all", "Alle zeigen")} (${G.length}) ▾</button>` : ""); });
        }
        if (list._h === html) return; list._h = html; list.innerHTML = html;
        list.querySelectorAll("[data-more]").forEach(b => b.onclick = () => { tap(); (this.libOpen = this.libOpen || new Set()).add(b.dataset.more); draw(); });
        list.querySelectorAll(".tl-r[data-k]:not([disabled])").forEach(b => b.onclick = async () => {
          const k = b.dataset.k, on = !Tipp.follows.has(k), L = Tipp.leagues[k]; tap(); haptic(on ? [10, 40, 10] : 8);
          b.classList.toggle("on", on); b.classList.add("busy"); this.dirty = true;
          try { const n = await Tipp.follow(k, on);
            if (on) toast(n ? `${gl(L)[0]} ${L.name}: ${n} ${n === 1 ? T("game", "Spiel") : T("games", "Spiele")} ${T("to tip", "zum Tippen")}` : `${gl(L)[0]} ${L.name}: ${T("following – its games show up as soon as they are listed", "gefolgt – die Spiele kommen, sobald sie gelistet sind")}`, 2800); }
          catch(er){ b.classList.toggle("on", !on); toast(T("Couldn't save. Check your connection.", "Konnte nicht speichern. Verbindung prüfen."), 2600); }
          b.classList.remove("busy"); });
      };
      q.oninput = draw;
      Tipp.loadLeagues().then(draw, () => { list.innerHTML = `<div class="tp-empty">📡 ${T("No connection.", "Keine Verbindung.")}</div>`; });
    },
  };

  /* ---------- the card on the home screen: only games you haven't tipped, plus your live and fresh results ---------- */
  function homeHTML(){
    const now = Date.now(), me = meId(); if (!me || Tipp.who !== me) return "";
    const live = Tipp.ev.filter(e => (e.state === "in" || (e.state === "pre" && Date.parse(e.start_at) <= now)) && Tipp.mine(e.id)).slice(0, 2);
    const fresh = Tipp.ev.filter(e => e.state === "post" && Tipp.mine(e.id) && now - Date.parse(e.start_at) < 20 * 3600e3).slice(-1);
    const next = Tipp.ev.filter(e => open(e) && !isPM(e) && Date.parse(e.start_at) > now + 60e3 && Date.parse(e.start_at) < now + 4 * 864e5 && (e.fav || e.comp === "nt" || bay(e.home) || bay(e.away) || isW(e)) && !Tipp.mine(e.id))
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
.tp-tabs{display:flex;width:100%}.tp-tabs button{flex:1 1 auto;white-space:nowrap;padding-left:8px;padding-right:8px;font-size:clamp(12px,3.5vw,14px)}
.tp-nln{display:none}@media (max-width:520px){.tp-nlw{display:none}.tp-nln{display:inline}}
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
.tp-lv{font:900 11px var(--body);font-style:normal;color:#fff;background:#E5484D;border-radius:999px;padding:2px 7px;margin-right:6px;vertical-align:4px;animation:tpDot 2s ease-in-out infinite}
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
.pg-gt.tp-tile .pg-art{font-size:34px}
.tq-f.dr{gap:6px}.tq-f.dr .tq-fb{padding-left:4px;padding-right:4px}.tq-d{flex:0 0 24%!important}.tq-d b{font-size:13px}
.tp-libc{border-style:dashed!important}.tp-libc b{font-weight:900;margin-left:2px}
.tl-h{font:900 22px var(--display);margin:2px 0 4px}.tl-sub{color:var(--muted);font:600 13.5px/1.45 var(--body);margin:0 0 10px}
.tl-q{width:100%;box-sizing:border-box;font:700 16px var(--body);padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:var(--panel-2);color:var(--fg);outline:none;-webkit-appearance:none;appearance:none}.tl-q:focus{border-color:var(--go)}
.tl-list{margin-top:4px;min-height:40vh}
.tl-g{font:800 12px var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:14px 2px 6px}
.tl-r{display:flex;align-items:center;gap:12px;width:100%;padding:9px 12px;margin-bottom:6px;border:1px solid var(--line);border-radius:14px;background:var(--panel);color:var(--fg);font:inherit;text-align:left;cursor:pointer;transition:border-color .2s,background .2s;touch-action:manipulation}
.tl-r:active{transform:scale(.985)}.tl-r img,.tl-i{width:30px;height:30px;object-fit:contain;flex:none;border-radius:8px;display:grid;place-items:center;font-size:20px}
.tl-n{flex:1;min-width:0;font:800 15px var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tl-sw{flex:none;width:44px;height:26px;border-radius:999px;background:var(--panel-3,var(--panel-2));position:relative;transition:background .2s;box-shadow:inset 0 0 0 1px var(--line)}
.tl-sw::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .22s cubic-bezier(.3,1.4,.5,1)}
.tl-r.on{border-color:color-mix(in srgb,var(--go) 55%,var(--line));background:color-mix(in srgb,var(--go) 10%,var(--panel))}.tl-r.on .tl-sw{background:var(--go);box-shadow:none}.tl-r.on .tl-sw::after{transform:translateX(18px)}
.tl-r.busy .tl-sw{opacity:.6}.tl-r[disabled]{cursor:default}.tl-r[disabled]:active{transform:none}
.tl-in{flex:none;font:800 11.5px var(--body);color:var(--muted);background:var(--panel-2);border-radius:999px;padding:4px 9px}
.tl-more{display:block;width:100%;border:0;background:none;color:var(--go-hi,var(--go));font:800 13.5px var(--body);padding:4px 0 10px;cursor:pointer;text-align:left}`;
  document.head.appendChild(css);
})();
