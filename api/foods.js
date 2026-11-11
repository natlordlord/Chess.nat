/* Chess.nat Kalorien-Tracker: where the values of the food table come from.
   For every food of the fixed table (data/foods.js) that Open Food Facts has a category for, this asks Open Food Facts for the
   products of that category and takes the MEDIAN of their values per 100 g (kcal, carbohydrates, protein, fat, fibre, sugar,
   saturated fat). The median of many real products is a real, checkable number and shrugs off single wrong entries.
   Products far away from what the food can be (a ready meal filed under "pasta") are left out first (kcal window per food).
   The answer is kept at the edge for a week, so everybody gets the same numbers; the phone and api/kcal.js both read it from here.
   A food with too few products keeps the value written in data/foods.js and is listed under "miss".
   Not from Open Food Facts: the cooking factors (dry ↔ cooked) and the quality mark; those stay in data/foods.js.
   GET /api/foods            → {at, foods: {id: {k,c,p,f,fi,su,sf,n,cat}}, miss: [...]}
   GET /api/foods?debug=1    → the same, plus why a food was missed (not cached) */
let TABLE = {list: []}; try { TABLE = require("../data/foods.js"); } catch(e) {}
const UA = "ChessNat/1.0 (chess-nat.vercel.app)", MIN = 8;
const median = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r1 = x => Math.round(x * 10) / 10;

async function products(cat, country){
  const q = `categories_tags:"${cat}"` + (country ? ` countries_tags:"${country}"` : "");
  const url = "https://search.openfoodfacts.org/search?" + new URLSearchParams({q, page_size: "100", fields: "code,nutriments", sort_by: "-unique_scans_n"});
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 9000);
  try { const r = await fetch(url, {headers: {"User-Agent": UA}, signal: ctl.signal}); if (!r.ok) throw new Error("HTTP " + r.status); const j = await r.json(); return Array.isArray(j.hits) ? j.hits : []; }
  finally { clearTimeout(to); }
}
/* one food: the median over the products that can be this food */
async function one(F){
  const lo = F.kr ? F.kr[0] : F.k * .75, hi = F.kr ? F.kr[1] : F.k * 1.25, cats = [].concat(F.off), why = [];
  for (const country of ["en:germany", ""]) for (const cat of cats){
    let hits; try { hits = await products(cat, country); } catch(e) { why.push(cat + (country ? " (DE)" : "") + ": " + String(e.message || e)); continue; }
    const rows = hits.map(h => h.nutriments || {}).map(n => ({k: Number(n["energy-kcal_100g"]) || (Number(n["energy_100g"]) ? Number(n["energy_100g"]) / 4.184 : 0), c: n.carbohydrates_100g, p: n.proteins_100g, f: n.fat_100g, fi: n.fiber_100g, su: n.sugars_100g, sf: n["saturated-fat_100g"]}))
      .filter(x => x.k >= lo && x.k <= hi && [x.c, x.p, x.f].every(v => v != null && isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100));
    why.push(cat + (country ? " (DE)" : "") + ": " + hits.length + " Produkte, " + rows.length + " passend");
    if (rows.length < MIN) continue;
    const med = key => { const v = rows.map(x => Number(x[key])).filter(x => isFinite(x) && x >= 0 && x <= 100); return v.length >= Math.min(MIN, rows.length / 2) ? r1(median(v)) : null; };
    const out = {k: Math.round(median(rows.map(x => x.k))), c: med("c"), p: med("p"), f: med("f"), n: rows.length, cat: cat + (country ? "" : " (weltweit)")};
    for (const key of ["fi", "su", "sf"]){ const v = med(key); if (v != null) out[key] = v; }
    return {ok: out, why};
  }
  return {why};
}

module.exports = async (req, res) => {
  const debug = !!(req.query && req.query.debug), todo = TABLE.list.filter(F => F.off), foods = {}, miss = [], whys = {};
  /* a few at a time, to be gentle with Open Food Facts */
  for (let i = 0; i < todo.length; i += 5) await Promise.all(todo.slice(i, i + 5).map(async F => { const r = await one(F).catch(e => ({why: [String(e.message || e)]})); if (r.ok) foods[F.id] = r.ok; else miss.push(F.id); whys[F.id] = r.why; }));
  const good = Object.keys(foods).length;
  /* a full answer stays for a week (and is refreshed in the background); a poor one is tried again soon */
  res.setHeader("Cache-Control", debug ? "no-store" : good >= todo.length / 2 ? "public, s-maxage=604800, stale-while-revalidate=2592000" : "public, s-maxage=300");
  return res.status(200).json(Object.assign({source: "Open Food Facts (openfoodfacts.org, ODbL)", how: "Median der Produkte der Kategorie, pro 100 g", at: new Date().toISOString(), foods, miss}, debug ? {why: whys} : {}));
};
