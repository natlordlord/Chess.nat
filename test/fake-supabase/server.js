#!/usr/bin/env node
/* Chess.nat test stand-in ("Attrappe") for Supabase. One process, no dependencies:
     node test/fake-supabase/server.js          → http://localhost:4173
   It serves the app from this repository and answers everything the app asks Supabase for, from memory:
     /auth/v1      sign in, sign up, session refresh, user (GoTrue)
     /rest/v1      tables and rpc (PostgREST) with the real columns, checks and row level security
     /realtime/v1  live changes, broadcast and presence over WebSocket
     /storage/v1   file uploads
     /api/kcal, /api/food   the real Vercel functions from api/, with the AI and Open Food Facts replaced by fixed answers
   /config.js is replaced so the app talks to this server instead of the real project. Nothing here touches real data.
   Test helpers live under /__fake (see README.md). */
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const {DB} = require("./db");
const ROOT = path.resolve(__dirname, "..", ".."), PORT = Number(process.env.PORT || 4173);
process.env.AI_KEY = process.env.AI_KEY || "fake";

let db, stored, sockets = new Set(), delay = Number(process.env.FAKE_DELAY || 0);
function reset(){ db = new DB({pending: process.env.FAKE_PENDING === "1" || reset.pending}); stored = new Map(); require("./seed")(db); db.onChange(pgChange); sockets.forEach(s => s.close()); }

/* ---------- sign-in ---------- */
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = (u, ttl = 3600) => b64({alg: "HS256", typ: "JWT"}) + "." + b64({sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + ttl, iat: Math.floor(Date.now() / 1000)}) + ".fake";
const uidOf = auth => { try { const p = JSON.parse(Buffer.from(String(auth || "").replace(/^Bearer /, "").split(".")[1], "base64url").toString()); return p.role === "authenticated" && p.exp * 1000 > Date.now() && db.users.some(u => u.id === p.sub) ? p.sub : null; } catch(e) { return null; } };
const userJSON = u => ({id: u.id, aud: "authenticated", role: "authenticated", email: u.email, email_confirmed_at: u.created_at, phone: "", confirmed_at: u.created_at, last_sign_in_at: new Date().toISOString(),
  app_metadata: {provider: "email", providers: ["email"]}, user_metadata: {}, identities: [], created_at: u.created_at, updated_at: u.created_at, is_anonymous: false});
const session = u => ({access_token: token(u), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "r-" + u.id, user: userJSON(u)});
function auth(method, p, q, body, headers){
  const bad = (status, code, msg) => ({status, body: {code: status, error_code: code, msg}});
  if (p === "token" && q.get("grant_type") === "password"){ const u = db.users.find(x => x.email === String(body.email || "").toLowerCase() && x.password === body.password); return u ? {status: 200, body: session(u)} : bad(400, "invalid_credentials", "Invalid login credentials"); }
  if (p === "token" && q.get("grant_type") === "refresh_token"){ const u = db.users.find(x => "r-" + x.id === body.refresh_token); return u ? {status: 200, body: session(u)} : bad(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found"); }
  if (p === "user"){ const u = db.users.find(x => x.id === uidOf(headers.authorization)); if (!u) return bad(401, "bad_jwt", "invalid JWT"); if (method === "PUT" && body.password) u.password = body.password; return {status: 200, body: userJSON(u)}; }
  if (p === "signup"){ const email = String(body.email || "").toLowerCase(); if (!/.+@.+\..+/.test(email)) return bad(400, "validation_failed", "Unable to validate email address: invalid format");
    if (String(body.password || "").length < 6) return bad(422, "weak_password", "Password should be at least 6 characters.");
    let u = db.users.find(x => x.email === email); if (!u){ u = {id: crypto.randomUUID(), email, password: body.password, created_at: new Date().toISOString()}; db.users.push(u); }
    /* like the real project: the email has to be confirmed first, so no session comes back */
    return {status: 200, body: process.env.FAKE_AUTOCONFIRM === "1" ? session(u) : Object.assign(userJSON(u), {email_confirmed_at: undefined, confirmation_sent_at: new Date().toISOString()})}; }
  if (p === "logout") return {status: 204, body: null};
  if (p === "recover" || p === "resend" || p === "otp") return {status: 200, body: {}};
  return bad(404, "not_found", "no such auth route in the fake: " + p);
}

/* ---------- realtime (Phoenix channels over a hand-written WebSocket) ---------- */
function wsAccept(req, sock){
  const key = req.headers["sec-websocket-key"]; sock.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64") + "\r\n\r\n");
  let buf = Buffer.alloc(0), frag = [];
  const s = {topics: new Map(), send(o){ if (sock.destroyed) return; const d = Buffer.from(JSON.stringify(o)), n = d.length, h = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x81, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; })()]); sock.write(Buffer.concat([h, d])); },
    close(){ try { sock.destroy(); } catch(e) {} }};
  sockets.add(s);
  const gone = () => { if (!sockets.delete(s)) return; [...s.topics.keys()].forEach(t => leave(s, t)); };
  sock.on("close", gone); sock.on("error", gone);
  sock.on("data", chunk => { buf = Buffer.concat([buf, chunk]);
    for (;;){ if (buf.length < 2) return; const fin = buf[0] & 0x80, op = buf[0] & 15, masked = buf[1] & 0x80; let n = buf[1] & 127, o = 2;
      if (n === 126){ if (buf.length < 4) return; n = buf.readUInt16BE(2); o = 4; } else if (n === 127){ if (buf.length < 10) return; n = Number(buf.readBigUInt64BE(2)); o = 10; }
      const m = masked ? 4 : 0; if (buf.length < o + m + n) return; const data = Buffer.from(buf.subarray(o + m, o + m + n)); if (masked) for (let i = 0; i < n; i++) data[i] ^= buf[o + (i & 3)];
      buf = buf.subarray(o + m + n);
      if (op === 8){ sock.end(Buffer.from([0x88, 0])); return; } if (op === 9){ sock.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; } if (op === 10) continue;
      frag.push(data); if (!fin) continue; const text = Buffer.concat(frag).toString(); frag = [];
      try { onMsg(s, JSON.parse(text)); } catch(e) { console.error("realtime message failed", e); } } });
}
const peers = topic => [...sockets].filter(x => x.topics.has(topic));
function leave(s, topic){ const t = s.topics.get(topic); if (!t) return; s.topics.delete(topic);
  if (t.tracked) peers(topic).forEach(x => x.send({topic, event: "presence_diff", payload: {joins: {}, leaves: {[t.key]: {metas: [t.tracked]}}}, ref: null})); }
let pgId = 0;
function onMsg(s, m){
  const {topic, event, payload = {}, ref} = m, ok = (response = {}) => s.send({topic, event: "phx_reply", payload: {status: "ok", response}, ref});
  if (topic === "phoenix") return ok();
  if (event === "phx_join"){
    const cfg = payload.config || {}, uid = uidOf("Bearer " + (payload.access_token || ""));
    const binds = (cfg.postgres_changes || []).map(b => Object.assign({id: ++pgId}, b));
    s.topics.set(topic, {uid, binds, self: !!(cfg.broadcast && cfg.broadcast.self), key: (cfg.presence && cfg.presence.key) || crypto.randomUUID(), tracked: null});
    ok({postgres_changes: binds});
    const state = {}; peers(topic).forEach(x => { const t = x.topics.get(topic); if (t.tracked) state[t.key] = {metas: [t.tracked]}; });
    s.send({topic, event: "presence_state", payload: state, ref: null});
    if (binds.length) s.send({topic, event: "system", payload: {channel: topic.replace(/^realtime:/, ""), extension: "postgres_changes", message: "Subscribed to PostgreSQL", status: "ok"}, ref: null});
    return;
  }
  const t = s.topics.get(topic); if (!t) return;
  if (event === "phx_leave"){ leave(s, topic); ok(); return s.send({topic, event: "phx_close", payload: {}, ref}); }
  if (event === "access_token"){ t.uid = uidOf("Bearer " + (payload.access_token || "")); return; }
  if (event === "broadcast"){ peers(topic).forEach(x => { if (x !== s || t.self) x.send({topic, event: "broadcast", payload, ref: null}); }); return ok(); }
  if (event === "presence"){
    if (payload.event === "track"){ const was = t.tracked; t.tracked = Object.assign({phx_ref: crypto.randomBytes(6).toString("base64")}, payload.payload || {});
      peers(topic).forEach(x => x.send({topic, event: "presence_diff", payload: {joins: {[t.key]: {metas: [t.tracked]}}, leaves: was ? {[t.key]: {metas: [was]}} : {}}, ref: null})); }
    if (payload.event === "untrack" && t.tracked){ const was = t.tracked; t.tracked = null; peers(topic).forEach(x => x.send({topic, event: "presence_diff", payload: {joins: {}, leaves: {[t.key]: {metas: [was]}}}, ref: null})); }
    return ok();
  }
}
/* a row changed: tell every channel that listens to that table, if its filter matches and the listener may read the row.
   Like the real project (replica identity default): UPDATE and DELETE carry only the primary key as the old row,
   and a DELETE can only be matched against a filter on a primary-key column. */
function pgChange({table, type, row, old, pk, cols}){
  const columns = Object.keys(cols).map(name => ({name, type: cols[name].type})), oldPk = old ? Object.fromEntries(pk.map(k => [k, old[k]])) : undefined;
  const data = {schema: "public", table, commit_timestamp: new Date().toISOString(), type, columns, errors: null};
  if (type !== "DELETE") data.record = row; if (type !== "INSERT") data.old_record = oldPk;
  const matches = f => { if (!f) return true; const m = /^(\w+)=(eq|neq|in)\.(.*)$/.exec(f); if (!m) return false; const src = type === "DELETE" ? oldPk : row; if (!(m[1] in src)) return false;
    const v = String(src[m[1]]); return m[2] === "eq" ? v === m[3] : m[2] === "neq" ? v !== m[3] : m[3].replace(/^\(|\)$/g, "").split(",").includes(v); };
  /* after the request has been answered, like the real thing (the change arrives a moment later) */
  setTimeout(() => sockets.forEach(s => s.topics.forEach((t, topic) => {
    const ids = t.binds.filter(b => b.schema === "public" && b.table === table && (b.event === "*" || b.event === type) && matches(b.filter)).map(b => b.id);
    if (!ids.length) return; if (type !== "DELETE" && !db.can(table, "select", row, t.uid)) return;
    s.send({topic, event: "postgres_changes", payload: {ids, data}, ref: null});
  })), 30 + delay);
}

/* ---------- the real Vercel functions, with the outside world replaced ---------- */
const FOODS = [["4000000000017", "Vollmilch 3,5 %", "Weihenstephan", 64, 4.8, 3.3, 3.5, 0, "250 ml", 250, 1000], ["4000000000024", "Bananen", "", 93, 20, 1, .3, 2, "1 Stück (120 g)", 120, 0], ["4000000000031", "Eier Größe M", "Landliebe", 137, 1.5, 11.9, 9.3, 0, "1 Ei (58 g)", 58, 580],
  ["4000000000048", "Weizenbrötchen", "Golden Toast", 277, 55, 9, 1.8, 3, "1 Brötchen (60 g)", 60, 0], ["4000000000055", "Haferflocken zart", "Kölln", 361, 56, 14, 6.7, 11, "40 g", 40, 500], ["4000000000062", "Skyr Natur", "Arla", 63, 4, 11, .2, 0, "150 g", 150, 450],
  ["4000000000079", "Nutella", "Ferrero", 539, 57.5, 6.3, 30.9, 0, "15 g", 15, 450], ["4000000000086", "Hähnchenbrustfilet", "Wiesenhof", 106, 0, 24, 1, 0, "", 0, 400],
  ["4000000000093", "Spaghetti No. 5", "Barilla", 359, 71.2, 12.5, 2, 3, "80 g", 80, 500], ["4000000000109", "Basmati Reis", "Oryza", 349, 77, 8, .7, 1, "62,5 g", 62.5, 500], ["4000000000116", "Reiswaffeln", "Alnatura", 385, 81, 8, 2.8, 3, "1 Stück (7 g)", 7, 100]];
const offHit = f => ({code: f[0], product_name: f[1], product_name_de: f[1], brands: f[2], nutriments: {"energy-kcal_100g": f[3], carbohydrates_100g: f[4], proteins_100g: f[5], fat_100g: f[6], fiber_100g: f[7], sugars_100g: Math.round(f[4] * .4), "saturated-fat_100g": Math.round(f[6] * 4) / 10, salt_100g: .1},
  serving_quantity: f[9], serving_size: f[8], product_quantity: f[10], image_front_small_url: null, countries_tags: ["en:germany"], nutriscore_grade: f[3] > 400 ? "e" : f[3] > 200 ? "c" : "a"});
function ai(req){
  const kind = req.response_format.json_schema.name, c0 = req.messages[1].content, photo = Array.isArray(c0) && c0.some(x => x && x.type === "image_url");
  const user = Array.isArray(c0) ? c0.filter(x => x && x.type === "text").map(x => x.text).join("\n") : c0, said = (/Gesagt: „([\s\S]*)“/.exec(user) || [0, user])[1];
  const it = (name, amount, kcal, carbs, protein, fat) => ({name, amount, grams: 0, brand: "none", product: "none", ref: "", state: "", kcal, carbs, protein, fat, fiber: 2, sugar: Math.round(carbs * .3), satfat: Math.round(fat * .4), quality: kcal > 300 ? 2 : 4});
  /* a photographed nutrition table: the numbers "printed" on the test pack */
  if (kind === "label") return {readable: true, name: "Skyr Vanille", brand: "Milbona", unit: "g", kcal: 76, kj: 322, fat: 0.2, satfat: 0.1, carbs: 9.4, sugar: 9.1, fiber: -1, protein: 9.0, salt: 0.13};
  if (kind === "shop"){ const words = said.split(/,| und /).map(s => s.trim()).filter(Boolean), dish = words.filter(w => /lasagne|chili|kuchen|pizza/i.test(w));
    return {products: words.filter(w => !dish.includes(w)).map(w => { const m = /^(\d+\s*(?:l|liter|g|kg|stück|x)?)\s+(.+)$/i.exec(w); return {name: m ? m[2] : w, amount: m ? m[1] : ""}; }),
      dishes: dish.map(d => ({name: d, items: [{name: "Hackfleisch", amount: "500 g"}, {name: "Passierte Tomaten", amount: "2 Dosen"}, {name: "Lasagneplatten", amount: "1 Packung"}]}))}; }
  if (kind === "dish") return {title: "Hähnchen-Reis-Pfanne", emoji: "🍗", why: "Viel Protein, füllt die fehlenden Kalorien.", items: [{name: "Hähnchenbrust", grams: 200, kcal: 212, carbs: 0, protein: 48, fat: 2}, {name: "Reis (roh)", grams: 100, kcal: 350, carbs: 78, protein: 7, fat: 1}, {name: "Paprika", grams: 150, kcal: 45, carbs: 9, protein: 1.5, fat: .5}],
    steps: ["Reis kochen.", "Hähnchen anbraten.", "Paprika dazu, alles mischen."], tip: "Mit Sojasauce abschmecken."};
  /* the products scanned before (FRÜHER): oat flakes said without a brand are the scanned Kölln ones */
  const fr = ((/FRÜHER: (.*)/.exec(user) || [])[1] || "").split("; ").map(x => x.replace(/^\d+ = /, ""));
  if (kind === "meal" && /haferflocken/i.test(said)){ const u = fr.findIndex(x => /haferflocken/i.test(x));
    return {title: "Haferflocken mit Milch", emoji: "🥣", items: [Object.assign(it("Haferflocken", "60 g", 220, 36, 8, 4), {grams: 60, usual: u}), Object.assign(it("Milch", "200 ml", 128, 9.6, 6.6, 7), {grams: 200, usual: -1})], kcal: 348, carbs: 45.6, protein: 14.6, fat: 11, minutesAgo: 0, note: ""}; }
  /* a photo of the plate: the stand-in "AI" sees a plate of spaghetti bolognese */
  if (kind === "meal" && photo) return {title: "Spaghetti Bolognese", emoji: "🍝", items: [Object.assign(it("Spaghetti Bolognese", "1 Teller (400 g)", 560, 70, 24, 18), {grams: 400, usual: -1})], kcal: 560, carbs: 70, protein: 24, fat: 18, minutesAgo: 0, note: "Menge vom Foto geschätzt."};
  if (kind === "week") return {headline: "Solide Woche", mood: "ok", summary: "Du hast dein Kalorienziel an 4 von 7 Tagen erreicht.", good: ["Genug Protein"], better: ["Mehr Gemüse"], focus: "Jeden Tag frühstücken."};
  /* noodles, rice, chicken: the stand-in "AI" names the table food and the grams, and deliberately guesses different calories
     every time (that was the complaint: the same food, different values). The server has to ignore its numbers. */
  const tab = [[/nudeln|spaghetti|pasta/i, "pasta", "Nudeln"], [/reis/i, "reis", "Reis"], [/hähnchen/i, "haehnchen", "Hähnchenbrust"], [/pesto/i, "pesto", "Pesto"]].filter(t => t[0].test(said));
  if (tab.length) { const wild = () => Math.round(100 + Math.random() * 400), dry = /trocken|\broh|ungekocht/i.test(said);
    const items = tab.map(([re, ref, name]) => { const m = new RegExp("(\\d+)\\s*(?:g|gramm)\\s+(?:\\S+\\s+)?(?:" + re.source + ")", "i").exec(said), g = m ? +m[1] : ref === "pesto" ? 30 : 200;
      const brand = /(barilla|dingsbums)/i.exec(said);
      return Object.assign(it(name, g + " g", wild(), wild() / 10, wild() / 20, wild() / 40), {grams: g, /* like the real model sometimes does: it only names the brand ("Barilla") and leaves product empty */
        brand: brand && ref === "pasta" ? brand[1] : "none", product: brand && ref === "pasta" && /dingsbums/i.test(said) ? brand[1] + " Spaghetti" : "none", name: ref === "pasta" && brand ? "Spaghetti" : name, ref, state: ref === "pesto" ? "" : dry ? "dry" : "cooked"}); });
    return {title: said.split(/\s+/).slice(0, 4).join(" "), emoji: "🍝", items, kcal: 0, carbs: 0, protein: 0, fat: 0, minutesAgo: 0, note: ""}; }
  /* foods outside the fixed table: the stand-in "AI" guesses a little differently every time and names the food only when it
     is on the BEKANNT list of the checked database. The server then answers with the checked values and never stores anything. */
  const sh = [[/mascarpone/i, "Mascarpone", 400, 3, 4.5, 41], [/trauben/i, "Weintraube", 70, 16, .7, .3]].filter(t => t[0].test(said));
  if (sh.length){ const known = (/BEKANNT: (.*)/.exec(user) || [])[1] || "";
    const items = sh.map(([re, food, k, c, p, f]) => { const m = new RegExp("(\\d+)\\s*(?:g|gramm)\\s+(?:\\S+\\s+)?" + re.source, "i").exec(said), g = m ? +m[1] : 100, w = .85 + Math.random() * .3, x = g / 100 * w;
      return Object.assign(it(food, g + " g", Math.round(k * x), c * x, p * x, f * x), {grams: g, food: known.split("; ").includes(food) ? food : ""}); });
    return {title: said.split(/\s+/).slice(0, 4).join(" "), emoji: "🍇", items, kcal: 0, carbs: 0, protein: 0, fat: 0, minutesAgo: 0, note: ""}; }
  return {title: said.split(/\s+/).slice(0, 4).join(" ") || "Mahlzeit", emoji: "🥐", items: [it("Brötchen", "2 Stück (120 g)", 332, 66, 10.8, 2.2), it("Nutella", "30 g", 162, 17.3, 1.9, 9.3), it("Kakao", "1 Glas (250 ml)", 180, 24, 8.5, 5.5)], kcal: 674, carbs: 107.3, protein: 21.2, fat: 17, minutesAgo: 0, note: ""};
}
const realFetch = global.fetch, json = (o, status = 200) => new Response(JSON.stringify(o), {status, headers: {"content-type": "application/json"}});
global.fetch = async (url, init = {}) => {
  url = String(url);
  if (/supabase\.co\/auth\/v1\/user/.test(url)){ const u = db.users.find(x => x.id === uidOf((init.headers || {}).Authorization)); return u ? json(userJSON(u)) : json({msg: "invalid JWT"}, 401); }
  /* the server function asks the database as the signed-in person (the shared food database) */
  if (/supabase\.co\/rest\/v1\//.test(url)){ const U = new URL(url), name = U.pathname.split("/rest/v1/")[1], uid = uidOf((init.headers || {}).Authorization), bd = init.body ? JSON.parse(init.body) : null;
    try { const r = name.startsWith("rpc/") ? db.rpc(name.slice(4), bd || {}, uid) : db.rest(init.method || "GET", name, U.searchParams, bd, init.headers || {}, uid); return json(r.body, r.status); } catch(e) { return json(e.body || {message: String(e.message || e)}, e.status || 500); } }
  if (/ai-gateway\.vercel\.sh/.test(url)){ if (process.env.FAKE_AI_DOWN === "1") return json({error: "down"}, 503);
    /* like Gemini: an empty string in an enum makes the whole request fail (that took "Sprechen" down on 2026-11-11) */
    { const bad = []; (function walk(o, p){ if (!o || typeof o !== "object") return; if (Array.isArray(o.enum) && o.enum.some(v => v === "")) bad.push(p); for (const k in o) walk(o[k], p + "." + k); })(((JSON.parse(init.body).response_format || {}).json_schema || {}).schema, "schema");
      if (bad.length) return json({error: {message: bad.map(b => "* GenerateContentRequest.generation_config.response_" + b + ".enum[0]: cannot be empty").join("\n"), type: "AI_APICallError"}}, 400); } return json({choices: [{message: {content: JSON.stringify(ai(JSON.parse(init.body)))}}]}); }
  /* a category question from api/foods.js ("all green pestos"): off unless a test turns it on; then 30 jars of pesto around 472 kcal
     (one of them a mislabelled ready meal that the kcal window has to throw out), and nothing for every other category */
  if (/search\.openfoodfacts\.org/.test(url) && /categories_tags/.test(new URL(url).searchParams.get("q") || "")){ const q = new URL(url).searchParams.get("q");
    if (!global.__offCats || !/en:green-pestos/.test(q)) return json({hits: []});
    return json({hits: Array.from({length: 30}, (_, i) => ({code: "p" + i, nutriments: i === 7 ? {"energy-kcal_100g": 131, carbohydrates_100g: 20, proteins_100g: 5, fat_100g: 3} : {"energy-kcal_100g": 467 + (i % 11), carbohydrates_100g: 6 + (i % 4), proteins_100g: 5 + (i % 3) * .8, fat_100g: 46 + (i % 3) * .3, fiber_100g: 2, sugars_100g: 3.2, "saturated-fat_100g": 6.4}}))}); }
  if (/search\.openfoodfacts\.org/.test(url)){ const q = new URL(url).searchParams.get("q").toLowerCase(); return json({hits: FOODS.filter(f => q.split(/\s+/).some(w => w.length > 1 && (f[1] + " " + f[2]).toLowerCase().includes(w.slice(0, 4)))).map(offHit)}); }
  return realFetch(url, init);
};
async function vercel(file, req, res, q, raw){
  const fn = require(path.join(ROOT, "api", file)); let body; try { body = raw.length ? JSON.parse(raw.toString()) : {}; } catch(e) { body = {}; }
  const vreq = {method: req.method, headers: req.headers, query: Object.fromEntries(q), body};
  const vres = {code: 200, setHeader: (k, v) => res.setHeader(k, v), status(c){ this.code = c; return this; }, json(o){ res.writeHead(this.code, {"content-type": "application/json"}); res.end(JSON.stringify(o)); return this; }, end(s){ res.writeHead(this.code); res.end(s); }};
  await fn(vreq, vres);
}

/* ---------- http ---------- */
const MIME = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".wasm": "application/wasm", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".ogg": "audio/ogg", ".webp": "image/webp"};
const CORS = {"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS", "access-control-expose-headers": "content-range"};
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"), p = decodeURIComponent(u.pathname), q = u.searchParams, chunks = [];
  req.on("data", c => chunks.push(c)); req.on("end", async () => {
    const raw = Buffer.concat(chunks), send = (status, body, headers = {}) => { res.writeHead(status, Object.assign({"content-type": "application/json; charset=utf-8", "cache-control": "no-store"}, CORS, headers)); res.end(body == null ? "" : typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
    const body = () => { try { return raw.length ? JSON.parse(raw.toString()) : {}; } catch(e) { return {}; } };
    const label = req.method + " " + p + (u.search.length > 1 ? "?" + decodeURIComponent(u.search.slice(1)).slice(0, 300) : "");
    try {
      if (req.method === "OPTIONS") return send(204, null);
      if (p.startsWith("/rest/v1/") || p.startsWith("/auth/v1/")) if (delay) await new Promise(r => setTimeout(r, delay));
      if (p.startsWith("/rest/v1/")){
        const uid = uidOf(req.headers.authorization), name = p.slice(9); db.calls.push({uid, label, body: raw.length && raw.length < 4000 ? raw.toString() : undefined});
        const r = name.startsWith("rpc/") ? db.rpc(name.slice(4), req.method === "GET" ? Object.fromEntries(q) : body(), uid) : db.rest(req.method, name, q, raw.length ? body() : null, req.headers, uid);
        /* a function that returns text answers with a JSON string, like PostgREST does */
        if (name.startsWith("rpc/") && typeof r.body === "string") r.body = JSON.stringify(r.body);
        return send(r.status, req.method === "HEAD" ? null : r.body, r.total != null ? {"content-range": (r.count ? "0-" + (r.count - 1) : "*") + "/" + r.total} : {});
      }
      if (p.startsWith("/auth/v1/")){ const r = auth(req.method, p.slice(9), q, body(), req.headers); if (r.status >= 400) db.note(label, r); return send(r.status, r.body); }
      if (p === "/realtime/v1/api/broadcast"){ (body().messages || []).forEach(m => peers("realtime:" + m.topic).forEach(x => x.send({topic: "realtime:" + m.topic, event: "broadcast", payload: {type: "broadcast", event: m.event, payload: m.payload}, ref: null}))); return send(202, null); }
      if (p.startsWith("/storage/v1/object/")){
        let k = p.slice(19); if (k.startsWith("sign/") && req.method === "POST") return send(200, {signedURL: "/object/sign/" + k.slice(5) + "?token=fake"}); k = k.replace(/^(public|sign|authenticated)\//, "");
        if (req.method === "POST" || req.method === "PUT"){ stored.set(k, {data: raw, type: req.headers["content-type"] || "application/octet-stream"}); return send(200, {Key: k, Id: crypto.randomUUID()}); }
        if (req.method === "DELETE"){ stored.delete(k); return send(200, {message: "Successfully deleted"}); }
        const f = stored.get(k); return f ? send(200, f.data, {"content-type": f.type}) : send(404, {statusCode: "404", error: "not_found", message: "Object not found"});
      }
      if (p.startsWith("/storage/v1/") || p.startsWith("/functions/v1/")) return send(200, {});
      if (p === "/api/kcal") return await vercel("kcal.js", req, res, q, raw);
      if (p === "/api/food") return await vercel("food.js", req, res, q, raw);
      if (p === "/api/foods") return await vercel("foods.js", req, res, q, raw);
      /* api/muell.js with the district's calendar replaced by a fixed one: two towns, a few streets, collections on the next days */
      if (p === "/api/abfall"){ res.writeHead(200, {"content-type": "application/json"}); return res.end(JSON.stringify({error: "unsupported"})); }
      if (p === "/api/muell"){ const day = n => { const d = new Date(Date.now() + n * 864e5); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }, J = (o, st) => { res.writeHead(st || 200, {"content-type": "application/json"}); return res.end(JSON.stringify(o)); };
        const termine = [{d: day(1), was: ["Gelber Sack", "Restabfall"], zusatz: ""}, {d: day(8), was: ["BIO", "Papier"], zusatz: "BIO nur 240"}, {d: day(15), was: ["Restmülltonne 14-tägl.", "Wertstofftonne (LVP)"], zusatz: ""}, {d: day(90), was: ["Papier"], zusatz: ""}];
        if (q.get("suggest") != null){ const t = q.get("suggest").toLowerCase(), nr = (/\b(\d+\s?[a-z]?)\b/.exec(t) || [])[1] || "";
          const all = [{street: "Geiglbergstraße", plz: "85368", city: "Wang", county: "Landkreis Freising", state: "Bayern"}, {street: "Geibelstraße", plz: "10961", city: "Berlin", county: "", state: "Berlin"}, {street: "Ziegelbergstraße", plz: "85368", city: "Wang", county: "Landkreis Freising", state: "Bayern"}];
          return J({list: all.filter(a => t.replace(/[^a-zäöüß]/g, "").includes(a.street.toLowerCase().slice(0, 4))).map(a => Object.assign({hnr: nr.replace(/\s/g, ""), district: "", label: a.street + (nr ? " " + nr.replace(/\s/g, "") : "") + ", " + a.plz + " " + a.city}, a))}); }
        if (q.get("street") != null) return q.get("city") === "Wang" ? J({termine}) : J({error: "unsupported"});
        const ort = q.get("ort"), str = q.get("strasse"), out = !ort ? {orte: ["Freising", "Moosburg", "Wang"]} : !str ? {ort, strassen: ["Ahornstraße", "Geiglbergstraße", "Ziegelbergstraße"]} : {ort, strasse: str, termine};
        res.writeHead(200, {"content-type": "application/json"}); return res.end(JSON.stringify(out)); }
      if (p === "/__fake/off-cats"){ global.__offCats = q.get("on") === "1"; return send(200, {on: global.__offCats}); }
      /* ---- test helpers ---- */
      if (p === "/__fake/reset"){ reset.pending = q.get("pending") === "1"; reset(); return send(200, {ok: true}); }
      if (p === "/__fake/problems") return send(200, db.problems);
      /* /__fake/admin?u=<id>&on=1: makes a test user the operator (news_is_admin) */
      if (p === "/__fake/admin"){ const id = q.get("u"); db.admins = db.admins.filter(a => a !== id); if (q.get("on") === "1") db.admins.push(id); return send(200, db.admins); }
      if (p === "/__fake/calls") return send(200, db.calls.slice(-Number(q.get("n") || 200)));
      if (p === "/__fake/delay"){ delay = Number(q.get("ms") || 0); return send(200, {delay}); }
      if (p === "/__fake/users") return send(200, db.users.map(x => ({id: x.id, email: x.email, password: x.password, name: x.name})));
      if (p === "/__fake/session"){ const x = db.users.find(x => x.name === q.get("u") || x.email === q.get("u")); return x ? send(200, session(x)) : send(404, {error: "no such test user"}); }
      if (p === "/__fake/off"){ const f = FOODS.find(f => f[0] === q.get("code")); return send(200, f ? {status: 1, product: offHit(f)} : {status: 0}); }
      /* open http://localhost:4173/__fake/login?u=tester in a browser: signs that test user in and opens the app */
      if (p === "/__fake/login"){ const x = db.users.find(x => x.name === (q.get("u") || "tester")); if (!x) return send(404, {error: "no such test user"});
        return send(200, `<!doctype html><script>localStorage.setItem("sb-" + location.hostname.split(".")[0] + "-auth-token", ${JSON.stringify(JSON.stringify(session(x)))}); location.replace("/");</script>`, {"content-type": "text/html"}); }
      /* the tables as the database owner sees them (no row level security): GET to look, POST/PATCH/DELETE to stage a situation */
      if (p.startsWith("/__fake/table/")){ const r = db.rest(req.method, p.slice(14), q, raw.length ? body() : null, {prefer: "return=representation"}, "service"); return send(r.status, r.body); }
      /* ---- the app itself ---- */
      if (p === "/config.js") return send(200, `window.CHESSNAT_CONFIG = {supabaseUrl: location.origin, supabaseAnonKey: "fake-anon-key", google: false}; window.CHESSNAT_FAKE = true;`, {"content-type": MIME[".js"]});
      let file = path.join(ROOT, p === "/" ? "index.html" : p); if (!file.startsWith(ROOT)) return send(403, "no");
      if (!fs.existsSync(file) && fs.existsSync(file + ".html")) file += ".html";
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(404, "not found: " + p, {"content-type": "text/plain"});
      return send(200, fs.readFileSync(file), {"content-type": MIME[path.extname(file)] || "application/octet-stream"});
    } catch(e) {
      if (e && e.status && e.body){ db.note(label + (raw.length && raw.length < 600 ? " " + raw.toString() : ""), e); return send(e.status, e.body); }
      console.error(label, e); db.note(label, {status: 500, body: {code: "FAKE", message: "the fake itself failed: " + (e && e.message)}}); return send(500, {code: "FAKE", message: String(e && e.stack || e)});
    }
  });
});
server.on("upgrade", (req, sock) => { if (req.url.startsWith("/realtime/v1/websocket")) wsAccept(req, sock); else sock.destroy(); });
reset();
if (require.main === module) server.listen(PORT, () => console.log(`Chess.nat mit Test-Datenbank: http://localhost:${PORT}/__fake/login?u=tester   (Nutzer: ${db.users.map(u => u.name).join(", ")})`));
module.exports = {server, reset, get db(){ return db; }};
