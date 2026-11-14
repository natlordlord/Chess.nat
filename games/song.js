/* ===== Song raten (Wunsch von Nathan): its own game now, not only the duel in Natposter's meetings.
   Pick a genre (or your own artists), hear a few seconds of a song, then type the title and/or the artist (typos are forgiven)
   or pick one of four. One phone, passed around: everyone plays their own songs, points per person.
   The clips are the 30-second previews from Apple's public search (itunes.apple.com/search), loaded like natposter.js does. ===== */
(() => {
  const {T, h} = PG;
  /* genres: an emoji, the name, artists to draw from, and (for the decades) which years count */
  const G = {
    mix:   ["🎲", "Mix", "Mix", null],
    charts:["🔥", "Hits von heute", "Today's hits", "Apache 207;Ayliva;Shirin David;Sabrina Carpenter;Billie Eilish;Dua Lipa;The Weeknd;Taylor Swift;Ed Sheeran;Miley Cyrus;Benson Boone;Teddy Swims;Chappell Roan;Hozier;Kendrick Lamar;Lady Gaga;Bruno Mars;Tate McRae;Linkin Park;Ski Aggu", [2021, 2026]],
    drap:  ["🎤", "Deutschrap", "German rap", "Apache 207;Capital Bra;RAF Camora;Bonez MC;Sido;Kool Savas;Cro;Shindy;Luciano;Ufo361;Haftbefehl;Shirin David;Kontra K;Bushido;Samra;Nimo;Badmómzjay;Pashanim;Ski Aggu;Kollegah"],
    dpop:  ["🇩🇪", "Deutsch-Pop", "German pop", "Mark Forster;LEA;Max Giesinger;Wincent Weiss;Tim Bendzko;Clueso;Silbermond;Revolverheld;Peter Fox;Johannes Oerding;Nina Chuba;Kraftklub;AnnenMayKantereit;Herbert Grönemeyer;Die Toten Hosen;Juli;Andreas Bourani;Philipp Poisel;Joris;Sportfreunde Stiller"],
    pop:   ["⭐", "Pop", "Pop", "Taylor Swift;Ed Sheeran;Dua Lipa;Ariana Grande;Justin Bieber;Rihanna;Katy Perry;Lady Gaga;Harry Styles;Bruno Mars;Adele;Shawn Mendes;Olivia Rodrigo;Sia;Coldplay;Maroon 5;Imagine Dragons;OneRepublic;Selena Gomez;Beyoncé"],
    rap:   ["🧢", "Hip-Hop", "Hip-hop", "Eminem;Drake;Kendrick Lamar;Travis Scott;Post Malone;50 Cent;Snoop Dogg;JAY-Z;Kanye West;Nicki Minaj;Cardi B;Lil Nas X;Dr. Dre;2Pac;The Notorious B.I.G.;Outkast;Pharrell Williams;Lil Wayne;J. Cole;Doja Cat"],
    rock:  ["🎸", "Rock", "Rock", "Queen;AC/DC;Nirvana;Linkin Park;Red Hot Chili Peppers;Foo Fighters;Green Day;The Killers;Arctic Monkeys;Guns N' Roses;Bon Jovi;Metallica;Rammstein;Die Ärzte;The Rolling Stones;Led Zeppelin;Oasis;Muse;Kings of Leon;The White Stripes"],
    y80:   ["📼", "80er", "80s", "Michael Jackson;Madonna;a-ha;Whitney Houston;Queen;Depeche Mode;Nena;Falco;Bon Jovi;Cyndi Lauper;Duran Duran;Eurythmics;Modern Talking;Phil Collins;Tina Turner;Toto;Europe;Bonnie Tyler;Kim Wilde;Rick Astley", [1980, 1989]],
    y90:   ["💿", "90er", "90s", "Backstreet Boys;Spice Girls;Britney Spears;Oasis;Nirvana;TLC;Eiffel 65;Scooter;Dr. Alban;Haddaway;Mr. President;Vengaboys;Aqua;Celine Dion;Mariah Carey;No Doubt;Blur;Eagle-Eye Cherry;Lou Bega;Will Smith", [1990, 1999]],
    y00:   ["📱", "2000er", "2000s", "Eminem;Beyoncé;Shakira;Rihanna;Black Eyed Peas;Linkin Park;Nelly Furtado;Justin Timberlake;Avril Lavigne;Outkast;Usher;The Killers;Amy Winehouse;Gwen Stefani;Sean Paul;Christina Aguilera;Kelly Clarkson;Coldplay;P!nk;Juanes", [2000, 2009]],
    y10:   ["🎧", "2010er", "2010s", "Avicii;Calvin Harris;Ed Sheeran;Adele;Bruno Mars;Katy Perry;Lady Gaga;Imagine Dragons;Pharrell Williams;Mark Ronson;Robin Schulz;Kygo;Lukas Graham;Sia;The Chainsmokers;Major Lazer;Justin Bieber;Lorde;Hozier;Clean Bandit", [2010, 2019]],
    party: ["🍻", "Schlager & Party", "Schlager & party", "Helene Fischer;Andrea Berg;Wolfgang Petry;DJ Ötzi;Mickie Krause;Ikke Hüftgold;Peter Wackel;Matthias Reim;Vanessa Mai;Beatrice Egli;Andreas Gabalier;Roland Kaiser;Howard Carpendale;Jürgen Drews;Michelle;Kerstin Ott;Mia Julia;Ben Zucker;Nik P.;Höhner"],
    dance: ["🪩", "Dance & EDM", "Dance & EDM", "David Guetta;Avicii;Calvin Harris;Martin Garrix;Robin Schulz;Alan Walker;Kygo;Swedish House Mafia;Tiësto;Armin van Buuren;Felix Jaehn;Marshmello;The Chainsmokers;Zedd;Alle Farben;Purple Disco Machine;Daft Punk;Topic;Lost Frequencies;Gigi D'Agostino"],
    own:   ["✍️", "Eigene Künstler", "Your own artists", null]
  };
  const pn = n => n + " " + (n === 1 ? T("point", "Punkt") : T("points", "Punkte"));
  const list = s => String(s || "").split(/[;,\n]/).map(x => x.trim()).filter(x => x.length >= 2).slice(0, 40);
  const artistsOf = o => o.genre === "own" ? list(o.own) : o.genre === "mix" ? Object.values(G).flatMap(g => g[3] ? list(g[3]) : []) : list((G[o.genre] || G.pop)[3]);
  const OKURL = /^https:\/\/[a-z0-9.-]+\.(apple|mzstatic)\.com\//;

  /* ---------- typed answers: forgiving (case, accents, "the", punctuation, "(feat. …)", " - Remastered", a typo or two) ---------- */
  const N = t => String(t || "").toLowerCase().replace(/([a-z])!([a-z])/g, "$1i$2").replace(/([a-z])\$([a-z])/g, "$1s$2").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u00df/g, "ss").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
  /* with and without a leading "the", "die", "a" … ("Killers" counts for "The Killers") */
  const forms = t => { const n = N(t), m = n.replace(/^(the|der|die|das|a|an|el|la|le) /, ""); return [...new Set([n, m])].map(x => x.replace(/ /g, "")).filter(Boolean); };
  const bare = t => String(t || "").replace(/\s*[([].*?[)\]]/g, "").replace(/\s+-\s+.*$/, "").trim() || String(t || "");
  const lev = (a, b) => { let p = Array.from({length: b.length + 1}, (_, i) => i); for (let i = 1; i <= a.length; i++){ const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[b.length]; };
  const fit1 = (a, b) => { if (!a || !b) return false; if (a === b) return true;
    /* most of a long title is enough */
    if (b.length >= 8 && a.length >= b.length * .7 && b.includes(a)) return true;
    return lev(a, b) <= (b.length >= 12 ? 3 : b.length >= 8 ? 2 : b.length >= 4 ? 1 : 0); };
  const fits = (typed, right) => forms(typed).some(a => forms(right).some(b => fit1(a, b)));
  const titleOk = (typed, t) => fits(typed, bare(t)) || fits(typed, t);
  /* an artist: the whole name, one of several ("Sia" in "David Guetta & Sia"), or a surname of five letters or more ("Swift", "Guetta") */
  const artistOk = (typed, a) => { const t = N(typed).replace(/ /g, "");
    return fits(typed, a) || String(a || "").split(/\s*(?:,|&|\band\b|\bund\b|\bfeat\.?|\bft\.?|\bx\b|\bvs\.?)\s*/i).some(p => p.length >= 2 && (fits(typed, p) || N(p).split(" ").some((w, i, W) => W.length > 1 && w.length >= 5 && fit1(t, w)))); };

  /* ---------- the songs: a pool filled from the search, a few per artist, never the same song twice ---------- */
  const seenKey = "song:seen";
  const Pool = {
    make(o){ const P = {o, songs: [], busy: 0, tried: new Set(), used: new Set((PG.st[seenKey] || []).slice(-300)), fails: 0};
      P.fetch = term => new Promise(res => { const cb = "__sgS" + Math.random().toString(36).slice(2), sc = document.createElement("script");
        const done = () => { clearTimeout(to); try { delete window[cb]; } catch(e) {} sc.remove(); }, to = setTimeout(() => { done(); res(null); }, 5000);
        window[cb] = d => { done(); res(d); }; sc.onerror = () => { done(); res(null); };
        sc.src = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&attribute=artistTerm&limit=50&country=DE&callback=${cb}`; document.head.appendChild(sc); });
      P.one = async () => { const A = artistsOf(o).filter(a => !P.tried.has(a)); if (!A.length){ P.tried.clear(); return; } const term = PG.pick(A); P.tried.add(term); P.busy++;
        try { const d = await P.fetch(term), yr = !["own", "mix"].includes(o.genre) && G[o.genre] && G[o.genre][4], seen = {};
          if (!d){ P.fails++; return; }
          const tn = N(term); let L = (d.results || []).filter(r => r.previewUrl && r.trackName && r.artistName && OKURL.test(r.previewUrl) && (N(r.artistName).includes(tn) || tn.includes(N(r.artistName))))
            .filter(r => { const k = N(bare(r.trackName)); if (!k || seen[k] || P.used.has(String(r.trackId)) || /karaoke|instrumental|\blive\b|remix|acoustic/i.test(r.trackName)) return false; seen[k] = 1; return true; });
          /* a decade: only songs from those years, if the search knows enough of them */
          if (yr){ const inY = L.filter(r => { const y = +String(r.releaseDate || "").slice(0, 4); return y >= yr[0] && y <= yr[1]; }); if (inY.length >= 3) L = inY; }
          /* the search lists an artist's best known songs first: three of the first twelve */
          PG.shuffle(L.slice(0, 12)).slice(0, 3).forEach(r => P.songs.push({id: String(r.trackId), title: String(r.trackName).slice(0, 90), artist: String(r.artistName).slice(0, 60), url: r.previewUrl, art: OKURL.test(r.artworkUrl100 || "") ? r.artworkUrl100 : null, year: String(r.releaseDate || "").slice(0, 4)}));
          P.songs = PG.shuffle(P.songs); }
        finally { P.busy--; } };
      P.fill = async (n = 8) => { let guard = 0; while (P.songs.length < n && guard++ < 6 && P.fails < 4){ await Promise.all([P.one(), P.one()]); } };
      P.next = () => { const s = P.songs.shift(); if (s){ P.used.add(s.id); PG.st[seenKey] = [...P.used].slice(-300); PG.persist(); } if (P.songs.length < 5 && !P.busy) P.fill(); return s; };
      return P; }
  };

  PG.ART.song = ["🎵", "#B65CE0"];
  PG.add({id: "song", icon: "music", name: ["Song Quiz", "Song raten"], tag: ["New", "Neu"], sub: ["Hear a clip, name the song.", "Kurz reinhören, Song erraten."], meta: ["1+ players · pick a genre", "1+ Spieler · Genre wählen"],
    mount(ctx){
      const o = PG.opt("song", {genre: "mix", what: "title", answer: "type", clip: 10, rounds: 5, own: ""});
      const au = new Audio(); au.preload = "auto"; PG.onLeave(() => { try { au.pause(); } catch(e) {} });
      let stopAt = 0; const clipOff = () => { clearTimeout(stopAt); }; PG.onLeave(clipOff);
      const play = (url, secs) => { clipOff(); try { if (au.src !== url) au.src = url; au.currentTime = 0; au.volume = 1; const p = au.play(); if (p && p.catch) p.catch(() => {}); } catch(e) {} if (secs) stopAt = setTimeout(() => { try { au.pause(); } catch(e) {} }, secs * 1000); };

      const setup = () => {
        ctx.stop(); clipOff(); try { au.pause(); } catch(e) {}
        ctx.body.innerHTML = `${ctx.title("Song Quiz", "Song raten")}<p class="muted">${T("A few seconds of a song play. Name it: type the title or the artist (typos are fine), or pick one of four. Pass the phone on, everyone gets their own songs.", "Ein paar Sekunden eines Songs laufen. Errate ihn: Titel oder Interpret eintippen (Tippfehler sind okay) oder einen von vier antippen. Danach Handy weitergeben, jeder bekommt eigene Songs.")}</p>
          <div class="unit"><h3>${T("Genre", "Genre")}</h3><div class="grid2" style="margin-top:8px" id="sgg"></div>
            <div id="sgow" ${o.genre === "own" ? "" : "hidden"} style="margin-top:10px"><input type="text" id="sgown" maxlength="400" placeholder="${T("Artists, separated by commas", "Künstler, mit Komma getrennt")}" value="${h(o.own)}" autocomplete="off" enterkeyhint="done" style="width:100%"><p class="pg-sub">${T("e.g. Cro, Queen, Shakira", "z. B. Cro, Queen, Shakira")}</p></div></div>
          <div class="unit"><h3>${T("What do you guess?", "Was wird geraten?")}</h3><div id="sgw"></div>
            <h3 style="margin-top:14px">${T("Answer", "Antworten")}</h3><div id="sga"></div>
            <h3 style="margin-top:14px">${T("Clip", "Reinhören")}</h3><div id="sgc"></div>
            <h3 style="margin-top:14px">${T("Songs per player", "Songs pro Person")}</h3><div id="sgr"></div>
            <button class="btn go big" id="sggo" style="margin-top:14px">${T("Start", "Los geht's")} 🎵</button></div>
          <div class="unit" id="sgp"></div>`;
        const gen = () => { $("#sgg").innerHTML = Object.entries(G).map(([k, g]) => `<button class="btn ${o.genre === k ? "go" : ""}" data-gn="${k}" style="justify-content:flex-start;gap:10px"><span style="font-size:22px">${g[0]}</span>${h(T(g[2], g[1]))}</button>`).join("");
          $$("[data-gn]", ctx.body).forEach(b => b.onclick = () => { o.genre = b.dataset.gn; PG.persist(); gen(); const ow = $("#sgow"); ow.hidden = o.genre !== "own"; if (!ow.hidden){ const i = $("#sgown"); try { i.focus(); } catch(e) {} } }); };
        gen();
        $("#sgown").oninput = e => { o.own = e.target.value.slice(0, 400); PG.persist(); };
        /* the keyboard comes up from below: the field glides to the middle first, so it stays in sight */
        $("#sgown").addEventListener("focus", e => setTimeout(() => { try { e.target.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth", block: "center"}); } catch(x) {} }, 60));
        const ch = (id, items, k) => { const d = () => PG.choices($(id), items, o[k], v => { o[k] = v; PG.persist(); d(); }); d(); };
        ch("#sgw", [["title", T("Title", "Titel")], ["artist", T("Artist", "Interpret")], ["both", T("Both", "Beides")]], "what");
        ch("#sga", [["type", T("Type it", "Eintippen")], ["pick", T("Pick of 4", "4 zur Auswahl")]], "answer");
        ch("#sgc", [[5, "5 s"], [10, "10 s"], [20, "20 s"], [30, "30 s"]], "clip");
        ch("#sgr", [[3, "3"], [5, "5"], [10, "10"]], "rounds");
        PG.playersUI($("#sgp"), {min: 0});
        $("#sggo").onclick = start;
      };

      const start = async () => {
        if (o.genre === "own" && !list(o.own).length){ toast(T("Type a few artists first.", "Trag erst ein paar Künstler ein.")); const i = $("#sgown"); if (i) i.focus(); return; }
        const names = PG.players().length ? PG.players() : [T("You", "Du")], pts = names.map(() => 0), log = [], total = names.length * o.rounds;
        ctx.start(); ctx.body.innerHTML = `<div class="pg-stage"><div class="sg-eq">${"<i></i>".repeat(5)}</div><p class="muted">${T("Picking songs…", "Songs werden ausgesucht…")}</p></div>`;
        const P = Pool.make(o); await P.fill(6);
        /* every song of these artists was played already: start over */
        if (!P.songs.length && P.used.size && !P.fails){ P.used.clear(); PG.st[seenKey] = []; P.tried.clear(); await P.fill(6); }
        if (!P.songs.length){ ctx.stop(); ctx.body.innerHTML = `<div class="pg-stage"><p>${T("No songs found. Check the connection or pick other artists.", "Keine Songs gefunden. Verbindung prüfen oder andere Künstler wählen.")}</p><button class="btn go big" id="sgback">${T("Back", "Zurück")}</button></div>`; $("#sgback").onclick = setup; return; }
        let turn = 0;
        const next = () => { if (turn >= total) return end(); const who = turn % names.length, s = P.next();
          if (!s){ ctx.body.innerHTML = `<div class="pg-stage"><div class="sg-eq">${"<i></i>".repeat(5)}</div><p class="muted">${T("Loading the next song…", "Nächster Song lädt…")}</p></div>`; P.fill(3).then(() => P.songs.length ? next() : end()); return; }
          /* the tap that starts the song also opens the keyboard (iPhone only allows both inside a tap) */
          ctx.body.innerHTML = `<div class="pg-stage">${names.length > 1 ? `<div class="pg-who">${T("Pass the phone to", "Gib das Handy an")}</div><div class="pg-name">${h(names[who])}</div>` : ""}
            <p class="muted" style="margin:0">${T("Song", "Song")} ${Math.floor(turn / names.length) + 1} / ${o.rounds}${names.length > 1 ? "" : ` · ${pn(pts[0])}`}</p>
            <button class="btn go big" id="sgplay" style="max-width:340px">▶ ${names.length > 1 ? T(`I'm ${h(names[who])}, play`, `Ich bin ${h(names[who])}, abspielen`) : T("Play", "Abspielen")}</button></div>`;
          $("#sgplay").onclick = () => ask(s, who); };
        const ask = (s, who) => {
          const want = o.what === "both" ? ["title", "artist"] : [o.what], pick = o.answer === "pick";
          let opts = null, done = false;
          if (pick){ const val = x => want.length > 1 ? bare(x.title) + " – " + x.artist : want[0] === "title" ? bare(x.title) : x.artist, mine = val(s), seen = new Set([N(mine)]);
            const pool = PG.shuffle(P.songs.concat(log.map(l => l.s))).map(val).filter(v => { const k = N(v); if (seen.has(k)) return false; seen.add(k); return true; });
            if (want[0] === "artist" && want.length === 1) PG.shuffle(artistsOf(o)).forEach(a => { const k = N(a); if (!seen.has(k)){ seen.add(k); pool.push(a); } });
            if (pool.length >= 3){ opts = PG.shuffle([mine].concat(pool.slice(0, 3))); } }
          const lab = k => k === "title" ? T("Title", "Titel") : T("Artist", "Interpret");
          ctx.body.innerHTML = `<div class="sg-q"><div class="sg-top"><span class="muted">${names.length > 1 ? h(names[who]) + " · " : ""}${T("Song", "Song")} ${Math.floor(turn / names.length) + 1} / ${o.rounds}</span><button class="btn ghost sm" id="sgre" data-quiet>↻ ${T("Again", "Nochmal")}</button></div>
            <div class="sg-eq on">${"<i></i>".repeat(5)}</div><div class="sg-bar"><i id="sgbar"></i></div>
            ${opts ? `<div class="sg-opts">${opts.map((v, i) => `<button class="btn big" data-op="${i}">${h(v)}</button>`).join("")}</div>`
              : `<form id="sgf" class="sg-form">${want.map((k, i) => `<label class="sg-l">${lab(k)}<input type="text" id="sg${k[0]}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="${i < want.length - 1 ? "next" : "done"}" maxlength="80"></label>`).join("")}
                <div class="sg-btns"><button type="button" class="btn big" id="sgno">${T("No idea", "Weiß nicht")}</button><button type="submit" class="btn go big" id="sgok">${T("Check", "Prüfen")}</button></div></form>`}</div>`;
          const bar = $("#sgbar"), go = () => { play(s.url, o.clip); bar.style.transition = "none"; bar.style.width = "0%"; void bar.offsetWidth; bar.style.transition = `width ${o.clip}s linear`; bar.style.width = "100%"; };
          if (!opts){ const f = $("#sg" + want[0][0]); try { f.focus({preventScroll: true}); } catch(e) {} }
          go(); $("#sgre").onclick = () => { Sound.tap(); go(); };
          const reveal = got => { if (done) return; done = true; clipOff(); const gain = got.filter(Boolean).length; pts[who] += gain; log.push({s, who, got}); if (gain) Sound.xp ? Sound.xp() : Sound.right(); else Sound.wrong(); PG.vib(gain ? 40 : [20, 30, 20]);
            /* the rest of the clip plays while you see the answer */
            try { if (au.paused) au.play().catch(() => {}); } catch(e) {}
            const mark = ok => `<b class="sg-mk ${ok ? "ok" : ""}">${ok ? "✓" : "✗"}</b>`;
            ctx.body.innerHTML = `<div class="pg-stage pg-pop"><div class="sg-ans">${s.art ? `<img src="${h(s.art)}" alt="" width="100" height="100">` : `<span class="sg-noart">🎵</span>`}<div>
                <div class="sg-t">${want.includes("title") ? mark(got[want.indexOf("title")]) : ""}${h(s.title)}</div><div class="sg-a">${want.includes("artist") ? mark(got[want.indexOf("artist")]) : ""}${h(s.artist)}${s.year ? ` · ${h(s.year)}` : ""}</div></div></div>
              <div class="pg-name" style="font-size:40px">${gain ? "+" + gain : "0"}</div><p class="muted" style="margin:0">${names.length > 1 ? h(names[who]) + ": " : ""}${pn(pts[who])}</p>
              <button class="btn go big" id="sgnx" style="max-width:340px">${turn + 1 >= total ? T("Results", "Ergebnis") : T("Next song", "Nächster Song")}</button></div>`;
            $("#sgnx").onclick = () => { try { au.pause(); } catch(e) {} turn++; next(); }; ctx.top(); };
          if (opts) $$("[data-op]", ctx.body).forEach(b => b.onclick = () => { const v = opts[+b.dataset.op], right = want.length > 1 ? bare(s.title) + " – " + s.artist : want[0] === "title" ? bare(s.title) : s.artist; reveal(want.map(() => N(v) === N(right))); });
          else { const f = $("#sgf"), ins = want.map(k => $("#sg" + k[0]));
            /* Enter in the first field goes on to the second */
            ins.forEach((inp, i) => inp.addEventListener("keydown", e => { if (e.key === "Enter" && i < ins.length - 1){ e.preventDefault(); ins[i + 1].focus(); } }));
            f.onsubmit = e => { e.preventDefault(); try { document.activeElement.blur(); } catch(e2) {} reveal(want.map((k, i) => k === "title" ? titleOk(ins[i].value, s.title) : artistOk(ins[i].value, s.artist))); };
            $("#sgno").onclick = () => { try { document.activeElement.blur(); } catch(e2) {} reveal(want.map(() => false)); }; }
        };
        const end = () => { ctx.stop(); clipOff(); try { au.pause(); } catch(e) {} const best = Math.max(...pts); if (best > 0) PG.cheer(best >= o.rounds ? 4 : 2);
          ctx.body.innerHTML = `<div class="pg-stage pg-pop"><div class="pg-big" style="min-height:0"><span class="k">${T("Result", "Ergebnis")}</span>${names.length > 1 ? `<div class="pg-name">${h(names[pts.indexOf(best)])}</div><p class="muted" style="margin:0">${T("wins", "gewinnt")}</p>` : `<div class="pg-name" style="font-size:64px">${pts[0]}</div><p class="muted" style="margin:0">${pts[0] === 1 ? T("point", "Punkt") : T("points", "Punkte")}</p>`}</div>
            ${names.length > 1 ? `<div class="unit" style="width:100%;text-align:left">${PG.scoreList(names, pts)}</div>` : ""}
            <div class="unit" style="width:100%;text-align:left"><div class="list">${log.map(l => `<div class="li">${l.s.art ? `<img src="${h(l.s.art)}" alt="" width="36" height="36" style="border-radius:6px">` : ""}<div class="grow"><div class="t">${h(l.s.title)}</div><div class="s">${h(l.s.artist)}${names.length > 1 ? " · " + h(names[l.who]) : ""}</div></div><b style="color:${l.got.some(Boolean) ? "var(--go-hi)" : "var(--dim)"}">${l.got.filter(Boolean).length ? "+" + l.got.filter(Boolean).length : "–"}</b></div>`).join("")}</div></div>
            <button class="btn go big" id="sgag" style="max-width:340px">${T("Play again", "Nochmal")}</button><button class="btn ghost" id="sgset">${T("Genre & settings", "Genre & Einstellungen")}</button></div>`;
          $("#sgag").onclick = start; $("#sgset").onclick = setup; };
        next();
      };
      setup();
    }});

  /* ---------- the look ---------- */
  const css = `
.sg-eq{display:flex;gap:6px;justify-content:center;align-items:flex-end;height:46px;margin:6px 0}
.sg-eq i{width:10px;height:30%;border-radius:4px;background:var(--go)}
.sg-eq i:nth-child(2){background:#B65CE0}.sg-eq i:nth-child(4){background:#4FA3FF}
.sg-eq.on i,.pg-stage .sg-eq i{animation:sgEq .9s ease-in-out infinite alternate}.sg-eq i:nth-child(2){animation-delay:-.3s}.sg-eq i:nth-child(3){animation-delay:-.6s}.sg-eq i:nth-child(4){animation-delay:-.15s}.sg-eq i:nth-child(5){animation-delay:-.45s}
@keyframes sgEq{from{height:18%}to{height:100%}}
.sg-q{display:flex;flex-direction:column;gap:10px;padding-top:4px}
.sg-top{display:flex;justify-content:space-between;align-items:center;font:700 14px var(--body)}
.sg-bar{height:6px;border-radius:3px;background:var(--panel-2);overflow:hidden}.sg-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--go),#B65CE0)}
.sg-form{display:flex;flex-direction:column;gap:10px}.sg-btns{display:grid;grid-template-columns:1fr 2fr;gap:8px}.sg-btns .btn{white-space:nowrap}
.sg-l{display:flex;flex-direction:column;gap:5px;font:800 13px var(--body);color:var(--muted);letter-spacing:.04em;text-transform:uppercase}
.sg-l input{font-size:18px;padding:12px 14px;width:100%;text-transform:none;letter-spacing:0}
.sg-opts{display:grid;gap:8px}.sg-opts .btn{white-space:normal;line-height:1.2;min-height:56px}
.sg-ans{display:flex;gap:14px;align-items:center;text-align:left;width:100%;max-width:420px;background:var(--panel-2);border-radius:18px;padding:12px}
.sg-ans img,.sg-noart{width:84px;height:84px;border-radius:12px;flex:none;object-fit:cover;display:grid;place-items:center;font-size:40px;background:var(--panel-3)}
.sg-t{font:900 19px/1.2 var(--display)}.sg-a{color:var(--muted);font:700 14px var(--body);margin-top:4px}
.sg-mk{display:inline-block;width:22px;color:var(--bad,#E2523E)}.sg-mk.ok{color:var(--go-hi)}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
})();
