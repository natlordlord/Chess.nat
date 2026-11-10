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
  const COMP = {"ger.1": ["Bundesliga", "⚽"], "uefa.champions": ["Champions League", "⭐"], "ger.dfb_pokal": ["DFB-Pokal", "🏆"], "ufc": ["UFC", "🥊"], "oktagon": ["Oktagon", "🥊"], "box": [T("Boxing", "Boxen"), "🥊"], "hb": ["Handball", "🤾"], "misc": [T("Other", "Sonstiges"), "🎯"]};
  const FILTERS = [["all", T("All", "Alle")], ["fav", "⭐ Bayern"], ["ger.1", "Bundesliga"], ["uefa.champions", "Champions League"], ["ger.dfb_pokal", "DFB-Pokal"], ["fight", "UFC · Oktagon · " + T("Boxing", "Boxen")], ["hb", "Handball"]];
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
  const pickW = os => { let r = Math.random() * os.reduce((s, o) => s + (o.pr || 0), 0); for (const o of os){ r -= o.pr || 0; if (r <= 0) return o; } return os[os.length - 1]; };

  const Tipp = {
    ev: [], tips: [], board: [], admin: false, slip: [], tab: "games", filter: "all", loaded: false,
    async load(){
      const c = sb(); if (!c) return;
      const from = new Date(Date.now() - 3 * 864e5).toISOString(), to = new Date(Date.now() + 40 * 864e5).toISOString();
      const [e, t, a] = await Promise.all([
        c.from("tipp_events").select("id,sport,comp,name,home,away,home_logo,away_logo,start_at,state,clock,score_h,score_a,stats,markets,model,odds_src,result,settled,fav,meta").gte("start_at", from).lte("start_at", to).order("start_at"),
        meId() ? c.from("tipp_tips").select("*").eq("user_id", meId()).order("created_at", {ascending: false}).limit(300) : Promise.resolve({data: []}),
        this.adminChecked ? Promise.resolve(null) : (meId() ? c.from("tipp_admins").select("user_id").eq("user_id", meId()) : Promise.resolve({data: []}))]);
      if (e.error) throw e.error;
      this.ev = (e.data || []).filter(x => x.state !== "canc" || x.markets.length); this.tips = t.data || [];
      if (a){ this.admin = !!(a.data && a.data.length); this.adminChecked = true; }
      this.loaded = true;
    },
    async loadBoard(){ const c = sb(); if (!c) return; const {data} = await c.rpc("tipp_board"); this.board = data || []; },
    async claim(){
      const c = sb(); if (!c || !meId()) return; try { const {data} = await c.rpc("tipp_claim"); if (data && data.sum > 0){ natEarn(data.sum);
        toast(data.won ? T(`🎉 ${data.won} tip${data.won > 1 ? "s" : ""} won · +${fmt(data.sum)} NAT`, `🎉 ${data.won} Tipp${data.won > 1 ? "s" : ""} gewonnen · +${fmt(data.sum)} NAT`) : T(`↩︎ +${fmt(data.sum)} NAT back`, `↩︎ +${fmt(data.sum)} NAT zurück`), 3200);
        if (data.won && typeof confettiBurst === "function") confettiBurst(); if (Sound.play) Sound.play("Victory", .5); } } catch(e) {}
    },
    myOn(id){ return this.tips.filter(t => t.event_id === id); },
    inSlip(id, k, p){ return this.slip.some(s => s.ev === id && s.k === k && s.p === p); },
    toggle(ev, m, o){ const i = this.slip.findIndex(s => s.ev === ev.id && s.k === m.k && s.p === o.p);
      if (i >= 0) this.slip.splice(i, 1); else { this.slip = this.slip.filter(s => !(s.ev === ev.id && s.k === m.k)); this.slip.push({ev: ev.id, k: m.k, p: o.p, l: o.l, t: m.t, q: o.q, name: ev.sport === "fb" ? `${ev.home} – ${ev.away}` : `${ev.home} vs. ${ev.away}`, stake: this.lastStake || 100}); }
      Sound.tap(); if (navigator.vibrate) try { navigator.vibrate(8); } catch(e) {} },
    /* Nat-KI picks for you: the likely result more often, the surprise sometimes */
    kiPick(ev, all){ const ms = (ev.markets || []).filter(m => m.o && m.o.length); if (!ms.length) return null;
      const m = all ? ms[Math.floor(Math.random() * ms.length)] : ms[0], o = pickW(m.o); return {m, o}; }
  };

  Views.tipp = {
    mount(main, arg){
      this.main = main; if (arg && arg.tab) Tipp.tab = arg.tab;
      main.innerHTML = `<div class="page tp"><div class="tp-head"><h1 class="h-title" style="margin:0">${T("Tipping", "Tippspiel")}</h1><div class="tp-bal" id="tpbal"></div></div>
        <div class="seg tp-tabs" id="tptabs">${[["games", T("Matches", "Spiele")], ["mine", T("My tips", "Meine Tipps")], ["board", T("Leaderboard", "Rangliste")]].map(([k, l]) => `<button data-tab="${k}" class="${Tipp.tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
        <div id="tpbody"><div class="tp-empty">${T("Loading…", "Lädt…")}</div></div><div id="tpslip"></div></div>`;
      main.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { Tipp.tab = b.dataset.tab; Sound.tap(); main.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("on", x === b)); this.draw(); if (Tipp.tab === "board") this.board(); });
      this.balance(); this.refresh(true); Tipp.claim().then(() => this.balance());
      clearInterval(this.iv); this.iv = setInterval(() => { if (App.route !== "tipp") return clearInterval(this.iv); this.refresh(); }, 20000);
    },
    unmount(){ clearInterval(this.iv); },
    balance(){ const el = this.main && this.main.querySelector("#tpbal"); if (el) el.innerHTML = `${coin()}<b>${fmt(bal())}</b>`; },
    async refresh(first){
      try { await Tipp.load(); } catch(e) { const b = this.main && this.main.querySelector("#tpbody"); if (b && first) { const setup = /does not exist|could not find|PGRST20/i.test((e.message || "") + (e.code || "")); b.innerHTML = setup ? `<div class="tp-empty">⚽🛠️<br>${T("Setting up the tipping game – almost there.", "Das Tippspiel wird gerade eingerichtet – gleich geht's los.")}</div>` : `<div class="tp-empty">${T("The tipping game isn't reachable right now.", "Das Tippspiel ist gerade nicht erreichbar.")}<br><small>${h(e.message || "")}</small></div>`; } return; }
      if (App.route !== "tipp") return; if (!first) Tipp.claim().then(() => this.balance());
      if (Tipp.tab === "board") this.board(); else this.draw();
    },
    draw(){
      const b = this.main && this.main.querySelector("#tpbody"); if (!b) return; const y = this.main.scrollTop;
      if (Tipp.tab === "games") b.innerHTML = this.gamesHTML(); else if (Tipp.tab === "mine") b.innerHTML = this.mineHTML(); else b.innerHTML = this.boardHTML();
      this.wire(b); this.slipBar(); this.balance(); this.main.scrollTop = y;
    },
    /* ---------- matches ---------- */
    shown(){
      const f = Tipp.filter, now = Date.now();
      return Tipp.ev.filter(e => (e.state !== "post" || now - Date.parse(e.start_at) < 30 * 3600e3) && (e.markets.length || e.state !== "pre"))
        .filter(e => f === "all" || (f === "fav" ? e.fav || bay(e.home) || bay(e.away) : f === "fight" ? ["ufc", "oktagon", "box"].includes(e.comp) : e.comp === f));
    },
    gamesHTML(){
      const L = this.shown(), live = L.filter(e => e.state === "in"), groups = {};
      L.filter(e => e.state !== "in").forEach(e => { const k = dayName(e.start_at); (groups[k] = groups[k] || []).push(e); });
      const chips = `<div class="chips tp-chips">${FILTERS.map(([k, l]) => `<button class="chip ${Tipp.filter === k ? "on" : ""}" data-f="${k}">${h(l)}</button>`).join("")}</div>`;
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
      const odds = m0 && e.state === "pre" ? `<div class="tp-odds">${m0.o.map(o => `<button class="tp-o ${Tipp.inSlip(e.id, m0.k, o.p) ? "on" : ""}" data-ev="${h(e.id)}" data-k="${h(m0.k)}" data-p="${h(o.p)}"><small>${h(m0.k === "1x2" ? (o.p === "h" ? "1" : o.p === "d" ? "X" : "2") : o.l)}</small><b>${q2(o.q)}</b></button>`).join("")}</div>` : "";
      const more = e.state === "pre" && e.markets.length > 1 ? `<button class="tp-more" data-open="${h(e.id)}">+${e.markets.length - 1} ${T("bets", "Wetten")}</button>` : (e.state !== "pre" || mine.length) ? `<button class="tp-more" data-open="${h(e.id)}">${T("Details", "Details")}</button>` : "";
      return `<div class="tp-ev ${e.fav || bay(e.home) || bay(e.away) ? "fav" : ""} ${live ? "is-live" : ""}" data-open="${h(e.id)}">
        <div class="tp-top"><span class="tp-comp">${c[1]} ${h(c[0])}${e.meta && e.meta.main && e.sport === "mma" ? ` · ${T("Main card", "Hauptkarte")}` : ""}</span>${time}</div>
        <div class="tp-row">${logo(e.home_logo)}${name(e.home)}${sc(e.score_h, hw)}</div><div class="tp-row">${logo(e.away_logo)}${name(e.away)}${sc(e.score_a, aw)}</div>
        ${extra}${odds}<div class="tp-foot">${mine.length ? `<span class="pill go">${mine.length} ${T(mine.length > 1 ? "tips" : "tip", mine.length > 1 ? "Tipps" : "Tipp")}</span>` : ""}${e.model && e.model.lh != null ? `<span class="tp-xg" title="xG">xG ${String(e.model.lh).replace(".", ",")} : ${String(e.model.la).replace(".", ",")}</span>` : ""}${more}</div></div>`;
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
        ${open ? `<button class="btn ghost sm" data-kiev="${h(e.id)}" style="margin:2px 0 8px">🤖 ${T("Nat-KI picks a tip", "KI-Tipp für dieses Spiel")}</button>` : ""}
        ${mine.length ? `<div class="tp-mine">${mine.map(t => this.tipRow(t, e)).join("")}</div>` : ""}
        ${Object.entries(groups).map(([g, ms]) => `<div class="tp-g">${h(g)}</div>${ms.map(mk).join("")}`).join("")}
        ${Tipp.admin && e.id.startsWith("man:") ? `<button class="btn ghost sm" data-admin="${h(e.id)}" style="margin-top:10px">✎ ${T("Edit event", "Event bearbeiten")}</button>` : ""}</div>`;
      const d = detailSheet(html); this.sheet = d;
      d.el.querySelectorAll(".tp-o[data-k]").forEach(b => b.onclick = () => { const m = e.markets.find(x => x.k === b.dataset.k), o = m && m.o.find(x => x.p === b.dataset.p); if (!o) return; Tipp.toggle(e, m, o);
        d.el.querySelectorAll(`.tp-o[data-ev]`).forEach(x => x.classList.toggle("on", Tipp.inSlip(e.id, x.dataset.k, x.dataset.p))); this.slipBar(); this.syncCards(); });
      const kb = d.el.querySelector("[data-kiev]"); if (kb) kb.onclick = () => { const r = Tipp.kiPick(e, Math.random() < .5); if (!r) return; if (!Tipp.inSlip(e.id, r.m.k, r.o.p)) Tipp.toggle(e, r.m, r.o);
        d.el.querySelectorAll(`.tp-o[data-ev]`).forEach(x => x.classList.toggle("on", Tipp.inSlip(e.id, x.dataset.k, x.dataset.p))); toast(`🤖 ${r.m.t}: ${r.o.l} (${q2(r.o.q)})`); this.slipBar(); this.syncCards(); };
      d.el.querySelectorAll("[data-settle]").forEach(b => b.onclick = async () => { if (!b.dataset.arm){ b.dataset.arm = 1; b.textContent = T("Sure? Tap again", "Sicher? Nochmal tippen"); return; }
        const {error} = await sb().rpc("tipp_settle", {p_event: e.id, p_res: {[b.dataset.settle]: b.dataset.v}}); if (error) return toast(error.message); toast(T("Settled", "Abgerechnet")); d.close(); this.refresh(); });
      const ab = d.el.querySelector("[data-admin]"); if (ab) ab.onclick = () => { d.close(); this.adminForm(e); };
    },
    syncCards(){ const b = this.main && this.main.querySelector("#tpbody"); if (b) b.querySelectorAll(".tp-o[data-ev]").forEach(x => x.classList.toggle("on", Tipp.inSlip(x.dataset.ev, x.dataset.k, x.dataset.p))); },
    tipRow(t, e){ e = e || Tipp.ev.find(x => x.id === t.event_id); const win = Math.round(t.stake * t.odds);
      const st = t.status === "won" ? `<span class="tp-res won">+${fmt(t.payout - t.stake)}</span>` : t.status === "lost" ? `<span class="tp-res lost">−${fmt(t.stake)}</span>` : t.status === "void" ? `<span class="tp-res">↩︎ ${fmt(t.stake)}</span>` : `<span class="tp-res open">${T("to win", "Gewinn")} ${fmt(win)}</span>`;
      return `<div class="tp-tip ${t.status}" data-open="${h(t.event_id)}"><div class="grow"><div class="tp-tl">${h(t.label || t.market + ": " + t.pick)}</div><div class="tp-ts">${e ? h(e.sport === "fb" ? `${e.home} – ${e.away}` : `${e.home} vs. ${e.away}`) + (e.state !== "pre" && e.sport === "fb" ? ` · ${e.score_h ?? 0}:${e.score_a ?? 0}${e.state === "in" ? " ●" : ""}` : "") : ""} · ${fmt(t.stake)} × ${q2(t.odds)}</div></div>${st}</div>`; },
    /* ---------- my tips ---------- */
    mineHTML(){
      const L = Tipp.tips; if (!L.length) return `<div class="tp-empty">${T("No tips yet. Pick a match and tap an odd.", "Noch keine Tipps. Such dir ein Spiel aus und tipp auf eine Quote.")}</div>`;
      const open = L.filter(t => t.status === "open"), done = L.filter(t => t.status !== "open"), net = done.reduce((s, t) => s + t.payout - t.stake, 0), won = done.filter(t => t.status === "won").length;
      return `<div class="tp-sum"><div><b class="${net >= 0 ? "pos" : "neg"}">${net >= 0 ? "+" : "−"}${fmt(Math.abs(net))}</b><small>NAT ${T("net", "Bilanz")}</small></div><div><b>${won}/${done.length}</b><small>${T("won", "gewonnen")}</small></div><div><b>${open.length}</b><small>${T("open", "offen")}</small></div></div>
        ${open.length ? `<div class="tp-day">${T("Open", "Offen")}</div>${open.map(t => this.tipRow(t)).join("")}` : ""}${done.length ? `<div class="tp-day">${T("Settled", "Abgerechnet")}</div>${done.slice(0, 80).map(t => this.tipRow(t)).join("")}` : ""}`;
    },
    /* ---------- leaderboard ---------- */
    async board(){ await Tipp.loadBoard(); if (Tipp.tab === "board") this.draw(); },
    boardHTML(){
      const B = Tipp.board; if (!B.length) return `<div class="tp-empty">${T("The leaderboard fills up with the first settled tips.", "Die Rangliste füllt sich mit den ersten abgerechneten Tipps.")}</div>`;
      const myI = B.findIndex(r => r.uid === meId()), head = r => { if (r.bot === "ki") return `<span class="tp-av ki">🤖</span>`; try { return `<span class="tp-av">${avatarSVG(Object.assign({}, r.avatar || {}, {aura: "none", pet: "none"}), {head: true, size: 40})}</span>`; } catch(e) { return `<span class="tp-av"></span>`; } };
      const row = (r, i) => `<div class="tp-br ${r.uid === meId() ? "me" : ""} ${r.bot ? "bot" : ""}"><span class="tp-rk">${i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>${head(r)}<div class="grow"><b>${h(r.bot === "ki" ? "Nat-KI" : r.name)}${r.uid === meId() ? ` <span class="pill go">${T("You", "Du")}</span>` : ""}</b><small>${r.won}/${r.won + r.lost} ${T("won", "gewonnen")}${r.open ? ` · ${r.open} ${T("open", "offen")}` : ""}</small></div><b class="tp-pf ${r.profit >= 0 ? "pos" : "neg"}">${r.profit >= 0 ? "+" : "−"}${fmt(Math.abs(r.profit))}</b></div>`;
      return (myI >= 0 ? `<div class="tp-pin">${row(B[myI], myI)}</div>` : "") + `<div class="tp-board">${B.map(row).join("")}</div><p class="tp-note c">${T("Ranked by Natcoins won minus staked on settled tips.", "Gezählt wird, was du mit abgerechneten Tipps gewonnen minus eingesetzt hast.")}</p>`;
    },
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
        return `<div class="tp-slip"><h3 style="margin:0 0 8px">${T("Tip slip", "Tippschein")}</h3>${S1.map((x, i) => `<div class="tp-si"><div class="grow"><b>${h(x.t)}: ${h(x.l)}</b><small>${h(x.name)}</small></div><b class="tp-q">${q2(x.q)}</b><button class="tp-x" data-rm="${i}">✕</button>
          <div class="tp-st">${STAKES.map(v => `<button class="chip ${x.stake === v ? "on" : ""}" data-st="${i}" data-v="${v}">${fmt(v)}</button>`).join("")}<button class="chip ${x.stake === Math.max(1, bal()) ? "on" : ""}" data-st="${i}" data-v="max">${T("All in", "Alles")}</button></div><small class="tp-pw">${T("Possible win", "Möglicher Gewinn")}: <b>${fmt(Math.round(x.stake * x.q))} NAT</b></small></div>`).join("")}
          <div class="tp-tot"><span>${T("Stake", "Einsatz")} <b>${fmt(stake)}</b></span><span>${T("Balance", "Guthaben")} <b>${fmt(bal())}</b></span><span>${T("Win up to", "Gewinn bis")} <b>${fmt(win)}</b></span></div>
          <button class="btn go big" data-place ${stake > bal() || !S1.length ? "disabled" : ""}>${stake > bal() ? T("Not enough NAT", "Zu wenig NAT") : T("Place tips", "Tipps abgeben")}</button>
          <button class="btn ghost" data-clear style="margin-top:6px">${T("Clear slip", "Schein leeren")}</button></div>`; };
      const d = detailSheet(`<div id="tpsl">${draw()}</div>`); const box = d.el.querySelector("#tpsl");
      const wire = () => {
        box.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { Tipp.slip.splice(+b.dataset.rm, 1); Sound.tap(); if (!Tipp.slip.length) d.close(); else { box.innerHTML = draw(); wire(); } this.slipBar(); this.syncCards(); });
        box.querySelectorAll("[data-st]").forEach(b => b.onclick = () => { const x = Tipp.slip[+b.dataset.st]; x.stake = b.dataset.v === "max" ? Math.max(1, Math.floor(bal())) : +b.dataset.v; Tipp.lastStake = x.stake; Sound.tap(); box.innerHTML = draw(); wire(); this.slipBar(); });
        const cl = box.querySelector("[data-clear]"); if (cl) cl.onclick = () => { Tipp.slip = []; d.close(); this.slipBar(); this.syncCards(); };
        const pl = box.querySelector("[data-place]"); if (pl) pl.onclick = async () => { pl.disabled = true; pl.textContent = T("Placing…", "Wird getippt…"); const n = await this.place(); d.close(); if (n) { toast(T(`✅ ${n} tip${n > 1 ? "s" : ""} placed. Good luck!`, `✅ ${n} Tipp${n > 1 ? "s" : ""} abgegeben. Viel Glück!`)); this.refresh(); } };
      }; wire();
    },
    async place(){
      const c = sb(); if (!c || !meId()){ toast(T("Sign in to tip.", "Zum Tippen bitte anmelden.")); return 0; }
      let ok = 0; const left = [];
      for (const x of Tipp.slip){
        if (!natSpend(x.stake)){ left.push(x); continue; }
        const {error} = await c.rpc("tipp_place", {p_event: x.ev, p_market: x.k, p_pick: x.p, p_stake: x.stake});
        if (error){ natEarn(x.stake, true); left.push(x); toast(/closed/.test(error.message) ? T("That match has started.", "Das Spiel hat schon begonnen.") : error.message); } else ok++;
      }
      Tipp.slip = left; this.slipBar(); this.balance(); if (ok){ Sound.play && Sound.play("GenericNotify", .5); if (navigator.vibrate) try { navigator.vibrate([20, 40, 20]); } catch(e) {} }
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
      b.querySelectorAll("[data-f]").forEach(x => x.onclick = () => { Tipp.filter = x.dataset.f; Sound.tap(); this.draw(); });
      b.querySelectorAll(".tp-o[data-ev]").forEach(x => x.onclick = ev => { ev.stopPropagation(); const e = Tipp.ev.find(z => z.id === x.dataset.ev), m = e && e.markets.find(z => z.k === x.dataset.k), o = m && m.o.find(z => z.p === x.dataset.p); if (!o) return; Tipp.toggle(e, m, o); x.parentNode.querySelectorAll(".tp-o").forEach(z => z.classList.toggle("on", Tipp.inSlip(e.id, z.dataset.k, z.dataset.p))); this.slipBar(); });
      b.querySelectorAll("[data-open]").forEach(x => x.onclick = ev => { if (ev.target.closest(".tp-o")) return; ev.stopPropagation(); Sound.tap(); this.openEvent(x.dataset.open); });
      const ki = b.querySelector("[data-ki]"); if (ki) ki.onclick = () => { const L = this.shown().filter(e => e.state === "pre" && Date.parse(e.start_at) > Date.now() && Date.parse(e.start_at) < Date.now() + 8 * 864e5 && !Tipp.myOn(e.id).length && !Tipp.slip.some(s => s.ev === e.id));
        if (!L.length) return toast(T("Nothing left for Nat-KI to tip.", "Nichts mehr da, was die KI tippen könnte."));
        L.slice(0, 12).forEach(e => { const r = Tipp.kiPick(e, false); if (r) Tipp.toggle(e, r.m, r.o); }); toast(`🤖 ${T(`${Math.min(12, L.length)} tips on your slip`, `${Math.min(12, L.length)} KI-Tipps auf deinem Schein`)}`); this.draw(); };
      b.querySelectorAll("[data-admin]").forEach(x => x.onclick = () => this.adminForm(x.dataset.admin === "new" ? null : Tipp.ev.find(e => e.id === x.dataset.admin)));
    }
  };
  if (typeof TAB_OF !== "undefined") TAB_OF.tipp = "games";
  window.Tipp = Tipp;

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
.pg-gt.tp-tile .pg-art{font-size:34px}`;
  document.head.appendChild(css);
})();
