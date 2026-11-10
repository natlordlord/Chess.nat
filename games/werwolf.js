/* ===== Werwolf: the classic with a game master (Spielleiter).
   Everyone gets a secret role card (pass the phone round), then the phone goes to the game master, who doesn't play.
   The app is the game master's script: it says what to read out ("Das Dorf schläft ein…"), who to wake,
   remembers every choice, works out who died, handles lovers, the hunter's last shot and the witch's potions,
   and knows when a side has won. Roles that are already dead are still called at night, so nobody can tell. ===== */
(() => {
  const {T, h} = PG;
  const ROLES = {
    wolf:  {e: "🐺", n: ["Werewolf", "Werwolf"], team: "w", d: ["At night the werewolves wake up and choose a victim together. By day you act like a harmless villager.", "Nachts wachen die Werwölfe auf und wählen gemeinsam ein Opfer. Tagsüber tust du so, als wärst du ein harmloser Dorfbewohner."]},
    seer:  {e: "🔮", n: ["Seer", "Seherin"], team: "v", d: ["Every night you may look at one person's card. Use what you know, but don't give yourself away.", "Jede Nacht darfst du dir die Karte einer Person ansehen. Nutze dein Wissen, aber verrate dich nicht."]},
    witch: {e: "🧪", n: ["Witch", "Hexe"], team: "v", d: ["You have one healing potion (saves the werewolves' victim) and one poison (kills someone). Each only once per game.", "Du hast einen Heiltrank (rettet das Opfer der Werwölfe) und einen Gifttrank (tötet jemanden). Jeden nur einmal im Spiel."]},
    hunter:{e: "🏹", n: ["Hunter", "Jäger"], team: "v", d: ["When you die, you take someone with you with your last shot.", "Wenn du stirbst, nimmst du mit deinem letzten Schuss jemanden mit in den Tod."]},
    cupid: {e: "💘", n: ["Cupid", "Amor"], team: "v", d: ["In the first night you make two people fall in love. If one of them dies, the other dies of a broken heart.", "In der ersten Nacht lässt du zwei Menschen sich verlieben. Stirbt einer von beiden, stirbt der andere vor Kummer."]},
    guard: {e: "🛡️", n: ["Guardian", "Beschützer"], team: "v", d: ["Every night you protect one person from the werewolves. Never the same person two nights in a row.", "Jede Nacht beschützt du eine Person vor den Werwölfen. Nie zweimal hintereinander dieselbe."]},
    vill:  {e: "🧑‍🌾", n: ["Villager", "Dorfbewohner"], team: "v", d: ["No special power, but your vote counts. Find the werewolves and vote them out.", "Keine Spezialfähigkeit, aber deine Stimme zählt. Findet die Werwölfe und stimmt sie raus."]}
  };
  const RN = k => T(ROLES[k].n[0], ROLES[k].n[1]);
  const SPECIAL = ["seer", "witch", "hunter", "cupid", "guard"];
  const recommend = n => ({wolf: n >= 12 ? 3 : n >= 7 ? 2 : 1, seer: 1, witch: n >= 6 ? 1 : 0, hunter: n >= 7 ? 1 : 0, cupid: n >= 9 ? 1 : 0, guard: n >= 11 ? 1 : 0});
  const DEF = {roles: null, showDead: true, time: 3};
  /* sound: the village falls asleep (falling bells) and wakes up (rising marimba) */
  const nightSnd = () => { if (Sound.fx && Sound.fx()) [79, 76, 72, 67, 64].forEach((m, i) => Sound.note(m, i * .2, 1.4, .06, "bell")); };
  const daySnd = () => { if (Sound.fx && Sound.fx()) { [60, 64, 67, 72, 76].forEach((m, i) => Sound.note(m, i * .1, .7, .08, "marimba")); Sound.sparkle && Sound.sparkle(.5, 5, 0, .02); } };
  const deathSnd = () => { Sound.play("Capture", .8); PG.vib([60, 40, 120]); };

  PG.add({id: "werwolf", icon: "moon", name: ["Werewolf", "Werwolf"], tag: ["Classic", "Klassiker"], sub: ["The village sleeps. The wolves don't. With a full game-master script.", "Das Dorf schläft ein. Die Wölfe nicht. Mit komplettem Spielleiter-Skript."], meta: ["6–24 players · 30 min", "6–24 Spieler · 30 Min"],
    mount(ctx){
      const o = PG.opt("werwolf", DEF); let G = null;
      const body = () => ctx.body;
      const night = on => document.documentElement.classList.toggle("pg-night", !!on);

      /* ---------- setup ---------- */
      const setup = () => {
        ctx.stop(); night(false); const n = PG.players().length;
        if (!o.roles || o.rolesFor !== n){ o.roles = recommend(n); o.rolesFor = n; PG.persist(); }
        body().innerHTML = `${ctx.title("Werewolf", "Werwolf")}<p class="muted">${T("One person is the game master: they lead the game with this phone and don't play. Don't add them to the players.", "Eine Person ist Spielleiter: Sie führt mit diesem Handy durchs Spiel und spielt nicht mit. Trag sie nicht bei den Spielern ein.")}</p>
          <div class="unit" id="wp"></div>
          <div class="unit"><div class="row" style="justify-content:space-between"><h3>${T("Roles", "Rollen")}</h3><button class="btn ghost sm" id="wrec">${T("Recommended", "Empfohlen")}</button></div><div id="wr" class="list pg-roles" style="margin-top:6px"></div><p class="pg-sub" id="wsum"></p></div>
          <div class="unit"><h3>${T("Talk time per day", "Diskussionszeit pro Tag")}</h3><div id="wt"></div>
            <label class="chk"><input type="checkbox" id="wsd" ${o.showDead ? "checked" : ""}> ${T("Reveal the role of everyone who dies", "Rolle von Toten aufdecken")}</label>
            <button class="btn go big" id="wgo" style="margin-top:10px">${T("Deal the cards", "Karten verteilen")}</button></div>
          <div class="unit"><h3>${T("How it works", "So geht's")}</h3><p class="pg-sub" style="font-size:14px;line-height:1.5">${T("1. Everyone secretly looks at their card. 2. Night: everyone closes their eyes, the game master wakes the roles one by one and taps their choices. 3. Day: the village learns who died, discusses and votes someone out. The village wins when all werewolves are gone, the werewolves win when they're as many as the rest.", "1. Alle schauen sich heimlich ihre Karte an. 2. Nacht: Alle schließen die Augen, der Spielleiter weckt die Rollen nacheinander und tippt ihre Wahl ein. 3. Tag: Das Dorf erfährt, wer gestorben ist, diskutiert und stimmt jemanden raus. Das Dorf gewinnt, wenn alle Werwölfe tot sind. Die Werwölfe gewinnen, sobald sie so viele sind wie der Rest.")}</p></div>`;
        PG.playersUI($("#wp"), {min: 5, max: 24, onChange: () => { const m = PG.players().length; o.roles = recommend(m); o.rolesFor = m; PG.persist(); drawRoles(); }});
        const drawRoles = () => {
          const m = PG.players().length, R = o.roles, used = Object.values(R).reduce((a, b) => a + b, 0), vill = m - used;
          $("#wr").innerHTML = ["wolf", ...SPECIAL].map(k => `<div class="li"><span style="font-size:24px;width:30px;text-align:center">${ROLES[k].e}</span><div class="grow"><div class="t">${RN(k)}</div><div class="s">${h(T(ROLES[k].d[0], ROLES[k].d[1]).split(".")[0])}.</div></div>
              <div class="pg-step" style="width:auto"><button class="btn sm" data-dn="${k}">−</button><b>${R[k] || 0}</b><button class="btn sm" data-up="${k}">+</button></div></div>`).join("")
            + `<div class="li"><span style="font-size:24px;width:30px;text-align:center">${ROLES.vill.e}</span><div class="grow"><div class="t">${RN("vill")}</div><div class="s">${T("Everyone else", "Alle anderen")}</div></div><b style="font:900 22px var(--display);min-width:34px;text-align:center;margin-right:52px">${Math.max(0, vill)}</b></div>`;
          $("#wsum").innerHTML = m < 5 ? T("At least 5 players.", "Mindestens 5 Spieler.") : vill < 0 ? `<span style="color:#F07B68">${T("More roles than players.", "Mehr Rollen als Spieler.")}</span>` : R.wolf * 2 >= m ? `<span style="color:#F07B68">${T("Too many werewolves.", "Zu viele Werwölfe.")}</span>` : T(`${m} players: ${R.wolf} werewolf${R.wolf > 1 ? "s" : ""} against ${m - R.wolf}.`, `${m} Spieler: ${R.wolf} Werw${R.wolf > 1 ? "ölfe" : "olf"} gegen ${m - R.wolf}.`);
          $$("[data-up]", body()).forEach(b => b.onclick = () => { const k = b.dataset.up; if (k !== "wolf" && R[k] >= 1) return; R[k] = (R[k] || 0) + 1; PG.persist(); drawRoles(); });
          $$("[data-dn]", body()).forEach(b => b.onclick = () => { const k = b.dataset.dn; R[k] = Math.max(k === "wolf" ? 1 : 0, (R[k] || 0) - 1); PG.persist(); drawRoles(); });
        };
        drawRoles();
        PG.choices($("#wt"), [[0, T("No timer", "Ohne Uhr")], [2, "2 min"], [3, "3 min"], [5, "5 min"], [8, "8 min"]], o.time, v => { o.time = v; PG.persist(); setup(); });
        $("#wsd").onchange = e => { o.showDead = e.target.checked; PG.persist(); };
        $("#wrec").onclick = () => { o.roles = recommend(PG.players().length); PG.persist(); drawRoles(); };
        $("#wgo").onclick = () => { const m = PG.players().length, R = o.roles, used = Object.values(R).reduce((a, b) => a + b, 0);
          if (m < 5) return toast(T("At least 5 players.", "Mindestens 5 Spieler."));
          if (used > m) return toast(T("More roles than players.", "Mehr Rollen als Spieler."));
          if (R.wolf * 2 >= m) return toast(T("Too many werewolves.", "Zu viele Werwölfe."));
          deal(); };
      };

      /* ---------- deal ---------- */
      const deal = () => {
        const P = PG.players(), R = o.roles, bag = [];
        Object.entries(R).forEach(([k, c]) => { for (let i = 0; i < c; i++) bag.push(k); });
        while (bag.length < P.length) bag.push("vill");
        const roles = PG.shuffle(bag);
        G = {P: P.map((name, i) => ({name, role: roles[i], alive: true, lover: false})), night: 0, day: 0, heal: true, poison: true, lastProt: -1, log: [], over: false};
        ctx.start(); ctx.top();
        const has = k => G.P.some(p => p.role === k);
        const cards = G.P.map(p => { const r = ROLES[p.role];
          const mates = p.role === "wolf" ? G.P.filter(q => q.role === "wolf" && q !== p).map(q => q.name) : [];
          return {name: p.name, bad: p.role === "wolf", front: `<span class="lab">${T("Your role", "Deine Rolle")}</span><span class="em">${r.e}</span><span class="big">${RN(p.role)}</span><span class="sm">${h(T(r.d[0], r.d[1]))}</span>${mates.length ? `<span class="sm"><b>${T("Your pack", "Dein Rudel")}:</b> ${mates.map(h).join(", ")}</span>` : ""}`}; });
        PG.revealRound(body(), cards, () => {
          body().innerHTML = `<div class="pg-stage pg-pop"><div class="pg-who">${T("Everyone knows their role", "Alle kennen ihre Rolle")}</div><div class="pg-name">${T("Phone to the game master", "Handy zum Spielleiter")}</div>
            <p class="muted" style="margin:0">${T("From now on only the game master looks at the screen.", "Ab jetzt schaut nur noch der Spielleiter aufs Display.")}</p><button class="btn go big" id="wsl" style="max-width:340px">${T("I'm the game master", "Ich bin der Spielleiter")}</button></div>`;
          $("#wsl").onclick = overview;
        });
        G.has = has;
      };

      const alive = () => G.P.map((p, i) => i).filter(i => G.P[i].alive);
      const roleOf = k => G.P.findIndex(p => p.role === k);
      const roleAlive = k => G.P.some(p => p.role === k && p.alive);
      const nm = i => h(G.P[i].name);
      const deadTxt = i => o.showDead ? ` ${T("They were", "Rolle")}: <b>${ROLES[G.P[i].role].e} ${RN(G.P[i].role)}</b>.` : "";

      /* the game master's cheat sheet, folded away under every screen */
      const sheet = () => `<details class="unit" style="margin-top:16px;width:100%;text-align:left"><summary style="cursor:pointer;font-weight:800">${T("Game master overview", "Übersicht für den Spielleiter")}</summary>
        <div class="list" style="margin-top:8px">${G.P.map(p => `<div class="li" style="${p.alive ? "" : "opacity:.45"}"><span style="font-size:20px;width:28px;text-align:center">${ROLES[p.role].e}</span><div class="grow"><div class="t">${h(p.name)}${p.lover ? " 💘" : ""}${p.alive ? "" : " ✝"}</div><div class="s">${RN(p.role)}</div></div></div>`).join("")}</div>
        ${G.P.some(p => p.role === "witch") ? `<p class="pg-sub">${T("Witch", "Hexe")}: ${G.heal ? "🧪 " + T("heal", "Heiltrank") : ""} ${G.poison ? "☠️ " + T("poison", "Gifttrank") : ""}${!G.heal && !G.poison ? T("no potions left", "keine Tränke mehr") : ""}</p>` : ""}
        ${G.log.length ? `<p class="pg-sub" style="line-height:1.5">${G.log.map(h).join("<br>")}</p>` : ""}</details>`;

      /* one screen of the script: something to read out, maybe someone to tap */
      const scr = ({emo, say, small, pick, n = 1, okL, onOk, none, noneL, only, extra}) => {
        let sel = [];
        const draw = () => {
          const opts = only || alive();
          body().innerHTML = `<div class="pg-stage pg-pop">${emo ? `<div class="pg-moon">${emo}</div>` : ""}<p class="pg-say">${say}${small ? `<small>${small}</small>` : ""}</p>
            ${pick ? PG.playerGrid(G.P.map(p => p.name), {sel, off: G.P.map((p, i) => i).filter(i => !opts.includes(i)), mark: Object.fromEntries(G.P.map((p, i) => [i, p.alive ? "" : "✝"]))}) : ""}
            ${extra || ""}
            <button class="btn go big" id="wok" ${pick && sel.length < n ? "disabled" : ""} style="max-width:340px">${okL || T("Next", "Weiter")}</button>
            ${none ? `<button class="btn ghost" id="wno">${noneL || T("Nobody", "Niemand")}</button>` : ""}${sheet()}</div>`;
          $$("[data-p]", body()).forEach(b => b.onclick = () => { const i = +b.dataset.p; if (sel.includes(i)) sel = sel.filter(x => x !== i); else { sel.push(i); if (sel.length > n) sel.shift(); } draw(); });
          $("#wok").onclick = () => { if (pick && sel.length < n) return; onOk(n === 1 ? sel[0] : sel); };
          const no = $("#wno"); if (no) no.onclick = () => onOk(n === 1 ? -1 : []);
        };
        draw(); ctx.top();
      };
      /* run a list of screens one after the other */
      const seq = (steps, done) => { let i = 0; const go = () => { while (i < steps.length && !steps[i]) i++; if (i >= steps.length) return done(); const s = steps[i++]; s(go); }; go(); };

      const overview = () => {
        night(false);
        scr({emo: "📜", say: T("Game master", "Spielleiter"), small: T("Below you can always see who is what. Read out the big text, tap what the players choose. Ready?", "Unten siehst du jederzeit, wer was ist. Lies den großen Text vor und tippe ein, was die Spieler wählen. Bereit?"), okL: T("The first night begins", "Die erste Nacht beginnt"), onOk: () => runNight()});
      };

      /* ---------- night ---------- */
      const runNight = () => {
        G.night++; const first = G.night === 1; let prot = -1, victim = -1, healed = false, poisoned = -1;
        const wake = (k, alivePart, deadPart) => go => {
          if (!G.has(k)) return go();
          if (roleAlive(k)) return alivePart(go);
          /* dead roles are still called, so nobody can tell they're gone */
          scr({emo: ROLES[k].e, say: deadPart, small: T(`(The ${RN(k)} is dead. Wait a few seconds anyway, then go on.)`, `(${RN(k)} ist tot. Trotzdem ein paar Sekunden warten, dann weiter.)`), onOk: go});
        };
        night(true); nightSnd();
        seq([
          go => scr({emo: "🌙", say: T(`Night ${G.night}. The village falls asleep. Everyone closes their eyes.`, `Nacht ${G.night}. Das Dorf schläft ein. Alle schließen die Augen.`), small: T("Wait until all eyes are closed.", "Warte, bis alle die Augen zu haben."), onOk: go}),
          first && G.has("cupid") ? go => scr({emo: "💘", say: T("Cupid wakes up and points at two people who will fall in love.", "Amor erwacht und zeigt auf zwei Menschen, die sich ineinander verlieben."), pick: true, n: 2, okL: T("These two are in love", "Diese zwei sind verliebt"), onOk: sel => {
              sel.forEach(i => { G.P[i].lover = true; }); G.log.push(T(`Night 1: ${G.P[sel[0]].name} and ${G.P[sel[1]].name} fell in love.`, `Nacht 1: ${G.P[sel[0]].name} und ${G.P[sel[1]].name} sind verliebt.`)); Sound.heart && Sound.heart();
              scr({emo: "💞", say: T("Cupid goes back to sleep. I'm tapping the two lovers on the shoulder. Lovers, open your eyes and look at each other.", "Amor schläft wieder ein. Ich tippe die beiden Verliebten an der Schulter an. Verliebte, öffnet die Augen und schaut euch an."), small: T(`Tap ${G.P[sel[0]].name} and ${G.P[sel[1]].name}. If one of them dies, the other dies too.`, `Tippe ${G.P[sel[0]].name} und ${G.P[sel[1]].name} an. Stirbt einer, stirbt auch der andere.`), onOk: () =>
                scr({emo: "💤", say: T("The lovers close their eyes and fall asleep again.", "Die Verliebten schließen die Augen und schlafen wieder ein."), onOk: go})}); }}) : null,
          wake("guard", go => scr({emo: "🛡️", say: T("The guardian wakes up. Who do you protect tonight?", "Der Beschützer erwacht. Wen beschützt du heute Nacht?"), small: G.lastProt >= 0 ? T(`Not ${G.P[G.lastProt].name} again (last night).`, `Nicht nochmal ${G.P[G.lastProt].name} (letzte Nacht).`) : "", pick: true, only: alive().filter(i => i !== G.lastProt), okL: T("Protect", "Beschützen"), onOk: i => { prot = i; G.lastProt = i;
              scr({emo: "💤", say: T("The guardian goes back to sleep.", "Der Beschützer schläft wieder ein."), onOk: go}); }}),
            T("The guardian wakes up and chooses someone to protect.", "Der Beschützer erwacht und wählt, wen er beschützt.")),
          wake("seer", go => scr({emo: "🔮", say: T("The seer wakes up. Whose card do you want to see?", "Die Seherin erwacht. Wessen Karte willst du sehen?"), pick: true, only: alive().filter(i => G.P[i].role !== "seer"), okL: T("Show the card", "Karte zeigen"), onOk: i => {
              const p = G.P[i], w = p.role === "wolf"; G.log.push(T(`Night ${G.night}: the seer looked at ${p.name} (${RN(p.role)}).`, `Nacht ${G.night}: Die Seherin sah ${p.name} (${RN(p.role)}).`));
              scr({emo: ROLES[p.role].e, say: `${h(p.name)}: ${RN(p.role)}`, small: T("Show the seer the screen, without saying anything.", "Zeig der Seherin das Display, ohne etwas zu sagen."), extra: `<div class="pg-big" style="min-height:0;padding:16px;background:${w ? "#E2523E" : "#F4F2EE"};color:${w ? "#fff" : "#262421"}"><span class="q">${w ? T("Werewolf", "Werwolf") + " 🐺" : T("Not a werewolf", "Kein Werwolf")}</span></div>`, okL: T("Seen", "Gesehen"), onOk: () =>
                scr({emo: "💤", say: T("The seer goes back to sleep.", "Die Seherin schläft wieder ein."), onOk: go})}); }}),
            T("The seer wakes up and looks at someone's card.", "Die Seherin erwacht und schaut sich eine Karte an.")),
          go => scr({emo: "🐺", say: first ? T("The werewolves wake up and see each other. Agree silently on a victim.", "Die Werwölfe erwachen und erkennen einander. Einigt euch leise auf ein Opfer.") : T("The werewolves wake up. Who is your victim tonight?", "Die Werwölfe erwachen. Wer ist heute Nacht euer Opfer?"), small: T("Wolves point. Tap the person they agree on.", "Die Wölfe zeigen. Tippe die Person an, auf die sie sich einigen."), pick: true, only: alive().filter(i => G.P[i].role !== "wolf"), okL: T("This is the victim", "Das ist das Opfer"), onOk: i => { victim = i; Sound.play("Capture", .5);
              scr({emo: "💤", say: T("The werewolves go back to sleep.", "Die Werwölfe schlafen wieder ein."), onOk: go}); }}),
          wake("witch", go => {
              const potions = () => {
                if (!G.poison) return go();
                scr({emo: "☠️", say: T("Do you want to use your poison on someone?", "Willst du deinen Gifttrank bei jemandem einsetzen?"), pick: true, only: alive().filter(i => G.P[i].role !== "witch"), none: true, noneL: T("No poison", "Kein Gift"), okL: T("Poison", "Vergiften"), onOk: i => { if (i >= 0){ poisoned = i; G.poison = false; } scr({emo: "💤", say: T("The witch goes back to sleep.", "Die Hexe schläft wieder ein."), onOk: go}); }});
              };
              const v = victim >= 0 ? nm(victim) : "—";
              if (G.heal && victim >= 0) scr({emo: "🧪", say: T(`The witch wakes up. I'm showing you tonight's victim: ${v}. Do you want to save them with your healing potion?`, `Die Hexe erwacht. Ich zeige dir das Opfer dieser Nacht: ${v}. Willst du es mit deinem Heiltrank retten?`), small: T("Point at the victim so the witch sees who it is.", "Zeig auf das Opfer, damit die Hexe sieht, wer es ist."), okL: T("Yes, heal", "Ja, heilen"), none: true, noneL: T("No", "Nein"), onOk: i => { if (i !== -1){ healed = true; G.heal = false; } potions(); }});
              else scr({emo: "🧪", say: T(`The witch wakes up. Tonight's victim is ${v}.`, `Die Hexe erwacht. Das Opfer dieser Nacht ist ${v}.`), small: T("The healing potion is used up.", "Der Heiltrank ist schon verbraucht."), onOk: potions});
            }, T("The witch wakes up and decides about her potions.", "Die Hexe erwacht und entscheidet über ihre Tränke."))
        ], () => {
          /* morning: work out who died */
          const dead = [];
          if (victim >= 0 && victim !== prot && !healed) dead.push(victim);
          if (poisoned >= 0 && !dead.includes(poisoned)) dead.push(poisoned);
          G.log.push(T(`Night ${G.night}: wolves chose ${victim >= 0 ? G.P[victim].name : "nobody"}${victim === prot && victim >= 0 ? " (protected)" : ""}${healed ? " (healed)" : ""}${poisoned >= 0 ? `, poisoned: ${G.P[poisoned].name}` : ""}.`,
            `Nacht ${G.night}: Wölfe wählten ${victim >= 0 ? G.P[victim].name : "niemanden"}${victim === prot && victim >= 0 ? " (beschützt)" : ""}${healed ? " (geheilt)" : ""}${poisoned >= 0 ? `, vergiftet: ${G.P[poisoned].name}` : ""}.`));
          night(false); daySnd();
          scr({emo: "🌅", say: T("The sun rises. The village wakes up. Everyone opens their eyes.", "Die Sonne geht auf. Das Dorf erwacht. Alle öffnen die Augen."), onOk: () => kill(dead, "night", () => day())});
        });
      };

      /* deaths, one after the other: lovers follow, the hunter shoots */
      const kill = (list, why, done) => {
        const q = list.map(i => ({i, why})); const out = [];
        const next = () => {
          if (!q.length){
            if (!out.length && why === "night") return scr({emo: "🍀", say: T("Nobody died last night!", "Heute Nacht ist niemand gestorben!"), onOk: () => win() || done()});
            return win() || done();
          }
          const {i, why: w} = q.shift(); if (!G.P[i].alive) return next();
          G.P[i].alive = false; out.push(i); deathSnd();
          const p = G.P[i]; const lov = p.lover ? G.P.findIndex((x, j) => x.lover && j !== i && x.alive) : -1;
          if (lov >= 0) q.unshift({i: lov, why: "lover"});
          const say = w === "lover" ? T(`${nm(i)} dies of a broken heart.`, `${nm(i)} stirbt vor Kummer.`)
            : w === "shot" ? T(`The hunter takes ${nm(i)} with him.`, `Der Jäger nimmt ${nm(i)} mit in den Tod.`)
            : w === "vote" ? T(`The village sends ${nm(i)} away.`, `Das Dorf schickt ${nm(i)} fort.`)
            : out.length === 1 ? T(`Last night ${nm(i)} died.`, `Heute Nacht ist ${nm(i)} gestorben.`) : T(`${nm(i)} also died last night.`, `Auch ${nm(i)} ist heute Nacht gestorben.`);
          G.log.push(T(`${p.name} died (${RN(p.role)}).`, `${p.name} ist gestorben (${RN(p.role)}).`));
          scr({emo: "✝️", say: say + (o.showDead ? `<small>${deadTxt(i)}</small>` : ""), onOk: () => {
            if (p.role === "hunter") return scr({emo: "🏹", say: T(`${nm(i)} was the hunter and fires one last shot. Who do you take with you?`, `${nm(i)} war der Jäger und gibt einen letzten Schuss ab. Wen nimmst du mit?`), pick: true, okL: T("Shoot", "Schießen"), onOk: t => { Sound.play("Capture", 1); q.push({i: t, why: "shot"}); next(); }});
            next(); }});
        };
        next();
      };

      /* ---------- win ---------- */
      const win = () => {
        const A = alive(), W = A.filter(i => G.P[i].role === "wolf").length, V = A.length - W;
        const lovers = A.filter(i => G.P[i].lover);
        let who = null;
        if (A.length === 2 && lovers.length === 2 && G.P[lovers[0]].role !== G.P[lovers[1]].role && (G.P[lovers[0]].role === "wolf" || G.P[lovers[1]].role === "wolf")) who = "love";
        else if (W === 0) who = "village";
        else if (W >= V) who = "wolves";
        if (!who) return false;
        G.over = true; ctx.stop(); night(false);
        if (who === "wolves") { Sound.play("Defeat", .7); setTimeout(() => Sound.play("Victory", .6), 700); } else PG.cheer(3);
        const title = who === "village" ? T("The village wins!", "Das Dorf gewinnt!") : who === "wolves" ? T("The werewolves win!", "Die Werwölfe gewinnen!") : T("The lovers win!", "Die Verliebten gewinnen!");
        body().innerHTML = `<div class="pg-stage pg-pop"><div class="pg-big"><span class="pg-moon">${who === "village" ? "🏡" : who === "wolves" ? "🐺" : "💘"}</span><div class="pg-name" style="font-size:32px">${title}</div><p class="muted" style="margin:0">${T(`After ${G.night} night${G.night > 1 ? "s" : ""}.`, `Nach ${G.night} Nacht${G.night > 1 ? "en" : ""}.`)}</p></div>
          <div class="unit" style="width:100%;text-align:left"><h3>${T("Who was who", "Wer war wer")}</h3><div class="list" style="margin-top:6px">${G.P.map(p => `<div class="li" style="${p.alive ? "" : "opacity:.55"}"><span style="font-size:22px;width:30px;text-align:center">${ROLES[p.role].e}</span><div class="grow"><div class="t">${h(p.name)}${p.lover ? " 💘" : ""}</div><div class="s">${RN(p.role)}${p.alive ? "" : " · ✝"}</div></div></div>`).join("")}</div></div>
          <button class="btn go big" id="wagain" style="max-width:340px">${T("Play again", "Nochmal spielen")}</button><button class="btn ghost" id="wset">${T("Players & roles", "Spieler & Rollen")}</button></div>`;
        $("#wagain").onclick = deal; $("#wset").onclick = setup;
        return true;
      };

      /* ---------- day ---------- */
      const day = () => {
        G.day++; const t = o.time;
        body().innerHTML = `<div class="pg-stage pg-pop"><div class="pg-moon">☀️</div><p class="pg-say">${T(`Day ${G.day}. Discuss: who could be a werewolf?`, `Tag ${G.day}. Diskutiert: Wer könnte ein Werwolf sein?`)}<small>${T(`${alive().length} alive: `, `${alive().length} leben noch: `)}${alive().map(nm).join(", ")}</small></p>
          ${t ? `<div class="pg-timer" id="wtm"></div><div class="row" style="justify-content:center"><button class="btn sm" id="wps">${T("Pause", "Pause")}</button><button class="btn sm" id="wad">+1 min</button></div>` : ""}
          <button class="btn go big" id="wv" style="max-width:340px">${T("Vote", "Abstimmen")}</button>${sheet()}</div>`;
        if (t){ const tm = PG.timer($("#wtm"), t * 60, () => toast(T("Time's up! Vote now.", "Zeit ist um! Jetzt abstimmen.")));
          $("#wps").onclick = e => { if (tm.paused){ tm.resume(); e.target.textContent = T("Pause", "Pause"); } else { tm.pause(); e.target.textContent = T("Go on", "Weiter"); } };
          $("#wad").onclick = () => tm.add(60); }
        $("#wv").onclick = () => { PG.stopAll(); vote(); };
        ctx.top();
      };
      const vote = () => scr({emo: "🗳️", say: T("The village votes. On three, everyone points at who should leave the village.", "Das Dorf stimmt ab. Auf drei zeigen alle auf die Person, die das Dorf verlassen soll."), small: T("Tap who got the most votes. On a tie, vote again between them or nobody leaves.", "Tippe an, wer die meisten Stimmen hat. Bei Gleichstand stimmt nochmal zwischen ihnen ab oder niemand geht."), pick: true, okL: T("Send away", "Fortschicken"), none: true, noneL: T("Tie: nobody leaves", "Gleichstand: niemand geht"), onOk: i => {
          if (i < 0){ G.log.push(T(`Day ${G.day}: nobody was voted out.`, `Tag ${G.day}: niemand wurde rausgewählt.`)); return scr({emo: "🤝", say: T("Nobody leaves the village today.", "Heute verlässt niemand das Dorf."), okL: T("Night falls", "Die Nacht bricht herein"), onOk: runNight}); }
          kill([i], "vote", () => scr({emo: "🌆", say: T("Evening comes over the village.", "Der Abend legt sich über das Dorf."), okL: T("Night falls", "Die Nacht bricht herein"), onOk: runNight})); }});

      setup();
    }});
})();
