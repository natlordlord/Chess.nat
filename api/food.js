/* Chess.nat Kalorien-Tracker: product search for the "Suchen" button.
   Asks Open Food Facts' search (search.openfoodfacts.org) and returns a short list with the values per 100 g.
   Products sold in Germany come first. Answers are cached at the edge for a day. */
const FIELDS = "code,product_name,product_name_de,generic_name,brands,nutriments,serving_quantity,product_quantity,image_front_small_url,countries_tags";
const r1 = x => Math.round((Number(x) || 0) * 10) / 10;

module.exports = async (req, res) => {
  const q = String((req.query && req.query.q) || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (q.length < 2) return res.status(400).json({error: "Bitte mindestens 2 Buchstaben."});
  const url = "https://search.openfoodfacts.org/search?" + new URLSearchParams({q, page_size: "40", langs: "de,en", fields: FIELDS});
  try {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(url, {headers: {"User-Agent": "ChessNat/1.0 (chess-nat.vercel.app)"}, signal: ctl.signal});
    clearTimeout(to);
    if (!r.ok) return res.status(502).json({error: "Die Suche ist gerade nicht erreichbar."});
    const j = await r.json(), seen = new Set();
    const items = (j.hits || []).map(p => {
      const n = p.nutriments || {}, k = Number(n["energy-kcal_100g"]) || (Number(n["energy_100g"]) ? Number(n["energy_100g"]) / 4.184 : 0);
      const brand = (Array.isArray(p.brands) ? p.brands[0] : String(p.brands || "").split(",")[0]) || "";
      return {code: String(p.code || ""), name: String(p.product_name_de || p.product_name || p.generic_name || "").trim().slice(0, 90), brand: String(brand).trim().slice(0, 40),
        k: Math.round(k), c: r1(n.carbohydrates_100g), pr: r1(n.proteins_100g), f: r1(n.fat_100g),
        serving: Math.round(Number(p.serving_quantity) || 0), pack: Math.round(Number(p.product_quantity) || 0), img: p.image_front_small_url || null,
        de: Array.isArray(p.countries_tags) && (p.countries_tags.includes("en:germany") || p.countries_tags.includes("en:austria")) ? 1 : 0};
    }).filter(x => { const key = (x.name + "|" + x.brand + "|" + x.k).toLowerCase(); if (!x.name || !(x.k > 0) || x.k > 950 || seen.has(key)) return false; seen.add(key); return true; });
    /* German products first, otherwise the search's own order */
    const out = items.map((x, i) => [x, i]).sort((a, b) => b[0].de - a[0].de || a[1] - b[1]).map(([x]) => { delete x.de; return x; }).slice(0, 20);
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({items: out});
  } catch(e) {
    return res.status(502).json({error: "Die Suche ist gerade nicht erreichbar."});
  }
};
