/* Chess.nat Kalorien-Tracker: product search for the "Suchen" button.
   Asks Open Food Facts' search (search.openfoodfacts.org) and returns a short list with the values per 100 g.
   Products sold in Germany come first. Answers are cached at the edge for a day. */
const FIELDS = "code,product_name,product_name_de,generic_name,brands,nutriments,serving_quantity,serving_size,product_quantity,image_front_small_url,countries_tags";
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
        serving: Math.round(Number(p.serving_quantity) || 0), ss: String(p.serving_size || "").slice(0, 60), pack: Math.round(Number(p.product_quantity) || 0), img: p.image_front_small_url || null,
        de: Array.isArray(p.countries_tags) && (p.countries_tags.includes("en:germany") || p.countries_tags.includes("en:austria")) ? 1 : 0};
    }).filter(x => { const key = (x.name + "|" + x.brand + "|" + x.k).toLowerCase(); if (!x.name || !(x.k > 0) || x.k > 950 || seen.has(key)) return false; seen.add(key); return true; });
    /* only what has a word of the search in its name or brand; the most words first, then products sold in Germany, then the search's own order */
    const norm = t => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss");
    const words = norm(q).split(/[^a-z0-9]+/).filter(w => w.length >= 3), hits = x => { const t = norm(x.name + " " + x.brand); return words.filter(w => t.includes(w)).length; };
    const out = items.map((x, i) => [x, i, words.length ? hits(x) : 1]).filter(a => a[2] > 0).sort((a, b) => b[2] - a[2] || b[0].de - a[0].de || a[1] - b[1]).map(([x]) => { delete x.de; return x; }).slice(0, 20);
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({items: out});
  } catch(e) {
    return res.status(502).json({error: "Die Suche ist gerade nicht erreichbar."});
  }
};
