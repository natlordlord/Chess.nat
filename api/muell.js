/* Chess.nat Haushalt: the bin collection dates for an address in Landkreis Freising.
   They come from the calendar the district's waste company runs (abfallkalender.heinz-entsorgung.de); its web app asks
   api-enttermine.heinz-entsorgung.net with one parameter: the question as JSON, base64, with every two characters swapped.
   GET /api/muell                      → {orte: [...]}            the towns
   GET /api/muell?ort=Wang             → {strassen: [...]}        the streets of a town
   GET /api/muell?ort=Wang&strasse=…   → {termine: [{d: "2026-11-13", was: ["Restabfall", "Gelber Sack"], zusatz: ""}]}  from today on, one entry per day
   Nothing is stored here; answers are kept at the edge for half a day. */
const API = "https://api-enttermine.heinz-entsorgung.net/", LK = "Landkreis Freising";
const enc = o => { const b = Buffer.from(JSON.stringify(o), "utf8").toString("base64"); let s = ""; for (let i = 0; i < b.length; i += 2) s += i + 1 < b.length ? b[i + 1] + b[i] : b[i]; return s; };
async function ask(path, o){
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 9000);
  try { const r = await fetch(API + path + "?param=" + encodeURIComponent(enc(o)), {headers: {"User-Agent": "ChessNat/1.0 (chess-nat.vercel.app)", "Origin": "https://abfallkalender.heinz-entsorgung.de", "Referer": "https://abfallkalender.heinz-entsorgung.de/"}, signal: ctl.signal});
    if (!r.ok) throw new Error("HTTP " + r.status); const j = await r.json(); if (!Array.isArray(j)) throw new Error("unexpected answer"); return j; }
  finally { clearTimeout(to); }
}
const clean = s => String(s || "").replace(/\s+/g, " ").trim().slice(0, 80);
module.exports = async (req, res) => {
  const q = req.query || {}, ort = clean(q.ort), strasse = clean(q.strasse);
  try {
    let out;
    if (!ort) out = {orte: (await ask("orte", {landkreis: LK})).map(x => x.ort).filter(Boolean)};
    else if (!strasse) out = {ort, strassen: (await ask("strassen", {landkreis: LK, ort})).map(x => x.strasse).filter(Boolean)};
    else {
      const today = new Date(Date.now() + 3600e3).toISOString().slice(0, 10), year = today.slice(0, 4), days = {};
      for (const x of await ask("termine", {landkreis: LK, ort, strasse, jahr: year})){
        if (!/^\d{4}-\d{2}-\d{2}$/.test(x.termin || "") || x.termin < today || !x.fraktion) continue;
        const d = days[x.termin] = days[x.termin] || {d: x.termin, was: [], zusatz: []}; if (!d.was.includes(x.fraktion)) d.was.push(String(x.fraktion).slice(0, 30)); if (x.zusatz) d.zusatz.push(String(x.fraktion).slice(0, 30) + " " + String(x.zusatz).slice(0, 30));
      }
      out = {ort, strasse, termine: Object.values(days).sort((a, b) => a.d < b.d ? -1 : 1).map(d => ({d: d.d, was: d.was, zusatz: d.zusatz.join(", ")}))};
    }
    res.setHeader("Cache-Control", "public, s-maxage=43200, stale-while-revalidate=86400"); res.status(200).json(out);
  } catch(e) { res.setHeader("Cache-Control", "no-store"); res.status(502).json({error: String(e && e.message || e)}); }
};
