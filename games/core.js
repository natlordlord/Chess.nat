/* ===== Chess.nat Games: party games for one phone (pass it around), with Chess as one of the games.
   Built only from the app's own parts: the same tiles, buttons, colours and sounds (every tap is the pawn "plop").
   Buttons follow the app language; the cards of the word games are German.
   Each game file calls PG.add({...}); Views.games is the hub, Views.party hosts the game you picked. ===== */
const PG = (() => {
  const de = () => typeof I18N === "undefined" || I18N.lang === "de";
  const T = (en, dg) => de() ? dg : en;
  const KEY = "chessnat-party";
  let st = {}; try { st = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch(e) {}
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch(e) {} };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const h = s => esc(String(s == null ? "" : s));
  const vib = p => { try { Haptic.go(p); } catch(e) {} };

  /* one list of players for all games, remembered on this device */
  const players = () => (Array.isArray(st.players) ? st.players : []).slice();
  const setPlayers = a => { st.players = a.slice(0, 24); persist(); };
  const opt = (game, def) => { st.opt = st.opt || {}; st.opt[game] = Object.assign({}, def, st.opt[game] || {}); return st.opt[game]; };

  /* cards come out of a shuffled deck: nothing repeats until the whole deck has been played */
  function draw(deck, list){
    st.decks = st.decks || {}; let d = st.decks[deck];
    if (!Array.isArray(d) || !d.length || d.some(i => i >= list.length)) d = shuffle(list.map((_, i) => i));
    const i = d.pop(); st.decks[deck] = d; persist(); return list[i];
  }

  /* timers and listeners of the running game, all stopped when you leave */
  let jobs = [];
  const every = (fn, ms) => { const id = setInterval(fn, ms); jobs.push(() => clearInterval(id)); return id; };
  const later = (fn, ms) => { const id = setTimeout(fn, ms); jobs.push(() => clearTimeout(id)); return id; };
  const onLeave = fn => jobs.push(fn);
  const stopAll = () => { const j = jobs; jobs = []; j.forEach(f => { try { f(); } catch(e) {} }); };

  /* keep the screen on while a game runs (the phone lies on the table for minutes) */
  let lock = null;
  async function awake(on){
    try { if (on && !lock && navigator.wakeLock){ lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => { lock = null; }); }
      else if (!on && lock){ lock.release(); lock = null; } } catch(e) {}
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && PG.running) awake(true); });

  /* ---- players editor ---- */
  function playersUI(box, {min = 3, max = 20, onChange} = {}){
    const draw = keep => {
      const P = players();
      box.innerHTML = `<div class="row" style="justify-content:space-between"><h3>${T("Players", "Spieler")} <span class="muted" style="font:700 14px var(--body)">${P.length}</span></h3>
          ${P.length > 1 ? `<button class="btn ghost sm" data-shuf>${T("Shuffle order", "Reihenfolge mischen")}</button>` : ""}</div>
        <div class="pg-pls">${P.map((n, i) => `<span class="pg-chip"><span>${h(n)}</span><button data-rm="${i}" aria-label="${T("Remove", "Entfernen")}">×</button></span>`).join("") || `<span class="muted" style="font-size:14px">${T("Add everyone who plays.", "Trag alle ein, die mitspielen.")}</span>`}</div>
        ${P.length < max ? `<form class="pg-add"><input type="text" maxlength="16" placeholder="${T("Name", "Name")}" enterkeyhint="done" autocomplete="off"><button class="btn go" type="submit">${T("Add", "Hinzufügen")}</button></form>` : ""}
        ${P.length < min ? `<p class="muted" style="margin:8px 0 0;font-size:13px">${T(`At least ${min} players.`, `Mindestens ${min} Spieler.`)}</p>` : ""}`;
      $$("[data-rm]", box).forEach(b => b.onclick = () => { const a = players(); a.splice(+b.dataset.rm, 1); setPlayers(a); draw(); onChange && onChange(); });
      const sh = box.querySelector("[data-shuf]"); if (sh) sh.onclick = () => { setPlayers(shuffle(players())); draw(); onChange && onChange(); };
      const f = box.querySelector("form"); if (f){ const inp = f.querySelector("input");
        f.onsubmit = e => { e.preventDefault(); const n = inp.value.trim().replace(/\s+/g, " "); if (!n) return;
          const a = players(); if (a.some(x => x.toLowerCase() === n.toLowerCase())){ toast(T("That name is already in.", "Den Namen gibt es schon.")); return; }
          a.push(n); setPlayers(a); draw(true); onChange && onChange(); };
        if (keep){ const i2 = box.querySelector("form input"); if (i2) i2.focus(); } }
    };
    draw(); return {redraw: draw};
  }

  /* ---- a row of choices (one selected, green like the clock buttons) ---- */
  function choices(box, items, cur, onPick, cols){
    box.innerHTML = `<div class="${cols ? "grid" + cols : "pg-opt"}" style="${cols ? "margin-top:8px" : ""}">${items.map(([v, label]) => `<button class="btn sm ${String(v) === String(cur) ? "go" : ""}" data-v="${h(v)}">${label}</button>`).join("")}</div>`;
    $$("[data-v]", box).forEach(b => b.onclick = () => onPick(items.find(x => String(x[0]) === b.dataset.v)[0]));
  }

  /* ---- pass the phone, then a card you flip to peek at ---- */
  function passCard(box, {name, front, bad, hint, next, onDone}){
    box.innerHTML = `<div class="pg-stage"><div class="pg-who">${T("Pass the phone to", "Gib das Handy an")}</div><div class="pg-name">${h(name)}</div>
      <p class="muted" style="margin:0">${T("Nobody else looks!", "Alle anderen schauen weg!")}</p>
      <button class="btn go big" data-me style="max-width:340px">${T(`I'm ${h(name)}`, `Ich bin ${h(name)}`)}</button></div>`;
    box.querySelector("[data-me]").onclick = () => card(box, {front, bad, hint, next, onDone, name});
  }
  function card(box, {front, bad, hint, next, onDone, name}){
    box.innerHTML = `<div class="pg-stage">${name ? `<div class="pg-who">${h(name)}</div>` : ""}
      <button class="pg-card" data-card data-quiet aria-label="${T("Card", "Karte")}"><span class="in"><span class="b"><span class="pg-cardtag">${T("Tap to look", "Tippen zum Aufdecken")}</span></span><span class="f ${bad ? "bad" : ""}">${front}</span></span></button>
      <p class="pg-hint" data-ht>${hint || T("Tap the card to look, tap again to hide it.", "Tippe auf die Karte zum Anschauen, nochmal tippen zum Verdecken.")}</p>
      <button class="btn big" data-next disabled style="max-width:340px">${next || T("Hide and pass on", "Verdecken und weitergeben")}</button></div>`;
    const c = box.querySelector("[data-card]"), nx = box.querySelector("[data-next]"); let seen = false, t0 = 0;
    const set = on => { c.classList.toggle("open", on); if (on){ seen = true; nx.disabled = false; nx.classList.add("go"); Sound.play("Capture", .45); } else Sound.tap(); };
    /* tap to open and tap to close; holding it open and letting go closes it too */
    c.onpointerdown = e => { e.preventDefault(); t0 = Date.now(); if (!c.classList.contains("open")){ set(true); c.dataset.just = 1; } };
    c.onpointerup = () => { const held = Date.now() - t0 > 450; if (c.dataset.just){ delete c.dataset.just; if (held) set(false); return; } set(false); };
    c.oncontextmenu = e => e.preventDefault();
    nx.onclick = () => { if (!seen) return; c.classList.remove("open"); setTimeout(() => onDone && onDone(), 260); };
  }
  /* everyone in turn: pass, peek, next */
  function revealRound(box, list, onFinish){
    let i = 0; const step = () => { if (i >= list.length) return onFinish(); const it = list[i++]; passCard(box, Object.assign({}, it, {onDone: step, next: i === list.length ? T("Hide and continue", "Verdecken und weiter") : undefined})); };
    step();
  }

  /* ---- countdown, clock style; ticks in the last five seconds ---- */
  function timer(el, secs, onEnd){
    let end = Date.now() + secs * 1000, paused = 0, last = null, done = false;
    const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
    const tick = () => { if (done) return; const left = paused ? paused : end - Date.now(); el.textContent = fmt(left); const s = Math.ceil(left / 1000);
      el.classList.toggle("low", s <= 10); if (!paused && s !== last && s <= 5 && s > 0){ Sound.tick(); vib(s <= 3 ? 40 : 20); } last = s;
      if (!paused && left <= 0){ done = true; clearInterval(id); el.textContent = "0:00"; Sound.play("GenericNotify", .8); vib([80, 60, 160]); onEnd && onEnd(); } };
    const id = every(tick, 200); tick();
    return {stop(){ done = true; clearInterval(id); }, pause(){ if (!paused) paused = Math.max(1, end - Date.now()); tick(); }, resume(){ if (paused){ end = Date.now() + paused; paused = 0; tick(); } }, get paused(){ return !!paused; }, add(s){ end += s * 1000; tick(); }};
  }

  /* ---- tap a player ---- */
  function playerGrid(names, {sel = [], off = [], mark = {}} = {}){
    return `<div class="pg-grid">${names.map((n, i) => `<button class="btn ${sel.includes(i) ? "go" : ""} ${off.includes(i) ? "pg-off" : ""}" data-p="${i}" ${off.includes(i) ? "disabled" : ""}>${h(n)}${mark[i] ? `<small class="pg-mk">${mark[i]}</small>` : ""}</button>`).join("")}</div>`;
  }

  /* ---- scores per player, kept for the evening ---- */
  function scoreList(names, pts){
    const order = names.map((n, i) => [n, pts[i] || 0, i]).sort((a, b) => b[1] - a[1]);
    return `<div class="list">${order.map(([n, p], k) => `<div class="li"><span class="pg-rank">${k + 1}</span><div class="grow t">${h(n)}</div><b style="font:900 18px var(--display)">${p}</b></div>`).join("")}</div>`;
  }

  /* ---- games ---- */
  const games = [];
  /* each game's own face: a big symbol on its own colour, inside the app's tile */
  const ART = {imposter: ["🕵️", "#E2523E"], werwolf: ["🐺", "#4A5BA8"], tod: ["😈", "#C2448F"], never: ["🍻", "#E9B64A"], likely: ["👉", "#5AA3E0"], heads: ["🤔", "#26C2A3"], tabu: ["🤐", "#E2523E"], bomb: ["💣", "#F08A24"], slf: ["✍️", "#7FB24A"], four: ["🔴", "#5C8BD6"]};
  const add = g => games.push(g);
  const cheer = (n = 2) => { try { Sound.cheer(n); } catch(e) {} };
  return {ART, data: {}, custom: {}, de, T, h, st, persist, shuffle, pick, vib, players, setPlayers, opt, draw, every, later, onLeave, stopAll, awake, playersUI, choices, passCard, card, revealRound, timer, playerGrid, scoreList, games, add, cheer, running: false};
})();

/* every button on a game page plops once (one listener for the whole app, never stacked) */
document.addEventListener("click", e => { const b = e.target.closest && e.target.closest(".pg button"); if (!b || b.disabled || b.hasAttribute("data-quiet") || b.id === "pgback" || b.id === "lleave") return; Sound.tap(); });

/* ---- the look: only the app's own colours, fonts and shapes ---- */
(() => {
  const css = `
.pg .unit h3{margin:0}
.pg-pls{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
.pg-chip{display:inline-flex;align-items:center;gap:6px;background:var(--panel-2);border-radius:999px;padding:5px 5px 5px 12px;font-weight:700;font-size:15px}
.pg-chip button{border:0;background:var(--panel-3);color:var(--muted);width:24px;height:24px;border-radius:50%;cursor:pointer;font:900 15px var(--body);line-height:1;display:flex;align-items:center;justify-content:center}
.pg-add{display:flex;gap:8px}.pg-add input{flex:1;min-width:0;font-size:16px}
.pg-opt{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.pg-sub{color:var(--muted);font-size:13.5px;margin:2px 0 0}
.pg-stage{display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;padding:14px 0 8px}
.pg-who{color:var(--muted);font:800 13px var(--body);letter-spacing:.06em;text-transform:uppercase}
.pg-name{font:900 40px var(--display);letter-spacing:-.01em;line-height:1.05;word-break:break-word}
.pg-card{position:relative;width:min(270px,62vw,calc((100dvh - 330px) * .75));aspect-ratio:3/4;border:0;padding:0;background:none;perspective:1200px;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.pg-card .in{position:absolute;inset:0;transition:transform .45s cubic-bezier(.2,.8,.2,1);transform-style:preserve-3d}
.pg-card.open .in{transform:rotateY(180deg)}
.pg-card .f,.pg-card .b{position:absolute;inset:0;border-radius:16px;backface-visibility:hidden;-webkit-backface-visibility:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:20px;box-shadow:0 10px 26px rgba(0,0,0,.4),inset 0 -6px 0 rgba(0,0,0,.18)}
.pg-card .b{background:conic-gradient(var(--sq-l) 25%,var(--sq-d) 0 50%,var(--sq-l) 0 75%,var(--sq-d) 0) 0 0/25% 18.75%;border:6px solid var(--panel-3)}
.pg-cardtag{background:var(--panel);color:var(--fg);font:800 15px var(--body);padding:10px 16px;border-radius:999px;box-shadow:0 4px 12px rgba(0,0,0,.35)}
.pg-card .f{transform:rotateY(180deg);background:#F4F2EE;color:#262421}
.pg-card .f.bad{background:#E2523E;color:#fff}
.pg-card .f.night{background:#1E2230;color:#F4F2EE}
.pg-card .lab{font:800 12px var(--body);letter-spacing:.08em;text-transform:uppercase;opacity:.7}
.pg-card .big{font:900 34px/1.1 var(--display);word-break:break-word}
.pg-card .em{font-size:64px;line-height:1}
.pg-card .sm{font:600 14.5px/1.4 var(--body);opacity:.85}
.pg-hint{color:var(--muted);font-size:13.5px;margin:0;max-width:340px}
.pg-timer{font:700 56px var(--mono);font-variant-numeric:tabular-nums;background:#1B1A18;color:#F4F2EE;border-radius:10px;padding:4px 18px;min-width:200px;text-align:center}
.pg-timer.low{background:var(--bad);color:#fff}
.pg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%}
.pg-grid .btn{min-height:52px;flex-direction:column;gap:2px;word-break:break-word}
.pg-grid .btn.pg-off{opacity:.35;text-decoration:line-through}
.pg-mk{font:700 11.5px var(--body);opacity:.8}
.pg-rank{width:26px;height:26px;border-radius:50%;background:var(--panel-3);display:inline-flex;align-items:center;justify-content:center;font:900 12px var(--body);flex:0 0 auto}
.pg-big{background:var(--panel);border-radius:14px;padding:26px 20px;min-height:230px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px;text-align:center;width:100%;box-shadow:inset 0 -4px 0 rgba(0,0,0,.2)}
.pg-big .q{font:800 25px/1.3 var(--display);text-wrap:balance}
.pg-big .k{font:800 12px var(--body);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.pg-pop{animation:pgPop .32s cubic-bezier(.2,.9,.3,1.3)}
@keyframes pgPop{0%{transform:scale(.92);opacity:.2}100%{transform:none;opacity:1}}
.pg-meta{font:700 12px var(--body);color:var(--dim);margin-top:auto;padding-top:4px}
.pg-onl{display:flex;align-items:center;gap:12px;width:100%;border:1px solid var(--go);cursor:pointer;color:var(--fg);margin:10px 0 0;text-align:left;font:inherit}
.pg-onl small{display:block;color:var(--muted);font-size:13px;font-weight:600}.pg-onl b{font:800 16px var(--display)}.pg-onl-i{font-size:18px;letter-spacing:-6px;margin-right:6px}
.pg-gt{position:relative;overflow:hidden}
.pg-gt::before{content:"";position:absolute;right:-30px;top:-30px;width:120px;height:120px;border-radius:50%;background:var(--ac);opacity:.16}
.pg-art{width:52px;height:52px;border-radius:14px;background:var(--ac);display:flex;align-items:center;justify-content:center;font-size:30px;box-shadow:inset 0 -4px 0 rgba(0,0,0,.22);position:relative}
.pg-gt h3{position:relative}.pg-gt p{position:relative}
.pg-np{position:relative;overflow:hidden;width:100%;margin-top:12px;min-height:150px;background:radial-gradient(120% 140% at 85% 20%,#2a2450 0%,#141322 55%,#0B0C12 100%)!important;border:1px solid #7B5CD6;color:#fff}
.pg-np-stars{position:absolute;inset:0;background-image:radial-gradient(1.5px 1.5px at 20% 30%,#fff 50%,transparent 51%),radial-gradient(1px 1px at 60% 20%,#fff 50%,transparent 51%),radial-gradient(1.5px 1.5px at 80% 70%,#fff 50%,transparent 51%),radial-gradient(1px 1px at 40% 80%,#fff 50%,transparent 51%),radial-gradient(1px 1px at 90% 40%,#fff 50%,transparent 51%),radial-gradient(1.2px 1.2px at 10% 70%,#fff 50%,transparent 51%);opacity:.8}
.pg-np-ship{position:absolute;right:18px;top:16px;font-size:64px;transform:rotate(-20deg);filter:drop-shadow(0 6px 16px rgba(123,92,214,.6));animation:pgShip 4s ease-in-out infinite}
@keyframes pgShip{50%{transform:rotate(-14deg) translateY(-6px)}}
.pg-np p{color:#c9c4d8!important;max-width:70%}
.pg-sec{font:800 13px var(--body);text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:20px 2px 8px}
.tile .pg-emo{font-size:30px;line-height:1}
.pg-chess{position:relative;overflow:hidden}
.pg-chess .deco{position:absolute;right:-14px;bottom:-18px;width:150px;height:150px;opacity:.9;background:conic-gradient(var(--sq-l) 25%,var(--sq-d) 0 50%,var(--sq-l) 0 75%,var(--sq-d) 0) 0 0/50% 50%;transform:rotate(-12deg);border-radius:10px}
.pg-chess .deco i{position:absolute;width:50%;height:50%;left:25%;top:20%;background-size:100% 100%}
.pg-chess>*:not(.deco){position:relative;z-index:1}
html.pg-night,html.pg-night body,html.pg-night .app{background:#14161F!important}
html.pg-night .mtop{background:#14161F}
.pg-night .unit,.pg-night .pg-big{background:#1E2230}
.pg-moon{font-size:56px;line-height:1;filter:drop-shadow(0 0 18px rgba(255,236,170,.35))}
.pg-say{font:800 23px/1.35 var(--display);text-wrap:balance;margin:0}
.pg-say small{display:block;font:600 14px/1.45 var(--body);color:var(--muted);margin-top:8px}
.pg-roles .li{gap:10px}
.pg-step{display:flex;align-items:center;justify-content:center;gap:8px;width:100%}
.pg-step b{font:900 22px var(--display);min-width:34px;text-align:center}
.pg-step .btn{width:44px;height:40px;padding:0}
@media (max-width:900px){.pg-name{font-size:34px}.pg-big .q{font-size:22px}.pg-timer{font-size:46px}}
`;
  const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
})();

/* ---- icons in the app's line style ---- */
Object.assign(ICONS, {
  dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.3" cy="8.3" r="1.2" fill="currentColor"/><circle cx="15.7" cy="15.7" r="1.2" fill="currentColor"/><circle cx="15.7" cy="8.3" r="1.2" fill="currentColor"/><circle cx="8.3" cy="15.7" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  spy: '<path d="M4 10.5h16M6.5 10.5 8 5h8l1.5 5.5"/><circle cx="8" cy="15.5" r="3"/><circle cx="16" cy="15.5" r="3"/><path d="M11 15.5h2"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  glass: '<path d="M6 3h12l-1.4 16.6A1.5 1.5 0 0 1 15.1 21H8.9a1.5 1.5 0 0 1-1.5-1.4z"/><path d="M6.6 9.5h10.8"/>',
  point: '<path d="M9 11V5a1.5 1.5 0 0 1 3 0v5"/><path d="M12 10V9a1.5 1.5 0 0 1 3 0v2M15 11a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 5 16l-1-3a1.5 1.5 0 0 1 2.6-1.3L9 14"/>',
  head: '<circle cx="12" cy="14" r="7"/><rect x="7.5" y="2.5" width="9" height="5.5" rx="1.2"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  bomb: '<circle cx="11" cy="14" r="7"/><path d="M15.5 9.5l2-2"/><path d="M18.5 3.5v1.5M21 6h-1.5M20.3 4.2l-1 1"/>',
  letters: '<path d="M3.5 18l4-12 4 12M5 14h5"/><path d="M14.5 6h3.5a2.5 2.5 0 0 1 0 5h-3.5zM14.5 11h4.2a3 3 0 0 1 0 6h-4.2z"/>',
  grid4: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8" cy="9.3" r="1.7"/><circle cx="12" cy="9.3" r="1.7"/><circle cx="16" cy="9.3" r="1.7"/><circle cx="8" cy="14.7" r="1.7"/><circle cx="12" cy="14.7" r="1.7"/><circle cx="16" cy="14.7" r="1.7"/>',
  bottle: '<path d="M10 2.5h4v4.2l2 3.3v10a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 20V10l2-3.3z"/><path d="M8 13.5h8"/>',
  cards: '<rect x="3" y="6" width="12" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/>'
});

/* ===== Hub ===== */
Views.games = {
  mount(main){
    const {T, h} = PG;
    main.innerHTML = `<div class="page"><h1 class="h-title">${T("Games", "Spiele")}</h1>
      <div class="tiles" style="margin-top:14px">
        <button class="tile pg-chess" data-go="play" style="grid-column:span 2;border:1px solid var(--go)"><span class="deco"><i class="pc wn"></i></span>${icon("knight", 40)}<span class="pill go">${T("The original", "Das Original")}</span><h3>${T("Chess", "Schach")}</h3><p>${T("Online, bots, friends, battles.", "Online, Bots, Freunde, Battles.")}</p></button>
      </div>
      <div class="tiles" style="margin-top:12px" data-notr><button class="tile" data-lobby style="grid-column:span 2;border:1px solid var(--go)">${icon("users", 40)}<span class="pill go">${T("New", "Neu")}</span><h3>${T("Play together", "Zusammen spielen")}</h3><p>${T("Everyone on their own phone. Invite friends or show the QR code.", "Jeder am eigenen Handy. Freunde einladen oder QR-Code zeigen.")}</p>${typeof PNet !== "undefined" && PNet.P ? `<span class="pg-meta" style="color:var(--go-hi)">● ${T("Your lobby is open", "Deine Lobby ist offen")} · ${esc(PNet.P.code.toUpperCase())}</span>` : ""}</button></div>
      <div class="pg-sec" data-notr>${T("Party games", "Partyspiele")}</div>
      ${PG.games.some(g => g.id === "natposter") ? `<button class="tile pg-np" data-g="natposter" data-notr><span class="pg-np-stars"></span><span class="pg-np-ship">🚀</span><span class="pill bad" style="position:relative">${T("New", "Neu")}</span><h3 style="position:relative;font-size:24px">Natposter</h3><p style="position:relative">${T("Space station, tasks, a traitor. Everyone on their own phone.", "Raumstation, Aufgaben, ein Verräter. Jeder am eigenen Handy.")}</p><span class="pg-meta" style="position:relative">4–15 ${T("players", "Spieler")}</span></button>` : ""}
      <div class="tiles" data-notr>${PG.games.filter(g => g.id !== "natposter").map(g => { const a = PG.ART[g.id] || ["🎲", "#7FB24A"]; return `<button class="tile pg-gt" data-g="${g.id}" style="--ac:${a[1]}"><span class="pg-art">${a[0]}</span><h3>${h(T(g.name[0], g.name[1]))}</h3><p>${h(T(g.sub[0], g.sub[1]))}</p><span class="pg-meta">${h(T(g.meta[0], g.meta[1]))}</span></button>`; }).join("")}</div></div>`;
    $$("[data-go]", main).forEach(b => b.onclick = () => { Sound.tap(); App.go(b.dataset.go); });
    $$("[data-g]", main).forEach(b => b.onclick = () => { Sound.tap(); App.go("party", {g: b.dataset.g}); });
    const lb = main.querySelector("[data-lobby]"); if (lb) lb.onclick = () => { Sound.tap(); App.go("lobby"); };
  }
};

/* ===== One party game ===== */
Views.party = {
  mount(main, arg){
    const {T} = PG; const id = (arg && arg.g) || PG.st.last; const g = PG.games.find(x => x.id === id);
    if (!g){ setTimeout(() => App.go("games"), 0); return; }
    PG.st.last = g.id; PG.persist(); PG.running = false;
    main.innerHTML = `<div class="page pg" data-notr style="max-width:640px"><button class="btn ghost sm" id="pgback">← ${T("Games", "Spiele")}</button>${PG.online && PG.online[g.id] && g.id !== "natposter" ? `<button class="unit pg-onl" id="pgon"><span class="pg-onl-i">📱📱📱</span><span style="flex:1;text-align:left"><b>${T("Everyone on their own phone", "Jeder mit eigenem Handy")}</b><small>${T("Open a lobby and invite your friends", "Lobby öffnen und Freunde einladen")}</small></span>${icon("users", 22)}</button>` : ""}<div id="pgbody"></div></div>`;
    const body = $("#pgbody", main), back = $("#pgback", main), onl = $("#pgon", main);
    if (onl) onl.onclick = () => App.go("lobby", {host: true, game: g.id});
    /* leaving a running game asks once more */
    back.onclick = () => { if (PG.running && !back.dataset.armed){ back.dataset.armed = 1; back.textContent = T("End the game? Tap again", "Spiel beenden? Nochmal tippen"); PG.later(() => { delete back.dataset.armed; back.textContent = "← " + T("Games", "Spiele"); }, 3000); return; } App.go("games"); };
    /* every button plops like a pawn, the way the whole app does */
    const ctx = {body, main, T, title: (en, dg) => `<h1 class="h-title" style="margin-top:6px">${T(en, dg)}</h1>`,
      start(){ if (onl) onl.style.display = "none"; PG.running = true; PG.awake(true); window.scrollTo(0, 0); main.scrollTop = 0; },
      stop(){ if (onl) onl.style.display = ""; PG.running = false; PG.awake(false); },
      top(){ window.scrollTo(0, 0); main.scrollTop = 0; }};
    g.mount(ctx);
  },
  unmount(){ PG.stopAll(); PG.running = false; PG.awake(false); document.documentElement.classList.remove("pg-night"); }
};

/* ===== Place it in the app: a "Games" tab (Chess lives inside it) and a rail entry ===== */
(() => {
  const {T} = PG;
  const i = TABS.findIndex(t => t[0] === "play"); if (i >= 0) TABS[i] = ["games", T("Games", "Spiele"), "dice"];
  Object.keys(TAB_OF).forEach(k => { if (TAB_OF[k] === "play") TAB_OF[k] = "games"; });
  Object.assign(TAB_OF, {play: "games", games: "games", party: "games"});
  if (!NAV.some(n => n[0] === "games")) NAV.splice(1, 0, ["games", T("Games", "Spiele"), "dice"]);
})();
