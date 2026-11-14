/* Chess.nat Song raten: reads a public Spotify playlist (or album) from its link: name and the songs with their artists.
   No Spotify login: it opens the public embed page of the playlist (the player you can put on any website) and reads the
   song list from it. Gives back {name, tracks: [{t, a}]} (title, artists); the app then finds each song in Apple's search
   for the 30-second preview. Answers are cached at the edge for an hour. */
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ent = s => String(s || "").replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const strip = s => ent(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const clean = L => { const seen = new Set(); return L.map(x => ({t: String(x.t || "").trim().slice(0, 120), a: String(x.a || "").trim().slice(0, 120)}))
  .filter(x => { const k = (x.t + "|" + x.a).toLowerCase(); if (!x.t || !x.a || seen.has(k)) return false; seen.add(k); return true; }).slice(0, 200); };

/* the page keeps its data as JSON (Next.js); look for the list of tracks (title + subtitle = artists) wherever it sits */
function fromJSON(html){
  const m = /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html); if (!m) return null;
  let j; try { j = JSON.parse(m[1]); } catch(e) { return null; }
  let tracks = null, name = "";
  (function walk(o, d){ if (!o || typeof o !== "object" || d > 14) return;
    if (!tracks && Array.isArray(o.trackList) && o.trackList.length) tracks = o.trackList.map(x => ({t: x.title || x.name, a: x.subtitle || (x.artists || []).map(a => a.name).join(", ")}));
    if (!name && typeof o.name === "string" && /playlist|album/.test(String(o.type || o.uri || ""))) name = o.name;
    for (const k in o) walk(o[k], d + 1); })(j, 0);
  return tracks ? {name, tracks} : null;
}
/* without the JSON: "title":"…","subtitle":"…" pairs anywhere in the page */
function fromPairs(html){
  const out = [], re = /"title":"((?:[^"\\]|\\.)*)","subtitle":"((?:[^"\\]|\\.)*)"/g; let m;
  const un = s => { try { return JSON.parse('"' + s + '"'); } catch(e) { return s; } };
  while ((m = re.exec(html))) out.push({t: un(m[1]), a: un(m[2])});
  return out.length ? {name: "", tracks: out} : null;
}
/* or the visible list: each song a heading with the title and one with the artists */
function fromHeadings(html){
  const out = [], re = /<h3[^>]*>([\s\S]*?)<\/h3>\s*(?:<[^h][^>]*>\s*)*<h4[^>]*>([\s\S]*?)<\/h4>/g; let m;
  while ((m = re.exec(html))) out.push({t: strip(m[1]), a: strip(m[2])});
  return out.length ? {name: "", tracks: out} : null;
}

module.exports = async (req, res) => {
  const u = String((req.query && req.query.u) || "").slice(0, 400), m = /(playlist|album)[/:]([A-Za-z0-9]{10,40})/.exec(u);
  if (!m) return res.status(400).json({error: "Das ist kein Link zu einer Spotify-Playlist."});
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(`https://open.spotify.com/embed/${m[1]}/${m[2]}`, {headers: {"User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9,en;q=0.8"}, signal: ctl.signal});
    if (!r.ok) return res.status(r.status === 404 ? 404 : 502).json({error: r.status === 404 ? "Playlist nicht gefunden. Ist sie öffentlich?" : "Spotify antwortet gerade nicht."});
    const html = await r.text(), got = fromJSON(html) || fromPairs(html) || fromHeadings(html);
    const title = /<title>([^<]*)<\/title>/.exec(html), name = (got && got.name) || (title ? ent(title[1]).replace(/\s*[|–-]\s*Spotify.*$/i, "").replace(/^Spotify\s*[–-]\s*/i, "").trim() : "");
    const tracks = clean(got ? got.tracks : []);
    if (!tracks.length) return res.status(422).json({error: "In der Playlist wurden keine Songs gefunden. Ist sie öffentlich?"});
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({name: name.slice(0, 80), kind: m[1], tracks});
  } catch(e) {
    return res.status(502).json({error: "Spotify ist gerade nicht erreichbar."});
  } finally { clearTimeout(to); }
};
