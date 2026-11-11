/* ===== Chess.nat Tippspiel: tip football (Bundesliga, Champions League, DFB-Pokal), UFC, Oktagon, boxing and
   handball with Natcoins. Fixtures, live scores, real odds and match stats come from the server (edge function
   "tipp", fed by ESPN every minute). Odds are fixed when you tip; winnings land in your wallet when you open
   the page. Nat-KI tips too, picked at random by the model's probabilities. ===== */
(() => {
  const de = () => typeof I18N === "undefined" || I18N.lang === "de";
  const T = (en, dg) => de() ? dg : en;
  const sb = () => window.ChessSite && window.ChessSite.sb;
  const meId = () => typeof Social !== "undefined" ? Social.me : null;
  const h = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const COMP = {"nt": [T("Germany", "Deutschland"), "🇩🇪"], "ger.1": ["Bundesliga", "⚽"], "uefa.champions": ["Champions League", "⭐"], "ger.dfb_pokal": ["DFB-Pokal", "🏆"], "ufc": ["UFC", "🥊"], "oktagon": ["Oktagon", "🥊"], "box": [T("Boxing", "Boxen"), "🥊"], "hb": ["Handball", "🤾"], "misc": [T("Other", "Sonstiges"), "🎯"]};
  const FILTERS = [["all", T("All", "Alle")], ["nt", "🇩🇪 " + T("Germany", "Deutschland")], ["bay", "⭐ Bayern"], ["ger.1", "Bundesliga"], ["uefa.champions", "Champions League"], ["ger.dfb_pokal", "DFB-Pokal"], ["fight", "UFC · Oktagon · " + T("Boxing", "Boxen")], ["hb", "Handball"]];
  const STAKES = [50, 100, 250, 500, 1000];
  const bay = n => /bayern/i.test(n || ""), bvb = n => /dortmund/i.test(n || "");
  const coin = () => typeof NAT_COIN !== "undefined" ? NAT_COIN : "🪙";
  const fmt = n => typeof fmtNat === "function" ? fmtNat(n) : String(Math.round(n));
  const bal = () => typeof natBal === "function" ? natBal() : 0;
  const dayKey = d => d.toISOString().slice(0, 10);
  const dayName = t => { const d = new Date(t), n = new Date(), k = dayKey(new Date(d.getTime() - d.getTimezoneOffset() * 6e4)), today = dayKey(new Date(n.getTime() - n.getTimezoneOffset() * 6e4)), tm = dayKey(new Date(n.getTime() - n.getTimezoneOffset() * 6e4 + 864e5)), ys = dayKey(new Date(n.getTime() - n.getTimezoneOffset() * 6e4 - 864e5));
    if (k === today) return T("Today", "Heute"); if (k === tm) return T("Tomorrow", "Morgen"); if (k === ys) return T("Yesterday", "Gestern");
    return d.toLocaleDateString(de() ? "de-DE" : "en-GB", {weekday: "long", day: "numeric", month: "long"}); };
  const hm = t => new Date(t).toLocaleTimeString(de() ? "de-DE" : "en-GB", {hour: "2-digit", minute: "2-digit"});
  const q2 = q => (+q).toFixed(2).replace(".", de() ? "," : ".");
  /* the KI is no Dortmund fan: their wins get a third of the chance, draws a bit less */
  const bvbF = (ev, sh, sa) => { const bh = /Dortmund/.test(ev.home), ba = /Dortmund/.test(ev.away); if (!bh && !ba || sh == null) return 1; const r = sh === sa ? "d" : (sh > sa) === bh ? "w" : "l"; return r === "w" ? .3 : r === "d" ? .8 : 1; };
  /* the same rule as the database (tipp_match): what belongs to a round */
  const inRound = (g, e) => { const C2 = g.comps || []; if (!C2.length || C2.includes(e.comp)) return true; if (C2.includes("fight") && ["ufc", "oktagon", "box"].includes(e.comp)) return true;
    if (C2.includes("bay") && (bay(e.home) || bay(e.away))) return true; return C2.includes("nt") && (e.home === "Deutschland" || e.away === "Deutschland") && ["nt", "hb"].includes(e.comp); };
  const RCOMP = [["nt", "🇩🇪", ["Germany", "Deutschland"]], ["bay", "⭐", ["Bayern", "Bayern"]], ["ger.1", "⚽", ["Bundesliga", "Bundesliga"]], ["ger.dfb_pokal", "🏆", ["DFB Cup", "DFB-Pokal"]], ["uefa.champions", "✨", ["Champions League", "Champions League"]], ["fight", "🥊", ["Fights", "Kämpfe"]], ["hb", "🤾", ["Handball", "Handball"]]];
  const liveSt = (tip, ch, ca) => { const m = /^(\d+):(\d+)$/.exec(tip);
    if (m){ const th = +m[1], ta = +m[2]; if (th === ch && ta === ca) return {c: "ok", l: "🎯 " + T("Spot on", "Genau")}; if (th >= ch && ta >= ca) return {c: "in", l: "⏳ " + T("Still on", "Noch drin")}; return {c: "out", l: "💀 " + T("Out", "Raus")}; }
    const cur = ch > ca ? "1" : ch === ca ? "X" : "2"; return tip === cur ? {c: "ok", l: "✅ " + T("Right now", "Liegt richtig")} : {c: "out", l: "❌ " + T("Not now", "Liegt falsch")}; };
  const pickW = os => { let r = Math.random() * os.reduce((s, o) => s + (o.pr || 0), 0); for (const o of os){ r -= o.pr || 0; if (r <= 0) return o; } return os[os.length - 1]; };

  const Tipp = {
    ev: [], tips: [], board: [], admin: false, slip: [], tab: "games", loaded: false,
    /* own tipping rounds: chosen competitions, invited people, their own table */
    groups: [], gid: (() => { try { return localStorage.getItem("chessnat-tipp-group") || ""; } catch(e) { return ""; } })(),
    setGroup(id){ this.gid = id || ""; try { localStorage.setItem("chessnat-tipp-group", this.gid); } catch(e) {} },
    group(){ return this.groups.find(g => g.id === this.gid) || null; },
    async loadGroups(){ const c = sb(); if (!c || !meId()){ this.groups = []; return; } const {data, error} = await c.rpc("tipp_groups_mine"); if (!error) this.groups = data || []; if (this.gid && !this.groups.some(g => g.id === this.gid)) this.setGroup(""); },
    async saveGroup(id, name, comps){ const c = sb(); if (!c || !meId()) return null; const {data, error} = await c.rpc("tipp_group_save", {p_id: id || null, p_name: name, p_comps: comps}); if (error){ toast(error.message); return null; } await this.loadGroups(); return data; },
    async join(code){ const c = sb(); code = String(code || "").toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, 12); if (!code) return null;
      if (!c || !meId()){ try { localStorage.setItem("chessnat-tipp-join", code); } catch(e) {} toast(T("Sign in to join the round.", "Zum Mitmachen bitte anmelden.")); return null; }
      try { localStorage.removeItem("chessnat-tipp-join"); } catch(e) {}
      const {data, error} = await c.rpc("tipp_join", {p_code: code}); if (error || !data){ toast(T("This round doesn't exist (anymore).", "Diese Tipprunde gibt es nicht (mehr).")); return null; }
      await this.loadGroups(); this.setGroup(data.id); return data; },
    async leave(id){ const c = sb(); if (!c) return; await c.rpc("tipp_leave", {p_id: id}); if (this.gid === id) this.setGroup(""); await this.loadGroups(); },
    sel: (() => { try { return new Set(JSON.parse(localStorage.getItem("chessnat-tipp-sel") || "[]")); } catch(e) { return new Set(); } })(),
    saveSel(){ try { localStorage.setItem("chessnat-tipp-sel", JSON.stringify([...this.sel])); } catch(e) {} },
    async load(){
      const c = sb(); if (!c) return;
      const from = new Date(Date.now() - 3 * 864e5).toISOString(), to = new Date(Date.now() + 40 * 864e5).toISOString();
      const [e, t, a] = await Promise.all([
        c.from("tipp_events").select("id,sport,comp,name,home,away,home_logo,away_logo,start_at,state,clock,score_h,score_a,stats,markets,model,odds_src,result,settled,fav,meta").gte("start_at", from).lte("start_at", to).order("start_at"),
        meId() ? c.from("tipp_tips").select("*").eq("user_id", meId()).order("created_at", {ascending: false}).limit(300) : Promise.resolve({data: []}),
        this.adminChecked ? Promise.resolve(null) : (meId() ? c.from("tipp_admins").select("user_id").eq("user_id", meId()) : Promise.resolve({data: []}))]);
      if (e.error) throw e.error; this.loadT = Date.now();
      this.ev = (e.data || []).filter(x => x.state !== "canc" || x.markets.length); this.tips = t.data || [];
      if (a){ this.admin = !!(a.data && a.data.length); this.adminChecked = true; }
      if (!this.grpT || Date.now() - this.grpT > 60000){ this.grpT = Date.now(); try { await this.loadGroups(); } catch(e) {} }
      this.loaded = true;
    },
    async loadBoard(){ const c = sb(); if (!c) return; const g = this.group(); const {data} = g ? await c.rpc("tipp_board_group", {p_group: g.id}) : await c.rpc("tipp_board"); this.board = data || []; this.boardG = g ? g.id : ""; },
    async claim(){
      const c = sb(); if (!c || !meId()) return; try { const {data} = await c.rpc("tipp_claim"); if (data && data.sum > 0){ natEarn(data.sum);
        toast(data.won ? T(`🎉 ${data.won} tip${data.won > 1 ? "s" : ""} won · +${fmt(data.sum)} NAT`, `🎉 ${data.won} Tipp${data.won > 1 ? "s" : ""} gewonnen · +${fmt(data.sum)} NAT`) : T(`↩︎ +${fmt(data.sum)} NAT back`, `↩︎ +${fmt(data.sum)} NAT zurück`), 3200);
        if (data.won && typeof confettiBurst === "function") confettiBurst(); if (Sound.play) Sound.play("Victory", .5); } } catch(e) {}
    },
    myOn(id){ return this.tips.filter(t => t.event_id === id); },
    inSlip(id, k, p){ return this.slip.some(s => s.ev === id && s.k === k && s.p === p); },
    toggle(ev, m, o){ const i = this.slip.findIndex(s => s.ev === ev.id && s.k === m.k && s.p === o.p); if (m.k === "cs" || m.k === "1x2" || m.k === "ou25") delete this.scores[ev.id];
      if (i >= 0) this.slip.splice(i, 1); else { this.slip = this.slip.filter(s => !(s.ev === ev.id && s.k === m.k)); this.slip.push({ev: ev.id, k: m.k, p: o.p, l: o.l, t: m.t, q: o.q, name: ev.sport === "fb" ? `${ev.home} – ${ev.away}` : `${ev.home} vs. ${ev.away}`, stake: this.lastStake || 100}); }
      Sound.tap(); if (navigator.vibrate) try { navigator.vibrate(8); } catch(e) {} },
    /* Nat-KI picks for you: the likely result more often, the surprise sometimes */
    kiPick(ev, all){ const ms = (ev.markets || []).filter(m => m.o && m.o.length); if (!ms.length) return null;
      const m = all ? ms[Math.floor(Math.random() * ms.length)] : ms[0], o = pickW(m.k === "1x2" ? m.o.map(o => Object.assign({}, o, {pr: (o.pr || 0) * bvbF(ev, o.p === "h" ? 1 : 0, o.p === "a" ? 1 : 0)})) : m.o); return {m, o: m.o.find(x => x.p === o.p) || o}; },
    /* a pick that is on the slip for sure (the score sets several at once) */
    put(ev, m, o, stake){ this.slip = this.slip.filter(s => !(s.ev === ev.id && s.k === m.k)); this.slip.push({ev: ev.id, k: m.k, p: o.p, l: o.l, t: m.t, q: o.q, name: ev.sport === "fb" ? `${ev.home} – ${ev.away}` : `${ev.home} vs. ${ev.away}`, stake: stake || this.lastStake || 100}); },
    scores: {},
    saved: (() => { try { return JSON.parse(localStorage.getItem("chessnat-tipp-scores") || "{}"); } catch(e) { return {}; } })(),
    keep(id, sc){ this.saved[id] = sc; try { localStorage.setItem("chessnat-tipp-scores", JSON.stringify(this.saved)); } catch(e) {} },
    /* what I tipped on an event, short: "2:1" or a name */
    myTip(ev){ const ts = this.myOn(ev.id); if (!ts.length) return null; const css = ts.filter(t => t.market === "cs"), cs = css.find(t => t.pick !== "x") || css[0];
      if (cs && cs.pick !== "x") return {score: cs.pick.replace("-", ":"), t: cs};
      const lab = css.map(t => /(\d{1,2}:\d{1,2})\s*$/.exec(t.label || "")).find(Boolean); if (lab) return {score: lab[1], t: cs};
      if (this.saved[ev.id]) return {score: this.saved[ev.id], t: cs || ts[0]};
      const m0 = (ev.markets || [])[0], t0 = ts.find(t => m0 && t.market === m0.k) || ts[0], o = m0 && m0.o.find(o => o.p === t0.pick);
      /* only the winner was tipped: 1 · X · 2 like on a pools coupon; for fights the surname */
      if (ev.sport === "fb" && t0.market === "1x2") return {score: {h: "1", d: "X", a: "2"}[t0.pick] || "?", t: t0};
      const nm = o ? o.l : (t0.label || "").split(": ").pop(); return {name: ev.sport === "fb" ? nm : String(nm).split(" ").pop(), t: t0}; },
    /* the exact score chooses the winner, the goals line and the exact result */
    score(ev, sh, sa, stake){ const D = {"1x2": sh > sa ? "h" : sh === sa ? "d" : "a", ou25: sh + sa > 2.5 ? "o" : "u", cs: `${sh}-${sa}`};
      Object.entries(D).forEach(([k, p]) => { const m = (ev.markets || []).find(x => x.k === k); if (!m) return; const o = m.o.find(x => x.p === p) || (k === "cs" ? m.o.find(x => x.p === "x") : null); if (!o) return; this.put(ev, m, o, stake); if (k === "cs"){ const it = this.slip.find(x => x.ev === ev.id && x.k === "cs"); if (it) it.sc = `${sh}-${sa}`; } });
      this.scores[ev.id] = {h: sh, a: sa}; },
    /* a likely score, now and then a surprise: from the exact-score odds, else from the expected goals */
    kiScore(ev){ for (let i = 0; i < 12; i++){ const r = this.kiScore1(ev), f = bvbF(ev, r.h, r.a); if (f >= 1 || Math.random() < f) return r; } return this.kiScore1(ev); },
    kiScore1(ev){ const cs = (ev.markets || []).find(m => m.k === "cs"), md = ev.model || {};
      const pois = l => { let k = 0, p = Math.exp(-l), s = p, u = Math.random(); while (u > s && k < 9){ k++; p *= l / k; s += p; } return k; };
      if (cs){ const o = pickW(cs.o); if (o.p !== "x"){ const [a, b] = o.p.split("-").map(Number); return {h: a, a: b}; } }
      for (let i = 0; i < 30; i++){ const h0 = pois(md.lh || 1.5), a0 = pois(md.la || 1.1); if (!cs || !cs.o.some(o => o.p === `${h0}-${a0}`) || i > 25) return {h: h0, a: a0}; }
      return {h: 1, a: 1}; },
    friends(){ try { if (typeof Social === "undefined" || !Social.data) return []; const me = Social.me; return (Social.data.friends || []).filter(r => r.status === "accepted").map(r => r.a === me ? r.b : r.a); } catch(e) { return []; } },
    invited: {},
    async invite(id, g){ const c = sb(); g = g === undefined ? this.group() : g; const key = id + "|" + (g ? g.code : "tipp"); if (!c || !meId() || this.invited[key]) return false;
      const {error} = await c.from("chess_invites").insert({from_id: meId(), to_id: id, code: g ? g.code : "tipp", tc: "t:tipp"}); if (error){ toast(error.message); return false; } this.invited[key] = 1; return true; },
    wasInv(id){ const g = this.group(); return !!this.invited[id + "|" + (g ? g.code : "tipp")]; }
  };

  Views.tipp = {
    mount(main, arg){
      this.main = main; if (arg && arg.tab) Tipp.tab = arg.tab;
      main.innerHTML = `<div class="page tp"><div class="tp-head"><h1 class="h-title" style="margin:0">${T("Tipping", "Tippspiel")}</h1><div class="tp-bal" id="tpbal"></div></div>
        <div class="seg tp-tabs" id="tptabs">${[["games", T("Matches", "Spiele")], ["mine", T("My tips", "Meine Tipps")], ["board", T("Leaderboard", "Rangliste")]].map(([k, l]) => `<button data-tab="${k}" class="${Tipp.tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
        <div class="chips tp-grp" id="tpgrp"></div>
        <div class="chips tp-chips" id="tpchips">${FILTERS.map(([k, l]) => `<button class="chip ${(k === "all" ? !Tipp.sel.size : Tipp.sel.has(k)) ? "on" : ""}" data-f="${k}">${h(l)}</button>`).join("")}</div>
        <div id="tpbody"><div class="tp-empty">${T("Loading…", "Lädt…")}</div></div><div id="tpslip"></div></div>`;
      main.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { const from = ["games", "mine", "board"].indexOf(Tipp.tab); Tipp.tab = b.dataset.tab; Sound.tap(); main.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("on", x === b)); this.draw(["games", "mine", "board"].indexOf(Tipp.tab) > from ? 1 : -1); if (Tipp.tab === "board") this.board(); });
      /* tap what interests you (several at once, it's remembered); "All" shows everything */
      const chips = main.querySelector("#tpchips"); chips.querySelectorAll("[data-f]").forEach(x => x.onclick = () => { const k = x.dataset.f, i1 = FILTERS.findIndex(f => f[0] === k), i0 = this.lastF == null ? 0 : this.lastF; this.lastF = i1;
        if (k === "all") Tipp.sel.clear(); else if (Tipp.sel.has(k)) Tipp.sel.delete(k); else Tipp.sel.add(k); Tipp.saveSel();
        Sound.tap(); if (navigator.vibrate) try { navigator.vibrate(6); } catch(_) {} chips.querySelectorAll("[data-f]").forEach(z => z.classList.toggle("on", z.dataset.f === "all" ? !Tipp.sel.size : Tipp.sel.has(z.dataset.f))); this.center(x, true); this.draw(i1 >= i0 ? 1 : -1); });
      requestAnimationFrame(() => { const on = chips.querySelector(".on"); if (on) this.center(on, false); });
      this.grpBar(); this.balance();
      /* a link or an invite into a round: join it, then show its table */
      let jc = arg && arg.join; if (!jc) try { jc = localStorage.getItem("chessnat-tipp-join"); } catch(e) {}
      if (jc && meId()) Tipp.join(jc).then(g => { if (!g) return; toast(`🏆 ${T("You're in", "Du bist dabei:")} „${g.name}“`, 3000); if (navigator.vibrate) try { navigator.vibrate([20, 40, 20]); } catch(e) {} Tipp.tab = "board"; main.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("on", x.dataset.tab === "board")); this.grpBar(); this.board(); });
      else if (jc) Tipp.join(jc);
      this.refresh(true).then(() => { if (App.route !== "tipp" || !arg) return; if (arg.quick && Tipp.ev.some(e => e.id === arg.quick && e.state === "pre")) this.quick(arg.quick); else if (arg.open && Tipp.ev.some(e => e.id === arg.open)) this.openEvent(arg.open); }); Tipp.claim().then(() => this.balance());
      clearInterval(this.iv); this.iv = setInterval(() => { if (App.route !== "tipp") return clearInterval(this.iv); this.refresh(); }, 20000);
    },
    unmount(){ clearInterval(this.iv); },
    /* the round bar: everything, or one of my own rounds, or a new one */
    grpBar(){ const el = this.main && this.main.querySelector("#tpgrp"); if (!el) return; if (!meId()){ el.hidden = true; return; } el.hidden = false;
      const G = Tipp.groups, html = (G.length ? `<button class="chip ${!Tipp.gid ? "on" : ""}" data-g="">🌍 ${T("Global", "Global")}</button>` : "") + `${G.map(g => `<button class="chip ${Tipp.gid === g.id ? "on" : ""}" data-g="${h(g.id)}">🏆 ${h(g.name)}<small>${(g.members || []).length}</small></button>`).join("")}<button class="chip tp-gnew" data-gnew>＋ ${G.length ? T("Round", "Runde") : T("Your own tipping round", "Eigene Tipprunde")}</button>`;
      if (el._h === html) return; el._h = html; el.innerHTML = html;
      el.querySelectorAll("[data-g]").forEach(b => b.onclick = () => { if (Tipp.gid === b.dataset.g) return; Tipp.setGroup(b.dataset.g); Sound.tap(); if (navigator.vibrate) try { navigator.vibrate(6); } catch(_) {} this.center(b, true); this.grpBar(); if (Tipp.tab === "board"){ Tipp.board = []; this.draw(); this.board(); } else this.draw(1); });
      el.querySelector("[data-gnew]").onclick = async () => { Sound.tap(); await this.soc(); this.grpSheet(null); };
      const on = el.querySelector(".on"); if (on) requestAnimationFrame(() => this.center(on, false)); },
    async soc(){ try { if (typeof Social !== "undefined" && Social.start && meId() && !(Social.data && Social.data.friends)){ await Social.start(); await Social.load(); } } catch(e) {} },
    /* make or change a round: name, what is tipped, who is in */
    grpSheet(g){ const F = Tipp.friends(), P = id => { try { return Social.P(id); } catch(e) { return {id, name: "?"}; } }, mem = new Set((g && g.members) || []);
      const sel = new Set(g ? g.comps || [] : ["nt", "bay", "ger.1", "ger.dfb_pokal", "uefa.champions"]), inv = new Set();
      const d = detailSheet(`<div class="tp-gs"><h3>🏆 ${g ? T("Your tipping round", "Deine Tipprunde") : T("New tipping round", "Neue Tipprunde")}</h3>
        <input class="tp-gname" maxlength="40" placeholder="${T("Name, e.g. Family", "Name, z. B. Familie")}" value="${h(g ? g.name : "")}">
        <div class="tp-gl">${T("What gets tipped", "Was getippt wird")}</div><div class="tp-gc">${RCOMP.map(([k, e, l]) => `<button class="chip ${sel.has(k) ? "on" : ""}" data-gc="${k}">${e} ${h(T(l[0], l[1]))}</button>`).join("")}</div>
        <div class="tp-gl">${T("Who plays", "Wer mitspielt")}</div><div class="tp-gf">${F.length ? F.map(id => `<button class="tp-gfr ${mem.has(id) ? "in" : ""}" data-gf="${h(id)}" ${mem.has(id) ? "disabled" : ""}><span class="tp-av">${(() => { try { return Social.face(P(id), 36); } catch(e) { return ""; } })()}</span><b>${h(P(id).name)}</b><i>${mem.has(id) ? "✓ " + T("in", "dabei") : "＋"}</i></button>`).join("") : `<p class="tp-note">${T("No friends yet – share the link.", "Noch keine Freunde – teil einfach den Link.")}</p>`}</div>
        <button class="btn go big" data-gsave>${g ? T("✓ Save", "✓ Speichern") : T("✓ Start the round", "✓ Tipprunde starten")}</button>
        ${g ? `<div class="tp-gx"><button class="btn ghost sm" data-gshare>🔗 ${T("Share link", "Link teilen")}</button>${g.owner !== meId() ? `<button class="btn ghost sm" data-gleave>🚪 ${T("Leave", "Verlassen")}</button>` : ""}</div>` : ""}</div>`);
      const box = d.el, upd = () => { const b = box.querySelector("[data-gsave]"); if (!g) b.textContent = inv.size ? T(`✓ Start and invite ${inv.size}`, `✓ Starten und ${inv.size} einladen`) : T("✓ Start the round", "✓ Tipprunde starten"); else b.textContent = inv.size ? T(`✓ Save and invite ${inv.size}`, `✓ Speichern und ${inv.size} einladen`) : T("✓ Save", "✓ Speichern"); };
      box.querySelectorAll("[data-gc]").forEach(b => b.onclick = () => { const k = b.dataset.gc; sel.has(k) ? sel.delete(k) : sel.add(k); b.classList.toggle("on", sel.has(k)); Sound.tap(); });
      box.querySelectorAll("[data-gf]").forEach(b => b.onclick = () => { const k = b.dataset.gf; inv.has(k) ? inv.delete(k) : inv.add(k); b.classList.toggle("on", inv.has(k)); b.querySelector("i").textContent = inv.has(k) ? "📨" : "＋"; Sound.tap(); upd(); });
      if (!g) setTimeout(() => { const i = box.querySelector(".tp-gname"); if (i && !F.length) i.focus(); }, 300);
      box.querySelector("[data-gsave]").onclick = async () => { if (!sel.size) return toast(T("Pick at least one.", "Wähl mindestens eins aus.")); const b = box.querySelector("[data-gsave]"); b.disabled = true;
        const name = box.querySelector(".tp-gname").value.trim() || (g ? g.name : T("Tipping round", "Tipprunde")), r = await Tipp.saveGroup(g ? g.id : null, name, [...sel]); if (!r){ b.disabled = false; return; }
        const ng = Tipp.groups.find(x => x.id === r.id) || {id: r.id, code: r.code, name: r.name, comps: r.comps}; let n = 0; for (const id of inv) if (await Tipp.invite(id, ng)) n++;
        Tipp.setGroup(r.id); d.close(); Sound.play && Sound.play("GenericNotify", .5); if (navigator.vibrate) try { navigator.vibrate([20, 40, 20]); } catch(e) {}
        toast(n ? T(`🏆 Round ready · ${n} invited`, `🏆 Tipprunde steht · ${n} eingeladen`) : T("🏆 Round ready – share the link", "🏆 Tipprunde steht – teil den Link"), 2800);
        Tipp.tab = "board"; this.main.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("on", x.dataset.tab === "board")); Tipp.board = []; this.grpBar(); this.draw(1); this.board(); };
      const sh = box.querySelector("[data-gshare]"); if (sh) sh.onclick = () => this.share(g);
      const lv = box.querySelector("[data-gleave]"); if (lv) lv.onclick = async () => { await Tipp.leave(g.id); d.close(); toast(T("You left the round.", "Du hast die Tipprunde verlassen.")); this.grpBar(); this.draw(); if (Tipp.tab === "board") this.board(); };
    },
    /* the chosen filter glides into the middle */
    center(x, smooth){ const w = x.parentNode; if (!w) return; const left = x.offsetLeft - (w.clientWidth - x.offsetWidth) / 2; try { w.scrollTo({left: Math.max(0, left), behavior: smooth ? "smooth" : "auto"}); } catch(e) { w.scrollLeft = left; } },
    balance(){ const el = this.main && this.main.querySelector("#tpbal"); if (el) el.innerHTML = `${coin()}<b>${fmt(bal())}</b>`; },
    async refresh(first){
      try { await Tipp.load(); } catch(e) { const b = this.main && this.main.querySelector("#tpbody"); if (b && first) { const setup = /does not exist|could not find|PGRST20/i.test((e.message || "") + (e.code || "")); b.innerHTML = setup ? `<div class="tp-empty">⚽🛠️<br>${T("Setting up the tipping game – almost there.", "Das Tippspiel wird gerade eingerichtet – gleich geht's los.")}</div>` : `<div class="tp-empty">${T("The tipping game isn't reachable right now.", "Das Tippspiel ist gerade nicht erreichbar.")}<br><small>${h(e.message || "")}</small></div>`; } return; }
      if (App.route !== "tipp") return; if (!first) Tipp.claim().then(() => this.balance());
      if (Tipp.tab === "board") this.board(); else this.draw();
    },
    draw(dir){
      const b = this.main && this.main.querySelector("#tpbody"); if (!b) return; const y = this.main.scrollTop;
      const ch = this.main.querySelector("#tpchips"); if (ch) ch.hidden = Tipp.tab !== "games" || !!Tipp.group(); this.grpBar();
      if (Tipp.tab === "games") b.innerHTML = this.gamesHTML(); else if (Tipp.tab === "mine") b.innerHTML = this.mineHTML(); else b.innerHTML = this.boardHTML();
      this.wire(b); this.slipBar(); this.balance(); if (!dir) this.main.scrollTop = y;
      if (dir){ b.classList.remove("tp-in-l", "tp-in-r"); void b.offsetWidth; b.classList.add(dir > 0 ? "tp-in-r" : "tp-in-l"); }
    },
    /* ---------- matches ---------- */
    shown(){
      const S1 = Tipp.sel, now = Date.now(), hit = (f, e) => f === "nt" ? e.home === "Deutschland" || e.away === "Deutschland" : f === "bay" ? bay(e.home) || bay(e.away) : f === "fight" ? ["ufc", "oktagon", "box"].includes(e.comp) : e.comp === f;
      return Tipp.ev.filter(e => (e.state !== "post" || now - Date.parse(e.start_at) < 30 * 3600e3) && (e.markets.length || e.state !== "pre"))
        .filter(e => { const g = Tipp.group(); if (g) return inRound(g, e); return !S1.size || [...S1].some(f => hit(f, e)); });
    },
    gamesHTML(){
      const L = this.shown(), live = L.filter(e => e.state === "in"), groups = {};
      L.filter(e => e.state !== "in").forEach(e => { const k = dayName(e.start_at); (groups[k] = groups[k] || []).push(e); });
      const chips = "";
      const tools = `<div class="tp-tools"><button class="btn ghost sm" data-ki="all">🤖 ${T("Let Nat-KI tip", "KI tippt für mich")}</button>${Tipp.admin ? `<button class="btn ghost sm" data-admin="new">＋ ${T("Event", "Event")}</button>` : ""}</div>`;
      if (!L.length) return chips + tools + `<div class="tp-empty">${Tipp.loaded ? T("Nothing to tip here right now.", "Hier gibt es gerade nichts zu tippen.") : T("Loading…", "Lädt…")}</div>`;
      return chips + tools + (live.length ? `<div class="tp-day live">● LIVE</div>${live.map(e => this.card(e)).join("")}` : "") + Object.entries(groups).map(([d, es]) => `<div class="tp-day">${h(d)}</div>${this.cards(es)}`).join("");
    },
    cards(es){ /* a fight night shows as one block */
      let out = "", card = null; es.forEach(e => { if (e.sport === "mma" && e.meta && e.meta.card){ if (card !== e.meta.card){ card = e.meta.card; out += `<div class="tp-card-h">🥊 ${h(e.meta.card)}</div>`; } } else card = null; out += this.card(e); }); return out; },
    card(e){
      const c = COMP[e.comp] || COMP.misc, mine = Tipp.myOn(e.id), m0 = (e.markets || [])[0], live = e.state === "in", done = e.state === "post";
      const name = (n, side) => `<span class="tp-nm">${bvb(n) ? "😈 " : ""}${h(n)}</span>`;
      const logo = u => u ? `<img class="tp-lg" src="${h(u)}" alt="" loading="lazy">` : `<span class="tp-lg tp-lg0"></span>`;
      const sc = (v, w) => e.state === "pre" ? "" : `<b class="tp-sc ${w ? "w" : ""}">${e.sport === "fb" ? (v == null ? "–" : v) : (w ? "✓" : "")}</b>`;
      const hw = e.score_h != null && e.score_h > e.score_a, aw = e.score_a != null && e.score_a > e.score_h;
      const time = live ? `<span class="tp-live">● ${h(e.clock || "LIVE")}</span>` : done ? `<span class="tp-ft">${h(e.clock || T("Final", "Ende"))}</span>` : `<span class="tp-time">${hm(e.start_at)}</span>`;
      const st = e.stats || {}, extra = e.sport === "fb" && (live || done) && (st.yc != null) ? `<div class="tp-stats">🟨 ${st.yc || 0}${st.rc ? ` · 🟥 ${st.rc}` : ""}${st.pens ? ` · ⚽ ${T("pen", "Elfer")} ${st.pens}` : ""}${st.cor != null ? ` · ⛳ ${st.cor}` : ""}</div>` : "";
      const odds = m0 && e.state === "pre" ? `<div class="tp-odds sm">${m0.o.map(o => `<span>${h(m0.k === "1x2" ? (o.p === "h" ? "1" : o.p === "d" ? "X" : "2") : o.l.split(" ").pop())} <b>${q2(o.q)}</b></span>`).join("")}</div>` : "";
      const my = Tipp.myTip(e), open = e.state === "pre" && Date.parse(e.start_at) > Date.now(), fbq = e.sport === "fb" && (e.markets || []).some(m => m.k === "cs");
      /* while it runs: is my tip still alive? the same words as in the pushes */
      const ls = my && my.score && e.sport === "fb" && (live || done) && e.score_h != null && !(my.t && (my.t.status === "won" || my.t.status === "lost")) ? liveSt(my.score, +e.score_h, +e.score_a) : null;
      const big = my ? `<button class="tp-big mine ${done ? (my.t && my.t.status === "won" ? "won" : my.t && my.t.status === "lost" ? "lost" : "") : ""} ${ls ? ls.c : ""}" data-open="${h(e.id)}"><small>${ls ? ls.l : T("My tip", "Mein Tipp")}</small><b class="${String(my.score || my.name).length > 7 ? "lg" : ""}">${h(my.score || my.name)}</b></button>`
        : open && (e.markets || []).length ? `<button class="tp-big" data-quick="${h(e.id)}"><small>${T("Tip", "Tippen")}</small><b>${fbq ? "–:–" : "?"}</b></button>` : "";
      const more = e.state === "pre" && e.markets.length > 1 ? `<button class="tp-more" data-open="${h(e.id)}">+${e.markets.length - 1} ${T("bets", "Wetten")}</button>` : (e.state !== "pre" || mine.length) ? `<button class="tp-more" data-open="${h(e.id)}">${T("Details", "Details")}</button>` : "";
      return `<div class="tp-ev ${e.fav || bay(e.home) || bay(e.away) ? "fav" : ""} ${live ? "is-live" : ""}" data-open="${h(e.id)}">
        <div class="tp-top"><span class="tp-comp">${c[1]} ${h(c[0])}${e.meta && e.meta.main && e.sport === "mma" ? ` · ${T("Main card", "Hauptkarte")}` : ""}</span>${time}</div>
        <div class="tp-mid"><div class="tp-teams"><div class="tp-row">${logo(e.home_logo)}${name(e.home)}${sc(e.score_h, hw)}</div><div class="tp-row">${logo(e.away_logo)}${name(e.away)}${sc(e.score_a, aw)}</div></div>${big}</div>
        ${extra}${odds}<div class="tp-foot">${!my && Tipp.scores[e.id] ? `<span class="pill tp-myscore">📝 ${Tipp.scores[e.id].h}:${Tipp.scores[e.id].a}</span>` : ""}${e.model && e.model.lh != null ? `<span class="tp-xg" title="xG">xG ${String(e.model.lh).replace(".", ",")} : ${String(e.model.la).replace(".", ",")}</span>` : ""}${more}</div></div>`;
    },
    /* ---------- one event: every market ---------- */
    openEvent(id){
      const e = Tipp.ev.find(x => x.id === id); if (!e) return; const c = COMP[e.comp] || COMP.misc, mine = Tipp.myOn(id);
      const groups = {}; (e.markets || []).forEach(m => { const g = ["1x2", "dc", "win"].includes(m.k) ? T("Result", "Ergebnis") : /^ou|btts|cs/.test(m.k) ? T("Goals", "Tore") : ["yc35", "yc55", "red", "pen", "cor"].includes(m.k) ? T("Cards & more", "Karten & mehr") : ["how", "dist"].includes(m.k) ? T("Fight", "Kampf") : T("Specials", "Spezial"); (groups[g] = groups[g] || []).push(m); });
      const res = e.result || {}, open = e.state === "pre" && Date.parse(e.start_at) > Date.now();
      const mk = m => `<div class="tp-m"><div class="tp-mt">${h(m.t)}${res[m.k] ? ` <span class="pill ${res[m.k] === "void" ? "" : "go"}">${res[m.k] === "void" ? T("void", "ungültig") : "✓ " + h((m.o.find(o => o.p === res[m.k] || (Array.isArray(res[m.k]) && res[m.k].includes(o.p))) || {}).l || "")}</span>` : ""}</div>
        <div class="tp-mo ${m.o.length > 3 ? "grid" : ""}">${m.o.map(o => `<button class="tp-o ${Tipp.inSlip(e.id, m.k, o.p) ? "on" : ""} ${res[m.k] && (res[m.k] === o.p || (Array.isArray(res[m.k]) && res[m.k].includes(o.p))) ? "hit" : ""}" ${open ? "" : "disabled"} data-ev="${h(e.id)}" data-k="${h(m.k)}" data-p="${h(o.p)}"><small>${h(o.l)}</small><b>${q2(o.q)}</b><i>${Math.round((o.pr || 0) * 100)}%</i></button>`).join("")}</div>
        ${Tipp.admin && !open && !res[m.k] ? `<div class="tp-adm">${m.o.map(o => `<button class="chip" data-settle="${h(m.k)}" data-v="${h(o.p)}">✓ ${h(o.l)}</button>`).join("")}<button class="chip" data-settle="${h(m.k)}" data-v="void">${T("void", "ungültig")}</button></div>` : ""}</div>`;
      const st = e.stats || {};
      const html = `<div class="tp-sheet"><div class="tp-top"><span class="tp-comp">${c[1]} ${h(c[0])}</span><span>${e.state === "in" ? `<span class="tp-live">● ${h(e.clock || "LIVE")}</span>` : e.state === "post" ? h(e.clock || "") : dayName(e.start_at) + " · " + hm(e.start_at)}</span></div>
        <div class="tp-vs"><div>${e.home_logo ? `<img src="${h(e.home_logo)}" alt="">` : ""}<b>${h(e.home)}</b></div><div class="tp-vsc">${e.state === "pre" ? "vs." : e.sport === "fb" ? `${e.score_h ?? 0}:${e.score_a ?? 0}` : "✓"}</div><div>${e.away_logo ? `<img src="${h(e.away_logo)}" alt="">` : ""}<b>${h(e.away)}</b></div></div>
        ${e.sport === "fb" && st.yc != null ? `<div class="tp-stats c">🟨 ${st.yc} · 🟥 ${st.rc || 0} · ${T("Penalties", "Elfmeter")} ${st.pens || 0} · ⛳ ${st.cor || 0}</div>` : ""}
        ${e.model && e.model.lh != null ? `<p class="tp-note">${T("Expected goals (model)", "Erwartete Tore (Modell)")}: <b>${e.model.lh} : ${e.model.la}</b>${e.odds_src && e.odds_src !== "model" && e.odds_src !== "manual" ? ` · ${T("odds based on", "Quoten nach")} ${h(e.odds_src)}` : ""}</p>` : ""}
        ${open && e.sport === "fb" && (e.markets || []).some(m => m.k === "cs") ? (() => { const sc = Tipp.scores[e.id]; return `<div class="tp-pick"><div class="tp-dg" data-side="h"><small>${h(e.home)}</small><b>${sc ? sc.h : ""}</b></div><span class="tp-colon">:</span><div class="tp-dg" data-side="a"><small>${h(e.away)}</small><b>${sc ? sc.a : ""}</b></div><button class="tp-kib" data-kiscore>🤖<small>${T("AI", "KI")}</small></button></div>
            <div class="tp-pad" hidden>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => `<button data-n="${n}" ${n === 0 ? 'class="z"' : ""}>${n}</button>`).join("")}</div>
            <p class="tp-pk-sum">${sc ? T("✓ Winner · goals · exact score are picked", "✓ Sieger · Tore · genaues Ergebnis sind gewählt") : T("Tap the boxes and type the score", "Tipp auf die Felder und gib das Ergebnis ein")}</p>`; })()
          : open ? `<button class="btn ghost sm" data-kiev="${h(e.id)}" style="margin:2px 0 8px">🤖 ${T("Nat-KI picks a tip", "KI-Tipp für dieses Spiel")}</button>` : ""}
        ${mine.length ? `<div class="tp-mine">${mine.map(t => this.tipRow(t, e)).join("")}</div>` : ""}
        ${!open && meId() ? `<div class="tp-others" hidden></div>` : ""}
        ${Object.entries(groups).map(([g, ms]) => `<div class="tp-g">${h(g)}</div>${ms.map(mk).join("")}`).join("")}
        ${Tipp.admin && e.id.startsWith("man:") ? `<button class="btn ghost sm" data-admin="${h(e.id)}" style="margin-top:10px">✎ ${T("Edit event", "Event bearbeiten")}</button>` : ""}</div>`;
      const d = detailSheet(html); this.sheet = d;
      /* after kick-off: what everyone in my rounds (and the KI) tipped, and how it stands */
      const ot = d.el.querySelector(".tp-others"); if (ot && sb()) sb().rpc("tipp_event_tips", {p_event: e.id}).then(({data}) => { const rows = (data || []).filter(r => r.cs || r.x); if (!rows.length || !ot.isConnected) return;
        const tipOf = r => r.cs || (e.sport === "fb" ? {h: "1", d: "X", a: "2"}[r.x] : ((e.markets[0] || {o: []}).o.find(o => o.p === r.x) || {}).l) || "?";
        ot.innerHTML = `<div class="tp-g">👥 ${T("Tips", "Tipps")}</div>` + rows.map(r => { const tp = tipOf(r), ls = e.sport === "fb" && e.score_h != null && r.status === "open" ? liveSt(r.cs || tp, +e.score_h, +e.score_a) : null;
          const face = r.bot === "ki" ? "🤖" : (() => { try { return avatarSVG(Object.assign({}, r.avatar || {}, {aura: "none", pet: "none"}), {head: true, size: 30}); } catch(_) { return "🙂"; } })();
          return `<div class="tp-ot ${r.uid === meId() ? "me" : ""}"><span class="tp-av">${face}</span><b>${h(r.name)}</b>${ls ? `<span class="tp-ls ${ls.c}">${ls.l}</span>` : r.status === "won" ? `<span class="tp-ls ok">✓ +${fmt(r.net)}</span>` : r.status === "lost" ? `<span class="tp-ls out">✗</span>` : ""}<span class="tp-otip">${h(String(tp))}</span></div>`; }).join("");
        ot.hidden = false; }).catch(() => {});
      d.el.querySelectorAll(".tp-o[data-k]").forEach(b => b.onclick = () => { const m = e.markets.find(x => x.k === b.dataset.k), o = m && m.o.find(x => x.p === b.dataset.p); if (!o) return; Tipp.toggle(e, m, o);
        d.el.querySelectorAll(`.tp-o[data-ev]`).forEach(x => x.classList.toggle("on", Tipp.inSlip(e.id, x.dataset.k, x.dataset.p))); this.slipBar(); this.syncCards(); });
      /* the score: arrows, or the AI spins the numbers like a slot machine */
      const pick = d.el.querySelector(".tp-pick");
      if (pick){ const dg = side => pick.querySelector(`[data-side="${side}"] b`), sum = d.el.querySelector(".tp-pk-sum"), sync = () => { d.el.querySelectorAll(`.tp-o[data-ev]`).forEach(x => x.classList.toggle("on", Tipp.inSlip(e.id, x.dataset.k, x.dataset.p))); this.slipBar(); this.syncCards(); if (sum) sum.textContent = T("✓ Winner · goals · exact score are picked", "✓ Sieger · Tore · genaues Ergebnis sind gewählt"); };
        const set = (sh, sa) => { Tipp.score(e, sh, sa); dg("h").textContent = sh; dg("a").textContent = sa; sync(); };
        /* tap a box, the big number pad opens; home first, then away, then it closes by itself */
        const pad = d.el.querySelector(".tp-pad"), cur = Object.assign({}, Tipp.scores[e.id] || {}); let focus = null;
        const foc = side => { focus = side; pick.querySelectorAll(".tp-dg").forEach(x => x.classList.toggle("on", x.dataset.side === side)); pad.hidden = !side; if (side) pad.classList.remove("in"), void pad.offsetWidth, pad.classList.add("in"); };
        pick.querySelectorAll(".tp-dg").forEach(x => x.onclick = () => { if (this.spinning) return; Sound.tap(); foc(focus === x.dataset.side ? null : x.dataset.side); });
        pad.querySelectorAll("[data-n]").forEach(b => b.onclick = () => { if (!focus) return; const n = +b.dataset.n, side = focus; cur[side] = n; const el = dg(side); el.textContent = n; el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
          Sound.tap(); if (navigator.vibrate) try { navigator.vibrate(8); } catch(_) {}
          const other = side === "h" ? "a" : "h"; if (cur[other] == null){ foc(other); return; }
          foc(null); set(cur.h, cur.a); if (Sound.play) Sound.play("Move", .6); });
        pick.querySelector("[data-kiscore]").onclick = () => { if (this.spinning) return; const r = Tipp.kiScore(e); this.spinning = 1; Sound.tap(); pick.classList.add("spin");
          foc(null); this.roll(dg("h"), r.h, 900); this.roll(dg("a"), r.a, 1350, () => { this.spinning = 0; pick.classList.remove("spin"); cur.h = r.h; cur.a = r.a; set(r.h, r.a); if (Sound.play) Sound.play("Move", .7); if (navigator.vibrate) try { navigator.vibrate([15, 30, 15]); } catch(_) {} }); }; }
      const kb = d.el.querySelector("[data-kiev]"); if (kb) kb.onclick = () => { const r = Tipp.kiPick(e, Math.random() < .5); if (!r) return; if (!Tipp.inSlip(e.id, r.m.k, r.o.p)) Tipp.toggle(e, r.m, r.o);
        d.el.querySelectorAll(`.tp-o[data-ev]`).forEach(x => x.classList.toggle("on", Tipp.inSlip(e.id, x.dataset.k, x.dataset.p))); toast(`🤖 ${r.m.t}: ${r.o.l} (${q2(r.o.q)})`); this.slipBar(); this.syncCards(); };
      d.el.querySelectorAll("[data-settle]").forEach(b => b.onclick = async () => { if (!b.dataset.arm){ b.dataset.arm = 1; b.textContent = T("Sure? Tap again", "Sicher? Nochmal tippen"); return; }
        const {error} = await sb().rpc("tipp_settle", {p_event: e.id, p_res: {[b.dataset.settle]: b.dataset.v}}); if (error) return toast(error.message); toast(T("Settled", "Abgerechnet")); d.close(); this.refresh(); });
      const ab = d.el.querySelector("[data-admin]"); if (ab) ab.onclick = () => { d.close(); this.adminForm(e); };
    },
    /* the simple way: my score (or my winner), how much, done — placed at once */
    /* the next game of the list that I haven't tipped yet: a whole matchday in one go */
    nextOpen(after){ const t0 = Date.parse(after.start_at); return (this.shown ? this.shown() : Tipp.ev).filter(e => e.id !== after.id && e.state === "pre" && Date.parse(e.start_at) > Date.now() + 60e3 && (e.markets || []).length && !Tipp.myOn(e.id).length && !Tipp.slip.some(x => x.ev === e.id))
        .sort((a, b) => Math.abs(Date.parse(a.start_at) - t0) - Math.abs(Date.parse(b.start_at) - t0))[0] || null; },
    quick(id, n2){
      const e = Tipp.ev.find(x => x.id === id); if (!e) return; const fbq = e.sport === "fb" && (e.markets || []).some(m => m.k === "cs"), m0 = e.markets[0];
      let stake = Tipp.lastStake && [50, 100, 250, 500].includes(Tipp.lastStake) ? Tipp.lastStake : 100, choice = null; const cur = {};
      const d = detailSheet(`<div class="tp-q"><div class="tp-top"><span class="tp-comp">${(COMP[e.comp] || COMP.misc)[1]} ${h((COMP[e.comp] || COMP.misc)[0])}</span><span>${dayName(e.start_at)} · ${hm(e.start_at)}</span></div>
        ${fbq ? `<div class="tp-pick big"><div class="tp-dg" data-side="h"><small>${h(e.home)}</small><b></b></div><span class="tp-colon">:</span><div class="tp-dg" data-side="a"><small>${h(e.away)}</small><b></b></div><button class="tp-kib" data-kiscore>🤖<small>${T("AI", "KI")}</small></button></div>
          <div class="tp-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => `<button data-n="${n}" ${n === 0 ? 'class="z"' : ""}>${n}</button>`).join("")}</div>`
          : `<div class="tp-who">${m0.o.map(o => `<button data-pick="${h(o.p)}"><b>${h(o.l)}</b></button>`).join("")}</div>`}
        <div class="tp-qst">${T("Stake", "Einsatz")} ${[50, 100, 250, 500].map(v => `<button class="chip ${v === stake ? "on" : ""}" data-qs="${v}">${v}</button>`).join("")}</div>
        <p class="tp-qwin"></p><button class="btn go big" data-go disabled>${T("✓ Tip", "✓ Tippen")}</button>${n2 ? `<p class="tp-qn">${T("Next game", "Nächstes Spiel")} · ${n2} ${T("tipped", "getippt")}</p>` : ""}</div>`);
      const el = d.el, go = el.querySelector("[data-go]"), win = el.querySelector(".tp-qwin");
      const info = () => { if (fbq){ if (cur.h == null || cur.a == null){ go.disabled = true; win.textContent = ""; return; } const cs = e.markets.find(m => m.k === "cs"), x = e.markets.find(m => m.k === "1x2"), oc = cs.o.find(o => o.p === `${cur.h}-${cur.a}`) || cs.o.find(o => o.p === "x"), ox = x && x.o.find(o => o.p === (cur.h > cur.a ? "h" : cur.h === cur.a ? "d" : "a"));
          const half = Math.round(stake / 2); win.innerHTML = `🎯 ${T("Exact", "Genau")}: <b>${fmt(Math.round((stake - half) * oc.q + (ox ? half * ox.q : 0)))} NAT</b> · ✓ ${T("Only the winner", "Nur Sieger")}: <b>${ox ? fmt(Math.round(half * ox.q)) : 0} NAT</b>`; }
        else { const o = choice && m0.o.find(o => o.p === choice); win.innerHTML = o ? `${T("If right you get", "Wenn's stimmt, bekommst du")} <b>${fmt(Math.round(stake * o.q))} NAT</b>` : ""; }
        go.disabled = fbq ? cur.h == null || cur.a == null : !choice; go.textContent = stake > bal() ? T("Not enough NAT", "Zu wenig NAT") : T("✓ Tip", "✓ Tippen"); if (stake > bal()) go.disabled = true; };
      el.querySelectorAll("[data-qs]").forEach(b => b.onclick = () => { stake = +b.dataset.qs; Tipp.lastStake = stake; el.querySelectorAll("[data-qs]").forEach(x => x.classList.toggle("on", x === b)); Sound.tap(); info(); });
      if (fbq){ const pick = el.querySelector(".tp-pick"), pad = el.querySelector(".tp-pad"), dg = side => pick.querySelector(`[data-side="${side}"] b`); let focus = "h";
        const foc = side => { focus = side; pick.querySelectorAll(".tp-dg").forEach(x => x.classList.toggle("on", x.dataset.side === side)); };
        foc("h"); pick.querySelectorAll(".tp-dg").forEach(x => x.onclick = () => { Sound.tap(); foc(x.dataset.side); });
        pad.querySelectorAll("[data-n]").forEach(b => b.onclick = () => { if (!focus || this.spinning) return; const n = +b.dataset.n, side = focus; cur[side] = n; const g = dg(side); g.textContent = n; g.classList.remove("bump"); void g.offsetWidth; g.classList.add("bump"); Sound.tap(); if (navigator.vibrate) try { navigator.vibrate(8); } catch(_) {}
          const other = side === "h" ? "a" : "h"; foc(cur[other] == null ? other : null); info(); });
        el.querySelector("[data-kiscore]").onclick = () => { if (this.spinning) return; const r = Tipp.kiScore(e); this.spinning = 1; foc(null); Sound.tap(); pick.classList.add("spin");
          this.roll(dg("h"), r.h, 900); this.roll(dg("a"), r.a, 1350, () => { this.spinning = 0; pick.classList.remove("spin"); cur.h = r.h; cur.a = r.a; info(); if (Sound.play) Sound.play("Move", .6); }); }; }
      else el.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { choice = b.dataset.pick; el.querySelectorAll("[data-pick]").forEach(x => x.classList.toggle("on", x === b)); Sound.tap(); info(); });
      go.onclick = async () => { if (go.disabled) return; go.disabled = true; go.textContent = T("Tipping…", "Wird getippt…"); const keep = Tipp.slip; Tipp.slip = [];
        if (fbq){ const half = Math.round(stake / 2); Tipp.score(e, cur.h, cur.a, half); Tipp.slip = Tipp.slip.filter(x => x.k !== "ou25"); const csp = Tipp.slip.find(x => x.k === "cs"); if (csp) csp.stake = stake - half; Tipp.keep(e.id, `${cur.h}:${cur.a}`); }
        else { const o = m0.o.find(o => o.p === choice); Tipp.put(e, m0, o, stake); }
        const n = await this.place(); Tipp.slip = keep.filter(x => x.ev !== e.id); this.slipBar(); d.close();
        if (n){ toast(`✅ ${T("Tipped", "Getippt")}: ${fbq ? `${cur.h}:${cur.a}` : h((m0.o.find(o => o.p === choice) || {}).l || "")}`, 2200); if (navigator.vibrate) try { navigator.vibrate([20, 40, 20]); } catch(_) {} this.refresh();
          /* on to the next open game of the same day or matchday, until the sheet is closed */
          const nx = this.nextOpen(e); if (nx && Math.abs(Date.parse(nx.start_at) - Date.parse(e.start_at)) < 4 * 864e5) setTimeout(() => { if (App.route === "tipp" && !document.querySelector(".dsheet")) this.quick(nx.id, (n2 || 0) + 1); }, 450); } };
      info();
    },
    /* numbers spin and slow down, then stop on the result */
    roll(el, final, ms, done, pool){ const t0 = performance.now(); let last = 0, k = 0; const step = now2 => { const p = Math.min(1, (now2 - t0) / ms), gap = 40 + 260 * p * p;
        if (p >= 1){ el.textContent = final; el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); if (done) done(); return; }
        if (now2 - last > gap){ last = now2; k++; el.textContent = pool ? pool[k % pool.length] : String(Math.floor(Math.random() * 6)); if (navigator.vibrate && k % 2) try { navigator.vibrate(3); } catch(_) {} if (Sound.tick && k % 2) try { Sound.tick(); } catch(_) {} }
        requestAnimationFrame(step); };
      requestAnimationFrame(step); },
    /* "AI tips for me": the next matches roll like a slot machine, then go on the slip together */
    kiAll(){
      const L = this.shown().filter(e => e.state === "pre" && Date.parse(e.start_at) > Date.now() + 60e3 && (e.markets || []).length && !Tipp.myOn(e.id).length && !Tipp.slip.some(s => s.ev === e.id)).slice(0, 8);
      if (!L.length) return toast(T("Everything here is tipped already.", "Hier ist schon alles getippt."));
      const fb = e => e.sport === "fb" && (e.markets || []).some(m => m.k === "cs");
      const res = L.map(e => fb(e) ? {e, s: Tipp.kiScore(e)} : (() => { const m = e.markets[0], o = pickW(m.o); return {e, m, o}; })());
      const row = r => fb(r.e) ? `<div class="tp-kr"><span class="nm r">${h(r.e.home)}</span><b class="d">0</b><i>:</i><b class="d">0</b><span class="nm">${h(r.e.away)}</span></div>`
        : `<div class="tp-kr f"><span class="nm r">${h((COMP[r.e.comp] || COMP.misc)[1])}</span><b class="w">…</b><small>${T("wins", "gewinnt")}</small></div>`;
      const d = detailSheet(`<div class="tp-kis"><h3>🤖 ${T("Nat-KI is tipping…", "Die KI tippt…")}</h3>${res.map(row).join("")}<div class="tp-kst">${T("Stake per tip", "Einsatz pro Tipp")} ${[10, 50, 100].map(v => `<button class="chip ${v === 50 ? "on" : ""}" data-kst="${v}">${v}</button>`).join("")}</div><button class="btn go big" data-take disabled>${T("Rolling…", "Läuft…")}</button></div>`);
      let stake = 50; d.el.querySelectorAll("[data-kst]").forEach(x => x.onclick = () => { stake = +x.dataset.kst; d.el.querySelectorAll("[data-kst]").forEach(z => z.classList.toggle("on", z === x)); Sound.tap(); });
      const rows = d.el.querySelectorAll(".tp-kr"); let left = res.length;
      res.forEach((r, i) => { const el = rows[i], fin = () => { el.classList.add("done"); if (Sound.play) Sound.play("Move", .45); if (--left === 0){ const tk = d.el.querySelector("[data-take]"); tk.disabled = false; tk.textContent = T(`✓ Put ${res.length} on my slip`, `✓ ${res.length} auf meinen Schein`); } };
        if (r.s){ const ds = el.querySelectorAll(".d"); this.roll(ds[0], r.s.h, 700 + i * 260); this.roll(ds[1], r.s.a, 950 + i * 260, fin); }
        else this.roll(el.querySelector(".w"), r.o.l, 950 + i * 260, () => { const o2 = r.e.markets[0].o.find(o => o.p !== r.o.p); el.querySelector("small").textContent = o2 ? T("beats ", "schlägt ") + o2.l : T("wins", "gewinnt"); fin(); }, r.e.markets[0].o.map(o => o.l)); });
      d.el.querySelector("[data-take]").onclick = () => { res.forEach(r => { if (r.s) Tipp.score(r.e, r.s.h, r.s.a, stake); else Tipp.put(r.e, r.m, r.o, stake); }); d.close(); Sound.tap(); toast(`🤖 ${T("On your slip", "Auf deinem Schein")} ✓`, 1800); this.draw(); };
    },
    syncCards(){ const b = this.main && this.main.querySelector("#tpbody"); if (b) b.querySelectorAll(".tp-o[data-ev]").forEach(x => x.classList.toggle("on", Tipp.inSlip(x.dataset.ev, x.dataset.k, x.dataset.p))); },
    tipRow(t, e){ e = e || Tipp.ev.find(x => x.id === t.event_id); const win = Math.round(t.stake * t.odds);
      const st = t.status === "won" ? `<span class="tp-res won">+${fmt(t.payout - t.stake)}</span>` : t.status === "lost" ? `<span class="tp-res lost">−${fmt(t.stake)}</span>` : t.status === "void" ? `<span class="tp-res">↩︎ ${fmt(t.stake)}</span>` : `<span class="tp-res open">${T("to win", "Gewinn")} ${fmt(win)}</span>`;
      /* a running or finished game, not yet paid out: how the exact score or the winner stands right now */
      let ls = null; if (t.status === "open" && e && e.sport === "fb" && e.state !== "pre" && e.score_h != null){ const lab = /(\d+):(\d+)\s*$/.exec(t.label || "");
        if (t.market === "cs") ls = t.pick !== "x" ? liveSt(t.pick.replace("-", ":"), +e.score_h, +e.score_a) : lab ? liveSt(lab[1] + ":" + lab[2], +e.score_h, +e.score_a) : null;
        else if (t.market === "1x2") ls = liveSt({h: "1", d: "X", a: "2"}[t.pick], +e.score_h, +e.score_a); }
      const st2 = ls && ls.c === "out" && t.market === "cs" ? `<span class="tp-res lost"><s>${fmt(win)}</s></span>` : st;
      return `<div class="tp-tip ${t.status}" data-open="${h(t.event_id)}"><div class="grow"><div class="tp-tl">${ls ? `<span class="tp-ls ${ls.c}">${ls.l}</span> ` : ""}${h(t.label || t.market + ": " + t.pick)}</div><div class="tp-ts">${e ? h(e.sport === "fb" ? `${e.home} – ${e.away}` : `${e.home} vs. ${e.away}`) + (e.state !== "pre" && e.sport === "fb" ? ` · ${e.score_h ?? 0}:${e.score_a ?? 0}${e.state === "in" ? " ●" : ""}` : "") : ""} · ${fmt(t.stake)} × ${q2(t.odds)}</div></div>${st2}</div>`; },
    /* ---------- my tips ---------- */
    mineHTML(){
      const by = {}; Tipp.slip.forEach(x => (by[x.ev] = by[x.ev] || []).push(x));
      const pend = Tipp.slip.length ? `<div class="tp-pend"><div class="tp-day">📝 ${T("Not placed yet", "Noch nicht abgegeben")}</div>${Object.entries(by).map(([ev, xs]) => { const sc = Tipp.scores[ev], st = xs.reduce((a, x) => a + x.stake, 0), w = xs.reduce((a, x) => a + Math.round(x.stake * x.q), 0);
          return `<div class="tp-tip pend tp-pg" data-open="${h(ev)}"><div class="grow"><div class="tp-tl">${h(xs[0].name)}${sc ? ` <span class="pill tp-myscore">🎯 ${sc.h}:${sc.a}</span>` : ""}</div><div class="tp-pgl">${xs.map(x => `<span>${h(x.l)} <i>${q2(x.q)}</i></span>`).join("")}</div><div class="tp-ts">${T("Stake", "Einsatz")} ${fmt(st)} · ${T("win up to", "Gewinn bis")} ${fmt(w)}</div></div></div>`; }).join("")}<button class="btn go big" data-slip2>${T("Place now", "Jetzt abgeben")} ›</button></div>` : "";
      const L = Tipp.tips; if (!L.length) return pend + (pend ? "" : `<div class="tp-empty">${T("No tips yet. Pick a match and tap an odd.", "Noch keine Tipps. Such dir ein Spiel aus und tipp auf eine Quote.")}</div>`);
      const open = L.filter(t => t.status === "open"), done = L.filter(t => t.status !== "open"), net = done.reduce((s, t) => s + t.payout - t.stake, 0), won = done.filter(t => t.status === "won").length;
      return pend + `<div class="tp-sum"><div><b class="${net >= 0 ? "pos" : "neg"}">${net >= 0 ? "+" : "−"}${fmt(Math.abs(net))}</b><small>NAT ${T("net", "Bilanz")}</small></div><div><b>${won}/${done.length}</b><small>${T("won", "gewonnen")}</small></div><div><b>${open.length}</b><small>${T("open", "offen")}</small></div></div>
        ${open.length ? `<div class="tp-day">${T("Open", "Offen")}</div>${open.map(t => this.tipRow(t)).join("")}` : ""}${done.length ? `<div class="tp-day">${T("Settled", "Abgerechnet")}</div>${done.slice(0, 80).map(t => this.tipRow(t)).join("")}` : ""}`;
    },
    /* ---------- leaderboard ---------- */
    async board(){ try { if (typeof Social !== "undefined" && Social.start && meId()){ await Social.start(); await Social.load(); } } catch(e) {} await Tipp.loadBoard(); if (Tipp.tab === "board") this.draw(); },
    boardHTML(){
      const F = Tipp.friends(), have = new Set(Tipp.board.map(r => r.uid)), P = id => { try { return Social.P(id); } catch(e) { return {id, name: "?"}; } }, g = Tipp.group();
      if (g && Tipp.boardG !== g.id) return `<div class="tp-empty">${T("Loading…", "Lädt…")}</div>`;
      /* friends who haven't tipped yet (or aren't in the round yet) stand at the bottom, with an invite */
      const mem = new Set((g && g.members) || []), rows = Tipp.board.map(r => g && r.uid && !r.n ? Object.assign({}, r, {none: 1, member: 1}) : r);
      const B = rows.concat(F.filter(id => !have.has(id) && !mem.has(id)).map(id => ({uid: id, name: P(id).name, profit: 0, won: 0, lost: 0, open: 0, none: 1})));
      if (meId() && !B.some(r => r.uid === meId())) B.push({uid: meId(), name: T("You", "Du"), profit: 0, won: 0, lost: 0, open: 0, none: 1});
      const myI = B.findIndex(r => r.uid === meId()), head = r => { if (r.bot === "ki") return `<span class="tp-av ki">🤖</span>`; try { if (r.uid && typeof Social !== "undefined" && Social.data && Social.data.players[r.uid]) return `<span class="tp-av">${Social.face(Social.P(r.uid), 40)}</span>`; return `<span class="tp-av">${avatarSVG(Object.assign({}, r.avatar || {}, {aura: "none", pet: "none"}), {head: true, size: 40})}</span>`; } catch(e) { return `<span class="tp-av"></span>`; } };
      const row = (r, i) => `<div class="tp-br ${r.uid === meId() ? "me" : ""} ${r.bot ? "bot" : ""} ${r.none ? "none" : ""}"><span class="tp-rk">${r.none ? "·" : i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>${head(r)}<div class="grow"><b>${h(r.bot === "ki" ? "Nat-KI" : r.name)}${r.uid === meId() ? ` <span class="pill go">${T("You", "Du")}</span>` : ""}</b><small>${r.none ? (r.member ? T("in · no tips yet", "dabei · noch kein Tipp") : T("no tips yet", "noch kein Tipp")) : `${r.won}/${r.won + r.lost} ${T("won", "gewonnen")}${r.open ? ` · ${r.open} ${T("open", "offen")}` : ""}`}</small></div>${r.none && r.uid !== meId() && !r.member ? `<button class="btn sm ${Tipp.wasInv(r.uid) ? "" : "go"}" data-tinv="${h(r.uid)}" ${Tipp.wasInv(r.uid) ? "disabled" : ""}>${Tipp.wasInv(r.uid) ? "✓" : "📨 " + T("Invite", "Einladen")}</button>` : `<b class="tp-pf ${r.profit >= 0 ? "pos" : "neg"}">${r.profit >= 0 ? "+" : "−"}${fmt(Math.abs(r.profit))}</b>`}</div>`;
      const top = g ? `<div class="tp-ghead"><div class="grow"><b>🏆 ${h(g.name)}</b><small>${(g.comps || []).map(k => (RCOMP.find(r => r[0] === k) || [k, "•"])[1]).join(" ")} · ${(g.members || []).length} ${T("in", "dabei")}</small></div><button class="btn sm go" data-gshare2>📨 ${T("Invite", "Einladen")}</button><button class="btn sm ghost" data-gedit>✏️</button></div>` : `<div class="tp-tools" style="margin-top:12px"><button class="btn ghost sm" data-invall>📨 ${T("Invite friends", "Freunde einladen")}</button></div>`;
      return top + (myI > 4 && B.length > 8 && !B[myI].none ? `<div class="tp-pin">${row(B[myI], myI)}</div>` : "") + `<div class="tp-board">${B.map(row).join("")}</div><p class="tp-note c">${T("Ranked by Natcoins won minus staked on settled tips.", "Gezählt wird, was du mit abgerechneten Tipps gewonnen minus eingesetzt hast.")}</p>`;
    },
    inviteSheet(){
      const F = Tipp.friends(), P = id => { try { return Social.P(id); } catch(e) { return {id, name: "?"}; } };
      const g = Tipp.group(), mem = new Set((g && g.members) || []);
      const d = detailSheet(`<div class="tp-invs"><h3 style="margin:0 0 4px">📨 ${g ? `${T("Invite to", "Einladen in")} „${h(g.name)}“` : T("Invite to the tipping game", "Zum Tippspiel einladen")}</h3><p class="tp-note">${T("They get a push and land right here.", "Sie bekommen einen Push und landen direkt hier.")}</p>
        ${F.filter(id => !mem.has(id)).length ? F.filter(id => !mem.has(id)).map(id => `<div class="tp-br"><span class="tp-av">${(() => { try { return Social.face(P(id), 40); } catch(e) { return ""; } })()}</span><div class="grow"><b>${h(P(id).name)}</b></div><button class="btn sm ${Tipp.wasInv(id) ? "" : "go"}" data-tinv="${h(id)}" ${Tipp.wasInv(id) ? "disabled" : ""}>${Tipp.wasInv(id) ? "✓" : "📨 " + T("Invite", "Einladen")}</button></div>`).join("") : `<p class="tp-note">${T("No friends yet.", "Noch keine Freunde.")}</p>`}
        <button class="btn ghost" data-tshare style="margin-top:8px">🔗 ${T("Share a link", "Link teilen")}</button></div>`);
      this.wireInv(d.el); const sh = d.el.querySelector("[data-tshare]"); if (sh) sh.onclick = () => this.share(g);
    },
    async share(g){ const url = location.origin + (g ? "/#tipp-" + g.code : "/#tipp"), text = g ? T(`Join my tipping round „${g.name}“ on Chess.nat – with Natcoins!`, `Tipp mit in meiner Tipprunde „${g.name}“ auf Chess.nat – mit Natcoins!`) : T("Tip with me in the Chess.nat tipping game – Bayern, Bundesliga, UFC, with Natcoins!", "Tipp mit mir im Chess.nat-Tippspiel – Bayern, Bundesliga, UFC, mit Natcoins!");
      try { if (navigator.share){ await navigator.share({title: "Chess.nat Tippspiel", text, url}); return; } } catch(e) { if (e && e.name === "AbortError") return; }
      try { await navigator.clipboard.writeText(text + " " + url); toast(T("Link copied.", "Link kopiert."), 2500); } catch(e) {} },
    wireInv(root){ root.querySelectorAll("[data-tinv]").forEach(b => b.onclick = async () => { b.disabled = true; Sound.tap(); if (await Tipp.invite(b.dataset.tinv)){ b.textContent = "✓"; b.classList.remove("go"); toast(T("Invite sent", "Einladung geschickt"), 1800); if (navigator.vibrate) try { navigator.vibrate(12); } catch(_) {} } else b.disabled = false; }); },
    /* ---------- the bet slip ---------- */
    slipBar(){
      const el = this.main && this.main.querySelector("#tpslip"); if (!el) return; const S1 = Tipp.slip;
      if (!S1.length){ el.innerHTML = ""; el.className = ""; return; }
      const stake = S1.reduce((s, x) => s + x.stake, 0), win = S1.reduce((s, x) => s + Math.round(x.stake * x.q), 0);
      el.className = "tp-slipbar"; el.innerHTML = `<button data-slip><span class="tp-sn">${S1.length}</span><span class="grow">${T("Tip slip", "Tippschein")}<small>${fmt(stake)} NAT · ${T("win up to", "Gewinn bis")} ${fmt(win)}</small></span><b>${T("Place", "Tippen")} ›</b></button>`;
      el.querySelector("[data-slip]").onclick = () => this.openSlip();
    },
    openSlip(){
      const draw = () => { const S1 = Tipp.slip, stake = S1.reduce((s, x) => s + x.stake, 0), win = S1.reduce((s, x) => s + Math.round(x.stake * x.q), 0);
        return `<div class="tp-slip"><h3 style="margin:0 0 8px">${T("Tip slip", "Tippschein")}</h3>${S1.length > 1 ? `<div class="tp-st tp-all"><span>${T("Stake for all", "Einsatz für alle")}</span>${[10, 50, 100, 250].map(v => `<button class="chip ${S1.every(x => x.stake === v) ? "on" : ""}" data-sta="${v}">${v}</button>`).join("")}</div>` : ""}${S1.map((x, i) => `<div class="tp-si"><div class="grow"><b>${h(x.t)}: ${h(x.l)}</b><small>${h(x.name)}</small></div><b class="tp-q">${q2(x.q)}</b><button class="tp-x" data-rm="${i}">✕</button>
          <div class="tp-st">${STAKES.map(v => `<button class="chip ${x.stake === v ? "on" : ""}" data-st="${i}" data-v="${v}">${fmt(v)}</button>`).join("")}<button class="chip ${x.stake === Math.max(1, bal()) ? "on" : ""}" data-st="${i}" data-v="max">${T("All in", "Alles")}</button></div><small class="tp-pw">${T("Possible win", "Möglicher Gewinn")}: <b>${fmt(Math.round(x.stake * x.q))} NAT</b></small></div>`).join("")}
          <div class="tp-tot"><span>${T("Stake", "Einsatz")} <b>${fmt(stake)}</b></span><span>${T("Balance", "Guthaben")} <b>${fmt(bal())}</b></span><span>${T("Win up to", "Gewinn bis")} <b>${fmt(win)}</b></span></div>
          <button class="btn go big" data-place ${stake > bal() || !S1.length ? "disabled" : ""}>${stake > bal() ? T("Not enough NAT", "Zu wenig NAT") : T("Place tips", "Tipps abgeben")}</button>
          <button class="btn ghost" data-clear style="margin-top:6px">${T("Clear slip", "Schein leeren")}</button></div>`; };
      const d = detailSheet(`<div id="tpsl">${draw()}</div>`); const box = d.el.querySelector("#tpsl");
      const wire = () => {
        box.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { Tipp.slip.splice(+b.dataset.rm, 1); Sound.tap(); if (!Tipp.slip.length) d.close(); else { box.innerHTML = draw(); wire(); } this.slipBar(); this.syncCards(); });
        box.querySelectorAll("[data-sta]").forEach(b => b.onclick = () => { Tipp.slip.forEach(x => x.stake = +b.dataset.sta); Tipp.lastStake = +b.dataset.sta; Sound.tap(); box.innerHTML = draw(); wire(); this.slipBar(); });
        box.querySelectorAll("[data-st]").forEach(b => b.onclick = () => { const x = Tipp.slip[+b.dataset.st]; x.stake = b.dataset.v === "max" ? Math.max(1, Math.floor(bal())) : +b.dataset.v; Tipp.lastStake = x.stake; Sound.tap(); box.innerHTML = draw(); wire(); this.slipBar(); });
        const cl = box.querySelector("[data-clear]"); if (cl) cl.onclick = () => { Tipp.slip = []; d.close(); this.slipBar(); this.syncCards(); };
        const pl = box.querySelector("[data-place]"); if (pl) pl.onclick = async () => { pl.disabled = true; pl.textContent = T("Placing…", "Wird getippt…"); const n = await this.place(); d.close(); if (n) { toast(T(`✅ ${n} tip${n > 1 ? "s" : ""} placed. Good luck!`, `✅ ${n} Tipp${n > 1 ? "s" : ""} abgegeben. Viel Glück!`)); this.refresh(); } };
      }; wire();
    },
    async place(){
      const c = sb(); if (!c || !meId()){ toast(T("Sign in to tip.", "Zum Tippen bitte anmelden.")); return 0; }
      let ok = 0; const left = [];
      Tipp.slip.forEach(x => { if (x.k === "cs" && x.sc) Tipp.keep(x.ev, x.sc.replace("-", ":")); });
      for (const x of Tipp.slip.slice().sort((a, b) => (b.k === "cs") - (a.k === "cs"))){
        if (!natSpend(x.stake)){ left.push(x); continue; }
        const {error} = await c.rpc("tipp_place", {p_event: x.ev, p_market: x.k, p_pick: x.p, p_stake: x.stake, p_score: x.k === "cs" && x.sc ? x.sc : null});
        if (error){ natEarn(x.stake, true); left.push(x); toast(/closed/.test(error.message) ? T("That match has started.", "Das Spiel hat schon begonnen.") : error.message); } else ok++;
      }
      Tipp.slip = left; this.slipBar(); this.balance(); if (this.main && Tipp.tab === "mine") this.draw(); if (ok){ Sound.play && Sound.play("GenericNotify", .5); if (navigator.vibrate) try { navigator.vibrate([20, 40, 20]); } catch(e) {} }
      return ok;
    },
    /* ---------- an admin makes boxing, Oktagon and handball events by hand ---------- */
    adminForm(e){
      e = e || {}; const m0 = (e.markets || [])[0] || {}, oq = p => { const o = (m0.o || []).find(x => x.p === p); return o ? o.q : ""; }, props = (e.markets || []).slice(1);
      const loc = t => { if (!t) return ""; const d = new Date(t); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
      const html = `<div class="tp-form"><h3 style="margin:0 0 10px">${e.id ? T("Edit event", "Event bearbeiten") : T("New event", "Neues Event")}</h3>
        <label>${T("Sport", "Sport")}<select name="comp">${[["box", T("Boxing", "Boxen")], ["oktagon", "Oktagon"], ["ufc", "UFC"], ["hb", "Handball"], ["ger.1", "Bundesliga"], ["misc", T("Other", "Sonstiges")]].map(([k, l]) => `<option value="${k}" ${e.comp === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>${T("Title (optional)", "Titel (optional)")}<input name="name" value="${h(e.name || "")}" placeholder="Kabayel vs. …"></label>
        <div class="tp-2"><label>${T("Side A", "Seite A")}<input name="home" value="${h(e.home || "")}" required></label><label>${T("Side B", "Seite B")}<input name="away" value="${h(e.away || "")}" required></label></div>
        <label>${T("Start", "Beginn")}<input type="datetime-local" name="start" value="${loc(e.start_at)}" required></label>
        <div class="tp-3"><label>${T("Odds A", "Quote A")}<input name="qa" inputmode="decimal" value="${(m0.k === "1x2" ? oq("h") : oq("a")) || ""}" placeholder="1.40"></label><label>${T("Odds draw", "Quote X")}<input name="qd" inputmode="decimal" value="${oq("d") || ""}" placeholder="${T("none", "keine")}"></label><label>${T("Odds B", "Quote B")}<input name="qb" inputmode="decimal" value="${(m0.k === "1x2" ? oq("a") : oq("b")) || ""}" placeholder="2.90"></label></div>
        ${[0, 1, 2].map(i => { const p = props[i] || {}, y = (p.o || []).find(o => o.p === "y") || {}, n = (p.o || []).find(o => o.p === "n") || {}; return `<div class="tp-3"><label>${T("Extra bet", "Zusatzwette")} ${i + 1}<input name="pt${i}" value="${h(p.t || "")}" placeholder="${["K.o.-Sieg?", "Über 6,5 Runden?", "Deutschland mit 5+ Toren?"][i]}"></label><label>${T("Odds yes", "Quote Ja")}<input name="py${i}" inputmode="decimal" value="${y.q || ""}"></label><label>${T("Odds no", "Quote Nein")}<input name="pn${i}" inputmode="decimal" value="${n.q || ""}"></label></div>`; }).join("")}
        <label class="tp-chk"><input type="checkbox" name="fav" ${e.fav ? "checked" : ""}> ⭐ ${T("Big event (reminder push)", "Großes Event (Erinnerung per Push)")}</label>
        ${e.id && e.state !== "post" ? `<div class="tp-2"><label>${T("Score A (live)", "Stand A (live)")}<input name="sh" inputmode="numeric" value="${e.score_h ?? ""}"></label><label>${T("Score B", "Stand B")}<input name="sa" inputmode="numeric" value="${e.score_a ?? ""}"></label></div>` : ""}
        <button class="btn go big" data-save>${T("Save", "Speichern")}</button><p class="tp-note">${T("Odds as decimals. You settle the result in the event once it's over.", "Quoten als Dezimalzahl. Das Ergebnis trägst du im Event ein, wenn es vorbei ist.")}</p></div>`;
      const d = detailSheet(html); const f = d.el.querySelector(".tp-form"), v = n => { const x = f.querySelector(`[name="${n}"]`); return x ? (x.type === "checkbox" ? x.checked : x.value.trim()) : ""; }, num = s => +String(s).replace(",", ".") || 0;
      f.querySelector("[data-save]").onclick = async () => {
        const A = v("home"), B = v("away"), st = v("start"); if (!A || !B || !st) return toast(T("Sides and start are needed.", "Seiten und Beginn fehlen."));
        const qa = num(v("qa")) || 1.9, qb = num(v("qb")) || 1.9, qd = num(v("qd")), inv = 1 / qa + 1 / qb + (qd ? 1 / qd : 0), pr = q => Math.round(100 / q / inv) / 100;
        const sport = {box: "box", oktagon: "mma", ufc: "mma", hb: "hb", "ger.1": "fb"}[v("comp")] || "misc";
        const win = qd ? {k: "1x2", t: T("Winner", "Sieger"), o: [{p: "h", l: A, q: qa, pr: pr(qa)}, {p: "d", l: T("Draw", "Unentschieden"), q: qd, pr: pr(qd)}, {p: "a", l: B, q: qb, pr: pr(qb)}]}
          : {k: "win", t: T("Winner", "Sieger"), o: [{p: "a", l: A, q: qa, pr: pr(qa)}, {p: "b", l: B, q: qb, pr: pr(qb)}]};
        const markets = [win]; [0, 1, 2].forEach(i => { const t = v("pt" + i), y = num(v("py" + i)), n = num(v("pn" + i)); if (t && y && n){ const s = 1 / y + 1 / n; markets.push({k: "x" + i, t, o: [{p: "y", l: T("Yes", "Ja"), q: y, pr: Math.round(100 / y / s) / 100}, {p: "n", l: T("No", "Nein"), q: n, pr: Math.round(100 / n / s) / 100}]}); } });
        const p = {id: e.id || "", sport, comp: v("comp"), name: v("name") || `${A} vs. ${B}`, home: A, away: B, start_at: new Date(st).toISOString(), markets, fav: v("fav"), state: e.state || "pre"};
        if (v("sh") !== "" && v("sa") !== ""){ p.score_h = +v("sh"); p.score_a = +v("sa"); if (Date.parse(p.start_at) < Date.now()) p.state = "in"; }
        const {error} = await sb().rpc("tipp_admin_event", {p}); if (error) return toast(error.message); toast(T("Saved", "Gespeichert")); d.close(); this.refresh();
      };
    },
    wire(b){
      b.querySelectorAll(".tp-o[data-ev]").forEach(x => x.onclick = ev => { ev.stopPropagation(); const e = Tipp.ev.find(z => z.id === x.dataset.ev), m = e && e.markets.find(z => z.k === x.dataset.k), o = m && m.o.find(z => z.p === x.dataset.p); if (!o) return; Tipp.toggle(e, m, o); x.parentNode.querySelectorAll(".tp-o").forEach(z => z.classList.toggle("on", Tipp.inSlip(e.id, z.dataset.k, z.dataset.p))); this.slipBar(); });
      b.querySelectorAll("[data-open]").forEach(x => x.onclick = ev => { if (ev.target.closest(".tp-o")) return; ev.stopPropagation(); Sound.tap(); this.openEvent(x.dataset.open); });
      const ki = b.querySelector("[data-ki]"); if (ki) ki.onclick = () => this.kiAll();
      b.querySelectorAll("[data-admin]").forEach(x => x.onclick = () => this.adminForm(x.dataset.admin === "new" ? null : Tipp.ev.find(e => e.id === x.dataset.admin)));
      b.querySelectorAll("[data-quick]").forEach(x => x.onclick = ev => { ev.stopPropagation(); Sound.tap(); this.quick(x.dataset.quick); });
      const s2 = b.querySelector("[data-slip2]"); if (s2) s2.onclick = () => { Sound.tap(); this.openSlip(); };
      const ia = b.querySelector("[data-invall]"); if (ia) ia.onclick = () => { Sound.tap(); this.inviteSheet(); };
      const gs = b.querySelector("[data-gshare2]"); if (gs) gs.onclick = () => { Sound.tap(); this.inviteSheet(); };
      const ge = b.querySelector("[data-gedit]"); if (ge) ge.onclick = async () => { Sound.tap(); await this.soc(); this.grpSheet(Tipp.group()); };
      this.wireInv(b);
    }
  };
  if (typeof TAB_OF !== "undefined") TAB_OF.tipp = "tipp";
  window.Tipp = Tipp;
  /* on the home screen: my running games and the next big game I haven't tipped yet */
  function homeHTML(){
    const now = Date.now(), live = Tipp.ev.filter(e => e.state === "in" && Tipp.myTip(e)).slice(0, 2);
    const next = Tipp.ev.filter(e => e.state === "pre" && Date.parse(e.start_at) > now + 60e3 && Date.parse(e.start_at) < now + 4 * 864e5 && (e.fav || bay(e.home) || bay(e.away) || e.comp === "nt") && !Tipp.myOn(e.id).length && (e.markets || []).length).slice(0, 3 - live.length);
    if (!live.length && !next.length) return "";
    const flag = e => e.comp === "nt" ? "🇩🇪 " : bay(e.home) || bay(e.away) ? "⭐ " : e.sport === "mma" || e.sport === "box" ? "🥊 " : e.sport === "hb" ? "🤾 " : "";
    const day = t => { const d = new Date(t), n = new Date(); const dd = Math.round((new Date(d.toDateString()) - new Date(n.toDateString())) / 864e5); return dd === 0 ? T("Today", "Heute") : dd === 1 ? T("Tomorrow", "Morgen") : d.toLocaleDateString(de() ? "de-DE" : "en-GB", {weekday: "short"}); };
    return `<div class="th-h">⚽ ${T("Tipping game", "Tippspiel")}</div>` + live.map(e => { const my = Tipp.myTip(e), ls = my.score && e.sport === "fb" ? liveSt(my.score, +e.score_h, +e.score_a) : null;
        return `<button class="th-row live" data-th="${h(e.id)}"><span class="th-t">● ${h(e.clock || "LIVE")}</span><span class="th-m">${h(e.home)} <b>${e.score_h ?? "–"}:${e.score_a ?? "–"}</b> ${h(e.away)}</span><span class="th-tip ${ls ? ls.c : ""}">${ls ? ls.l.split(" ")[0] + " " : ""}${h(my.score || my.name)}</span></button>`; }).join("")
      + next.map(e => `<button class="th-row" data-th="${h(e.id)}" data-q="1"><span class="th-t">${h(day(e.start_at))} ${hm(e.start_at)}</span><span class="th-m">${flag(e)}${h(e.home)} – ${h(e.away)}</span><span class="th-go">${T("Tip", "Tippen")}</span></button>`).join("");
  }
  window.homeTipp = async el => {
    if (!el) return; const fill = () => { if (!el.isConnected) return; const x = homeHTML(); el.innerHTML = x; el.hidden = !x;
      el.querySelectorAll("[data-th]").forEach(b => b.onclick = () => { Sound.tap(); App.go("tipp", b.dataset.q ? {quick: b.dataset.th} : {open: b.dataset.th}); }); };
    if (Tipp.ev.length && Date.now() - (Tipp.loadT || 0) < 180000) return fill();
    try { await Tipp.load(); } catch(e) { return; } fill(); };

  const css = document.createElement("style"); css.textContent = `
.tp-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.tp-bal{display:flex;align-items:center;gap:6px;background:var(--panel-2);border:1px solid var(--line);border-radius:999px;padding:5px 12px 5px 7px;font:900 16px var(--display)}.tp-bal .natc{width:20px;height:20px}
.tp-tabs{display:flex;width:100%}.tp-tabs button{flex:1}.tp-chips{flex-wrap:nowrap;overflow-x:auto;margin:12px -2px 8px;padding:0 2px 2px;scrollbar-width:none}.tp-chips::-webkit-scrollbar{display:none}.tp-chips .chip{flex:none}
.tp-tools{display:flex;gap:8px;margin:0 0 6px;flex-wrap:wrap}.tp-empty{color:var(--muted);text-align:center;padding:40px 10px;line-height:1.5}
.tp-day{font:800 12px var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:16px 2px 7px}.tp-day.live{color:var(--bad)}
.tp-card-h{font:900 15px var(--display);margin:10px 2px 6px}
.tp-ev{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:10px 12px;margin-bottom:8px;cursor:pointer}.tp-ev.fav{border-color:color-mix(in srgb,#DC052D 55%,var(--line));box-shadow:inset 3px 0 0 #DC052D}.tp-ev.is-live{border-color:color-mix(in srgb,var(--bad) 60%,var(--line))}
.tp-top{display:flex;justify-content:space-between;align-items:center;font:700 12px var(--body);color:var(--muted);margin-bottom:6px;gap:8px}.tp-comp{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tp-time{font:800 13px var(--body);color:var(--fg)}.tp-live{color:var(--bad);font:900 12.5px var(--body);animation:tpPulse 1.6s infinite}.tp-ft{font:800 12px var(--body)}@keyframes tpPulse{50%{opacity:.55}}
.tp-row{display:flex;align-items:center;gap:9px;padding:3px 0}.tp-lg{width:24px;height:24px;object-fit:contain;flex:none}.tp-lg0{border-radius:50%;background:var(--panel-3)}.tp-nm{flex:1;font:800 15.5px var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tp-sc{font:900 18px var(--display);min-width:22px;text-align:right;color:var(--muted)}.tp-sc.w{color:var(--fg)}
.tp-stats{font:700 12.5px var(--body);color:var(--muted);margin:4px 0 0}.tp-stats.c{text-align:center;margin:0 0 8px}
.tp-odds{display:flex;gap:6px;margin-top:9px}.tp-o{flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;border:1px solid var(--line);background:var(--panel-2);color:var(--fg);border-radius:10px;padding:6px 4px;cursor:pointer;min-width:0;position:relative}
.tp-o small{font:700 11px var(--body);color:var(--muted);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tp-o b{font:900 15.5px var(--display)}.tp-o i{font:700 10px var(--body);font-style:normal;color:var(--muted)}
.tp-o.on{background:var(--go);border-color:var(--go);color:#fff}.tp-o.on small,.tp-o.on i{color:#eaffd6}.tp-o.hit{outline:2px solid var(--go)}.tp-o:disabled{opacity:.55;cursor:default}
.tp-foot{display:flex;align-items:center;gap:8px;margin-top:8px;min-height:20px}.tp-xg{font:700 11.5px var(--body);color:var(--muted)}.tp-more{margin-left:auto;border:0;background:none;color:var(--go);font:800 13px var(--body);cursor:pointer;padding:2px 0}
.tp-sheet .tp-vs{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 0 12px;text-align:center}.tp-vs>div{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px}.tp-vs img{width:46px;height:46px;object-fit:contain}.tp-vs b{font:900 15px var(--display)}.tp-vsc{flex:none!important;font:900 28px var(--display)}
.tp-note{color:var(--muted);font-size:12.5px;margin:2px 0 8px}.tp-note.c{text-align:center}.tp-g{font:800 12px var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:14px 0 6px}
.tp-m{margin-bottom:10px}.tp-mt{font:800 14px var(--body);margin-bottom:5px}.tp-mo{display:flex;gap:6px}.tp-mo.grid{display:grid;grid-template-columns:repeat(4,1fr)}.tp-adm{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.tp-tip{display:flex;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:9px 11px;margin-bottom:6px;cursor:pointer}.tp-tip.won{border-color:color-mix(in srgb,var(--go) 55%,var(--line))}.tp-tip.lost{opacity:.75}
.tp-tl{font:800 14px var(--body)}.tp-ts{font:600 12px var(--body);color:var(--muted);margin-top:2px}.tp-res{font:900 14px var(--display);white-space:nowrap}.tp-res.won{color:var(--go)}.tp-res.lost{color:var(--bad)}.tp-res.open{font:700 12px var(--body);color:var(--muted)}
.tp-mine{margin:0 0 8px}.tp-sum{display:flex;gap:8px;margin:12px 0 4px}.tp-sum>div{flex:1;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px;text-align:center;display:flex;flex-direction:column}.tp-sum b{font:900 20px var(--display)}.tp-sum small{color:var(--muted);font-weight:700}
.pos{color:var(--go)}.neg{color:var(--bad)}
.tp-pin{margin:12px 0 8px}.tp-board{display:flex;flex-direction:column;gap:6px;margin-top:10px}.tp-br{display:flex;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:8px 11px}.tp-br.me{border-color:var(--go)}.tp-br.bot{background:color-mix(in srgb,#5AA3E0 10%,var(--panel))}
.tp-br .grow{display:flex;flex-direction:column;min-width:0}.tp-br b{font:900 15px var(--display)}.tp-br small{color:var(--muted);font-weight:700;font-size:12px}.tp-rk{width:26px;text-align:center;font:900 16px var(--display)}.tp-av{width:40px;height:40px;border-radius:50%;overflow:hidden;background:var(--panel-3);display:grid;place-items:center;font-size:22px;flex:none}.tp-av svg{width:100%;height:100%}.tp-pf{font:900 17px var(--display)}
.tp-slipbar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 74px);width:min(520px,calc(100% - 24px));z-index:60;animation:tpUp .25s ease-out}@keyframes tpUp{from{transform:translate(-50%,20px);opacity:0}}
.tp-slipbar button{width:100%;display:flex;align-items:center;gap:10px;border:0;background:var(--go);color:#fff;border-radius:14px;padding:10px 14px;box-shadow:0 10px 24px rgba(0,0,0,.4),inset 0 -4px 0 rgba(0,0,0,.18);cursor:pointer;font:800 15px var(--body);text-align:left}
.tp-slipbar small{display:block;font:700 12px var(--body);opacity:.9}.tp-sn{background:#fff;color:var(--go);border-radius:999px;min-width:26px;height:26px;display:grid;place-items:center;font:900 14px var(--display)}
.tp-si{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;background:var(--panel-2);border-radius:12px;padding:9px 10px;margin-bottom:8px}.tp-si .grow{display:flex;flex-direction:column;min-width:0}.tp-si small{color:var(--muted);font-weight:700}.tp-q{font:900 17px var(--display)}.tp-x{border:0;background:none;color:var(--muted);font-size:16px;cursor:pointer}
.tp-st{display:flex;gap:5px;flex-wrap:wrap;width:100%}.tp-st .chip{padding:5px 10px;font-size:12.5px}.tp-pw{width:100%;color:var(--muted)}.tp-tot{display:flex;justify-content:space-between;gap:8px;margin:6px 2px 12px;font-size:13px;color:var(--muted);flex-wrap:wrap}.tp-tot b{color:var(--fg)}
.tp-form label{display:flex;flex-direction:column;gap:4px;font:700 12.5px var(--body);color:var(--muted);margin-bottom:9px}.tp-form input,.tp-form select{background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:9px 10px;color:var(--fg);font:600 15px var(--body);min-width:0}
.tp-form label{min-width:0}.tp-form input,.tp-form select{width:100%;box-sizing:border-box}.tp-2,.tp-3{display:grid;gap:8px}.tp-2{grid-template-columns:1fr 1fr}.tp-3{grid-template-columns:2fr 1fr 1fr}.tp-chk{flex-direction:row!important;align-items:center;gap:8px!important}
.pg-gt.tp-tile .pg-art{font-size:34px}
.tp-chips{scroll-behavior:smooth;margin:12px 0 4px;padding:2px 0 4px;overscroll-behavior-x:contain;touch-action:pan-x}
.tp{overflow-x:clip;max-width:100%}#tpbody{overflow-x:clip}.tp-chips .chip{transition:background .25s,color .25s,transform .2s}.tp-chips .chip.on{transform:scale(1.04)}
#tpbody.tp-in-r{animation:tpInR .28s cubic-bezier(.2,.8,.25,1)}#tpbody.tp-in-l{animation:tpInL .28s cubic-bezier(.2,.8,.25,1)}
@keyframes tpInR{from{opacity:0;transform:translateX(26px)}}@keyframes tpInL{from{opacity:0;transform:translateX(-26px)}}
.tp-pick{display:flex;align-items:flex-end;justify-content:center;gap:10px;margin:2px 0 4px}.tp-dg{display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;max-width:110px}
.tp-dg small{font:800 11.5px var(--body);color:var(--muted);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tp-dg b{width:78px;height:78px;display:grid;place-items:center;background:var(--panel-2);border:2px solid var(--line);border-radius:18px;font:900 44px var(--display);font-variant-numeric:tabular-nums;transition:border-color .15s,box-shadow .15s}
.tp-dg b:empty::after{content:"?";color:var(--muted);opacity:.45}.tp-dg.on b{border-color:var(--go);box-shadow:0 0 0 4px color-mix(in srgb,var(--go) 28%,transparent)}
.tp-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0 6px}.tp-pad[hidden]{display:none}.tp-pad.in{animation:tpPad .22s cubic-bezier(.2,.9,.3,1)}@keyframes tpPad{from{opacity:0;transform:translateY(10px)}}
.tp-pad button{height:58px;border:0;border-radius:14px;background:var(--panel-2);color:var(--fg);font:900 26px var(--display);box-shadow:inset 0 -3px 0 rgba(0,0,0,.25);cursor:pointer}.tp-pad button:active{transform:translateY(2px);background:var(--go);color:#fff}.tp-pad .z{grid-column:2}
.tp-dg b.bump{animation:tpBump .28s cubic-bezier(.3,1.6,.5,1)}@keyframes tpBump{from{transform:scale(1.25)}}
.tp-pick.spin .tp-dg b{border-color:var(--go);box-shadow:0 0 0 3px color-mix(in srgb,var(--go) 30%,transparent)}
.tp-colon{font:900 34px var(--display);color:var(--muted)}
.tp-kib{width:58px;height:78px;margin-left:6px;border:0;border-radius:16px;background:linear-gradient(180deg,#5AA3E0,#3B7FC0);color:#fff;font-size:26px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:inset 0 -4px 0 rgba(0,0,0,.2);cursor:pointer}.tp-kib small{font:900 11px var(--body)}.tp-kib:active{transform:translateY(2px)}
.tp-pk-sum{text-align:center;color:var(--muted);font:700 12.5px var(--body);margin:2px 0 10px}
.tp-myscore{background:color-mix(in srgb,var(--go) 22%,var(--panel-2))}
.tp-kis h3{margin:0 0 10px}.tp-kr{display:flex;align-items:center;gap:8px;background:var(--panel-2);border-radius:12px;padding:8px 10px;margin-bottom:6px;transition:background .3s}
.tp-kr .nm{flex:1;font:800 14px var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tp-kr .nm.r{text-align:right}.tp-kr .d{width:34px;height:38px;display:grid;place-items:center;background:var(--panel);border-radius:9px;font:900 22px var(--display)}.tp-kr i{font-style:normal;font-weight:900;color:var(--muted)}
.tp-kr.f .nm{flex:none}.tp-kr .w{flex:1;font:900 15px var(--display);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tp-kr small{color:var(--muted);font-weight:700}
.tp-kr.done{background:color-mix(in srgb,var(--go) 16%,var(--panel-2))}.tp-kr.done .d,.tp-kr.done .w{animation:tpBump .3s cubic-bezier(.3,1.6,.5,1)}
.tp-others{margin:6px 0 4px}.tp-ot{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:12px;background:var(--panel-2);margin-top:5px}.tp-ot.me{outline:2px solid color-mix(in srgb,var(--go) 60%,transparent)}
.tp-ot b{flex:1;min-width:0;font:800 14px var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tp-ot .tp-av{width:30px;height:30px;display:grid;place-items:center;font-size:20px;flex:none}.tp-ot .tp-av svg{width:30px;height:30px}
.tp-otip{font:900 17px var(--display);min-width:44px;text-align:right}
.tp-ls{display:inline-block;font:900 11px var(--body);padding:2px 7px;border-radius:7px;vertical-align:2px;background:var(--go);color:#fff;margin-right:2px}.tp-ls.ok{background:#d9a53a}.tp-ls.out{background:var(--panel-3);color:var(--muted)}
.tp-qn{margin:8px 0 0;text-align:center;font:800 12px var(--body);color:var(--muted)}
.th-home{padding:12px 14px!important;display:flex;flex-direction:column;gap:6px}.th-home[hidden]{display:none}.th-h{font:900 13px var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.th-row{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border-radius:14px;border:0;background:var(--panel-2);color:var(--fg);text-align:left;cursor:pointer;font:inherit}.th-row:active{transform:scale(.98)}
.th-t{flex:none;font:800 12px var(--body);color:var(--muted);min-width:64px}.th-row.live .th-t{color:#e5484d}
.th-m{flex:1;min-width:0;font:800 15px var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.th-m b{font-family:var(--display);margin:0 2px}
.th-go{flex:none;background:var(--go);color:#fff;font:900 14px var(--body);padding:7px 12px;border-radius:10px;box-shadow:inset 0 -3px 0 rgba(0,0,0,.2)}
.th-tip{flex:none;font:900 15px var(--display);padding:6px 10px;border-radius:10px;background:var(--go);color:#fff}.th-tip.ok{background:linear-gradient(180deg,#E9B64A,#c9921f)}.th-tip.out{background:var(--panel-3);color:var(--muted)}
.tp-grp{flex-wrap:nowrap;overflow-x:auto;margin:12px 0 0;padding:2px 0 4px;scrollbar-width:none;overscroll-behavior-x:contain;touch-action:pan-x}.tp-grp::-webkit-scrollbar{display:none}.tp-grp[hidden]{display:none}
.tp-grp .chip{flex:none;display:inline-flex;align-items:center;gap:5px}.tp-grp .chip small{font:800 11px var(--body);background:rgba(0,0,0,.18);border-radius:999px;padding:1px 6px}.tp-grp .chip.on{background:#E9A92B;border-color:#E9A92B;color:#2a1d05}.tp-gnew{border-style:dashed!important}
.tp-gs{display:flex;flex-direction:column;gap:10px}.tp-gs h3{margin:0}.tp-gname{width:100%;font:800 18px var(--body);padding:12px 14px;border-radius:14px;border:2px solid var(--line);background:var(--panel-2);color:var(--fg)}
.tp-gl{font:900 12px var(--body);text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-top:4px}.tp-gc{display:flex;flex-wrap:wrap;gap:6px}.tp-gc .chip.on{background:var(--go);border-color:var(--go);color:#fff}
.tp-gf{display:flex;flex-direction:column;gap:6px;max-height:36vh;overflow:auto}.tp-gfr{display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:14px;border:2px solid var(--line);background:var(--panel-2);color:var(--fg);text-align:left;cursor:pointer}
.tp-gfr b{flex:1;font:800 15px var(--body)}.tp-gfr i{font-style:normal;font:900 15px var(--body);color:var(--muted)}.tp-gfr.on{border-color:var(--go);background:color-mix(in srgb,var(--go) 14%,var(--panel-2))}.tp-gfr.on i{color:var(--go)}.tp-gfr.in{opacity:.6}.tp-gfr .tp-av svg{width:36px;height:36px;display:block}
.tp-gx{display:flex;gap:8px;justify-content:center}
.tp-ghead{display:flex;align-items:center;gap:8px;margin:12px 0 8px;padding:10px 12px;border-radius:16px;background:color-mix(in srgb,#E9A92B 14%,var(--panel));border:1px solid color-mix(in srgb,#E9A92B 40%,var(--line))}.tp-ghead b{display:block;font:900 17px var(--body)}.tp-ghead small{color:var(--muted);font-weight:700}
.tp-kst{display:flex;align-items:center;gap:6px;margin:10px 0;color:var(--muted);font:700 13px var(--body)}.tp-kst .chip{padding:5px 12px}
.tp-pend{margin:12px 0 4px}.tp-pend .btn{width:100%;margin-top:4px}.tp-tip.pend{border-style:dashed}
.tp-br.none{opacity:.85}.tp-br.none .tp-rk{color:var(--muted)}.tp-br .btn.sm{flex:none}
.tp-all{align-items:center;margin:0 0 10px}.tp-all span{color:var(--muted);font:700 12.5px var(--body);margin-right:4px}
.tp-invs .tp-br{margin-bottom:6px}
.tp-mid{display:flex;align-items:center;gap:10px}.tp-teams{flex:1;min-width:0}
.tp-big{flex:none;min-width:86px;height:70px;border-radius:16px;border:2px dashed color-mix(in srgb,var(--go) 70%,var(--line));background:color-mix(in srgb,var(--go) 10%,var(--panel-2));color:var(--fg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;cursor:pointer;padding:4px 10px}
.tp-big small{font:800 11px var(--body);color:var(--go-hi,var(--go));text-transform:uppercase;letter-spacing:.05em}.tp-big b{font:900 28px var(--display);line-height:1.05;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tp-big.mine{border:0;background:var(--go);color:#fff;box-shadow:inset 0 -4px 0 rgba(0,0,0,.2)}.tp-big.mine small{color:#eaffd6}.tp-big.mine b{font-size:30px}.tp-big b.lg{font-size:17px!important;white-space:normal;line-height:1.1;max-height:2.3em;text-align:center}
.tp-big.won,.tp-big.mine.ok{background:linear-gradient(180deg,#E9B64A,#c9921f)}.tp-big.mine.out{background:var(--panel-3);color:var(--muted)}.tp-big.mine.out small{color:var(--muted)}.tp-big.mine.ok small{color:#fff6dc}.tp-big.lost{background:var(--panel-3);color:var(--muted)}.tp-big.lost small{color:var(--muted)}
.tp-big:active{transform:scale(.96)}
.tp-odds.sm{display:flex;gap:10px;margin-top:6px;font:700 11.5px var(--body);color:var(--muted)}.tp-odds.sm b{color:var(--fg);font-weight:800}
.tp-pick.big .tp-dg b{width:88px;height:88px;font-size:50px}.tp-q .tp-pad{display:grid}
.tp-who{display:flex;flex-direction:column;gap:8px;margin:8px 0}.tp-who button{border:2px solid var(--line);background:var(--panel-2);color:var(--fg);border-radius:16px;padding:16px;font:900 20px var(--display);cursor:pointer}.tp-who button.on{border-color:var(--go);background:var(--go);color:#fff}
.tp-qst{display:flex;align-items:center;gap:6px;margin:12px 0 4px;color:var(--muted);font:700 13px var(--body);flex-wrap:wrap}.tp-qst .chip{padding:6px 13px}
.tp-qwin{min-height:18px;color:var(--muted);font:700 12.5px var(--body);margin:6px 0 10px;text-align:center}.tp-qwin b{color:var(--go-hi,var(--go))}
.tp-br .grow{flex:1}.tp{padding-bottom:96px}.tp-tabs button{white-space:nowrap}
.tp-pgl{display:flex;flex-wrap:wrap;gap:4px;margin:5px 0 3px}.tp-pgl span{background:var(--panel-2);border-radius:8px;padding:3px 8px;font:700 12.5px var(--body)}.tp-pgl i{font-style:normal;color:var(--muted);margin-left:2px}
.tp-kr.f small{max-width:45%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;
  document.head.appendChild(css);
})();
