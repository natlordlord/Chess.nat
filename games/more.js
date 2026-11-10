/* ===== Tick-Tack-Bumm, Stadt-Land-Fluss, Vier gewinnt. ===== */
(() => {
  const {T, h} = PG;
  const sp = s => s.split(";").map(x => x.trim()).filter(Boolean);

  /* ---------- Tick-Tack-Bumm: say a word, pass the bomb, don't hold it when it goes off ---------- */
  const SYL = sp("UNG;EIN;TER;BER;SCHL;SPR;ST;SCH;AU;EI;ENT;VER;GE;BE;ER;AN;AB;IN;OL;ACK;ECK;ICH;AST;UR;ION;HEIT;KEIT;LICH;ISCH;ANT;ELL;OTT;UCK;ALL;ING;ORK;ATZ;ITZ;UTZ;OHR;ALT;ACH;ERN;UND;IER;OS;ANZ;ELL;UMP;EST");
  const KAT = sp("Etwas aus der Küche;Automarken;Tiere mit vier Beinen;Länder in Europa;Vornamen mit A;Dinge, die rot sind;Fußballvereine;Berufe;Obstsorten;Getränke;Dinge im Badezimmer;Städte in Deutschland;Filme;Sportarten;Musikinstrumente;Gemüse;Süßigkeiten;Kleidungsstücke;Körperteile;Schachbegriffe;Superhelden;Dinge am Strand;Apps;Farben;Hunderassen;Disney-Filme;Dinge, die fliegen;Biersorten;Rapper;Gesellschaftsspiele;Hauptstädte;Werkzeuge;Dinge in der Schule;Eissorten;Märchen");
  PG.data.bomb = {SYL, KAT};
  PG.add({id: "bomb", icon: "bomb", name: ["Tick Tock Boom", "Tick-Tack-Bumm"], sub: ["Say a word, pass the bomb. Don't hold it when it blows.", "Wort sagen, Bombe weitergeben. Wer sie hält, wenn sie explodiert, verliert."], meta: ["3+ players · 5 min", "3+ Spieler · 5 Min"],
    mount(ctx){
      const o = PG.opt("bomb", {mode: "syl"}); const boom = PG.st.boom = PG.st.boom || {};
      const setup = () => {
        ctx.stop();
        ctx.body.innerHTML = `${ctx.title("Tick Tock Boom", "Tick-Tack-Bumm")}<p class="muted">${T("The bomb has a secret fuse. Say a word that fits, tap ‘Pass’ and hand the phone on. Whoever holds it when it explodes loses.", "Die Bombe hat eine geheime Zündschnur. Sag ein passendes Wort, tippe ‚Weitergeben‘ und reich das Handy weiter. Wer sie hält, wenn sie explodiert, verliert.")}</p>
          <div class="unit"><h3>${T("Task", "Aufgabe")}</h3><div id="bm"></div><button class="btn go big" id="bgo" style="margin-top:14px">${T("Light the fuse", "Zündschnur anzünden")} 🔥</button></div>
          <div class="unit" id="bp"></div>`;
        const md = () => PG.choices($("#bm"), [["syl", T("Word with syllable", "Wort mit Silbe")], ["cat", T("Name something", "Begriff aus Kategorie")]], o.mode, v => { o.mode = v; PG.persist(); md(); }); md();
        PG.playersUI($("#bp"), {min: 0});
        $("#bgo").onclick = run;
      };
      const tick = i => { if (!Sound.fx || !Sound.fx()) return; Sound.tone([[i % 2 ? 1500 : 1050, .035]], "square", .045); };
      const run = () => {
        ctx.start();
        const task = o.mode === "syl" ? PG.draw("bomb-syl", SYL) : PG.draw("bomb-cat", KAT);
        const fuse = 18000 + Math.random() * 40000, t0 = Date.now(); let i = 0, live = true;
        ctx.body.innerHTML = `<div class="pg-stage"><div class="pg-big" style="min-height:0"><span class="k">${o.mode === "syl" ? T("A word with", "Ein Wort mit") : T("Name something:", "Nenne etwas:")}</span><div class="pg-name" style="font-size:${o.mode === "syl" ? 64 : 30}px">${o.mode === "syl" ? "…" + h(task) + "…" : h(task)}</div></div>
          <div id="bb" style="font-size:120px;line-height:1;transition:transform .1s">💣</div>
          <button class="btn go big" id="bpass" data-quiet style="max-width:340px;min-height:84px;font-size:24px">${T("Pass", "Weitergeben")} ➜</button></div>`;
        const bb = $("#bb");
        $("#bpass").onclick = () => { if (!live) return; Sound.tap(); PG.vib(15); bb.style.transform = "scale(.86) rotate(-8deg)"; PG.later(() => { bb.style.transform = ""; }, 110); };
        /* ticking gets faster as the fuse burns down (you can't tell how long it is) */
        const loop = () => { if (!live) return; const el = Date.now() - t0, f = Math.min(1, el / fuse);
          if (el >= fuse) return explode();
          tick(i++); bb.style.transform = `scale(${1 + (i % 2) * .05})`; PG.later(loop, 760 - 560 * Math.pow(f, 1.3) + Math.random() * 60); };
        loop();
        const explode = () => { live = false; PG.vib([200, 80, 400]);
          if (Sound.fx && Sound.fx()){ Sound.air(0, 1.1, 1400, 60, .3, .6); Sound.air(.05, .6, 300, 40, .25, .8); }
          Sound.play("Capture", 1); PG.later(() => Sound.play("Defeat", .8), 350);
          const P = PG.players();
          ctx.body.innerHTML = `<div class="pg-stage pg-pop"><div style="font-size:130px;line-height:1">💥</div><div class="pg-name">BUMM!</div>
            ${P.length ? `<p class="muted" style="margin:0">${T("Who was holding it?", "Wer hatte die Bombe?")}</p>${PG.playerGrid(P)}` : ""}
            <button class="btn go big" id="bagain" style="max-width:340px">${T("New bomb", "Neue Bombe")}</button>
            ${Object.keys(boom).length ? `<div class="unit" style="width:100%;text-align:left"><h3>${T("Explosions", "Explosionen")}</h3>${PG.scoreList(Object.keys(boom), Object.values(boom))}</div>` : ""}</div>`;
          $$("[data-p]", ctx.body).forEach(b => b.onclick = () => { const n = P[+b.dataset.p]; boom[n] = (boom[n] || 0) + 1; PG.persist(); explodeDone(); });
          $("#bagain").onclick = run; ctx.stop();
          const explodeDone = () => { toast("💥 " + T("Noted.", "Notiert.")); run(); };
        };
      };
      setup();
    }});

  /* ---------- Stadt-Land-Fluss ---------- */
  const LETTERS = "ABDEFGHIKLMNOPRSTUVWZ".split("");
  PG.data.slf = {LETTERS};
  const SLF_DEF = ["Stadt", "Land", "Fluss", "Name", "Beruf", "Tier", "Marke", "Promi"];
  PG.add({id: "slf", icon: "letters", name: ["Scattergories", "Stadt-Land-Fluss"], sub: ["One letter, many categories, the clock is ticking.", "Ein Buchstabe, viele Kategorien, die Uhr läuft."], meta: ["2+ players · paper & pen", "2+ Spieler · Zettel & Stift"],
    mount(ctx){
      const o = PG.opt("slf", {cats: SLF_DEF.slice(), secs: 90}); let G = null;
      const setup = () => {
        ctx.stop();
        ctx.body.innerHTML = `${ctx.title("Scattergories", "Stadt-Land-Fluss")}<p class="muted">${T("Everyone writes on their own paper. The phone picks the letter and keeps the time. Afterwards, enter each player's points.", "Alle schreiben auf ihren eigenen Zettel. Das Handy wählt den Buchstaben und stoppt die Zeit. Danach tragt ihr die Punkte jeder Person ein.")}</p>
          <div class="unit" id="sp"></div>
          <div class="unit"><h3>${T("Categories", "Kategorien")}</h3><div class="pg-pls" id="sc"></div><form class="pg-add" id="sca"><input type="text" maxlength="20" placeholder="${T("Add a category", "Kategorie hinzufügen")}"><button class="btn" type="submit">+</button></form></div>
          <div class="unit"><h3>${T("Time", "Zeit")}</h3><div id="ss"></div><button class="btn go big" id="sgo" style="margin-top:14px">${T("Roll a letter", "Buchstaben würfeln")}</button></div>
          <div class="unit"><h3>${T("Points", "Punkte")}</h3><p class="pg-sub" style="font-size:14px;line-height:1.5">${T("20: only you have an answer in that category · 10: your answer is unique · 5: someone else has the same · 0: nothing.", "20: nur du hast in der Kategorie etwas · 10: deine Antwort hat sonst keiner · 5: jemand hat dasselbe · 0: nichts.")}</p></div>`;
        PG.playersUI($("#sp"), {min: 1});
        const cats = () => { $("#sc").innerHTML = o.cats.map((c, i) => `<span class="pg-chip"><span>${h(c)}</span><button data-rc="${i}">×</button></span>`).join("");
          $$("[data-rc]", ctx.body).forEach(b => b.onclick = () => { if (o.cats.length <= 2) return; o.cats.splice(+b.dataset.rc, 1); PG.persist(); cats(); }); };
        cats();
        $("#sca").onsubmit = e => { e.preventDefault(); const i = e.target.querySelector("input"), v = i.value.trim(); if (!v) return; o.cats.push(v); i.value = ""; PG.persist(); cats(); };
        const ss = () => PG.choices($("#ss"), [[60, "1 min"], [90, "1:30"], [120, "2 min"], [180, "3 min"], [0, T("Until STOP", "Bis STOPP")]], o.secs, v => { o.secs = v; PG.persist(); ss(); }); ss();
        $("#sgo").onclick = () => { const P = PG.players(); if (!P.length) return toast(T("Add the players first.", "Trag zuerst die Spieler ein.")); G = {P, pts: P.map(() => 0), used: [], round: 0}; ctx.start(); roll(); };
      };
      const roll = () => {
        const left = LETTERS.filter(l => !G.used.includes(l)); if (!left.length) G.used = [];
        const L = PG.pick(left.length ? left : LETTERS); G.used.push(L); G.round++;
        ctx.body.innerHTML = `<div class="pg-stage"><div class="pg-who">${T(`Round ${G.round}`, `Runde ${G.round}`)}</div><div class="pg-big" style="min-height:0"><div class="pg-name" id="sl" style="font-size:120px;line-height:1">?</div></div>
          <div id="srest" style="width:100%;display:flex;flex-direction:column;align-items:center;gap:12px"></div></div>`;
        let k = 0; const el = $("#sl");
        const spin = PG.every(() => { el.textContent = PG.pick(LETTERS); Sound.play("Move", .3); if (++k > 14){ clearInterval(spin); el.textContent = L; el.classList.add("pg-pop"); Sound.play("Capture", .9); PG.vib(60); go(L); } }, 70 + k * 6);
      };
      const go = L => {
        $("#srest").innerHTML = `${o.secs ? `<div class="pg-timer" id="stm"></div>` : ""}<div class="pg-opt" style="justify-content:center">${o.cats.map(c => `<span class="pill">${h(c)}</span>`).join("")}</div>
          <button class="btn go big" id="sstop" style="max-width:340px;background:var(--bad);box-shadow:inset 0 -4px 0 rgba(0,0,0,.25)">STOPP!</button>`;
        let tm = o.secs ? PG.timer($("#stm"), o.secs, () => score(L)) : null;
        $("#sstop").onclick = () => { if (tm) tm.stop(); Sound.play("GenericNotify", .8); PG.vib([60, 40, 60]); score(L); };
      };
      const score = L => {
        PG.stopAll(); const add = G.P.map(() => 0);
        const draw = () => {
          ctx.body.innerHTML = `<div class="pg-stage"><div class="pg-who">${T(`Letter ${L} · points this round`, `Buchstabe ${L} · Punkte dieser Runde`)}</div>
            <div class="list" style="width:100%">${G.P.map((n, i) => `<div class="li" style="flex-wrap:wrap"><div class="grow t">${h(n)} <span class="muted" style="font-weight:600">${G.pts[i]}</span></div><b style="font:900 22px var(--display);min-width:46px;text-align:right;color:var(--go-hi)">+${add[i]}</b>
              <div class="row" style="gap:4px;width:100%;margin-top:6px">${[5, 10, 20].map(v => `<button class="btn sm" data-a="${i}" data-v="${v}" style="flex:1">+${v}</button>`).join("")}<button class="btn sm" data-a="${i}" data-v="0" style="flex:1">0</button></div></div>`).join("")}</div>
            <button class="btn go big" id="ssave" style="max-width:340px">${T("Save and next letter", "Speichern, nächster Buchstabe")}</button><button class="btn ghost" id="send">${T("Finish game", "Spiel beenden")}</button></div>`;
          $$("[data-a]", ctx.body).forEach(b => b.onclick = () => { const i = +b.dataset.a, v = +b.dataset.v; if (v === 0) add[i] = 0; else add[i] += v; draw(); });
          $("#ssave").onclick = () => { add.forEach((v, i) => { G.pts[i] += v; }); if (add.some(v => v)) Sound.xp && Sound.xp(); roll(); };
          $("#send").onclick = () => { add.forEach((v, i) => { G.pts[i] += v; }); final(); };
        };
        draw();
      };
      const final = () => { ctx.stop(); PG.cheer(3);
        ctx.body.innerHTML = `<div class="pg-stage pg-pop"><div class="pg-big" style="min-height:0"><span class="pg-moon">🏆</span><div class="pg-name" style="font-size:32px">${h(G.P[G.pts.indexOf(Math.max(...G.pts))])}</div><p class="muted" style="margin:0">${T(`wins after ${G.round} rounds`, `gewinnt nach ${G.round} Runden`)}</p></div>
          <div class="unit" style="width:100%;text-align:left">${PG.scoreList(G.P, G.pts)}</div><button class="btn go big" id="snew" style="max-width:340px">${T("New game", "Neues Spiel")}</button></div>`;
        $("#snew").onclick = setup; };
      setup();
    }});

  /* ---------- Vier gewinnt (Connect Four): white and black discs like the chess pieces, plop when they land ---------- */
  const W7 = 7, H6 = 6;
  const winLine = (b, p) => { const d = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let c = 0; c < W7; c++) for (let r = 0; r < H6; r++) for (const [dc, dr] of d){ const cells = [0, 1, 2, 3].map(k => [c + dc * k, r + dr * k]);
      if (cells.every(([x, y]) => x >= 0 && x < W7 && y >= 0 && y < H6 && b[x][y] === p)) return cells; } return null; };
  /* bot: negamax with alpha-beta, centre columns first */
  const ORDER = [3, 2, 4, 1, 5, 0, 6];
  const evalB = (b, p) => { let s = 0; const q = 3 - p;
    for (let r = 0; r < H6; r++) if (b[3][r] === p) s += 3; else if (b[3][r] === q) s -= 3;
    const win = (cells) => { let a = 0, o2 = 0; cells.forEach(([x, y]) => { if (b[x][y] === p) a++; else if (b[x][y] === q) o2++; });
      if (a && o2) return 0; if (a === 3) return 5; if (a === 2) return 2; if (o2 === 3) return -4; if (o2 === 2) return -2; return 0; };
    const d = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let c = 0; c < W7; c++) for (let r = 0; r < H6; r++) for (const [dc, dr] of d){ const ec = c + dc * 3, er = r + dr * 3; if (ec < 0 || ec >= W7 || er < 0 || er >= H6) continue; s += win([0, 1, 2, 3].map(k => [c + dc * k, r + dr * k])); }
    return s; };
  const drop = (b, c, p) => { const r = b[c].indexOf(0); if (r < 0) return -1; b[c][r] = p; return r; };
  const negamax = (b, depth, a, beta, p) => {
    const q = 3 - p; if (winLine(b, q)) return -100000 - depth;
    if (depth === 0 || b.every(col => col[H6 - 1])) return evalB(b, p);
    let best = -Infinity;
    for (const c of ORDER){ const r = b[c].indexOf(0); if (r < 0) continue; b[c][r] = p; const v = -negamax(b, depth - 1, -beta, -a, q); b[c][r] = 0; if (v > best) best = v; if (v > a) a = v; if (a >= beta) break; }
    return best; };
  const botMove = (b, p, depth) => { let best = -Infinity, pick = 3; const sc = [];
    for (const c of ORDER){ const r = b[c].indexOf(0); if (r < 0) continue; b[c][r] = p; const v = winLine(b, p) ? 1e6 : -negamax(b, depth - 1, -Infinity, Infinity, 3 - p); b[c][r] = 0; sc.push([c, v]); if (v > best){ best = v; pick = c; } }
    return pick; };

  PG.data.c4 = {winLine, botMove, drop, W7, H6};
  PG.add({id: "four", icon: "grid4", name: ["Connect Four", "Vier gewinnt"], sub: ["Four in a row wins. Against a friend or a bot.", "Vier in einer Reihe gewinnt. Gegen Freunde oder den Bot."], meta: ["1–2 players", "1–2 Spieler"],
    mount(ctx){
      const o = PG.opt("four", {vs: "bot", lvl: 4, a: "", b: ""}); let G = null;
      const setup = () => {
        ctx.stop(); const P = PG.players();
        ctx.body.innerHTML = `${ctx.title("Connect Four", "Vier gewinnt")}<p class="muted">${T("Drop your discs. Four in a row (across, down or diagonal) wins.", "Wirf deine Steine ein. Vier in einer Reihe (waagerecht, senkrecht oder diagonal) gewinnt.")}</p>
          <div class="unit"><h3>${T("Opponent", "Gegner")}</h3><div id="fv"></div><div id="fl" style="margin-top:6px"></div>
            <div class="grid2" style="margin-top:10px" id="fn"></div><button class="btn go big" id="fgo" style="margin-top:14px">${T("Play", "Spielen")}</button></div>`;
        const opts = () => {
          PG.choices($("#fv"), [["bot", T("Bot", "Bot")], ["two", T("Two players", "Zu zweit")]], o.vs, v => { o.vs = v; PG.persist(); opts(); });
          $("#fl").innerHTML = ""; if (o.vs === "bot") PG.choices($("#fl"), [[2, T("Easy", "Leicht")], [4, T("Medium", "Mittel")], [6, T("Hard", "Schwer")]], o.lvl, v => { o.lvl = v; PG.persist(); opts(); });
          $("#fn").innerHTML = o.vs === "two" ? `<label class="muted">⚪ ${T("White", "Weiß")}<input type="text" id="fa" maxlength="16" value="${h(o.a || P[0] || T("Player 1", "Spieler 1"))}" style="width:100%;margin-top:4px"></label><label class="muted">⚫ ${T("Black", "Schwarz")}<input type="text" id="fb" maxlength="16" value="${h(o.b || P[1] || T("Player 2", "Spieler 2"))}" style="width:100%;margin-top:4px"></label>` : "";
        };
        opts();
        $("#fgo").onclick = () => { if (o.vs === "two"){ o.a = $("#fa").value.trim() || "Weiß"; o.b = $("#fb").value.trim() || "Schwarz"; PG.persist(); }
          G = {b: Array.from({length: W7}, () => Array(H6).fill(0)), turn: 1, over: false, last: null, first: G ? 3 - G.first : 1}; G.turn = G.first; ctx.start(); render(); if (o.vs === "bot" && G.turn === 2) bot(); };
      };
      const names = () => o.vs === "bot" ? [T("You", "Du"), "Bot"] : [o.a, o.b];
      const render = (win) => {
        const [n1, n2] = names(), cur = G.turn === 1 ? n1 : n2;
        ctx.body.innerHTML = `<div class="pg-stage" style="gap:10px"><div class="row" style="justify-content:space-between;width:100%;max-width:440px"><span class="pill ${G.turn === 1 && !G.over ? "go" : ""}">⚪ ${h(n1)}</span><span class="pill ${G.turn === 2 && !G.over ? "go" : ""}">⚫ ${h(n2)}</span></div>
          <div class="pg-c4" id="c4">${Array.from({length: W7}, (_, c) => `<div class="pg-c4c" data-c="${c}">${Array.from({length: H6}, (_, r) => { const v = G.b[c][H6 - 1 - r], y = H6 - 1 - r; const isLast = G.last && G.last[0] === c && G.last[1] === y; const w = win && win.some(([x, yy]) => x === c && yy === y);
            return `<div class="pg-c4h">${v ? `<i class="pg-d d${v} ${isLast ? "drop" : ""} ${w ? "win" : ""}" style="--r:${r + 1}"></i>` : ""}</div>`; }).join("")}</div>`).join("")}</div>
          <p class="pg-hint" id="fmsg">${G.over ? "" : o.vs === "bot" && G.turn === 2 ? T("The bot is thinking…", "Der Bot überlegt…") : T(`${h(cur)} to move. Tap a column.`, `${h(cur)} ist dran. Tippe eine Spalte an.`)}</p>
          <div id="fend" style="width:100%;display:flex;flex-direction:column;align-items:center;gap:8px"></div></div>`;
        $$("[data-c]", ctx.body).forEach(col => col.onclick = () => { if (G.over || (o.vs === "bot" && G.turn === 2) || G.busy) return; play(+col.dataset.c); });
      };
      const play = c => {
        const r = drop(G.b, c, G.turn); if (r < 0) return; G.last = [c, r]; G.busy = true; render();
        PG.later(() => { Sound.play("Move", .7); G.busy = false;
          const w = winLine(G.b, G.turn); G.last = null;
          if (w || G.b.every(col => col[H6 - 1])) return end(w ? G.turn : 0, w);
          G.turn = 3 - G.turn; G.last = null; render(); if (o.vs === "bot" && G.turn === 2) bot(); }, 280 + (H6 - r) * 30);
      };
      const bot = () => PG.later(() => { if (G.over) return; play(botMove(G.b.map(x => x.slice()), 2, o.lvl)); }, 450);
      const end = (p, w) => {
        G.over = true; render(w); const [n1, n2] = names();
        const lost = o.vs === "bot" && p === 2;
        if (p && !lost){ PG.cheer(3); } else if (lost) Sound.play("Defeat", .8); else Sound.play("GenericNotify", .8);
        $("#fend").innerHTML = `<div class="pg-name" style="font-size:28px">${p ? (o.vs === "bot" ? (lost ? T("The bot wins", "Der Bot gewinnt") : T("You win!", "Du gewinnst!")) : T(`${h(p === 1 ? n1 : n2)} wins!`, `${h(p === 1 ? n1 : n2)} gewinnt!`)) : T("Draw", "Unentschieden")}</div>
          <button class="btn go big" id="fagain" style="max-width:340px">${T("Play again", "Nochmal")}</button><button class="btn ghost" id="fset">${T("Settings", "Einstellungen")}</button>`;
        $("#fagain").onclick = () => { G = {b: Array.from({length: W7}, () => Array(H6).fill(0)), over: false, last: null, first: 3 - G.first}; G.turn = G.first; ctx.start(); render(); if (o.vs === "bot" && G.turn === 2) bot(); };
        $("#fset").onclick = setup; ctx.stop();
      };
      setup();
    }});

  const css = `.pg-c4{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;background:var(--sq-d);padding:8px;border-radius:12px;width:min(440px,100%);box-shadow:inset 0 -6px 0 rgba(0,0,0,.2),0 8px 20px rgba(0,0,0,.35)}
.pg-c4c{display:grid;grid-template-rows:repeat(6,1fr);gap:4px;cursor:pointer;border-radius:8px;padding:2px 0}
.pg-c4c:hover{background:rgba(255,255,255,.08)}
.pg-c4h{aspect-ratio:1;border-radius:50%;background:var(--bg);box-shadow:inset 0 3px 6px rgba(0,0,0,.5);position:relative}
.pg-d{position:absolute;inset:4%;border-radius:50%;display:block}
.pg-d.d1{background:radial-gradient(circle at 35% 30%,#fff,#E8E6E1 60%,#C9C5BC);box-shadow:inset 0 -3px 0 rgba(0,0,0,.18)}
.pg-d.d2{background:radial-gradient(circle at 35% 30%,#7B746F,#5F5955 60%,#3E3936);box-shadow:inset 0 -3px 0 rgba(0,0,0,.3)}
.pg-d.drop{animation:pgDrop .32s cubic-bezier(.4,0,1,1)}
@keyframes pgDrop{0%{transform:translateY(calc(var(--r) * -112%))}80%{transform:translateY(0)}90%{transform:translateY(-6%)}100%{transform:translateY(0)}}
.pg-d.win{box-shadow:0 0 0 3px var(--warn),0 0 16px var(--warn)}`;
  const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
})();
