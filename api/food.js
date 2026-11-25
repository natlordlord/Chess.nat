/* Chess.nat Kalorien-Tracker: product search for the "Suchen" button.
   Asks both searches of Open Food Facts (see ask / askOld) and returns a short list with the values per 100 g.
   Products sold in Germany come first. Answers are cached at the edge for a day.
   GET /api/food?q=…           → {items: [...]}
   GET /api/food?q=…&debug=1   → the same, plus how many products each question brought (not cached) */
const FIELDS = "code,product_name,product_name_de,generic_name,brands,stores,nutriments,serving_quantity,serving_size,product_quantity,image_front_small_url,countries_tags,nutriscore_grade";
const r1 = x => Math.round((Number(x) || 0) * 10) / 10;
/* forgiving like the search on the phone: how many typing errors (wrong, missing, extra or swapped letter) turn w into a piece of t */
function near(w, t){ const n = w.length; let p2 = null, p = Array.from({length: n + 1}, (_, i) => i), best = n;
  for (let j = 1; j <= t.length; j++){ const c = [0];
    for (let i = 1; i <= n; i++){ let v = Math.min(p[i] + 1, c[i - 1] + 1, p[i - 1] + (w[i - 1] === t[j - 1] ? 0 : 1)); if (p2 && i > 1 && w[i - 1] === t[j - 2] && w[i - 2] === t[j - 1]) v = Math.min(v, p2[i - 2] + 1); c[i] = v; }
    if (c[n] < best) best = c[n]; p2 = p; p = c; }
  return best; }
const okErr = len => len >= 8 ? 2 : len >= 5 ? 1 : 0;
/* answers are remembered for a while by the running function: while somebody types "croissant s", "croissant sch" … the same
   questions come again and again, and the classic search only allows a few questions a minute */
const MEM = new Map(), WHY = {};
async function get(url, ms){
  const m = MEM.get(url); if (m && Date.now() - m.at < 6e5) return m.j; if (Object.keys(WHY).length > 50) for (const k in WHY) delete WHY[k];
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, {headers: {"User-Agent": "ChessNat/1.0 (chess-nat.vercel.app)"}, signal: ctl.signal}); if (!r.ok){ WHY[url] = "HTTP " + r.status + " " + (await r.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 300); return null; } delete WHY[url];
    const j = await r.json(); if (MEM.size > 300) MEM.clear(); MEM.set(url, {at: Date.now(), j}); return j; }
  catch(e) { WHY[url] = e && e.name === "AbortError" ? "zu langsam (" + ms + " ms)" : String((e && e.message) || e); return null; } finally { clearTimeout(to); }
}
/* Open Food Facts has two searches. The new one (search.openfoodfacts.org) is fast, but only finds a product when every word typed
   is in it exactly like that (asked twice: plain, and only products sold in Germany with the most scanned first). The classic one (the search of the website itself, here the German
   site, so products sold in Germany) finds a lot more for German names. Both are asked and their answers put together. */
const U1 = (q, de) => "https://search.openfoodfacts.org/search?" + new URLSearchParams(Object.assign({q: de ? q + ' countries_tags:"en:germany"' : q, page_size: "40", langs: "de,en", fields: FIELDS}, de ? {sort_by: "-unique_scans_n"} : {}));
const U2 = q => "https://de.openfoodfacts.org/cgi/search.pl?" + new URLSearchParams({search_terms: q, search_simple: "1", action: "process", json: "1", page_size: "40", fields: FIELDS});
const ask = (q, ms) => get(U1(q), ms || 6000).then(j => j && Array.isArray(j.hits) ? j.hits : null);
/* the same, but only products sold in Germany, the most scanned first: for one word alone the plain search brings products from anywhere */
const askDE = (q, ms) => get(U1(q, 1), ms || 6000).then(j => j && Array.isArray(j.hits) ? j.hits : null);
/* the classic search turns a second question away while it is busy with the first (HTTP 503): one at a time, and once more after a moment */
let oldLine = Promise.resolve();
const askOld = (q, ms) => { const run = async () => { let j = null; for (let n = 0; n < 3 && !j; n++){ if (n) await new Promise(r => setTimeout(r, 1200)); j = await get(U2(q), ms || 8000); if (j || !/^HTTP (503|429)/.test(WHY[U2(q)] || "")) break; } return j && Array.isArray(j.products) ? j.products : null; };
  const p = oldLine.then(run, run); oldLine = p.catch(() => {}); return p; };
/* shops and filler words: nobody has "Lidl" in the product's name, so they must not keep a product out */
const SHOP = /^(lidl|aldi|rewe|edeka|penny|netto|kaufland|norma|dm|rossmann|globus|real|spar|hofer|billa|migros|coop|tegut|famila|marktkauf|nahkauf)$/;
const FILL = /^(mit|und|von|vom|der|die|das|aus|the|bio|oder|ohne|muss|marke|eigenmarke)$/;

module.exports = async (req, res) => {
  const q = String((req.query && req.query.q) || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (q.length < 2) return res.status(400).json({error: "Bitte mindestens 2 Buchstaben."});
  try {
    const norm = t => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u00df/g, "ss").replace(/[yj]og?h?o?urt/g, "joghurt").replace(/([aou])e/g, "$1");
    const words = norm(q).split(/[^a-z0-9]+/).filter(w => w.length >= 3);
    /* "Fruchtyogurt", "Jogurt": the search knows the German spelling best */
    const qs = q.replace(/[yj]og?h?o?urt/gi, m => /^[YJ]/.test(m) ? "Joghurt" : "joghurt");
    /* what has to be found: the words that describe the product (not the shop, not "mit") */
    const core = words.filter(w => !SHOP.test(w) && !FILL.test(w)), must = core.length ? core : words, shops = words.filter(w => SHOP.test(w));
    const qc = core.length && core.length < words.length ? qs.split(/\s+/).filter(w => { const n = norm(w).replace(/[^a-z0-9]/g, ""); return !SHOP.test(n) && !FILL.test(n); }).join(" ") : qs;
    const pool = [], byCode = new Set(), stat = {};
    const add = (tag, L) => { stat[tag] = L ? L.length : null; for (const p of L || []){ const c = String(p.code || ""); if (c && byCode.has(c)) continue; if (c) byCode.add(c); pool.push(p); } };
    const text = p => norm([p.product_name_de, p.product_name, p.generic_name, Array.isArray(p.brands) ? p.brands.join(" ") : p.brands, Array.isArray(p.stores) ? p.stores.join(" ") : p.stores].filter(Boolean).join(" "));
    const fits = (w, t, tc) => t.includes(w) || tc.includes(w) || (w.length >= 5 && near(w, tc) <= okErr(w.length));
    const full = () => pool.filter(p => { const t = text(p), tc = t.replace(/[^a-z0-9]+/g, ""); return must.every(w => fits(w, t, tc)); }).length;
    const long = must.slice().sort((a, b) => b.length - a.length).slice(0, 2), wide = must.length >= 2;
    const [A, D, B] = await Promise.all([ask(qs), askDE(qc), askOld(qc)]); add("de", D); add("neu", A); add("alt", B);
    if (!A && !B && !D) return res.status(502).json({error: "Die Suche ist gerade nicht erreichbar."});
    /* too little that has all the words ("Schoko Croissant" is written "Schokocroissant", "Croissant mit Schokolade" …): ask again
       without the shop, written together, and for the most telling words alone; the list below puts what fits best on top */
    if (full() < 5 && must.length){
      const more = [];
      if (qc !== qs) more.push(["neu-ohne-laden", ask(qc, 4500)]);
      if (wide){ more.push(["zusammen", askDE(must.join(""), 4500)]); for (const w of long) more.push(["de-wort-" + w, askDE(w, 4500)]); more.push(["alt-wort-" + long[0], askOld(long[0], 7000)]); }
      /* nothing at all: once more with the longer words allowed a typo or two ("nutela" → Nutella), if the search takes that */
      if (!pool.length && must.some(w => w.length >= 5)) more.push(["tippfehler", ask(must.map(w => w.length >= 5 ? w + "~" + okErr(w.length) : w).join(" "), 4500)]);
      const R = await Promise.all(more.map(m => m[1])); more.forEach((m, i) => add(m[0], R[i]));
    }
    const j = {hits: pool};
    const seen = new Set();
    const items = (j.hits || []).map(p => {
      const n = p.nutriments || {}, k = Number(n["energy-kcal_100g"]) || (Number(n["energy_100g"]) ? Number(n["energy_100g"]) / 4.184 : 0);
      const brand = (Array.isArray(p.brands) ? p.brands[0] : String(p.brands || "").split(",")[0]) || "";
      return {st: norm(Array.isArray(p.stores) ? p.stores.join(" ") : p.stores || ""), code: String(p.code || ""), name: String(p.product_name_de || p.product_name || p.generic_name || "").trim().slice(0, 90), brand: String(brand).trim().slice(0, 40),
        k: Math.round(k), c: r1(n.carbohydrates_100g), pr: r1(n.proteins_100g), f: r1(n.fat_100g),
        serving: Math.round(Number(p.serving_quantity) || 0), ss: String(p.serving_size || "").slice(0, 60), pack: Math.round(Number(p.product_quantity) || 0), img: p.image_front_small_url || null,
        fi: r1(n.fiber_100g), su: r1(n.sugars_100g), sf: r1(n["saturated-fat_100g"]), sa: Math.round((Number(n.salt_100g) || 0) * 100) / 100, ns: /^[a-e]$/.test(String(p.nutriscore_grade || "").toLowerCase()) ? String(p.nutriscore_grade).toLowerCase() : "", hd: "sugars_100g" in n || "fiber_100g" in n || "saturated-fat_100g" in n ? 1 : 0,
        de: Array.isArray(p.countries_tags) && (p.countries_tags.includes("en:germany") || p.countries_tags.includes("en:austria")) ? 1 : 0};
    }).filter(x => { const key = (x.name + "|" + x.brand + "|" + x.k).toLowerCase(); if (!x.name || !(x.k > 0) || x.k > 950 || seen.has(key)) return false; seen.add(key); return true; });
    /* only what has a word of the search in its name or brand; the most words first (a shop that was typed counts when the product is
       sold there), then products sold in Germany, then the search's own order */
    /* a word counts when it is in there, also with a typo (and with or without spaces and hyphens: "fruchtrio" fits "Frucht-Trio") */
    const hits = x => { const t = norm(x.name + " " + x.brand), tc = t.replace(/[^a-z0-9]+/g, ""); const n = must.filter(w => fits(w, t, tc)).length; return n ? n + shops.filter(w => (t + " " + x.st).includes(w)).length * .5 : 0; };
    const out = items.map((x, i) => [x, i, words.length ? hits(x) : 1]).filter(a => a[2] > 0).sort((a, b) => b[2] - a[2] || b[0].de - a[0].de || a[1] - b[1]).map(([x]) => { delete x.de; delete x.st; return x; }).slice(0, 20);
    if (req.query && req.query.debug){ res.setHeader("Cache-Control", "no-store"); return res.status(200).json({asked: stat, why: Object.fromEntries(Object.entries(WHY).map(([u, w]) => [decodeURIComponent(u.replace(/^https:\/\/([a-z]+)\.[^?]+\?(?:q|search_terms)=([^&]*).*$/, "$1: $2")), w])), items: out}); }
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({items: out});
  } catch(e) {
    return res.status(502).json({error: "Die Suche ist gerade nicht erreichbar."});
  }
};
