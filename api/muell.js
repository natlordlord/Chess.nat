/* Chess.nat Haushalt: the bin collection dates for a German address.
   There is no one calendar for Germany: every district runs its own. This looks the address up in the systems it knows:
     heinz      Landkreis Freising (abfallkalender.heinz-entsorgung.de)
     awido      AWIDO Online, about 50 districts and towns, mostly Bavaria, Hesse, Thuringia (awido.cubefour.de)
     abfallnavi regio iT "AbfallNavi", about 30 districts and towns, mostly North Rhine-Westphalia (…-abfallapp.regioit.de)
     jumomind   Jumomind / "MyMüll", about 60 districts and towns all over Germany (….jumomind.com); MyMüll is also asked for any
                town no other entry fits, because it knows by itself which towns it has
     ctrace     C-Trace, about a dozen (Bremen, Landkreis Augsburg, Kreis Segeberg, …): an iCal file per address (….c-trace.de)
   which region belongs to which system is the table REG below (from the open-source project hacs_waste_collection_schedule).
   GET /api/muell?suggest=Geiglbergstr 2a Wang   → {list: [{label, street, hnr, plz, city, district, county, state}]}  complete addresses while typing (OpenStreetMap via photon.komoot.io);
                                                    {list: [], slow: true} when that search is down; with &go=1 (the user tapped "search") Nominatim steps in
   GET /api/muell?street=…&hnr=…&city=…&district=…&county=…&state=…&plz=…
        → {via, termine: [{d: "2026-11-13", was: ["Restabfall", "Gelber Sack"], zusatz: ""}]}   from today on, one entry per day
        → {error: "unsupported"} when the region is not in the table, {error: "street"} when the street was not found there
   GET /api/muell, ?ort=…, ?ort=…&strasse=…      the first version (Landkreis Freising only): towns, streets, dates
   Nothing is stored here; answers are kept at the edge for half a day. */
const UA = {"User-Agent": "ChessNat/1.0 (chess-nat.vercel.app)"};
async function getJSON(url, headers, ms){
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms || 7000);
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
/* a place can go by several names (village, municipality, the name people type): the first one the calendar knows wins */
const names = a => [a.city, a.district].concat(String(a.alt || "").split("|")).map(x => String(x || "").trim()).filter(Boolean);
const place = (list, a, get) => { for (const n of names(a)){ const x = pick(list, n, get); if (x) return x; } return null; };
class Miss extends Error { constructor(what){ super(what); this.miss = what; } }

/* ---- Landkreis Freising: one question as JSON, base64, every two characters swapped ---- */
const HEINZ = "https://api-enttermine.heinz-entsorgung.net/", LK = "Landkreis Freising";
const enc = o => { const b = Buffer.from(JSON.stringify(o), "utf8").toString("base64"); let s = ""; for (let i = 0; i < b.length; i += 2) s += i + 1 < b.length ? b[i + 1] + b[i] : b[i]; return s; };
const heinzAsk = (path, o) => getJSON(HEINZ + path + "?param=" + encodeURIComponent(enc(o)), {"Origin": "https://abfallkalender.heinz-entsorgung.de", "Referer": "https://abfallkalender.heinz-entsorgung.de/"});
async function heinzDates(ort, strasse){ return group((await heinzAsk("termine", {landkreis: LK, ort, strasse, jahr: today().slice(0, 4)})).map(x => ({d: x.termin, was: x.fraktion, zusatz: x.zusatz ? x.fraktion + " " + x.zusatz : ""}))); }
async function heinz(a){
  const orte = (await heinzAsk("orte", {landkreis: LK})).map(x => x.ort), ort = place(orte, a, x => x); if (!ort) throw new Miss("city");
  const strs = (await heinzAsk("strassen", {landkreis: LK, ort})).map(x => x.strasse), str = pick(strs, a.street, x => x) || pick(strs, a.district, x => x) || (strs.length === 1 ? strs[0] : null); if (!str) throw new Miss("street");
  return heinzDates(ort, str);
}

/* ---- AWIDO Online: place → street → (house number) → calendar ---- */
async function awido(a, client){
  const B = "https://awido.cubefour.de/WebServices/Awido.Service.svc/secure/", q = "?client=" + encodeURIComponent(client);
  const places = await getJSON(B + "getPlaces/client=" + encodeURIComponent(client)); if (!Array.isArray(places) || !places.length) throw new Miss("city");
  const pl = place(places, a, x => x.value) || (places.length === 1 ? places[0] : null); if (!pl) throw new Miss("city");
  let oid = pl.key; const streets = await getJSON(B + "getGroupedStreets/" + oid + q);
  if (Array.isArray(streets) && streets.length){ const s = pick(streets, a.street, x => x.value) || place(streets, a, x => x.value) || (streets.length === 1 ? streets[0] : null); if (!s) throw new Miss("street"); oid = s.key;
    const nrs = await getJSON(B + "getStreetAddons/" + oid + q).catch(() => []);
    if (Array.isArray(nrs) && nrs.length && !(nrs.length === 1 && !String(nrs[0].value || "").trim())){ const n = pick(nrs, a.hnr, x => x.value) || nrs.find(x => norm(x.value).replace(/[a-z]/g, "") === norm(a.hnr).replace(/[a-z]/g, "")) || nrs[0]; oid = n.key; } }
  const cal = await getJSON(B + "getData/" + oid + "?fractions=&client=" + encodeURIComponent(client)), fr = {}; (cal.fracts || []).forEach(f => { fr[f.snm] = f.nm; });
  return group((cal.calendar || []).filter(c => c.ad != null && /^\d{8}$/.test(c.dt || "")).flatMap(c => (c.fr || []).map(f => ({d: c.dt.slice(0, 4) + "-" + c.dt.slice(4, 6) + "-" + c.dt.slice(6, 8), was: fr[f] || f}))));
}

/* ---- AbfallNavi (regio iT): town → street → (house number) → dates ---- */
async function navi(a, id){
  const bases = [`https://${id}-abfallapp.regioit.de/abfall-app-${id}/rest/`, `https://abfallapp.regioit.de/abfall-app-${id}/rest/`]; let B = bases[0], orte;
  try { orte = await getJSON(B + "orte"); } catch(e) { B = bases[1]; orte = await getJSON(B + "orte"); }
  const ort = place(orte, a, x => x.name) || (orte.length === 1 ? orte[0] : null); if (!ort) throw new Miss("city");
  const strs = await getJSON(B + "orte/" + ort.id + "/strassen"), s = pick(strs, a.street, x => x.name) || (strs.length === 1 ? strs[0] : null); if (!s) throw new Miss("street");
  const types = {}; (await getJSON(B + "fraktionen")).forEach(f => { types[f.id] = f.name; }); const fq = Object.keys(types).map(f => "fraktion=" + encodeURIComponent(f)).join("&");
  const det = await getJSON(B + "strassen/" + s.id).catch(() => ({})), nrs = det.hausNrList || []; let path = "strassen/" + s.id;
  if (nrs.length){ const n = pick(nrs, a.hnr, x => x.nr) || nrs.find(x => norm(x.nr).replace(/[a-z]/g, "") === norm(a.hnr).replace(/[a-z]/g, "")) || nrs[0]; path = "hausnummern/" + n.id; }
  return group((await getJSON(B + path + "/termine?" + fq)).map(r => ({d: r.datum, was: types[r.bezirk && r.bezirk.fraktionId] || "Abholung"})));
}

/* ---- Jumomind / MyMüll: town → street (→ house number) → area → dates ---- */
async function jumo(a, id){
  const B = `https://${id}.jumomind.com/mmapp/api.php?r=`, cities = await getJSON(B + "cities_web"); if (!Array.isArray(cities) || !cities.length) throw new Miss("city");
  const c = place(cities, a, x => x.name) || place(cities, a, x => x._name) || (cities.length === 1 ? cities[0] : null); if (!c) throw new Miss("city"); let area = c.area_id;
  if (c.has_streets){ const strs = await getJSON(B + "streets&city_id=" + encodeURIComponent(c.id)), s = pick(strs, a.street, x => x.name) || pick(strs, a.street, x => x._name) || (strs.length === 1 ? strs[0] : null); if (!s) throw new Miss("street"); area = s.area_id;
    if (Array.isArray(s.houseNumbers) && s.houseNumbers.length){ const n = norm(a.hnr).replace(/^0+/, ""), h = s.houseNumbers.find(x => norm(x[0]).replace(/^0+/, "") === n) || s.houseNumbers.find(x => norm(x[0]).replace(/[a-z]/g, "").replace(/^0+/, "") === n.replace(/[a-z]/g, "")); if (h) area = h[1]; else if (area == null) area = s.houseNumbers[0][1]; } }
  const q = "&city_id=" + encodeURIComponent(c.id) + "&area_id=" + encodeURIComponent(area), bins = {}; (await getJSON(B + "trash" + q)).forEach(b => { bins[b.name] = b.title; if (!(b._name in bins)) bins[b._name] = b.title; });
  return group((await getJSON(B + "dates/0" + q + "&ws=3")).map(e => ({d: e.day, was: bins[e.trash_name] || e.trash_name})));
}

/* ---- C-Trace: a session path first, then the calendar of one address as an iCal file ---- */
async function ctrace(a, svc, sub, file){
  const base = `https://${sub || "web"}.c-trace.de/${svc}/`, ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 7000); let sid = "";
  try { const r = await fetch(base + "Abfallkalender", {redirect: "manual", headers: UA, signal: ctl.signal}); sid = ((r.headers.get("location") || "").split("/")[2] || ""); } finally { clearTimeout(to); }
  const nr = (/^\d+/.exec(a.hnr || "") || [""])[0], tries = names(a).slice(0, 3), all = Array.from({length: 120}, (_, i) => i).join("|");
  for (const ort of tries){
    const u = base + (sid ? sid + "/" : "") + "abfallkalender/" + (file || "cal") + "?Ort=" + encodeURIComponent(ort) + "&Gemeinde=" + encodeURIComponent(a.city || ort) + "&Strasse=" + encodeURIComponent(a.street) + "&Hausnr=" + encodeURIComponent(nr || a.hnr || "") + "&Abfall=" + encodeURIComponent(all);
    const c2 = new AbortController(), t2 = setTimeout(() => c2.abort(), 7000); let ics = "";
    try { const r = await fetch(u, {headers: UA, signal: c2.signal}); if (r.ok) ics = await r.text(); } catch(e) {} finally { clearTimeout(t2); }
    const rows = []; ics.replace(/\r?\n[ \t]/g, "").split("BEGIN:VEVENT").slice(1).forEach(ev => { const d = /DTSTART[^:\n]*:(\d{4})(\d{2})(\d{2})/.exec(ev), su = /SUMMARY[^:\n]*:(.*)/.exec(ev); if (d && su) rows.push({d: d[1] + "-" + d[2] + "-" + d[3], was: su[1].replace(/\\,/g, ",").replace(/^Abfuhr:\s*/i, "").trim()}); });
    const t = group(rows); if (t.length) return t;
  }
  throw new Miss("street");
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
      ["solingen", "solingen"], ["luedenscheid", "stl"], ["oberhausen", "oberhausen"], ["cuxhaven", "cux"], ["frankenthal", "frankenthal"], ["kranenburg", "kranenburg"], ["portawestfalica", "portawestfalica"]].map(([s, id]) => ({s: new RegExp(s), f: a => navi(a, id)})),
  ...[["darmstadtdieburg", "zaw"], ["altoetting", "aoe"], ["aurich", "lka"], ["barnim", "bdg"], ["rheinhunsrueck", "rhe"], ["uckermark", "udg"], ["celle", "zac"], ["grafschaftbentheim", "ben"], ["^harz$", "enwi"], ["hoexter", "hox"], ["mainkinzig", "mkk"], ["wolfenbuettel", "wol"]].map(([c, id]) => ({c: new RegExp(c), f: a => jumo(a, id), lk: true})),
  ...[["badhomburg", "hom"], ["hattersheim", "hat"], ["^ingolstadt$", "ingol"], ["luebbecke", "lue"], ["^minden$", "sbm"], ["^recklinghausen$", "ksr"], ["neustadtanderweinstr", "esn"], ["^langen", "kbl"], ["rosbach", "ros"]].map(([s, id]) => ({s: new RegExp(s), f: a => jumo(a, id)})),
  ...[["^augsburg$", "augsburglandkreis"], ["segeberg", "segebergwzv-abfallkalender"], ["maintauber", "maintauberkreis-abfallkalender"], ["rheingautaunus", "rheingauleerungen"], ["grossgerau", "grossgeraulandkreis-abfallkalender"]].map(([c, id]) => ({c: new RegExp(c), f: a => ctrace(a, id), lk: true})),
  ...[["^bremen$", "bremenabfallkalender", "web", "cal"], ["dietzenbach", "dietzenbach", "web", "cal"], ["^bayreuth$", "bayreuthstadt-abfallkalender", "web", "cal"], ["^arnsberg$", "arnsberg-abfallkalender", "web", "cal"], ["landauinderpfalz|^landau$", "web.landau", "apps", "downloadcal"],
      ["sanktwendel|stwendel", "web.stwendel", "apps", "downloadcal"], ["oberursel", "web.oberursel", "apps", "cal"]].map(([s, id, sub, file]) => ({s: new RegExp(s), f: a => ctrace(a, id, sub, file)})),
  /* MyMüll serves some sixty towns and districts and tells by itself whether a town is one of them: asked last, for any address */
  {any: true, f: a => jumo(a, "mymuell")}
];
async function lookup(a){
  const city = norm(a.city), county = norm(a.county).replace(/^(landkreis|kreis)/, ""), isLk = /kreis|region/i.test(a.county || "") && norm(a.county).replace(/^(landkreis|kreis)/, "") !== "" ;
  /* towns with their own calendar first, then the district (only when the address really lies in a district, or town and district differ) */
  const cand = REG.filter(r => r.s && r.s.test(city)).concat(REG.filter(r => r.c && county && r.c.test(county) && (isLk || county !== city || !REG.some(x => x.s && x.s.test(city)))));
  REG.filter(r => r.any).forEach(r => cand.push(r));
  let miss = "city"; for (const r of cand.slice(0, 5)){ try { const t = await r.f(a); if (t.length) return t; if (miss === "city") miss = "empty"; } catch(e) { if (e.miss === "street") miss = "street"; /* a calendar that is down counts like one that doesn't know the place */ } }
  throw new Miss(miss === "city" ? "unsupported" : miss);
}

/* ---- complete addresses for what was typed so far. While typing: Photon (made for search-as-you-type), with a short
        patience. When it doesn't answer, the app shows a "search" button instead, and only that explicit search (go) may ask
        Nominatim, whose rules don't allow search-as-you-type. Both are OpenStreetMap. ---- */
const typedNr = text => ((/(?:^|\s)(\d{1,4}\s?[a-zA-Z]?)(?=\s|,|$)/.exec(text.replace(/\b\d{5}\b/g, " ")) || [])[1] || "").replace(/\s+/g, "");
function addrList(rows, text){ const nr = typedNr(text), seen = {}, list = [];
  for (const p of rows){ if (!p.street || !p.city) continue; const o = {street: clean(p.street), hnr: clean(p.hnr || nr).replace(/\s+/g, ""), plz: clean(p.plz), city: clean(p.city), district: clean(p.district), county: clean(p.county), state: clean(p.state), alt: String(p.alt || "").slice(0, 200)};
    o.label = o.street + (o.hnr ? " " + o.hnr : "") + ", " + (o.plz ? o.plz + " " : "") + o.city; const k = norm(o.label); if (seen[k]) continue; seen[k] = 1; list.push(o); if (list.length >= 6) break; }
  return list; }
async function photon(text){
  const j = await getJSON("https://photon.komoot.io/api/?lang=de&limit=8&bbox=5.8,47.2,15.1,55.1&layer=house&layer=street&q=" + encodeURIComponent(text), null, 2500);
  return addrList((j.features || []).map(f => f.properties || {}).filter(p => p.countrycode === "DE").map(p => ({street: p.street || (p.type === "street" ? p.name : ""), hnr: p.housenumber, plz: p.postcode, city: p.city || p.town || p.village || p.locality || p.district, district: p.district || p.locality, county: p.county, state: p.state})), text);
}
async function nominatim(text){
  const j = await getJSON("https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=de&accept-language=de&limit=8&q=" + encodeURIComponent(text), {"User-Agent": "ChessNat/1.0 (https://chess-nat.vercel.app; household bin plan, one lookup per saved address)"}, 6000);
  /* the address parts don't always carry the name people use for their town (a village of the municipality "Wang" comes as village
     "Volkmannsdorf"): every place name of the full line is kept (alt), and the one that was typed is shown as the town */
  const typed = norm(text);
  return addrList((Array.isArray(j) ? j : []).map(x => { const a = x.address || {}, skip = [a.house_number, a.road, a.county, a.state, a.postcode, a.country].map(norm);
    const locs = String(x.display_name || "").split(",").map(t => t.trim()).filter(t => t && !skip.includes(norm(t)) && !/\(VGem\)|^\d+\w?$/.test(t)), said = locs.find(l => norm(l).length > 2 && typed.includes(norm(l)));
    return {street: a.road || a.pedestrian || a.footway || a.hamlet || "", hnr: a.house_number, plz: a.postcode, city: said || a.city || a.town || a.village || a.municipality, district: a.village || a.suburb || a.hamlet || a.city_district, county: a.county, state: a.state, alt: locs.join("|")}; }), text);
}
async function suggest(text, go){
  try { const l = await photon(text); if (l.length || !go) return {list: l}; } catch(e) { if (!go) return {list: [], slow: true}; }
  return {list: await nominatim(text)};
}

module.exports = async (req, res) => {
  const q = req.query || {}, ok = (o, age) => { res.setHeader("Cache-Control", `public, s-maxage=${age || 43200}, stale-while-revalidate=86400`); res.status(200).json(o); };
  try {
    if (q.suggest != null){ const t = clean(q.suggest); if (t.length < 3) return ok({list: []}, 86400); const o = await suggest(t, q.go != null); return ok(o, o.slow ? 60 : 86400); }
    if (q.street != null || q.city != null){ const a = {street: clean(q.street), hnr: clean(q.hnr), plz: clean(q.plz), city: clean(q.city), district: clean(q.district), county: clean(q.county), state: clean(q.state), alt: String(q.alt || "").slice(0, 200)};
      /* the district is not always sent along (an address saved in the first version): then it is looked up from street and town */
      if (!a.county && a.city){ try { const L = (await suggest([a.street, a.hnr, a.plz, a.city].filter(Boolean).join(" "), true)).list, g = L.find(x => norm(x.city) === norm(a.city)) || L.find(x => !a.plz || x.plz === a.plz) || {}; a.county = g.county || ""; a.state = a.state || g.state || ""; a.district = a.district || g.district || ""; a.alt = a.alt || g.alt || ""; } catch(e) {} }
      try { return ok({termine: await lookup(a)}); } catch(e) { if (!e.miss) throw e; return ok({error: e.miss, county: a.county}, 3600); } }
    const ort = clean(q.ort), strasse = clean(q.strasse);
    if (!ort) return ok({orte: (await heinzAsk("orte", {landkreis: LK})).map(x => x.ort).filter(Boolean)});
    if (!strasse) return ok({ort, strassen: (await heinzAsk("strassen", {landkreis: LK, ort})).map(x => x.strasse).filter(Boolean)});
    return ok({ort, strasse, termine: await heinzDates(ort, strasse)});
  } catch(e) { res.setHeader("Cache-Control", "no-store"); res.status(502).json({error: String(e && e.message || e)}); }
};
module.exports._t = {norm, pick, lookup, REG, enc};
