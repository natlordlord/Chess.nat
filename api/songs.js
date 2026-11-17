/* Chess.nat Song raten: the one place the phones ask for songs, so the game always finds some (Nathan, Nov 2026: "er sagt
   manchmal, er findet keine – das darf nicht sein").
   Before, every phone asked Apple's search itself, and Apple answers only about 20 searches a minute per phone: in a long game or
   a group with several phones the search said no, and the game had no songs. Now:
   - GET /api/songs?term=…&entity=song|musicArtist&attribute=artistTerm&limit=…  works like Apple's search (itunes.apple.com/search).
     It is asked from here and the answer is kept at the edge for a day, so the same search (a radio hit, an artist) costs Apple
     nothing the next time. When Apple has nothing or says no, Deezer's search answers instead, in the same shape.
   - GET /api/songs?pl=disney  the songs of the category's big playlists on Deezer: hundreds of songs with their 30-second previews
     in one answer. Deezer signs a preview link for a while only (…?hdnea=exp=…), so this answer is kept for 4 minutes and the
     phone drops a song whose link is about to run out.
   Results always have Apple's field names (trackId, trackName, artistName, previewUrl, artworkUrl60/100, releaseDate). */
const UA = "Mozilla/5.0 (compatible; ChessNat/1.0; +https://chess-nat.vercel.app)";
const clip = (s, n) => String(s == null ? "" : s).slice(0, n);
const N = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/* the big playlists of each category on Deezer: searched by these words, the best few are merged */
const PLQ = {
  mix: ["Greatest Hits of All Time", "Party Hits", "Die größten Hits"],
  charts: ["@chart", "Top Hits Deutschland", "Today's Hits"],
  pop: ["Pop Hits", "Pop Classics"],
  drap: ["Deutschrap Hits", "Deutschrap Classics"],
  dpop: ["Deutschpop Hits", "Deutsch Pop"],
  rap: ["Hip Hop Classics", "Rap Hits"],
  rock: ["Rock Classics", "Rock Hits"],
  y60: ["60s Hits", "70s Hits", "Oldies"],
  y80: ["80s Hits", "80er Hits"],
  y90: ["90s Hits", "90er Hits"],
  y00: ["2000s Hits", "2000er Hits"],
  y10: ["2010s Hits", "2010er Hits"],
  y20: ["2020s Hits", "Hits 2025"],
  party: ["Schlager Party", "Schlager Hits", "Ballermann Hits"],
  dance: ["Dance Hits", "EDM Hits"],
  rnb: ["R&B Classics", "Soul Classics"],
  latin: ["Reggaeton Hits", "Latin Hits"],
  kpop: ["K-Pop Hits", "K-Pop"],
  indie: ["Indie Hits", "Indie Classics"],
  metal: ["Metal Classics", "Punk Rock Classics"],
  film: ["Movie Soundtrack Hits", "Musical Hits"],
  xmas: ["Christmas Hits", "Weihnachtslieder"],
  disney: ["Disney Hits", "Disney Songs", "Disney Klassiker"],
  musical: ["Musical Hits", "Best of Musicals", "Broadway Hits"],
  movie: ["Movie Soundtrack Hits", "Filmmusik Hits", "Soundtrack Hits"],
  series: ["Serien Titelsongs", "Serien Titelmusik", "Sitcom Theme Songs"],
  kids: ["Kinderlieder", "Kinderdisco"],
  esc: ["Eurovision Hits", "Eurovision Song Contest"],
  apres: ["Après Ski Hits", "Oktoberfest Hits"],
  boy: ["Boyband Hits", "Girl Groups"],
  summer: ["Sommerhits", "Summer Hits"],
  tiktok: ["TikTok Hits", "Viral Hits"],
  onehit: ["One Hit Wonders"],
  ballad: ["Kuschelrock", "Love Songs", "Power Ballads"],
  ndw: ["Neue Deutsche Welle", "NDW Hits"],
  anime: ["Anime Openings", "Anime Hits"],
  games: ["Video Game Songs", "Gaming Hits"]
};
/* not the real song: karaoke, tributes, covers, lullabies, sing-alongs */
const JUNK_T = /karaoke|instrumental|made famous|originally performed|in the style of|tribute|cover version|8[ -]bit|lullaby|music box|piano version|backing track|sped up|slowed|nightcore|workout mix|medley/i;
const JUNK_A = /karaoke|tribute|cover band|covers\b|lullab|hit crew|countdown singers|starlite|sing-?along|kidz bop|piano dreamers|8-bit|ameritz|zoom karaoke|top hits group|party hit kings/i;

/* fetch with a time limit: a slow source must not hold up the game */
async function get(url, ms = 4500){
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, {headers: {"user-agent": UA, accept: "application/json"}, signal: ctl.signal}); if (!r.ok) return {status: r.status}; return {status: r.status, j: await r.json()}; }
  catch(e) { return {status: 0}; } finally { clearTimeout(to); } }

/* a Deezer song in Apple's shape */
const dz = t => t && t.preview && t.title && t.artist ? {wrapperType: "track", trackId: "dz" + t.id, trackName: clip(t.title_short || t.title, 120), artistName: clip(t.artist.name, 100),
  previewUrl: t.preview, artworkUrl60: (t.album && (t.album.cover_small || t.album.cover_medium)) || null, artworkUrl100: (t.album && (t.album.cover_medium || t.album.cover_big)) || null,
  collectionName: clip(t.album && t.album.title, 120), rank: t.rank || 0, src: "dz"} : null;
const real = r => r && !JUNK_T.test(r.trackName || "") && !JUNK_A.test(r.artistName || "");

async function apple(q){
  const p = new URLSearchParams({country: "DE"}); ["term", "entity", "attribute", "limit"].forEach(k => { if (q[k]) p.set(k, k === "limit" ? String(Math.min(60, +q[k] || 15)) : clip(q[k], 120)); });
  const r = await get("https://itunes.apple.com/search?" + p); if (!r.j || !Array.isArray(r.j.results)) return null;
  return r.j.results.map(x => Object.assign({}, x, {src: "it"})); }

async function deezer(q){
  const term = clip(q.term, 120), lim = Math.min(60, +q.limit || 15);
  if (q.entity === "musicArtist"){ const r = await get("https://api.deezer.com/search/artist?" + new URLSearchParams({q: term, limit: String(lim)}));
    return r.j && Array.isArray(r.j.data) ? r.j.data.map(a => ({wrapperType: "artist", artistName: clip(a.name, 100), artistId: "dz" + a.id, src: "dz"})) : null; }
  /* an artist's songs: Deezer's search by artist, the best known first */
  const qs = q.attribute === "artistTerm" ? `artist:"${term.replace(/"/g, "")}"` : term;
  const r = await get("https://api.deezer.com/search?" + new URLSearchParams({q: qs, limit: String(lim), order: "RANKING"}));
  return r.j && Array.isArray(r.j.data) ? r.j.data.map(dz).filter(real) : null; }

/* a playlist must be about its search: Deezer's playlist search also answers with lists that only look alike
   ("Musical Hits" found a Brazilian church playlist, "Músicas …", and its songs came up in Musicals). So the list's title has to
   carry one of the search's own words (not "hits", "best" and the like); "80s"/"80er"/"80's" all count as 80. And it must be
   short: a long title is a fan's theme list that only mentions the word. */
const PLAIN = new Set("hits hit best of the top songs song classics classic greatest all time die de der das and und today s todays".split(" "));
const words = t => N(t).replace(/\b(\d+)(?:er|s)\b/g, "$1").split(" ").filter(Boolean);
const keyWords = q => words(q).filter(w => (w.length >= 3 || /^\d\d/.test(w)) && !PLAIN.has(w)).map(w => /^\d/.test(w) ? w : w.replace(/s$/, ""));
function about(title, q){ const need = keyWords(q), have = words(title);
  /* a long title is somebody's theme list ("Onyx Storm | Fourth Wing, Iron Flame - The musical"), not the category */
  if (have.length > words(q).length + 4) return false;
  return !need.length || need.some(k => have.some(w => /^\d/.test(k) ? w === k : w.startsWith(k))); }

/* the category's playlists: searched once, then their songs (fresh preview links every time) */
const PLIDS = new Map();
async function playlists(key){
  const qs = PLQ[key] || PLQ.mix, out = [], seen = new Set(), lists = [];
  const add = L => (L || []).map(dz).filter(real).forEach(x => { const k = N(x.trackName) + "|" + N(x.artistName); if (seen.has(k)) return; seen.add(k); out.push(x); });
  const ids = [];
  for (const q of qs){
    if (q === "@chart"){ const r = await get("https://api.deezer.com/chart/0/tracks?limit=100"); if (r.j) add(r.j.data); continue; }
    let L = PLIDS.get(q);
    if (!L){ const r = await get("https://api.deezer.com/search/playlist?" + new URLSearchParams({q, limit: "10"}));
      L = r.j && Array.isArray(r.j.data) ? r.j.data.filter(p => p.nb_tracks >= 25 && p.nb_tracks <= 2000 && about(p.title, q)).slice(0, 2)
        .map(p => ({id: p.id, title: clip(p.title, 80), n: p.nb_tracks})) : [];
      if (L.length) PLIDS.set(q, L); }
    L.forEach(p => { if (!ids.includes(p.id)){ ids.push(p.id); lists.push(p); } }); }
  const got = await Promise.all(ids.slice(0, 5).map(id => get(`https://api.deezer.com/playlist/${id}/tracks?limit=400`, 6000)));
  got.forEach(r => { if (r.j) add(r.j.data); });
  /* the best known first; which lists they came from goes along (to look at, the phones ignore it) */
  const res = out.sort((a, b) => (b.rank || 0) - (a.rank || 0)).slice(0, 500); res.lists = lists.slice(0, 5); return res; }

module.exports = async (req, res) => {
  const q = req.query || {}, send = (code, body, age) => { res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", age ? `public, max-age=60, s-maxage=${age}, stale-while-revalidate=${Math.round(age / 4)}` : "no-store"); res.statusCode = code; res.end(JSON.stringify(body)); };
  try {
    if (q.pl){ const key = String(q.pl).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16); const results = await playlists(PLQ[key] ? key : "mix");
      return send(200, {resultCount: results.length, lists: results.lists, results, src: "dz"}, results.length ? 240 : 0); }
    if (!q.term || String(q.term).trim().length < 2) return send(400, {error: "term"});
    let results = q.src === "dz" ? null : await apple(q), src = "it";
    /* Apple has nothing or says no: Deezer */
    if (!results || !results.length){ const d = await deezer(q); if (d && d.length){ results = d; src = "dz"; } }
    if (!results) return send(502, {error: "no source", results: []});
    /* Apple's answers keep a day; Deezer's preview links run out, so theirs only a few minutes */
    return send(200, {resultCount: results.length, results, src}, results.length ? (src === "it" ? 86400 : 240) : 600);
  } catch(e) { return send(500, {error: String(e && e.message || e), results: []}); }
};
module.exports._t = {PLQ, dz, real, playlists, apple, deezer, about, keyWords};
