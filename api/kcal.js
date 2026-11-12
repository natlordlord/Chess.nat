/* Chess.nat Kalorien-Tracker: turns what someone said ("zwei Brötchen mit Nutella und ein Kakao") into a meal
   with kcal and macros. Only signed-in Chess.nat players may call it (Supabase token is checked).
   AI via Vercel AI Gateway: env AI_KEY / AI_GATEWAY_API_KEY (vck_…) if set, otherwise this project's OIDC token.
   Models are tried in order (env GATEWAY_MODELS); a model without credit/access is skipped. */
const SUPABASE_URL = "https://zpsfdpangmvqxbkvzibb.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc2ZkcGFuZ212cXhia3Z6aWJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NDcxMTUsImV4cCI6MjEwOTEyMzExNX0.XvVXgjOsOm0DQyrWCafc-y7LUYHYiX_H6R8g5ajLJpo";
const MODELS = (process.env.GATEWAY_MODELS || "anthropic/claude-opus-5.5,google/gemini-2.5-flash,google/gemini-2.5-flash-lite").split(",").map(s => s.trim()).filter(Boolean);

/* the fixed food table (data/foods.js, the same file the phone loads): for a food in it the values per 100 g come from there,
   the AI only says which food it is and how many grams. If the file is missing the AI's own numbers are used, as before. */
let FOODS = {list: [], byId: {}}; try { FOODS = require("../data/foods.js"); } catch(e) { console.log("kcal: food table not loaded", String(e && e.message)); }
const THINK = Number(process.env.KCAL_THINK || 0);
const num = {type: "number"};
const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["title", "emoji", "items", "kcal", "carbs", "protein", "fat", "minutesAgo", "note"],
  properties: {
    title: {type: "string", description: "Kurzer Name der Mahlzeit, max. 4 Wörter"},
    emoji: {type: "string", description: "Ein passendes Essens-Emoji"},
    items: {type: "array", items: {type: "object", additionalProperties: false, required: ["name", "food", "brand", "product", "amount", "grams", "ref", "state", "kcal", "carbs", "protein", "fat", "fiber", "sugar", "satfat", "quality"],
      properties: {name: {type: "string"}, food: {type: "string", description: "Name aus der Liste BEKANNT, wenn die Zutat genau dieses Lebensmittel ist, exakt so geschrieben; sonst leer"},
        brand: {type: "string", description: "Die Marke oder der Händler, den der Nutzer zu dieser Zutat genannt hat (z. B. 'Barilla', 'Aldi', 'Rewe', 'Ja', 'Milka', 'Arla'). Nichts genannt: 'none'"},
        product: {type: "string", description: "Nur wenn der Nutzer ein bestimmtes Produkt oder eine Marke nennt: Marke und Produktname, so wie man es im Supermarkt sucht (z. B. 'Barilla Pesto Genovese', 'Nutella', 'Ja Vollmilch 3,5'). Nennt er nur das Lebensmittel (Nudeln, Pesto, Milch): 'none'"},
        amount: {type: "string", description: "Menge, z. B. '2 Scheiben (80 g)'"},
        grams: {type: "number", description: "Gewicht dieser Zutat in Gramm (bei Getränken ml), so wie gegessen. Immer angeben, auch geschätzt."},
        /* no empty string in an enum: Gemini refuses the whole request then ("enum[0]: cannot be empty"), so "none" stands for "not from the table" */
        ref: {type: "string", enum: ["none"].concat(FOODS.list.map(f => f.id)), description: "Kennung aus der Liste TABELLE, wenn die Zutat genau dieses Lebensmittel ist, sonst 'none'"},
        state: {type: "string", enum: ["none", "cooked", "dry"], description: "Sonst 'none'. Nur bei Zutaten aus der TABELLE mit zwei Zuständen: bezieht sich grams auf das fertig gekochte/gebratene Gewicht ('cooked') oder auf das Trocken- bzw. Rohgewicht ('dry')?"},
        kcal: num, carbs: num, protein: num, fat: num,
        fiber: {type: "number", description: "Ballaststoffe in g"}, sugar: {type: "number", description: "Zucker in g"}, satfat: {type: "number", description: "gesättigte Fettsäuren in g"},
        quality: {type: "integer", description: "Wie gesund ist diese Zutat, 1 bis 5: 5 = Gemüse, Obst, Hülsenfrüchte, Vollkorn, Nüsse, Fisch, mageres Eiweiß (vitamin- und nährstoffreich, wenig verarbeitet); 3 = neutral (Weißbrot, Nudeln, Käse, Wurst in Maßen); 1 = Süßigkeiten, Limo, Frittiertes, Alkohol, stark Verarbeitetes"}}}},
    kcal: num, carbs: num, protein: num, fat: num,
    minutesAgo: {type: "number", description: "Wie viele Minuten her gegessen wurde, falls genannt (z. B. 'vor einer Stunde' = 60), sonst 0"},
    note: {type: "string", description: "Ein kurzer Satz, was geschätzt wurde. Leer, wenn nichts Wichtiges."}
  }
};
const SYSTEM = `Du bist der Kalorien-Schätzer in einer Tracking-App. Der Nutzer diktiert per Sprache, was er gegessen oder getrunken hat.
Die Spracherkennung macht Fehler: lies wohlwollend, was gemeint ist.
Schätze für jede Zutat realistische deutsche Portionen, wenn keine Menge genannt ist, und rechne Kalorien (kcal), Kohlenhydrate (g), Protein (g) und Fett (g) mit typischen Nährwerten (BLS/USDA).
Gib für jede Zutat außerdem Ballaststoffe, Zucker und gesättigte Fettsäuren (g) an und bewerte mit quality (1–5), wie gesund und nährstoffreich sie ist.
Die Kalorien sind das Wichtigste: realistisch, nicht zu niedrig. Getränke mit Kalorien sind eigene Zutaten.
Die Summenfelder müssen der Summe der Zutaten entsprechen. Wenn nichts Essbares erkennbar ist, gib leere items und 0 zurück und erkläre es in note.
TABELLE: Für diese Lebensmittel rechnet die App die Nährwerte selbst aus einer festen Tabelle, damit dasselbe Essen bei jedem dieselben Werte hat. Ist eine Zutat genau eines davon (auch als Teil eines Gerichts, z. B. die Nudeln in „Nudeln mit Pesto“), setze ref auf die Kennung und grams auf das Gewicht; zerlege Gerichte dafür in ihre Zutaten. Nimm ref nur, wenn es wirklich dieses Lebensmittel ist (Nudelsalat, Reiswaffeln, Milchreis, Käsekuchen sind es nicht): dann ref = "none".
${FOODS.list.map(f => f.id + " = " + f.n + (f.cf ? " (zwei Zustände: " + f.st[0] + " / " + f.st[1] + ")" : "")).join("; ")}
PRODUKT (wichtig): Nennt der Nutzer zu einer Zutat eine Marke, einen Händler oder ein bestimmtes Produkt, schreib die Marke bzw. den Händler in brand und Marke plus Produktname in product. Beispiel: „250 g Barilla Spaghetti mit Pesto alla Genovese von Aldi“ → Spaghetti: brand "Barilla", product "Barilla Spaghetti"; Pesto: brand "Aldi", product "Aldi Pesto Genovese". Weitere: „Nutella“ → brand "Nutella"; „Skyr von Arla“ → brand "Arla", product "Arla Skyr". Die App sucht dann genau dieses Produkt in Open Food Facts und nimmt dessen Werte statt der Tabelle. ref und state trotzdem setzen, wenn es zur TABELLE gehört. Erfinde keine Marke, die nicht gesagt wurde: dann product = "none".
Zustand: Nudeln, Reis, Couscous, Bulgur, Quinoa, Linsen, Kichererbsen und Bohnen werden gekocht schwerer, Fleisch wird gebraten leichter. Sagt der Nutzer „gekocht“, „gebraten“, „auf dem Teller“ oder nichts dazu, ist grams das fertige Gewicht: state = "cooked". Sagt er „trocken“, „roh“, „ungekocht“ oder nennt er das Gewicht aus der Packung, ist state = "dry". Rechne das Gewicht nie selbst um.
DATENBANK: Zusätzlich gibt es eine geprüfte Datenbank mit festen Werten pro 100 g. Ihre Namen stehen unter BEKANNT. Ist eine Zutat, die nicht in der TABELLE steht, genau eines dieser Lebensmittel (auch anders geschrieben, in der Mehrzahl oder mit Marke), setze food exakt auf diesen Namen und grams auf das echte Gewicht: die App nimmt dann die geprüften Werte. Passt keiner wirklich, bleibt food leer; erfinde keine Namen und nimm nichts nur Ähnliches.
Antworte nur mit JSON nach diesem Schema: ${JSON.stringify(SCHEMA)}`;

/* "Was soll ich kochen?": one dish from what is at home that fills the day's gap */
const COOK = {
  type: "object", additionalProperties: false,
  required: ["title", "emoji", "why", "items", "kcal", "carbs", "protein", "fat", "steps", "tip"],
  properties: {
    title: {type: "string", description: "Name des Gerichts, max. 5 Wörter"}, emoji: {type: "string"},
    why: {type: "string", description: "1–2 Sätze, warum das jetzt passt (mit den Zahlen)"},
    items: {type: "array", items: {type: "object", additionalProperties: false, required: ["name", "grams", "kcal", "carbs", "protein", "fat"],
      properties: {name: {type: "string"}, grams: {type: "number", description: "Gramm roh/trocken gewogen, so wie man es abwiegt"}, kcal: num, carbs: num, protein: num, fat: num}}},
    kcal: num, carbs: num, protein: num, fat: num,
    steps: {type: "array", items: {type: "string"}, description: "3–6 kurze Schritte"},
    tip: {type: "string", description: "Ein kurzer Tipp, leer wenn keiner"}
  }
};
const COOK_SYS = `Du bist Koch und Ernährungscoach in einer Kalorien-App (Deutsch, du-Form, locker). Der Nutzer sagt, was er gerade zu Hause hat.
Schlag genau EIN Gericht vor, das er nur aus diesen Zutaten (plus Salz, Pfeffer, Gewürze, etwas Öl) kochen kann und das die heute noch fehlenden Kalorien und Makros möglichst genau trifft.
Gib für jede Zutat die Menge in Gramm an (roh bzw. trocken gewogen, so wie man es abwiegt) und rechne die Nährwerte mit typischen Werten (BLS/USDA). Die Summen müssen stimmen.
Wenn er Gerichte nennt, die er oft isst, und eins davon passt, nimm bevorzugt so etwas. Ist die Lücke sehr groß, darf es eine große Portion sein; ist sie klein, ein Snack.
Antworte nur mit JSON nach diesem Schema: ${JSON.stringify(COOK)}`;

/* the weekly wrap-up: an honest coach's look at the last seven days, measured against the person's goal */
const WEEK = {
  type: "object", additionalProperties: false,
  required: ["headline", "mood", "summary", "good", "better", "focus"],
  properties: {
    headline: {type: "string", description: "Kurze, ehrliche Überschrift, max. 6 Wörter"},
    mood: {type: "string", enum: ["great", "ok", "bad"]},
    summary: {type: "string", description: "2–3 Sätze mit den wichtigsten Zahlen"},
    good: {type: "array", items: {type: "string"}, description: "bis zu 3 Dinge, die gut liefen"},
    better: {type: "array", items: {type: "string"}, description: "bis zu 3 konkrete Dinge für nächste Woche"},
    focus: {type: "string", description: "Ein Satz: der wichtigste Fokus für die nächste Woche"}
  }
};
const WEEK_SYS = `Du bist ein ehrlicher, direkter Ernährungscoach in einer Kalorien-App (Deutsch, du-Form, locker, kein Arzt-Ton, keine Diagnosen).
Du bekommst die Daten der letzten 7 Tage, die Ziele und was gegessen wurde. Bewerte passend zum Ziel:
Muskelaufbau/Bulken/Zunehmen: vor allem die Kalorien erreichen und genug Protein; Abnehmen: Defizit halten und trotzdem genug Protein; Halten: nah am Ziel bleiben.
Schau auch auf die Qualität anhand der Lebensmittel (viel Zucker, Süßes, Fast Food, kaum Gemüse/Obst?) und sag klar, wenn die Ernährung schlecht ist. Lob ehrlich, was gut ist.
Nutze die Zahlen (Durchschnitt, Prozent vom Ziel, Gewicht). Kurze Sätze.
Antworte nur mit JSON nach diesem Schema: ${JSON.stringify(WEEK)}`;

function readBody(req){
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") { try { return Promise.resolve(JSON.parse(req.body)); } catch(e) { return Promise.resolve({}); } }
  return new Promise(ok => { let s = ""; req.on("data", c => { s += c; }); req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch(e) { ok({}); } }); req.on("error", () => ok({})); });
}
async function userOf(req){
  const auth = String(req.headers.authorization || "");
  if (!/^Bearer .{20,}/.test(auth)) return null;
  const r = await fetch(SUPABASE_URL + "/auth/v1/user", {headers: {apikey: SUPABASE_ANON, Authorization: auth}}).catch(() => null);
  if (!r || !r.ok) return null;
  const u = await r.json().catch(() => null);
  return u && u.id ? u : null;
}
function berlinNow(){
  return new Intl.DateTimeFormat("de-DE", {timeZone: "Europe/Berlin", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"}).format(new Date());
}
async function ask(req, text, only, cfg){
  cfg = cfg || {system: SYSTEM, schema: SCHEMA, name: "meal", user: `Jetzt ist ${berlinNow()} (Europe/Berlin).\nGesagt: „${text}“`, max: 3000, temp: 0};
  const key = String(process.env.AI_GATEWAY_API_KEY || process.env.AI_KEY || "").trim();
  const token = key || req.headers["x-vercel-oidc-token"] || process.env.VERCEL_OIDC_TOKEN;
  if (!token) throw Object.assign(new Error("no ai credentials"), {status: 500});
  let last;
  for (const model of only ? [only] : MODELS){
    const r = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {method: "POST",
      headers: {"Content-Type": "application/json", Authorization: "Bearer " + token},
      body: JSON.stringify({model, max_tokens: cfg.max, temperature: cfg.temp,
        /* Gemini thinks for seconds by default; a small budget keeps the answer quick */
        ...(/^google\//.test(model) ? {providerOptions: {google: {thinkingConfig: {thinkingBudget: THINK}}}} : {}),
        response_format: {type: "json_schema", json_schema: {name: cfg.name, strict: true, schema: cfg.schema}},
        messages: [{role: "system", content: cfg.system}, {role: "user", content: cfg.user}]})
    }).catch(e => ({ok: false, status: 0, text: async () => String(e)}));
    if (r.ok){
      const j = await r.json();
      const out = String((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "").replace(/^```(json)?|```$/g, "").trim();
      try { const p = JSON.parse(out); p.model = model; return p; } catch(e) { last = Object.assign(new Error("bad json from " + model), {status: 502}); continue; }
    }
    last = Object.assign(new Error((await r.text().catch(() => "")).slice(0, 300)), {status: r.status, model});
    if (![400, 401, 402, 403, 404, 429].includes(r.status) && r.status !== 0) break;
  }
  throw last || new Error("no model");
}
/* A food from the table: the numbers are worked out here from its values per 100 g and the grams, not taken from the AI.
   Weighed cooked, the grams are first turned back into dry (or raw) weight with the food's cooking factor. */
/* the table's values come from Open Food Facts (api/foods.js, kept at the edge for a week): read them once per instance and every few hours,
   so the server calculates with exactly the numbers the phone shows. If that answer isn't there, the numbers in data/foods.js are used. */
let liveAt = 0, liveP = null;
function liveTable(req){
  if (!FOODS.apply || Date.now() - liveAt < 6 * 3600e3) return Promise.resolve();
  if (!liveP){ const host = String(req.headers["x-forwarded-host"] || req.headers.host || ""), proto = req.headers["x-forwarded-proto"] || (/^(localhost|127\.)/.test(host) ? "http" : "https");
    liveP = (host ? fetch(proto + "://" + host + "/api/foods", soon(3500)).then(r => r.ok ? r.json() : null).then(j => { if (j && FOODS.apply(j)) liveAt = Date.now(); }) : Promise.resolve()).catch(() => {}).then(() => { liveP = null; }); }
  return liveP;
}
function fromTable(it, i){
  const F = FOODS.byId && FOODS.byId[String(i.ref || "")], g = Number(i.grams);
  if (!F || !(g > 0) || g > 5000) return it;
  const cooked = !!F.cf && i.state !== "dry", f = g / 100 / (cooked ? F.cf : 1), kcal = Math.round(F.k * f);
  if (!(kcal >= 0)) return it;
  const gt = Math.round(g) + " g", st = F.cf ? (cooked ? F.st[1] : F.st[0]) : "";
  return Object.assign(it, {kcal, carbs: r1(F.c * f), protein: r1(F.p * f), fat: r1(F.f * f), h: {fi: r1(F.fi * f), su: r1(F.su * f), sf: r1(F.sf * f), q: F.q},
    /* the amount always names the grams and how it was weighed, so it can be checked and changed */
    amount: ((new RegExp("\\b" + Math.round(g) + "\\s*(g|ml)\\b").test(it.amount) ? it.amount : (it.amount ? it.amount + " · " : "") + gt) + (st && !new RegExp(st, "i").test(it.amount) ? " " + st : "")).slice(0, 60),
    ref: F.id, st: F.cf ? (cooked ? "cooked" : "dry") : undefined});
}
/* The checked food database (Supabase table kcal_foods, supabase/kcal_foods.sql): the second source next to the fixed table.
   It holds only checked values per 100 g from an official source and is read-only for the app: nothing the AI says is ever
   stored. The AI gets the names in it and only says which one a food is; the numbers then come from the row. A food that is in
   neither source keeps the AI's estimate, for this one meal only. The calls run as the signed-in person. */
const sbHead = req => ({apikey: SUPABASE_ANON, Authorization: String(req.headers.authorization || ""), "Content-Type": "application/json"});
const soon = ms => (typeof AbortSignal !== "undefined" && AbortSignal.timeout ? {signal: AbortSignal.timeout(ms)} : {});
let KNOWN = {at: 0, names: []};
async function knownFoods(req){
  if (Date.now() - KNOWN.at < Number(process.env.KCAL_KNOWN_MS || 60000)) return KNOWN.names;
  try { const r = await fetch(SUPABASE_URL + "/rest/v1/kcal_foods?select=name&order=name.asc&limit=1000", Object.assign({headers: sbHead(req)}, soon(2500)));
    if (r.ok){ const j = await r.json(); if (Array.isArray(j)) KNOWN = {at: Date.now(), names: j.map(x => String(x.name || "")).filter(Boolean)}; } } catch(e) {}
  return KNOWN.names;
}
/* A product that was named ("Barilla Spaghetti", "Nutella"): exactly that product is looked up in Open Food Facts and its own values
   per 100 g are taken, not the median of the category. All words that were said have to be in the product's name or brand; of those
   the ones sold in Germany come first, then Open Food Facts' own order. A dry pack of a food that is weighed cooked (noodles, rice …)
   is converted with the table's cooking factor. Not found: the table's value stays and the note says so. */
const pnorm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss");
async function offProduct(name){
  const FILL = /^(alla|allo|von|vom|mit|und|der|die|das|the|des|del|della|aus|bio|marke|eigenmarke)$/;
  const words = pnorm(name).split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !FILL.test(w)); if (!words.length) return null;
  const url = "https://search.openfoodfacts.org/search?" + new URLSearchParams({q: name, page_size: "30", langs: "de,en", fields: "code,product_name,product_name_de,generic_name,brands,stores,nutriments,countries_tags"});
  const r = await fetch(url, Object.assign({headers: {"User-Agent": "ChessNat/1.0 (chess-nat.vercel.app)"}}, soon(5000))); if (!r.ok) return null; const j = await r.json();
  const L = (j.hits || []).map((p, ix) => { const n = p.nutriments || {}, brand = (Array.isArray(p.brands) ? p.brands[0] : String(p.brands || "").split(",")[0]) || "";
    return {ix, code: String(p.code || ""), name: String(p.product_name_de || p.product_name || p.generic_name || "").trim().slice(0, 80), brand: String(brand).trim().slice(0, 40),
      k: Number(n["energy-kcal_100g"]) || (Number(n["energy_100g"]) ? Number(n["energy_100g"]) / 4.184 : 0), c: Number(n.carbohydrates_100g), p: Number(n.proteins_100g), f: Number(n.fat_100g),
      fi: Number(n.fiber_100g) || 0, su: Number(n.sugars_100g) || 0, sf: Number(n["saturated-fat_100g"]) || 0, sa: Number(n.salt_100g) || 0,
      st: Array.isArray(p.stores) ? p.stores.join(" ") : String(p.stores || ""),
      de: Array.isArray(p.countries_tags) && (p.countries_tags.includes("en:germany") || p.countries_tags.includes("en:austria")) ? 1 : 0}; })
    .filter(x => x.name && x.k > 0 && x.k <= 950 && [x.c, x.p, x.f].every(v => isFinite(v) && v >= 0 && v <= 100)).filter(x => { const t = pnorm(x.name + " " + x.brand + " " + x.st); return words.every(w => t.includes(w)); });
  L.sort((a, b) => b.de - a.de || a.ix - b.ix); return L[0] || null;
}
async function fromProducts(items, raw){
  const miss = [];
  await Promise.all(items.map(async (it, ix) => { const i = raw[ix] || {}, clean = v => { v = String(v || "").trim(); return /^(none|null|keine?|-)?$/i.test(v) || v.length > 80 ? "" : v; }, br = clean(i.brand), g = Number(i.grams);
    /* what to look for: the product as the AI wrote it, else the brand that was said plus the name of the ingredient */
    const asks = [clean(i.product), br ? br + " " + String(i.name || "") : ""].filter((v, k, A) => v && A.indexOf(v) === k); if (!asks.length || !(g > 0 && g <= 5000)) return;
    let P = null; for (const a of asks){ P = await offProduct(a).catch(() => null); if (P) break; }
    console.log("kcal product", JSON.stringify({asks, found: P && [P.name, P.brand, P.code, P.k]}));
    const pn = asks[0]; if (!P){ miss.push(pn); return; }
    /* a pack of something that is cooked states the dry weight: its kcal sit in the dry range of that food */
    const F = FOODS.byId && FOODS.byId[it.ref], lo = F && (F.kr ? F.kr[0] : F.k * .75), hi = F && (F.kr ? F.kr[1] : F.k * 1.25), dryPack = !!(F && F.cf && P.k >= lo && P.k <= hi), cooked = dryPack && i.state !== "dry", d = cooked ? F.cf : 1, f = g / 100 / d;
    const st = dryPack ? F.st[cooked ? 1 : 0] : "";
    Object.assign(it, {name: (P.name + (P.brand ? " (" + P.brand + ")" : "")).slice(0, 80), amount: Math.round(g) + " g" + (st ? " " + st : ""), kcal: Math.round(P.k * f), carbs: r1(P.c * f), protein: r1(P.p * f), fat: r1(P.f * f),
      h: {fi: r1(P.fi * f), su: r1(P.su * f), sf: r1(P.sf * f), sa: Math.round(P.sa * f * 100) / 100, q: it.h.q}, code: P.code || null, g: Math.round(g * 10) / 10, st: dryPack ? (cooked ? "cooked" : "dry") : undefined,
      /* the same shape the phone gives a scanned product, so the amount can be changed later with these values per 100 g */
      per: Object.assign({n: P.name, b: P.brand, k: P.k / d, c: P.c / d, pr: P.p / d, f: P.f / d, s: 0, pk: 0, img: null, ss: "", fi: P.fi / d, su: P.su / d, sf: P.sf / d, sa: P.sa / d, ns: "", hd: 1}, dryPack ? {ck: cooked ? "cooked" : "dry", cf: F.cf} : {})}); }));
  return miss;
}
async function fromChecked(req, items, raw){
  const todo = [];
  items.forEach((it, ix) => { const i = raw[ix] || {}, g = Number(i.grams), name = String(i.food || "").trim(); if (it.ref || it.code || !(g > 0 && g <= 5000) || name.length < 2 || name.length > 60) return; todo.push({ix, g, name}); });
  if (!todo.length) return;
  try { const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/kcal_foods_lookup", Object.assign({method: "POST", headers: sbHead(req), body: JSON.stringify({names: todo.map(t => t.name)})}, soon(4000)));
    if (!r.ok){ console.log("kcal foods: lookup failed", r.status, (await r.text().catch(() => "")).slice(0, 200)); return; }
    const rows = await r.json(); if (!Array.isArray(rows)) return;
    todo.forEach((t, n) => { const F = rows[n]; if (!F || !(Number(F.k) >= 0)) return; const f = t.g / 100, it = items[t.ix];
      Object.assign(it, {kcal: Math.round(F.k * f), carbs: r1(F.c * f), protein: r1(F.p * f), fat: r1(F.f * f), h: {fi: r1(F.fi * f), su: r1(F.su * f), sf: r1(F.sf * f), q: Number(F.q) || it.h.q}, food: String(F.key)}); });
  } catch(e) { console.log("kcal foods: not reachable", String(e && e.message).slice(0, 120)); }
}
const SELFTEST_HASH = "1e09bcb6a579162e0bd707a6b896a71c9034ab0e2e9d5f409f480a590774375d";
const r1 = n => Math.round((Number(n) || 0) * 10) / 10;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  /* owner health check: GET /api/kcal?selftest=<secret> (only its hash lives here) */
  if (req.method === "GET" && req.query && req.query.selftest && require("crypto").createHash("sha256").update(String(req.query.selftest)).digest("hex") === SELFTEST_HASH){
    const t0 = Date.now(); try { return res.status(200).json({ok: true, ms: 0, est: await ask(req, req.query.text || "Zwei Brötchen mit Nutella und ein Kakao", req.query.model), t: Date.now() - t0}); }
    catch(e) { return res.status(200).json({ok: false, status: e.status, error: String(e.message).slice(0, 400), t: Date.now() - t0}); }
  }
  if (req.method !== "POST") return res.status(405).json({error: "POST only"});
  const user = await userOf(req);
  if (!user) return res.status(401).json({error: "Bitte anmelden."});
  const b = await readBody(req);
  const fail = e => { console.log("kcal ai failed", b.mode || "meal", e.status, e.model, String(e.message).slice(0, 300)); return res.status(502).json({error: e.status === 429 ? "Gerade zu viele Anfragen. Gleich nochmal versuchen." : "Die KI hat gerade nicht geantwortet. Nochmal versuchen."}); };
  const clip = (v, n) => String(v == null ? "" : v).slice(0, n);
  /* the shopping list: free text (typed or dictated) becomes products and dishes with what they need */
  if (b.mode === "shop"){
    const text = clip(b.text, 600).trim(); if (text.length < 2) return res.status(400).json({error: "Schreib oder sag kurz, was fehlt."});
    const line = {type: "object", additionalProperties: false, required: ["name", "amount"], properties: {name: {type: "string", description: "Produkt, so wie es im Supermarkt heißt"}, amount: {type: "string", description: "Menge, z. B. '2 Liter', '500 g'; leer, wenn keine genannt und keine sinnvoll"}}};
    const SHOP = {type: "object", additionalProperties: false, required: ["products", "dishes"], properties: {products: {type: "array", items: line, description: "einzelne Produkte, die gekauft werden sollen"},
      dishes: {type: "array", items: {type: "object", additionalProperties: false, required: ["name", "items"], properties: {name: {type: "string"}, items: {type: "array", items: line, description: "Zutaten zum Einkaufen für 2 Personen, ohne Salz, Pfeffer, Wasser, Öl"}}}}}};
    try { const o = await ask(req, "", null, {system: "Du füllst eine gemeinsame Einkaufsliste. Der Text ist getippt oder diktiert (Spracherkennung macht Fehler: lies wohlwollend). Trenne: einzelne Produkte (Milch, Eier) kommen in products. Wünscht jemand ein Gericht oder will etwas kochen oder backen (Lasagne, Chili, Kuchen), kommt es in dishes. Nennt er selbst, was er dafür braucht („dafür brauche ich …“), sind genau das die Zutaten dieses Gerichts und stehen NICHT zusätzlich in products; nennt er keine, trag die üblichen Zutaten ein. Nichts erfinden, was nicht gemeint ist. Antworte auf Deutsch.", schema: SHOP, name: "shop", user: text, max: 1500, temp: .2});
      const ln = i => ({name: clip(i && i.name, 100).trim(), amount: clip(i && i.amount, 50).trim()});
      return res.status(200).json({products: (Array.isArray(o.products) ? o.products : []).slice(0, 30).map(ln).filter(x => x.name),
        dishes: (Array.isArray(o.dishes) ? o.dishes : []).slice(0, 8).map(d => ({name: clip(d.name, 80).trim(), items: (Array.isArray(d.items) ? d.items : []).slice(0, 20).map(ln).filter(x => x.name)})).filter(d => d.name)});
    } catch(e) { return fail(e); }
  }
  /* a photo of the nutrition table on a pack: the printed numbers per 100 g are read off, nothing is estimated.
     What cannot be read stays empty (-1); a picture without a nutrition table is turned down. The phone shows the numbers
     next to the photo and only the person's "Stimmt" keeps them. */
  if (b.mode === "label"){
    const img = String(b.img || ""); if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(img) || img.length > 3500000) return res.status(400).json({error: "Das Foto konnte nicht gelesen werden."});
    const n = {type: "number"}, LABEL = {type: "object", additionalProperties: false, required: ["readable", "name", "brand", "unit", "kcal", "kj", "fat", "satfat", "carbs", "sugar", "fiber", "protein", "salt"],
      properties: {readable: {type: "boolean", description: "true nur, wenn eine Nährwerttabelle mit Angaben pro 100 g oder 100 ml zu sehen und lesbar ist"},
        name: {type: "string", description: "Produktname, nur wenn er auf dem Foto gedruckt steht; sonst leer"}, brand: {type: "string", description: "Marke, nur wenn auf dem Foto gedruckt; sonst leer"},
        unit: {type: "string", enum: ["g", "ml"]}, kcal: n, kj: n, fat: n, satfat: n, carbs: n, sugar: n, fiber: n, protein: n, salt: n}};
    const sys = "Du liest die Nährwerttabelle von einem Foto einer Lebensmittelpackung ab. Gib NUR die gedruckten Zahlen aus der Spalte „pro 100 g“ bzw. „pro 100 ml“ wieder (nicht pro Portion, nicht % Tagesbedarf). Schätze nichts und rechne nichts um: Ein Wert, der nicht dasteht oder nicht sicher lesbar ist, ist -1. Komma ist Dezimaltrennzeichen. „<0,5“ wird 0.5, „Spuren“ wird 0. kcal und kJ getrennt, so wie gedruckt. Ist keine Nährwerttabelle pro 100 g/ml zu erkennen oder das Foto zu unscharf: readable=false und alle Zahlen -1.";
    try { const o = await ask(req, "", null, {system: sys, schema: LABEL, name: "label", user: [{type: "text", text: "Lies die Nährwerte pro 100 g/ml von diesem Foto ab."}, {type: "image_url", image_url: {url: img}}], max: 600, temp: 0});
      const v = x => { x = Number(x); return isFinite(x) && x >= 0 ? Math.round(x * 10) / 10 : null; };
      let k = v(o.kcal); const kj = v(o.kj), c = v(o.carbs), p = v(o.protein), f = v(o.fat);
      /* only kJ printed: that is the same printed number in another unit (1 kcal = 4.184 kJ), not an estimate */
      if (k == null && kj != null) k = Math.round(kj / 4.184);
      if (!o.readable || k == null || c == null || p == null || f == null || k > 900 || c > 100 || p > 100 || f > 100 || c + p + f > 101)
        return res.status(200).json({ok: false, error: "Die Nährwerte waren nicht sicher zu lesen. Halte die Tabelle gerade, nah und ohne Spiegelung ins Bild."});
      const fi = v(o.fiber) || 0, calc = 4 * c + 4 * p + 9 * f + 2 * fi;
      return res.status(200).json({ok: true, label: {name: clip(o.name, 80).trim(), brand: clip(o.brand, 40).trim(), unit: o.unit === "ml" ? "ml" : "g", k: Math.round(k), c, p, f, fi, su: Math.min(c, v(o.sugar) || 0), sf: Math.min(f, v(o.satfat) || 0), sa: v(o.salt) || 0,
        /* what is not printed on the pack is not shown as a number */
        none: ["fiber", "sugar", "satfat", "salt"].filter(key => v(o[key]) == null).map(key => ({fiber: "fi", sugar: "su", satfat: "sf", salt: "sa"})[key]),
        /* the printed energy and the printed macros should fit together; if not, something was probably misread */
        odd: Math.abs(calc - k) > Math.max(30, k * .2)}});
    } catch(e) { return fail(e); }
  }
  if (b.mode === "cook"){
    const have = clip(b.have, 800).trim(); if (have.length < 3) return res.status(400).json({error: "Schreib kurz, was du da hast."});
    const m = b.missing || {}, usual = (Array.isArray(b.usual) ? b.usual : []).slice(0, 12).map(x => clip(x, 60)).join(", ");
    const user = `Jetzt ist ${berlinNow()}.\nIch habe zu Hause: ${have}\nHeute fehlen noch: ${Math.round(+m.kcal || 0)} kcal, ${Math.round(+m.protein || 0)} g Protein, ${Math.round(+m.carbs || 0)} g Kohlenhydrate, ${Math.round(+m.fat || 0)} g Fett.\nMein Ziel: ${clip(b.aim, 40) || "unbekannt"}.${usual ? "\nDas esse ich oft: " + usual : ""}`;
    try { const o = await ask(req, "", null, {system: COOK_SYS, schema: COOK, name: "dish", user, max: 2500, temp: .5});
      const items = (Array.isArray(o.items) ? o.items : []).slice(0, 15).map(i => ({name: clip(i.name, 60), grams: Math.round(Number(i.grams) || 0), kcal: Math.round(Number(i.kcal) || 0), carbs: r1(i.carbs), protein: r1(i.protein), fat: r1(i.fat)}));
      const sum = k => items.reduce((s, i) => s + (Number(i[k]) || 0), 0);
      return res.status(200).json({dish: {title: clip(o.title, 60), emoji: clip(o.emoji || "🍳", 8), why: clip(o.why, 300), items, kcal: Math.round(sum("kcal")), carbs: r1(sum("carbs")), protein: r1(sum("protein")), fat: r1(sum("fat")),
        steps: (Array.isArray(o.steps) ? o.steps : []).slice(0, 8).map(x => clip(x, 200)), tip: clip(o.tip, 200)}});
    } catch(e) { return fail(e); }
  }
  if (b.mode === "week"){
    const d = b.data || {}, user = `Daten der Woche (JSON): ${JSON.stringify(d).slice(0, 6000)}`;
    try { const o = await ask(req, "", null, {system: WEEK_SYS, schema: WEEK, name: "week", user, max: 1500, temp: .4});
      return res.status(200).json({week: {headline: clip(o.headline, 80), mood: ["great", "ok", "bad"].includes(o.mood) ? o.mood : "ok", summary: clip(o.summary, 500),
        good: (o.good || []).slice(0, 3).map(x => clip(x, 200)), better: (o.better || []).slice(0, 3).map(x => clip(x, 200)), focus: clip(o.focus, 240)}});
    } catch(e) { return fail(e); }
  }
  const text = String(b.text || "").trim().slice(0, 1500);
  if (!text) return res.status(400).json({error: "Nichts zu rechnen."});
  let est;
  const known = await knownFoods(req);
  try { est = await ask(req, text, null, {system: SYSTEM, schema: SCHEMA, name: "meal", user: `Jetzt ist ${berlinNow()} (Europe/Berlin).\nBEKANNT: ${known.join("; ").slice(0, 12000) || "(leer)"}\nGesagt: „${text}“`, max: 3000, temp: 0}); }
  catch(e){
    console.log("kcal ai failed", e.status, e.model, String(e.message).slice(0, 300));
    return res.status(502).json({error: e.status === 429 ? "Gerade zu viele Anfragen. Gleich nochmal versuchen." : "Die KI hat gerade nicht geantwortet. Nochmal versuchen."});
  }
  const ago = Math.max(0, Math.min(24 * 60, Number(est.minutesAgo) || 0));
  await liveTable(req);
  const items = (Array.isArray(est.items) ? est.items : []).slice(0, 30).map(i => {
    const it = {name: String(i.name || "").slice(0, 80), amount: String(i.amount || "").slice(0, 60), kcal: Math.round(Number(i.kcal) || 0), carbs: r1(i.carbs), protein: r1(i.protein), fat: r1(i.fat),
      h: {fi: r1(i.fiber), su: r1(i.sugar), sf: r1(i.satfat), q: Math.max(1, Math.min(5, Math.round(Number(i.quality) || 3)))}};
    return fromTable(it, i); });
  const pmiss = await fromProducts(items, (Array.isArray(est.items) ? est.items : []).slice(0, 30)).catch(() => []);
  await fromChecked(req, items, (Array.isArray(est.items) ? est.items : []).slice(0, 30));
  const sum = k => items.reduce((s, i) => s + (Number(i[k]) || 0), 0);
  const meal = {
    title: String(est.title || "Mahlzeit").slice(0, 60), emoji: String(est.emoji || "🍽️").slice(0, 8), items,
    kcal: Math.round(items.length ? sum("kcal") : Number(est.kcal) || 0), carbs: r1(items.length ? sum("carbs") : est.carbs),
    protein: r1(items.length ? sum("protein") : est.protein), fat: r1(items.length ? sum("fat") : est.fat),
    minutesAgo: ago, note: ((pmiss.length ? "„" + pmiss.join("“, „") + "“ nicht in Open Food Facts gefunden, dafür der allgemeine Wert. " : "") + String(est.note || "")).slice(0, 300), model: est.model
  };
  return res.status(200).json({meal});
};
