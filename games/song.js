/* ===== Song raten (Wunsch von Nathan): its own game, not only the duel in Natposter's meetings.
   Pick a genre (or your own artists, or your Spotify playlist), hear a few seconds of a song, then find it in the song library
   (like Spotify: type a few letters, tap the song) or pick one of four. One phone, passed around, or online with game modes
   (Party, Pro, Longer and longer, Buzzer, Timeline, Music bingo, Whose song?, Year, your own saved rules): everyone wishes for a
   genre first, every phone loads the clip, a quick 3-2-1, then it plays everywhere at the same moment.
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
    y20:   ["🆕", "2020er", "2020s", "Harry Styles;Olivia Rodrigo;Dua Lipa;The Weeknd;Doja Cat;Billie Eilish;Sabrina Carpenter;Benson Boone;Miley Cyrus;Jack Harlow;Lizzo;Glass Animals;Måneskin;Tate McRae;SZA;Chappell Roan;Teddy Swims;Gracie Abrams;Ayliva;Apache 207", [2020, 2026]],
    y60:   ["🕺", "60er & 70er", "60s & 70s", "The Beatles;ABBA;Elvis Presley;The Rolling Stones;Bee Gees;Elton John;David Bowie;Fleetwood Mac;Stevie Wonder;Aretha Franklin;Marvin Gaye;Boney M.;The Beach Boys;Simon & Garfunkel;Creedence Clearwater Revival;Bob Marley & The Wailers;The Doors;Donna Summer;Queen;Led Zeppelin", [1960, 1979]],
    rnb:   ["💜", "R&B & Soul", "R&B & soul", "Beyoncé;Usher;Alicia Keys;SZA;The Weeknd;Frank Ocean;Rihanna;Chris Brown;John Legend;Mariah Carey;Whitney Houston;Bruno Mars;H.E.R.;Ne-Yo;Destiny's Child;Amy Winehouse;Daniel Caesar;Brent Faiyaz;Jorja Smith;Summer Walker"],
    latin: ["💃", "Latin & Reggaeton", "Latin & reggaeton", "Bad Bunny;J Balvin;Shakira;Daddy Yankee;KAROL G;Ozuna;ROSALÍA;Maluma;Luis Fonsi;Enrique Iglesias;Ricky Martin;Becky G;Anuel AA;Rauw Alejandro;Peso Pluma;Feid;Camilo;Nicky Jam;Pitbull;Marc Anthony"],
    kpop:  ["🇰🇷", "K-Pop", "K-pop", "BTS;BLACKPINK;TWICE;Stray Kids;NewJeans;SEVENTEEN;EXO;Red Velvet;ITZY;aespa;IVE;LE SSERAFIM;(G)I-DLE;Jung Kook;Jimin;PSY;BIGBANG;TOMORROW X TOGETHER;ATEEZ;ROSÉ"],
    indie: ["🌿", "Indie & Alternative", "Indie & alternative", "Arctic Monkeys;The Killers;Tame Impala;Florence + The Machine;Lana Del Rey;The 1975;Glass Animals;Vampire Weekend;MGMT;Foster the People;Two Door Cinema Club;Bastille;alt-J;Mumford & Sons;Hozier;The Strokes;Franz Ferdinand;Phoenix;Cage the Elephant;Wet Leg"],
    metal: ["🤘", "Metal & Punk", "Metal & punk", "Metallica;Rammstein;Slipknot;System of a Down;Iron Maiden;Linkin Park;Green Day;The Offspring;blink-182;Sum 41;Bring Me the Horizon;Avenged Sevenfold;Disturbed;Korn;Limp Bizkit;Rage Against the Machine;Papa Roach;Billy Talent;Die Toten Hosen;Volbeat"],
    film:  ["🎬", "Filmhits & Soundtracks", "Movie hits & soundtracks", "Idina Menzel;Lin-Manuel Miranda;Auli'i Cravalho;Hugh Jackman;Zac Efron;Lady Gaga;Céline Dion;Whitney Houston;Phil Collins;Elton John;Jessie J;Ryan Gosling;Emma Stone;Keala Settle;Kristen Bell;Mandy Moore;Dwayne Johnson;Bonnie Tyler;Kenny Loggins;Survivor"],
    xmas:  ["🎄", "Weihnachten", "Christmas", "Mariah Carey;Wham!;Michael Bublé;Chris Rea;Band Aid;Shakin' Stevens;Brenda Lee;Bobby Helms;José Feliciano;Bing Crosby;Frank Sinatra;Dean Martin;Ariana Grande;Justin Bieber;Kelly Clarkson;Rolf Zuckowski;Helene Fischer;Andrea Berg;Michael Bolton;The Pogues", null, "christmas|xmas|santa|snow|jingle|mistletoe|winter|navidad|rudolph|bells|holiday|sleigh|weihnacht|stille nacht|tannenbaum|schnee|nikolaus|advent|frohe"],
    disney: ["🏰", "Disney", "Disney", "Idina Menzel;Kristen Bell;Auli'i Cravalho;Dwayne Johnson;Phil Collins;Elton John;Jodi Benson;Samuel E. Wright;Nathan Lane;Jason Weaver;Mandy Moore;Robin Williams;Lea Salonga;Brad Kane;Angela Lansbury;Anika Noni Rose;Stephanie Beatriz;Jessica Darrow;Carolina Gaitán;Josh Gad;Julie Andrews;Phil Harris;Randy Newman;Shakira;Sebastián Yatra;Ariana DeBose;Naomi Scott;Donny Osmond;Judy Kuhn;Jeremy Irons"],
    musical: ["🎭", "Musicals", "Musicals", "Hugh Jackman;Keala Settle;Zac Efron;Loren Allred;Lin-Manuel Miranda;Leslie Odom, Jr.;Idina Menzel;Kristin Chenoweth;Ben Platt;John Travolta;Olivia Newton-John;Meryl Streep;Amanda Seyfried;Anne Hathaway;Elaine Paige;Ryan Gosling;Emma Stone;Julie Andrews;Judy Garland;Liza Minnelli;Gene Kelly;Catherine Zeta-Jones;Tim Curry;Jonathan Groff;Glee Cast;Vanessa Hudgens"],
    series: ["📺", "Serien-Songs", "TV series songs", "The Rembrandts;Kate Bush;Lady Gaga;Snow Patrol;The Fray;Jace Everett;Alabama 3;Phantom Planet;Lazlo Bane;Gavin DeGraw;Paula Cole;Carole King;Barenaked Ladies;Labrinth;Ramin Djawadi;Nick Cave & The Bad Seeds;Manu Pilas;Remy Zero;Jimi Jamison;They Might Be Giants;Julee Cruise;Gary Portnoy;The Scrantones;Will Smith"],
    kids:   ["🧸", "Kinderlieder", "Kids' songs", "Rolf Zuckowski;Volker Rosin;Detlev Jöcker;Simone Sommerland;Karel Gott;Gitti & Erika;Schnappi;Vader Abraham;Pinkfong;Markus Becker;Donikkl;Peter Maffay;Bibi Blocksberg;Benjamin Blümchen;Die Schlümpfe;Kinderlieder"],
    esc:    ["🎙️", "Eurovision", "Eurovision", "ABBA;Lena;Loreen;Måneskin;Conchita Wurst;Netta;Alexander Rybak;Lordi;Duncan Laurence;Kalush Orchestra;Käärijä;Nemo;Måns Zelmerlöw;Emmelie de Forest;Nicole;Stefan Raab;Guildo Horn;Ell & Nikki;Ruslana;Sertab Erener;Céline Dion;Sam Ryder;Verka Serduchka;Go_A;Chanel;Rosa Linn;Eleni Foureira;Mahmood;Michael Schulte;Sergey Lazarev"],
    apres:  ["⛷️", "Après-Ski & Wiesn", "Après-ski & Oktoberfest", "DJ Ötzi;DJ Robin;Mickie Krause;Ikke Hüftgold;Peter Wackel;Jürgen Drews;Mia Julia;Lorenz Büffel;Almklausi;Andreas Gabalier;Wolfgang Ambros;Wolfgang Petry;Matthias Reim;Höhner;Die Atzen;Josh.;S.T.S.;Opus;Rednex;Whigfield;John Denver;Neil Diamond;Spider Murphy Gang;Peter Schilling;Hermes House Band"],
    boy:    ["💘", "Boybands & Girlgroups", "Boy bands & girl groups", "Backstreet Boys;*NSYNC;Take That;Westlife;One Direction;Boyz II Men;New Kids on the Block;Hanson;Jonas Brothers;Spice Girls;Destiny's Child;TLC;Little Mix;Fifth Harmony;Sugababes;All Saints;S Club 7;No Angels;Tic Tac Toe;Monrose;Steps;BTS;BLACKPINK;Wilson Phillips;Girls Aloud"],
    summer: ["☀️", "Sommerhits", "Summer hits", "Luis Fonsi;Los Del Rio;Lou Bega;Enrique Iglesias;Don Omar;Kaoma;Michel Teló;Shakira;Calvin Harris;O-Zone;Las Ketchup;Gipsy Kings;Spider Murphy Gang;Sebastian Hämer;Taylor Swift;Harry Styles;Post Malone;Alexandra Stan;LMFAO;DJ Snake;Shawn Mendes;The Beach Boys;Mungo Jerry;Katrina and the Waves;Bryan Adams;DJ Jazzy Jeff & The Fresh Prince;Toploader;Ini Kamoze;Weezer"],
    tiktok: ["📲", "TikTok-Hits", "TikTok hits", "Sabrina Carpenter;Doja Cat;Kate Bush;Jawsh 685;SAINt JHN;Lil Nas X;The Kid LAROI;Glass Animals;Sam Smith;SZA;FIFTY FIFTY;Rema;Jack Harlow;Tate McRae;Benson Boone;Shaboozey;ROSÉ;Billie Eilish;Lady Gaga;Sophie Ellis-Bextor;Tyla;Chappell Roan;Nicki Minaj;GAYLE;Olivia Rodrigo;Boney M.;Ashnikko;Jaymes Young;Duke & Jones"],
    onehit: ["💫", "One-Hit-Wonder", "One-hit wonders", "Los Del Rio;Eiffel 65;Chumbawamba;Dexys Midnight Runners;Gotye;O-Zone;Vanilla Ice;Toni Basil;The Buggles;Soft Cell;Baha Men;Norman Greenbaum;Gnarls Barkley;Carl Douglas;Right Said Fred;Len;OMC;Wheatus;Fool's Garden;Plain White T's;4 Non Blondes;The Verve;Natalie Imbruglia;Hot Butter;Shocking Blue;The Archies;The Knack;Men Without Hats;The Vapors;Las Ketchup"],
    ballad: ["💞", "Balladen & Lovesongs", "Ballads & love songs", "Whitney Houston;Céline Dion;Bryan Adams;The Righteous Brothers;John Legend;Ed Sheeran;Adele;Lionel Richie;George Michael;Sinéad O'Connor;Aerosmith;Guns N' Roses;Scorpions;Bonnie Tyler;Enrique Iglesias;Christina Perri;Sam Smith;Bruno Mars;Robbie Williams;Eric Clapton;Elton John;Elvis Presley;Chris de Burgh;Bon Jovi;Seal;Goo Goo Dolls;Beyoncé;Münchener Freiheit;Herbert Grönemeyer;Revolverheld"],
    ndw:    ["📻", "NDW & Deutsch-Klassiker", "German classics & NDW", "Nena;Trio;Spider Murphy Gang;Peter Schilling;Hubert Kah;Markus;Falco;Joachim Witt;Andreas Dorau;Ideal;Geier Sturzflug;Fehlfarben;Rheingold;Extrabreit;Spliff;DÖF;Udo Lindenberg;Herbert Grönemeyer;BAP;Puhdys;Karat;Opus;Kraftwerk;Die Ärzte;Die Toten Hosen;Münchener Freiheit;Drafi Deutscher;Nicole;Frl. Menke;Westernhagen"],
    own:   ["✍️", "Eigene Künstler", "Your own artists", null]
  };
  const pn = n => n + " " + (n === 1 ? T("point", "Punkt") : T("points", "Punkte"));
  /* ---------- the ranking across all players (Nathan): points, how often right, how fast; titles from what you know best
     ("Oldie-Scanner", "Musical-Experte") and from your speed. Online games only: each phone adds its own player's numbers at the
     end (song_add), everyone sees everyone they may see (song_board; hidden players stay hidden) ---------- */
  const TAG = {y60: ["Oldie scanner", "Oldie-Scanner"], y80: ["80s kid", "80er-Kind"], y90: ["90s hero", "90er-Held"], y00: ["2000s hero", "2000er-Held"], y10: ["2010s pro", "2010er-Profi"], y20: ["Chart radar", "Charts-Radar"], charts: ["Chart radar", "Charts-Radar"], pop: ["Pop pro", "Pop-Profi"],
    drap: ["German rap expert", "Deutschrap-Kenner"], dpop: ["German pop fan", "Deutschpop-Fan"], rap: ["Hip-hop head", "Hip-Hop-Head"], rock: ["Rock legend", "Rock-Legende"], party: ["Schlager king", "Schlager-König"], dance: ["Rave radar", "Rave-Radar"], rnb: ["Soul expert", "Soul-Kenner"],
    latin: ["Reggaeton radar", "Reggaeton-Radar"], kpop: ["K-pop stan", "K-Pop-Stan"], indie: ["Indie insider", "Indie-Kenner"], metal: ["Headbanger", "Headbanger"], film: ["Movie buff", "Kino-Kenner"], xmas: ["Christmas elf", "Weihnachtself"], disney: ["Disney pro", "Disney-Profi"],
    musical: ["Musical expert", "Musical-Experte"], series: ["Series junkie", "Serienjunkie"], kids: ["Childhood hero", "Kindheitsheld"], esc: ["ESC expert", "ESC-Experte"], apres: ["Après-ski pro", "Après-Ski-Profi"], boy: ["Boy band fan", "Boyband-Fan"], summer: ["Summer hit collector", "Sommerhit-Sammler"],
    tiktok: ["TikTok radar", "TikTok-Radar"], onehit: ["One-hit hunter", "One-Hit-Jäger"], ballad: ["Ballad heart", "Balladen-Herz"], ndw: ["NDW veteran", "NDW-Veteran"], pl: ["Playlist pro", "Playlist-Profi"], mix: ["All-rounder", "Allrounder"]};
  const Rank = {
    rows: null, at: 0,
    sb(){ return typeof Social !== "undefined" && Social.sb && Social.me ? Social.sb : null; },
    async board(force){ const sb = this.sb(); if (!sb) return null; if (!force && this.rows && Date.now() - this.at < 60000) return this.rows;
      try { const {data, error} = await sb.rpc("song_board"); if (error || !Array.isArray(data)) return null; this.rows = data; this.at = Date.now(); return data; } catch(e) { return null; } },
    /* one finished game of mine */
    async add(my){ const sb = this.sb(); if (!sb || !my || !my.heard) return false;
      try { const {error} = await sb.rpc("song_add", {p_won: my.won ? 1 : 0, p_heard: my.heard, p_right: my.right, p_pts: my.pts, p_ms: (my.ms || []).map(x => Math.round(x)), p_genres: my.g || {}}); this.rows = null; return !error; } catch(e) { return false; } },
    /* at most three titles: what you know best, how fast, how sure */
    tags(r){ const out = [], G2 = Object.entries(r.genres || {}).map(([k, v]) => ({k, r: +v[0] || 0, n: +v[1] || 0})).filter(x => x.n >= 3 && x.r >= 3 && x.r / x.n >= .5).sort((a, b) => b.r - a.r || b.r / b.n - a.r / a.n);
      if (G2[0] && TAG[G2[0].k]) out.push((G[G2[0].k] ? G[G2[0].k][0] : "🎧") + " " + T(TAG[G2[0].k][0], TAG[G2[0].k][1]));
      if (r.avg_ms && r.avg_ms <= 3000 && r.right_n >= 3) out.push("⚡ " + T("Lightning ears", "Blitzmerker"));
      else if (r.best_ms && r.best_ms <= 900) out.push("🚀 " + T("Split second", "Sekundenschnell"));
      if (r.heard >= 15 && r.right_n / r.heard >= .8) out.push("🎯 " + T("Sure shot", "Treffsicher"));
      return out.slice(0, 3); },
    /* the list: place, name, titles, points; how often right and how fast */
    html(rows, max = 10){ if (!rows) return `<p class="pg-sub" style="margin:4px 0">${T("The ranking is loading …", "Die Rangliste lädt …")}</p>`;
      if (!rows.length) return `<p class="pg-sub" style="margin:4px 0">${T("Nobody yet. Play an online round: your points, hits and speed land here.", "Noch niemand. Spiel eine Online-Runde: Punkte, Treffer und Tempo landen hier.")}</p>`;
      const me = typeof Social !== "undefined" ? Social.me : null;
      return `<div class="list sg-rk">${rows.slice(0, max).map((r, i) => `<div class="li" style="${r.uid === me ? "box-shadow:inset 0 0 0 1.5px var(--go)" : ""}"><span class="pg-rank">${i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span><div class="grow"><div class="t">${h(r.name || "?")}</div>
        <div class="sg-tags">${this.tags(r).map(t => `<span>${h(t)}</span>`).join("")}</div><div class="s">${r.heard ? Math.round(r.right_n / r.heard * 100) : 0} % ${T("right", "richtig")}${r.avg_ms ? ` · Ø ${secs(r.avg_ms)}` : ""}${r.best_ms ? ` · ${T("best", "Bestzeit")} ${secs(r.best_ms)}` : ""}</div></div><b style="font:900 18px var(--display)">${r.pts}</b></div>`).join("")}</div>`; },
    /* a box that fills itself */
    mount(box, max){ if (!box) return; if (!this.sb()){ box.hidden = true; return; } box.querySelector("[data-rk]").innerHTML = this.html(this.rows, max);
      this.board().then(rows => { if (!box.isConnected) return; if (!rows){ box.hidden = true; return; } box.querySelector("[data-rk]").innerHTML = this.html(rows, max); }); },
    box(max){ return `<div class="unit sg-rkbox" style="width:100%;text-align:left;margin:0" data-rkmax="${max || 10}"><h3>🏆 ${T("Song quiz ranking", "Songraten-Rangliste")}</h3><div data-rk></div></div>`; }
  };
  /* 0,5 s · 3,2 s · 12 s */
  const secs = ms => { const v = ms / 1000; return (v < 10 ? (Math.round(v * 10) / 10).toFixed(1) : String(Math.round(v))).replace(".", T(".", ",")) + " s"; };
  const list = s => String(s || "").split(/[;,\n]/).map(x => x.trim()).filter(x => x.length >= 2).slice(0, 40);
  const artistsOf = o => o.genre === "own" ? list(o.own) : o.genre === "mix" ? Object.values(G).flatMap(g => g[3] ? list(g[3]) : []) : list((G[o.genre] || G.pop)[3]);
  const OKURL = /^https:\/\/[a-z0-9.-]+\.((apple|mzstatic)\.com|dzcdn\.net)\//;
  /* Deezer signs a preview link for a while only (…hdnea=exp=<seconds>…): a song whose link runs out within 2 minutes is dropped */
  const fresh = u => { const m = /exp=(\d{9,})/.exec(String(u || "")); return !m || +m[1] * 1000 > Date.now() + 120000; };

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
  const itunesDirect = params => new Promise(res => { const cb = "__sg" + Math.random().toString(36).slice(2), sc = document.createElement("script"); let to = 0;
    /* a late answer after the time is up must not break anything: the callback stays a while as an empty function */
    const done = () => { clearTimeout(to); window[cb] = () => {}; sc.remove(); setTimeout(() => { try { delete window[cb]; } catch(e) {} }, 30000); };
    to = setTimeout(() => { done(); res(null); }, 6000);
    window[cb] = d => { done(); res(d); }; sc.onerror = () => { done(); res(null); };
    sc.src = "https://itunes.apple.com/search?" + new URLSearchParams(Object.assign({country: "DE"}, params, {callback: cb})); document.head.appendChild(sc); });
  /* our server (api/songs.js) answers like Apple: a search once made is kept a day for everyone, and when Apple says no (it allows
     only about 20 searches a minute per phone) Deezer answers. Only if the server can't be reached does the phone ask Apple itself */
  const songApi = async params => { const ctl = typeof AbortController !== "undefined" ? new AbortController() : null, to = setTimeout(() => { try { ctl && ctl.abort(); } catch(e) {} }, 8000);
    try { const r = await fetch("/api/songs?" + new URLSearchParams(params), ctl ? {signal: ctl.signal} : {}); if (!r.ok) return null; const j = await r.json(); return j && Array.isArray(j.results) ? j : null; }
    catch(e) { return null; } finally { clearTimeout(to); } };
  const itunes = async params => { const d = await songApi(params); if (d && (d.results.length || params.entity === "musicArtist")) return d; const d2 = await itunesDirect(params); return d2 || d; };
  /* German or English title: the wrong answers come in the song's language (an English hit among three German titles is too easy to spot) */
  const DE = /\b(und|der|das|dem|den|ich|nicht|mein|meine|dein|deine|wir|ist|ein|eine|einen|auf|für|fur|mit|liebe|herz|nacht|immer|alles|nur|wie|geht|mich|dich|uns|wenn|kein|keine|zeit|heute|sommer|leben|bier|könig|ohne|schön|du|im|zu|bis|noch|sind|wird|alle|mal|jetzt|ganz|guten|morgen|tag|welt|land|lied|tanz|tanzen|sonne|regen|weg|haus|mann|frau|kind|leute|wieder|weil|über|uber|hier|dort|bitte|danke|ja|nein|warum)\b/gi;
  const EN = /\b(the|you|your|love|me|my|i|i'm|don't|dont|we|it|of|and|to|on|baby|girl|boy|night|heart|all|what|with|this|be|for|is|are|can|can't|cant|get|got|go|let|like|just|one|no|up|down|feel|time|way|want|need|world|life|dance|tonight|never|forever|again|without|back|home|eyes|day|be|she|he|they|our|from|out|that|when|where|why)\b/gi;
  const DEG = ["drap", "dpop", "party", "xmas"];
  const langOf = (title, g) => { const t = String(title || ""), de = (t.match(DE) || []).length + (/[äöüß]/i.test(t) ? 2 : 0), en = (t.match(EN) || []).length; return de > en ? "de" : en > de ? "en" : DEG.includes(g) ? "de" : "en"; };
  /* which genre an artist comes from (for "Mix"), so the wrong answers fit the song */
  const genreOf = term => { for (const [k, g] of Object.entries(G)) if (g[3] && list(g[3]).some(a => N(a) === N(term))) return k; return null; };
  const valOf = (w, x) => w === "both" ? bare(x.title) + " – " + x.artist : w === "artist" ? x.artist : bare(x.title);
  /* the first of several artists ("Drake, Rihanna" → Drake) */
  const art1 = a => String(a || "").split(/\s*(?:,|&|\bfeat\.?|\bft\.?|\bx\b|\bund\b)\s*/i)[0].trim();
  /* "Immer länger": 1, 2, 3, 5, 10 seconds, each time from the start; the earlier you know it, the more points */
  const STAGES = [1, 2, 3, 5, 10], STP = [5, 4, 3, 2, 1];
  const yearOf = r => +String((r && r.releaseDate) || "").slice(0, 4) || 0;

  /* ---------- the wrong answers (for both kinds of song lists below): the same artist's other songs first (both: two of them),
     then songs of the same language and genre; never a song that is still to come, and a title once shown as wrong never comes
     later as the song ---------- */
  const optsOf = P => (s2, what, n) => { const right = valOf(what, s2), seen = new Set([N(right)]), out = [];
    const add = (v, t) => { const k = N(v); if (!k || seen.has(k) || out.length >= n - 1) return; seen.add(k); out.push([v, t]); };
    const coming = P.songs, cT = new Set(coming.map(x => N(bare(x.title)))), cA = new Set(coming.map(x => N(x.artist))), cI = new Set(coming.map(x => x.id));
    const near = (a, b) => (b.lang === s2.lang) - (a.lang === s2.lang) || (b.g === s2.g) - (a.g === s2.g);
    if (what === "artist"){ const A = G[s2.g] && G[s2.g][3] ? list(G[s2.g][3]) : P.o ? artistsOf(P.o) : [...new Set(P.bank.map(x => x.artist))];
      PG.shuffle(A.filter(a => !cA.has(N(a)))).forEach(a => add(a)); PG.shuffle(P.bank.filter(x => !cA.has(N(x.artist)))).sort(near).forEach(x => add(x.artist));
      /* very few artists: then also ones that come later */
      PG.shuffle(A).forEach(a => add(a)); }
    else { const same = PG.shuffle((s2.alts || []).filter(t => !cT.has(N(t)))).map(t => ({title: t, artist: s2.artist}));
      const other = PG.shuffle(P.bank.filter(x => !cI.has(x.id) && !cT.has(N(x.title)) && N(x.title) !== N(bare(s2.title)) && N(x.artist) !== N(s2.artist))).sort(near);
      (what === "both" ? same.slice(0, 2).concat(other, same.slice(2)) : same.concat(other)).forEach(x => add(valOf(what, x), x.title)); }
    if (out.length < 2) return null;
    out.forEach(([, t]) => { if (t) P.shown.add(N(bare(t))); });
    return PG.shuffle([right].concat(out.map(x => x[0]))); };
  const SEEN = "song:seen";
  const used0 = () => new Set((PG.st[SEEN] || []).slice(-600));
  const markUsed = (P, s2) => { P.used.add(s2.id); PG.st[SEEN] = [...new Set([...(PG.st[SEEN] || []), s2.id])].slice(-600); PG.persist(); };

  /* ---------- the songs everybody knows: radio classics (what SWR3 played in the 80s, what Radio Arabella plays from the 2000s and
     2010s), per genre "Title|Artist". Most songs of a round come from here; the rest from the artists' other songs, the deeper
     the harder (see LVL) ---------- */
  const HITS = {
    y60: "Hey Jude|The Beatles;Let It Be|The Beatles;Yesterday|The Beatles;Here Comes the Sun|The Beatles;Dancing Queen|ABBA;Mamma Mia|ABBA;Waterloo|ABBA;Take a Chance on Me|ABBA;Gimme! Gimme! Gimme!|ABBA;Suspicious Minds|Elvis Presley;Can't Help Falling in Love|Elvis Presley;(I Can't Get No) Satisfaction|The Rolling Stones;Paint It Black|The Rolling Stones;Stayin' Alive|Bee Gees;How Deep Is Your Love|Bee Gees;Your Song|Elton John;Rocket Man|Elton John;Heroes|David Bowie;Space Oddity|David Bowie;Dreams|Fleetwood Mac;Go Your Own Way|Fleetwood Mac;Superstition|Stevie Wonder;Respect|Aretha Franklin;Ain't No Mountain High Enough|Marvin Gaye;Rivers of Babylon|Boney M.;Daddy Cool|Boney M.;Rasputin|Boney M.;Good Vibrations|The Beach Boys;Mrs. Robinson|Simon & Garfunkel;The Sound of Silence|Simon & Garfunkel;Have You Ever Seen the Rain|Creedence Clearwater Revival;No Woman, No Cry|Bob Marley & The Wailers;Light My Fire|The Doors;I Feel Love|Donna Summer;Bohemian Rhapsody|Queen;We Will Rock You|Queen;Don't Stop Me Now|Queen;Stairway to Heaven|Led Zeppelin;I Will Survive|Gloria Gaynor;Y.M.C.A.|Village People;The House of the Rising Sun|The Animals;Hotel California|Eagles;Sweet Home Alabama|Lynyrd Skynyrd;What a Wonderful World|Louis Armstrong;Stand by Me|Ben E. King",
    y80: "Take On Me|a-ha;Billie Jean|Michael Jackson;Beat It|Michael Jackson;Thriller|Michael Jackson;Like a Virgin|Madonna;Like a Prayer|Madonna;Material Girl|Madonna;Sweet Dreams (Are Made of This)|Eurythmics;Africa|Toto;The Final Countdown|Europe;Livin' on a Prayer|Bon Jovi;Don't You (Forget About Me)|Simple Minds;Tainted Love|Soft Cell;Girls Just Want to Have Fun|Cyndi Lauper;Time After Time|Cyndi Lauper;Never Gonna Give You Up|Rick Astley;Every Breath You Take|The Police;Eye of the Tiger|Survivor;Total Eclipse of the Heart|Bonnie Tyler;99 Luftballons|Nena;Irgendwie, irgendwo, irgendwann|Nena;Rock Me Amadeus|Falco;Der Kommissar|Falco;Major Tom (Völlig losgelöst)|Peter Schilling;Skandal im Sperrbezirk|Spider Murphy Gang;Da Da Da|Trio;Männer|Herbert Grönemeyer;Jump|Van Halen;Smalltown Boy|Bronski Beat;Relax|Frankie Goes to Hollywood;Wake Me Up Before You Go-Go|Wham!;Careless Whisper|George Michael;Heaven Is a Place on Earth|Belinda Carlisle;Kids in America|Kim Wilde;You Spin Me Round (Like a Record)|Dead or Alive;In the Air Tonight|Phil Collins;Purple Rain|Prince;I Wanna Dance with Somebody (Who Loves Me)|Whitney Houston;The Power of Love|Huey Lewis & The News;Money for Nothing|Dire Straits;Everybody Wants to Rule the World|Tears for Fears;Just Can't Get Enough|Depeche Mode;Cheri Cheri Lady|Modern Talking;You're My Heart, You're My Soul|Modern Talking;Don't Stop Believin'|Journey;Another One Bites the Dust|Queen;Radio Ga Ga|Queen;Under Pressure|Queen;Let's Dance|David Bowie;Hungry Like the Wolf|Duran Duran;Footloose|Kenny Loggins;Flashdance... What a Feeling|Irene Cara;Uptown Girl|Billy Joel;Karma Chameleon|Culture Club;Here I Go Again|Whitesnake;Sweet Child o' Mine|Guns N' Roses;Forever Young|Alphaville;Big in Japan|Alphaville;Moonlight Shadow|Mike Oldfield;The Look|Roxette;It Must Have Been Love|Roxette;Need You Tonight|INXS;Take My Breath Away|Berlin;Ghostbusters|Ray Parker Jr.;Celebration|Kool & The Gang;Self Control|Laura Branigan;Wonderful Life|Black",
    y90: "Wonderwall|Oasis;Smells Like Teen Spirit|Nirvana;...Baby One More Time|Britney Spears;Wannabe|Spice Girls;I Want It That Way|Backstreet Boys;Everybody (Backstreet's Back)|Backstreet Boys;Blue (Da Ba Dee)|Eiffel 65;What Is Love|Haddaway;Mr. Vain|Culture Beat;Rhythm Is a Dancer|Snap!;The Rhythm of the Night|Corona;Barbie Girl|Aqua;Mambo No. 5 (A Little Bit of...)|Lou Bega;My Heart Will Go On|Céline Dion;I Will Always Love You|Whitney Houston;Gangsta's Paradise|Coolio;No Diggity|Blackstreet;Waterfalls|TLC;Torn|Natalie Imbruglia;Losing My Religion|R.E.M.;Zombie|The Cranberries;Don't Speak|No Doubt;Bitter Sweet Symphony|The Verve;Livin' la Vida Loca|Ricky Martin;Believe|Cher;Truly Madly Deeply|Savage Garden;Wind of Change|Scorpions;Enjoy the Silence|Depeche Mode;Nothing Compares 2 U|Sinéad O'Connor;Vogue|Madonna;Ice Ice Baby|Vanilla Ice;U Can't Touch This|MC Hammer;Coco Jamboo|Mr. President;Saturday Night|Whigfield;Boom, Boom, Boom, Boom!!|Vengaboys;We Like to Party! (The Vengabus)|Vengaboys;It's My Life|Dr. Alban;Hyper Hyper|Scooter;Freed from Desire|Gala;Children|Robert Miles;Macarena|Los Del Rio;Lemon Tree|Fool's Garden;Kiss from a Rose|Seal;Cotton Eye Joe|Rednex;Scatman (Ski-Ba-Bop-Ba-Dop-Bop)|Scatman John;No Limit|2 Unlimited;Men in Black|Will Smith;Ironic|Alanis Morissette;Black or White|Michael Jackson;Verdammt ich lieb' dich|Matthias Reim;Die da!?!|Die Fantastischen Vier;Sie ist weg|Die Fantastischen Vier;Männer sind Schweine|Die Ärzte;Schrei nach Liebe|Die Ärzte;Alles aus Liebe|Die Toten Hosen;Tage wie dieser|Pur;Abenteuerland|Pur;Engel|Rammstein;Du hast|Rammstein",
    y00: "Hey Ya!|Outkast;Crazy in Love|Beyoncé;Umbrella|Rihanna;Hips Don't Lie|Shakira;Whenever, Wherever|Shakira;In the End|Linkin Park;Numb|Linkin Park;Lose Yourself|Eminem;Without Me|Eminem;Mr. Brightside|The Killers;Seven Nation Army|The White Stripes;Toxic|Britney Spears;Oops!...I Did It Again|Britney Spears;Complicated|Avril Lavigne;Sk8er Boi|Avril Lavigne;Rehab|Amy Winehouse;Valerie|Mark Ronson;Viva la Vida|Coldplay;Clocks|Coldplay;Yellow|Coldplay;Where Is the Love?|Black Eyed Peas;I Gotta Feeling|Black Eyed Peas;Poker Face|Lady Gaga;Just Dance|Lady Gaga;SexyBack|Justin Timberlake;Cry Me a River|Justin Timberlake;Maneater|Nelly Furtado;Since U Been Gone|Kelly Clarkson;Yeah!|Usher;Temperature|Sean Paul;Bleeding Love|Leona Lewis;Apologize|Timbaland;Chasing Cars|Snow Patrol;Bad Day|Daniel Powter;You're Beautiful|James Blunt;Fallin'|Alicia Keys;Hollaback Girl|Gwen Stefani;The Ketchup Song (Aserejé)|Las Ketchup;Dragostea Din Tei|O-Zone;Hung Up|Madonna;Hot n Cold|Katy Perry;I Kissed a Girl|Katy Perry;Use Somebody|Kings of Leon;Boulevard of Broken Dreams|Green Day;Ein Kompliment|Sportfreunde Stiller;Das Beste|Silbermond;Perfekte Welle|Juli;Dieser Weg|Xavier Naidoo;Haus am See|Peter Fox;Vom selben Stern|Ich + Ich;Durch den Monsun|Tokio Hotel;Liebe ist alles|Rosenstolz;Dickes B|Seeed;Hamma!|Culcha Candela",
    y10: "Rolling in the Deep|Adele;Someone Like You|Adele;Hello|Adele;Uptown Funk|Mark Ronson;Happy|Pharrell Williams;Shape of You|Ed Sheeran;Thinking Out Loud|Ed Sheeran;Perfect|Ed Sheeran;Wake Me Up|Avicii;Levels|Avicii;Hey Brother|Avicii;Get Lucky|Daft Punk;Despacito|Luis Fonsi;Shake It Off|Taylor Swift;Blank Space|Taylor Swift;Royals|Lorde;Counting Stars|OneRepublic;Radioactive|Imagine Dragons;Believer|Imagine Dragons;Party Rock Anthem|LMFAO;Call Me Maybe|Carly Rae Jepsen;Moves like Jagger|Maroon 5;Somebody That I Used to Know|Gotye;Firework|Katy Perry;Roar|Katy Perry;Diamonds|Rihanna;We Found Love|Rihanna;Titanium|David Guetta;Love Yourself|Justin Bieber;Sorry|Justin Bieber;Stressed Out|Twenty One Pilots;Cheap Thrills|Sia;Chandelier|Sia;Lean On|Major Lazer;Take Me to Church|Hozier;Let Her Go|Passenger;Rather Be|Clean Bandit;Closer|The Chainsmokers;7 Years|Lukas Graham;Locked Out of Heaven|Bruno Mars;Can't Stop the Feeling!|Justin Timberlake;Dance Monkey|Tones and I;Old Town Road|Lil Nas X;bad guy|Billie Eilish;Tage wie diese|Die Toten Hosen;Auf uns|Andreas Bourani;Chöre|Mark Forster;80 Millionen|Max Giesinger;Atemlos durch die Nacht|Helene Fischer;Geboren um zu leben|Unheilig;Traum|Cro;Easy|Cro;Satellite|Lena;Nur noch kurz die Welt retten|Tim Bendzko;Ich lass für dich das Licht an|Revolverheld;Lieblingsmensch|Namika;Feuerwerk|Wincent Weiss",
    y20: "Blinding Lights|The Weeknd;Save Your Tears|The Weeknd;Levitating|Dua Lipa;Don't Start Now|Dua Lipa;Houdini|Dua Lipa;drivers license|Olivia Rodrigo;good 4 u|Olivia Rodrigo;vampire|Olivia Rodrigo;Flowers|Miley Cyrus;As It Was|Harry Styles;Watermelon Sugar|Harry Styles;Bad Habits|Ed Sheeran;Shivers|Ed Sheeran;Heat Waves|Glass Animals;Espresso|Sabrina Carpenter;Please Please Please|Sabrina Carpenter;Beautiful Things|Benson Boone;Anti-Hero|Taylor Swift;Cruel Summer|Taylor Swift;Unholy|Sam Smith;Calm Down|Rema;Die With A Smile|Lady Gaga;APT.|ROSÉ;BIRDS OF A FEATHER|Billie Eilish;Lose Control|Teddy Swims;Peaches|Justin Bieber;MONTERO (Call Me By Your Name)|Lil Nas X;Kiss Me More|Doja Cat;Say So|Doja Cat;Paint The Town Red|Doja Cat;Dynamite|BTS;Greedy|Tate McRae;Easy On Me|Adele;I'm Good (Blue)|David Guetta;Too Sweet|Hozier;Stargazing|Myles Smith;Good Luck, Babe!|Chappell Roan;Komet|Udo Lindenberg;Roller|Apache 207;Wildberry Lillet|Nina Chuba",
    rock: "Bohemian Rhapsody|Queen;We Will Rock You|Queen;Highway to Hell|AC/DC;Thunderstruck|AC/DC;Back in Black|AC/DC;Smells Like Teen Spirit|Nirvana;Come As You Are|Nirvana;In the End|Linkin Park;Numb|Linkin Park;Californication|Red Hot Chili Peppers;Can't Stop|Red Hot Chili Peppers;Under the Bridge|Red Hot Chili Peppers;Everlong|Foo Fighters;The Pretender|Foo Fighters;Boulevard of Broken Dreams|Green Day;American Idiot|Green Day;Mr. Brightside|The Killers;Do I Wanna Know?|Arctic Monkeys;505|Arctic Monkeys;Sweet Child o' Mine|Guns N' Roses;Welcome to the Jungle|Guns N' Roses;Livin' on a Prayer|Bon Jovi;It's My Life|Bon Jovi;Nothing Else Matters|Metallica;Enter Sandman|Metallica;Du hast|Rammstein;Sonne|Rammstein;Schrei nach Liebe|Die Ärzte;Westerland|Die Ärzte;(I Can't Get No) Satisfaction|The Rolling Stones;Paint It Black|The Rolling Stones;Stairway to Heaven|Led Zeppelin;Wonderwall|Oasis;Don't Look Back in Anger|Oasis;Uprising|Muse;Supermassive Black Hole|Muse;Sex on Fire|Kings of Leon;Use Somebody|Kings of Leon;Seven Nation Army|The White Stripes;Zombie|The Cranberries;Hotel California|Eagles;Sweet Home Alabama|Lynyrd Skynyrd",
    dpop: "Auf uns|Andreas Bourani;Chöre|Mark Forster;Au revoir|Mark Forster;80 Millionen|Max Giesinger;Wenn sie tanzt|Max Giesinger;Feuerwerk|Wincent Weiss;Nur noch kurz die Welt retten|Tim Bendzko;Ich lass für dich das Licht an|Revolverheld;Lieblingsmensch|Namika;Haus am See|Peter Fox;Alles neu|Peter Fox;Das Beste|Silbermond;Symphonie|Silbermond;Leichtes Gepäck|Silbermond;Perfekte Welle|Juli;Geile Zeit|Juli;Ein Kompliment|Sportfreunde Stiller;Tage wie diese|Die Toten Hosen;Männer|Herbert Grönemeyer;Mensch|Herbert Grönemeyer;Pocahontas|AnnenMayKantereit;Barfuß am Klavier|AnnenMayKantereit;Traum|Cro;Easy|Cro;Leiser|LEA;Kreise|Johannes Oerding;Gewinner|Clueso;Wildberry Lillet|Nina Chuba;Herz über Kopf|Joris;Songs für Liam|Kraftklub;Dieser Weg|Xavier Naidoo;Vom selben Stern|Ich + Ich;Durch den Monsun|Tokio Hotel;Augenbling|Seeed;Ding|Seeed;Atemlos durch die Nacht|Helene Fischer",
    drap: "Roller|Apache 207;200 km/h|Apache 207;Komet|Udo Lindenberg;Palmen aus Plastik|Bonez MC;Ohne mein Team|Bonez MC;Kokain|Bonez MC;Cherry Lady|Capital Bra;Neymar|Ufo361;Mein Block|Sido;Bilder im Kopf|Sido;Astronaut|Sido;Chabos wissen wer der Babo ist|Haftbefehl;Bauch Beine Po|Shirin David;Gib ihm|Shirin David;Wie ein Alpha|Kollegah;Sonnenbank Flavour|Bushido;Cataleya|Samra;Sommergewitter|Pashanim;Party Sahne|Ski Aggu;Die da!?!|Die Fantastischen Vier;Remmidemmi (Yippie Yippie Yeah)|Deichkind;Leider geil (Leider geil)|Deichkind;Lila Wolken|Marteria;Kids (2 Finger an den Kopf)|Marteria;Hurra die Welt geht unter|K.I.Z;Im Ascheregen|Casper;Easy|Cro;Traum|Cro;Wenn das Liebe ist|Glasperlenspiel",
    rap: "Lose Yourself|Eminem;Without Me|Eminem;The Real Slim Shady|Eminem;Stan|Eminem;In da Club|50 Cent;Drop It Like It's Hot|Snoop Dogg;Still D.R.E.|Dr. Dre;California Love|2Pac;Hypnotize|The Notorious B.I.G.;Juicy|The Notorious B.I.G.;Hey Ya!|Outkast;Ms. Jackson|Outkast;Empire State of Mind|JAY-Z;Gold Digger|Kanye West;Stronger|Kanye West;HUMBLE.|Kendrick Lamar;Not Like Us|Kendrick Lamar;SICKO MODE|Travis Scott;goosebumps|Travis Scott;God's Plan|Drake;Hotline Bling|Drake;One Dance|Drake;rockstar|Post Malone;Circles|Post Malone;Sunflower|Post Malone;Old Town Road|Lil Nas X;Super Bass|Nicki Minaj;Bodak Yellow|Cardi B;Lollipop|Lil Wayne;Gangsta's Paradise|Coolio;Say So|Doja Cat;No Role Modelz|J. Cole",
    dance: "Titanium|David Guetta;Memories|David Guetta;Wake Me Up|Avicii;Levels|Avicii;Summer|Calvin Harris;Feel So Close|Calvin Harris;This Is What You Came For|Calvin Harris;Animals|Martin Garrix;Scared to Be Lonely|Martin Garrix;Sugar|Robin Schulz;Faded|Alan Walker;Firestone|Kygo;Stole the Show|Kygo;Don't You Worry Child|Swedish House Mafia;Red Lights|Tiësto;The Business|Tiësto;Ain't Nobody (Loves Me Better)|Felix Jaehn;Alone|Marshmello;Closer|The Chainsmokers;Clarity|Zedd;Get Lucky|Daft Punk;One More Time|Daft Punk;Around the World|Daft Punk;Breaking Me|Topic;Are You with Me|Lost Frequencies;L'amour toujours|Gigi D'Agostino;Blue (Da Ba Dee)|Eiffel 65;Lean On|Major Lazer;Insomnia|Faithless;Sandstorm|Darude;Children|Robert Miles;Freed from Desire|Gala",
    party: "Atemlos durch die Nacht|Helene Fischer;Herzbeben|Helene Fischer;Du hast mich tausendmal belogen|Andrea Berg;Wahnsinn|Wolfgang Petry;Verdammt ich lieb' dich|Matthias Reim;Hey Baby (Uhh, Ahh)|DJ Ötzi;Ein Stern (... der deinen Namen trägt)|DJ Ötzi;Layla|DJ Robin;Zehn nackte Friseusen|Mickie Krause;Schatzi schenk mir ein Foto|Mickie Krause;Santa Maria|Roland Kaiser;Hello Again|Howard Carpendale;Ich war noch niemals in New York|Udo Jürgens;Griechischer Wein|Udo Jürgens;Marmor, Stein und Eisen bricht|Drafi Deutscher;Ein Bett im Kornfeld|Jürgen Drews;Fiesta Mexicana|Rex Gildo;Viva Colonia|Höhner;Cordula Grün|Josh.;Hulapalu|Andreas Gabalier;I sing a Liad für di|Andreas Gabalier;Er gehört zu mir|Marianne Rosenberg;Theo, wir fahr'n nach Lodz|Vicky Leandros;Ohne dich (schlaf' ich heut' Nacht nicht ein)|Münchener Freiheit;Kreuzberger Nächte|Gebrüder Blattschuss;Mendocino|Michael Holm;Sweet Caroline|Neil Diamond;Take Me Home, Country Roads|John Denver;Skandal im Sperrbezirk|Spider Murphy Gang;Tage wie diese|Die Toten Hosen",
    xmas: "All I Want for Christmas Is You|Mariah Carey;Last Christmas|Wham!;It's Beginning to Look a Lot Like Christmas|Michael Bublé;Driving Home for Christmas|Chris Rea;Do They Know It's Christmas?|Band Aid;Merry Christmas Everyone|Shakin' Stevens;Rockin' Around the Christmas Tree|Brenda Lee;Jingle Bell Rock|Bobby Helms;Feliz Navidad|José Feliciano;White Christmas|Bing Crosby;Let It Snow! Let It Snow! Let It Snow!|Dean Martin;Santa Tell Me|Ariana Grande;Mistletoe|Justin Bieber;Underneath the Tree|Kelly Clarkson;In der Weihnachtsbäckerei|Rolf Zuckowski;Fairytale of New York|The Pogues;Wonderful Christmastime|Paul McCartney;Happy Xmas (War Is Over)|John Lennon;Thank God It's Christmas|Queen;Step into Christmas|Elton John;Christmas Lights|Coldplay;Snowman|Sia;Little Drummer Boy|Bing Crosby;Jingle Bells|Frank Sinatra;Santa Baby|Eartha Kitt;Run Rudolph Run|Chuck Berry;Blue Christmas|Elvis Presley;Leise rieselt der Schnee|Rolf Zuckowski;Stille Nacht, heilige Nacht|Helene Fischer;O Tannenbaum|Helene Fischer;Schneeflöckchen, Weißröckchen|Rolf Zuckowski;Morgen, Kinder, wird's was geben|Rolf Zuckowski;It's the Most Wonderful Time of the Year|Andy Williams;Have Yourself a Merry Little Christmas|Michael Bublé;Holly Jolly Christmas|Michael Bublé;Christmas (Baby Please Come Home)|Darlene Love;Merry Xmas Everybody|Slade",
    film: "Let It Go|Idina Menzel;How Far I'll Go|Auli'i Cravalho;My Heart Will Go On|Céline Dion;I Will Always Love You|Whitney Houston;Shallow|Lady Gaga;City of Stars|Ryan Gosling;This Is Me|Keala Settle;The Greatest Show|Hugh Jackman;Eye of the Tiger|Survivor;Footloose|Kenny Loggins;Take My Breath Away|Berlin;Flashdance... What a Feeling|Irene Cara;Ghostbusters|Ray Parker Jr.;Skyfall|Adele;Happy|Pharrell Williams;Can't Stop the Feeling!|Justin Timberlake;Can You Feel the Love Tonight|Elton John;We Don't Talk About Bruno|Carolina Gaitán;Lose Yourself|Eminem;Stayin' Alive|Bee Gees;(I've Had) The Time of My Life|Bill Medley;Don't You (Forget About Me)|Simple Minds;Mamma Mia|ABBA;See You Again|Wiz Khalifa;Speechless|Naomi Scott;Hungry Eyes|Eric Carmen;She's Like the Wind|Patrick Swayze;Oh, Pretty Woman|Roy Orbison;Writing's on the Wall|Sam Smith;No Time to Die|Billie Eilish;Live and Let Die|Paul McCartney;Goldfinger|Shirley Bassey;What Was I Made For?|Billie Eilish;I'm Just Ken|Ryan Gosling;Dance the Night|Dua Lipa;Mrs. Robinson|Simon & Garfunkel;Born to Be Wild|Steppenwolf;Misirlou|Dick Dale;Son of a Preacher Man|Dusty Springfield;You Never Can Tell|Chuck Berry;Stuck in the Middle with You|Stealers Wheel;Hooked on a Feeling|Blue Swede;Mr. Blue Sky|Electric Light Orchestra;Come and Get Your Love|Redbone;Danger Zone|Kenny Loggins;Kiss from a Rose|Seal;I Don't Want to Miss a Thing|Aerosmith;Men in Black|Will Smith;Gangsta's Paradise|Coolio;Glory|John Legend;Falling Slowly|Glen Hansard;Moon River|Audrey Hepburn;Unchained Melody|The Righteous Brothers;Kung Fu Fighting|Carl Douglas;Holding Out for a Hero|Bonnie Tyler",
    disney: "Let It Go|Idina Menzel;Do You Want to Build a Snowman?|Kristen Bell;For the First Time in Forever|Kristen Bell;Love Is an Open Door|Kristen Bell;Into the Unknown|Idina Menzel;Show Yourself|Idina Menzel;How Far I'll Go|Auli'i Cravalho;You're Welcome|Dwayne Johnson;We Don't Talk About Bruno|Carolina Gaitán;Surface Pressure|Jessica Darrow;Dos Oruguitas|Sebastián Yatra;Circle of Life|Carmen Twillie;Hakuna Matata|Nathan Lane;I Just Can't Wait to Be King|Jason Weaver;Can You Feel the Love Tonight|Elton John;Be Prepared|Jeremy Irons;Under the Sea|Samuel E. Wright;Part of Your World|Jodi Benson;Kiss the Girl|Samuel E. Wright;Poor Unfortunate Souls|Pat Carroll;A Whole New World|Brad Kane;Friend Like Me|Robin Williams;Prince Ali|Robin Williams;Speechless|Naomi Scott;Beauty and the Beast|Angela Lansbury;Be Our Guest|Jerry Orbach;Belle|Paige O'Hara;Colors of the Wind|Judy Kuhn;Reflection|Lea Salonga;I'll Make a Man Out of You|Donny Osmond;Go the Distance|Roger Bart;I Won't Say (I'm in Love)|Susan Egan;You've Got a Friend in Me|Randy Newman;I See the Light|Mandy Moore;When Will My Life Begin|Mandy Moore;Almost There|Anika Noni Rose;Try Everything|Shakira;The Bare Necessities|Phil Harris;I Wan'na Be Like You|Louis Prima;Everybody Wants to Be a Cat|Phil Harris;Two Worlds|Phil Collins;You'll Be in My Heart|Phil Collins;Strangers Like Me|Phil Collins;Supercalifragilisticexpialidocious|Julie Andrews;A Spoonful of Sugar|Julie Andrews;When You Wish Upon a Star|Cliff Edwards;Un Poco Loco|Anthony Gonzalez;Remember Me|Benjamin Bratt;Life Is a Highway|Rascal Flatts;Real Gone|Sheryl Crow;This Wish|Ariana DeBose;Waiting on a Miracle|Stephanie Beatriz;Lass jetzt los|Willemijn Verkaik;Probier's mal mit Gemütlichkeit|Edgar Ott",
    musical: "The Greatest Show|Hugh Jackman;This Is Me|Keala Settle;A Million Dreams|Ziv Zaifman;Rewrite the Stars|Zac Efron;Never Enough|Loren Allred;Come Alive|Hugh Jackman;The Other Side|Hugh Jackman;Defying Gravity|Idina Menzel;Popular|Kristin Chenoweth;My Shot|Lin-Manuel Miranda;Alexander Hamilton|Lin-Manuel Miranda;Wait for It|Leslie Odom, Jr.;Satisfied|Renée Elise Goldsberry;You'll Be Back|Jonathan Groff;Waving Through a Window|Ben Platt;Summer Nights|John Travolta;You're the One That I Want|John Travolta;Greased Lightnin'|John Travolta;Hopelessly Devoted to You|Olivia Newton-John;Grease|Frankie Valli;Mamma Mia|Meryl Streep;The Winner Takes It All|Meryl Streep;I Dreamed a Dream|Anne Hathaway;Memory|Elaine Paige;Don't Cry for Me Argentina|Madonna;City of Stars|Ryan Gosling;Audition (The Fools Who Dream)|Emma Stone;Do-Re-Mi|Julie Andrews;My Favorite Things|Julie Andrews;The Sound of Music|Julie Andrews;Over the Rainbow|Judy Garland;Singin' in the Rain|Gene Kelly;Cabaret|Liza Minnelli;All That Jazz|Catherine Zeta-Jones;Sweet Transvestite|Tim Curry;Breaking Free|Zac Efron;Bet On It|Zac Efron;Start of Something New|Zac Efron;Don't Stop Believin'|Glee Cast;Aquarius / Let the Sunshine In|The 5th Dimension;Ich gehör nur mir|Pia Douwes;Tomorrow|Aileen Quinn",
    series: "I'll Be There for You|The Rembrandts;Running Up That Hill (A Deal with God)|Kate Bush;Bloody Mary|Lady Gaga;Chasing Cars|Snow Patrol;How to Save a Life|The Fray;Bad Things|Jace Everett;Woke Up This Morning|Alabama 3;California|Phantom Planet;Superman|Lazlo Bane;I Don't Want to Be|Gavin DeGraw;I Don't Want to Wait|Paula Cole;Where You Lead|Carole King;History of Everything|Barenaked Ladies;All for Us|Labrinth;Main Title (Game of Thrones)|Ramin Djawadi;Red Right Hand|Nick Cave & The Bad Seeds;Bella ciao|Manu Pilas;Save Me|Remy Zero;I'm Always Here|Jimi Jamison;Boss of Me|They Might Be Giants;Falling|Julee Cruise;Where Everybody Knows Your Name|Gary Portnoy;Stranger Things|Kyle Dixon & Michael Stein;The Fresh Prince of Bel-Air|DJ Jazzy Jeff & The Fresh Prince;Pokémon Theme|Jason Paige;Goo Goo Muck|The Cramps",
    kids: "Die Biene Maja|Karel Gott;Heidi|Gitti & Erika;Schnappi, das kleine Krokodil|Schnappi;Das Lied der Schlümpfe|Vader Abraham;Baby Shark|Pinkfong;Das rote Pferd|Markus Becker;Fliegerlied (So ein schöner Tag)|Donikkl;Wie schön, dass du geboren bist|Rolf Zuckowski;Ich schaff das schon|Rolf Zuckowski;Ich wollte nie erwachsen sein (Nessajas Lied)|Peter Maffay;Aramsamsam|Volker Rosin;Das Hexeneinmaleins|Bibi Blocksberg;Pippi Langstrumpf|Pippi Langstrumpf;In der Weihnachtsbäckerei|Rolf Zuckowski;Der Gorilla mit der Sonnenbrille|Die Schlümpfe;Hoch soll er leben|Simone Sommerland;Alle meine Entchen|Simone Sommerland;Backe, backe Kuchen|Simone Sommerland;Head, Shoulders, Knees and Toes|Pinkfong;Kopf und Schultern, Knie und Fuß|Simone Sommerland",
    esc: "Waterloo|ABBA;Satellite|Lena;Euphoria|Loreen;Tattoo|Loreen;Zitti e buoni|Måneskin;Rise Like a Phoenix|Conchita Wurst;Toy|Netta;Fairytale|Alexander Rybak;Hard Rock Hallelujah|Lordi;Arcade|Duncan Laurence;Stefania|Kalush Orchestra;Cha Cha Cha|Käärijä;The Code|Nemo;Heroes|Måns Zelmerlöw;Only Teardrops|Emmelie de Forest;Ein bißchen Frieden|Nicole;Wadde hadde dudde da?|Stefan Raab;Guildo hat euch lieb!|Guildo Horn;Running Scared|Ell & Nikki;Wild Dances|Ruslana;Everyway That I Can|Sertab Erener;Ne partez pas sans moi|Céline Dion;Space Man|Sam Ryder;Dancing Lasha Tumbai|Verka Serduchka;Shum|Go_A;SloMo|Chanel;Snap|Rosa Linn;Fuego|Eleni Foureira;Soldi|Mahmood;You Let Me Walk Alone|Michael Schulte;You Are the Only One|Sergey Lazarev;Save Your Kisses for Me|Brotherhood of Man;Puppet on a String|Sandie Shaw;Love Shine a Light|Katrina and the Waves;Making Your Mind Up|Bucks Fizz;Molitva|Marija Šerifović",
    apres: "Layla|DJ Robin;Hey Baby (Uhh, Ahh)|DJ Ötzi;Ein Stern (... der deinen Namen trägt)|DJ Ötzi;Anton aus Tirol|DJ Ötzi;Skifoan|Wolfgang Ambros;Zehn nackte Friseusen|Mickie Krause;Schatzi schenk mir ein Foto|Mickie Krause;Mama Laudaaa|Almklausi;Johnny Däpp|Lorenz Büffel;Hulapalu|Andreas Gabalier;I sing a Liad für di|Andreas Gabalier;Cordula Grün|Josh.;Fürstenfeld|S.T.S.;Verdammt, ich lieb' dich|Matthias Reim;Hölle, Hölle, Hölle|Wolfgang Petry;Viva Colonia|Höhner;Live Is Life|Opus;Cotton Eye Joe|Rednex;Saturday Night|Whigfield;Take Me Home, Country Roads|John Denver;Sweet Caroline|Neil Diamond;Skandal im Sperrbezirk|Spider Murphy Gang;Major Tom (Völlig losgelöst)|Peter Schilling;Rock Me Amadeus|Falco;Fiesta Mexicana|Rex Gildo;Ein Bett im Kornfeld|Jürgen Drews;Joana|Roland Kaiser;Atemlos durch die Nacht|Helene Fischer;Tage wie diese|Die Toten Hosen;Angels|Robbie Williams",
    boy: "I Want It That Way|Backstreet Boys;Everybody (Backstreet's Back)|Backstreet Boys;As Long as You Love Me|Backstreet Boys;Larger Than Life|Backstreet Boys;Quit Playing Games (With My Heart)|Backstreet Boys;Bye Bye Bye|*NSYNC;It's Gonna Be Me|*NSYNC;Back for Good|Take That;Patience|Take That;Relight My Fire|Take That;Flying Without Wings|Westlife;Uptown Girl|Westlife;What Makes You Beautiful|One Direction;Story of My Life|One Direction;Best Song Ever|One Direction;End of the Road|Boyz II Men;Step by Step|New Kids on the Block;MMMBop|Hanson;Sucker|Jonas Brothers;Wannabe|Spice Girls;Spice Up Your Life|Spice Girls;2 Become 1|Spice Girls;Say My Name|Destiny's Child;Survivor|Destiny's Child;Bootylicious|Destiny's Child;No Scrubs|TLC;Waterfalls|TLC;Shout Out to My Ex|Little Mix;Black Magic|Little Mix;Work from Home|Fifth Harmony;Push the Button|Sugababes;Round Round|Sugababes;Never Ever|All Saints;Pure Shores|All Saints;Don't Stop Movin'|S Club 7;Reach|S Club 7;Daylight in Your Eyes|No Angels;Ich find dich scheiße|Tic Tac Toe;Hot Summer|Monrose;Tragedy|Steps;Dynamite|BTS;How You Like That|BLACKPINK;Hold On|Wilson Phillips",
    summer: "Despacito|Luis Fonsi;Macarena|Los Del Rio;Mambo No. 5 (A Little Bit of...)|Lou Bega;Bailando|Enrique Iglesias;Danza Kuduro|Don Omar;Lambada|Kaoma;Ai Se Eu Te Pego|Michel Teló;Waka Waka (This Time for Africa)|Shakira;Summer|Calvin Harris;Dragostea Din Tei|O-Zone;The Ketchup Song (Aserejé)|Las Ketchup;Bamboleo|Gipsy Kings;Sommer in der Stadt|Spider Murphy Gang;Sommer unseres Lebens|Sebastian Hämer;Cruel Summer|Taylor Swift;Watermelon Sugar|Harry Styles;Sunflower|Post Malone;Mr. Saxobeat|Alexandra Stan;Party Rock Anthem|LMFAO;Taki Taki|DJ Snake;Señorita|Shawn Mendes;Kokomo|The Beach Boys;Surfin' U.S.A.|The Beach Boys;In the Summertime|Mungo Jerry;Walking on Sunshine|Katrina and the Waves;Summer of '69|Bryan Adams;Summertime|DJ Jazzy Jeff & The Fresh Prince;Dancing in the Moonlight|Toploader;Here Comes the Hotstepper|Ini Kamoze;Island in the Sun|Weezer;Cheap Thrills|Sia;Get Lucky|Daft Punk;Calma|Pedro Capó;Hot in Herre|Nelly;Summer Wine|Nancy Sinatra",
    tiktok: "Espresso|Sabrina Carpenter;Paint the Town Red|Doja Cat;Say So|Doja Cat;Running Up That Hill (A Deal with God)|Kate Bush;Savage Love (Laxed - Siren Beat)|Jawsh 685;Roses|SAINt JHN;Old Town Road|Lil Nas X;MONTERO (Call Me By Your Name)|Lil Nas X;STAY|The Kid LAROI;Heat Waves|Glass Animals;Unholy|Sam Smith;Kill Bill|SZA;Cupid|FIFTY FIFTY;Calm Down|Rema;Lovin On Me|Jack Harlow;greedy|Tate McRae;Beautiful Things|Benson Boone;A Bar Song (Tipsy)|Shaboozey;APT.|ROSÉ;BIRDS OF A FEATHER|Billie Eilish;Die With A Smile|Lady Gaga;Murder on the Dancefloor|Sophie Ellis-Bextor;Bloody Mary|Lady Gaga;Water|Tyla;Good Luck, Babe!|Chappell Roan;Pink Pony Club|Chappell Roan;Super Freaky Girl|Nicki Minaj;abcdefu|GAYLE;drivers license|Olivia Rodrigo;Rasputin|Boney M.;Daisy|Ashnikko;Infinity|Jaymes Young;Jiggle Jiggle|Duke & Jones;Flowers|Miley Cyrus;Houdini|Dua Lipa",
    onehit: "Macarena|Los Del Rio;Blue (Da Ba Dee)|Eiffel 65;Tubthumping|Chumbawamba;Come On Eileen|Dexys Midnight Runners;Somebody That I Used to Know|Gotye;Dragostea Din Tei|O-Zone;Ice Ice Baby|Vanilla Ice;Mickey|Toni Basil;Video Killed the Radio Star|The Buggles;Tainted Love|Soft Cell;Who Let the Dogs Out|Baha Men;Spirit in the Sky|Norman Greenbaum;Crazy|Gnarls Barkley;Kung Fu Fighting|Carl Douglas;I'm Too Sexy|Right Said Fred;Steal My Sunshine|Len;How Bizarre|OMC;Teenage Dirtbag|Wheatus;Lemon Tree|Fool's Garden;Hey There Delilah|Plain White T's;What's Up?|4 Non Blondes;Bitter Sweet Symphony|The Verve;Torn|Natalie Imbruglia;Popcorn|Hot Butter;Venus|Shocking Blue;Sugar, Sugar|The Archies;My Sharona|The Knack;The Safety Dance|Men Without Hats;Turning Japanese|The Vapors;The Ketchup Song (Aserejé)|Las Ketchup;Gangnam Style|PSY;Rhythm of the Night|Corona",
    ballad: "I Will Always Love You|Whitney Houston;My Heart Will Go On|Céline Dion;(Everything I Do) I Do It for You|Bryan Adams;Unchained Melody|The Righteous Brothers;All of Me|John Legend;Perfect|Ed Sheeran;Thinking Out Loud|Ed Sheeran;Someone Like You|Adele;Make You Feel My Love|Adele;Hello|Lionel Richie;Careless Whisper|George Michael;Nothing Compares 2 U|Sinéad O'Connor;I Don't Want to Miss a Thing|Aerosmith;November Rain|Guns N' Roses;Wind of Change|Scorpions;Still Loving You|Scorpions;Total Eclipse of the Heart|Bonnie Tyler;Hero|Enrique Iglesias;A Thousand Years|Christina Perri;Stay With Me|Sam Smith;When I Was Your Man|Bruno Mars;Just the Way You Are|Bruno Mars;Angels|Robbie Williams;Tears in Heaven|Eric Clapton;Your Song|Elton John;Can't Help Falling in Love|Elvis Presley;The Lady in Red|Chris de Burgh;Always|Bon Jovi;Kiss from a Rose|Seal;Iris|Goo Goo Dolls;Halo|Beyoncé;Ohne dich (schlaf ich heut Nacht nicht ein)|Münchener Freiheit;Der Weg|Herbert Grönemeyer;Halt dich an mir fest|Revolverheld;Für mich soll's rote Rosen regnen|Hildegard Knef",
    ndw: "99 Luftballons|Nena;Nur geträumt|Nena;Irgendwie, irgendwo, irgendwann|Nena;Da Da Da|Trio;Skandal im Sperrbezirk|Spider Murphy Gang;Major Tom (Völlig losgelöst)|Peter Schilling;Sternenhimmel|Hubert Kah;Ich will Spaß|Markus;Der Kommissar|Falco;Rock Me Amadeus|Falco;Jeanny|Falco;Goldener Reiter|Joachim Witt;Fred vom Jupiter|Andreas Dorau;Blaue Augen|Ideal;Bruttosozialprodukt|Geier Sturzflug;Ein Jahr (Es geht voran)|Fehlfarben;Dreiklangsdimensionen|Rheingold;Hurra, hurra, die Schule brennt|Extrabreit;Carbonara|Spliff;Codo|DÖF;Hohe Berge|Frl. Menke;Sonderzug nach Pankow|Udo Lindenberg;Männer|Herbert Grönemeyer;Bochum|Herbert Grönemeyer;Verdamp lang her|BAP;Alt wie ein Baum|Puhdys;Über sieben Brücken musst du gehn|Karat;Live Is Life|Opus;Das Model|Kraftwerk;Westerland|Die Ärzte;Hier kommt Alex|Die Toten Hosen;Ohne dich (schlaf ich heut Nacht nicht ein)|Münchener Freiheit;Marmor, Stein und Eisen bricht|Drafi Deutscher;Ein bißchen Frieden|Nicole;Sexy|Westernhagen",
    rnb: "Crazy in Love|Beyoncé;Halo|Beyoncé;Yeah!|Usher;Burn|Usher;Fallin'|Alicia Keys;No One|Alicia Keys;Kill Bill|SZA;Snooze|SZA;Earned It|The Weeknd;Thinking Bout You|Frank Ocean;Umbrella|Rihanna;With You|Chris Brown;All of Me|John Legend;We Belong Together|Mariah Carey;I Wanna Dance with Somebody (Who Loves Me)|Whitney Houston;Leave the Door Open|Bruno Mars;Focus|H.E.R.;So Sick|Ne-Yo;Say My Name|Destiny's Child;Rehab|Amy Winehouse;Get You|Daniel Caesar;Respect|Aretha Franklin;Ain't No Sunshine|Bill Withers;Let's Stay Together|Al Green;Superstition|Stevie Wonder;Sexual Healing|Marvin Gaye;No Diggity|Blackstreet;Kiss Me More|Doja Cat;Love on Top|Beyoncé;Pony|Ginuwine",
    latin: "Despacito|Luis Fonsi;Gasolina|Daddy Yankee;Mi Gente|J Balvin;Tusa|KAROL G;Dákiti|Bad Bunny;Tití Me Preguntó|Bad Bunny;Me Porto Bonito|Bad Bunny;Hips Don't Lie|Shakira;La Tortura|Shakira;Bailando|Enrique Iglesias;Livin' la Vida Loca|Ricky Martin;Malamente|ROSALÍA;Despechá|ROSALÍA;Hawái|Maluma;Felices los 4|Maluma;Taki Taki|DJ Snake;Danza Kuduro|Don Omar;Calma|Pedro Capó;China|Anuel AA;Todo De Ti|Rauw Alejandro;Ella Baila Sola|Eslabon Armado;Provenza|KAROL G;Vivir Mi Vida|Marc Anthony;Give Me Everything|Pitbull;Mayores|Becky G;Ginza|J Balvin;Bichota|KAROL G;La Bicicleta|Carlos Vives;Échame la Culpa|Luis Fonsi;Hasta el Amanecer|Nicky Jam",
    kpop: "Dynamite|BTS;Butter|BTS;Boy With Luv|BTS;How You Like That|BLACKPINK;DDU-DU DDU-DU|BLACKPINK;Pink Venom|BLACKPINK;Kill This Love|BLACKPINK;APT.|ROSÉ;Seven|Jung Kook;Like Crazy|Jimin;Gangnam Style|PSY;Gentleman|PSY;Fantastic Baby|BIGBANG;FANCY|TWICE;TT|TWICE;Hype Boy|NewJeans;Super Shy|NewJeans;ANTIFRAGILE|LE SSERAFIM;Next Level|aespa;Supernova|aespa;LOVE DIVE|IVE;Queencard|(G)I-DLE;Psycho|Red Velvet;WANNABE|ITZY;God's Menu|Stray Kids;Growl|EXO;Super|SEVENTEEN;Magnetic|ILLIT;Cupid|FIFTY FIFTY;Spicy|aespa",
    indie: "Do I Wanna Know?|Arctic Monkeys;505|Arctic Monkeys;Mr. Brightside|The Killers;The Less I Know the Better|Tame Impala;Dog Days Are Over|Florence + The Machine;Summertime Sadness|Lana Del Rey;Somebody Else|The 1975;Heat Waves|Glass Animals;A-Punk|Vampire Weekend;Kids|MGMT;Electric Feel|MGMT;Pumped Up Kicks|Foster the People;What You Know|Two Door Cinema Club;Pompeii|Bastille;Breezeblocks|alt-J;Little Lion Man|Mumford & Sons;Take Me to Church|Hozier;Riptide|Vance Joy;Ho Hey|The Lumineers;Little Talks|Of Monsters and Men;Young Folks|Peter Bjorn and John;Float On|Modest Mouse;Take Me Out|Franz Ferdinand;Seven Nation Army|The White Stripes;Last Nite|The Strokes;Sweater Weather|The Neighbourhood;Ride|Twenty One Pilots;Stressed Out|Twenty One Pilots;Shut Up and Dance|WALK THE MOON;Somebody That I Used to Know|Gotye",
    metal: "Enter Sandman|Metallica;Nothing Else Matters|Metallica;Master of Puppets|Metallica;Du hast|Rammstein;Sonne|Rammstein;Engel|Rammstein;Duality|Slipknot;Chop Suey!|System of a Down;Toxicity|System of a Down;The Trooper|Iron Maiden;Run to the Hills|Iron Maiden;Numb|Linkin Park;American Idiot|Green Day;Basket Case|Green Day;The Kids Aren't Alright|The Offspring;Self Esteem|The Offspring;All the Small Things|blink-182;Fat Lip|Sum 41;Can You Feel My Heart|Bring Me the Horizon;Hail to the King|Avenged Sevenfold;Down with the Sickness|Disturbed;Freak on a Leash|Korn;Break Stuff|Limp Bizkit;Killing in the Name|Rage Against the Machine;Paranoid|Black Sabbath;Ace of Spades|Motörhead;Painkiller|Judas Priest;Holy Diver|Dio;Bring Me to Life|Evanescence;Smells Like Teen Spirit|Nirvana"};
  const hitList = g => { const one = k => String(HITS[k] || "").split(";").map(x => { const [t, a] = x.split("|"); return t && a ? {t: t.trim(), a: a.trim(), g: k} : null; }).filter(Boolean);
    return g === "mix" ? Object.keys(HITS).filter(k => !["xmas", "kids"].includes(k)).flatMap(one) : g === "pop" || g === "charts" ? ["y00", "y10", "y20", "tiktok"].flatMap(one) : one(g); };
  /* how hard: how many songs come from the radio hits, from the artists' better known songs, and from the deep cuts only fans know */
  const LVL = {main: [.82, .14, .04], mid: [.55, .3, .15], fan: [.15, .35, .5]};
  const LVLS = [["main", ["🌟 Mainstream", "🌟 Mainstream"], ["Radio hits everyone knows", "Radio-Hits, die jeder kennt"]], ["mid", ["🎧 Medium", "🎧 Medium"], ["Hits and some lesser known songs", "Hits und ein paar weniger bekannte"]], ["fan", ["🤘 Groupie", "🤘 Groupie"], ["Deep cuts for real fans", "Album-Songs für echte Fans"]]];
  const RANK = {hit: [0, 3], known: [3, 10], fan: [10, 30]};
  /* look a song up in Apple's search: the preview, and its earliest year */
  async function findSong(t, a){ const fa = N(art1(a)), d = await itunes({term: bare(t) + " " + art1(a), entity: "song", limit: 12}); if (!d) return null;
    const R = (d.results || []).filter(r => r.previewUrl && OKURL.test(r.previewUrl) && r.trackName && r.artistName && (N(r.artistName).includes(fa) || fa.includes(N(art1(r.artistName)))) && titleOk(bare(r.trackName), t) && !/karaoke|instrumental|\blive\b/i.test(r.trackName));
    if (!R.length) return {r: null}; const ys = R.map(yearOf).filter(y => y > 1900); return {r: R[0], y: ys.length ? String(Math.min(...ys)) : ""}; }
  /* ---------- songs of a genre (or your own artists). Mostly the radio hits everyone knows (HITS), some better known songs of the
     genre's artists, and a few deep cuts for fans; how many of each depends on the level (Mainstream, Medium, Groupie). For your own
     artists (Groupie with only Michael Jackson): their biggest hits, their better known songs, their album songs. Never a song of the
     last 600. The year is the earliest release of that title (a remaster from 2011 doesn't make "Bohemian Rhapsody" a 2011 song) ---------- */
  const Pool = {
    make(o){ const P = {o, songs: [], bank: [], shown: new Set(), busy: 0, tried: new Set(), used: used0(), fails: 0, titles: new Set()}, mix = LVL[o.lvl] || LVL.main;
      P.cur = o.genre === "own" ? [] : PG.shuffle(hitList(o.genre));
      /* the radio hits are the wrong answers too: songs people know */
      P.bank = P.cur.map(x => ({id: "h:" + N(x.t) + "|" + N(x.a), title: bare(x.t), artist: art1(x.a), lang: langOf(bare(x.t), x.g), g: x.g}));
      const add = (r, y, g, tier, alts) => { const title = String(r.trackName).slice(0, 90), k = N(bare(title)); if (P.used.has(String(r.trackId)) || P.titles.has(k) || P.shown.has(k) || P.songs.some(x => x.id === String(r.trackId))) return false;
        P.titles.add(k); P.songs.push({id: String(r.trackId), title, artist: String(r.artistName).slice(0, 60), url: r.previewUrl, art: OKURL.test(r.artworkUrl100 || "") ? r.artworkUrl100 : null, year: String(y || yearOf(r) || ""), g, lang: langOf(bare(title), g), alts: alts || [], tier}); return true; };
      /* a radio hit: the next one of the list that Apple has */
      P.hit = async () => { for (let k = 0; k < 3 && P.cur.length; k++){ const x = P.cur.shift(); if (P.shown.has(N(bare(x.t))) || P.titles.has(N(bare(x.t)))) continue; const f = await findSong(x.t, x.a); if (!f){ P.fails++; return; } if (f.r && add(f.r, f.y, G[x.g] ? x.g : o.genre, "hit")) return; } };
      /* an artist's songs, by how well known they are (Apple lists the best known first) */
      P.art = async tier => { const all = artistsOf(o); if (!all.length) return; let A = all.filter(a => !P.tried.has(a)); if (!A.length){ P.tried.clear(); A = all; }
        const term = PG.pick(A); P.tried.add(term);
        const d = await itunes({term, entity: "song", attribute: "artistTerm", limit: 60}); if (!d){ P.fails++; return; }
        const g = ["mix", "own"].includes(o.genre) ? (genreOf(term) || o.genre) : o.genre, yr = G[o.genre] && G[o.genre][4], only = G[g] && G[g][5] ? new RegExp(G[g][5], "i") : null, tn = N(term), seen = {}, Y = {};
        (d.results || []).forEach(r => { const k = N(bare(r.trackName)), y = yearOf(r); if (k && y > 1900 && (!Y[k] || y < Y[k])) Y[k] = y; });
        let L = (d.results || []).filter(r => r.previewUrl && r.trackName && r.artistName && OKURL.test(r.previewUrl) && (N(r.artistName).includes(tn) || tn.includes(N(r.artistName))))
          .filter(r => { const k = N(bare(r.trackName)); if (!k || seen[k] || /karaoke|instrumental|\blive\b|remix|acoustic|sped up|slowed/i.test(r.trackName)) return false; seen[k] = 1; return true; });
        /* Christmas and the like: only the songs that fit */
        if (only) L = L.filter(r => only.test(r.trackName));
        /* a decade: only songs from those years, if the search knows enough of them */
        if (yr){ const inY = L.filter(r => { const y = Y[N(bare(r.trackName))] || yearOf(r); return y >= yr[0] && y <= yr[1]; }); if (inY.length >= 4) L = inY; }
        const top = L.slice(0, 30), titles = top.map(r => bare(String(r.trackName)).slice(0, 90)), rk = RANK[tier] || RANK.known;
        /* few songs known: the deep cuts start earlier */
        let band = top.slice(rk[0], rk[1]); if (!band.length) band = top.slice(Math.max(0, top.length - 5));
        const pick = PG.shuffle(band).find(r => !P.used.has(String(r.trackId)) && !P.titles.has(N(bare(r.trackName))) && !P.shown.has(N(bare(r.trackName))));
        if (pick) add(pick, Y[N(bare(pick.trackName))], g, tier, titles.filter(t => N(t) !== N(bare(pick.trackName))).slice(0, 20));
        top.filter(r => r !== pick).slice(0, 12).forEach(r => P.bank.push({id: String(r.trackId), title: bare(String(r.trackName)).slice(0, 90), artist: String(r.artistName).slice(0, 60), g, lang: langOf(bare(r.trackName), g)}));
        if (P.bank.length > 700) P.bank.splice(0, P.bank.length - 700); };
      /* the category's big playlists (api/songs?pl=…): hundreds of songs with their previews in one answer, the best known first.
         The top third are hits, the middle the better known songs, the rest for fans */
      const plKey = o.genre === "own" ? null : o.genre;
      P.plLoad = async () => { if (!plKey || (P.plDead && Date.now() - P.plDead < 60000)) return []; if (P.plL && Date.now() - P.plT < 150000) return P.plL; if (P.plWait) return P.plWait;
        P.plWait = songApi({pl: plKey}).then(d => { P.plT = Date.now(); P.plWait = null; const seen = {};
          P.plL = ((d && d.results) || []).filter(r => r.previewUrl && OKURL.test(r.previewUrl) && r.trackName && r.artistName && !/karaoke|instrumental/i.test(r.trackName)).filter(r => { const k = N(bare(r.trackName)) + "|" + N(art1(r.artistName)); if (seen[k]) return false; seen[k] = 1; return true; });
          const g = G[o.genre] ? o.genre : "mix"; P.plL.slice(0, 300).forEach(r => P.bank.push({id: String(r.trackId), title: bare(String(r.trackName)).slice(0, 90), artist: art1(String(r.artistName)).slice(0, 60), g, lang: langOf(bare(r.trackName), g)}));
          if (P.bank.length > 900) P.bank.splice(0, P.bank.length - 900);
          return P.plL; });
        return P.plWait; };
      /* the playlists don't answer (offline, or the server can't reach Deezer): try again in a minute, the other sources go on */
      P.pl = async tier => { const L = await P.plLoad(); if (!L.length){ if (!P.plDead || Date.now() - P.plDead >= 60000) P.plDead = Date.now(); return false; }
        const n = L.length, band = tier === "hit" ? [0, .34] : tier === "known" ? [.25, .7] : [.55, 1], g = G[o.genre] ? o.genre : "mix";
        const C = L.slice(Math.floor(band[0] * n), Math.max(1, Math.ceil(band[1] * n))).filter(r => fresh(r.previewUrl) && !P.used.has(String(r.trackId)) && !P.titles.has(N(bare(r.trackName))) && !P.shown.has(N(bare(r.trackName))));
        const pick = PG.pick(C.length ? C : L.filter(r => fresh(r.previewUrl) && !P.titles.has(N(bare(r.trackName))))); if (!pick) return false;
        const alts = L.filter(r => r !== pick && N(art1(r.artistName)) === N(art1(pick.artistName))).map(r => bare(String(r.trackName)).slice(0, 90)).slice(0, 20);
        return add(pick, "", g, tier, alts); };
      P.one = async () => { P.busy++; try { const r = Math.random(), tier = r < mix[0] ? "hit" : r < mix[0] + mix[1] ? "known" : "fan", n0 = P.songs.length;
          /* a radio hit from the list; when the list is used up or the search fails: the playlists */
          if (tier === "hit"){ if (P.cur.length){ await P.hit(); if (P.songs.length > n0) return; } if (plKey && await P.pl("hit")) return; if (!P.cur.length) await P.art("hit"); return; }
          /* the others: the artists' songs or the playlists, half and half (only playlists for categories without an artist list) */
          if (plKey && (!artistsOf(o).length || Math.random() < .5)) { if (!(await P.pl(tier))) await P.art(tier); }
          else { await P.art(tier); if (P.songs.length === n0 && plKey) await P.pl(tier); } }
        finally { P.busy--; P.songs = PG.shuffle(P.songs); } };
      P.fill = async (n = 6) => { let guard = 0; while (P.songs.length < n && guard++ < 14 && P.fails < 8) await Promise.all([P.one(), P.one()]);
        /* still nothing: the playlists of the whole mix, so a round never stops for want of songs */
        if (!P.songs.length && o.genre !== "mix"){ const M2 = Pool.make({genre: "mix", lvl: o.lvl}); M2.used = P.used; await M2.fill(Math.min(n, 4)); M2.songs.forEach(x => { if (!P.titles.has(N(bare(x.title)))){ P.titles.add(N(bare(x.title))); P.songs.push(x); } }); } };
      /* a song whose Deezer link is about to run out is dropped */
      P.next = () => { let s2 = P.songs.shift(); while (s2 && !fresh(s2.url)) s2 = P.songs.shift(); if (s2) markUsed(P, s2); if (P.songs.length < 4 && !P.busy) P.fill(); return s2; };
      P.opts = optsOf(P);
      return P; }
  };
  /* ---------- songs from Spotify playlists: each one looked up in Apple's search for the preview; the playlist's other songs are
     the wrong answers (songs the group knows) ---------- */
  const PlPool = {
    make(tracks){ const P = {songs: [], bank: [], shown: new Set(), busy: 0, used: used0(), fails: 0, q: tracks.slice()};
      P.bank = tracks.map(x => ({id: "pl:" + N(x.t) + "|" + N(x.a), title: bare(x.t), artist: art1(x.a), lang: langOf(bare(x.t), ""), g: "pl"}));
      P.one = async () => { const tr = P.q.shift(); if (!tr) return; if (P.shown.has(N(bare(tr.t)))) return; P.busy++;
        try { const f = await findSong(tr.t, tr.a); if (!f){ P.fails++; P.q.push(tr); return; } const r = f.r;
          if (!r || P.used.has(String(r.trackId)) || P.songs.some(x => x.id === String(r.trackId))) return;
          const title = String(r.trackName).slice(0, 90);
          P.songs.push({id: String(r.trackId), title, artist: String(r.artistName).slice(0, 60), url: r.previewUrl, art: OKURL.test(r.artworkUrl100 || "") ? r.artworkUrl100 : null, year: f.y, g: "pl", lang: langOf(bare(title), ""), alts: [], own: tr.o || null, tier: "hit"}); }
        finally { P.busy--; } };
      P.fill = async (n = 6) => { let guard = 0; while (P.songs.length < n && P.q.length && guard++ < 12 && P.fails < 4) await Promise.all([P.one(), P.one(), P.one()]); };
      P.next = () => { const s2 = P.songs.shift(); if (s2) markUsed(P, s2); if (P.songs.length < 3 && !P.busy) P.fill(4); return s2; };
      P.opts = optsOf(P);
      return P; }
  };
  /* your playlist (saved on this phone): name, link and the songs */
  const myPl = () => { const p = PG.st.songPl; return p && Array.isArray(p.tracks) && p.tracks.length ? p : null; };

  /* ---------- one player for every clip. It is loaded ahead (while the phone is passed on, or during the 3-2-1), and every clip starts
     at its first second (or where the last part stopped): the clip's time only starts counting once the sound really plays.
     The iPhone only plays sound a tap started: the first tap in the game wakes the player; it counts as music (plays on silent too) ---------- */
  const SA = (() => { const au = new Audio(); au.preload = "auto"; au.setAttribute("playsinline", ""); let ok = false, key = null, tok = 0, stopT = 0, starts = [], dl = 0, dlWant = 0, dlT = 0, cur = null;
    try { au.preservesPitch = true; au.webkitPreservesPitch = true; au.mozPreservesPitch = true; } catch(e) {}
    const silent = (() => { const n = 1600, b = new Uint8Array(44 + n), dv = new DataView(b.buffer), w = (o2, str) => [...str].forEach((ch, i) => { b[o2 + i] = ch.charCodeAt(0); });
      w(0, "RIFF"); dv.setUint32(4, 36 + n, true); w(8, "WAVEfmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true); w(36, "data"); dv.setUint32(40, n, true); b.fill(128, 44);
      let bin = ""; b.forEach(x => { bin += String.fromCharCode(x); }); return "data:audio/wav;base64," + btoa(bin); })();
    const music = on => { try { if (PG.audio) PG.audio.music(on); } catch(e) {} };
    const halt = () => { starts.forEach(clearTimeout); starts = []; clearTimeout(stopT); };
    const go = (k, url, secs, onNeed, from) => { if (key !== k) return; music(true); clearTimeout(stopT);
      const arm = () => { au.removeEventListener("playing", arm); if (key !== k) return; clearTimeout(stopT); if (secs) stopT = setTimeout(() => { if (key === k) try { au.pause(); } catch(e) {} }, secs * 1000); };
      try { au.pause(); au.muted = false; if (au.src !== url) au.src = url; try { au.currentTime = from || 0; } catch(e) {} au.addEventListener("playing", arm);
        Promise.resolve(au.play()).then(() => { ok = true; }).catch(e => { au.removeEventListener("playing", arm); if (key === k && (!e || e.name === "NotAllowedError")) onNeed && onNeed(); }); }
      catch(e) { onNeed && onNeed(); } };
    /* parts still to come start on time; one that is already running (a phone that came in late) starts now, where it is */
    /* dl: how much later this phone plays than planned, while someone else sings along (see Sing) */
    const sched = (k, url, parts, onNeed) => { cur = {k, url, parts, onNeed}; const t = Date.now(); starts = parts.filter(p => p.at + dl + p.len * 1000 > t).map(p => { const at = p.at + dl, late = Math.max(0, t - at), off = late > 300 ? late / 1000 : 0;
      return setTimeout(() => go(k, url, p.len - off, onNeed, (p.from || 0) + off), Math.max(0, at - t)); }); };
    return {au, get ok(){ return ok; }, get key(){ return key; },
      unlock(){ music(true); if (ok || key || (au.src && OKURL.test(au.src)) || (typeof PVoice !== "undefined" && (PVoice.on || PVoice.starting))) return;
        try { au.muted = true; au.src = silent; Promise.resolve(au.play()).then(() => { if (au.src === silent){ au.pause(); au.muted = false; } ok = true; }).catch(() => { if (au.src === silent) au.muted = false; }); } catch(e) {} },
      /* load the clip now (played without sound for a moment, so the iPhone really loads it, then back to the start); done() once it can play */
      prep(url, done, onBad){ const my = ++tok; let fired = false, to = 0;
        const bad = () => { au.removeEventListener("error", bad); if (fired || my !== tok) return; fired = true; clearTimeout(to); au.removeEventListener("playing", fin); au.removeEventListener("canplaythrough", fin); au.muted = false; if (onBad) onBad(); else if (done) done(); };
        const fin = () => { if (fired) return; fired = true; clearTimeout(to); au.removeEventListener("error", bad); au.removeEventListener("playing", fin); au.removeEventListener("canplaythrough", fin);
          if (my === tok && !key){ try { au.pause(); au.currentTime = 0; } catch(e) {} au.muted = false; } if (done) done(); };
        if (!OKURL.test(url || "")) return fin();
        key = null; halt(); music(true);
        if (au.src === url && au.readyState >= 4) return fin();
        if (au.src !== url) au.src = url;
        to = setTimeout(fin, 3500); au.addEventListener("canplaythrough", fin); au.addEventListener("playing", fin); au.addEventListener("error", bad);
        try { au.muted = true; Promise.resolve(au.play()).catch(() => { if (my === tok && !key) au.muted = false; }); } catch(e) {} },
      /* the parts of a clip at the moments the host set ([{at, len, from}]) */
      plan(k, url, parts, onNeed){ if (key === k || !OKURL.test(url || "")) return; key = k; tok++; halt(); music(true);
        if (au.src !== url){ au.src = url; try { au.load(); } catch(e) {} } sched(k, url, parts, onNeed); },
      /* the host changed the plan (more listening): the part that plays now goes on, the rest is set anew */
      replan(k, url, parts, onNeed){ if (key !== k) return this.plan(k, url, parts, onNeed); starts.forEach(clearTimeout); starts = []; sched(k, url, parts.filter(p => p.at > Date.now() - 80), onNeed); },
      /* a tap: right now, from the start or from a point (the phone's own game) */
      now(url, secs, from){ key = "n" + (++tok); halt(); go(key, url, secs, null, from); },
      /* "tap to listen" when this phone needed a tap: now, and the later parts still come on time */
      hear(url, secs, from){ if (key && au.src === url){ clearTimeout(stopT); go(key, url, secs, null, from); } else this.now(url, secs, from); },
      /* the answer is out: the rest of the preview plays on */
      rest(url){ halt(); key = "rest"; tok++; try { au.muted = false; if (au.src === url && au.paused) Promise.resolve(au.play()).catch(() => {}); } catch(e) {} },
      pos(){ return au.currentTime || 0; },
      /* move the music later (or back) by ms: while it plays, gently (10 % slower or faster, same pitch) until it fits; when nothing plays, at once */
      lag(ms){ dlWant = Math.max(0, Math.min(600, Math.round(ms || 0))); },
      lagStep(){ const t = Date.now(), el = dlT ? Math.min(500, t - dlT) : 0; dlT = t; const diff = dlWant - dl;
        if (au.paused || !key){ if (diff){ dl = dlWant; if (au.playbackRate !== 1) au.playbackRate = 1; if (key && cur && cur.k === key && starts.length){ starts.forEach(clearTimeout); starts = []; sched(cur.k, cur.url, cur.parts.filter(p => p.at > t - 80), cur.onNeed); } } return; }
        if (Math.abs(diff) <= 25){ if (au.playbackRate !== 1) au.playbackRate = 1; dl = dlWant; return; }
        const r = diff > 0 ? .9 : 1.1; if (au.playbackRate !== r) au.playbackRate = r; dl += (1 - r) * el; },
      get lagMs(){ return Math.round(dl); }, get lagWant(){ return dlWant; }, get rate(){ return au.playbackRate; },
      stop(){ key = null; tok++; halt(); try { au.pause(); } catch(e) {} au.muted = false; music(false); }}; })();
  /* ---------- singing along over the voice chat (Nathan): a voice reaches the others a little late (the network and the phones'
     sound buffers), so whoever sings along to their music sounds behind it on every other phone. Each phone measures how late every
     voice arrives (WebRTC statistics: half the round trip, the jitter buffer and the phones' own sound path) and, while someone else
     sings, lets its music run exactly that much later: the singer's voice and the music arrive together. Two people singing at the
     same moment can't both be in time everywhere (the delay would have to go both ways), so the music follows whoever started first,
     until they have been quiet for a moment; while you sing yourself your music stays where it is, so you are in time for the others.
     The music is moved gently, never with a jump ---------- */
  const Sing = (() => {
    const L = {}, st = {lead: null, heard: {}, on: {}, mineT: 0, it: 0, mt: 0}, X = {};
    const voice = () => typeof PVoice !== "undefined" && PVoice.on, peers = () => X.peers ? X.peers() : voice() ? PVoice.peers() : [];
    const talking = id => X.talking ? X.talking(id) : voice() && PVoice.talking(id), latOf = id => X.lat && X.lat[id] != null ? X.lat[id] : L[id];
    async function measure(){ if (!voice()) return; const pcs = PVoice._pcs || {};
      for (const id of Object.keys(pcs)){ const pc = pcs[id] && pcs[id].pc; if (!pc || pc.connectionState !== "connected") continue;
        try { const r = await pc.getStats(); let rtt = null, jb = null; r.forEach(v => { if (v.type === "candidate-pair" && v.nominated && v.state === "succeeded" && v.currentRoundTripTime != null) rtt = v.currentRoundTripTime; if (v.type === "inbound-rtp" && v.kind === "audio" && v.jitterBufferEmittedCount) jb = v.jitterBufferDelay / v.jitterBufferEmittedCount; });
          if (rtt != null) L[id] = Math.round(Math.min(600, (rtt / 2 + (jb != null ? jb : .06) + .06) * 1000)); } catch(e) {} } }
    function step(){ const t = Date.now(), ps = peers(), me = PNet.me;
      ps.forEach(id => { if (talking(id)){ if (!st.on[id] || t - (st.heard[id] || 0) > 400) st.on[id] = t; st.heard[id] = t; } });
      if (st.lead && (!ps.includes(st.lead) || t - (st.heard[st.lead] || 0) > 2500)) st.lead = null;
      const meTalk = talking(me); if (meTalk) st.mineT = t;
      if (!st.lead && !(t - st.mineT < 1500)){ let best = null; ps.forEach(id => { if (t - (st.heard[id] || 0) < 300 && t - st.on[id] >= 400 && (!best || st.on[id] < st.on[best])) best = id; }); st.lead = best; }
      SA.lag(st.lead && latOf(st.lead) != null ? latOf(st.lead) : 0); SA.lagStep(); badge(t); }
    /* a small line on the screen: who leads and by how much the music runs later; or that you lead */
    function badge(t){ const box = document.querySelector(".sg-on"); if (!box) return; let b = box.querySelector(".sg-sing");
      const txt = st.lead ? `🎤 ${h(PNet.nameOf(st.lead) || "?")} ${T("sings along · your music follows", "singt mit · deine Musik läuft")} ${SA.lagWant} ms ${T("later, so it fits", "später, damit es passt")}` : t - st.mineT < 1500 && peers().length ? `🎤 ${T("You sing along · the others hear you in time", "Du singst mit · die anderen hören dich im Takt")}` : "";
      if (!txt){ if (b) b.remove(); return; } if (!b){ b = document.createElement("div"); b.className = "sg-sing"; box.prepend(b); } if (b._t !== txt){ b._t = txt; b.innerHTML = txt; } }
    return {start(){ if (st.it) return; st.it = setInterval(step, 100); st.mt = setInterval(measure, 2000); measure(); },
      stop(){ clearInterval(st.it); clearInterval(st.mt); st.it = st.mt = 0; st.lead = null; SA.lag(0); SA.lagStep(); },
      get lead(){ return st.lead; }, L, step, test(o){ Object.assign(X, o || {}); }}; })();
  PG.songSA = SA; PG._song = {Pool, PlPool, langOf, LVL, Sing, Rank, secs, G, HITS};   /* for the tests and for looking into it on a phone */
  /* the first tap in the song game wakes the player (not the voice chat buttons: the microphone comes first there) */
  document.addEventListener("pointerdown", e => { if (typeof App === "undefined" || !(App.route === "lobby" || App.route === "party") || (e.target && e.target.closest && e.target.closest("#lvoice,#lvx"))) return;
    const P = typeof PNet !== "undefined" && PNet.P, song = App.route === "party" ? PG.st.last === "song" : !!(P && (P.game === "song" || (P.msg && P.msg.game === "song"))); if (song) SA.unlock(); }, true);

  /* ---------- the song library (like Spotify): type a few letters, Apple's search lists songs (or artists), one tap is your answer.
     "Search" on the keyboard only searches (and closes the keyboard); giving up is only the "No idea" button ---------- */
  const LIB = new Map();
  function library(box, what, onPick, {auto = true} = {}){
    const art = what === "artist";
    box.innerHTML = `<form class="sg-lib" autocomplete="off"><div class="sg-sq"><span aria-hidden="true">🔎</span><input type="text" id="sgt" data-in="t" maxlength="80" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="${art ? T("Search the artist …", "Interpret suchen …") : T("Search the song …", "Song suchen …")}"></div>
      <div class="sg-sugs"></div><p class="pg-hint sg-lh">${art ? T("Type, then tap the artist.", "Tippen, dann Interpret antippen.") : T("Type, then tap the song.", "Tippen, dann Song antippen.")}</p></form>`;
    const inp = box.querySelector("input"), out = box.querySelector(".sg-sugs"), hint = box.querySelector(".sg-lh"); let tm = 0, seq = 0, L = [];
    const draw = () => { out.innerHTML = L.map((x, i) => `<button type="button" class="sg-sug" data-sg="${i}">${x.art ? `<img src="${h(x.art)}" alt="" width="40" height="40">` : `<span class="sg-sgi">${art ? "🎤" : "🎵"}</span>`}<span class="sg-sx"><b>${h(art ? x.artist : x.title)}</b>${art ? "" : `<small>${h(x.artist)}</small>`}</span></button>`).join("");
      out.querySelectorAll("[data-sg]").forEach(b => b.onclick = () => { const x = L[+b.dataset.sg]; if (!x || b.disabled) return; PG.vib(12); b.classList.add("on"); onPick({title: x.title || "", artist: x.artist || "", picked: true}); }); };
    const show = d => { const seen = new Set();
      L = ((d && d.results) || []).filter(r => art ? r.artistName : r.trackName).map(r => ({title: r.trackName ? String(r.trackName).slice(0, 90) : "", artist: String(r.artistName || "").slice(0, 60), art: OKURL.test(r.artworkUrl60 || "") ? r.artworkUrl60 : null}))
        .filter(x => { const k = art ? N(x.artist) : N(bare(x.title)) + "|" + N(x.artist); if (!k || seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
      draw(); hint.textContent = !d ? T("No connection to the library. Try again.", "Keine Verbindung zur Bibliothek. Nochmal versuchen.") : L.length ? "" : T("Nothing found. Try other words.", "Nichts gefunden. Andere Wörter probieren."); };
    const search = (now2) => { clearTimeout(tm); const v = inp.value.trim(), q = (art ? "a:" : "s:") + v.toLowerCase(), my = ++seq; if (v.length < 2){ L = []; draw(); return; }
      if (LIB.has(q)) return show(LIB.get(q));
      tm = setTimeout(async () => { hint.textContent = T("Searching …", "Suche …"); const d = await itunes(art ? {term: v, entity: "musicArtist", limit: 10} : {term: v, entity: "song", limit: 15}); if (d) LIB.set(q, d); if (my === seq) show(d); }, now2 ? 0 : 280); };
    inp.addEventListener("input", () => search(false));
    /* the keyboard comes up from below: the search field moves to the top, the hits stay in sight */
    inp.addEventListener("focus", () => setTimeout(() => { try { inp.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth", block: "start"}); } catch(x) {} }, 60));
    box.querySelector("form").onsubmit = e => { e.preventDefault(); try { inp.blur(); } catch(x) {} search(true); };
    if (auto) try { inp.focus({preventScroll: true}); } catch(e) {}
    return inp; }
  /* is the answer right? a song picked from the library counts with its own title and artist ("both": the artist alone is half) */
  const has = (x, y) => { const a = N(x), b = N(y); return b.length >= 3 && (" " + a + " ").includes(" " + b + " "); };
  const judge = (what, ans, s2) => { const t = ans.picked ? bare(ans.title) : ans.title || "", r = ans.artist || "";
    if (what === "artist") return [artistOk(ans.picked ? r : r || t, s2.artist) || !ans.picked && has(t, s2.artist)];
    const tOk = titleOk(t, s2.title) || !ans.picked && has(t, bare(s2.title));
    return what === "both" ? [tOk, artistOk(r, s2.artist) || !ans.picked && has(t, s2.artist)] : [tOk]; };

  /* ---------- your Spotify playlist: paste the link, the app reads the songs (api/spotify.js) and keeps them on this phone.
     They become a genre of your own, your wish in a round with friends, and the songs for "Whose song?" ---------- */
  function plBox(box, onChange){
    const draw = (msg) => { const pl = myPl();
      box.innerHTML = `<h3>🎧 ${T("Your Spotify playlist", "Deine Spotify-Playlist")}</h3>
        ${pl ? `<div class="sg-plc"><span class="sg-pli">🎧</span><span class="sg-sx"><b>${h(pl.name || "Playlist")}</b><small>${pl.tracks.length} Songs · ${T("your taste counts in the song choice", "dein Geschmack zählt bei der Songauswahl")}</small></span><button type="button" class="btn ghost sm" data-plx>${T("Remove", "Entfernen")}</button></div>` : `<p class="pg-sub" style="margin:4px 0 0">${T("Paste the link of a playlist: the songs and your taste count in the game. In Spotify: playlist → ⋯ → Share → Copy link.", "Link einer Playlist einfügen: Ihre Songs und dein Geschmack zählen im Spiel. In Spotify: Playlist → ⋯ → Teilen → Link kopieren.")}</p>`}
        <form class="sg-plf" autocomplete="off"><input type="url" inputmode="url" maxlength="400" placeholder="https://open.spotify.com/playlist/…" enterkeyhint="go" autocomplete="off"><button type="submit" class="btn go sm">${pl ? T("Change", "Ändern") : T("Load", "Laden")}</button></form>
        ${msg ? `<p class="pg-sub sg-plm">${h(msg)}</p>` : ""}`;
      const f = box.querySelector("form"), inp = f.querySelector("input");
      f.onsubmit = async e => { e.preventDefault(); const v = inp.value.trim(); if (!/spotify/.test(v)){ draw(T("Please paste a Spotify playlist link.", "Bitte einen Spotify-Playlist-Link einfügen.")); return; }
        const b = f.querySelector("button"); b.disabled = true; b.textContent = "…";
        try { const r = await fetch("/api/spotify?u=" + encodeURIComponent(v)), j = await r.json().catch(() => ({}));
          if (!r.ok || !j.tracks || !j.tracks.length){ draw(j.error || T("That didn't work. Is the playlist public?", "Das hat nicht geklappt. Ist die Playlist öffentlich?")); return; }
          PG.st.songPl = {name: j.name || "Playlist", url: v.slice(0, 300), tracks: j.tracks.slice(0, 150).map(x => ({t: x.t, a: x.a})), at: Date.now()}; PG.persist(); PG.vib(20);
          draw(T(`${j.tracks.length} songs loaded.`, `${j.tracks.length} Songs geladen.`)); onChange && onChange(); }
        catch(err) { draw(T("No connection.", "Keine Verbindung.")); } };
      const x = box.querySelector("[data-plx]"); if (x) x.onclick = () => { delete PG.st.songPl; PG.persist(); draw(); onChange && onChange(); }; };
    draw(); }

  /* ================= one phone, passed around ================= */
  PG.ART.song = ["🎵", "#B65CE0"];
  PG.add({id: "song", icon: "music", name: ["Song Quiz", "Song raten"], tag: ["New", "Neu"], sub: ["Hear a clip, name the song.", "Kurz reinhören, Song erraten."], meta: ["1+ players · pick a genre", "1+ Spieler · Genre wählen"],
    mount(ctx){
      const o = PG.opt("song", {genre: "mix", what: "title", answer: "type", clip: 10, rounds: 5, own: "", lvl: "main"});
      PG.onLeave(() => SA.stop());
      /* quick start: a ready-made set of rules, one tap */
      const PRE = {party: {what: "title", answer: "pick", clip: 10}, profi: {what: "both", answer: "type", clip: 10}, intro: {what: "title", answer: "pick", clip: "up"}};
      const setup = () => {
        ctx.stop(); SA.stop();
        ctx.body.innerHTML = `${ctx.title("Song Quiz", "Song raten")}<p class="muted">${T("A few seconds of a song play. Find it in the song library or pick one of four. Pass the phone on, everyone gets their own songs.", "Ein paar Sekunden eines Songs laufen. Such ihn in der Song-Bibliothek oder tipp einen von vier an. Danach Handy weitergeben, jeder bekommt eigene Songs.")}</p>
          <div class="unit"><h3>${T("Quick start", "Schnellstart")}</h3><div class="pg-pkg" id="sgpre">
            <button class="pg-pk" data-pre="party"><span class="e">🎉</span><b>Party</b><small>${T("Pick one of four, 10 s", "4 zur Auswahl, 10 s")}</small></button>
            <button class="pg-pk" data-pre="profi"><span class="e">🧠</span><b>${T("Pro", "Profi")}</b><small>${T("Title and artist from the library", "Titel und Interpret aus der Bibliothek")}</small></button>
            <button class="pg-pk" data-pre="intro"><span class="e">⏱️</span><b>${T("Longer and longer", "Immer länger")}</b><small>${T("1 s, then 2, 3, 5, 10", "1 s, dann 2, 3, 5, 10")}</small></button></div></div>
          <div class="unit"><h3>${T("Genre", "Genre")}</h3><div class="grid2" style="margin-top:8px" id="sgg"></div>
            <div id="sgow" ${o.genre === "own" ? "" : "hidden"} style="margin-top:10px"><input type="text" id="sgown" maxlength="400" placeholder="${T("Artists, separated by commas", "Künstler, mit Komma getrennt")}" value="${h(o.own)}" autocomplete="off" enterkeyhint="done" style="width:100%"><p class="pg-sub">${T("e.g. Cro, Queen, Shakira", "z. B. Cro, Queen, Shakira")}</p></div>
            <div id="sgpl" class="sg-plbox"></div></div>
          <div class="unit"><h3>${T("How well known", "Wie bekannt")}</h3><div class="pg-pkg" id="sgl"></div></div>
          <div class="unit"><h3>${T("What do you guess?", "Was wird geraten?")}</h3><div id="sgw"></div>
            <h3 style="margin-top:14px">${T("Answer", "Antworten")}</h3><div id="sga"></div>
            <h3 style="margin-top:14px">${T("Clip", "Reinhören")}</h3><div id="sgc"></div>
            <h3 style="margin-top:14px">${T("Songs per player", "Songs pro Person")}</h3><div id="sgr"></div>
            <button class="btn go big" id="sggo" style="margin-top:14px">${T("Start", "Los geht's")} 🎵</button></div>
          <div class="unit" id="sgp"></div>${Rank.box(10)}`;
        Rank.mount(ctx.body.querySelector(".sg-rkbox"), 10);
        const gen = () => { const L = Object.entries(G).concat(myPl() ? [["pl", ["🎧", "Meine Playlist", "My playlist"]]] : []); if (o.genre === "pl" && !myPl()) o.genre = "mix";
          $("#sgg").innerHTML = L.map(([k, g]) => `<button class="btn ${o.genre === k ? "go" : ""}" data-gn="${k}" style="justify-content:flex-start;gap:10px"><span style="font-size:22px">${g[0]}</span>${h(T(g[2], g[1]))}</button>`).join("");
          $$("[data-gn]", ctx.body).forEach(b => b.onclick = () => { o.genre = b.dataset.gn; PG.persist(); gen(); const ow = $("#sgow"); ow.hidden = o.genre !== "own"; if (!ow.hidden){ const i = $("#sgown"); try { i.focus({preventScroll: true}); } catch(e) {} } }); };
        gen(); plBox($("#sgpl"), () => { if (myPl()) o.genre = "pl"; PG.persist(); gen(); });
        $("#sgown").oninput = e => { o.own = e.target.value.slice(0, 400); PG.persist(); };
        /* the keyboard comes up from below: the field glides to the middle first, so it stays in sight */
        $("#sgown").addEventListener("focus", e => setTimeout(() => { try { e.target.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth", block: "center"}); } catch(x) {} }, 60));
        const ch = (id, items, k) => { const d = () => PG.choices($(id), items, o[k], v => { o[k] = v; PG.persist(); d(); }); d(); };
        ch("#sgw", [["title", T("Title", "Titel")], ["artist", T("Artist", "Interpret")], ["both", T("Both", "Beides")]], "what");
        ch("#sga", [["type", T("Song library", "Song-Bibliothek")], ["pick", T("Pick of 4", "4 zur Auswahl")]], "answer");
        ch("#sgc", [[5, "5 s"], [10, "10 s"], [20, "20 s"], ["up", T("Longer and longer 1→10 s", "Immer länger 1→10 s")]], "clip");
        ch("#sgr", [[3, "3"], [5, "5"], [10, "10"]], "rounds");
        /* Mainstream: radio hits; Groupie: deep cuts for fans (best with your own artists, e.g. only Michael Jackson) */
        const lv = () => { $("#sgl").innerHTML = LVLS.map(([k, l, d]) => `<button class="pg-pk ${(o.lvl || "main") === k ? "on" : ""}" data-lv="${k}"><b>${h(T(l[0], l[1]))}</b><small>${h(T(d[0], d[1]))}</small></button>`).join("");
          $$("[data-lv]", ctx.body).forEach(b => b.onclick = () => { o.lvl = b.dataset.lv; PG.persist(); lv(); }); }; lv();
        PG.playersUI($("#sgp"), {min: 0});
        $$("[data-pre]", ctx.body).forEach(b => b.onclick = () => { Object.assign(o, PRE[b.dataset.pre]); PG.persist(); start(); });
        $("#sggo").onclick = start;
      };

      const start = async () => {
        if (o.genre === "own" && !list(o.own).length){ toast(T("Type a few artists first.", "Trag erst ein paar Künstler ein.")); const i = $("#sgown"); if (i) i.focus(); return; }
        const names = PG.players().length ? PG.players() : [T("You", "Du")], pts = names.map(() => 0), log = [], total = names.length * o.rounds, up = o.clip === "up";
        ctx.start(); ctx.body.innerHTML = `<div class="pg-stage"><div class="sg-eq on">${"<i></i>".repeat(5)}</div><p class="muted">${T("Picking songs…", "Songs werden ausgesucht…")}</p></div>`;
        const P = o.genre === "pl" && myPl() ? PlPool.make(PG.shuffle(myPl().tracks.slice())) : Pool.make(o.genre === "pl" ? Object.assign({}, o, {genre: "mix"}) : o); await P.fill(6);
        /* every song of these artists was played already: start over */
        if (!P.songs.length && P.used.size && !P.fails){ P.used.clear(); PG.st[SEEN] = []; if (P.tried) P.tried.clear(); await P.fill(6); }
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
          const w = o.what, opts = o.answer === "pick" ? P.opts(s2, w, 4) : null; let done = false, stage = 0, heard = 0;
          const secs = () => up ? STAGES[stage] : +o.clip || 10;
          ctx.body.innerHTML = `<div class="sg-q"><div class="sg-top"><span class="muted">${names.length > 1 ? h(names[who]) + " · " : ""}${T("Song", "Song")} ${Math.floor(turn / names.length) + 1} / ${o.rounds}</span>${up ? "" : `<button class="btn ghost sm" id="sgagain" data-quiet>↻ ${T("From the start", "Von vorne")}</button>`}</div>
            <div class="sg-eq on">${"<i></i>".repeat(5)}</div><div class="sg-bar"><i id="sgbar"></i></div>${up ? `<div class="sg-stg" id="sgstg"></div>` : ""}
            ${s2.tier === "fan" ? `<p class="sg-fan">💎 ${T("For connoisseurs: +1 if you know it", "Kenner-Song: +1, wenn du ihn kennst")}</p>` : ""}
            <p class="pg-say" style="margin:0">${w === "both" ? T("Title and artist?", "Titel und Interpret?") : w === "artist" ? T("Who sings?", "Wer singt?") : T("Which song?", "Welcher Song?")}</p>
            ${opts ? `<div class="sg-opts">${opts.map((v, i) => `<button class="btn big" data-op="${i}">${h(v)}</button>`).join("")}</div>` : `<div id="sglib"></div>`}
            <div class="sg-act"><button class="btn sg-skip" id="sgno"><span>🤷</span>${T("No idea", "Weiß nicht")}</button><button class="btn sg-more" id="sgre"></button></div></div>`;
          const bar = $("#sgbar"), re = $("#sgre");
          const go = (from) => { const L = secs(); SA.now(s2.url, L, from || 0); heard = (from || 0) + L; bar.style.transition = "none"; bar.style.width = "0%"; void bar.offsetWidth; bar.style.transition = `width ${L}s linear`; bar.style.width = "100%";
            re.innerHTML = up ? (stage < STAGES.length - 1 ? `<span>▶</span>${T(`More: ${STAGES[stage + 1]} s`, `Mehr hören: ${STAGES[stage + 1]} s`)}` : `<span>↻</span>${T("Again", "Nochmal")}`) : heard < 29 ? `<span>▶</span>${T("Keep listening", "Weiter hören")}` : `<span>↻</span>${T("Again", "Nochmal")}`;
            const sg = $("#sgstg"); if (sg) sg.innerHTML = STAGES.map((L2, k) => `<span class="${k <= stage ? "on" : ""}">${L2} s</span>`).join("") + `<small>${T(`Right now: ${STP[stage]} points`, `Jetzt richtig: ${STP[stage]} Punkte`)}</small>`; };
          if (!opts) library($("#sglib"), w, ans => reveal(judge(w, ans, s2), w === "artist" ? ans.artist : w === "both" ? bare(ans.title) + " – " + ans.artist : bare(ans.title)));
          go(0); re.onclick = () => { Sound.tap(); if (up){ if (stage < STAGES.length - 1) stage++; go(0); } else if (heard < 29) go(heard); else go(0); };
          const ag = $("#sgagain"); if (ag) ag.onclick = () => { Sound.tap(); go(0); };
          const reveal = (got, said) => { if (done) return; done = true; const k = got.filter(Boolean).length, gain = (up ? Math.round(k / got.length * STP[stage]) : k) + (k && s2.tier === "fan" ? 1 : 0); pts[who] += gain; log.push({s: s2, who, got, gain});
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
     Game modes as ready-made packages (like a mode in League of Legends): Party, Pro, Longer and longer, Buzzer, Timeline, Music
     bingo, Whose song?, Year, or your own rules (which you can save). Before the first song everyone wishes for a genre (or their
     Spotify playlist); the songs then take turns between the wishes, and songs more of you know come first.
     Each song: every phone loads it and says "ready" (at most 4 s), a quick 3-2-1, then it plays on all phones at the same moment.
     "No idea" gives up; when everyone has answered or given up, the answer comes at once. "Keep listening": when everyone still
     guessing wants it, the song goes on (10 s more, or the next step of "longer and longer"). After the answer the song plays to
     its end, unless everyone taps "Next". Voice chat comes from the lobby bar (net.js). */
  if (PG.online){
    let OP = null; const now = () => Date.now();
    const PKG = {
      party: {e: "🎉", n: ["Party", "Party"], d: ["The whole song, pick one of four. Easy.", "Ganzer Song, einer von vier. Einfach."], o: {what: "title", ans: "pick", clip: "full", mode: "all", rounds: 10}},
      profi: {e: "🧠", n: ["Pro", "Profi"], d: ["Title and artist from the song library. 10 s, more on request.", "Titel und Interpret aus der Song-Bibliothek. 10 s, auf Wunsch mehr."], o: {what: "both", ans: "type", clip: 10, mode: "all", rounds: 10}},
      intro: {e: "⏱️", n: ["Longer and longer", "Immer länger"], d: ["1 second, then 2, 3, 5, 10. The earlier, the more points.", "1 Sekunde, dann 2, 3, 5, 10. Je früher, desto mehr Punkte."], o: {what: "title", ans: "mixed", clip: "up", mode: "all", rounds: 10}},
      blitz: {e: "⚡", n: ["Buzzer", "Blitzrunde"], d: ["Whoever is right first takes the point.", "Wer zuerst richtig liegt, holt den Punkt."], o: {what: "title", ans: "pick", clip: "full", mode: "fast", rounds: 15}},
      zeit: {e: "📅", n: ["Timeline", "Zeitstrahl"], d: ["Put every song into your timeline by its year. 8 cards win.", "Jeden Song nach Jahr in deinen Zeitstrahl legen. 8 Karten gewinnen."], o: {what: "time", ans: "pick", clip: "full", mode: "all", rounds: 25, fixed: 1}},
      bingo: {e: "🟩", n: ["Music bingo", "Musik-Bingo"], d: ["Hear the artist, mark them on your card. A row wins.", "Künstler raushören, auf der Karte markieren. Eine Reihe gewinnt."], o: {what: "bingo", ans: "pick", clip: "full", mode: "all", rounds: 30, fixed: 1}},
      wer: {e: "🕵️", n: ["Whose song?", "Wessen Song?"], d: ["Songs from your Spotify playlists. Whose is it?", "Songs aus euren Spotify-Playlists. Von wem ist er?"], o: {what: "whose", ans: "pick", clip: "full", mode: "all", rounds: 10}},
      jahr: {e: "🗓️", n: ["Year", "Jahr raten"], d: ["Guess the year. Spot on: 3 points.", "Jahr schätzen. Genau: 3 Punkte."], o: {what: "year", ans: "type", clip: "full", mode: "all", rounds: 10}},
      custom: {e: "🛠️", n: ["Your rules", "Eigene Regeln"], d: ["Set everything yourself and save it.", "Alles selbst einstellen und speichern."]}};
    const saved = () => Array.isArray(PG.st.songCustoms) ? PG.st.songCustoms : [];
    /* the rules a round is played with: the package, a saved one, or what is set by hand */
    const cfgOf = o => { const p = o.pkg || "party";
      if (/^c:/.test(p)){ const c = saved().find(x => "c:" + x.name === p); return Object.assign({}, o, c ? c.o : {}); }
      if (p === "custom" || !PKG[p]) return Object.assign({}, o);
      const P2 = PKG[p].o; return Object.assign({}, o, P2, {rounds: P2.fixed ? P2.rounds : +o.rounds || P2.rounds, genre: P2.what === "whose" ? "pl" : o.genre || "wish"}); };
    const live = Gm => typeof PNet !== "undefined" && PNet.P && PNet.P.G === Gm;
    const kindOf = (c, n) => ({year: "year", time: "time", bingo: "bingo", whose: "whose"})[c.what] || (c.ans === "mixed" ? (n % 2 ? "pick" : "type") : c.ans === "type" ? "type" : "pick");
    const players = Gm => Gm.ids.filter(x => !(Gm.s.out || {})[x]);
    const sfx = (Gm, n) => { Gm.sk = (Gm.sk || 0) + 1; Gm.s.snd = {k: "s" + Gm.sk, n}; };
    /* the 3-2-1; the pause between the parts of "longer and longer"; how late an answer may arrive and still count for the part
       before; a preview is 30 s; the timeline is won with 8 cards */
    const COUNT = 1700, GAP = 2500, LAT = 400, SEG = 30, GOAL = 8;
    const speedPts = ms => ms <= 2000 ? 3 : ms <= 4000 ? 2 : ms <= 7000 ? 1 : 0;
    const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    const GLAB = g => g === "pl" ? T("playlist", "Playlist") : G[g] ? G[g][0] + " " + T(G[g][2], G[g][1]) : "";

    /* songs from several wishes: they take turns; each wish keeps its own wrong answers (same genre, same language) */
    const Mix = {make(src){ const M = {src, i: 0, seen: new Set()}, pools = () => [...new Set(src.map(x => x.P))];
      M.songs = () => pools().flatMap(P => P.songs);
      M.fill = n => Promise.all(pools().map(P => P.fill(Math.max(3, Math.ceil(n / src.length) + 1))));
      M.next = () => { for (let k = 0; k < src.length; k++){ const x = src[(M.i + k) % src.length]; let s2 = null; while (!s2 && x.P.songs.length){ const c = x.P.next(); if (c && !M.seen.has(c.id)) s2 = c; }
          if (s2){ M.i = (M.i + k + 1) % src.length; M.seen.add(s2.id); s2.si = src.indexOf(x); return s2; } } return null; };
      M.opts = (s2, what, n) => (src[s2.si] || src[0]).P.opts(s2, what, n);
      return M; }};
    const tKey = tr => N(bare(tr[0])) + "|" + N(art1(tr[1])), aKey = tr => N(art1(tr[1]));
    function buildPools(Gm){ const s = Gm.s, c = s.cfg, W = s.wish || {}, ids = players(Gm);
      const pls = ids.filter(id => W[id] && W[id].g === "pl" && (W[id].tr || []).length >= 3);
      const own = {}, ac = {}; pls.forEach(id => { W[id].tr.forEach(tr => { const k = tKey(tr); (own[k] = own[k] || {tr, o: new Set()}).o.add(id); }); new Set(W[id].tr.map(aKey)).forEach(a => { ac[a] = (ac[a] || 0) + 1; }); });
      /* fair for everyone: songs more of you have first, then songs by artists more of you like */
      const fair = L => PG.shuffle(L.slice()).sort((x, y) => own[tKey(y)].o.size - own[tKey(x)].o.size || (ac[aKey(y)] || 0) - (ac[aKey(x)] || 0)).map(tr => ({t: tr[0], a: tr[1]}));
      if (c.what === "whose") return Mix.make([{P: PlPool.make(PG.shuffle(Object.values(own).filter(x => x.o.size === 1).map(x => ({t: x.tr[0], a: x.tr[1], o: [...x.o][0]}))))}]);
      if (c.what === "bingo"){
        if (!s.arts){ const lists = [];
          ids.forEach(id => { const w = W[id]; if (w && w.g === "pl" && pls.includes(id)){ const n = {}; w.tr.forEach(tr => { const a = art1(tr[1]); n[a] = (n[a] || 0) + 1; }); lists.push(Object.keys(n).sort((x, y) => n[y] - n[x]).slice(0, 15)); }
            else if (w && w.g === "own") lists.push(PG.shuffle(list(w.own)));
            else if (w && G[w.g] && G[w.g][3]) lists.push(PG.shuffle(list(G[w.g][3]))); });
          if (!lists.length && c.genre === "own" && list(c.own).length) lists.push(PG.shuffle(list(c.own)));
          if (!lists.length) lists.push(PG.shuffle(G[c.genre] && G[c.genre][3] ? list(G[c.genre][3]) : artistsOf({genre: "mix"})));
          const arts = []; for (let r = 0; arts.length < 12 && r < 40; r++) lists.forEach(L => { const a = L[r]; if (a && arts.length < 12 && !arts.some(x => N(x) === N(a))) arts.push(a); });
          PG.shuffle(list(G.charts[3])).forEach(a => { if (arts.length < 12 && !arts.some(x => N(x) === N(a))) arts.push(a); });
          s.arts = arts; }
        return Mix.make([{P: Pool.make({genre: "own", own: s.arts.join(";"), lvl: c.lvl})}]); }
      const src = [], byG = {};
      ids.forEach(id => { const w = W[id]; if (!w) return;
        if (w.g === "pl" && pls.includes(id)) src.push({P: PlPool.make(fair(W[id].tr)), who: [id], lab: "🎧 " + (w.nm || T("playlist", "Playlist"))});
        else if (w.g === "own" && list(w.own).length) src.push({P: Pool.make({genre: "own", own: w.own, lvl: c.lvl}), who: [id], lab: "✍️ " + list(w.own).slice(0, 3).join(", ")});
        else if (G[w.g] && w.g !== "own"){ if (!byG[w.g]) byG[w.g] = {P: Pool.make({genre: w.g, lvl: c.lvl}), who: [], lab: GLAB(w.g)}; byG[w.g].who.push(id); src.push(byG[w.g]); } });
      if (!src.length) src.push({P: c.genre === "own" && list(c.own).length ? Pool.make({genre: "own", own: c.own, lvl: c.lvl}) : Pool.make({genre: G[c.genre] && c.genre !== "own" ? c.genre : "mix", lvl: c.lvl})});
      return Mix.make(src); }
    const opool = Gm => { if (!OP || OP.gid !== Gm.gid){ OP = buildPools(Gm); OP.gid = Gm.gid; (Gm.s.used || []).forEach(id => OP.seen.add(id)); } return OP; };

    const MODE = [["all", ["Everyone answers", "Alle antworten"]], ["fast", ["Fastest takes it", "Wer zuerst richtig hat"]]];
    const WHAT = [["title", ["Title", "Titel"]], ["artist", ["Artist", "Interpret"]], ["both", ["Both", "Beides"]], ["year", ["Year", "Jahr"]], ["time", ["Timeline", "Zeitstrahl"]], ["bingo", ["Bingo", "Bingo"]], ["whose", ["Whose song?", "Wessen Song?"]]];
    const ANS = [["pick", ["Pick of 4", "4 zur Auswahl"]], ["pick6", ["Pick of 6", "6 zur Auswahl"]], ["type", ["Song library", "Song-Bibliothek"]], ["mixed", ["Mixed", "Gemischt"]]];
    const CLIP = [[5, "5 s"], [10, "10 s"], [20, "20 s"], ["full", ["Whole song", "Ganzer Song"]], ["up", ["Longer and longer 1→10 s", "Immer länger 1→10 s"]]];
    const isC = o => o.pkg === "custom";
    PG.online.song = {min: 2, max: 24, note: ["Every phone plays the song at the same moment: turn the sound up. Voice chat: the 🎙 at the top.", "Jedes Handy spielt den Song im selben Moment: Ton laut machen. Sprachchat: das 🎙 oben."],
      opts: [{k: "pkg", l: ["Game mode", "Spielmodus"], d: "party", cards: 1, c: () => Object.entries(PKG).map(([k, p]) => [k, p.n, p.d, p.e]).concat(saved().map(x => ["c:" + x.name, x.name, ["Saved by you", "Von dir gespeichert"], "⭐"]))},
        {k: "genre", l: ["Music", "Musik"], d: "wish", show: o => cfgOf(o).what !== "whose", c: () => [["wish", ["🎁 Everyone wishes", "🎁 Jeder wünscht sich was"]]].concat(Object.entries(G).map(([k, g]) => [k, [g[0] + " " + g[2], g[0] + " " + g[1]]]))},
        {k: "lvl", l: ["How well known", "Wie bekannt"], d: "main", cards: 1, show: o => cfgOf(o).what !== "whose", c: () => LVLS.map(([k, l, d]) => [k, l, d, ""])},
        {k: "what", l: ["Guess", "Raten"], d: "title", show: isC, c: WHAT},
        {k: "ans", l: ["Answers", "Antworten"], d: "pick", show: o => isC(o) && ["title", "artist", "both"].includes(o.what), c: ANS},
        {k: "clip", l: ["Clip", "Reinhören"], d: "full", show: isC, c: CLIP},
        {k: "mode", l: ["Points", "Punkte"], d: "all", show: o => isC(o) && ["title", "artist", "both"].includes(o.what), c: MODE},
        {k: "rounds", l: ["Number of songs", "Anzahl Songs"], d: 10, show: o => { const c = cfgOf(o); return !["time", "bingo"].includes(c.what) && !(PKG[o.pkg] && PKG[o.pkg].o && PKG[o.pkg].o.fixed); }, c: [[5, "5"], [10, "10"], [15, "15"], [20, "20"]]}],
      /* in the lobby, for everyone: your Spotify playlist; for the host with own rules: save them as a mode */
      lobbyHTML(m, isH){ const o = Object.assign({}, PNet.defaults("song"), m.opts || {});
        return (isH && o.genre === "own" && cfgOf(o).what !== "whose" ? `<div class="unit" id="sgown2" style="width:100%;text-align:left;margin:0"><h3>✍️ ${T("Your own artists", "Eigene Künstler")}</h3><form class="sg-plf" autocomplete="off"><input type="text" maxlength="200" value="${h(o.own || "")}" placeholder="${T("e.g. Michael Jackson, Queen", "z. B. Michael Jackson, Queen")}" enterkeyhint="done"><button class="btn go sm" type="submit">OK</button></form><p class="pg-sub sg-plm">${o.own ? h(list(o.own).join(" · ")) : T("Separated by commas.", "Mit Komma getrennt.")}</p></div>` : "")
          + `<div class="unit sg-plbox" id="sgpl" style="width:100%;text-align:left;margin:0"></div>` + (isH && (o.pkg === "custom" || /^c:/.test(o.pkg)) ? `<div class="unit" id="sgsv" style="width:100%;text-align:left;margin:0"></div>` : "") + Rank.box(10); },
      lobbyBind(body, m, isH){ const box = body.querySelector("#sgpl"); if (box) plBox(box); Rank.mount(body.querySelector(".sg-rkbox"), 10);
        const ow = body.querySelector("#sgown2"); if (ow) ow.querySelector("form").onsubmit = e => { e.preventDefault(); const v = ow.querySelector("input").value.trim().slice(0, 200); try { document.activeElement.blur(); } catch(x) {} PNet.setOpt("own", v); };
        const sv = body.querySelector("#sgsv"); if (!sv) return;
        const o = Object.assign({}, PNet.defaults("song"), m.opts || {}), keep = ["what", "ans", "clip", "mode", "rounds", "genre", "lvl", "own"];
        if (o.pkg === "custom"){ sv.innerHTML = `<h3>💾 ${T("Save as a game mode", "Als Spielmodus speichern")}</h3><p class="pg-sub" style="margin:4px 0 0">${T("Next time it's one tap.", "Nächstes Mal ist es ein Tipp.")}</p><form class="sg-plf" autocomplete="off"><input type="text" maxlength="24" placeholder="${T("Name, e.g. Friday night", "Name, z. B. Freitagabend")}" enterkeyhint="done"><button class="btn go sm" type="submit">${T("Save", "Speichern")}</button></form>`;
          sv.querySelector("form").onsubmit = e => { e.preventDefault(); const name = sv.querySelector("input").value.trim().slice(0, 24); if (!name) return;
            PG.st.songCustoms = [{name, o: Object.fromEntries(keep.map(k => [k, o[k]]))}].concat(saved().filter(x => x.name !== name)).slice(0, 8); PG.persist(); toast(T("Saved", "Gespeichert") + " ⭐"); PNet.setOpt("pkg", "c:" + name); }; }
        else { const c = saved().find(x => "c:" + x.name === o.pkg); if (!c){ sv.remove(); return; }
          sv.innerHTML = `<h3>⭐ ${h(c.name)}</h3><p class="pg-sub" style="margin:4px 0 0">${h([WHAT, ANS, CLIP, MODE].map((L, i) => { const v = c.o[["what", "ans", "clip", "mode"][i]], x = L.find(y => String(y[0]) === String(v)); return x ? (Array.isArray(x[1]) ? T(x[1][0], x[1][1]) : x[1]) : ""; }).filter(Boolean).join(" · ") + " · " + c.o.rounds + " Songs")}</p>
            <div class="row" style="margin-top:8px;gap:8px"><button class="btn sm" data-sged>✏️ ${T("Change", "Ändern")}</button><button class="btn ghost sm" data-sgdel>🗑 ${T("Delete", "Löschen")}</button></div>`;
          sv.querySelector("[data-sged]").onclick = () => { keep.forEach(k => { if (c.o[k] != null) PNet.setOpt(k, c.o[k]); }); PNet.setOpt("pkg", "custom"); };
          sv.querySelector("[data-sgdel]").onclick = () => { PG.st.songCustoms = saved().filter(x => x !== c); PG.persist(); PNet.setOpt("pkg", "custom"); }; } },
      start(Gm, api){ Gm.gid = Math.random().toString(36).slice(2); const c = cfgOf(Gm.opts);
        Gm.s = {n: 0, pts: {}, phase: "load", log: [], used: (Gm.s && Gm.s.used) || [], out: {}, cfg: c, wish: {}};
        if (c.genre === "wish" || c.genre === "pl" || c.what === "whose"){ Gm.s.phase = "wish"; Gm.s.until = now() + 35000; } else this.ready(Gm, api); },
      /* the wishes are in: the song lists are put together */
      ready(Gm, api){ const s = Gm.s; let c = s.cfg; s.phase = "load"; s.until = 0;
        if (c.what === "whose"){ const own = players(Gm).filter(x => s.wish[x] && s.wish[x].g === "pl" && (s.wish[x].tr || []).length >= 3);
          if (own.length < 2){ s.note = "nopl"; s.cfg = c = Object.assign({}, c, {what: "title", ans: "pick"}); } else s.owners = own; }
        OP = null; opool(Gm);
        if (c.what === "bingo"){ s.card = {}; players(Gm).forEach(id => { s.card[id] = PG.shuffle(s.arts.slice()).slice(0, 9).map(a => ({a, m: 0})); }); }
        this.next(Gm, api); },
      over(Gm){ const s = Gm.s, c = s.cfg; return s.n >= +c.rounds || (c.what === "time" && !!s.tl && Object.values(s.tl).some(L => L.length >= GOAL)) || (c.what === "bingo" && !!(s.bwin && s.bwin.length)); },
      wait(Gm, api, n){ const s = Gm.s, M = opool(Gm); s.phase = "load"; if (s.loading) return; s.loading = 1;
        M.fill(n).then(() => { s.loading = 0; if (!live(Gm) || Gm.s !== s || s.phase !== "load") return; if (M.songs().length) this.next(Gm, api); else s.phase = "fail"; api.push(); }); },
      next(Gm, api){ const s = Gm.s, c = s.cfg; if (this.over(Gm)){ s.phase = "end"; s.until = 0; sfx(Gm, "cheer"); return; }
        const M = opool(Gm), dated = () => M.songs().filter(x => +x.year).length;
        /* the timeline: everyone starts with one card */
        if (c.what === "time" && !s.tl){ const need = players(Gm).length; if (dated() < need + 1) return this.wait(Gm, api, need + 3);
          s.tl = {}; players(Gm).forEach(id => { let x = M.next(); while (x && !+x.year) x = M.next(); s.tl[id] = [x ? {y: +x.year, t: bare(x.title), a: x.artist} : {y: 1985 + Math.floor(Math.random() * 35), t: "", a: ""}]; }); }
        let song = M.songs().length ? M.next() : null; if (c.what === "time" || c.what === "year") while (song && !+song.year) song = M.next();
        if (!song) return this.wait(Gm, api, 6);
        s.n++; s.used.push(song.id); s.cur = {id: song.id, title: song.title, artist: song.artist, url: song.url, art: song.art, year: song.year, own: song.own || null, tier: song.tier || "hit", g: song.g || ""};
        const src = M.src[song.si]; s.cur.wl = c.genre === "wish" && src && src.who && src.who.length ? src.who.map(x => api.name(x)).join(" & ") + " · " + src.lab : "";
        s.kind = kindOf(c, s.n); s.ans = {}; s.more = {}; s.rdy = {}; s.win = null; s.first = null; s.opts = null; s.ready = {}; s.st = null; s.sv = 0;
        if (s.kind === "pick"){ s.opts = M.opts(song, c.what, c.ans === "pick6" ? 6 : 4); if (!s.opts) s.kind = "type"; }
        if (s.kind === "whose") s.opts = PG.shuffle(s.owners.slice());
        /* every phone loads the clip first; after 4 s it starts anyway */
        s.phase = "prep"; s.until = now() + 4000; },
      plan(Gm){ const c = Gm.s.cfg, t0 = now() + COUNT;
        if (c.clip === "up"){ const st = []; let t = t0; STAGES.forEach(L => { st.push({at: t, len: L, from: 0}); t += L * 1000 + GAP; }); return st; }
        return [{at: t0, len: c.clip === "full" ? SEG : Math.min(SEG, +c.clip || 10), from: 0}]; },
      dead(Gm){ const s = Gm.s, l = s.st[s.st.length - 1]; s.until = l.at + l.len * 1000 + (["type", "year"].includes(s.kind) ? 20000 : 12000); },
      go(Gm){ const s = Gm.s; s.phase = "play"; s.st = this.plan(Gm); s.t0 = s.st[0].at; s.sv = 1; this.dead(Gm);
        if (s.kind === "whose" && s.cur.own) s.ans[s.cur.own] = {raw: "", ms: 0, ok: [], own: 1}; sfx(Gm, "go"); },
      stageNow(Gm){ const s = Gm.s, t = now(); let i = 0; (s.st || []).forEach((x, k) => { if (t >= x.at) i = k; }); return i; },
      stageOf(s, t){ let i = 0; (s.st || []).forEach((x, k) => { if (t >= x.at + (k ? LAT : 0)) i = k; }); return i; },
      canMore(Gm){ const s = Gm.s, c = s.cfg; if (s.phase !== "play") return false; if (c.clip === "up") return this.stageNow(Gm) < STAGES.length - 1; if (c.clip === "full") return false; const l = s.st[s.st.length - 1]; return l.from + l.len < SEG - 1; },
      /* everyone still guessing wants more: the next part of "longer and longer" now, or 10 s more from where it stopped */
      extend(Gm){ const s = Gm.s, c = s.cfg, t = now(); s.more = {};
        if (c.clip === "up"){ const i = this.stageNow(Gm) + 1; let at = t + 500; s.st = s.st.slice(0, i).concat(STAGES.slice(i).map(L => { const x = {at, len: L, from: 0}; at += L * 1000 + GAP; return x; })); }
        else { const l = s.st[s.st.length - 1], from = l.from + l.len; s.st = s.st.concat([{at: Math.max(t + 500, l.at + l.len * 1000 + 100), len: Math.min(10, SEG - from), from}]); }
        s.sv++; this.dead(Gm); sfx(Gm, "more"); },
      act(Gm, id, a, api){ const s = Gm.s, c = s.cfg || cfgOf(Gm.opts), w = c.what;
        if (a.a === "again" && id === Gm.host && s.phase === "end"){ const keep = {used: s.used.slice(-600), wish: s.wish, arts: null}; this.start(Gm, api); Gm.s.used = keep.used;
          /* the same wishes again: no second round of asking */
          if (Gm.s.phase === "wish" && Object.keys(keep.wish || {}).length){ Gm.s.wish = keep.wish; this.ready(Gm, api); } return; }
        if (a.a === "wish" && s.phase === "wish" && players(Gm).includes(id)){ const g = String(a.g || ""), own = String(a.own || "").slice(0, 200); if (!(g === "any" || g === "pl" || (G[g] && g !== "own") || (g === "own" && list(own).length))) return;
          const tr = g === "pl" && Array.isArray(a.tr) ? a.tr.slice(0, 150).map(x => [String((x || [])[0] || "").slice(0, 120), String((x || [])[1] || "").slice(0, 120)]).filter(x => x[0] && x[1]) : null;
          s.wish[id] = {g: g === "pl" && !(tr && tr.length) ? "any" : g, tr, nm: String(a.nm || "").slice(0, 60), own: g === "own" ? own : ""}; if (players(Gm).every(x => s.wish[x])) this.ready(Gm, api); return; }
        if (a.a === "wishgo" && id === Gm.host && s.phase === "wish"){ this.ready(Gm, api); return; }
        if (a.a === "next" && id === Gm.host && s.phase === "rev"){ this.next(Gm, api); return; }
        if (a.a === "nx" && s.phase === "rev"){ s.rdy[id] = 1; if (players(Gm).every(x => s.rdy[x])) this.next(Gm, api); return; }
        if (a.a === "ready"){ if (s.phase === "prep" && a.k === "p" + s.n){ s.ready[id] = 1; if (players(Gm).every(x => s.ready[x])) this.go(Gm); } return; }
        /* the clip doesn't load (a dead link): it doesn't count, the next song comes instead */
        if (a.a === "bad"){ if (s.phase === "prep" && a.k === "p" + s.n){ s.n--; s.used.pop(); this.next(Gm, api); } return; }
        /* no songs came: the host tries again (the server, then the mix) */
        if (a.a === "retry" && id === Gm.host && s.phase === "fail"){ s.loading = 0; this.wait(Gm, api, 6); return; }
        if (a.a === "more"){ if (s.phase !== "play" || s.ans[id] || !players(Gm).includes(id) || !this.canMore(Gm)) return; s.more[id] = 1; if (players(Gm).filter(x => !s.ans[x]).every(x => s.more[x])) this.extend(Gm); return; }
        if (s.phase !== "play" || s.ans[id] || !players(Gm).includes(id) || now() < s.t0 - 300 || (c.mode === "fast" && s.win)) return;
        const cur = s.cur, t = now(), hostMs = Math.max(0, t - s.t0), cms = +a.ms, ms = isFinite(cms) && cms >= 0 && cms <= hostMs + 400 ? Math.round(cms) : hostMs, stage = this.stageOf(s, t); let ok, raw = "";
        if (a.a === "skip"){ s.ans[id] = {raw: "", ms, ok: w === "both" && s.kind !== "year" ? [false, false] : [false], d: 99, stage, sk: 1}; return this.check(Gm); }
        if (a.a === "pick" && s.kind === "pick" && s.opts){ const v = s.opts[+a.v]; if (v == null) return; raw = v; const r = N(v) === N(valOf(w, cur)); ok = w === "both" ? [r, r] : [r]; }
        else if (a.a === "type" && s.kind === "type"){ const f = a.f || {}, ans = {title: String(f.t || "").slice(0, 90), artist: String(f.r || "").slice(0, 60), picked: !!f.p};
          raw = w === "artist" ? ans.artist : w === "both" ? bare(ans.title) + " – " + ans.artist : bare(ans.title); ok = judge(w, ans, cur); }
        else if (a.a === "year" && s.kind === "year"){ const y = parseInt(String((a.f || {}).y || "").replace(/\D/g, "").slice(0, 4), 10), d = isNaN(y) ? 99 : Math.abs(y - (+cur.year || 0)); raw = isNaN(y) ? "" : String(y); s.ans[id] = {raw, ms, ok: [d <= 5], d, stage}; return this.check(Gm); }
        else if (a.a === "slot" && s.kind === "time"){ const L = (s.tl || {})[id] || [], i = Math.max(0, Math.min(L.length, +a.v | 0)), y = +cur.year, lo = i ? L[i - 1].y : -1e9, hi = i < L.length ? L[i].y : 1e9;
          raw = !L.length ? "" : i === 0 ? T(`before ${L[0].y}`, `vor ${L[0].y}`) : i === L.length ? T(`after ${L[L.length - 1].y}`, `nach ${L[L.length - 1].y}`) : `${L[i - 1].y} – ${L[i].y}`; s.ans[id] = {raw, ms, ok: [y >= lo && y <= hi], i, stage}; return this.check(Gm); }
        else if (a.a === "mark" && s.kind === "bingo"){ const cell = ((s.card || {})[id] || [])[+a.v]; if (!cell || cell.m) return; s.ans[id] = {raw: cell.a, ms, ok: [artistOk(cell.a, cur.artist)], i: +a.v, stage}; return this.check(Gm); }
        else if (a.a === "who" && s.kind === "whose" && id !== cur.own){ const v = (s.opts || [])[+a.v]; if (!v) return; s.ans[id] = {raw: api.name(v), ms, ok: [v === cur.own], stage}; return this.check(Gm); }
        else return;
        s.ans[id] = {raw, ms, ok, stage}; if (c.mode === "fast" && ok.every(Boolean)) s.win = id; this.check(Gm); },
      check(Gm){ const s = Gm.s; if (s.phase === "play" && (s.win || players(Gm).every(x => s.ans[x]))) this.reveal(Gm); },
      reveal(Gm){ const s = Gm.s, c = s.cfg, w = c.what, up = c.clip === "up", gain = {}; s.phase = "rev"; s.rdy = {};
        const sp = x => STP[Math.min(STP.length - 1, (s.ans[x] || {}).stage || 0)], A = x => s.ans[x];
        if (s.kind === "year") Gm.ids.forEach(x => { const a = A(x); gain[x] = !a || a.d > 5 ? 0 : a.d === 0 ? 3 : a.d <= 2 ? 2 : 1; });
        else if (s.kind === "time") Gm.ids.forEach(x => { const a = A(x); gain[x] = 0; if (a && a.ok[0] && s.tl[x]){ s.tl[x].splice(a.i, 0, {y: +s.cur.year, t: bare(s.cur.title), a: s.cur.artist, nw: s.n}); gain[x] = 1; } });
        else if (s.kind === "bingo"){ Gm.ids.forEach(x => { const a = A(x); gain[x] = 0; if (!a || a.i == null) return; if (a.ok[0]){ s.card[x][a.i].m = 1; gain[x] = 1; } else if ((s.pts[x] || 0) > 0) gain[x] = -1; });
          s.bwin = Gm.ids.filter(x => s.card[x] && s.card[x].length >= 9 && LINES.some(L => L.every(i => s.card[x][i].m))); s.bwin.forEach(x => { gain[x] += 5; }); }
        else if (s.kind === "whose"){ let wrong = 0; Gm.ids.forEach(x => { if (x === s.cur.own) return; const a = A(x); gain[x] = a && a.ok[0] ? 2 : 0; if (a && !a.sk && !a.ok[0]) wrong++; }); gain[s.cur.own] = wrong; }
        else if (c.mode === "fast") Gm.ids.forEach(x => { gain[x] = x === s.win ? (up ? sp(x) : 3) : 0; });
        else { const full = Gm.ids.filter(x => A(x) && A(x).ok.length && A(x).ok.every(Boolean)).sort((a, b) => A(a).ms - A(b).ms);
          Gm.ids.forEach(x => { const a = A(x); if (!a){ gain[x] = 0; return; } const k = a.ok.filter(Boolean).length; gain[x] = up ? Math.round(k / a.ok.length * sp(x)) : k * (w === "both" ? 1 : 2);
            /* tempo points (Maxi: speed must pay off): right within 2 s +3, 4 s +2, 7 s +1 */
            if (!up && a.ok.every(Boolean)){ a.sb = speedPts(a.ms); gain[x] += a.sb; } });
          if (full.length){ s.first = full[0]; gain[full[0]] += 1; } }
        /* how fast: each right answer's time, and for the fastest how much faster than the others' average */
        { const R = Gm.ids.filter(x => A(x) && !A(x).sk && !A(x).own && A(x).ok.length && A(x).ok.every(Boolean) && ["pick", "type", "whose", "bingo", "time"].includes(s.kind)).sort((a, b) => A(a).ms - A(b).ms);
          s.fx = null; if (R.length >= 2){ const o = R.slice(1).map(x => A(x).ms), avg = o.reduce((p, q) => p + q, 0) / o.length; const pc = avg > 0 ? Math.round((avg - A(R[0]).ms) / avg * 100) : 0; if (pc >= 1) s.fx = {id: R[0], pc}; } }
        /* the song's history for each player (the ranking and the titles at the end) */
        s.hist = s.hist || {}; Gm.ids.forEach(x => { const a = A(x); if (!a || a.own || !["pick", "type"].includes(s.kind)) return; (s.hist[x] = s.hist[x] || []).push({g: s.cur.g || "mix", ok: a.ok.length && a.ok.every(Boolean) ? 1 : 0, ms: a.sk ? null : a.ms}); });
        /* a song only fans know: +1 for everyone who got it */
        if (s.cur.tier === "fan" && ["pick", "type"].includes(s.kind)) Gm.ids.forEach(x => { if (gain[x] > 0) gain[x] += 1; });
        Gm.ids.forEach(x => { gain[x] = gain[x] || 0; s.pts[x] = (s.pts[x] || 0) + gain[x]; }); s.gain = gain;
        /* after the answer the song plays on to its end (unless everyone taps "Next" or the host goes on) */
        s.until = now() + (s.kind === "bingo" ? 7000 : Math.max(9000, Math.min(25000, SEG * 1000 - (now() - s.t0) + 1500)));
        s.log.push({s: {title: s.cur.title, artist: s.cur.artist, year: s.cur.year, art: s.cur.art}, best: Object.keys(gain).filter(x => gain[x] > 0 && gain[x] === Math.max(...Object.values(gain)))});
        sfx(Gm, s.bwin && s.bwin.length ? "cheer" : Object.values(gain).some(v => v > 0) ? "xp" : "wrong"); },
      tick(Gm, api){ const s = Gm.s;
        if (s.phase === "wish" && now() >= s.until){ this.ready(Gm, api); return true; }
        if (s.phase === "prep" && now() >= s.until){ this.go(Gm); return true; }
        if (s.phase === "play" && now() >= s.until){ this.reveal(Gm); return true; }
        if (s.phase === "rev" && now() >= s.until){ this.next(Gm, api); return true; } },
      gone(Gm, id, api){ const s = Gm.s; s.out = s.out || {}; s.out[id] = 1;
        if (s.phase === "wish" && players(Gm).every(x => s.wish[x])) this.ready(Gm, api || {name: x => x, push(){}});
        if (s.phase === "prep" && players(Gm).every(x => s.ready[x])) this.go(Gm); this.check(Gm); },
      view(Gm, id, api){ const s = Gm.s, c = s.cfg || cfgOf(Gm.opts), base = {custom: "song", host: id === Gm.host, snd: s.snd || null};
        if (s.phase === "wish") return Object.assign(base, {k: "wish", ph: "wish", mine: s.wish[id] ? s.wish[id].g : null, got: players(Gm).filter(x => s.wish[x]).length, all: players(Gm).length, whose: c.what === "whose", left: s.until - now(), pkg: c.pkg});
        if (s.phase === "load") return Object.assign(base, {k: "load" + s.n, ph: "load"});
        if (s.phase === "fail") return Object.assign(base, {k: "fail", ph: "fail"});
        if (s.phase === "prep") return Object.assign(base, {k: "p" + s.n, ph: "prep", n: s.n, of: +c.rounds, url: s.cur.url, note: s.n === 1 ? s.note || "" : "", kind: s.kind, wl: s.cur.wl});
        const best = x => { const L = ((s.hist || {})[x] || []).filter(q => q.ok && q.ms != null).map(q => q.ms); return L.length ? Math.min(...L) : null; };
        const tot = Gm.ids.map(x => ({n: api.name(x), p: s.pts[x] || 0, me: x === id, c: s.tl && s.tl[x] ? s.tl[x].length : null, b: best(x)})).sort((a, b) => b.p - a.p), up = c.clip === "up";
        if (s.phase === "play"){ const me = s.ans[id], t = now(), still = players(Gm).filter(x => !s.ans[x]);
          return Object.assign(base, {k: "q" + s.n, ph: "play", n: s.n, of: +c.rounds, url: s.cur.url, fan: s.cur.tier === "fan" && ["pick", "type"].includes(s.kind), st: s.st.map(x => ({in: x.at - t, len: x.len, from: x.from})), sv: s.sv, left: s.until - t, kind: s.kind, what: c.what, fast: c.mode === "fast", up, wl: s.cur.wl,
            opts: s.kind === "whose" ? (s.opts || []).map(x => api.name(x)) : s.opts, own: s.kind === "whose" && s.cur.own === id, tl: s.kind === "time" ? (s.tl || {})[id] || [] : null, card: s.kind === "bingo" ? (s.card || {})[id] || [] : null, goal: GOAL,
            done: !!me, wrong: !!(me && c.mode === "fast" && !me.sk && !me.ok.every(Boolean)), got: players(Gm).filter(x => s.ans[x]).length, all: players(Gm).length,
            more: {can: this.canMore(Gm) && !me, n: still.filter(x => s.more[x]).length, need: still.length, mine: !!s.more[id]}}); }
        if (s.phase === "rev") return Object.assign(base, {k: "r" + s.n, ph: "rev", n: s.n, of: +c.rounds, last: this.over(Gm), title: s.cur.title, artist: s.cur.artist, year: s.cur.year, art: s.cur.art, url: s.cur.url, kind: s.kind, what: c.what, left: s.until - now(), mine: s.gain[id] || 0,
          own: s.kind === "whose" ? api.name(s.cur.own) : "", tl: s.kind === "time" ? (s.tl || {})[id] || [] : null, nw: s.n, card: s.kind === "bingo" ? (s.card || {})[id] || [] : null, bwin: (s.bwin || []).map(x => api.name(x)), goal: GOAL,
          rdy: {n: players(Gm).filter(x => s.rdy[x]).length, all: players(Gm).length, mine: !!s.rdy[id]},
          rows: Gm.ids.map(x => { const a = s.ans[x] || {}; return {n: api.name(x), me: x === id, a: a.raw || "", ok: s.ans[x] && !a.own ? a.ok : null, own: !!a.own, g: s.gain[x] || 0, top: s.first === x || s.win === x, sec: up && s.ans[x] && a.ok.some(Boolean) ? STAGES[a.stage || 0] : null,
            ms: s.ans[x] && !a.sk && !a.own && a.ms != null ? a.ms : null, sb: a.sb || 0, pc: s.fx && s.fx.id === x ? s.fx.pc : 0}; }).sort((a, b) => b.g - a.g || (a.ms == null) - (b.ms == null) || (a.ms || 0) - (b.ms || 0)), tot});
        const H = (s.hist || {})[id] || [], G2 = {}; H.forEach(x => { const k = x.g || "mix"; G2[k] = G2[k] || [0, 0]; G2[k][0] += x.ok; G2[k][1]++; });
        const my = {heard: H.length, right: H.filter(x => x.ok).length, ms: H.filter(x => x.ok && x.ms != null).map(x => x.ms).slice(0, 60), g: G2, pts: s.pts[id] || 0, won: tot.length > 1 && tot[0].me && tot[0].p > tot[1].p ? 1 : 0};
        return Object.assign(base, {k: "end", ph: "end", gid: Gm.gid, my, tot, kind: s.kind, what: c.what, bwin: (s.bwin || []).map(x => api.name(x)), log: s.log.map(l => ({t: l.s.title, a: l.s.artist, art: l.s.art, w: l.best.map(x => api.name(x)).join(", ")}))}); }
    };

    /* ---- what each phone shows (built here from plain text and Apple's picture links only) ---- */
    const V = {k: null, sv: 0, tk: 0, end: 0, st: [], sent: null, snd: null, rdy: null, wish: null, rep: {}};
    const SND = {go: () => Sound.play("Capture", .5), more: () => Sound.tap(), xp: () => (Sound.xp ? Sound.xp() : Sound.right()), wrong: () => Sound.wrong(), cheer: () => PG.cheer(3)};
    const md = x => h(x), parts = st => (st || []).map(x => ({at: Date.now() + x.in, len: x.len, from: x.from || 0}));
    const LOCK = "[data-op], [data-skip], [data-sl], [data-bc], [data-more], .sg-form input, .sg-form button, .sg-lib input, .sg-sug";
    const rows = (v, mk) => `<div class="unit" style="width:100%;text-align:left;margin:0"><div class="list">${v.rows.map(r => `<div class="li" style="${r.me ? "box-shadow:inset 0 0 0 1.5px var(--go)" : ""}"><span style="width:${v.what === "both" && v.kind !== "year" ? 44 : 22}px">${r.own ? "🎧" : mk(r.ok)}</span><div class="grow"><div class="t">${md(r.n)}${r.top ? " ⚡" : ""}${r.sec ? ` <small class="muted">${T("after", "nach")} ${r.sec} s</small>` : ""}</div><div class="s">${r.own ? T("their song", "sein Song") : md(r.a || "–")}</div>${r.pc ? `<div class="sg-fx">⚡ ${T(`${r.pc} % faster than the others`, `${r.pc} % schneller als die anderen`)}</div>` : ""}</div>${r.ms != null ? `<span class="sg-ms ${r.ok && r.ok.every(Boolean) ? "ok" : ""}">${secs(r.ms)}${r.sb ? `<small>+${r.sb} ⚡</small>` : ""}</span>` : ""}<b style="font:900 18px var(--display);min-width:34px;text-align:right">${r.g > 0 ? "+" + r.g : r.g < 0 ? r.g : "0"}</b></div>`).join("")}</div></div>`;
    const myCard = my => { const L = my.ms || [], avg = L.length ? L.reduce((p, q) => p + q, 0) / L.length : 0;
      return `<div class="unit sg-my" style="width:100%;margin:0"><div><b>${my.right}/${my.heard}</b><small>${T("right", "richtig")}</small></div><div><b>${L.length ? secs(Math.min(...L)) : "–"}</b><small>${T("fastest", "schnellster Treffer")}</small></div><div><b>${L.length ? secs(avg) : "–"}</b><small>${T("on average", "im Schnitt")}</small></div></div>`; };
    const total = v => `<div class="unit" style="width:100%;text-align:left;margin:0"><h3>${T("Total", "Gesamt")}</h3><div class="list">${v.tot.map((r, i) => `<div class="li"><span class="pg-rank">${i + 1}</span><div class="grow t">${md(r.n)}${r.me ? " (" + T("you", "du") + ")" : ""}${r.b != null ? ` <small class="muted">⚡ ${secs(r.b)}</small>` : ""}</div><b style="font:900 18px var(--display)">${r.c != null ? r.c + " 🃏" : r.p}</b></div>`).join("")}</div></div>`;
    const tlHTML = (L, slots, nw) => `<div class="sg-tl">${L.map((x, i) => (slots ? `<button class="sg-slot" data-sl="${i}">＋ ${i === 0 ? T(`before ${x.y}`, `vor ${x.y}`) : T(`between ${L[i - 1].y} and ${x.y}`, `zwischen ${L[i - 1].y} und ${x.y}`)}</button>` : "")
      + `<div class="sg-card ${nw && x.nw === nw ? "nw" : ""}"><b>${x.y}</b><span>${md(x.t || "")}${x.a ? `<small>${md(x.a)}</small>` : ""}</span></div>`).join("") + (slots && L.length ? `<button class="sg-slot" data-sl="${L.length}">＋ ${T(`after ${L[L.length - 1].y}`, `nach ${L[L.length - 1].y}`)}</button>` : "")}</div>`;
    const bingoHTML = (card, live2) => `<div class="sg-bingo">${card.map((x, i) => `<button class="sg-bc ${x.m ? "m" : ""}" ${live2 && !x.m ? `data-bc="${i}"` : "disabled"}><span>${md(x.a)}</span>${x.m ? "<i>✓</i>" : ""}</button>`).join("")}</div>`;
    PG.custom.song = {
      stop(){ SA.stop(); Sing.stop(); clearInterval(V.tk); V.k = null; },
      draw(body, v, m, act){ Sing.start();
        if (v.snd && v.snd.k !== V.snd){ V.snd = v.snd.k; try { (SND[v.snd.n] || (() => {}))(); } catch(e) {} }
        const fresh = V.k !== v.k || !body.querySelector(".sg-on"), need = () => { const b = body.querySelector('[data-x="hear"]'); if (b) b.hidden = false; };
        /* times: taken once per question from what the host said; a new plan (more listening) replaces them */
        if (V.k !== v.k){ V.k = v.k; V.sent = null; V.sv = v.sv || 0; if (v.st) V.st = parts(v.st); if (v.left != null) V.end = Date.now() + v.left; }
        else { if (v.st && v.sv && v.sv !== V.sv){ V.sv = v.sv; V.st = parts(v.st); SA.replan(v.k, v.url, V.st, need); } if (v.left != null && Math.abs(Date.now() + v.left - V.end) > 1500) V.end = Date.now() + v.left; }
        const hostBar = v.host ? `<button class="btn ghost sm" data-x="lobby" style="margin-top:12px;opacity:.75">${T("End round · back to the lobby", "Runde beenden · zurück zur Lobby")}</button>` : "";
        if (v.ph === "wish"){
          /* before the first song: everyone wishes for a genre or their playlist */
          const tiles = () => { const pl = myPl(), L = v.whose ? [] : Object.entries(G).filter(([k]) => k !== "own").map(([k, g]) => [k, g[0], T(g[2], g[1])]);
            return (pl ? [["pl", "🎧", T("My playlist", "Meine Playlist") + ` <small>${md(pl.name || "")}</small>`]] : []).concat(L).concat(v.whose ? [] : [["own", "✍️", T("Artists of my own", "Eigene Künstler") + (V.own ? ` <small>${md(V.own)}</small>` : "")]]).concat([["any", v.whose ? "🙈" : "🎲", v.whose ? T("I only guess", "Ich rate nur mit") : T("Don't mind", "Egal")]])
              .map(([k, e, l]) => `<button class="btn sg-wt ${V.wish === k || (!V.wish && v.mine === k) ? "go" : ""}" data-wg="${k}"><span style="font-size:20px">${e}</span><span style="text-align:left">${l}</span></button>`).join(""); };
          const send = g => { const pl = myPl(); V.wish = g; act(Object.assign({a: "wish", g}, g === "pl" && pl ? {tr: pl.tracks.slice(0, 150).map(x => [x.t, x.a]), nm: pl.name || ""} : {}, g === "own" ? {own: V.own} : {})); PG.vib(12); };
          /* own artists: a field opens (e.g. only Michael Jackson, with "Groupie" for his deep cuts) */
          const ownForm = () => { const f = body.querySelector("[data-wown]"); f.hidden = false; const i = f.querySelector("input"); i.value = V.own || PG.st.songOwn || ""; try { i.focus(); } catch(e) {}
            f.onsubmit = e => { e.preventDefault(); const val = i.value.trim().slice(0, 200); if (!list(val).length) return; V.own = val; PG.st.songOwn = val; PG.persist(); try { i.blur(); } catch(x) {} f.hidden = true; send("own"); body.querySelector(".sg-wg").innerHTML = tiles(); bind(); }; };
          const bind = () => body.querySelectorAll("[data-wg]").forEach(b => b.onclick = () => { if (b.dataset.wg === "own") return ownForm(); send(b.dataset.wg); body.querySelector(".sg-wg").innerHTML = tiles(); bind(); });
          if (fresh){ V.wish = null; V.own = "";
            body.innerHTML = `<div class="pg-stage sg-on sg-wish"><div class="pg-who">${v.whose ? "🕵️ " + T("Whose song?", "Wessen Song?") : "🎁 " + T("Your music wish", "Dein Musikwunsch")}</div>
              <p class="pg-say" style="margin:0">${v.whose ? T("Share your Spotify playlist: the songs come from your playlists, everyone guesses whose they are.", "Teil deine Spotify-Playlist: Die Songs kommen aus euren Playlists, alle raten, von wem sie sind.") : T("What do you know best? Everyone wishes for something, the songs take turns between all wishes.", "Was kannst du am besten? Jeder wünscht sich etwas, die Songs kommen abwechselnd aus allen Wünschen.")}</p>
              <div class="grid2 sg-wg">${tiles()}</div><form class="sg-plf" data-wown hidden autocomplete="off"><input type="text" maxlength="200" placeholder="${T("e.g. Michael Jackson, Queen", "z. B. Michael Jackson, Queen")}" enterkeyhint="done"><button class="btn go sm" type="submit">OK</button></form><div class="unit sg-plbox" data-plb style="width:100%;text-align:left;margin:0"></div>
              <p class="pg-hint" data-st></p>${v.host ? `<button class="btn ghost sm" data-x="wishgo">${T("Start without the others", "Ohne die anderen starten")}</button>` : ""}${hostBar}</div>`;
            bind(); plBox(body.querySelector("[data-plb]"), () => { body.querySelector(".sg-wg").innerHTML = tiles(); bind(); if (myPl() && (v.whose || !V.wish)) { send("pl"); body.querySelector(".sg-wg").innerHTML = tiles(); bind(); } });
            if (v.whose && myPl() && !v.mine) send("pl"); }
          const st = body.querySelector("[data-st]"); if (st) st.textContent = T(`${v.got} of ${v.all} have chosen`, `${v.got} von ${v.all} haben gewählt`) + (v.left > 0 ? ` · ${Math.ceil(v.left / 1000)} s` : ""); }
        else if (v.ph === "load" || v.ph === "fail" || v.ph === "prep"){
          /* load the next clip now and tell the host when it can play */
          if (v.ph === "prep" && V.rdy !== v.k){ V.rdy = v.k; SA.prep(v.url, () => act({a: "ready", k: v.k}), () => act({a: "bad", k: v.k})); }
          if (fresh){ if (v.ph !== "prep") SA.stop();
            body.innerHTML = `<div class="pg-stage sg-on"><div class="sg-eq ${v.ph !== "fail" ? "on" : ""}">${"<i></i>".repeat(5)}</div>${v.note === "nopl" ? `<p class="pg-sub">${T("“Whose song?” needs at least two playlists, so this is a normal round.", "Für „Wessen Song?“ braucht es mindestens zwei Playlists, deshalb ist das eine normale Runde.")}</p>` : ""}
              <p class="muted">${v.ph === "prep" ? T(`Song ${v.n} of ${v.of} · get ready…`, `Song ${v.n} von ${v.of} · gleich geht's los…`) : v.ph === "load" ? T("Picking songs…", "Songs werden ausgesucht…") : T("The songs didn't load. Check the connection and try again.", "Die Songs sind nicht geladen. Verbindung prüfen und nochmal versuchen.")}</p>${v.ph === "fail" && v.host ? `<button class="btn go big" data-x="retry">${T("Try again", "Nochmal versuchen")}</button>` : ""}${v.wl ? `<p class="sg-wl">🎁 ${md(v.wl)}</p>` : ""}${hostBar}</div>`;
            const rt = body.querySelector('[data-x="retry"]'); if (rt) rt.onclick = () => { rt.disabled = true; act({a: "retry"}); }; } }
        else if (v.ph === "play"){
          if (fresh){ const W = v.what, K = v.kind;
            const say = K === "time" ? T("Where does it go in your timeline?", "Wo gehört er in deinen Zeitstrahl?") : K === "bingo" ? T("Who sings? Is it on your card?", "Wer singt? Steht er auf deiner Karte?") : K === "whose" ? (v.own ? "" : T("Whose playlist is it from?", "Aus wessen Playlist ist er?")) : W === "year" ? T("Which year?", "Aus welchem Jahr?") : W === "both" ? T("Title and artist?", "Titel und Interpret?") : W === "artist" ? T("Who sings?", "Wer singt?") : T("Which song?", "Welcher Song?");
            const ui = K === "pick" || (K === "whose" && !v.own) ? `<div class="sg-opts ${v.opts.length > 4 ? "six" : ""}">${v.opts.map((o, i) => `<button class="btn big" data-op="${i}">${md(o)}</button>`).join("")}</div>`
              : K === "whose" ? `<div class="pg-big sg-own" style="min-height:0">🤫 <b>${T("This one is from your playlist!", "Der ist aus deiner Playlist!")}</b><small>${T("The others guess whose it is. Every wrong guess is a point for you.", "Die anderen raten, von wem er ist. Jeder falsche Tipp ist ein Punkt für dich.")}</small></div>`
              : K === "year" ? `<form class="sg-form" data-f="year"><label class="sg-l">${T("Year", "Jahr")}<input type="text" inputmode="numeric" maxlength="4" data-in="y" autocomplete="off" placeholder="z. B. 1985" enterkeyhint="done"></label><button type="submit" class="btn go big">${T("Lock in", "Abgeben")}</button></form>`
              : K === "time" ? tlHTML(v.tl, true) + `<p class="pg-hint" style="margin:0">${T(`${v.tl.length} of ${v.goal} cards`, `${v.tl.length} von ${v.goal} Karten`)}</p>`
              : K === "bingo" ? bingoHTML(v.card, true)
              : `<div data-lib></div>`;
            body.innerHTML = `<div class="sg-q sg-on wait"><div class="sg-top"><span class="muted">${K === "time" || K === "bingo" ? "" : T("Song", "Song") + ` ${v.n} / ${v.of}`}${v.fast ? " · ⚡ " + T("fastest takes it", "wer zuerst richtig hat") : ""}</span><b class="sg-left" data-left></b></div>
              <div class="sg-cd" data-cd></div><div class="sg-eq on">${"<i></i>".repeat(5)}</div><div class="sg-bar"><i data-bar></i></div>${v.up ? `<div class="sg-stg" data-stg></div>` : ""}<button class="btn go big" data-x="hear" hidden>▶ ${T("Tap to listen", "Tippen zum Hören")}</button>
              ${v.wl ? `<p class="sg-wl">🎁 ${md(v.wl)}</p>` : ""}${v.fan ? `<p class="sg-fan">💎 ${T("For connoisseurs: +1 if you know it", "Kenner-Song: +1, wenn du ihn kennst")}</p>` : ""}${say ? `<p class="pg-say" style="margin:0">${say}</p>` : ""}${ui}
              <div class="sg-act">${v.own ? "" : `<button class="btn sg-skip" data-skip><span>${K === "bingo" ? "🙅" : "🤷"}</span>${K === "bingo" ? T("Not on my card", "Nicht auf meiner Karte") : T("No idea", "Weiß nicht")}</button>`}<button class="btn sg-more" data-more hidden></button></div>
              <p class="pg-hint" data-st></p>${hostBar}</div>`;
            const q = body.querySelector(".sg-q"), lock = () => body.querySelectorAll(LOCK).forEach(x => { x.disabled = true; });
            /* the time is taken on this phone: from the moment the clip started here to the tap (the network doesn't count) */
            const send = a => { if (V.sent) return; V.sent = a.a; const t0 = V.st[0] ? V.st[0].at : Date.now(); act(Object.assign(a, {ms: Math.max(0, Math.round(Date.now() - t0))})); lock(); };
            body.querySelectorAll("[data-op]").forEach(b => b.onclick = () => { if (V.sent) return; b.classList.add("go"); PG.vib(15); send({a: K === "whose" ? "who" : "pick", v: b.dataset.op}); });
            body.querySelectorAll("[data-sl]").forEach(b => b.onclick = () => { if (V.sent) return; b.classList.add("on"); PG.vib(15); send({a: "slot", v: b.dataset.sl}); });
            body.querySelectorAll("[data-bc]").forEach(b => b.onclick = () => { if (V.sent) return; b.classList.add("on"); PG.vib(15); send({a: "mark", v: b.dataset.bc}); });
            const f = body.querySelector(".sg-form"); if (f){ const ins = [...f.querySelectorAll("input")]; f.onsubmit = e => { e.preventDefault(); if (V.sent) return; const o = {}; ins.forEach(i => { o[i.dataset.in] = i.value.trim().slice(0, 80); }); try { document.activeElement.blur(); } catch(x) {} send({a: f.dataset.f, f: o}); }; }
            const lb = body.querySelector("[data-lib]"); if (lb) library(lb, W, ans => { try { document.activeElement.blur(); } catch(x) {} send({a: "type", f: {t: ans.title, r: ans.artist, p: 1}}); }, {auto: false});
            const sk = body.querySelector("[data-skip]"); if (sk) sk.onclick = () => { try { document.activeElement.blur(); } catch(x) {} PG.vib(10); send({a: "skip"}); };
            body.querySelector("[data-more]").onclick = e => { const b = e.currentTarget; if (b.disabled || V.sent) return; b.disabled = true; PG.vib(10); act({a: "more"}); };
            const partNow = () => { const t = Date.now(); let i = 0; V.st.forEach((x, k) => { if (t >= x.at) i = k; }); return i; };
            const hear = body.querySelector('[data-x="hear"]'); hear.onclick = () => { hear.hidden = true; const p = V.st[partNow()]; SA.hear(v.url, p ? p.len : 10, p ? p.from : 0); };
            /* every part of the clip starts on this phone at its moment */
            SA.plan(v.k, v.url, V.st, need);
            const bar = body.querySelector("[data-bar]"), cd = body.querySelector("[data-cd]"); clearInterval(V.tk);
            const run = () => { if (!bar.isConnected) return clearInterval(V.tk); const t = Date.now(), i = partNow(), cur = V.st[i] || {at: t, len: 1};
              bar.style.width = Math.max(0, Math.min(100, (t - cur.at) / (cur.len * 1000) * 100)) + "%";
              /* the quick 3-2-1, then the sound; answers are open from the first second on */
              const pre = V.st[0] ? V.st[0].at - t : 0; cd.textContent = pre > 0 ? String(Math.min(3, Math.ceil(pre / 500))) : ""; cd.classList.toggle("on", pre > 0); q.classList.toggle("wait", pre > 0);
              const sg = body.querySelector("[data-stg]"); if (sg){ const nx = V.st[i + 1], k = sg.dataset.k, nk = i + ":" + (t >= cur.at) + ":" + !!(nx && t > cur.at + cur.len * 1000);
                if (k !== nk){ sg.dataset.k = nk; sg.innerHTML = STAGES.map((L, j) => `<span class="${j < i || (j === i && t >= cur.at) ? "on" : ""}">${L} s</span>`).join("") + `<small>${nx && t > cur.at + cur.len * 1000 ? T(`Next: ${nx.len} s`, `Gleich: ${nx.len} s`) : T(`Right now: ${STP[Math.min(i, STP.length - 1)]} points`, `Jetzt richtig: ${STP[Math.min(i, STP.length - 1)]} Punkte`)}</small>`; } }
              const L = body.querySelector("[data-left]"); if (L){ const sl = Math.max(0, Math.ceil((V.end - t) / 1000)); L.textContent = pre > 0 || sl > 15 ? "" : "⏳ " + sl + " s"; L.classList.toggle("low", sl <= 5); } };
            V.tk = setInterval(run, 100); run(); }
          if (v.done && !V.sent){ V.sent = "x"; body.querySelectorAll(LOCK).forEach(x => { x.disabled = true; }); }
          const mb = body.querySelector("[data-more]"); if (mb){ const M2 = v.more || {}; mb.hidden = !M2.can && !M2.mine; mb.disabled = !!M2.mine || !M2.can;
            mb.innerHTML = `<span>▶</span>${v.up ? T("Next part", "Nächster Teil") : T("Keep listening", "Weiter hören")}${M2.need > 1 ? ` <small>${M2.n}/${M2.need}</small>` : ""}`; }
          const st = body.querySelector("[data-st]"); if (st) st.textContent = v.own ? T(`${v.got - 1} of ${v.all - 1} have guessed.`, `${v.got - 1} von ${v.all - 1} haben getippt.`) : v.wrong ? T("Not right. Wait for the others…", "Leider falsch. Warte auf die anderen…") : v.done || V.sent ? T(`Locked in. ${v.got} of ${v.all} have answered.`, `Abgegeben. ${v.got} von ${v.all} haben geantwortet.`) : v.more && v.more.mine ? T("You want to hear more – the others decide too.", "Du willst weiter hören – die anderen entscheiden mit.") : T(`${v.got} of ${v.all} have answered.`, `${v.got} von ${v.all} haben geantwortet.`); }
        else if (v.ph === "rev"){
          if (fresh){ clearInterval(V.tk); SA.rest(v.url); const mk = ok => ok == null ? "<b class=\"sg-mk\">–</b>" : ok.map(x => `<b class="sg-mk ${x ? "ok" : ""}">${x ? "✓" : "✗"}</b>`).join("");
            const extra = v.kind === "time" ? `<div class="pg-name" style="font-size:48px">📅 ${md(v.year)}</div>${tlHTML(v.tl, false, v.nw)}<p class="pg-hint" style="margin:0">${T(`${v.tl.length} of ${v.goal} cards`, `${v.tl.length} von ${v.goal} Karten`)}</p>`
              : v.kind === "bingo" ? `${v.bwin.length ? `<div class="pg-name sg-bingo-win">BINGO! 🎉</div><p class="muted" style="margin:0">${md(v.bwin.join(", "))}</p>` : ""}${bingoHTML(v.card, false)}`
              : v.kind === "whose" ? `<p class="pg-say" style="margin:0">🎧 ${T("From the playlist of", "Aus der Playlist von")} <b>${md(v.own)}</b></p>` : "";
            body.innerHTML = `<div class="pg-stage pg-pop sg-on"><div class="sg-ans">${v.art && OKURL.test(v.art) ? `<img src="${h(v.art)}" alt="" width="100" height="100">` : `<span class="sg-noart">🎵</span>`}<div><div class="sg-t">${md(v.title)}</div><div class="sg-a">${md(v.artist)}${v.year ? ` · ${md(v.year)}` : ""}</div></div></div>
              ${extra}<div class="pg-name" style="font-size:40px">${v.mine > 0 ? "+" + v.mine : v.mine < 0 ? v.mine : "0"}</div>
              ${rows(v, mk)}${total(v)}
              <div class="sg-act">${v.host ? `<button class="btn go big" data-x="next">${v.last ? T("Results", "Ergebnis") : T("Next song", "Nächster Song")}</button>` : `<button class="btn big" data-x="nx" data-rdy></button>`}</div>
              <p class="pg-hint" data-st></p>${hostBar}</div>`; }
          const rb = body.querySelector("[data-rdy]"); if (rb){ rb.disabled = !!v.rdy.mine; rb.innerHTML = `⏭ ${v.last ? T("To the results", "Zum Ergebnis") : T("Next", "Weiter")} <small>${v.rdy.n}/${v.rdy.all}</small>`; }
          const st = body.querySelector("[data-st]"); if (st) st.textContent = T("The song plays on until everyone wants the next one.", "Der Song läuft weiter, bis alle weiter wollen."); }
        else if (v.ph === "end"){
          if (fresh){ clearInterval(V.tk); SA.stop();
            body.innerHTML = `<div class="pg-stage pg-pop sg-on"><div class="pg-moon">${v.kind === "bingo" && v.bwin.length ? "🟩" : "🏆"}</div><div class="pg-name">${md(v.kind === "bingo" && v.bwin.length ? v.bwin.join(", ") : v.tot[0] ? v.tot[0].n : "")}</div><p class="muted" style="margin:0">${v.kind === "bingo" && v.bwin.length ? "BINGO!" : T("wins", "gewinnt")}</p>
              ${total(v)}${v.my && v.my.heard ? myCard(v.my) : ""}${Rank.box(10)}
              <div class="unit" style="width:100%;text-align:left;margin:0"><h3>${T("The songs", "Die Songs")}</h3><div class="list">${v.log.map(l => `<div class="li">${l.art && OKURL.test(l.art) ? `<img src="${h(l.art)}" alt="" width="36" height="36" style="border-radius:6px">` : ""}<div class="grow"><div class="t">${md(l.t)}</div><div class="s">${md(l.a)}${l.w ? " · ⭐ " + md(l.w) : ""}</div></div></div>`).join("")}</div></div>
              ${v.host ? `<button class="btn go big" data-x="again" style="max-width:340px">${T("New game", "Neues Spiel")}</button><button class="btn ghost" data-x="lobby">${T("Back to the lobby", "Zurück zur Lobby")}</button>` : `<p class="pg-hint">${T("The host starts the next game.", "Der Gastgeber startet das nächste Spiel.")}</p>`}</div>`; 
            const rb2 = body.querySelector(".sg-rkbox"); if (rb2) rb2.querySelector("[data-rk]").innerHTML = Rank.html(null);
            const show2 = () => Rank.mount(body.querySelector(".sg-rkbox"), 10);
            if (v.my && v.my.heard && v.gid && !V.rep[v.gid]){ V.rep[v.gid] = 1; Rank.add(v.my).then(show2); } else show2(); } }
        if (fresh) body.querySelectorAll("[data-x]").forEach(b => { if (b.dataset.x === "hear") return; b.onclick = () => { const x = b.dataset.x; if (x === "lobby" && !b.dataset.armed && v.ph !== "end"){ b.dataset.armed = 1; b.textContent = T("Sure? Tap again", "Sicher? Nochmal tippen"); return; } if (x === "nx") b.disabled = true; act({a: x}); }; });
      }
    };
  }

  /* ---------- the look ---------- */
  const css = `
.sg-sing{align-self:stretch;margin:0 0 8px;padding:7px 12px;border-radius:12px;background:rgba(127,178,74,.16);color:var(--fg);font:800 13px var(--display,system-ui);text-align:center;animation:sgSing 1.6s ease-in-out infinite}@keyframes sgSing{50%{background:rgba(127,178,74,.28)}}
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
.sg-sug.on{box-shadow:inset 0 0 0 2px var(--go)}.sg-sug:disabled{opacity:.55}.sg-lh:empty{display:none}
.sg-act{display:flex;gap:8px;margin-top:2px;width:100%}.sg-act .btn{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;gap:8px;min-height:54px;font:800 16px var(--body);border-radius:16px}.sg-act .btn[hidden]{display:none}
.sg-act .btn span{font-size:21px;line-height:1}.sg-act .btn small{font:800 12px var(--body);opacity:.75;margin-left:2px}
.sg-skip{background:var(--panel-2);color:inherit;box-shadow:inset 0 0 0 2px rgba(255,255,255,.14)}.sg-skip:active{transform:scale(.97)}.sg-skip:disabled{opacity:.45}
.sg-more{background:linear-gradient(180deg,#4FA3FF,#2F7FD9);color:#fff}.sg-more:disabled{opacity:.6}
.sg-wl{margin:0;text-align:center;font:800 13.5px var(--body);color:var(--muted)}
.sg-wish .sg-wg{width:100%;gap:8px}.sg-wt{justify-content:flex-start;gap:9px;min-height:50px;text-align:left}.sg-wt small{display:block;color:var(--muted);font:700 11.5px var(--body)}
.sg-plbox h3{margin:0}.sg-plc{display:flex;align-items:center;gap:10px;margin-top:8px;background:var(--panel-2);border-radius:14px;padding:8px 10px}.sg-pli{font-size:24px}.sg-plc .sg-sx{flex:1}
.sg-plf{display:flex;gap:8px;margin-top:8px}.sg-plf input{flex:1;min-width:0;font-size:16px;padding:10px 12px}.sg-plm{margin:6px 0 0}
.sg-own{display:flex;flex-direction:column;gap:6px;align-items:center;text-align:center;padding:14px}.sg-own b{font:900 19px var(--display)}.sg-own small{color:var(--muted);font:700 13px/1.35 var(--body)}
.sg-tl{display:flex;flex-direction:column;gap:5px;width:100%}.sg-card{display:flex;align-items:center;gap:12px;background:var(--panel-2);border-radius:12px;padding:7px 12px;text-align:left}.sg-card b{font:900 20px var(--display);min-width:52px}
.sg-card span{display:flex;flex-direction:column;font:700 13.5px var(--body);min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.sg-card small{color:var(--muted);font:700 12px var(--body)}.sg-card.nw{box-shadow:inset 0 0 0 2px var(--go-hi);background:color-mix(in srgb,var(--go) 22%,var(--panel-2))}
.sg-slot{border:2px dashed rgba(127,127,127,.45);background:none;color:var(--muted);border-radius:12px;min-height:40px;font:800 13.5px var(--body);cursor:pointer}.sg-slot:active,.sg-slot.on{border-color:var(--go);color:var(--go-hi);background:color-mix(in srgb,var(--go) 14%,transparent)}.sg-slot:disabled{opacity:.45}
.sg-bingo{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;width:100%}.sg-bc{position:relative;aspect-ratio:1.15;border:0;border-radius:14px;background:var(--panel-2);color:inherit;font:800 13.5px/1.2 var(--body);padding:6px;cursor:pointer;display:grid;place-items:center;text-align:center;overflow:hidden}
.sg-bc span{overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}.sg-bc.m{background:linear-gradient(180deg,#5FC66B,#3D9E4A);color:#fff}.sg-bc i{position:absolute;top:4px;right:7px;font-style:normal;font-weight:900}.sg-bc.on{box-shadow:inset 0 0 0 3px var(--go-hi)}.sg-bc:disabled:not(.m){opacity:.6}
.sg-bingo-win{font-size:44px;color:var(--go-hi)}
.sg-fan{margin:0;text-align:center;font:800 13.5px var(--body);color:#7FD8FF}
.sg-ms{display:flex;flex-direction:column;align-items:flex-end;font:900 15px var(--display);color:var(--muted);margin-right:10px;white-space:nowrap}.sg-ms.ok{color:var(--go-hi)}.sg-ms small{font:800 11.5px var(--body);color:#FFC93C}
.sg-fx{margin-top:3px;font:800 12.5px var(--body);color:#FFC93C}
.sg-tags{display:flex;flex-wrap:wrap;gap:4px;margin:3px 0}.sg-tags span{font:800 11.5px var(--body);padding:2px 8px;border-radius:999px;background:color-mix(in srgb,#B65CE0 22%,var(--panel-2));color:var(--fg)}
.sg-my{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center}.sg-my div{display:flex;flex-direction:column;gap:2px;background:var(--panel-2);border-radius:12px;padding:10px 4px}.sg-my b{font:900 20px var(--display)}.sg-my small{color:var(--muted);font:700 11.5px var(--body)}
.sg-rk .pg-rank{font-size:18px}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
})();
