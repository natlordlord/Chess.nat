/* ===== Song raten (Wunsch von Nathan): its own game, not only the duel in Natposter's meetings.
   Pick a genre (or your own artists), hear a few seconds of a song, then find it in the song library (like Spotify: type a few
   letters, tap the song) or pick one of four. One phone, passed around, or online: every phone loads the clip first, then a quick
   3-2-1 and it plays everywhere at the same moment, from its first second. "Immer länger": 1, 2, 3, 5, 10 seconds.
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

  /* ---------- Apple's song search (JSONP, like natposter.js): the artists' songs for the quiz, and the library when you search an answer ---------- */
  const itunes = params => new Promise(res => { const cb = "__sg" + Math.random().toString(36).slice(2), sc = document.createElement("script"); let to = 0;
    /* a late answer after the time is up must not break anything: the callback stays a while as an empty function */
    const done = () => { clearTimeout(to); window[cb] = () => {}; sc.remove(); setTimeout(() => { try { delete window[cb]; } catch(e) {} }, 30000); };
    to = setTimeout(() => { done(); res(null); }, 6000);
    window[cb] = d => { done(); res(d); }; sc.onerror = () => { done(); res(null); };
    sc.src = "https://itunes.apple.com/search?" + new URLSearchParams(Object.assign({country: "DE"}, params, {callback: cb})); document.head.appendChild(sc); });
  /* German or English title: the wrong answers come in the song's language (an English hit among three German titles is too easy to spot) */
  const DE = /\b(und|der|das|dem|den|ich|nicht|mein|meine|dein|deine|wir|ist|ein|eine|einen|auf|für|fur|mit|liebe|herz|nacht|immer|alles|nur|wie|geht|mich|dich|uns|wenn|kein|keine|zeit|heute|sommer|leben|bier|könig|ohne|schön|du|im|zu|bis|noch|sind|wird|alle|mal|jetzt|ganz|guten|morgen|tag|welt|land|lied|tanz|tanzen|sonne|regen|weg|haus|mann|frau|kind|leute|wieder|weil|über|uber|hier|dort|bitte|danke|ja|nein|warum)\b/gi;
  const EN = /\b(the|you|your|love|me|my|i|i'm|don't|dont|we|it|of|and|to|on|baby|girl|boy|night|heart|all|what|with|this|be|for|is|are|can|can't|cant|get|got|go|let|like|just|one|no|up|down|feel|time|way|want|need|world|life|dance|tonight|never|forever|again|without|back|home|eyes|day|be|she|he|they|our|from|out|that|when|where|why)\b/gi;
  const DEG = ["drap", "dpop", "party"];
  const langOf = (title, g) => { const t = String(title || ""), de = (t.match(DE) || []).length + (/[äöüß]/i.test(t) ? 2 : 0), en = (t.match(EN) || []).length; return de > en ? "de" : en > de ? "en" : DEG.includes(g) ? "de" : "en"; };
  /* which genre an artist comes from (for "Mix"), so the wrong answers fit the song */
  const genreOf = term => { for (const [k, g] of Object.entries(G)) if (g[3] && list(g[3]).some(a => N(a) === N(term))) return k; return null; };
  const valOf = (w, x) => w === "both" ? bare(x.title) + " – " + x.artist : w === "artist" ? x.artist : bare(x.title);
  /* "Immer länger": 1, 2, 3, 5, 10 seconds, each time from the start; the earlier you know it, the more points */
  const STAGES = [1, 2, 3, 5, 10], STP = [5, 4, 3, 2, 1];

  /* ---------- the songs: two random ones out of each artist's 30 best known, a random artist each time, never a song played in the last 600.
     The artist's other songs are kept aside as wrong answers, and a wrong answer is never a song that is still to come ---------- */
  const SEEN = "song:seen";
  const Pool = {
    make(o){ const P = {o, songs: [], bank: [], shown: new Set(), busy: 0, tried: new Set(), used: new Set((PG.st[SEEN] || []).slice(-600)), fails: 0};
      P.one = async () => { const all = artistsOf(o); if (!all.length) return; let A = all.filter(a => !P.tried.has(a)); if (!A.length){ P.tried.clear(); A = all; }
        const term = PG.pick(A); P.tried.add(term); P.busy++;
        try { const d = await itunes({term, entity: "song", attribute: "artistTerm", limit: 60}); if (!d){ P.fails++; return; }
          const g = ["mix", "own"].includes(o.genre) ? (genreOf(term) || o.genre) : o.genre, yr = G[o.genre] && G[o.genre][4], tn = N(term), seen = {};
          let L = (d.results || []).filter(r => r.previewUrl && r.trackName && r.artistName && OKURL.test(r.previewUrl) && (N(r.artistName).includes(tn) || tn.includes(N(r.artistName))))
            .filter(r => { const k = N(bare(r.trackName)); if (!k || seen[k] || /karaoke|instrumental|\blive\b|remix|acoustic|sped up|slowed/i.test(r.trackName)) return false; seen[k] = 1; return true; });
          /* a decade: only songs from those years, if the search knows enough of them */
          if (yr){ const inY = L.filter(r => { const y = +String(r.releaseDate || "").slice(0, 4); return y >= yr[0] && y <= yr[1]; }); if (inY.length >= 4) L = inY; }
          const top = L.slice(0, 30), titles = top.map(r => bare(String(r.trackName)).slice(0, 90));
          const mk = r => { const title = String(r.trackName).slice(0, 90); return {id: String(r.trackId), title, artist: String(r.artistName).slice(0, 60), url: r.previewUrl, art: OKURL.test(r.artworkUrl100 || "") ? r.artworkUrl100 : null, year: String(r.releaseDate || "").slice(0, 4), g, lang: langOf(bare(title), g)}; };
          const pick = PG.shuffle(top.filter(r => !P.used.has(String(r.trackId)) && !P.shown.has(N(bare(r.trackName))) && !P.songs.some(x => x.id === String(r.trackId)))).slice(0, 2);
          pick.forEach(r => { const s2 = mk(r); s2.alts = titles.filter(t => N(t) !== N(bare(s2.title))).slice(0, 20); P.songs.push(s2); });
          top.filter(r => !pick.includes(r)).forEach(r => { const x = mk(r); x.title = bare(x.title); delete x.url; P.bank.push(x); });
          if (P.bank.length > 600) P.bank.splice(0, P.bank.length - 600);
          P.songs = PG.shuffle(P.songs); }
        finally { P.busy--; } };
      P.fill = async (n = 6) => { let guard = 0; while (P.songs.length < n && guard++ < 8 && P.fails < 4) await Promise.all([P.one(), P.one()]); };
      P.next = () => { const s2 = P.songs.shift(); if (s2){ P.used.add(s2.id); PG.st[SEEN] = [...P.used].slice(-600); PG.persist(); } if (P.songs.length < 4 && !P.busy) P.fill(); return s2; };
      /* the wrong answers: the same artist's other songs first (both: two of them), then songs of the same language and genre */
      P.opts = (s2, what, n) => { const right = valOf(what, s2), seen = new Set([N(right)]), out = [];
        const add = (v, t) => { const k = N(v); if (!k || seen.has(k) || out.length >= n - 1) return; seen.add(k); out.push([v, t]); };
        const coming = P.songs, cT = new Set(coming.map(x => N(bare(x.title)))), cA = new Set(coming.map(x => N(x.artist))), cI = new Set(coming.map(x => x.id));
        const near = (a, b) => (b.lang === s2.lang) - (a.lang === s2.lang) || (b.g === s2.g) - (a.g === s2.g);
        if (what === "artist"){ const A = G[s2.g] && G[s2.g][3] ? list(G[s2.g][3]) : artistsOf(P.o);
          PG.shuffle(A.filter(a => !cA.has(N(a)))).forEach(a => add(a)); PG.shuffle(P.bank.filter(x => !cA.has(N(x.artist)))).sort(near).forEach(x => add(x.artist));
          /* very few artists of your own: then also ones that come later */
          PG.shuffle(A).forEach(a => add(a)); }
        else { const same = PG.shuffle((s2.alts || []).filter(t => !cT.has(N(t)))).map(t => ({title: t, artist: s2.artist}));
          const other = PG.shuffle(P.bank.filter(x => !cI.has(x.id) && !cT.has(N(x.title)) && N(x.artist) !== N(s2.artist))).sort(near);
          (what === "both" ? same.slice(0, 2).concat(other, same.slice(2)) : same.concat(other)).forEach(x => add(valOf(what, x), x.title)); }
        if (out.length < 2) return null;
        /* a title once shown as wrong never comes later as the song */
        out.forEach(([, t]) => { if (t) P.shown.add(N(bare(t))); });
        return PG.shuffle([right].concat(out.map(x => x[0]))); };
      return P; }
  };

  /* ---------- one player for every clip. It is loaded ahead (while the phone is passed on, or during the 3-2-1), and every clip starts
     from its very first second: the clip's time only starts counting once the sound really plays.
     The iPhone only plays sound a tap started: the first tap in the game wakes the player; it counts as music (plays on silent too) ---------- */
  const SA = (() => { const au = new Audio(); au.preload = "auto"; au.setAttribute("playsinline", ""); let ok = false, key = null, tok = 0, stopT = 0, starts = [];
    const silent = (() => { const n = 1600, b = new Uint8Array(44 + n), dv = new DataView(b.buffer), w = (o2, str) => [...str].forEach((ch, i) => { b[o2 + i] = ch.charCodeAt(0); });
      w(0, "RIFF"); dv.setUint32(4, 36 + n, true); w(8, "WAVEfmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true); w(36, "data"); dv.setUint32(40, n, true); b.fill(128, 44);
      let bin = ""; b.forEach(x => { bin += String.fromCharCode(x); }); return "data:audio/wav;base64," + btoa(bin); })();
    const music = on => { try { if (PG.audio) PG.audio.music(on); } catch(e) {} };
    const halt = () => { starts.forEach(clearTimeout); starts = []; clearTimeout(stopT); };
    const go = (k, url, secs, onNeed) => { if (key !== k) return; music(true); clearTimeout(stopT);
      const arm = () => { au.removeEventListener("playing", arm); if (key !== k) return; clearTimeout(stopT); if (secs) stopT = setTimeout(() => { if (key === k) try { au.pause(); } catch(e) {} }, secs * 1000); };
      try { au.pause(); au.muted = false; if (au.src !== url) au.src = url; try { au.currentTime = 0; } catch(e) {} au.addEventListener("playing", arm);
        Promise.resolve(au.play()).then(() => { ok = true; }).catch(e => { au.removeEventListener("playing", arm); if (key === k && (!e || e.name === "NotAllowedError")) onNeed && onNeed(); }); }
      catch(e) { onNeed && onNeed(); } };
    return {au, get ok(){ return ok; },
      unlock(){ music(true); if (ok || key || (au.src && OKURL.test(au.src)) || (typeof PVoice !== "undefined" && (PVoice.on || PVoice.starting))) return;
        try { au.muted = true; au.src = silent; Promise.resolve(au.play()).then(() => { if (au.src === silent){ au.pause(); au.muted = false; } ok = true; }).catch(() => { if (au.src === silent) au.muted = false; }); } catch(e) {} },
      /* load the clip now (played without sound for a moment, so the iPhone really loads it, then back to the start); done() once it can play */
      prep(url, done){ const my = ++tok; let fired = false, to = 0;
        const fin = () => { if (fired) return; fired = true; clearTimeout(to); au.removeEventListener("playing", fin); au.removeEventListener("canplaythrough", fin);
          if (my === tok && !key){ try { au.pause(); au.currentTime = 0; } catch(e) {} au.muted = false; } if (done) done(); };
        if (!OKURL.test(url || "")) return fin();
        key = null; halt(); music(true);
        if (au.src === url && au.readyState >= 4) return fin();
        if (au.src !== url) au.src = url;
        to = setTimeout(fin, 3500); au.addEventListener("canplaythrough", fin); au.addEventListener("playing", fin);
        try { au.muted = true; Promise.resolve(au.play()).catch(() => { if (my === tok && !key) au.muted = false; }); } catch(e) {} },
      /* the parts of a clip at the moments the host set ([{at, len}]), each from the first second */
      plan(k, url, parts, onNeed){ if (key === k || !OKURL.test(url || "")) return; key = k; tok++; halt(); music(true);
        if (au.src !== url){ au.src = url; try { au.load(); } catch(e) {} }
        const t = Date.now(); starts = parts.filter((p, i) => i === parts.length - 1 || parts[i + 1].at > t).map(p => setTimeout(() => go(k, url, p.len, onNeed), Math.max(0, p.at - Date.now()))); },
      /* a tap: from the start, right now (the phone's own game) */
      now(url, secs){ key = "n" + (++tok); halt(); go(key, url, secs); },
      /* "tap to listen" when this phone needed a tap: now, and the later parts still come on time */
      hear(url, secs){ if (key && au.src === url){ clearTimeout(stopT); go(key, url, secs); } else this.now(url, secs); },
      /* the answer is out: the rest of the preview plays on */
      rest(url){ halt(); key = "rest"; tok++; try { au.muted = false; if (au.src === url && au.paused) Promise.resolve(au.play()).catch(() => {}); } catch(e) {} },
      stop(){ key = null; tok++; halt(); try { au.pause(); } catch(e) {} au.muted = false; music(false); }}; })();
  PG.songSA = SA; PG._song = {Pool, langOf};   /* for the tests and for looking into it on a phone */
  /* the first tap in the song game wakes the player (not the voice chat buttons: the microphone comes first there) */
  document.addEventListener("pointerdown", e => { if (typeof App === "undefined" || !(App.route === "lobby" || App.route === "party") || (e.target && e.target.closest && e.target.closest("#lvoice,#lvx"))) return;
    const P = typeof PNet !== "undefined" && PNet.P, song = App.route === "party" ? PG.st.last === "song" : !!(P && (P.game === "song" || (P.msg && P.msg.game === "song"))); if (song) SA.unlock(); }, true);

  /* ---------- the song library (like Spotify): type a few letters, Apple's search lists songs (or artists), one tap is your answer.
     Enter without tapping still works: then your text is checked, forgiving typos ---------- */
  const LIB = new Map();
  function library(box, what, onPick, {auto = true} = {}){
    const art = what === "artist";
    box.innerHTML = `<form class="sg-lib" autocomplete="off"><div class="sg-sq"><span aria-hidden="true">🔎</span><input type="text" id="sgt" data-in="t" maxlength="80" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="${art ? T("Search the artist …", "Interpret suchen …") : T("Search the song …", "Song suchen …")}"></div>
      <div class="sg-sugs"></div><p class="pg-hint sg-lh">${art ? T("Type, then tap the artist.", "Tippen, dann Interpret antippen.") : T("Type, then tap the song.", "Tippen, dann Song antippen.")}</p></form>`;
    const inp = box.querySelector("input"), out = box.querySelector(".sg-sugs"), hint = box.querySelector(".sg-lh"); let tm = 0, seq = 0, L = [];
    const draw = () => { out.innerHTML = L.map((x, i) => `<button type="button" class="sg-sug" data-sg="${i}">${x.art ? `<img src="${h(x.art)}" alt="" width="40" height="40">` : `<span class="sg-sgi">${art ? "🎤" : "🎵"}</span>`}<span class="sg-sx"><b>${h(art ? x.artist : x.title)}</b>${art ? "" : `<small>${h(x.artist)}</small>`}</span></button>`).join("");
      out.querySelectorAll("[data-sg]").forEach(b => b.onclick = () => { const x = L[+b.dataset.sg]; if (!x || b.disabled) return; PG.vib(12); b.classList.add("on"); onPick({title: x.title || "", artist: x.artist || "", picked: true}); }); };
    const show = (q, d) => { const seen = new Set();
      L = ((d && d.results) || []).filter(r => art ? r.artistName : r.trackName).map(r => ({title: r.trackName ? String(r.trackName).slice(0, 90) : "", artist: String(r.artistName || "").slice(0, 60), art: OKURL.test(r.artworkUrl60 || "") ? r.artworkUrl60 : null}))
        .filter(x => { const k = art ? N(x.artist) : N(bare(x.title)) + "|" + N(x.artist); if (!k || seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
      draw(); hint.textContent = !d ? T("No connection to the library. Enter checks your text.", "Keine Verbindung zur Bibliothek. Enter prüft deinen Text.") : L.length ? "" : T("Nothing found. Enter checks your text.", "Nichts gefunden. Enter prüft deinen Text."); };
    inp.addEventListener("input", () => { clearTimeout(tm); const v = inp.value.trim(), q = (art ? "a:" : "s:") + v.toLowerCase(), my = ++seq; if (v.length < 2){ L = []; draw(); return; }
      if (LIB.has(q)) return show(v, LIB.get(q));
      tm = setTimeout(async () => { const d = await itunes(art ? {term: v, entity: "musicArtist", limit: 10} : {term: v, entity: "song", limit: 15}); if (d) LIB.set(q, d); if (my === seq) show(v, d); }, 280); });
    /* the keyboard comes up from below: the search field moves to the top, the hits stay in sight */
    inp.addEventListener("focus", () => setTimeout(() => { try { inp.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth", block: "start"}); } catch(x) {} }, 60));
    box.querySelector("form").onsubmit = e => { e.preventDefault(); const v = inp.value.trim(); if (!v) return;
      const x = L.find(y => N(art ? y.artist : bare(y.title)) === N(v)); onPick(x ? {title: x.title, artist: x.artist, picked: true} : {title: v, artist: v, picked: false}); };
    if (auto) try { inp.focus({preventScroll: true}); } catch(e) {}
    return inp; }
  /* is the answer right? a song picked from the library counts with its own title and artist; typed text is checked forgivingly,
     and a typed "title artist" counts for both */
  const has = (x, y) => { const a = N(x), b = N(y); return b.length >= 3 && (" " + a + " ").includes(" " + b + " "); };
  const judge = (what, ans, s2) => { const t = ans.picked ? bare(ans.title) : ans.title || "", r = ans.artist || "";
    if (what === "artist") return [artistOk(ans.picked ? r : r || t, s2.artist) || !ans.picked && has(t, s2.artist)];
    const tOk = titleOk(t, s2.title) || !ans.picked && has(t, bare(s2.title));
    return what === "both" ? [tOk, artistOk(r, s2.artist) || !ans.picked && has(t, s2.artist)] : [tOk]; };

  /* ================= one phone, passed around ================= */
  PG.ART.song = ["🎵", "#B65CE0"];
  PG.add({id: "song", icon: "music", name: ["Song Quiz", "Song raten"], tag: ["New", "Neu"], sub: ["Hear a clip, name the song.", "Kurz reinhören, Song erraten."], meta: ["1+ players · pick a genre", "1+ Spieler · Genre wählen"],
    mount(ctx){
      const o = PG.opt("song", {genre: "mix", what: "title", answer: "type", clip: 10, rounds: 5, own: ""});
      PG.onLeave(() => SA.stop());
      const setup = () => {
        ctx.stop(); SA.stop();
        ctx.body.innerHTML = `${ctx.title("Song Quiz", "Song raten")}<p class="muted">${T("A few seconds of a song play. Find it in the song library or pick one of four. Pass the phone on, everyone gets their own songs.", "Ein paar Sekunden eines Songs laufen. Such ihn in der Song-Bibliothek oder tipp einen von vier an. Danach Handy weitergeben, jeder bekommt eigene Songs.")}</p>
          <div class="unit"><h3>${T("Genre", "Genre")}</h3><div class="grid2" style="margin-top:8px" id="sgg"></div>
            <div id="sgow" ${o.genre === "own" ? "" : "hidden"} style="margin-top:10px"><input type="text" id="sgown" maxlength="400" placeholder="${T("Artists, separated by commas", "Künstler, mit Komma getrennt")}" value="${h(o.own)}" autocomplete="off" enterkeyhint="done" style="width:100%"><p class="pg-sub">${T("e.g. Cro, Queen, Shakira", "z. B. Cro, Queen, Shakira")}</p></div></div>
          <div class="unit"><h3>${T("What do you guess?", "Was wird geraten?")}</h3><div id="sgw"></div>
            <h3 style="margin-top:14px">${T("Answer", "Antworten")}</h3><div id="sga"></div>
            <h3 style="margin-top:14px">${T("Clip", "Reinhören")}</h3><div id="sgc"></div>
            <h3 style="margin-top:14px">${T("Songs per player", "Songs pro Person")}</h3><div id="sgr"></div>
            <button class="btn go big" id="sggo" style="margin-top:14px">${T("Start", "Los geht's")} 🎵</button></div>
          <div class="unit" id="sgp"></div>`;
        const gen = () => { $("#sgg").innerHTML = Object.entries(G).map(([k, g]) => `<button class="btn ${o.genre === k ? "go" : ""}" data-gn="${k}" style="justify-content:flex-start;gap:10px"><span style="font-size:22px">${g[0]}</span>${h(T(g[2], g[1]))}</button>`).join("");
          $$("[data-gn]", ctx.body).forEach(b => b.onclick = () => { o.genre = b.dataset.gn; PG.persist(); gen(); const ow = $("#sgow"); ow.hidden = o.genre !== "own"; if (!ow.hidden){ const i = $("#sgown"); try { i.focus({preventScroll: true}); } catch(e) {} } }); };
        gen();
        $("#sgown").oninput = e => { o.own = e.target.value.slice(0, 400); PG.persist(); };
        /* the keyboard comes up from below: the field glides to the middle first, so it stays in sight */
        $("#sgown").addEventListener("focus", e => setTimeout(() => { try { e.target.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth", block: "center"}); } catch(x) {} }, 60));
        const ch = (id, items, k) => { const d = () => PG.choices($(id), items, o[k], v => { o[k] = v; PG.persist(); d(); }); d(); };
        ch("#sgw", [["title", T("Title", "Titel")], ["artist", T("Artist", "Interpret")], ["both", T("Both", "Beides")]], "what");
        ch("#sga", [["type", T("Song library", "Song-Bibliothek")], ["pick", T("Pick of 4", "4 zur Auswahl")]], "answer");
        ch("#sgc", [[5, "5 s"], [10, "10 s"], [20, "20 s"], ["up", T("Longer and longer 1→10 s", "Immer länger 1→10 s")]], "clip");
        ch("#sgr", [[3, "3"], [5, "5"], [10, "10"]], "rounds");
        PG.playersUI($("#sgp"), {min: 0});
        $("#sggo").onclick = start;
      };

      const start = async () => {
        if (o.genre === "own" && !list(o.own).length){ toast(T("Type a few artists first.", "Trag erst ein paar Künstler ein.")); const i = $("#sgown"); if (i) i.focus(); return; }
        const names = PG.players().length ? PG.players() : [T("You", "Du")], pts = names.map(() => 0), log = [], total = names.length * o.rounds, up = o.clip === "up";
        ctx.start(); ctx.body.innerHTML = `<div class="pg-stage"><div class="sg-eq on">${"<i></i>".repeat(5)}</div><p class="muted">${T("Picking songs…", "Songs werden ausgesucht…")}</p></div>`;
        const P = Pool.make(o); await P.fill(6);
        /* every song of these artists was played already: start over */
        if (!P.songs.length && P.used.size && !P.fails){ P.used.clear(); PG.st[SEEN] = []; P.tried.clear(); await P.fill(6); }
        if (!P.songs.length){ ctx.stop(); ctx.body.innerHTML = `<div class="pg-stage"><p>${T("No songs found. Check the connection or pick other artists.", "Keine Songs gefunden. Verbindung prüfen oder andere Künstler wählen.")}</p><button class="btn go big" id="sgback">${T("Back", "Zurück")}</button></div>`; $("#sgback").onclick = setup; return; }
        let turn = 0;
        const next = () => { if (turn >= total) return end(); const who = turn % names.length, s2 = P.next();
          if (!s2){ ctx.body.innerHTML = `<div class="pg-stage"><div class="sg-eq on">${"<i></i>".repeat(5)}</div><p class="muted">${T("Loading the next song…", "Nächster Song lädt…")}</p></div>`; P.fill(3).then(() => P.songs.length ? next() : end()); return; }
          /* loaded while the phone is passed on: the tap plays it at once, from its first second */
          SA.prep(s2.url);
          ctx.body.innerHTML = `<div class="pg-stage">${names.length > 1 ? `<div class="pg-who">${T("Pass the phone to", "Gib das Handy an")}</div><div class="pg-name">${h(names[who])}</div>` : ""}
            <p class="muted" style="margin:0">${T("Song", "Song")} ${Math.floor(turn / names.length) + 1} / ${o.rounds}${names.length > 1 ? "" : ` · ${pn(pts[0])}`}</p>
            <button class="btn go big" id="sgplay" style="max-width:340px">▶ ${names.length > 1 ? T(`I'm ${h(names[who])}, play`, `Ich bin ${h(names[who])}, abspielen`) : T("Play", "Abspielen")}</button></div>`;
          /* the tap that starts the song also opens the keyboard (the iPhone only allows both inside a tap) */
          $("#sgplay").onclick = () => ask(s2, who); };
        const ask = (s2, who) => {
          const w = o.what, opts = o.answer === "pick" ? P.opts(s2, w, 4) : null; let done = false, stage = 0;
          const secs = () => up ? STAGES[stage] : +o.clip || 10;
          ctx.body.innerHTML = `<div class="sg-q"><div class="sg-top"><span class="muted">${names.length > 1 ? h(names[who]) + " · " : ""}${T("Song", "Song")} ${Math.floor(turn / names.length) + 1} / ${o.rounds}</span><button class="btn ghost sm" id="sgre" data-quiet></button></div>
            <div class="sg-eq on">${"<i></i>".repeat(5)}</div><div class="sg-bar"><i id="sgbar"></i></div>${up ? `<div class="sg-stg" id="sgstg"></div>` : ""}
            <p class="pg-say" style="margin:0">${w === "both" ? T("Title and artist?", "Titel und Interpret?") : w === "artist" ? T("Who sings?", "Wer singt?") : T("Which song?", "Welcher Song?")}</p>
            ${opts ? `<div class="sg-opts">${opts.map((v, i) => `<button class="btn big" data-op="${i}">${h(v)}</button>`).join("")}</div>` : `<div id="sglib"></div>`}
            <button class="btn ghost" id="sgno">${T("No idea", "Weiß nicht")}</button></div>`;
          const bar = $("#sgbar"), re = $("#sgre");
          const go = () => { SA.now(s2.url, secs()); bar.style.transition = "none"; bar.style.width = "0%"; void bar.offsetWidth; bar.style.transition = `width ${secs()}s linear`; bar.style.width = "100%";
            re.textContent = up && stage < STAGES.length - 1 ? "▶ " + T(`More: ${STAGES[stage + 1]} s`, `Mehr hören: ${STAGES[stage + 1]} s`) : "↻ " + T("Again", "Nochmal");
            const sg = $("#sgstg"); if (sg) sg.innerHTML = STAGES.map((L, k) => `<span class="${k <= stage ? "on" : ""}">${L} s</span>`).join("") + `<small>${T(`Right now: ${STP[stage]} points`, `Jetzt richtig: ${STP[stage]} Punkte`)}</small>`; };
          if (!opts) library($("#sglib"), w, ans => reveal(judge(w, ans, s2), ans.picked ? (w === "artist" ? ans.artist : w === "both" ? bare(ans.title) + " – " + ans.artist : bare(ans.title)) : ans.title));
          go(); re.onclick = () => { Sound.tap(); if (up && stage < STAGES.length - 1) stage++; go(); };
          const reveal = (got, said) => { if (done) return; done = true; const k = got.filter(Boolean).length, gain = up ? Math.round(k / got.length * STP[stage]) : k; pts[who] += gain; log.push({s: s2, who, got, gain});
            if (gain) Sound.xp ? Sound.xp() : Sound.right(); else Sound.wrong(); PG.vib(gain ? 40 : [20, 30, 20]);
            /* the rest of the clip plays while you see the answer */
            SA.rest(s2.url);
            const mark = ok => `<b class="sg-mk ${ok ? "ok" : ""}">${ok ? "✓" : "✗"}</b>`;
            ctx.body.innerHTML = `<div class="pg-stage pg-pop"><div class="sg-ans">${s2.art ? `<img src="${h(s2.art)}" alt="" width="100" height="100">` : `<span class="sg-noart">🎵</span>`}<div>
                <div class="sg-t">${w !== "artist" ? mark(got[0]) : ""}${h(s2.title)}</div><div class="sg-a">${w === "artist" ? mark(got[0]) : w === "both" ? mark(got[1]) : ""}${h(s2.artist)}${s2.year ? ` · ${h(s2.year)}` : ""}</div></div></div>
              ${said ? `<p class="muted" style="margin:0">${T("Your answer", "Deine Antwort")}: ${h(said)}</p>` : ""}
              <div class="pg-name" style="font-size:40px">${gain ? "+" + gain : "0"}</div><p class="muted" style="margin:0">${names.length > 1 ? h(names[who]) + ": " : ""}${pn(pts[who])}${up && gain ? ` · ${T("after", "nach")} ${STAGES[stage]} s` : ""}</p>
              <button class="btn go big" id="sgnx" style="max-width:340px">${turn + 1 >= total ? T("Results", "Ergebnis") : T("Next song", "Nächster Song")}</button></div>`;
            $("#sgnx").onclick = () => { SA.stop(); turn++; next(); }; ctx.top(); };
          if (opts) $$("[data-op]", ctx.body).forEach(b => b.onclick = () => { const v = opts[+b.dataset.op], r = N(v) === N(valOf(w, s2)); reveal(w === "both" ? [r, r] : [r], v); });
          $("#sgno").onclick = () => { try { document.activeElement.blur(); } catch(e) {} reveal(w === "both" ? [false, false] : [false], ""); };
        };
        const end = () => { ctx.stop(); SA.stop(); const best = Math.max(...pts); if (best > 0) PG.cheer(best >= o.rounds ? 4 : 2);
          ctx.body.innerHTML = `<div class="pg-stage pg-pop"><div class="pg-big" style="min-height:0"><span class="k">${T("Result", "Ergebnis")}</span>${names.length > 1 ? `<div class="pg-name">${h(names[pts.indexOf(best)])}</div><p class="muted" style="margin:0">${T("wins", "gewinnt")}</p>` : `<div class="pg-name" style="font-size:64px">${pts[0]}</div><p class="muted" style="margin:0">${pts[0] === 1 ? T("point", "Punkt") : T("points", "Punkte")}</p>`}</div>
            ${names.length > 1 ? `<div class="unit" style="width:100%;text-align:left">${PG.scoreList(names, pts)}</div>` : ""}
            <div class="unit" style="width:100%;text-align:left"><div class="list">${log.map(l => `<div class="li">${l.s.art ? `<img src="${h(l.s.art)}" alt="" width="36" height="36" style="border-radius:6px">` : ""}<div class="grow"><div class="t">${h(l.s.title)}</div><div class="s">${h(l.s.artist)}${names.length > 1 ? " · " + h(names[l.who]) : ""}</div></div><b style="color:${l.gain ? "var(--go-hi)" : "var(--dim)"}">${l.gain ? "+" + l.gain : "–"}</b></div>`).join("")}</div></div>
            <button class="btn go big" id="sgag" style="max-width:340px">${T("Play again", "Nochmal")}</button><button class="btn ghost" id="sgset">${T("Genre & settings", "Genre & Einstellungen")}</button></div>`;
          $("#sgag").onclick = start; $("#sgset").onclick = setup; };
        next();
      };
      setup();
    }});

  /* ================= Online: everyone on their own phone, the host's phone runs it =================
     Each song: the host sends it, every phone loads it and says "ready" (at most 4 s), then a quick 3-2-1 and the clip starts on all
     phones at the same moment, from its first second. Modes: everyone answers (fastest right answer +1) or the fastest right answer
     takes it; title, artist, both or the year; four or six to pick, the song library, or mixed; 5/10/20 s or "immer länger"
     (1, 2, 3, 5, 10 s: the earlier you know it, the more points). Voice chat comes from the lobby bar (net.js). */
  if (PG.online){
    let OP = null; const now = () => Date.now();
    const opool = Gm => { if (!OP || OP.gid !== Gm.gid){ OP = Pool.make({genre: Gm.opts.genre}); OP.gid = Gm.gid; (Gm.s.used || []).forEach(id => OP.used.add(id)); } return OP; };
    const live = Gm => typeof PNet !== "undefined" && PNet.P && PNet.P.G === Gm;
    const kindOf = (Gm, n) => Gm.opts.what === "year" ? "year" : Gm.opts.ans === "mixed" ? (n % 2 ? "pick" : "type") : Gm.opts.ans === "type" ? "type" : "pick";
    const players = Gm => Gm.ids.filter(x => !(Gm.s.out || {})[x]);
    const sfx = (Gm, n) => { Gm.sk = (Gm.sk || 0) + 1; Gm.s.snd = {k: "s" + Gm.sk, n}; };
    /* the 3-2-1 before the first second; the pause between the parts of "immer länger"; how late an answer may arrive and still count for the part before */
    const COUNT = 1700, GAP = 2500, LAT = 400;
    const plan = (Gm, kind) => { const t0 = now() + COUNT;
      if (Gm.opts.clip === "up"){ const st = []; let t = t0; STAGES.forEach(L => { st.push({at: t, len: L}); t += L * 1000 + GAP; }); return {st, until: t + (kind === "pick" ? 3000 : 9000)}; }
      const L = +Gm.opts.clip || 10; return {st: [{at: t0, len: L}], until: t0 + (Math.max(L, 10) + (kind === "pick" ? 6 : 16)) * 1000}; };
    const stageOf = (s, t) => { let i = 0; (s.st || []).forEach((x, k) => { if (t >= x.at + (k ? LAT : 0)) i = k; }); return i; };
    PG.online.song = {min: 2, max: 24, note: ["Every phone plays the song at the same moment: turn the sound up. Voice chat: the 🎙 at the top.", "Jedes Handy spielt den Song im selben Moment: Ton laut machen. Sprachchat: das 🎙 oben."],
      opts: [{k: "genre", l: ["Genre", "Genre"], d: "mix", c: () => Object.entries(G).filter(([k]) => k !== "own").map(([k, g]) => [k, [g[0] + " " + g[2], g[0] + " " + g[1]]])},
        {k: "mode", l: ["Mode", "Modus"], d: "all", c: [["all", ["Everyone answers", "Alle antworten"]], ["fast", ["Fastest takes it", "Wer zuerst richtig hat"]]]},
        {k: "what", l: ["Guess", "Raten"], d: "title", c: [["title", ["Title", "Titel"]], ["artist", ["Artist", "Interpret"]], ["both", ["Both", "Beides"]], ["year", ["Year", "Jahr"]]]},
        {k: "ans", l: ["Answers", "Antworten"], d: "pick", c: [["pick", ["Pick of 4", "4 zur Auswahl"]], ["pick6", ["Pick of 6", "6 zur Auswahl"]], ["type", ["Song library", "Song-Bibliothek"]], ["mixed", ["Mixed", "Gemischt"]]]},
        {k: "clip", l: ["Clip", "Reinhören"], d: 10, c: [[5, "5 s"], [10, "10 s"], [20, "20 s"], ["up", ["Longer and longer 1→10 s", "Immer länger 1→10 s"]]]},
        {k: "rounds", l: ["Songs", "Songs"], d: 10, c: [[5, "5"], [10, "10"], [15, "15"]]}],
      start(Gm, api){ Gm.gid = Math.random().toString(36).slice(2); Gm.s = {n: 0, pts: {}, phase: "load", log: [], used: (Gm.s && Gm.s.used) || [], out: {}}; this.next(Gm, api); },
      next(Gm, api){ const s = Gm.s; if (s.n >= +Gm.opts.rounds){ s.phase = "end"; s.until = 0; sfx(Gm, "cheer"); return; }
        const P = opool(Gm), song = P.songs.length ? P.next() : null;
        if (!song){ s.phase = "load"; if (!s.loading){ s.loading = 1; P.fill(6).then(() => { s.loading = 0; if (!live(Gm) || Gm.s !== s || s.phase !== "load") return; if (P.songs.length) this.next(Gm, api); else s.phase = "fail"; api.push(); }); } return; }
        s.n++; s.used.push(song.id); s.cur = song; s.kind = kindOf(Gm, s.n); s.ans = {}; s.win = null; s.first = null; s.opts = null; s.ready = {}; s.st = null;
        if (s.kind === "pick"){ s.opts = P.opts(song, Gm.opts.what, Gm.opts.ans === "pick6" ? 6 : 4); if (!s.opts) s.kind = "type"; }
        /* every phone loads the clip first; after 4 s it starts anyway */
        s.phase = "prep"; s.until = now() + 4000; },
      go(Gm){ const s = Gm.s, p = plan(Gm, s.kind); s.phase = "play"; s.st = p.st; s.t0 = p.st[0].at; s.until = p.until; sfx(Gm, "go"); },
      act(Gm, id, a, api){ const s = Gm.s, w = Gm.opts.what;
        if (a.a === "again" && id === Gm.host && s.phase === "end"){ Gm.s = {n: 0, pts: {}, phase: "load", log: [], used: s.used.slice(-600), out: {}}; this.next(Gm, api); return; }
        if (a.a === "next" && id === Gm.host && s.phase === "rev"){ this.next(Gm, api); return; }
        if (a.a === "ready"){ if (s.phase === "prep" && a.k === "p" + s.n){ s.ready[id] = 1; if (players(Gm).every(x => s.ready[x])) this.go(Gm); } return; }
        if (s.phase !== "play" || s.ans[id] || !players(Gm).includes(id) || now() < s.t0 - 300 || (Gm.opts.mode === "fast" && s.win)) return;
        const c = s.cur, t = now(), ms = Math.max(0, t - s.t0), stage = stageOf(s, t); let ok, raw = "";
        if (a.a === "skip"){ s.ans[id] = {raw: "", ms, ok: w === "both" && s.kind !== "year" ? [false, false] : [false], d: 99, stage, sk: 1}; return this.check(Gm); }
        if (a.a === "pick" && s.kind === "pick" && s.opts){ const v = s.opts[+a.v]; if (v == null) return; raw = v; const r = N(v) === N(valOf(w, c)); ok = w === "both" ? [r, r] : [r]; }
        else if (a.a === "type" && s.kind === "type"){ const f = a.f || {}, ans = {title: String(f.t || "").slice(0, 90), artist: String(f.r || "").slice(0, 60), picked: !!f.p};
          raw = ans.picked ? (w === "artist" ? ans.artist : w === "both" ? bare(ans.title) + " – " + ans.artist : bare(ans.title)) : ans.title; ok = judge(w, ans, c); }
        else if (a.a === "year" && s.kind === "year"){ const y = parseInt(String((a.f || {}).y || "").replace(/\D/g, "").slice(0, 4), 10), d = isNaN(y) ? 99 : Math.abs(y - (+c.year || 0)); raw = isNaN(y) ? "" : String(y); s.ans[id] = {raw, ms, ok: [d <= 5], d, stage}; return this.check(Gm); }
        else return;
        s.ans[id] = {raw, ms, ok, stage}; if (Gm.opts.mode === "fast" && ok.every(Boolean)) s.win = id; this.check(Gm); },
      check(Gm){ const s = Gm.s; if (s.phase === "play" && (s.win || players(Gm).every(x => s.ans[x]))) this.reveal(Gm); },
      reveal(Gm){ const s = Gm.s, w = Gm.opts.what, up = Gm.opts.clip === "up", gain = {}; s.phase = "rev"; s.until = now() + 12000;
        const sp = x => STP[Math.min(STP.length - 1, (s.ans[x] || {}).stage || 0)];
        if (s.kind === "year") Gm.ids.forEach(x => { const a = s.ans[x]; gain[x] = !a || a.d > 5 ? 0 : a.d === 0 ? 3 : a.d <= 2 ? 2 : 1; });
        else if (Gm.opts.mode === "fast") Gm.ids.forEach(x => { gain[x] = x === s.win ? (up ? sp(x) : 3) : 0; });
        else { const full = Gm.ids.filter(x => s.ans[x] && s.ans[x].ok.every(Boolean)).sort((a, b) => s.ans[a].ms - s.ans[b].ms);
          Gm.ids.forEach(x => { const a = s.ans[x]; if (!a){ gain[x] = 0; return; } const k = a.ok.filter(Boolean).length; gain[x] = up ? Math.round(k / a.ok.length * sp(x)) : k * (w === "both" ? 1 : 2); });
          if (full.length){ s.first = full[0]; gain[full[0]] += 1; } }
        Gm.ids.forEach(x => { s.pts[x] = (s.pts[x] || 0) + gain[x]; }); s.gain = gain;
        s.log.push({s: {title: s.cur.title, artist: s.cur.artist, year: s.cur.year, art: s.cur.art}, best: Object.keys(gain).filter(x => gain[x] > 0 && gain[x] === Math.max(...Object.values(gain)))});
        sfx(Gm, Object.values(gain).some(Boolean) ? "xp" : "wrong"); },
      tick(Gm, api){ const s = Gm.s;
        if (s.phase === "prep" && now() >= s.until){ this.go(Gm); return true; }
        if (s.phase === "play" && now() >= s.until){ this.reveal(Gm); return true; }
        if (s.phase === "rev" && now() >= s.until){ this.next(Gm, api); return true; } },
      gone(Gm, id){ const s = Gm.s; s.out = s.out || {}; s.out[id] = 1; if (s.phase === "prep" && players(Gm).every(x => s.ready[x])) this.go(Gm); this.check(Gm); },
      view(Gm, id, api){ const s = Gm.s, base = {custom: "song", host: id === Gm.host, snd: s.snd || null};
        if (s.phase === "load") return Object.assign(base, {k: "load" + s.n, ph: "load"});
        if (s.phase === "fail") return Object.assign(base, {k: "fail", ph: "fail"});
        if (s.phase === "prep") return Object.assign(base, {k: "p" + s.n, ph: "prep", n: s.n, of: +Gm.opts.rounds, url: s.cur.url});
        const tot = Gm.ids.map(x => ({n: api.name(x), p: s.pts[x] || 0, me: x === id})).sort((a, b) => b.p - a.p), up = Gm.opts.clip === "up";
        if (s.phase === "play"){ const me = s.ans[id], t = now();
          return Object.assign(base, {k: "q" + s.n, ph: "play", n: s.n, of: +Gm.opts.rounds, url: s.cur.url, st: s.st.map(x => ({in: x.at - t, len: x.len})), left: s.until - t, kind: s.kind, what: Gm.opts.what, opts: s.opts, fast: Gm.opts.mode === "fast", up,
            done: !!me, wrong: !!(me && Gm.opts.mode === "fast" && !me.sk && !me.ok.every(Boolean)), got: players(Gm).filter(x => s.ans[x]).length, all: players(Gm).length}); }
        if (s.phase === "rev") return Object.assign(base, {k: "r" + s.n, ph: "rev", n: s.n, of: +Gm.opts.rounds, last: s.n >= +Gm.opts.rounds, title: s.cur.title, artist: s.cur.artist, year: s.cur.year, art: s.cur.art, url: s.cur.url, kind: s.kind, what: Gm.opts.what, left: s.until - now(), mine: s.gain[id] || 0,
          rows: Gm.ids.map(x => ({n: api.name(x), me: x === id, a: (s.ans[x] || {}).raw || "", ok: s.ans[x] ? s.ans[x].ok : null, g: s.gain[x] || 0, top: s.first === x || s.win === x, sec: up && s.ans[x] && s.ans[x].ok.some(Boolean) ? STAGES[s.ans[x].stage || 0] : null})).sort((a, b) => b.g - a.g), tot});
        return Object.assign(base, {k: "end", ph: "end", tot, log: s.log.map(l => ({t: l.s.title, a: l.s.artist, art: l.s.art, w: l.best.map(x => api.name(x)).join(", ")}))}); }
    };

    /* ---- what each phone shows (built here from plain text and Apple's picture links only) ---- */
    const V = {k: null, tk: 0, end: 0, st: [], sent: null, snd: null, rdy: null};
    const SND = {go: () => Sound.play("Capture", .5), xp: () => (Sound.xp ? Sound.xp() : Sound.right()), wrong: () => Sound.wrong(), cheer: () => PG.cheer(3)};
    const md = x => h(x);
    const LOCK = "[data-op], [data-skip], .sg-form input, .sg-form button, .sg-lib input, .sg-sug";
    PG.custom.song = {
      stop(){ SA.stop(); clearInterval(V.tk); V.k = null; },
      draw(body, v, m, act){
        if (v.snd && v.snd.k !== V.snd){ V.snd = v.snd.k; try { (SND[v.snd.n] || (() => {}))(); } catch(e) {} }
        const fresh = V.k !== v.k || !body.querySelector(".sg-on");
        /* times: taken once per question from what the host said (a later update only corrects a big drift of the end) */
        if (V.k !== v.k){ V.k = v.k; V.sent = null; if (v.st) V.st = v.st.map(x => ({at: Date.now() + x.in, len: x.len})); if (v.left != null) V.end = Date.now() + v.left; }
        else if (v.left != null && Math.abs(Date.now() + v.left - V.end) > 1500) V.end = Date.now() + v.left;
        const hostBar = v.host ? `<button class="btn ghost sm" data-x="lobby" style="margin-top:12px;opacity:.75">${T("End round · back to the lobby", "Runde beenden · zurück zur Lobby")}</button>` : "";
        if (v.ph === "load" || v.ph === "fail" || v.ph === "prep"){
          /* load the next clip now and tell the host when it can play */
          if (v.ph === "prep" && V.rdy !== v.k){ V.rdy = v.k; SA.prep(v.url, () => act({a: "ready", k: v.k})); }
          if (fresh){ if (v.ph !== "prep") SA.stop();
            body.innerHTML = `<div class="pg-stage sg-on"><div class="sg-eq ${v.ph !== "fail" ? "on" : ""}">${"<i></i>".repeat(5)}</div><p class="muted">${v.ph === "prep" ? T(`Song ${v.n} of ${v.of} · get ready…`, `Song ${v.n} von ${v.of} · gleich geht's los…`) : v.ph === "load" ? T("Picking songs…", "Songs werden ausgesucht…") : T("No songs found. Check the connection or pick another genre.", "Keine Songs gefunden. Verbindung prüfen oder anderes Genre wählen.")}</p>${hostBar}</div>`; } }
        else if (v.ph === "play"){
          if (fresh){ const W = v.what;
            body.innerHTML = `<div class="sg-q sg-on wait"><div class="sg-top"><span class="muted">${T("Song", "Song")} ${v.n} / ${v.of}${v.fast ? " · ⚡ " + T("fastest takes it", "wer zuerst richtig hat") : ""}</span><b class="sg-left" data-left></b></div>
              <div class="sg-cd" data-cd></div><div class="sg-eq on">${"<i></i>".repeat(5)}</div><div class="sg-bar"><i data-bar></i></div>${v.up ? `<div class="sg-stg" data-stg></div>` : ""}<button class="btn go big" data-x="hear" hidden>▶ ${T("Tap to listen", "Tippen zum Hören")}</button>
              <p class="pg-say" style="margin:0">${W === "year" ? T("Which year?", "Aus welchem Jahr?") : W === "both" ? T("Title and artist?", "Titel und Interpret?") : W === "artist" ? T("Who sings?", "Wer singt?") : T("Which song?", "Welcher Song?")}</p>
              ${v.kind === "pick" ? `<div class="sg-opts ${v.opts.length > 4 ? "six" : ""}">${v.opts.map((o, i) => `<button class="btn big" data-op="${i}">${md(o)}</button>`).join("")}</div>`
                : v.kind === "year" ? `<form class="sg-form" data-f="year"><label class="sg-l">${T("Year", "Jahr")}<input type="text" inputmode="numeric" maxlength="4" data-in="y" autocomplete="off" placeholder="z. B. 1985" enterkeyhint="done"></label><button type="submit" class="btn go big">${T("Lock in", "Abgeben")}</button></form>`
                : `<div data-lib></div>`}
              <button class="btn ghost" data-skip>${T("No idea", "Weiß nicht")}</button><p class="pg-hint" data-st></p>${hostBar}</div>`;
            const q = body.querySelector(".sg-q"), lock = () => body.querySelectorAll(LOCK).forEach(x => { x.disabled = true; });
            const send = a => { if (V.sent) return; V.sent = a.a; act(a); lock(); };
            body.querySelectorAll("[data-op]").forEach(b => b.onclick = () => { if (V.sent) return; b.classList.add("go"); PG.vib(15); send({a: "pick", v: b.dataset.op}); });
            const f = body.querySelector(".sg-form"); if (f){ const ins = [...f.querySelectorAll("input")]; f.onsubmit = e => { e.preventDefault(); if (V.sent) return; const o = {}; ins.forEach(i => { o[i.dataset.in] = i.value.trim().slice(0, 80); }); try { document.activeElement.blur(); } catch(x) {} send({a: f.dataset.f, f: o}); }; }
            const lb = body.querySelector("[data-lib]"); if (lb) library(lb, W, ans => { try { document.activeElement.blur(); } catch(x) {} send({a: "type", f: {t: ans.title, r: ans.artist, p: ans.picked ? 1 : 0}}); }, {auto: false});
            body.querySelector("[data-skip]").onclick = () => { try { document.activeElement.blur(); } catch(x) {} send({a: "skip"}); };
            const partNow = () => { const t = Date.now(); let i = 0; V.st.forEach((x, k) => { if (t >= x.at) i = k; }); return i; };
            const hear = body.querySelector('[data-x="hear"]'); hear.onclick = () => { hear.hidden = true; const p = V.st[partNow()]; SA.hear(v.url, p ? p.len : 10); };
            /* every part of the clip starts on this phone at its moment, from the first second */
            SA.plan(v.k, v.url, V.st, () => { const b = body.querySelector('[data-x="hear"]'); if (b) b.hidden = false; });
            const bar = body.querySelector("[data-bar]"), cd = body.querySelector("[data-cd]"); clearInterval(V.tk);
            const run = () => { if (!bar.isConnected) return clearInterval(V.tk); const t = Date.now(), i = partNow(), cur = V.st[i] || {at: t, len: 1};
              bar.style.width = Math.max(0, Math.min(100, (t - cur.at) / (cur.len * 1000) * 100)) + "%";
              /* the quick 3-2-1, then the sound; answers are open from the first second on */
              const pre = V.st[0] ? V.st[0].at - t : 0; cd.textContent = pre > 0 ? String(Math.min(3, Math.ceil(pre / 500))) : ""; cd.classList.toggle("on", pre > 0); q.classList.toggle("wait", pre > 0);
              const sg = body.querySelector("[data-stg]"); if (sg){ const nx = V.st[i + 1], k = sg.dataset.k, nk = i + ":" + (t >= cur.at) + ":" + !!(nx && t > cur.at + cur.len * 1000);
                if (k !== nk){ sg.dataset.k = nk; sg.innerHTML = STAGES.map((L, j) => `<span class="${j < i || (j === i && t >= cur.at) ? "on" : ""}">${L} s</span>`).join("") + `<small>${nx && t > cur.at + cur.len * 1000 ? T(`Next: ${nx.len} s`, `Gleich: ${nx.len} s`) : T(`Right now: ${STP[i]} points`, `Jetzt richtig: ${STP[i]} Punkte`)}</small>`; } }
              const L = body.querySelector("[data-left]"); if (L){ const sl = Math.max(0, Math.ceil((V.end - t) / 1000)); L.textContent = pre > 0 ? "" : sl + " s"; L.classList.toggle("low", sl <= 5); } };
            V.tk = setInterval(run, 100); run(); }
          if (v.done && !V.sent){ V.sent = "x"; body.querySelectorAll(LOCK).forEach(x => { x.disabled = true; }); }
          const st = body.querySelector("[data-st]"); if (st) st.textContent = v.wrong ? T("Not right. Wait for the others…", "Leider falsch. Warte auf die anderen…") : v.done || V.sent ? T(`Locked in. ${v.got} of ${v.all} have answered.`, `Abgegeben. ${v.got} von ${v.all} haben geantwortet.`) : T(`${v.got} of ${v.all} have answered.`, `${v.got} von ${v.all} haben geantwortet.`); }
        else if (v.ph === "rev"){
          if (fresh){ clearInterval(V.tk); SA.rest(v.url); const mk = ok => ok == null ? "<b class=\"sg-mk\">–</b>" : ok.map(x => `<b class="sg-mk ${x ? "ok" : ""}">${x ? "✓" : "✗"}</b>`).join("");
            body.innerHTML = `<div class="pg-stage pg-pop sg-on"><div class="sg-ans">${v.art && OKURL.test(v.art) ? `<img src="${h(v.art)}" alt="" width="100" height="100">` : `<span class="sg-noart">🎵</span>`}<div><div class="sg-t">${md(v.title)}</div><div class="sg-a">${md(v.artist)}${v.year ? ` · ${md(v.year)}` : ""}</div></div></div>
              <div class="pg-name" style="font-size:40px">${v.mine ? "+" + v.mine : "0"}</div>
              <div class="unit" style="width:100%;text-align:left;margin:0"><div class="list">${v.rows.map(r => `<div class="li" style="${r.me ? "box-shadow:inset 0 0 0 1.5px var(--go)" : ""}"><span style="width:${v.what === "both" && v.kind !== "year" ? 44 : 22}px">${mk(r.ok)}</span><div class="grow"><div class="t">${md(r.n)}${r.top ? " ⚡" : ""}${r.sec ? ` <small class="muted">${T("after", "nach")} ${r.sec} s</small>` : ""}</div><div class="s">${md(r.a || "–")}</div></div><b style="font:900 18px var(--display)">${r.g ? "+" + r.g : "0"}</b></div>`).join("")}</div></div>
              <div class="unit" style="width:100%;text-align:left;margin:0"><h3>${T("Total", "Gesamt")}</h3><div class="list">${v.tot.map((r, i) => `<div class="li"><span class="pg-rank">${i + 1}</span><div class="grow t">${md(r.n)}${r.me ? " (" + T("you", "du") + ")" : ""}</div><b style="font:900 18px var(--display)">${r.p}</b></div>`).join("")}</div></div>
              ${v.host ? `<button class="btn go big" data-x="next" style="max-width:340px">${v.last ? T("Results", "Ergebnis") : T("Next song", "Nächster Song")}</button>` : `<p class="pg-hint">${T("The next song comes in a moment…", "Gleich kommt der nächste Song…")}</p>`}${hostBar}</div>`; } }
        else if (v.ph === "end"){
          if (fresh){ clearInterval(V.tk); SA.stop();
            body.innerHTML = `<div class="pg-stage pg-pop sg-on"><div class="pg-moon">🏆</div><div class="pg-name">${md(v.tot[0] ? v.tot[0].n : "")}</div><p class="muted" style="margin:0">${T("wins", "gewinnt")}</p>
              <div class="unit" style="width:100%;text-align:left;margin:0"><div class="list">${v.tot.map((r, i) => `<div class="li"><span class="pg-rank">${i + 1}</span><div class="grow t">${md(r.n)}${r.me ? " (" + T("you", "du") + ")" : ""}</div><b style="font:900 18px var(--display)">${r.p}</b></div>`).join("")}</div></div>
              <div class="unit" style="width:100%;text-align:left;margin:0"><h3>${T("The songs", "Die Songs")}</h3><div class="list">${v.log.map(l => `<div class="li">${l.art && OKURL.test(l.art) ? `<img src="${h(l.art)}" alt="" width="36" height="36" style="border-radius:6px">` : ""}<div class="grow"><div class="t">${md(l.t)}</div><div class="s">${md(l.a)}${l.w ? " · ⭐ " + md(l.w) : ""}</div></div></div>`).join("")}</div></div>
              ${v.host ? `<button class="btn go big" data-x="again" style="max-width:340px">${T("New game", "Neues Spiel")}</button><button class="btn ghost" data-x="lobby">${T("Back to the lobby", "Zurück zur Lobby")}</button>` : `<p class="pg-hint">${T("The host starts the next game.", "Der Gastgeber startet das nächste Spiel.")}</p>`}</div>`; } }
        if (fresh) body.querySelectorAll("[data-x]").forEach(b => { if (b.dataset.x === "hear") return; b.onclick = () => { const x = b.dataset.x; if (x === "lobby" && !b.dataset.armed && v.ph !== "end"){ b.dataset.armed = 1; b.textContent = T("Sure? Tap again", "Sicher? Nochmal tippen"); return; } act({a: x}); }; });
      }
    };
  }

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
.sg-opts{display:grid;gap:8px}.sg-opts .btn{white-space:normal;line-height:1.2;min-height:56px}.sg-opts.six{grid-template-columns:1fr 1fr}.sg-opts.six .btn{font-size:15px;min-height:64px}.sg-left{font:900 16px var(--display)}.sg-left.low{color:var(--bad,#E2523E)}
.sg-ans{display:flex;gap:14px;align-items:center;text-align:left;width:100%;max-width:420px;background:var(--panel-2);border-radius:18px;padding:12px}
.sg-ans img,.sg-noart{width:84px;height:84px;border-radius:12px;flex:none;object-fit:cover;display:grid;place-items:center;font-size:40px;background:var(--panel-3)}
.sg-t{font:900 19px/1.2 var(--display)}.sg-a{color:var(--muted);font:700 14px var(--body);margin-top:4px}
.sg-mk{display:inline-block;width:22px;color:var(--bad,#E2523E)}.sg-mk.ok{color:var(--go-hi)}
.sg-q.wait .sg-opts,.sg-q.wait [data-lib],.sg-q.wait [data-skip]{opacity:.45;pointer-events:none}
.sg-cd{position:fixed;left:50%;top:40%;transform:translate(-50%,-50%) scale(.6);font:900 120px/1 var(--display);color:#fff;text-shadow:0 6px 30px rgba(0,0,0,.5);opacity:0;pointer-events:none;z-index:60;transition:opacity .12s,transform .12s}
.sg-cd.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
.sg-stg{display:flex;gap:6px;justify-content:center;align-items:center;flex-wrap:wrap}.sg-stg span{font:800 13px var(--body);padding:4px 10px;border-radius:999px;background:var(--panel-2);color:var(--muted)}.sg-stg span.on{background:var(--go);color:#fff}.sg-stg small{width:100%;text-align:center;color:var(--muted);font:700 12.5px var(--body)}
.sg-lib{display:flex;flex-direction:column;gap:8px;scroll-margin-top:12px}.sg-sq{display:flex;align-items:center;gap:8px;background:var(--panel-2);border-radius:14px;padding:0 12px;box-shadow:inset 0 0 0 1.5px rgba(127,127,127,.3)}.sg-sq:focus-within{box-shadow:inset 0 0 0 2px var(--go)}
.sg-sq input{flex:1;min-width:0;border:0;background:none;font-size:18px;padding:13px 0;color:inherit;outline:0;box-shadow:none}
.sg-sugs{display:flex;flex-direction:column;gap:6px}.sg-sug{display:flex;align-items:center;gap:10px;width:100%;border:0;border-radius:12px;background:var(--panel-2);color:inherit;padding:7px 10px;text-align:left;cursor:pointer;font:inherit;min-height:54px}
.sg-sug img,.sg-sgi{width:40px;height:40px;border-radius:8px;flex:none;object-fit:cover;display:grid;place-items:center;background:var(--panel-3);font-size:20px}.sg-sx{display:flex;flex-direction:column;min-width:0}
.sg-sx b{font:800 15px var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sg-sx small{color:var(--muted);font:700 12.5px var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sg-sug.on{box-shadow:inset 0 0 0 2px var(--go)}.sg-sug:disabled{opacity:.55}.sg-lh:empty{display:none}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
})();
