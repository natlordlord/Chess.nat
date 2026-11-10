/* ===== Stirnraten (Heads Up) and Tabu.
   Stirnraten: the phone goes on your forehead, the others explain. Tilt down = got it, tilt up = pass
   (works with the phone's motion sensor; buttons work too). The word turns so the others can read it,
   whichever way you hold the phone, even with the screen locked to portrait.
   Tabu: explain the word without the five forbidden words, two teams, one minute each. Cards are German. ===== */
(() => {
  const {T, h} = PG;
  const sp = s => s.split(";").map(x => x.trim()).filter(Boolean);
  const HU = {
    tiere: ["🐒", "Tiere", "Elefant;Pinguin;Giraffe;Känguru;Krokodil;Faultier;Oktopus;Flamingo;Kamel;Gorilla;Eichhörnchen;Pfau;Hai;Delfin;Schildkröte;Fledermaus;Waschbär;Nilpferd;Koala;Papagei;Igel;Eule;Biene;Schnecke;Zebra;Löwe;Frosch;Pferd;Huhn;Schwein;Kuh;Maulwurf"],
    promis: ["⭐", "Berühmtheiten", "Cristiano Ronaldo;Lionel Messi;Taylor Swift;Elon Musk;Albert Einstein;Michael Jackson;Beyoncé;Angela Merkel;Heidi Klum;Dieter Bohlen;Helene Fischer;Rihanna;Kim Kardashian;MrBeast;Magnus Carlsen;Shakira;Barack Obama;Leonardo DiCaprio;Eminem;Mozart;Napoleon;Cleopatra;Arnold Schwarzenegger;Thomas Müller;Ed Sheeran;Billie Eilish;Jürgen Klopp;Lady Gaga;Mark Zuckerberg;Harry Styles;Michael Schumacher;Bushido"],
    filme: ["🎬", "Filme & Serien", "Harry Potter;Titanic;Star Wars;Der König der Löwen;Frozen;Shrek;Spider-Man;Batman;Fluch der Karibik;Herr der Ringe;Squid Game;Stranger Things;Haus des Geldes;Die Simpsons;SpongeBob;Findet Nemo;Toy Story;Avengers;James Bond;Jurassic Park;Barbie;Game of Thrones;Breaking Bad;Friends;Pokémon;Minions;Avatar;Kevin allein zu Haus;Wednesday;Tatort;Mr. Bean;Fack ju Göhte"],
    figuren: ["🧙", "Figuren", "Pikachu;Super Mario;Darth Vader;Elsa;Hulk;Joker;Rotkäppchen;Pinocchio;Sherlock Holmes;Dracula;Weihnachtsmann;Osterhase;Zahnfee;Tarzan;Aladdin;Hermine Granger;Gandalf;Yoda;Sonic;Barbie;Ken;Grinch;Pippi Langstrumpf;Biene Maja;Spongebob;Homer Simpson;Batman;Superman;Cinderella;Peter Pan;Asterix;Rapunzel"],
    pantomime: ["🕺", "Pantomime", "Zähne putzen;Fallschirmspringen;Kuh melken;Schach spielen;Auto fahren;Kuchen backen;Surfen;Pizza essen;Selfie machen;Bügeln;Angeln;Gitarre spielen;Boxen;Schwimmen;Staubsaugen;Ski fahren;Holz hacken;Zwiebeln schneiden;Baby wickeln;Klettern;Golf spielen;Haare föhnen;Reiten;Bowling;Seilspringen;Zaubern;Yoga;Mücke fangen;Fenster putzen;Rasen mähen"],
    essen: ["🍕", "Essen & Trinken", "Pizza;Döner;Sushi;Spaghetti;Pommes;Burger;Schnitzel;Brezel;Croissant;Pfannkuchen;Popcorn;Schokolade;Wassermelone;Avocado;Käsefondue;Currywurst;Lasagne;Tacos;Knoblauch;Zitrone;Gummibärchen;Weißwurst;Kaiserschmarrn;Spiegelei;Bier;Cappuccino;Aperol Spritz;Smoothie;Zuckerwatte;Raclette"],
    laender: ["🌍", "Länder & Städte", "Italien;Spanien;Frankreich;Japan;Brasilien;Australien;Ägypten;Mexiko;Kanada;Schweiz;Griechenland;Türkei;Thailand;Island;Norwegen;Paris;London;New York;Berlin;Rom;Las Vegas;Dubai;Mallorca;Hawaii;Venedig;Tokio;Hollywood;Amsterdam;Barcelona;München;Indien;China"],
    sport: ["⚽", "Sport", "Fußball;Basketball;Tennis;Schwimmen;Skifahren;Surfen;Boxen;Yoga;Golf;Klettern;Reiten;Darts;Schach;Volleyball;Eishockey;Tischtennis;Formel 1;Handball;Bobfahren;Curling;Sumo;Fechten;Rudern;Bogenschießen;Turmspringen;Marathon;Rugby;Baseball;Kickboxen;Breakdance"],
    gegenstaende: ["📦", "Gegenstände", "Regenschirm;Zahnbürste;Schlüssel;Brille;Kerze;Spiegel;Rucksack;Kopfhörer;Fernbedienung;Kühlschrank;Waschmaschine;Staubsauger;Toaster;Wecker;Fahrrad;Koffer;Kissen;Schere;Luftballon;Gitarre;Kamera;Taschenlampe;Lippenstift;Föhn;Hammer;Teddybär;Sonnenbrille;Klopapier;Trampolin;Hängematte"],
    berufe: ["👩‍🚒", "Berufe", "Arzt;Lehrer;Polizist;Feuerwehrmann;Pilot;Koch;Bäcker;Friseur;Mechaniker;Astronaut;Influencer;Zahnarzt;Tierarzt;Programmierer;Anwalt;Richter;Busfahrer;Kellner;DJ;Gärtner;Detektiv;Zauberer;Clown;Postbote;Bauarbeiter;Fotograf;Schauspieler;Hebamme;Bestatter;Schornsteinfeger"]
  };
  const TABU = (t => t.split("\n").map(x => x.trim()).filter(Boolean))(`Fußball:Tor,Ball,Spiel,Mannschaft,Elfmeter
Schokolade:Süß,Kakao,Milka,Tafel,braun
Weihnachten:Dezember,Geschenke,Baum,Jesus,Fest
Handy:Telefon,Smartphone,Apple,anrufen,App
Pizza:Italien,Käse,Teig,Salami,Ofen
Schach:König,Brett,Matt,Figuren,Dame
Urlaub:Reise,Strand,frei,Hotel,Sommer
Kaffee:Bohne,trinken,Tasse,Koffein,morgens
Hochzeit:heiraten,Braut,Ring,Kirche,Kleid
Zahnarzt:Zähne,Bohrer,Arzt,Karies,Praxis
Geburtstag:Kuchen,Kerzen,Geschenke,Party,Jahr
Flugzeug:fliegen,Pilot,Flughafen,Himmel,Flügel
Kino:Film,Popcorn,Leinwand,Ticket,Saal
Regenschirm:Regen,nass,aufspannen,Wetter,Schirm
Bier:Alkohol,trinken,Hopfen,Oktoberfest,Glas
Netflix:Serie,Film,streamen,Abo,schauen
Polizei:Blaulicht,Verbrecher,Uniform,Streife,110
Strand:Meer,Sand,Sonne,Urlaub,Handtuch
Schule:Lehrer,Schüler,lernen,Klasse,Unterricht
Katze:miau,Tier,Haustier,Maus,Hund
Hund:bellen,Haustier,Gassi,Wau,Leine
Feuerwehr:Brand,löschen,Wasser,112,Feuer
Sushi:Fisch,roh,Japan,Reis,Stäbchen
Weltall:Sterne,Astronaut,Planeten,Rakete,Mond
Zug:Bahn,Gleis,Bahnhof,fahren,Waggon
Instagram:Foto,App,Story,Follower,posten
Bett:schlafen,Kissen,Decke,Matratze,müde
Gitarre:Saiten,Instrument,spielen,Musik,Akkord
Kühlschrank:kalt,Essen,Küche,kühlen,Gefrierfach
Sonnenbrille:Sonne,Augen,dunkel,Sommer,tragen
Fahrrad:Pedale,Räder,fahren,Lenker,Helm
Zirkus:Clown,Zelt,Akrobat,Manege,Tiere
Vampir:Blut,Dracula,beißen,Sarg,Nacht
Dschungel:Wald,Affen,Tarzan,grün,Regenwald
Prüfung:Test,lernen,Note,Schule,schreiben
Kater:Alkohol,Kopfschmerzen,morgens,Katze,Party
Selfie:Foto,Handy,selbst,Kamera,Instagram
Spiegel:Reflexion,sehen,Glas,Bad,selbst
Wecker:aufwachen,klingeln,Uhr,morgens,schlafen
Sauna:heiß,schwitzen,Aufguss,nackt,Hitze
Fallschirm:springen,Flugzeug,fallen,Himmel,öffnen
Pinguin:Antarktis,Vogel,schwarz,weiß,Eis
Zauberer:Magie,Trick,Hut,Hase,Zauberstab
Oktoberfest:München,Bier,Dirndl,Wiesn,Bayern
Gefängnis:Knast,Zelle,Verbrecher,Gitter,Strafe
Tinder:Dating,App,wischen,Match,Date
Achterbahn:Freizeitpark,Looping,schnell,fahren,schreien
Schneemann:Schnee,Winter,Karotte,bauen,Nase
Hausaufgaben:Schule,Lehrer,machen,lernen,Heft
Influencer:Instagram,Follower,Werbung,YouTube,berühmt
Kaktus:Stacheln,Wüste,Pflanze,grün,pieksen
Rakete:Weltall,fliegen,NASA,Start,Astronaut
Grill:Würstchen,Fleisch,Sommer,Kohle,Barbecue
Marathon:laufen,42,Kilometer,rennen,Ziel
Popcorn:Kino,Mais,süß,salzig,knallen
Pirat:Schiff,Schatz,Augenklappe,Meer,Captain
Krankenhaus:Arzt,krank,Patient,Notaufnahme,Bett
Spinne:acht,Beine,Netz,Angst,Tier
Zahnbürste:Zähne,putzen,Zahnpasta,Bad,morgens
Mond:Nacht,Sonne,Himmel,Vollmond,Astronaut`).map(l => { const [w, f] = l.split(":"); return {w, f: f.split(",")}; });

  PG.data.tabu = TABU;
  /* ---------- Stirnraten ---------- */
  PG.add({id: "heads", icon: "head", name: ["Heads Up", "Stirnraten"], tag: ["Hit", "Hit"], sub: ["Phone on your forehead. Guess.", "Handy an die Stirn. Raten."], meta: ["2+ players · 1 min rounds", "2+ Spieler · 1-Min-Runden"],
    mount(ctx){
      const o = PG.opt("heads", {cat: "tiere", secs: 60, tilt: true}); let tilt = null;
      const setup = () => {
        ctx.stop();
        ctx.body.innerHTML = `${ctx.title("Heads Up", "Stirnraten")}<p class="muted">${T("Hold the phone to your forehead, screen facing out. The others describe the word. Tilt down when you got it, tilt up to pass.", "Halt das Handy quer an die Stirn, Display nach außen. Die anderen beschreiben das Wort. Nach unten kippen, wenn du es hast, nach oben zum Überspringen.")}</p>
          <div class="unit"><h3>${T("Category", "Kategorie")}</h3><div class="grid2" style="margin-top:8px" id="hc"></div></div>
          <div class="unit"><h3>${T("Round", "Runde")}</h3><div id="hs"></div><label class="chk"><input type="checkbox" id="ht" ${o.tilt ? "checked" : ""}> ${T("Answer by tilting the phone", "Antworten durch Kippen")}</label>
            <button class="btn go big" id="hgo" style="margin-top:10px">${T("Start", "Los geht's")}</button></div>`;
        const cats = () => { $("#hc").innerHTML = [["mix", ["🎲", T("Mix", "Mix")]], ...Object.entries(HU).map(([k, c]) => [k, [c[0], c[1]]])].map(([k, [e, n]]) => `<button class="btn ${o.cat === k ? "go" : ""}" data-c="${k}" style="justify-content:flex-start;gap:10px"><span style="font-size:22px">${e}</span>${h(n)}</button>`).join("");
          $$("[data-c]", ctx.body).forEach(b => b.onclick = () => { o.cat = b.dataset.c; PG.persist(); cats(); }); };
        cats();
        const secs = () => PG.choices($("#hs"), [[45, "45 s"], [60, "60 s"], [90, "90 s"], [120, "2 min"]], o.secs, v => { o.secs = v; PG.persist(); secs(); }); secs();
        $("#ht").onchange = e => { o.tilt = e.target.checked; PG.persist(); };
        $("#hgo").onclick = async () => {
          /* iPhone asks once for the motion sensor; without it the buttons still work */
          if (o.tilt && window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function"){ try { const r = await DeviceOrientationEvent.requestPermission(); if (r !== "granted") toast(T("No motion sensor: use the buttons.", "Kein Bewegungssensor: nimm die Knöpfe.")); } catch(e) {} }
          play(); };
      };
      const play = () => {
        ctx.start();
        const list = o.cat === "mix" ? Object.values(HU).flatMap(c => sp(c[2])) : sp(HU[o.cat][2]);
        const res = []; let word = null, live = false, armed = false, up = [0, 1, 0], rot = 90, end = 0;
        const ov = document.createElement("div"); ov.className = "pg-hu"; ov.setAttribute("data-notr", "");
        ov.innerHTML = `<div class="pg-hu-in" id="huin"><div class="pg-hu-t" id="hut"></div><div class="pg-hu-w" id="huw"></div><div class="pg-hu-s" id="hus"></div>
          <div class="pg-hu-b"><button class="btn big" data-x="pass">${T("Pass", "Weiter")}</button><button class="btn go big" data-x="ok">${T("Got it", "Richtig")}</button></div>
          <button class="btn ghost sm pg-hu-x" data-x="stop">${T("End", "Beenden")}</button></div>`;
        document.body.appendChild(ov); const inn = ov.querySelector("#huin"), tw = ov.querySelector("#huw"), tt = ov.querySelector("#hut"), ts = ov.querySelector("#hus");
        const layout = () => { const portrait = innerHeight > innerWidth; inn.style.width = portrait ? innerHeight + "px" : "100%"; inn.style.height = portrait ? innerWidth + "px" : "100%"; inn.style.transform = portrait ? `rotate(${rot}deg)` : "none"; };
        layout(); window.addEventListener("resize", layout); PG.onLeave(() => { window.removeEventListener("resize", layout); ov.remove(); });
        const flash = c => { ov.style.background = c; PG.later(() => { ov.style.background = ""; }, 380); };
        const nextWord = () => { word = PG.draw("heads:" + o.cat, list); tw.textContent = word; tw.classList.remove("pg-pop"); void tw.offsetWidth; tw.classList.add("pg-pop"); ts.textContent = res.filter(r => r[1]).length + " ✓"; };
        const answer = ok => { if (!live || !word) return; res.push([word, ok]); if (ok){ Sound.xp ? Sound.xp() : Sound.right(); flash("var(--go)"); PG.vib(40); } else { Sound.play("Move", .6); flash("#E9B64A"); PG.vib([20, 30, 20]); } nextWord(); };
        ov.querySelectorAll("[data-x]").forEach(b => b.onclick = () => { const x = b.dataset.x; if (x === "stop") return finish(); answer(x === "ok"); });
        /* gravity from the phone's orientation: which way is up on the screen, and is the screen tilted to the floor or the ceiling */
        const onOri = e => { if (e.beta == null || e.gamma == null) return; const b = e.beta * Math.PI / 180, g = e.gamma * Math.PI / 180;
          up = [-Math.cos(b) * Math.sin(g), Math.sin(b), Math.cos(b) * Math.cos(g)];
          if (Math.abs(up[0]) > .6){ const r = up[0] > 0 ? 90 : -90; if (r !== rot){ rot = r; layout(); } }
          if (!o.tilt || !live) return; const z = up[2];
          if (Math.abs(z) < .35) armed = true; else if (armed && z < -.6){ armed = false; answer(true); } else if (armed && z > .6){ armed = false; answer(false); } };
        window.addEventListener("deviceorientation", onOri); PG.onLeave(() => window.removeEventListener("deviceorientation", onOri));
        /* 3, 2, 1 while you put it on your forehead */
        let c = 3; tt.textContent = ""; tw.textContent = T("On your forehead!", "An die Stirn!"); ts.textContent = "";
        const cd = PG.every(() => { if (c > 0){ tw.textContent = c; Sound.tick(); c--; return; } clearInterval(cd); live = true; armed = false; Sound.play("GenericNotify", .6); end = Date.now() + o.secs * 1000; nextWord();
          const tk = PG.every(() => { const left = Math.max(0, end - Date.now()), s = Math.ceil(left / 1000); tt.textContent = s; tt.classList.toggle("low", s <= 10); if (s <= 5 && s > 0 && tt.dataset.s != s) Sound.tick(); tt.dataset.s = s; if (left <= 0){ clearInterval(tk); finish(); } }, 200); }, 900);
        let done = false;
        const finish = () => { if (done) return; done = true; live = false; PG.stopAll(); const ok = res.filter(r => r[1]).length; if (word && !res.some(r => r[0] === word)) res.push([word, false]);
          Sound.play("GenericNotify", .8); if (ok >= 5) PG.cheer(ok >= 12 ? 4 : ok >= 8 ? 3 : 2);
          ctx.stop();
          ctx.body.innerHTML = `<div class="pg-stage pg-pop"><div class="pg-big" style="min-height:0"><span class="k">${T("Result", "Ergebnis")}</span><div class="pg-name" style="font-size:64px">${ok}</div><p class="muted" style="margin:0">${T("correct", "richtig")}</p></div>
            <div class="unit" style="width:100%;text-align:left"><div class="list">${res.map(([w, k]) => `<div class="li"><span style="width:22px;text-align:center;font-weight:900;color:${k ? "var(--go-hi)" : "var(--dim)"}">${k ? "✓" : "–"}</span><div class="grow t" style="${k ? "" : "color:var(--dim)"}">${h(w)}</div></div>`).join("") || `<p class="muted">${T("No words this round.", "Keine Wörter diese Runde.")}</p>`}</div></div>
            <button class="btn go big" id="hagain" style="max-width:340px">${T("Next player", "Nächste Person")}</button><button class="btn ghost" id="hset">${T("Category", "Kategorie")}</button></div>`;
          $("#hagain").onclick = play; $("#hset").onclick = setup; };
      };
      setup();
    }});

  /* ---------- Tabu ---------- */
  PG.add({id: "tabu", icon: "ban", name: ["Taboo", "Tabu"], sub: ["Explain it. Not with those words.", "Erklären, ohne die verbotenen Wörter."], meta: ["4+ players · 2 teams", "4+ Spieler · 2 Teams"],
    mount(ctx){
      const o = PG.opt("tabu", {secs: 60, goal: 20, a: "Team A", b: "Team B"}); let S2 = null;
      const setup = () => {
        ctx.stop();
        ctx.body.innerHTML = `${ctx.title("Taboo", "Tabu")}<p class="muted">${T("One person explains, their team guesses. The other team watches the phone and taps ‘Taboo!’ if a forbidden word is said.", "Eine Person erklärt, ihr Team rät. Das andere Team schaut aufs Handy und tippt ‚Tabu!‘, wenn ein verbotenes Wort fällt.")}</p>
          <div class="unit"><h3>${T("Teams", "Teams")}</h3><div class="grid2" style="margin-top:8px"><input type="text" id="ta" maxlength="16" value="${h(o.a)}"><input type="text" id="tb" maxlength="16" value="${h(o.b)}"></div></div>
          <div class="unit"><h3>${T("Time per turn", "Zeit pro Zug")}</h3><div id="tsx"></div><h3 style="margin-top:14px">${T("Play to", "Spielen bis")}</h3><div id="tgl"></div>
            <button class="btn go big" id="tgo2" style="margin-top:14px">${T("Start", "Los geht's")}</button></div>`;
        const opts = () => { PG.choices($("#tsx"), [[45, "45 s"], [60, "60 s"], [90, "90 s"]], o.secs, v => { o.secs = v; PG.persist(); opts(); }); PG.choices($("#tgl"), [[10, "10"], [20, "20"], [30, "30"]], o.goal, v => { o.goal = v; PG.persist(); opts(); }); }; opts();
        $("#tgo2").onclick = () => { o.a = $("#ta").value.trim() || "Team A"; o.b = $("#tb").value.trim() || "Team B"; PG.persist(); S2 = {sc: [0, 0], turn: 0}; ctx.start(); ready(); };
      };
      const ready = () => {
        const t = S2.turn % 2, nm = t ? o.b : o.a;
        ctx.body.innerHTML = `<div class="pg-stage pg-pop"><div class="pg-who">${T("Up next", "Jetzt dran")}</div><div class="pg-name">${h(nm)}</div>
          <div class="grid2" style="width:100%"><div class="stat"><b>${S2.sc[0]}</b><span>${h(o.a)}</span></div><div class="stat"><b>${S2.sc[1]}</b><span>${h(o.b)}</span></div></div>
          <p class="muted" style="margin:0">${T(`Someone from ${h(nm)} explains. Hold the phone so the other team can see it too.`, `Jemand aus ${h(nm)} erklärt. Halt das Handy so, dass das andere Team mitlesen kann.`)}</p>
          <button class="btn go big" id="tst" style="max-width:340px">${T("Start the clock", "Uhr starten")}</button></div>`;
        $("#tst").onclick = () => turn(t);
      };
      const turn = t => {
        let pts = 0, card = null; const log = [];
        const draw = () => { card = PG.draw("tabu", TABU);
          $("#tcard").innerHTML = `<span class="k">${T("Explain", "Erkläre")}</span><div class="pg-name" style="font-size:36px">${h(card.w)}</div><div style="width:100%;border-top:2px solid var(--line);padding-top:10px;display:flex;flex-direction:column;gap:4px">${card.f.map(f => `<span style="font:800 17px var(--body);color:#F07B68">${h(f)}</span>`).join("")}</div>`;
          $("#tcard").classList.remove("pg-pop"); void $("#tcard").offsetWidth; $("#tcard").classList.add("pg-pop"); $("#tpts").textContent = pts; };
        ctx.body.innerHTML = `<div class="pg-stage"><div class="row" style="justify-content:space-between;width:100%"><div class="pg-timer" id="ttm" style="font-size:34px;min-width:0;padding:2px 12px"></div><div class="stat" style="text-align:center"><b id="tpts">0</b><span>${T("this turn", "diesen Zug")}</span></div></div>
          <div class="pg-big" id="tcard" style="min-height:270px"></div>
          <div class="grid3" style="width:100%"><button class="btn big" id="tbad" style="background:var(--bad);color:#fff;box-shadow:inset 0 -4px 0 rgba(0,0,0,.25)">${T("Taboo!", "Tabu!")}</button><button class="btn big" id="tskip">${T("Skip", "Weiter")}</button><button class="btn go big" id="tok2">${T("Got it", "Richtig")}</button></div></div>`;
        draw();
        $("#tok2").onclick = () => { pts++; log.push([card.w, 1]); Sound.xp ? Sound.xp() : Sound.right(); draw(); };
        $("#tbad").onclick = () => { pts--; log.push([card.w, -1]); Sound.wrong(); PG.vib(80); draw(); };
        $("#tskip").onclick = () => { log.push([card.w, 0]); draw(); };
        PG.timer($("#ttm"), o.secs, () => {
          PG.stopAll(); S2.sc[t] += pts; S2.turn++;
          const won = S2.sc[t] >= o.goal;
          if (won){ PG.cheer(3); ctx.stop(); }
          ctx.body.innerHTML = `<div class="pg-stage pg-pop"><div class="pg-big" style="min-height:0"><span class="k">${won ? T("Winner", "Gewonnen") : T("Time's up", "Zeit ist um")}</span><div class="pg-name" style="font-size:${won ? 34 : 56}px">${won ? h(t ? o.b : o.a) + " 🏆" : (pts > 0 ? "+" : "") + pts}</div></div>
            <div class="grid2" style="width:100%"><div class="stat"><b>${S2.sc[0]}</b><span>${h(o.a)}</span></div><div class="stat"><b>${S2.sc[1]}</b><span>${h(o.b)}</span></div></div>
            <div class="unit" style="width:100%;text-align:left"><div class="list">${log.map(([w, k]) => `<div class="li"><span style="width:26px;text-align:center;font-weight:900;color:${k > 0 ? "var(--go-hi)" : k < 0 ? "#F07B68" : "var(--dim)"}">${k > 0 ? "+1" : k < 0 ? "−1" : "–"}</span><div class="grow t">${h(w)}</div></div>`).join("")}</div></div>
            <button class="btn go big" id="tnx" style="max-width:340px">${won ? T("New game", "Neues Spiel") : T("Next team", "Nächstes Team")}</button></div>`;
          $("#tnx").onclick = () => { if (won){ S2 = {sc: [0, 0], turn: 0}; ctx.start(); } ready(); };
        });
      };
      setup();
    }});

  const css = `.pg-hu{position:fixed;inset:0;z-index:3000;background:var(--panel);display:flex;align-items:center;justify-content:center;overflow:hidden;transition:background .25s;touch-action:none}
.pg-hu-in{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;position:relative;padding:20px}
.pg-hu-w{font:900 min(13vw,13vh,96px)/1.05 var(--display);text-align:center;max-width:92%;word-break:break-word;text-wrap:balance}
.pg-hu-t{font:700 30px var(--mono);font-variant-numeric:tabular-nums;color:var(--muted)}
.pg-hu-t.low{color:var(--bad)}
.pg-hu-s{font:800 16px var(--body);color:var(--muted);min-height:20px}
.pg-hu-b{display:flex;gap:10px;margin-top:8px}.pg-hu-b .btn{min-width:150px}
.pg-hu-x{position:absolute;top:10px;right:14px}`;
  const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
})();
