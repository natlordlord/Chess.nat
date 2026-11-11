/* ===== "Is in a game right now": what each friend is doing at this moment, on the friends list and on their profile,
   with a button that takes you into their lobby (a running round: you watch, and from the next round you play).
   Written to chess_now every few seconds while something is going on (only friends can read it); a row older than
   90 seconds counts as gone, so a closed app clears itself. ===== */
const Now = (() => {
  const sb = () => window.ChessSite && window.ChessSite.sb, me = () => (typeof Social !== "undefined" && Social.me) || null;
  const de = () => typeof I18N === "undefined" || I18N.lang === "de", T = (en, dg) => de() ? dg : en;
  const h = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const PUZ = ["puzzles", "rush", "daily", "jlevel", "endgames", "coords", "repdrill", "lesson"], CHESS = ["bots", "friend", "local", "linkgame", "blitz"], DUEL = ["duel", "battle"];
  const FRESH = 90000;
  /* what this phone is doing: a party lobby counts first, then the screen you're on */
  function mine(){
    const P = typeof PNet !== "undefined" ? PNet.P : null;
    if (P && P.game){ if (P.solo) return {k: "solo", g: P.game};
      return {k: "party", g: P.game, c: P.code, run: P.isHost ? !!P.G : !!(P.msg && !P.msg.lobby), n: ((P.isHost ? P.roster : P.msg && P.msg.players) || []).length}; }
    const r = typeof App !== "undefined" ? App.route : "";
    if (r === "online" && App.view && !App.view.searching) return {k: "chess"};
    if (PUZ.includes(r)) return {k: "puzzle"}; if (CHESS.includes(r)) return {k: "chess"}; if (DUEL.includes(r)) return {k: "duel"};
    return null;
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
  const btn = (w, big) => joinable(w) ? `<button class="btn ${big ? "" : "sm"} go now-go" data-now-join="${h(w.c)}">${w.run ? T("Watch", "Zuschauen") : T("Join", "Mitspielen")}</button>` : "";
  /* every place that shows it is an empty slot the page leaves for us: <span data-now="<player id>"> (small) or data-now-card (profile) */
  function html(id, card){ const w = id === me() ? null : of(id); if (!w) return "";
    return card ? `<div class="now-card"><span class="now-dot"></span><div class="grow"><small>${T("In a game right now", "Ist gerade im Game")}</small><b>${h(text(w))}</b>${w.k === "party" && w.n > 1 ? `<i>${w.n} ${T("players", "Spieler")}</i>` : ""}${joinable(w) && w.run ? `<i>${T("You watch this round and play from the next one.", "Du schaust diese Runde zu und spielst ab der nächsten mit.")}</i>` : ""}</div>${btn(w, true)}</div>`
      : `<span class="now-chip"><span class="now-dot"></span>${h(text(w))}</span>${btn(w)}`; }
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
  return {mine, of, text, load, paint, slot, cardSlot, tick};
})();
