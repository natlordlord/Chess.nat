/* ===== Imposter: everyone gets the secret word, the imposter doesn't. Say one word each, then vote.
   Modes: Classic (imposter knows they're the imposter), Undercover (imposter gets a similar word and doesn't know),
   Agent (everyone knows the place, the agent has to find out where you are). ===== */
(() => {
  const {T, h} = PG;
  /* "German|English" words per category */
  const CATS = {
    food: ["Essen & Trinken", "Food & drinks", "Pizza|Pizza;Döner|Kebab;Sushi|Sushi;Spaghetti|Spaghetti;Pommes|Fries;Burger|Burger;Schnitzel|Schnitzel;Brezel|Pretzel;Croissant|Croissant;Pfannkuchen|Pancake;Eis|Ice cream;Popcorn|Popcorn;Schokolade|Chocolate;Banane|Banana;Wassermelone|Watermelon;Erdbeere|Strawberry;Avocado|Avocado;Käse|Cheese;Honig|Honey;Kaffee|Coffee;Bier|Beer;Cola|Cola;Smoothie|Smoothie;Currywurst|Currywurst;Lasagne|Lasagna;Tacos|Tacos;Müsli|Cereal;Knoblauch|Garlic;Zitrone|Lemon;Gummibärchen|Gummy bears"],
    animals: ["Tiere", "Animals", "Hund|Dog;Katze|Cat;Pferd|Horse;Elefant|Elephant;Giraffe|Giraffe;Pinguin|Penguin;Hai|Shark;Delfin|Dolphin;Löwe|Lion;Affe|Monkey;Kuh|Cow;Schwein|Pig;Huhn|Chicken;Biene|Bee;Spinne|Spider;Schlange|Snake;Krokodil|Crocodile;Eule|Owl;Fledermaus|Bat;Känguru|Kangaroo;Koala|Koala;Igel|Hedgehog;Frosch|Frog;Schildkröte|Turtle;Papagei|Parrot;Wal|Whale;Zebra|Zebra;Fuchs|Fox;Eichhörnchen|Squirrel;Flamingo|Flamingo"],
    places: ["Orte", "Places", "Strand|Beach;Krankenhaus|Hospital;Schule|School;Flughafen|Airport;Kino|Cinema;Supermarkt|Supermarket;Zoo|Zoo;Bibliothek|Library;Fitnessstudio|Gym;Kirche|Church;Bahnhof|Train station;Club|Nightclub;Freibad|Swimming pool;Friseur|Hair salon;Zahnarzt|Dentist;Campingplatz|Campsite;Freizeitpark|Theme park;Museum|Museum;Bäckerei|Bakery;Gefängnis|Prison;Bauernhof|Farm;Stadion|Stadium;Tankstelle|Gas station;Hotel|Hotel;Kreuzfahrtschiff|Cruise ship;Skihütte|Ski lodge;Wüste|Desert;Dschungel|Jungle;Weltall|Space;Hochzeit|Wedding"],
    jobs: ["Berufe", "Jobs", "Arzt|Doctor;Lehrer|Teacher;Polizist|Police officer;Feuerwehrmann|Firefighter;Pilot|Pilot;Koch|Chef;Bäcker|Baker;Friseur|Hairdresser;Mechaniker|Mechanic;Astronaut|Astronaut;Influencer|Influencer;Youtuber|YouTuber;Zahnarzt|Dentist;Tierarzt|Vet;Programmierer|Programmer;Anwalt|Lawyer;Richter|Judge;Busfahrer|Bus driver;Kellner|Waiter;DJ|DJ;Fußballer|Footballer;Gärtner|Gardener;Detektiv|Detective;Zauberer|Magician;Clown|Clown;Postbote|Postman;Bauarbeiter|Builder;Fotograf|Photographer;Schauspieler|Actor;Sänger|Singer"],
    things: ["Gegenstände", "Things", "Handy|Phone;Regenschirm|Umbrella;Zahnbürste|Toothbrush;Schlüssel|Key;Brille|Glasses;Kerze|Candle;Spiegel|Mirror;Rucksack|Backpack;Kopfhörer|Headphones;Fernbedienung|Remote control;Kühlschrank|Fridge;Waschmaschine|Washing machine;Staubsauger|Vacuum cleaner;Toaster|Toaster;Wecker|Alarm clock;Fahrrad|Bicycle;Koffer|Suitcase;Kissen|Pillow;Schere|Scissors;Uhr|Watch;Ballon|Balloon;Gitarre|Guitar;Kamera|Camera;Taschenlampe|Flashlight;Lippenstift|Lipstick;Föhn|Hair dryer;Hammer|Hammer;Teddybär|Teddy bear;Sonnenbrille|Sunglasses;Klopapier|Toilet paper"],
    sport: ["Sport & Hobbys", "Sports & hobbies", "Fußball|Football;Basketball|Basketball;Tennis|Tennis;Schwimmen|Swimming;Skifahren|Skiing;Surfen|Surfing;Boxen|Boxing;Yoga|Yoga;Golf|Golf;Klettern|Climbing;Reiten|Horse riding;Angeln|Fishing;Tanzen|Dancing;Bowling|Bowling;Darts|Darts;Schach|Chess;Joggen|Jogging;Volleyball|Volleyball;Eishockey|Ice hockey;Tischtennis|Table tennis;Kochen|Cooking;Malen|Painting;Gaming|Gaming;Karaoke|Karaoke;Camping|Camping;Skateboard|Skateboarding;Formel 1|Formula 1;Handball|Handball;Wandern|Hiking;Zumba|Zumba"],
    movies: ["Filme & Serien", "Movies & shows", "Harry Potter|Harry Potter;Titanic|Titanic;Star Wars|Star Wars;Der König der Löwen|The Lion King;Frozen|Frozen;Shrek|Shrek;Spider-Man|Spider-Man;Batman|Batman;Fluch der Karibik|Pirates of the Caribbean;Herr der Ringe|Lord of the Rings;Squid Game|Squid Game;Stranger Things|Stranger Things;Haus des Geldes|Money Heist;Die Simpsons|The Simpsons;SpongeBob|SpongeBob;Findet Nemo|Finding Nemo;Toy Story|Toy Story;Avengers|Avengers;James Bond|James Bond;Jurassic Park|Jurassic Park;Barbie|Barbie;Game of Thrones|Game of Thrones;Breaking Bad|Breaking Bad;Friends|Friends;Pokémon|Pokémon;Minions|Minions;Avatar|Avatar;Kevin allein zu Haus|Home Alone;Wednesday|Wednesday;Dschungelcamp|I'm a Celebrity"],
    famous: ["Berühmtheiten", "Famous people", "Cristiano Ronaldo|Cristiano Ronaldo;Lionel Messi|Lionel Messi;Taylor Swift|Taylor Swift;Elon Musk|Elon Musk;Albert Einstein|Albert Einstein;Michael Jackson|Michael Jackson;Beyoncé|Beyoncé;Donald Trump|Donald Trump;Angela Merkel|Angela Merkel;Heidi Klum|Heidi Klum;Dieter Bohlen|Dieter Bohlen;Helene Fischer|Helene Fischer;Rihanna|Rihanna;Kim Kardashian|Kim Kardashian;Mr. Beast|MrBeast;Magnus Carlsen|Magnus Carlsen;Shakira|Shakira;Barack Obama|Barack Obama;Queen Elizabeth|Queen Elizabeth;Leonardo DiCaprio|Leonardo DiCaprio;Eminem|Eminem;Bill Gates|Bill Gates;Mozart|Mozart;Napoleon|Napoleon;Cleopatra|Cleopatra;Arnold Schwarzenegger|Arnold Schwarzenegger;Thomas Müller|Thomas Müller;Ed Sheeran|Ed Sheeran;Drake|Drake;Billie Eilish|Billie Eilish"],
    brands: ["Marken", "Brands", "Apple|Apple;Nike|Nike;Adidas|Adidas;McDonald's|McDonald's;Coca-Cola|Coca-Cola;IKEA|IKEA;Lego|Lego;Netflix|Netflix;Amazon|Amazon;Google|Google;Instagram|Instagram;TikTok|TikTok;Spotify|Spotify;Red Bull|Red Bull;Mercedes|Mercedes;BMW|BMW;Tesla|Tesla;Nutella|Nutella;Haribo|Haribo;Starbucks|Starbucks;Disney|Disney;Samsung|Samsung;PlayStation|PlayStation;Nintendo|Nintendo;Rolex|Rolex;Gucci|Gucci;Lidl|Lidl;DHL|DHL;WhatsApp|WhatsApp;Barbie|Barbie"],
    world: ["Länder & Städte", "Countries & cities", "Italien|Italy;Spanien|Spain;Frankreich|France;Japan|Japan;Brasilien|Brazil;Australien|Australia;Ägypten|Egypt;Mexiko|Mexico;Kanada|Canada;Schweiz|Switzerland;Griechenland|Greece;Türkei|Turkey;Thailand|Thailand;Island|Iceland;Norwegen|Norway;Paris|Paris;London|London;New York|New York;Berlin|Berlin;Rom|Rome;Las Vegas|Las Vegas;Dubai|Dubai;Mallorca|Mallorca;Hawaii|Hawaii;Venedig|Venice;Tokio|Tokyo;Hollywood|Hollywood;Amsterdam|Amsterdam;Barcelona|Barcelona;München|Munich"],
    party: ["Party & Alltag", "Party & everyday", "Geburtstag|Birthday;Silvester|New Year's Eve;Weihnachten|Christmas;Halloween|Halloween;Hochzeit|Wedding;Junggesellenabschied|Bachelor party;Kater|Hangover;Selfie|Selfie;Tinder|Tinder;Hausaufgaben|Homework;Montag|Monday;Urlaub|Vacation;Stau|Traffic jam;Grillen|Barbecue;Festival|Festival;Karneval|Carnival;Oktoberfest|Oktoberfest;Sauna|Sauna;Umzug|Moving house;Prüfung|Exam;Liebeskummer|Heartbreak;Wecker klingeln|Alarm ringing;Erstes Date|First date;Familienfeier|Family party;Schneeballschlacht|Snowball fight;Sonnenbrand|Sunburn;Flohmarkt|Flea market;Roadtrip|Road trip;Bierpong|Beer pong;Pyjamaparty|Sleepover"],
    chess: ["Schach", "Chess", "König|King;Dame|Queen;Turm|Rook;Läufer|Bishop;Springer|Knight;Bauer|Pawn;Rochade|Castling;Schachmatt|Checkmate;Patt|Stalemate;Gabel|Fork;Fesselung|Pin;Schachuhr|Chess clock;Eröffnung|Opening;Endspiel|Endgame;Großmeister|Grandmaster;Blitzschach|Blitz chess;Remis|Draw;Umwandlung|Promotion;En passant|En passant;Opfer|Sacrifice"]
  };
  const words = k => CATS[k][2].split(";").map(x => x.split("|"));
  /* close pairs for Undercover: the imposter gets the other word and has no idea */
  const PAIRS = "Kaffee|Coffee~Tee|Tea;Hund|Dog~Katze|Cat;Pizza|Pizza~Flammkuchen|Tarte flambée;Strand|Beach~Freibad|Swimming pool;Bier|Beer~Wein|Wine;Netflix|Netflix~YouTube|YouTube;Fußball|Football~Handball|Handball;Harry Potter|Harry Potter~Herr der Ringe|Lord of the Rings;Apple|Apple~Samsung|Samsung;Burger|Burger~Döner|Kebab;Löwe|Lion~Tiger|Tiger;Weihnachten|Christmas~Silvester|New Year's Eve;Gitarre|Guitar~Geige|Violin;Zahnarzt|Dentist~Hausarzt|Doctor;Schule|School~Uni|University;Flugzeug|Plane~Hubschrauber|Helicopter;Instagram|Instagram~TikTok|TikTok;Paris|Paris~London|London;Kino|Cinema~Theater|Theatre;Butter|Butter~Margarine|Margarine;Sonne|Sun~Mond|Moon;Eis|Ice cream~Joghurt|Yoghurt;Ski|Skiing~Snowboard|Snowboarding;Pirat|Pirate~Wikinger|Viking;Vampir|Vampire~Zombie|Zombie;Polizei|Police~Feuerwehr|Fire brigade;Rotkäppchen|Little Red Riding Hood~Schneewittchen|Snow White;Spaghetti|Spaghetti~Lasagne|Lasagna;Messi|Messi~Ronaldo|Ronaldo;Hochzeit|Wedding~Taufe|Christening;Zug|Train~Bus|Bus;Kissen|Pillow~Decke|Blanket;Gabel|Fork~Löffel|Spoon;Bowling|Bowling~Billard|Pool;Biene|Bee~Wespe|Wasp;Frosch|Frog~Kröte|Toad;Croissant|Croissant~Brezel|Pretzel;Mallorca|Mallorca~Ibiza|Ibiza;Sauna|Sauna~Whirlpool|Hot tub;Tinder|Tinder~Bumble|Bumble;Dame|Queen~König|King;Springer|Knight~Läufer|Bishop;Schachmatt|Checkmate~Patt|Stalemate;Kerze|Candle~Lampe|Lamp;Rucksack|Backpack~Koffer|Suitcase;Wolke|Cloud~Nebel|Fog;Gummibärchen|Gummy bears~Lakritz|Liquorice;Disney|Disney~Pixar|Pixar".split(";").map(p => p.split("~").map(x => x.split("|")));
  /* places for Agent */
  const PLACES = "Flughafen|Airport;Krankenhaus|Hospital;Schule|School;Strand|Beach;Kino|Cinema;Raumstation|Space station;Piratenschiff|Pirate ship;Zirkus|Circus;Restaurant|Restaurant;Bank|Bank;Polizeirevier|Police station;U-Boot|Submarine;Supermarkt|Supermarket;Hotel|Hotel;Zoo|Zoo;Freizeitpark|Theme park;Fußballstadion|Football stadium;Hochzeit|Wedding;Kreuzfahrtschiff|Cruise ship;Bauernhof|Farm;Skigebiet|Ski resort;Casino|Casino;Fitnessstudio|Gym;Friseursalon|Hair salon;Universität|University;Militärbasis|Army base;Zug|Train;Museum|Museum;Club|Nightclub;Weihnachtsmarkt|Christmas market;Festival|Music festival;Schachturnier|Chess tournament;Tankstelle|Gas station;Kirche|Church;Bäckerei|Bakery;Campingplatz|Campsite".split(";").map(x => x.split("|"));

  PG.data.imp = {CATS, PAIRS, PLACES, words};
  const L = pair => PG.de() ? pair[0] : (pair[1] || pair[0]);
  const DEF = {mode: "classic", cats: ["food", "animals", "places", "things", "party"], imp: 1, hint: true, time: 3};

  PG.add({id: "imposter", icon: "spy", name: ["Imposter", "Imposter"], tag: ["Hit", "Hit"], sub: ["Everyone knows the word. Except one.", "Alle kennen das Wort. Bis auf einen."], meta: ["3–20 players · 10 min", "3–20 Spieler · 10 Min"],
    mount(ctx){
      const o = PG.opt("imposter", DEF); const sc = PG.st.impScore = PG.st.impScore || {};
      const maxImp = n => Math.max(1, Math.floor((n - 1) / 2));
      const setup = () => {
        ctx.stop(); const P = PG.players();
        ctx.body.innerHTML = `${ctx.title("Imposter", "Imposter")}<p class="muted">${T("Everyone sees the secret word on their card. The imposter doesn't. Each of you says one word that fits, then you vote who's faking it.", "Alle sehen das geheime Wort auf ihrer Karte. Der Imposter nicht. Reihum sagt jeder ein Wort, das passt, dann stimmt ihr ab, wer blufft.")}</p>
          <div class="unit" id="ip"></div>
          <div class="unit"><h3>${T("Mode", "Modus")}</h3><div id="im"></div><p class="pg-sub" id="imd"></p></div>
          <div class="unit" id="icw"><h3>${T("Categories", "Kategorien")}</h3><div id="ic" class="pg-opt"></div></div>
          <div class="unit"><h3>${T("Imposters", "Imposter")}</h3><div id="in"></div>
            <label class="chk" id="ihw"><input type="checkbox" id="ih" ${o.hint ? "checked" : ""}> ${T("The imposter sees the category as a hint", "Der Imposter sieht die Kategorie als Tipp")}</label></div>
          <div class="unit"><h3>${T("Talk time", "Diskussionszeit")}</h3><div id="it"></div>
            <button class="btn go big" id="igo" style="margin-top:14px">${T("Start", "Los geht's")}</button></div>
          ${Object.keys(sc).length ? `<div class="unit"><div class="row" style="justify-content:space-between"><h3>${T("Points tonight", "Punkte heute")}</h3><button class="btn ghost sm" id="irs">${T("Reset", "Zurücksetzen")}</button></div>${PG.scoreList(Object.keys(sc), Object.values(sc))}</div>` : ""}`;
        PG.playersUI($("#ip"), {min: 3, onChange: () => { drawOpts(); }});
        const drawOpts = () => {
          const n = PG.players().length;
          PG.choices($("#im"), [["classic", T("Classic", "Klassisch")], ["under", "Undercover"], ["agent", T("Agent (places)", "Agent (Orte)")]], o.mode, v => { o.mode = v; PG.persist(); drawOpts(); });
          $("#imd").textContent = o.mode === "classic" ? T("The imposter knows they are the imposter and has to blend in.", "Der Imposter weiß, dass er Imposter ist, und muss sich durchmogeln.")
            : o.mode === "under" ? T("The imposter gets a similar word and doesn't know they're the odd one out.", "Der Imposter bekommt ein ähnliches Wort und weiß selbst nicht, dass er der Imposter ist.")
            : T("Everyone knows the place you're at. The agent doesn't and has to find out. Ask each other questions about the place.", "Alle kennen den Ort, an dem ihr seid. Der Agent nicht und muss ihn herausfinden. Stellt euch reihum Fragen über den Ort.");
          $("#icw").style.display = o.mode === "classic" ? "" : "none"; $("#ihw").style.display = o.mode === "classic" ? "" : "none";
          $("#ic").innerHTML = Object.entries(CATS).map(([k, c]) => `<button class="btn sm ${o.cats.includes(k) ? "go" : ""}" data-c="${k}">${h(T(c[1], c[0]))}</button>`).join("");
          $$("[data-c]", ctx.body).forEach(b => b.onclick = () => { const k = b.dataset.c; o.cats = o.cats.includes(k) ? o.cats.filter(x => x !== k) : o.cats.concat(k); if (!o.cats.length) o.cats = [k]; PG.persist(); drawOpts(); });
          const mx = maxImp(Math.max(3, n)); if (o.imp > mx) o.imp = mx;
          PG.choices($("#in"), [1, 2, 3].map(k => [k, String(k)]).filter(x => x[0] <= mx), o.imp, v => { o.imp = v; PG.persist(); drawOpts(); });
          PG.choices($("#it"), [[0, T("No timer", "Ohne Uhr")], [2, "2 min"], [3, "3 min"], [5, "5 min"]], o.time, v => { o.time = v; PG.persist(); drawOpts(); });
        };
        drawOpts();
        $("#ih").onchange = e => { o.hint = e.target.checked; PG.persist(); };
        const rs = $("#irs"); if (rs) rs.onclick = () => { for (const k in sc) delete sc[k]; PG.persist(); setup(); };
        $("#igo").onclick = () => { if (PG.players().length < 3){ toast(T("Add at least 3 players.", "Mindestens 3 Spieler eintragen.")); return; } round(); };
      };

      const round = () => {
        const P = PG.players(), n = P.length, k = Math.min(o.imp, maxImp(n));
        const imps = PG.shuffle(P.map((_, i) => i)).slice(0, k);
        let word, other, cat, cards;
        if (o.mode === "under"){ const pr = PG.draw("imp:pairs", PAIRS); const flip = Math.random() < .5; word = flip ? pr[1] : pr[0]; other = flip ? pr[0] : pr[1]; }
        else if (o.mode === "agent"){ word = PG.draw("imp:places", PLACES); }
        else { cat = PG.pick(o.cats); word = PG.draw("imp:" + cat, words(cat)); }
        cards = P.map((name, i) => {
          const isImp = imps.includes(i);
          if (o.mode === "under") return {name, front: `<span class="lab">${T("Your word", "Dein Wort")}</span><span class="big">${h(L(isImp ? other : word))}</span>`};
          if (o.mode === "agent") return isImp ? {name, bad: true, front: `<span class="em">🕵️</span><span class="big">${T("Agent", "Agent")}</span><span class="sm">${T("You don't know the place. Find out where you are, without getting caught.", "Du kennst den Ort nicht. Finde heraus, wo ihr seid, ohne aufzufliegen.")}</span>`}
            : {name, front: `<span class="lab">${T("You are at", "Ihr seid hier")}</span><span class="big">${h(L(word))}</span><span class="sm">${T("Find the agent among you.", "Findet den Agenten unter euch.")}</span>`};
          return isImp ? {name, bad: true, front: `<span class="em">🕵️</span><span class="big">Imposter</span><span class="sm">${o.hint ? T("Category: ", "Kategorie: ") + `<b>${h(T(CATS[cat][1], CATS[cat][0]))}</b>` : T("You don't know the word. Blend in!", "Du kennst das Wort nicht. Misch dich unter!")}</span>${k > 1 ? `<span class="sm">${T(`There are ${k} imposters.`, `Es gibt ${k} Imposter.`)}</span>` : ""}`}
            : {name, front: `<span class="lab">${T("The word", "Das Wort")}</span><span class="big">${h(L(word))}</span><span class="sm">${h(T(CATS[cat][1], CATS[cat][0]))}</span>`};
        });
        ctx.start(); ctx.top();
        PG.revealRound(ctx.body, cards, () => talk(P, imps, word, other, cat));
      };

      const talk = (P, imps, word, other, cat) => {
        const first = PG.pick(P); const t = o.time;
        ctx.body.innerHTML = `<div class="pg-stage pg-pop"><div class="pg-who">${T("Everyone has seen their card", "Alle haben ihre Karte gesehen")}</div>
          <div class="pg-big"><span class="k">${T("Starts", "Es beginnt")}</span><div class="pg-name">${h(first)}</div>
          <p class="muted" style="margin:0">${o.mode === "agent" ? T("Ask the next player a question about the place. They answer and ask the next one.", "Stell der nächsten Person eine Frage über den Ort. Sie antwortet und fragt die nächste.") : T("Going round: each says one word that fits. Not too obvious, not too vague.", "Reihum sagt jeder ein Wort, das passt. Nicht zu offensichtlich, nicht zu vage.")}</p></div>
          ${t ? `<div class="pg-timer" id="itm"></div><div class="row" style="justify-content:center"><button class="btn sm" id="ip2">${T("Pause", "Pause")}</button><button class="btn sm" id="iad">+1 min</button></div>` : ""}
          <button class="btn go big" id="ivote" style="max-width:340px">${T("Vote now", "Jetzt abstimmen")}</button></div>`;
        if (t){ const tm = PG.timer($("#itm"), t * 60, () => { toast(T("Time's up! Vote.", "Zeit ist um! Abstimmen.")); });
          $("#ip2").onclick = e => { if (tm.paused){ tm.resume(); e.target.textContent = T("Pause", "Pause"); } else { tm.pause(); e.target.textContent = T("Go on", "Weiter"); } };
          $("#iad").onclick = () => tm.add(60); }
        $("#ivote").onclick = () => { PG.stopAll(); vote(P, imps, word, other, cat); };
      };

      const vote = (P, imps, word, other, cat) => {
        let sel = -1;
        const draw = () => {
          ctx.body.innerHTML = `<div class="pg-stage"><h2 class="pg-say">${T("Who is the imposter?", "Wer ist der Imposter?")}<small>${T("Point at the same time on three. Tap the one with the most votes.", "Auf drei zeigen alle gleichzeitig. Tippt die Person mit den meisten Stimmen an.")}</small></h2>
            ${PG.playerGrid(P, {sel: sel >= 0 ? [sel] : []})}
            <button class="btn go big" id="iok" ${sel < 0 ? "disabled" : ""} style="max-width:340px">${sel < 0 ? T("Pick someone", "Wähle jemanden") : T(`Reveal ${h(P[sel])}`, `${h(P[sel])} aufdecken`)}</button></div>`;
          $$("[data-p]", ctx.body).forEach(b => b.onclick = () => { sel = +b.dataset.p; draw(); });
          $("#iok").onclick = () => { if (sel >= 0) reveal(P, imps, word, other, cat, sel); };
        };
        draw();
      };

      const reveal = (P, imps, word, other, cat, acc) => {
        const caught = imps.includes(acc), names = imps.map(i => P[i]);
        const impTxt = names.length > 1 ? names.map(h).join(" & ") : h(names[0]);
        if (caught){ Sound.unlock(); } else { Sound.play("Defeat", .7); }
        const finish = guessed => {
          /* points: catch the imposter and everyone else scores; a free or clever imposter scores more */
          if (caught && !guessed) P.forEach((n, i) => { if (!imps.includes(i)) sc[n] = (sc[n] || 0) + 1; });
          else imps.forEach(i => { sc[P[i]] = (sc[P[i]] || 0) + (caught ? 1 : 2); });
          P.forEach(n => { sc[n] = sc[n] || 0; }); PG.persist();
          const crew = caught && !guessed; if (crew) PG.cheer(2); else Sound.play("Victory", .6);
          ctx.body.innerHTML = `<div class="pg-stage pg-pop"><div class="pg-big">${crew ? `<span class="pg-moon">🎉</span>` : `<span class="pg-moon">🕵️</span>`}
              <div class="pg-name" style="font-size:30px">${crew ? T("The group wins!", "Die Gruppe gewinnt!") : T("The imposter wins!", "Der Imposter gewinnt!")}</div>
              <p class="muted" style="margin:0">${T(names.length > 1 ? "Imposters" : "Imposter", "Imposter")}: <b style="color:var(--fg)">${impTxt}</b><br>${o.mode === "agent" ? T("Place", "Ort") : T("Word", "Wort")}: <b style="color:var(--fg)">${h(L(word))}</b>${other ? ` · ${T("Imposter's word", "Wort des Imposters")}: <b style="color:var(--fg)">${h(L(other))}</b>` : ""}</p></div>
            <div class="unit" style="width:100%;text-align:left"><h3>${T("Points", "Punkte")}</h3>${PG.scoreList(P, P.map(n => sc[n] || 0))}</div>
            <button class="btn go big" id="inext" style="max-width:340px">${T("Next round", "Nächste Runde")}</button><button class="btn ghost" id="iset">${T("Players & settings", "Spieler & Einstellungen")}</button></div>`;
          $("#inext").onclick = round; $("#iset").onclick = setup; ctx.stop();
        };
        if (!caught){
          ctx.body.innerHTML = `<div class="pg-stage pg-pop"><div class="pg-big"><span class="pg-moon">😬</span><div class="pg-name" style="font-size:30px">${T(`${h(P[acc])} was innocent!`, `${h(P[acc])} war unschuldig!`)}</div><p class="muted" style="margin:0">${T("Wrong guess. The imposter got away.", "Falsch getippt. Der Imposter ist davongekommen.")}</p></div>
            <button class="btn go big" id="iw" style="max-width:340px">${T("Who was it?", "Wer war es?")}</button></div>`;
          $("#iw").onclick = () => finish(false); return;
        }
        if (o.mode === "under"){
          ctx.body.innerHTML = `<div class="pg-stage pg-pop"><div class="pg-big"><span class="pg-moon">🎯</span><div class="pg-name" style="font-size:30px">${T("Caught!", "Erwischt!")}</div><p class="muted" style="margin:0">${T(`${h(P[acc])} had a different word.`, `${h(P[acc])} hatte ein anderes Wort.`)}</p></div><button class="btn go big" id="iw" style="max-width:340px">${T("Show the words", "Wörter zeigen")}</button></div>`;
          $("#iw").onclick = () => finish(false); return;
        }
        ctx.body.innerHTML = `<div class="pg-stage pg-pop"><div class="pg-big"><span class="pg-moon">🎯</span><div class="pg-name" style="font-size:30px">${T("Caught!", "Erwischt!")}</div>
            <p class="muted" style="margin:0">${T(`${h(P[acc])} is the ${o.mode === "agent" ? "agent" : "imposter"}. Last chance: say the ${o.mode === "agent" ? "place" : "word"} out loud.`, `${h(P[acc])} ist ${o.mode === "agent" ? "der Agent" : "der Imposter"}. Letzte Chance: ${o.mode === "agent" ? "Sag den Ort" : "Sag das Wort"} laut.`)}</p></div>
          <div class="grid2" style="width:100%;max-width:400px"><button class="btn big" id="ig1">${T("Guessed it", "Richtig geraten")}</button><button class="btn go big" id="ig0">${T("Wrong", "Falsch")}</button></div></div>`;
        $("#ig1").onclick = () => finish(true); $("#ig0").onclick = () => finish(false);
      };
      setup();
    }});
})();
