/* ===== Card games: Truth or Dare, Never have I ever, Who's most likely to.
   Three levels each (chill, party, 18+), a deck that doesn't repeat until it's empty. Cards are German.
   {p} in a card becomes another player's name. ===== */
(() => {
  const {T, h} = PG;
  const split = s => s.split("\n").map(x => x.trim()).filter(Boolean);
  const LV = [["chill", ["Chill", "Chill"]], ["party", ["Party", "Party"]], ["spicy", ["18+", "18+"]]];

  const TRUTH = {
    chill: split(`Was war dein peinlichster Moment in der Schule?
Welche Serie hast du heimlich komplett durchgesuchtet?
Was ist das Kindischste, das du immer noch machst?
Wovor hast du richtig Angst?
Welchen Promi findest du heimlich gut?
Was war das schlechteste Geschenk, das du je bekommen hast?
Was ist dein komischstes Talent?
Was würdest du mit einer Million Euro als Erstes machen?
Wann hast du zuletzt geweint und warum?
Was ist die größte Lüge, die du deinen Eltern erzählt hast?
Welches Essen hasst du, sagst es aber nie?
Wen hier würdest du auf eine einsame Insel mitnehmen?
Was ist dein schlimmster Ohrwurm?
Was googelst du, wenn niemand zuschaut?
Was war dein erster Berufswunsch?
Welche App nutzt du peinlich oft?
Was ist dein Guilty Pleasure?
Mit welchem Tier vergleichst du dich und warum?
Was war das Dümmste, wofür du je Geld ausgegeben hast?
Wer hier kennt dich am besten?`),
    party: split(`Wen hier würdest du am ehesten daten?
Was ist das Verrückteste, das du betrunken gemacht hast?
Welche Nachricht in deinem Handy darf hier niemand sehen?
Wen hast du zuletzt gestalkt?
Was denkst du wirklich über {p}?
Wann hast du zuletzt jemanden angelogen, der hier sitzt?
Was ist dein größtes Red Flag?
Hast du schon mal jemanden geghostet? Wen?
Was war dein schlimmstes Date?
Wer war dein erster Crush?
Welche Person aus deinen Kontakten würdest du sofort löschen?
Was ist das Peinlichste in deinem Browserverlauf?
Mit wem hier würdest du nie zusammenwohnen?
Was hast du zuletzt heimlich gemacht?
Welchen Fehler würdest du sofort rückgängig machen?
Wer hier hat den besten Style und wer den schlechtesten?
Was war dein peinlichster Moment auf einer Party?
Hast du schon mal ein Geschenk weiterverschenkt?
Welches Geheimnis hast du am längsten für dich behalten?
Wem hier vertraust du am wenigsten?`),
    spicy: split(`Wer war dein letzter Kuss?
Was findest du an {p} am attraktivsten?
Was war dein peinlichstes Erlebnis beim Flirten?
Hattest du schon mal einen Crush auf jemanden hier?
Was ist dein absolutes Turn-off?
Was war die frechste Nachricht, die du je verschickt hast?
Wo war der ungewöhnlichste Ort, an dem du jemanden geküsst hast?
Was ist das Mutigste, das du für einen Crush gemacht hast?
Was würdest du an deinem Ex nie vermissen?
Was ist dein heimlicher Typ?
Welches Kompliment hörst du am liebsten?
Mit welchem Promi hättest du gern ein Date?
Wen hier würdest du küssen, wenn du müsstest?
Was ist das Spontanste, das du je für die Liebe getan hast?
Was war deine längste Funkstille nach einem Date?`)
  };
  const DARE = {
    chill: split(`Mach 10 Hampelmänner.
Sprich die nächsten 2 Runden mit Akzent.
Imitiere {p}, bis jemand errät, wen du spielst.
Sing den Refrain deines Lieblingssongs.
Erzähl einen Witz. Wenn keiner lacht, nochmal.
Tanz 20 Sekunden ohne Musik.
Mach dein bestes Tiergeräusch.
Sag das Alphabet rückwärts, so weit du kommst.
Halte 30 Sekunden eine Planke.
Mach ein Selfie mit der dümmsten Grimasse.
Sprich bis zu deinem nächsten Zug nur in Reimen.
Balanciere etwas auf deinem Kopf, bis du wieder dran bist.
Gib {p} ein ehrliches Kompliment.
Mach eine Werbung für das Glas vor dir.
Lass {p} deine Frisur verändern.
Rede wie ein Nachrichtensprecher über dein Wochenende.
Versuch, deinen Ellbogen zu lecken.
Lauf einmal wie ein Model durch den Raum.
Mach 5 Liegestütze.
Nenn 10 Tiere in 15 Sekunden.`),
    party: split(`Zeig das letzte Foto in deiner Galerie.
Lass {p} eine Story auf deinem Handy posten.
Ruf jemanden an und sing Happy Birthday.
Schick deiner Mutter eine Sprachnachricht: "Ich hab dich lieb."
Lies deine letzte WhatsApp-Nachricht laut vor.
Lass {p} deinen Status für eine Stunde ändern.
Tausch ein Kleidungsstück mit {p}.
Schreib deinem Crush "Hey 👀".
Lass die anderen dein Handy 30 Sekunden durchsuchen.
Imitiere jemanden hier, die anderen raten.
Mach ein Duett mit {p}, Lied darf {p} aussuchen.
Trink einen Schluck ohne Hände.
Lass {p} dir eine Nachricht an jemanden diktieren.
Sprich ab jetzt jeden mit "Eure Majestät" an.
Rapp 20 Sekunden über {p}.
Zeig deine letzte Suche bei Google.
Lass dir von {p} ein Bartmuster auf die Hand malen.
Sag {p}, was du wirklich über sie oder ihn denkst.
Poste "Ich liebe Schach ♟️" in deine Story.
Mach einen Heiratsantrag an {p}.`),
    spicy: split(`Gib {p} eine 10-Sekunden-Massage.
Flüster {p} etwas ins Ohr, das rot werden lässt.
Zeig deinen letzten Chat mit einem Crush.
Schreib deinem Ex ein Emoji deiner Wahl.
Mach {p} das charmanteste Kompliment, das du kennst.
Lass {p} dir ein Pickup-Line ausdenken und sag sie jemandem hier.
Tanz 30 Sekunden verführerisch.
Setz dich bis zu deinem nächsten Zug neben {p}.
Halt 20 Sekunden Augenkontakt mit {p}, ohne zu lachen.
Lies den flirtigsten Satz aus deinem Handy vor.
Gib {p} einen Kuss auf die Wange.
Erzähl von deinem besten Kuss, mit Details.
Lass {p} entscheiden, wem du eine Nachricht mit ❤️ schickst.
Mach deinen besten Flirtblick in Richtung {p}.
Imitiere, wie du jemanden anflirtest.`)
  };
  const NEVER = {
    chill: split(`Ich hab noch nie eine ganze Serie an einem Tag geschaut.
Ich hab noch nie meinen Schlüssel im Kühlschrank gefunden.
Ich hab noch nie einen Kinofilm verschlafen.
Ich hab noch nie Essen vom Boden gegessen.
Ich hab noch nie so getan, als würde ich telefonieren.
Ich hab noch nie meinen eigenen Geburtstag vergessen.
Ich hab noch nie ein Instrument gespielt.
Ich hab noch nie einen Knochen gebrochen.
Ich hab noch nie im Ausland gelebt.
Ich hab noch nie einen Promi getroffen.
Ich hab noch nie eine Pflanze sterben lassen.
Ich hab noch nie beim Schach geschummelt.
Ich hab noch nie mit dem Handy in der Hand das Handy gesucht.
Ich hab noch nie eine Prüfung komplett verschlafen.
Ich hab noch nie im Freibad vom Zehner gesprungen.
Ich hab noch nie eine Nacht durchgemacht.
Ich hab noch nie bei einem Film geweint.
Ich hab noch nie jemandem das Ende einer Serie gespoilert.
Ich hab noch nie Sushi gegessen.
Ich hab noch nie mit mir selbst geredet.
Ich hab noch nie den falschen Namen gerufen.
Ich hab noch nie gegen einen Bot im Schach verloren.
Ich hab noch nie Karaoke gesungen.
Ich hab noch nie ein Tattoo gewollt.`),
    party: split(`Ich hab noch nie jemanden geghostet.
Ich hab noch nie eine Nachricht an die falsche Person geschickt.
Ich hab noch nie auf einer Party eingeschlafen.
Ich hab noch nie gelogen, um früher zu gehen.
Ich hab noch nie das Handy von jemandem durchsucht.
Ich hab noch nie meinen Ex gestalkt.
Ich hab noch nie einen Filmriss gehabt.
Ich hab noch nie Geld von meinen Eltern geklaut.
Ich hab noch nie blau gemacht.
Ich hab noch nie in einem Club getanzt, bis das Licht anging.
Ich hab noch nie einen Strafzettel bekommen.
Ich hab noch nie heimlich die Pizza von jemand anderem gegessen.
Ich hab noch nie eine Sprachnachricht über 5 Minuten verschickt.
Ich hab noch nie jemandem aus dieser Runde etwas verschwiegen.
Ich hab noch nie auf einer Hochzeit getanzt, als würde niemand zuschauen.
Ich hab noch nie in der Öffentlichkeit gekotzt.
Ich hab noch nie jemanden aus Versehen geliked beim Stalken.
Ich hab noch nie eine Fake-Ausrede erfunden, um nicht zu kommen.
Ich hab noch nie in einem fremden Bett aufgewacht.
Ich hab noch nie ein Date abgesagt, weil ich zu faul war.
Ich hab noch nie einen Shot verweigert.
Ich hab noch nie nackt gebadet.
Ich hab noch nie jemanden aus dieser Runde gegoogelt.
Ich hab noch nie Streit mit dem Taxifahrer gehabt.`),
    spicy: split(`Ich hab noch nie jemanden beim ersten Date geküsst.
Ich hab noch nie in jemanden aus dieser Runde verknallt gewesen.
Ich hab noch nie eine Dating-App benutzt.
Ich hab noch nie mit jemandem geflirtet, nur um etwas umsonst zu bekommen.
Ich hab noch nie zwei Leute gleichzeitig gedatet.
Ich hab noch nie meinen Ex nachts angeschrieben.
Ich hab noch nie jemanden geküsst, dessen Namen ich nicht wusste.
Ich hab noch nie eine Fernbeziehung gehabt.
Ich hab noch nie Flaschendrehen gespielt.
Ich hab noch nie auf einer Party rumgeknutscht.
Ich hab noch nie jemanden um Mitternacht geküsst.
Ich hab noch nie auf ein Date gewartet, das nie kam.
Ich hab noch nie einen Liebesbrief geschrieben.
Ich hab noch nie ein Date mit Freunden geteilt, während es lief.
Ich hab noch nie jemandem einen Korb gegeben, den ich eigentlich mochte.
Ich hab noch nie an jemand anderen gedacht, während ich jemanden geküsst habe.`)
  };
  const LIKELY = {
    chill: split(`Wer würde eher bei einem Horrorfilm einschlafen?
Wer würde eher eine Katze statt eines Hundes adoptieren?
Wer würde eher eine Woche ohne Handy überleben?
Wer würde eher Schachweltmeister werden?
Wer würde eher im Supermarkt verloren gehen?
Wer würde eher eine Million im Lotto gewinnen und alles verlieren?
Wer würde eher in einer Reality-Show mitmachen?
Wer würde eher seinen Flug verpassen?
Wer würde eher mit Tieren reden?
Wer würde eher berühmt werden?
Wer würde eher eine Pflanze vergessen zu gießen?
Wer würde eher 12 Stunden am Stück schlafen?
Wer würde eher zu spät zur eigenen Hochzeit kommen?
Wer würde eher in einer Zombie-Apokalypse als Erstes sterben?
Wer würde eher einen Marathon laufen?
Wer würde eher sein Essen fotografieren?
Wer würde eher ins Weltall fliegen?
Wer würde eher Pizza zum Frühstück essen?
Wer würde eher einen Streit mit einem Navi anfangen?
Wer würde eher eine Sekte gründen?`),
    party: split(`Wer würde eher auf einer Party zuerst nach Hause gehen?
Wer würde eher seinen Ex zurücknehmen?
Wer würde eher morgens neben einem Fremden aufwachen?
Wer würde eher auf der Tanzfläche eskalieren?
Wer würde eher eine peinliche Story posten und gleich wieder löschen?
Wer würde eher im Club einschlafen?
Wer würde eher heimlich die Nachrichten des Partners lesen?
Wer würde eher eine Prügelei anfangen?
Wer würde eher nach einer Party im falschen Bus landen?
Wer würde eher einen Kater mit noch mehr Alkohol bekämpfen?
Wer würde eher auf einer Hochzeit eine Rede halten, die eskaliert?
Wer würde eher seinen Chef anschreien?
Wer würde eher im Urlaub eine Affäre haben?
Wer würde eher eine Nacht in der Ausnüchterung verbringen?
Wer würde eher mit einem Promi rumknutschen?
Wer würde eher einen Streit über Schachregeln anfangen?
Wer würde eher in Las Vegas spontan heiraten?
Wer würde eher eine Nachricht an alle statt an eine Person schicken?
Wer würde eher Lügen erzählen, um gut dazustehen?
Wer würde eher beim Flaschendrehen schummeln?`),
    spicy: split(`Wer würde eher beim ersten Date küssen?
Wer würde eher eine Dating-App-Sucht haben?
Wer würde eher seinen Crush direkt ansprechen?
Wer würde eher eine Beziehung per Nachricht beenden?
Wer würde eher mit zwei Leuten gleichzeitig flirten?
Wer würde eher eine Fernbeziehung führen?
Wer würde eher seinem Ex nachts schreiben?
Wer würde eher jemanden aus dieser Runde daten?
Wer würde eher eine heimliche Beziehung haben?
Wer würde eher bei Tinder nach links und rechts gleichzeitig wischen?
Wer würde eher Liebesbriefe schreiben?
Wer würde eher auf einen Catfish reinfallen?
Wer würde eher jemanden auf einer Hochzeit abschleppen?
Wer würde eher zuerst heiraten?
Wer würde eher einen Kuss in der Öffentlichkeit übertreiben?`)
  };

  /* deck for the chosen levels, drawn without repeats */
  const deckDraw = (key, src, lv) => { const list = lv.flatMap(l => src[l].map(t => [l, t])); return PG.draw(key + ":" + lv.join(","), list); };
  const fill = (t, P, me) => { if (!/\{p\}/.test(t)) return h(t); const others = P.filter(n => n !== me); const o2 = others.length ? PG.pick(others) : T("someone", "jemand"); return h(t).replace(/\{p\}/g, `<b style="color:var(--go-hi)">${h(o2)}</b>`); };
  const lvUI = (box, o) => { box.innerHTML = `<div class="pg-opt">${LV.map(([k, n]) => `<button class="btn sm ${o.lv.includes(k) ? "go" : ""}" data-lv="${k}">${T(n[0], n[1])}</button>`).join("")}</div>`;
    $$("[data-lv]", box).forEach(b => b.onclick = () => { const k = b.dataset.lv; o.lv = o.lv.includes(k) ? o.lv.filter(x => x !== k) : o.lv.concat(k); if (!o.lv.length) o.lv = [k]; PG.persist(); lvUI(box, o); }); };
  const lvTag = l => ({chill: "Chill", party: "Party", spicy: "18+"})[l];

  /* ---- Truth or Dare ---- */
  PG.add({id: "tod", icon: "bottle", name: ["Truth or Dare", "Wahrheit oder Pflicht"], tag: ["Party", "Party"], sub: ["Tell the truth or do the dare. Spin the bottle if you like.", "Sag die Wahrheit oder zieh die Aufgabe durch. Mit Flaschendrehen."], meta: ["2–20 players", "2–20 Spieler"],
    mount(ctx){
      const o = PG.opt("tod", {lv: ["chill", "party"], order: "turn"}); let P = [], turn = 0, pts = {};
      const setup = () => {
        ctx.stop();
        ctx.body.innerHTML = `${ctx.title("Truth or Dare", "Wahrheit oder Pflicht")}<p class="muted">${T("Whoever's turn it is picks truth or dare. Chicken out and you collect a minus point.", "Wer dran ist, wählt Wahrheit oder Pflicht. Wer kneift, kassiert einen Minuspunkt.")}</p>
          <div class="unit" id="tp"></div><div class="unit"><h3>${T("Level", "Stufe")}</h3><div id="tl"></div></div>
          <div class="unit"><h3>${T("Who's next", "Wer ist dran")}</h3><div id="to"></div><button class="btn go big" id="tgo" style="margin-top:14px">${T("Start", "Los geht's")}</button></div>`;
        PG.playersUI($("#tp"), {min: 2}); lvUI($("#tl"), o);
        const ord = () => PG.choices($("#to"), [["turn", T("In order", "Reihum")], ["bottle", T("Spin the bottle", "Flasche drehen")]], o.order, v => { o.order = v; PG.persist(); ord(); }); ord();
        $("#tgo").onclick = () => { P = PG.players(); if (P.length < 2) return toast(T("At least 2 players.", "Mindestens 2 Spieler.")); turn = 0; pts = {}; ctx.start(); next(); };
      };
      const next = () => { if (o.order === "bottle") spin(); else ask(P[turn++ % P.length]); };
      /* the bottle spins on the board's colours and stops at someone */
      const spin = () => {
        const n = P.length, k = Math.floor(Math.random() * n), deg = 360 * (4 + Math.random() * 2) + k * 360 / n;
        ctx.body.innerHTML = `<div class="pg-stage"><div style="position:relative;width:min(320px,82vw);aspect-ratio:1">
            ${P.map((nm, i) => { const a = (i * 360 / n - 90) * Math.PI / 180; return `<span style="position:absolute;left:${50 + 44 * Math.cos(a)}%;top:${50 + 44 * Math.sin(a)}%;transform:translate(-50%,-50%);font:800 14px var(--body);background:var(--panel-2);padding:5px 10px;border-radius:999px;white-space:nowrap">${h(nm)}</span>`; }).join("")}
            <div id="bt" style="position:absolute;left:50%;top:50%;width:28%;height:62%;transform:translate(-50%,-50%) rotate(0deg);transition:transform 3.2s cubic-bezier(.15,.85,.25,1)">${icon("bottle", 999).replace('width="999" height="999"', 'width="100%" height="100%" style="color:var(--go-hi)"')}</div></div>
          <p class="pg-hint">${T("Spinning…", "Die Flasche dreht sich…")}</p></div>`;
        Sound.play("Move", .5); const bt = $("#bt");
        requestAnimationFrame(() => requestAnimationFrame(() => { bt.style.transform = `translate(-50%,-50%) rotate(${deg}deg)`; }));
        PG.later(() => { Sound.play("Capture", .6); PG.later(() => ask(P[k]), 700); }, 3300);
      };
      const ask = name => {
        ctx.body.innerHTML = `<div class="pg-stage pg-pop"><div class="pg-who">${T("Your turn", "Du bist dran")}</div><div class="pg-name">${h(name)}</div>
          <div class="grid2" style="width:100%"><button class="btn big" data-k="t" style="min-height:110px;flex-direction:column">😇<span>${T("Truth", "Wahrheit")}</span></button><button class="btn go big" data-k="d" style="min-height:110px;flex-direction:column">😈<span>${T("Dare", "Pflicht")}</span></button></div>
          <button class="btn ghost sm" id="trand">${T("Random", "Zufall")}</button>${Object.keys(pts).length ? `<details class="unit" style="width:100%;text-align:left"><summary style="font-weight:800;cursor:pointer">${T("Scores", "Punkte")}</summary>${PG.scoreList(P, P.map(n => pts[n] || 0))}</details>` : ""}</div>`;
        $$("[data-k]", ctx.body).forEach(b => b.onclick = () => show(name, b.dataset.k));
        $("#trand").onclick = () => show(name, Math.random() < .5 ? "t" : "d");
      };
      const show = (name, k) => {
        const [l, t] = deckDraw(k === "t" ? "tod-t" : "tod-d", k === "t" ? TRUTH : DARE, o.lv);
        ctx.body.innerHTML = `<div class="pg-stage pg-pop"><div class="pg-who">${h(name)} · ${k === "t" ? T("Truth", "Wahrheit") : T("Dare", "Pflicht")}</div>
          <div class="pg-big"><span class="k">${lvTag(l)}</span><div class="q">${fill(t, P, name)}</div></div>
          <div class="grid2" style="width:100%"><button class="btn big" id="tno">${T("Chicken out", "Kneifen")}</button><button class="btn go big" id="tok">${T("Done", "Erledigt")}</button></div></div>`;
        Sound.play("Capture", .4);
        $("#tok").onclick = () => { pts[name] = (pts[name] || 0) + 1; next(); };
        $("#tno").onclick = () => { pts[name] = (pts[name] || 0) - 1; Sound.wrong(); next(); };
      };
      setup();
    }});

  /* ---- a simple deck game: one big card after the other ---- */
  const deckGame = ({id, icon: ic, name, sub, meta, src, intro, tip, key, count}) => PG.add({id, icon: ic, name, sub, meta, tag: id === "never" ? ["Drinking", "Trinkspiel", "bad"] : null,
    mount(ctx){
      const o = PG.opt(id, {lv: ["chill", "party"]}); let n = 0;
      const setup = () => {
        ctx.stop();
        ctx.body.innerHTML = `${ctx.title(name[0], name[1])}<p class="muted">${T(intro[0], intro[1])}</p>
          <div class="unit"><h3>${T("Level", "Stufe")}</h3><div id="dl"></div><button class="btn go big" id="dgo" style="margin-top:14px">${T("Start", "Los geht's")}</button></div>`;
        lvUI($("#dl"), o); $("#dgo").onclick = () => { ctx.start(); n = 0; card(); };
      };
      const card = () => {
        const [l, t] = deckDraw(key, src, o.lv); n++;
        ctx.body.innerHTML = `<div class="pg-stage pg-pop"><div class="pg-who">${T(`Card ${n}`, `Karte ${n}`)}</div>
          <div class="pg-big" id="dc" style="cursor:pointer"><span class="k">${lvTag(l)}</span><div class="q">${h(t)}</div>${tip ? `<p class="pg-hint" style="margin:0">${T(tip[0], tip[1])}</p>` : ""}</div>
          ${count ? `<div id="dcd" class="pg-name" style="font-size:56px;min-height:64px"></div>` : ""}
          <button class="btn go big" id="dnx" style="max-width:340px">${count ? T("3, 2, 1… point!", "3, 2, 1… zeigen!") : T("Next card", "Nächste Karte")}</button>
          <button class="btn ghost sm" id="dset">${T("Change level", "Stufe ändern")}</button></div>`;
        Sound.play("Capture", .35);
        $("#dset").onclick = setup;
        const nx = $("#dnx");
        if (count){ let st = 0; nx.onclick = () => {
            if (st === 1) return; if (st === 2) return card(); st = 1; let c = 3; const el = $("#dcd"); el.textContent = c; Sound.tick();
            const id2 = PG.every(() => { c--; if (c > 0){ el.textContent = c; Sound.tick(); } else { clearInterval(id2); el.textContent = "👉"; Sound.play("Capture", .7); PG.vib(60); st = 2; nx.textContent = T("Next card", "Nächste Karte"); } }, 800); }; }
        else { nx.onclick = card; $("#dc").onclick = () => { Sound.tap(); card(); }; }
      };
      setup();
    }});

  deckGame({id: "never", icon: "glass", key: "never", src: NEVER, name: ["Never have I ever", "Ich hab noch nie"], sub: ["Whoever has done it drinks. Or confesses.", "Wer's schon gemacht hat, trinkt. Oder gesteht."], meta: ["3+ players", "3+ Spieler"],
    intro: ["Read the card out loud. Everyone who HAS done it drinks a sip (or puts a finger down). Tap the card for the next one.", "Lies die Karte laut vor. Alle, die es SCHON gemacht haben, trinken einen Schluck (oder nehmen einen Finger runter). Tipp auf die Karte für die nächste."],
    tip: ["Done it? Drink!", "Schon gemacht? Trinken!"]});
  deckGame({id: "likely", icon: "point", key: "likely", src: LIKELY, count: true, name: ["Most likely to", "Wer würde eher"], sub: ["On three, everyone points at someone.", "Auf drei zeigen alle auf jemanden."], meta: ["3+ players", "3+ Spieler"],
    intro: ["Read the question out loud. On three, everyone points at the person who'd most likely do it. Whoever gets the most fingers drinks or explains themselves.", "Lies die Frage laut vor. Auf drei zeigen alle auf die Person, die es am ehesten tun würde. Wer die meisten Finger abbekommt, trinkt oder muss sich erklären."]});
})();
