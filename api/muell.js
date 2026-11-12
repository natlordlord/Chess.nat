/* Chess.nat Haushalt: the bin collection dates for a German address.
   There is no one calendar for Germany: every district runs its own. This looks the address up in the systems it knows:
     heinz      Landkreis Freising (abfallkalender.heinz-entsorgung.de)
     awido      AWIDO Online, about 50 districts and towns, mostly Bavaria, Hesse, Thuringia (awido.cubefour.de)
     abfallnavi regio iT "AbfallNavi", about 30 districts and towns, mostly North Rhine-Westphalia (…-abfallapp.regioit.de)
   which region belongs to which system is the table REG below (from the open-source project hacs_waste_collection_schedule).
   GET /api/muell?suggest=Geiglbergstr 2a Wang   → {list: [{label, street, hnr, plz, city, district, county, state}]}  complete addresses (OpenStreetMap via photon.komoot.io)
   GET /api/muell?street=…&hnr=…&city=…&district=…&county=…&state=…&plz=…
        → {via, termine: [{d: "2026-11-13", was: ["Restabfall", "Gelber Sack"], zusatz: ""}]}   from today on, one entry per day
        → {error: "unsupported"} when the region is not in the table, {error: "street"} when the street was not found there
   GET /api/muell, ?ort=…, ?ort=…&strasse=…      the first version (Landkreis Freising only): towns, streets, dates
   Nothing is stored here; answers are kept at the edge for half a day. */
const UA = {"User-Agent": "ChessNat/1.0 (chess-nat.vercel.app)"};
async function getJSON(url, headers){
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 7000);
  try { const r = await fetch(url, {headers: Object.assign({}, UA, headers || {}), signal: ctl.signal}); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); } finally { clearTimeout(to); }
}
const clean = s => String(s || "").replace(/\s+/g, " ").trim().slice(0, 80);
/* names are compared without case, umlauts, punctuation and the many spellings of "Straße" */
const norm = s => String(s || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/str\.|strasse/g, "str").replace(/[^a-z0-9]/g, "");
const pick = (list, name, get) => { const n = norm(name); if (!n) return null; return list.find(x => norm(get(x)) === n) || list.find(x => { const m = norm(get(x)); return m && (m.startsWith(n) || n.startsWith(m)); }) || null; };
const today = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10);
function group(rows){ const t = today(), days = {};
  for (const x of rows){ if (!/^\d{4}-\d{2}-\d{2}$/.test(x.d || "") || x.d < t || !x.was) continue; const d = days[x.d] = days[x.d] || {d: x.d, was: [], zusatz: []}; const w = String(x.was).slice(0, 40); if (!d.was.includes(w)) d.was.push(w); if (x.zusatz) d.zusatz.push(String(x.zusatz).slice(0, 60)); }
  return Object.values(days).sort((a, b) => a.d < b.d ? -1 : 1).slice(0, 80).map(d => ({d: d.d, was: d.was, zusatz: d.zusatz.join(", ")})); }
class Miss extends Error { constructor(what){ super(what); this.miss = what; } }

/* ---- Landkreis Freising: one question as JSON, base64, every two characters swapped ---- */
const HEINZ = "https://api-enttermine.heinz-entsorgung.net/", LK = "Landkreis Freising";
const enc = o => { const b = Buffer.from(JSON.stringify(o), "utf8").toString("base64"); let s = ""; for (let i = 0; i < b.length; i += 2) s += i + 1 < b.length ? b[i + 1] + b[i] : b[i]; return s; };
const heinzAsk = (path, o) => getJSON(HEINZ + path + "?param=" + encodeURIComponent(enc(o)), {"Origin": "https://abfallkalender.heinz-entsorgung.de", "Referer": "https://abfallkalender.heinz-entsorgung.de/"});
async function heinzDates(ort, strasse){ return group((await heinzAsk("termine", {landkreis: LK, ort, strasse, jahr: today().slice(0, 4)})).map(x => ({d: x.termin, was: x.fraktion, zusatz: x.zusatz ? x.fraktion + " " + x.zusatz : ""}))); }
async function heinz(a){
  const orte = (await heinzAsk("orte", {landkreis: LK})).map(x => x.ort), ort = pick(orte, a.city, x => x) || pick(orte, a.district, x => x); if (!ort) throw new Miss("city");
  const strs = (await heinzAsk("strassen", {landkreis: LK, ort})).map(x => x.strasse), str = pick(strs, a.street, x => x) || pick(strs, a.district, x => x) || (strs.length === 1 ? strs[0] : null); if (!str) throw new Miss("street");
  return heinzDates(ort, str);
}

/* ---- AWIDO Online: place → street → (house number) → calendar ---- */
async function awido(a, client){
  const B = "https://awido.cubefour.de/WebServices/Awido.Service.svc/secure/", q = "?client=" + encodeURIComponent(client);
  const places = await getJSON(B + "getPlaces/client=" + encodeURIComponent(client)); if (!Array.isArray(places) || !places.length) throw new Miss("city");
  const place = pick(places, a.city, x => x.value) || pick(places, a.district, x => x.value) || (places.length === 1 ? places[0] : null); if (!place) throw new Miss("city");
  let oid = place.key; const streets = await getJSON(B + "getGroupedStreets/" + oid + q);
  if (Array.isArray(streets) && streets.length){ const s = pick(streets, a.street, x => x.value) || pick(streets, a.district, x => x.value) || pick(streets, a.city, x => x.value) || (streets.length === 1 ? streets[0] : null); if (!s) throw new Miss("street"); oid = s.key;
    const nrs = await getJSON(B + "getStreetAddons/" + oid + q).catch(() => []);
    if (Array.isArray(nrs) && nrs.length && !(nrs.length === 1 && !String(nrs[0].value || "").trim())){ const n = pick(nrs, a.hnr, x => x.value) || nrs.find(x => norm(x.value).replace(/[a-z]/g, "") === norm(a.hnr).replace(/[a-z]/g, "")) || nrs[0]; oid = n.key; } }
  const cal = await getJSON(B + "getData/" + oid + "?fractions=&client=" + encodeURIComponent(client)), fr = {}; (cal.fracts || []).forEach(f => { fr[f.snm] = f.nm; });
  return group((cal.calendar || []).filter(c => c.ad != null && /^\d{8}$/.test(c.dt || "")).flatMap(c => (c.fr || []).map(f => ({d: c.dt.slice(0, 4) + "-" + c.dt.slice(4, 6) + "-" + c.dt.slice(6, 8), was: fr[f] || f}))));
}

/* ---- AbfallNavi (regio iT): town → street → (house number) → dates ---- */
async function navi(a, id){
  const bases = [`https://${id}-abfallapp.regioit.de/abfall-app-${id}/rest/`, `https://abfallapp.regioit.de/abfall-app-${id}/rest/`]; let B = bases[0], orte;
  try { orte = await getJSON(B + "orte"); } catch(e) { B = bases[1]; orte = await getJSON(B + "orte"); }
  const ort = pick(orte, a.city, x => x.name) || pick(orte, a.district, x => x.name) || (orte.length === 1 ? orte[0] : null); if (!ort) throw new Miss("city");
  const strs = await getJSON(B + "orte/" + ort.id + "/strassen"), s = pick(strs, a.street, x => x.name) || (strs.length === 1 ? strs[0] : null); if (!s) throw new Miss("street");
  const types = {}; (await getJSON(B + "fraktionen")).forEach(f => { types[f.id] = f.name; }); const fq = Object.keys(types).map(f => "fraktion=" + encodeURIComponent(f)).join("&");
  const det = await getJSON(B + "strassen/" + s.id).catch(() => ({})), nrs = det.hausNrList || []; let path = "strassen/" + s.id;
  if (nrs.length){ const n = pick(nrs, a.hnr, x => x.nr) || nrs.find(x => norm(x.nr).replace(/[a-z]/g, "") === norm(a.hnr).replace(/[a-z]/g, "")) || nrs[0]; path = "hausnummern/" + n.id; }
  return group((await getJSON(B + path + "/termine?" + fq)).map(r => ({d: r.datum, was: types[r.bezirk && r.bezirk.fraktionId] || "Abholung"})));
}

/* ---- which region is in which system. c: the district's name (as OpenStreetMap writes it, compared with norm()),
        s: a town that has its own calendar; an entry with only c must not catch the town of the same name (Stadt ≠ Landkreis) ---- */
const REG = [
  {c: /freising/, f: heinz},
  ...[["remsmurr", "rmk"], ["schweinfurt", "lra-schweinfurt"], ["gotha", "gotha"], ["saaleorla", "zaso"], ["berchtesgaden", "bgl"], ["fuerstenfeldbruck", "ffb"], ["tirschenreuth", "kreis-tir"], ["rosenheim", "rosenheim"], ["tuebingen", "tuebingen"],
      ["kronach", "kronach"], ["kulmbach", "kulmbach"], ["lichtenfels", "lichtenfels"], ["erding", "erding"], ["coburg", "coburg"], ["ansbach", "ansbach"], ["badduerkheim", "awb-duerkheim"], ["aichachfriedberg", "aic-fdb"], ["badtoelz", "wgv"],
      ["neustadtanderwaldnaab|neustadtadwaldnaab", "neustadt"], ["kelheim", "kelheim"], ["guenzburg", "kaw-guenzburg"], ["suedlicheweinstr", "eww-suew"], ["dachau", "lra-dah"], ["neuburgschrobenhausen", "landkreisbetriebe"], ["altenkirchen", "awb-ak"],
      ["lahndill", "awld"], ["hersfeldrotenburg", "azv-hef-rof"], ["dillingen|donauries", "awv-nordschwaben"], ["dingolfinglandau|rottalinn", "awv-isar-inn"], ["fulda", "fulda"], ["aschaffenburg", "lra-ab"], ["muehldorf", "lra-mue"], ["roth$", "roth"],
      ["regensburg", "lra-regensburg"], ["giessen", "lkgi"], ["gifhorn", "gifhorn"], ["ebersberg", "ebe"], ["altenburgerland", "awb-altenburg"], ["^muenchen$|landkreismuenchen", "zv-muc-so"]].map(([c, id]) => ({c: new RegExp(c), f: a => awido(a, id), lk: true})),
  ...[["unterhaching", "unterhaching"], ["kaufbeuren", "kaufbeuren"], ["pullach", "pullach"], ["unterschleissheim", "unterschleissheim"], ["memmingen", "memmingen"], ["^regensburg$", "regensburg"], ["^fulda$", "fulda-stadt"], ["koenigstein", "koenigstein"], ["^ulm$", "ebu"]].map(([s, id]) => ({s: new RegExp(s), f: a => awido(a, id)})),
  ...[["warendorf|guetersloh", "krwaf"], ["oberbergisch|rheinischbergisch", "bav"], ["coesfeld", "coe"], ["borken", "wml2"], ["heinsberg", "krhs"], ["pinneberg", "pi"], ["unna", "unna"], ["viersen", "viersen"], ["lippe$", "awvlippe"], ["dueren|staedteregionaachen", "zew2"]].map(([c, id]) => ({c: new RegExp(c), f: a => navi(a, id), lk: true})),
  ...[["^aachen$", "aachen"], ["^nuernberg$", "nuernberg"], ["bergischgladbach", "aw-bgl2"], ["^cottbus", "cottbus"], ["dinslaken", "din"], ["dorsten", "dorsten"], ["^halver$", "hlv"], ["kronberg", "kronberg"], ["muelheimanderruhr", "muelheim"], ["norderstedt", "nds"], ["roetgen", "roe"],
      ["solingen", "solingen"], ["luedenscheid", "stl"], ["oberhausen", "oberhausen"], ["cuxhaven", "cux"], ["frankenthal", "frankenthal"], ["kranenburg", "kranenburg"], ["portawestfalica", "portawestfalica"]].map(([s, id]) => ({s: new RegExp(s), f: a => navi(a, id)}))
];
async function lookup(a){
  const city = norm(a.city), county = norm(a.county).replace(/^(landkreis|kreis)/, ""), isLk = /kreis|region/i.test(a.county || "") && norm(a.county).replace(/^(landkreis|kreis)/, "") !== "" ;
  /* towns with their own calendar first, then the district (only when the address really lies in a district, or town and district differ) */
  const cand = REG.filter(r => r.s && r.s.test(city)).concat(REG.filter(r => r.c && county && r.c.test(county) && (isLk || county !== city || !REG.some(x => x.s && x.s.test(city)))));
  if (!cand.length) throw new Miss("unsupported");
  let miss = "city"; for (const r of cand.slice(0, 4)){ try { const t = await r.f(a); if (t.length) return t; miss = "empty"; } catch(e) { if (!e.miss) throw e; if (e.miss === "street") miss = "street"; } }
  throw new Miss(miss === "city" ? "unsupported" : miss);
}

/* ---- complete addresses for what was typed so far ---- */
async function suggest(text){
  const j = await getJSON("https://photon.komoot.io/api/?lang=de&limit=8&bbox=5.8,47.2,15.1,55.1&layer=house&layer=street&q=" + encodeURIComponent(text));
  const typedNr = (/(?:^|\s)(\d{1,4}\s?[a-zA-Z]?)(?=\s|,|$)/.exec(text.replace(/\b\d{5}\b/g, " ")) || [])[1], seen = {}, list = [];
  for (const f of j.features || []){ const p = f.properties || {}; if (p.countrycode !== "DE") continue; const street = p.street || (p.type === "street" ? p.name : ""), city = p.city || p.town || p.village || p.locality || p.district || ""; if (!street || !city) continue;
    const hnr = clean(p.housenumber || typedNr || "").replace(/\s+/g, ""), o = {street: clean(street), hnr, plz: clean(p.postcode), city: clean(city), district: clean(p.district || p.locality || ""), county: clean(p.county || ""), state: clean(p.state || "")};
    o.label = o.street + (o.hnr ? " " + o.hnr : "") + ", " + (o.plz ? o.plz + " " : "") + o.city; const k = norm(o.label); if (seen[k]) continue; seen[k] = 1; list.push(o); if (list.length >= 6) break; }
  return list;
}

module.exports = async (req, res) => {
  const q = req.query || {}, ok = (o, age) => { res.setHeader("Cache-Control", `public, s-maxage=${age || 43200}, stale-while-revalidate=86400`); res.status(200).json(o); };
  try {
    if (q.suggest != null){ const t = clean(q.suggest); return ok({list: t.length < 3 ? [] : await suggest(t)}, 86400); }
    if (q.street != null || q.city != null){ const a = {street: clean(q.street), hnr: clean(q.hnr), plz: clean(q.plz), city: clean(q.city), district: clean(q.district), county: clean(q.county), state: clean(q.state)};
      /* the district is not always sent along (an address saved in the first version): then it is looked up from street and town */
      if (!a.county && a.city){ try { const g = (await suggest([a.street, a.hnr, a.plz, a.city].filter(Boolean).join(" "))).find(x => norm(x.city) === norm(a.city)) || {}; a.county = g.county || ""; a.state = a.state || g.state || ""; a.district = a.district || g.district || ""; } catch(e) {} }
      try { return ok({termine: await lookup(a)}); } catch(e) { if (!e.miss) throw e; return ok({error: e.miss, county: a.county}, 3600); } }
    const ort = clean(q.ort), strasse = clean(q.strasse);
    if (!ort) return ok({orte: (await heinzAsk("orte", {landkreis: LK})).map(x => x.ort).filter(Boolean)});
    if (!strasse) return ok({ort, strassen: (await heinzAsk("strassen", {landkreis: LK, ort})).map(x => x.strasse).filter(Boolean)});
    return ok({ort, strasse, termine: await heinzDates(ort, strasse)});
  } catch(e) { res.setHeader("Cache-Control", "no-store"); res.status(502).json({error: String(e && e.message || e)}); }
};
module.exports._t = {norm, pick, lookup, REG, enc};
