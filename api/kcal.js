/* Chess.nat Kalorien-Tracker: turns what someone said ("zwei Brötchen mit Nutella und ein Kakao") into a meal
   with kcal and macros. Only signed-in Chess.nat players may call it (Supabase token is checked).
   AI via Vercel AI Gateway: env AI_KEY / AI_GATEWAY_API_KEY (vck_…) if set, otherwise this project's OIDC token.
   Models are tried in order (env GATEWAY_MODELS); a model without credit/access is skipped. */
const SUPABASE_URL = "https://zpsfdpangmvqxbkvzibb.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc2ZkcGFuZ212cXhia3Z6aWJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NDcxMTUsImV4cCI6MjEwOTEyMzExNX0.XvVXgjOsOm0DQyrWCafc-y7LUYHYiX_H6R8g5ajLJpo";
const MODELS = (process.env.GATEWAY_MODELS || "anthropic/claude-opus-5.5,google/gemini-2.5-flash,google/gemini-2.5-flash-lite").split(",").map(s => s.trim()).filter(Boolean);

const THINK = Number(process.env.KCAL_THINK || 0);
const num = {type: "number"};
const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["title", "emoji", "items", "kcal", "carbs", "protein", "fat", "minutesAgo", "note"],
  properties: {
    title: {type: "string", description: "Kurzer Name der Mahlzeit, max. 4 Wörter"},
    emoji: {type: "string", description: "Ein passendes Essens-Emoji"},
    items: {type: "array", items: {type: "object", additionalProperties: false, required: ["name", "amount", "kcal", "carbs", "protein", "fat", "fiber", "sugar", "satfat", "quality"],
      properties: {name: {type: "string"}, amount: {type: "string", description: "Menge, z. B. '2 Scheiben (80 g)'"}, kcal: num, carbs: num, protein: num, fat: num,
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
  cfg = cfg || {system: SYSTEM, schema: SCHEMA, name: "meal", user: `Jetzt ist ${berlinNow()} (Europe/Berlin).\nGesagt: „${text}“`, max: 3000, temp: .2};
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
  try { est = await ask(req, text); }
  catch(e){
    console.log("kcal ai failed", e.status, e.model, String(e.message).slice(0, 300));
    return res.status(502).json({error: e.status === 429 ? "Gerade zu viele Anfragen. Gleich nochmal versuchen." : "Die KI hat gerade nicht geantwortet. Nochmal versuchen."});
  }
  const ago = Math.max(0, Math.min(24 * 60, Number(est.minutesAgo) || 0));
  const items = (Array.isArray(est.items) ? est.items : []).slice(0, 30).map(i => ({name: String(i.name || "").slice(0, 80), amount: String(i.amount || "").slice(0, 60), kcal: Math.round(Number(i.kcal) || 0), carbs: r1(i.carbs), protein: r1(i.protein), fat: r1(i.fat),
    h: {fi: r1(i.fiber), su: r1(i.sugar), sf: r1(i.satfat), q: Math.max(1, Math.min(5, Math.round(Number(i.quality) || 3)))}}));
  const sum = k => items.reduce((s, i) => s + (Number(i[k]) || 0), 0);
  const meal = {
    title: String(est.title || "Mahlzeit").slice(0, 60), emoji: String(est.emoji || "🍽️").slice(0, 8), items,
    kcal: Math.round(items.length ? sum("kcal") : Number(est.kcal) || 0), carbs: r1(items.length ? sum("carbs") : est.carbs),
    protein: r1(items.length ? sum("protein") : est.protein), fat: r1(items.length ? sum("fat") : est.fat),
    minutesAgo: ago, note: String(est.note || "").slice(0, 300), model: est.model
  };
  return res.status(200).json({meal});
};
