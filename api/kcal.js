/* Chess.nat Kalorien-Tracker: turns what someone said ("zwei Brötchen mit Nutella und ein Kakao") into a meal
   with kcal and macros. Only signed-in Chess.nat players may call it (Supabase token is checked).
   AI via Vercel AI Gateway: env AI_KEY / AI_GATEWAY_API_KEY (vck_…) if set, otherwise this project's OIDC token.
   Models are tried in order (env GATEWAY_MODELS); a model without credit/access is skipped. */
const SUPABASE_URL = "https://zpsfdpangmvqxbkvzibb.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc2ZkcGFuZ212cXhia3Z6aWJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NDcxMTUsImV4cCI6MjEwOTEyMzExNX0.XvVXgjOsOm0DQyrWCafc-y7LUYHYiX_H6R8g5ajLJpo";
const MODELS = (process.env.GATEWAY_MODELS || "anthropic/claude-opus-5.5,google/gemini-2.5-flash,google/gemini-2.5-flash-lite").split(",").map(s => s.trim()).filter(Boolean);

const num = {type: "number"};
const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["title", "emoji", "items", "kcal", "carbs", "protein", "fat", "minutesAgo", "note"],
  properties: {
    title: {type: "string", description: "Kurzer Name der Mahlzeit, max. 4 Wörter"},
    emoji: {type: "string", description: "Ein passendes Essens-Emoji"},
    items: {type: "array", items: {type: "object", additionalProperties: false, required: ["name", "amount", "kcal", "carbs", "protein", "fat"],
      properties: {name: {type: "string"}, amount: {type: "string", description: "Menge, z. B. '2 Scheiben (80 g)'"}, kcal: num, carbs: num, protein: num, fat: num}}},
    kcal: num, carbs: num, protein: num, fat: num,
    minutesAgo: {type: "number", description: "Wie viele Minuten her gegessen wurde, falls genannt (z. B. 'vor einer Stunde' = 60), sonst 0"},
    note: {type: "string", description: "Ein kurzer Satz, was geschätzt wurde. Leer, wenn nichts Wichtiges."}
  }
};
const SYSTEM = `Du bist der Kalorien-Schätzer in einer Tracking-App. Der Nutzer diktiert per Sprache, was er gegessen oder getrunken hat.
Die Spracherkennung macht Fehler: lies wohlwollend, was gemeint ist.
Schätze für jede Zutat realistische deutsche Portionen, wenn keine Menge genannt ist, und rechne Kalorien (kcal), Kohlenhydrate (g), Eiweiß (g) und Fett (g) mit typischen Nährwerten (BLS/USDA).
Die Kalorien sind das Wichtigste: realistisch, nicht zu niedrig. Getränke mit Kalorien sind eigene Zutaten.
Die Summenfelder müssen der Summe der Zutaten entsprechen. Wenn nichts Essbares erkennbar ist, gib leere items und 0 zurück und erkläre es in note.
Antworte nur mit JSON nach diesem Schema: ${JSON.stringify(SCHEMA)}`;

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
async function ask(req, text, only){
  const key = String(process.env.AI_GATEWAY_API_KEY || process.env.AI_KEY || "").trim();
  const token = key || req.headers["x-vercel-oidc-token"] || process.env.VERCEL_OIDC_TOKEN;
  if (!token) throw Object.assign(new Error("no ai credentials"), {status: 500});
  let last;
  for (const model of only ? [only] : MODELS){
    const r = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {method: "POST",
      headers: {"Content-Type": "application/json", Authorization: "Bearer " + token},
      body: JSON.stringify({model, max_tokens: 3000, temperature: 0.2,
        response_format: {type: "json_schema", json_schema: {name: "meal", strict: true, schema: SCHEMA}},
        messages: [{role: "system", content: SYSTEM}, {role: "user", content: `Jetzt ist ${berlinNow()} (Europe/Berlin).\nGesagt: „${text}“`}]})
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
  const text = String(b.text || "").trim().slice(0, 1500);
  if (!text) return res.status(400).json({error: "Nichts zu rechnen."});
  let est;
  try { est = await ask(req, text); }
  catch(e){
    console.log("kcal ai failed", e.status, e.model, String(e.message).slice(0, 300));
    return res.status(502).json({error: e.status === 429 ? "Gerade zu viele Anfragen. Gleich nochmal versuchen." : "Die KI hat gerade nicht geantwortet. Nochmal versuchen."});
  }
  const ago = Math.max(0, Math.min(24 * 60, Number(est.minutesAgo) || 0));
  const items = (Array.isArray(est.items) ? est.items : []).slice(0, 30).map(i => ({name: String(i.name || "").slice(0, 80), amount: String(i.amount || "").slice(0, 60), kcal: Math.round(Number(i.kcal) || 0), carbs: r1(i.carbs), protein: r1(i.protein), fat: r1(i.fat)}));
  const sum = k => items.reduce((s, i) => s + (Number(i[k]) || 0), 0);
  const meal = {
    title: String(est.title || "Mahlzeit").slice(0, 60), emoji: String(est.emoji || "🍽️").slice(0, 8), items,
    kcal: Math.round(items.length ? sum("kcal") : Number(est.kcal) || 0), carbs: r1(items.length ? sum("carbs") : est.carbs),
    protein: r1(items.length ? sum("protein") : est.protein), fat: r1(items.length ? sum("fat") : est.fat),
    minutesAgo: ago, note: String(est.note || "").slice(0, 300), model: est.model
  };
  return res.status(200).json({meal});
};
