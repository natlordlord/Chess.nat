/* ===== "Is in a game right now": what each friend is doing at this moment, on the friends list and on their profile,
   with a button that takes you into their lobby (a running round: you watch, and from the next round you play).
   Written to chess_now every few seconds while something is going on (only friends can read it); a row older than
   90 seconds counts as gone, so a closed app clears itself. ===== */
const Now = (() => {
  const sb = () => window.ChessSite && window.ChessSite.sb, me = () => (typeof Social !== "undefined" && Social.me) || null;
  const de = () => typeof I18N === "undefined" || I18N.lang === "de", T = (en, dg) => de() ? dg : en;
  const h = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const PUZ = ["puzzles", "rush", "daily", "train", "jlevel", "endgames", "coords", "repdrill", "lesson"], CHESS = ["bots", "friend", "local", "linkgame", "blitz"], DUEL = ["duel", "battle"];
  const FRESH = 90000;
  /* what this phone is doing: a party lobby counts first, then the screen you're on */
  function mine(){
    const P = typeof PNet !== "undefined" ? PNet.P : null;
    if (P && P.game){ if (P.solo) return {k: "solo", g: P.game};
      return {k: "party", g: P.game, c: P.code, run: P.isHost ? !!P.G : !!(P.msg && !P.msg.lobby), n: ((P.isHost ? P.roster : P.msg && P.msg.players) || []).length}; }
    const r = typeof App !== "undefined" ? App.route : "";
    /* a chess screen only counts once its board is up (most of them start with a menu) */
    if (r === "watch" || typeof Watch === "undefined" || !Watch.hasBoard()) return null;
    if (PUZ.includes(r)) return {k: "puzzle"}; if (DUEL.includes(r)) return {k: "duel"}; if (CHESS.includes(r) || r === "online") return {k: "chess"};
    return typeof App !== "undefined" && App.busy && App.busy() ? {k: "chess"} : null;
  }
  const gname = g => { const x = typeof PG !== "undefined" && PG.games ? PG.games.find(y => y.id === g) : null; return x ? T(x.name[0], x.name[1]) : String(g || ""); };
  const text = w => !w ? "" : w.k === "party" ? (w.run ? T("Playing ", "Spielt gerade ") : T("In the lobby: ", "In der Lobby: ")) + gname(w.g) : w.k === "solo" ? T("Practising ", "Übt ") + gname(w.g)
    : w.k === "puzzle" ? T("Solving puzzles", "Löst gerade Puzzles") : w.k === "duel" ? T("In a puzzle duel", "Im Puzzle-Duell") : T("Playing chess", "Spielt gerade Schach");

  /* ---- writing my own ---- */
  let last = null, lastT = 0;
  function tick(){
    const c = sb(), u = me(); if (!c || !u) return;
    const w = document.hidden ? null : mine(), k = w ? JSON.stringify(w) : "";
    if (k === last && (!k || Date.now() - lastT < 40000)) return;
    last = k; lastT = Date.now();
    (k ? c.from("chess_now").upsert({user_id: u, what: w, updated_at: new Date().toISOString()}) : c.from("chess_now").delete().eq("user_id", u)).then(() => {}, () => {});
  }

  /* ---- reading my friends' ---- */
  let rows = {}, loadT = 0, loading = null;
  function load(force){
    const c = sb(); if (!c || !me()) return Promise.resolve(); if (!force && Date.now() - loadT < 5000) return Promise.resolve(); if (loading) return loading;
    return loading = c.from("chess_now").select("user_id,what,updated_at").then(r => { loading = null; if (r.error) return; loadT = Date.now(); rows = {}; (r.data || []).forEach(x => { rows[x.user_id] = x; }); paint(); }, () => { loading = null; });
  }
  const of = id => { const x = rows[id]; return x && x.what && Date.now() - Date.parse(x.updated_at) < FRESH ? x.what : null; };
  const joinable = w => !!(w && w.k === "party" && /^[a-z0-9]{4,12}$/.test(String(w.c || "")));
  const board = w => !!(w && /^(puzzle|chess|duel)$/.test(w.k));
  const btn = (w, big, id) => joinable(w) ? `<button class="btn ${big ? "" : "sm"} go now-go" data-now-join="${h(w.c)}">${w.run ? T("Watch", "Zuschauen") : T("Join", "Mitspielen")}</button>`
    : board(w) ? `<button class="btn ${big ? "" : "sm"} go now-go" data-now-watch="${h(id)}">${T("Watch", "Zuschauen")}</button>` : "";
  /* every place that shows it is an empty slot the page leaves for us: <span data-now="<player id>"> (small) or data-now-card (profile) */
  function html(id, card){ const w = id === me() ? null : of(id); if (!w) return "";
    return card ? `<div class="now-card"><span class="now-dot"></span><div class="grow"><small>${T("In a game right now", "Ist gerade im Game")}</small><b>${h(text(w))}</b>${w.k === "party" && w.n > 1 ? `<i>${w.n} ${T("players", "Spieler")}</i>` : ""}${joinable(w) && w.run ? `<i>${T("You watch this round and play from the next one.", "Du schaust diese Runde zu und spielst ab der nächsten mit.")}</i>` : ""}${board(w) ? `<i>${T("You see the board live and can suggest moves.", "Du siehst das Brett live und kannst Züge vorschlagen.")}</i>` : ""}</div>${btn(w, true, id)}</div>`
      : `<span class="now-chip"><span class="now-dot"></span>${h(text(w))}</span>${btn(w, false, id)}`; }
  function paint(){ document.querySelectorAll("[data-now],[data-now-card]").forEach(el => { const card = el.hasAttribute("data-now-card"), x = html(card ? el.dataset.nowCard : el.dataset.now, card); if (el._now !== x){ el._now = x; el.innerHTML = x; } }); }
  const slot = id => `<span class="now-slot" data-notr data-now="${h(id)}"></span>`, cardSlot = id => `<div class="now-slot" data-notr data-now-card="${h(id)}"></div>`;

  function start(){
    setInterval(tick, 4000); window.addEventListener("chessnat:route", () => setTimeout(tick, 300)); document.addEventListener("visibilitychange", tick);
    window.addEventListener("pagehide", () => { const c = sb(), u = me(); if (c && u && last) try { c.from("chess_now").delete().eq("user_id", u).then(() => {}, () => {}); } catch(e) {} });
    /* while a page with slots is on screen: fresh every 8 seconds */
    setInterval(() => { if (document.hidden || !document.querySelector("[data-now],[data-now-card]")) return; load().then(paint); }, 8000);
    window.addEventListener("chessnat:route", () => setTimeout(() => { if (document.querySelector("[data-now],[data-now-card]")) load().then(paint); }, 200));
    /* a page that redraws itself gets its slots filled again at once */
    { const main = document.querySelector("#main"); let pt = null; if (main) new MutationObserver(() => { if (pt) return; pt = setTimeout(() => { pt = null; paint(); }, 30); }).observe(main, {childList: true, subtree: true}); }
    /* the button sits inside rows that open a profile on tap: it goes first */
    document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-now-join]"); if (!b) return; e.preventDefault(); e.stopPropagation();
      try { if (typeof PG !== "undefined" && PG.st && PG.st.left && PG.st.left.c === b.dataset.nowJoin){ PG.st.left = null; PG.persist(); } } catch(er) {}
      App.go("lobby", {join: b.dataset.nowJoin}); }, true);
    document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("[data-now-watch]"); if (!b) return; e.preventDefault(); e.stopPropagation(); App.go("watch", {id: b.dataset.nowWatch}); }, true);
    const st = document.createElement("style"); st.textContent = `
.now-slot:empty{display:none}
span.now-slot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px}
.now-chip{display:inline-flex;align-items:center;gap:6px;font:800 12.5px var(--body);color:#9BE25A;min-width:0}
.now-dot{width:8px;height:8px;border-radius:50%;background:#9BE25A;flex:none;animation:nowPulse 1.6s ease-in-out infinite}
@keyframes nowPulse{0%,100%{box-shadow:0 0 0 0 rgba(155,226,90,.55)}50%{box-shadow:0 0 0 6px rgba(155,226,90,0)}}
.now-go{flex:none}
div.now-slot{margin:10px 0}
.now-card{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;background:rgba(127,178,74,.16);box-shadow:inset 0 0 0 1.5px rgba(155,226,90,.5)}
.now-card .grow{display:flex;flex-direction:column;gap:2px;min-width:0}
.now-card small{font:900 11px var(--body);letter-spacing:.06em;text-transform:uppercase;color:#9BE25A}
.now-card b{font:900 17px var(--display)}
.now-card i{font:700 12px var(--body);font-style:normal;color:var(--muted)}
@media (prefers-reduced-motion: reduce){.now-dot{animation:none}}`; document.head.appendChild(st);
    tick();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  return {mine, of, text, load, paint, slot, cardSlot, tick, T, h, sb, me};
})();

/* ===== Watching a friend's board: you see every position live and can drag a piece to suggest a move; the friend sees
   it as a blue arrow (it changes nothing on their board). Voice chat on top, when both switch their microphone on.
   Transport: a realtime broadcast channel per player, "chessnat-watch-<player id>". The player's phone only listens
   while a board is open; who watches says hello every 5 seconds and is forgotten after 16 without one. ===== */
const Watch = (() => {
  const {T, h, sb, me} = Now, pid = () => (typeof PNet !== "undefined" ? PNet.me : "x"), SQ = /^[a-h][1-8]$/;
  const myName = () => String((typeof Social !== "undefined" && Social.player && Social.player.name) || "?").slice(0, 16);
  const vib = p => { try { if (typeof Haptic !== "undefined") Haptic.go(p); else if (navigator.vibrate) navigator.vibrate(p); } catch(e) {} };
  function chan(name, onMsg, onLive){
    const c = sb(); let ch = null, dead = false, live = false;
    const sub = () => { const x = c.channel(name, {config: {broadcast: {self: false, ack: false}}}); ch = x;
      x.on("broadcast", {event: "m"}, ({payload}) => { if (x === ch && payload) try { onMsg(payload); } catch(e) { console.error(e); } });
      x.subscribe(st => { if (x !== ch) return; live = st === "SUBSCRIBED"; if (live){ if (onLive) onLive(); } else if (!dead && /ERROR|TIMED_OUT|CLOSED/.test(st)) setTimeout(revive, 1500); }); };
    const revive = () => { if (dead || (ch && ch.state === "joined")) return; const o = ch; ch = null; try { c.removeChannel(o); } catch(e) {} sub(); };
    sub();
    return {send(m){ if (ch && live) ch.send({type: "broadcast", event: "m", payload: m}).catch(() => {}); }, close(){ dead = true; const o = ch; ch = null; try { c.removeChannel(o); } catch(e) {} }};
  }

  /* ---- voice: the same peer-to-peer voice chat as in the party games, carried by the watch channel ---- */
  let voice = false;
  async function voiceOn(send){
    if (voice) return true; if (typeof PVoice === "undefined") return false;
    if (typeof PNet !== "undefined" && PNet.P){ toast(T("Voice chat is busy with your lobby.", "Der Sprachchat läuft schon in deiner Lobby.")); return false; }
    PVoice.via(m => send(Object.assign({id: pid()}, m)));
    if (!(await PVoice.start())){ PVoice.via(null); toast(T("The microphone isn't allowed.", "Das Mikrofon ist nicht erlaubt.")); return false; }
    PVoice.setMic(true); voice = true; return true;
  }
  function voiceOff(){ if (!voice) return; voice = false; try { PVoice.setMic(false); PVoice.stop(); } catch(e) {} PVoice.via(null); }
  const micHTML = () => `<button class="watch-mic ${voice ? "on" : ""}" data-watch-mic aria-label="${T("Voice chat", "Sprachchat")}">${voice ? "🎙️" : "🔇"}</button>`;

  /* ---- my board is being watched ---- */
  let pub = null, cur = null, lastKey = "", ws = {}, sugs = {}, lastSug = "";
  const big = B => !!(B && B.el && B.el.isConnected && B.el.offsetWidth >= 220);
  const state = () => cur && big(cur.B) ? {t: "st", id: pid(), fen: cur.fen, last: cur.last, o: cur.B.o === "b" ? "b" : "w", k: (Now.mine() || {}).k || null} : {t: "st", id: pid(), fen: null};
  /* every board tells us its position; the one that counts is the big one on screen (small preview boards are skipped) */
  function note(B, fen, last){
    if (typeof App !== "undefined" && App.route === "watch") return;
    if (!big(B) && cur && cur.B !== B && big(cur.B)) return;
    const l = last && SQ.test(last.from) && SQ.test(last.to) ? {from: last.from, to: last.to} : null, key = fen + (l ? l.from + l.to : "");
    const other = !cur || cur.B !== B; cur = {B, fen, last: l}; if (key === lastKey && !other) return; lastKey = key; sugs = {}; lastSug = ""; if (B.sug && B.sug.length) B.sug = [];
    if (pub) pub.send(state()); pill();
  }
  /* the board was turned round: the watchers turn with it */
  function poke(B){ if (pub && cur && cur.B === B) pub.send(state()); }
  const paintSug = () => { if (cur && cur.B.setSug && cur.B.el.isConnected) cur.B.setSug(Object.values(sugs)); };
  function onPub(m){
    if (!pub || !m || !m.id || m.id === pid()) return;
    if (m.t === "hi"){ const fresh = !ws[m.id]; ws[m.id] = {name: String(m.name || "?").replace(/\s+/g, " ").trim().slice(0, 16) || "?", t: Date.now()}; pub.send(state());
      if (fresh){ toast(`👀 ${ws[m.id].name} ${T("is watching you", "schaut dir zu")}`, 2600); vib([10, 30, 10]); } pill(); }
    else if (m.t === "bye"){ delete ws[m.id]; delete sugs[m.id]; paintSug(); pill(); }
    else if (m.t === "sug"){
      /* an arrow from a watcher: shown whatever the position was when it was drawn, until the next move; from: null takes it back */
      if (!ws[m.id]) ws[m.id] = {name: String(m.name || "?").replace(/\s+/g, " ").trim().slice(0, 16) || "?", t: Date.now()}; else ws[m.id].t = Date.now();
      if (!m.from){ delete sugs[m.id]; paintSug(); pill(); return; }
      if (!SQ.test(m.from) || !SQ.test(m.to) || m.from === m.to) return;
      sugs[m.id] = [m.from, m.to, "b"]; lastSug = ws[m.id].name; paintSug(); vib([12, 40, 12]); try { Sound.play("GenericNotify", .35); } catch(e) {}
      pub.send({t: "ack", id: pid(), to: m.id, n: m.n, shown: !!(cur && big(cur.B) && cur.B.ply == null)}); pill(); }
    else if (m.t === "rtc"){ if (voice) PVoice.onMsg(m); }
  }
  const watchable = () => { const w = Now.mine(); return !!(w && /^(puzzle|chess|duel)$/.test(w.k)) && !document.hidden && !!me() && !!sb(); };
  function sync(){
    const want = watchable();
    if (want && !pub) pub = chan("chessnat-watch-" + me(), onPub, () => pub && pub.send(state()));
    else if (!want && pub){ try { pub.send({t: "end", id: pid()}); } catch(e) {} voiceOff(); const p = pub; pub = null; setTimeout(() => p.close(), 250); ws = {}; sugs = {}; cur = null; lastKey = ""; }
    if (pub){ const now = Date.now(); let gone = false; Object.keys(ws).forEach(id => { if (now - ws[id].t > 16000){ delete ws[id]; delete sugs[id]; gone = true; } }); if (gone){ paintSug(); if (!Object.keys(ws).length) voiceOff(); }
      /* while someone watches: the position (and which way round the board is) goes out again every few seconds, in case one got lost */
      if (Object.keys(ws).length){ pub.send(state()); paintSug(); } }
    pill();
  }
  /* "Mila is watching" with the microphone button, while someone is */
  function pill(){
    let el = document.querySelector(".watch-pill"); const names = Object.values(ws).map(w => w.name);
    if (!pub || !names.length){ if (el) el.remove(); return; }
    if (!el){ el = document.createElement("div"); el.className = "watch-pill"; el.setAttribute("data-notr", ""); document.body.appendChild(el); }
    const x = `<span>👀 ${h(names.slice(0, 2).join(", "))}${names.length > 2 ? " +" + (names.length - 2) : ""}${lastSug ? `<small>💡 ${T("Suggestion from", "Vorschlag von")} ${h(lastSug)}</small>` : ""}</span>${micHTML()}`;
    if (el._x !== x){ el._x = x; el.innerHTML = x; }
  }

  /* ---- I'm watching ---- */
  const LBL = {puzzle: ["is solving a puzzle", "löst ein Puzzle"], chess: ["is playing chess", "spielt Schach"], duel: ["is in a puzzle duel", "ist im Puzzle-Duell"]};
  Views.watch = {
    mount(main, arg){
      const V = this; V.id = arg && arg.id; V.fen = null; V.got = false; V.last = null;
      const p = typeof Social !== "undefined" && Social.P ? Social.P(V.id) : {name: "?"}; V.name = (p && p.name) || "?";
      if (!V.id || !sb() || !me()){ main.innerHTML = `<div class="page"><p class="muted">${T("Sign in to watch.", "Melde dich an, um zuzuschauen.")}</p></div>`; return; }
      main.innerHTML = stageHTML(); main.firstElementChild.setAttribute("data-notr", "");
      $("#topbar").innerHTML = `<span class="pill">👀 ${h(V.name)}</span><span class="pill" id="wst">${T("Connecting …", "Verbinde …")}</span>`;
      $("#botbar").innerHTML = `<span class="watch-hint" id="whint">${T("Draw an arrow: drag from square to square.", "Zeichne einen Pfeil: von Feld zu Feld ziehen.")}</span>`;
      $("#sp").innerHTML = `<div class="watch-side"><h3>${T("You're watching", "Du schaust zu")}</h3><p class="muted">${h(V.name)} ${T("sees your suggestion as a blue arrow. Only", "sieht deinen Vorschlag als blauen Pfeil. Ziehen kann nur")} ${h(V.name)}${T(" can move.", ".")}</p></div>`;
      $("#sf").innerHTML = `<div class="watch-foot"><button class="btn" id="wmic">${T("🔇 Voice chat", "🔇 Sprachchat")}</button><button class="btn ghost" id="wleave">${T("Leave", "Verlassen")}</button></div>`;
      const B = V.board = makeBoard($("#bw"), {history: false}); V.g = new Chess(); V.n = 0; V.sel = null;
      B.canPick = () => false; B.dests = () => [];
      const hint = t => { const hn = $("#whint"); if (hn) hn.textContent = t; };
      /* an arrow can always be drawn, whoever is to move: drag from square to square, or tap the two squares one after the other */
      V.suggest = (from, to) => { V.sel = null; B.userMarks = {}; B.setArrows([[from, to, "b"]]); const n = ++V.n; V.ch.send({t: "sug", id: pid(), name: myName(), n, from, to}); vib(10); try { Sound.tap(); } catch(e) {}
        hint(T("Sending …", "Wird gesendet …")); clearTimeout(V.ackT); V.ackT = setTimeout(() => { if (V.n === n && V.ch){ V.ch.send({t: "sug", id: pid(), name: myName(), n, from, to}); hint(T("Not there yet, trying again …", "Noch nicht angekommen, ich versuche es nochmal …")); } }, 2500); };
      B.onDraw = (from, to) => { if (!V.fen) return; if (to) return V.suggest(from, to);
        if (V.sel && V.sel !== from) return V.suggest(V.sel, from);
        if (V.sel === from){ V.sel = null; B.userMarks = {}; B.paint(); return; }
        V.sel = from; B.userMarks = {[from]: "b"}; B.paint(); hint(T("Now tap the target square.", "Jetzt das Zielfeld antippen.")); };
      V.ch = chan("chessnat-watch-" + V.id, m => V.on(m), () => V.hi());
      V.hiT = setInterval(() => V.hi(), 5000);
      V.waitT = setTimeout(() => { if (!V.got && $("#wst")) $("#wst").textContent = T("No board open right now", "Gerade kein Brett offen"); }, 7000);
      $("#wleave").onclick = () => { if (App.stack.length) history.back(); else App.go("friends"); };
      $("#wmic").onclick = async () => { if (voice) voiceOff(); else await voiceOn(m => V.ch.send(m)); $("#wmic").textContent = voice ? T("🎙️ Voice chat on", "🎙️ Sprachchat an") : T("🔇 Voice chat", "🔇 Sprachchat"); $("#wmic").classList.toggle("go", voice); };
      if (typeof sizeBoard === "function") sizeBoard();
    },
    hi(){ if (this.ch) this.ch.send({t: "hi", id: pid(), uid: me(), name: myName()}); },
    on(m){
      const V = this; if (!m || !m.id || m.id === pid()) return;
      if (m.t === "rtc"){ if (voice) PVoice.onMsg(m); return; }
      if (m.t === "ack"){ if (m.to === pid() && m.n === V.n){ clearTimeout(V.ackT); const hn = $("#whint"); if (hn) hn.textContent = m.shown ? `✓ ${V.name} ${T("sees your arrow", "sieht deinen Pfeil")}` : `✓ ${T("Arrived", "Angekommen")}`; } return; }
      const st = $("#wst"); if (!st) return;
      if (m.t === "end" || (m.t === "st" && !m.fen)){ V.fen = null; st.textContent = m.t === "end" ? `${V.name} ${T("has finished", "ist fertig")}` : T("Between two boards …", "Gerade zwischen zwei Brettern …"); V.board.setArrows([]); return; }
      if (m.t !== "st" || typeof m.fen !== "string" || m.fen.length > 100) return;
      V.got = true; const lb = LBL[m.k] || LBL.chess; st.textContent = `${V.name} ${T(lb[0], lb[1])}`;
      const last = m.last && SQ.test(m.last.from) && SQ.test(m.last.to) ? {from: m.last.from, to: m.last.to} : null;
      if (V.board.o !== (m.o === "b" ? "b" : "w")) V.board.setOrientation(m.o === "b" ? "b" : "w");
      if (m.fen === V.fen) return;
      let g; try { g = new Chess(m.fen); } catch(e) { return; } if (!g.fen || g.fen().split(" ")[0] !== m.fen.split(" ")[0]) return;
      V.fen = m.fen; V.g = g; V.last = last; V.sel = null; V.n++; clearTimeout(V.ackT); V.board.userMarks = {}; V.board.setArrows([]); V.board.set(g, last);
      const hn = $("#whint"); if (hn) hn.textContent = T("Draw an arrow: drag from square to square.", "Zeichne einen Pfeil: von Feld zu Feld ziehen.");
    },
    unmount(){ clearInterval(this.hiT); clearTimeout(this.waitT); clearTimeout(this.ackT); if (!this.ch) return; try { this.ch.send({t: "bye", id: pid()}); } catch(e) {} voiceOff(); const c = this.ch; this.ch = null; setTimeout(() => c.close(), 250); }
  };

  function start(){
    setInterval(sync, 3000); window.addEventListener("chessnat:route", () => setTimeout(sync, 400)); document.addEventListener("visibilitychange", sync);
    document.addEventListener("click", async e => { const b = e.target.closest && e.target.closest(".watch-pill [data-watch-mic]"); if (!b) return; e.preventDefault(); e.stopPropagation();
      if (voice) voiceOff(); else if (pub) await voiceOn(m => pub && pub.send(m)); const el = document.querySelector(".watch-pill"); if (el) el._x = ""; pill(); }, true);
    const st = document.createElement("style"); st.textContent = `
.watch-pill{position:fixed;left:12px;bottom:calc(var(--tab-h,0px) + env(safe-area-inset-bottom,0px) + 84px);z-index:2400;display:flex;align-items:center;gap:10px;padding:8px 8px 8px 14px;border-radius:999px;background:rgba(30,40,24,.96);box-shadow:0 8px 22px rgba(0,0,0,.45),inset 0 0 0 1.5px rgba(155,226,90,.5);color:#fff;font:800 14px var(--body);max-width:calc(100vw - 24px);animation:watchIn .35s cubic-bezier(.2,.8,.2,1)}
@keyframes watchIn{from{transform:translateY(14px);opacity:0}to{transform:none;opacity:1}}
.watch-pill span{display:flex;flex-direction:column;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.watch-pill small{font:700 11.5px var(--body);color:#8FB8FF}
.watch-mic{width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,255,255,.14);font-size:17px;cursor:pointer;flex:none}
.watch-mic.on{background:var(--go)}
.watch-hint{font:800 13.5px var(--body);color:var(--muted)}
.watch-side h3{margin:0 0 6px}.watch-side p{margin:0}
.watch-foot{display:grid;grid-template-columns:1fr 1fr;gap:10px}`; document.head.appendChild(st);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  return {note, poke, hasBoard: () => !!(cur && big(cur.B)), get watchers(){ return Object.values(ws).map(w => w.name); }, get voice(){ return voice; }};
})();
