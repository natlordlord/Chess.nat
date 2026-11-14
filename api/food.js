/* Chess.nat Kalorien-Tracker: product search for the "Suchen" button.
   Asks Open Food Facts' search (search.openfoodfacts.org) and returns a short list with the values per 100 g.
   Products sold in Germany come first. Answers are cached at the edge for a day. */
const FIELDS = "code,product_name,product_name_de,generic_name,brands,nutriments,serving_quantity,serving_size,product_quantity,image_front_small_url,countries_tags,nutriscore_grade";
const r1 = x => Math.round((Number(x) || 0) * 10) / 10;
/* forgiving like the search on the phone: how many typing errors (wrong, missing, extra or swapped letter) turn w into a piece of t */
function near(w, t){ const n = w.length; let p2 = null, p = Array.from({length: n + 1}, (_, i) => i), best = n;
  for (let j = 1; j <= t.length; j++){ const c = [0];
    for (let i = 1; i <= n; i++){ let v = Math.min(p[i] + 1, c[i - 1] + 1, p[i - 1] + (w[i - 1] === t[j - 1] ? 0 : 1)); if (p2 && i > 1 && w[i - 1] === t[j - 2] && w[i - 2] === t[j - 1]) v = Math.min(v, p2[i - 2] + 1); c[i] = v; }
    if (c[n] < best) best = c[n]; p2 = p; p = c; }
  return best; }
const okErr = len => len >= 8 ? 2 : len >= 5 ? 1 : 0;
async function ask(q){
  const url = "https://search.openfoodfacts.org/search?" + new URLSearchParams({q, page_size: "40", langs: "de,en", fields: FIELDS});
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
  try { const r = await fetch(url, {headers: {"User-Agent": "ChessNat/1.0 (chess-nat.vercel.app)"}, signal: ctl.signal}); return r.ok ? await r.json() : null; } finally { clearTimeout(to); }
}

module.exports = async (req, res) => {
  const q = String((req.query && req.query.q) || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (q.length < 2) return res.status(400).json({error: "Bitte mindestens 2 Buchstaben."});
  try {
    const norm = t => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u00df/g, "ss").replace(/([aou])e/g, "$1");
    const words = norm(q).split(/[^a-z0-9]+/).filter(w => w.length >= 3);
    let j = await ask(q);
    if (!j) return res.status(502).json({error: "Die Suche ist gerade nicht erreichbar."});
    /* nothing found: once more with the longer words allowed a typo or two ("nutela" → Nutella), if the search takes that */
    if (!(j.hits || []).length && words.some(w => w.length >= 5)){ const j2 = await ask(words.map(w => w.length >= 5 ? w + "~" + okErr(w.length) : w).join(" ")).catch(() => null); if (j2 && Array.isArray(j2.hits)) j = j2; }
    const seen = new Set();
    const items = (j.hits || []).map(p => {
      const n = p.nutriments || {}, k = Number(n["energy-kcal_100g"]) || (Number(n["energy_100g"]) ? Number(n["energy_100g"]) / 4.184 : 0);
      const brand = (Array.isArray(p.brands) ? p.brands[0] : String(p.brands || "").split(",")[0]) || "";
      return {code: String(p.code || ""), name: String(p.product_name_de || p.product_name || p.generic_name || "").trim().slice(0, 90), brand: String(brand).trim().slice(0, 40),
        k: Math.round(k), c: r1(n.carbohydrates_100g), pr: r1(n.proteins_100g), f: r1(n.fat_100g),
        serving: Math.round(Number(p.serving_quantity) || 0), ss: String(p.serving_size || "").slice(0, 60), pack: Math.round(Number(p.product_quantity) || 0), img: p.image_front_small_url || null,
        fi: r1(n.fiber_100g), su: r1(n.sugars_100g), sf: r1(n["saturated-fat_100g"]), sa: Math.round((Number(n.salt_100g) || 0) * 100) / 100, ns: /^[a-e]$/.test(String(p.nutriscore_grade || "").toLowerCase()) ? String(p.nutriscore_grade).toLowerCase() : "", hd: "sugars_100g" in n || "fiber_100g" in n || "saturated-fat_100g" in n ? 1 : 0,
        de: Array.isArray(p.countries_tags) && (p.countries_tags.includes("en:germany") || p.countries_tags.includes("en:austria")) ? 1 : 0};
    }).filter(x => { const key = (x.name + "|" + x.brand + "|" + x.k).toLowerCase(); if (!x.name || !(x.k > 0) || x.k > 950 || seen.has(key)) return false; seen.add(key); return true; });
    /* only what has a word of the search in its name or brand; the most words first, then products sold in Germany, then the search's own order */
    /* a word counts when it is in there, also with a typo (and with or without spaces and hyphens: "fruchtrio" fits "Frucht-Trio") */
    const hits = x => { const t = norm(x.name + " " + x.brand), tc = t.replace(/[^a-z0-9]+/g, ""); return words.filter(w => t.includes(w) || tc.includes(w) || (w.length >= 5 && near(w, tc) <= okErr(w.length))).length; };
    const out = items.map((x, i) => [x, i, words.length ? hits(x) : 1]).filter(a => a[2] > 0).sort((a, b) => b[2] - a[2] || b[0].de - a[0].de || a[1] - b[1]).map(([x]) => { delete x.de; return x; }).slice(0, 20);
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({items: out});
  } catch(e) {
    return res.status(502).json({error: "Die Suche ist gerade nicht erreichbar."});
  }
};
