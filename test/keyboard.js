#!/usr/bin/env node
/* Every place where you type, with an iPhone keyboard that isn't really there.
     node test/keyboard.js
   A headless browser has no on-screen keyboard, so this imitates what the iPhone does to the page when a field gets focus:
     model "meldet":  about 0.3 s after the tap the visible area shrinks by the keyboard's height (visualViewport fires resize)
     model "stumm":   the home-screen app reports nothing at all (that happens on real phones), the keyboard simply covers the lower part
   For each field it taps in, films where the field is on every frame for a second, and checks:
     sichtbar  the field ends above the keyboard, in both models
     weich     it gets there in a glide: no single-frame jump, no moving back and forth
   What this cannot see: how iOS itself pans the page, the real keyboard animation, Safari quirks. It checks the app's own moves. */
const L = require("./lib"), {ID} = L, sleep = ms => new Promise(r => setTimeout(r, ms));
const KB = 336, JUMP = 48;
const sim = model => { const H = innerHeight, KBH = 336; let h = H, top = 0; const vv = new EventTarget();
  Object.defineProperties(vv, {height: {get: () => h}, width: {get: () => innerWidth}, offsetTop: {get: () => top}, offsetLeft: {get: () => 0}, pageTop: {get: () => top + scrollY}, pageLeft: {get: () => 0}, scale: {get: () => 1}});
  Object.defineProperty(window, "visualViewport", {get: () => vv, configurable: true});
  const text = a => a && /INPUT|TEXTAREA/.test(a.tagName) && !/^(checkbox|radio|range|button|file|submit)$/.test(a.type); let t = 0, open = false;
  document.addEventListener("focusin", e => { if (!text(e.target)) return; clearTimeout(t); if (open) return; open = true; if (model === "meldet") t = setTimeout(() => { h = H - KBH; vv.dispatchEvent(new Event("resize")); }, 300); }, true);
  document.addEventListener("focusout", () => { clearTimeout(t); t = setTimeout(() => { if (text(document.activeElement)) return; open = false; if (h !== H){ h = H; top = 0; vv.dispatchEvent(new Event("resize")); } }, 120); }, true);
  /* film one element: its top and bottom on every frame, in the coordinates of what you see */
  window.__film = sel => { const el = typeof sel === "string" ? document.querySelector(sel) : sel, S = []; let on = true; const t0 = performance.now(); const f = () => { if (!on) return; const r = el.isConnected ? el.getBoundingClientRect() : null; if (r) S.push([Math.round(performance.now() - t0), Math.round(r.top - top), Math.round(r.bottom - top)]); requestAnimationFrame(f); }; f(); return () => { on = false; return S; }; };
};
const results = [];
async function probe(page, model, name, sel, {tap = true, wait = 1100, native = false} = {}){
  const loc = page.locator(sel).first(); if (!(await loc.count()) || !(await loc.isVisible().catch(() => false))){ results.push({name, model, skip: "Feld nicht gefunden"}); return; }
  await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); }); await sleep(450);
  /* a sheet from the bottom must stay the same sheet: its top edge may glide up when it grows, but never drop down first and come back up */
  await page.evaluate(s => { window.__stop = window.__film(s); const card = document.querySelector(s).closest(".dcard"); window.__stopC = card ? window.__film(card) : null; }, sel); await sleep(80);
  if (tap) await loc.tap({timeout: 4000}).catch(async () => { await loc.focus(); }); else await loc.focus();
  await sleep(wait); const S = await page.evaluate(() => window.__stop()), C = await page.evaluate(() => window.__stopC ? window.__stopC() : null), H = 844;
  const drop = C && C.length ? Math.max(...C.map(x => x[1])) - C[0][1] : 0;
  const focused = await page.evaluate(s => document.activeElement === document.querySelector(s), sel);
  let maxStep = 0, rev = 0, dir = 0, moved = S.length ? Math.abs(S[S.length - 1][1] - S[0][1]) : 0, tJump = 0;
  /* per 60th of a second: a frame the test machine dropped is not a jump */
  for (let i = 1; i < S.length; i++){ const d = (S[i][1] - S[i - 1][1]) / Math.max(1, (S[i][0] - S[i - 1][0]) / 16.7); if (Math.abs(d) > maxStep){ maxStep = Math.abs(d); tJump = S[i][0]; } if (Math.abs(d) > 2){ const nd = Math.sign(d); if (dir && nd !== dir) rev++; dir = nd; } }
  const end = S[S.length - 1] || [0, 0, 0], start = S[0] || [0, 0, 0];
  if (process.env.DUMP) console.log(name, model, S.filter((x, i) => !i || x[1] !== S[i - 1][1]).map(x => x[0] + ":" + x[1]).join(" "));
  /* a glide starts fast, so a big step is only a jump when it is most of the way at once */
  results.push({name, model, focused, from: start[1], to: end[1], bottom: end[2], visible: native || (end[2] <= H - KB - 4 && end[1] >= 0), native, maxStep, tJump, rev, drop, smooth: native || ((maxStep <= JUMP || maxStep <= moved * .3) && rev === 0 && drop <= 6)});
  await page.evaluate(() => { const a = document.activeElement; if (a && a.blur) a.blur(); }); await sleep(500);
}
const close = async page => { for (let i = 0; i < 4; i++){ const n = await page.locator(".dsheet [data-dclose]").count(); if (!n) break; await page.locator(".dsheet [data-dclose]").last().click({force: true}).catch(() => {}); await sleep(350); }
  for (const s of ["#kcsx", "#kcshx", "#fbx"]) if (await page.locator(s).count()) { await page.locator(s).first().click({force: true}).catch(() => {}); await sleep(350); } };

async function run(browser, model){
  await fetch(L.BASE + "/__fake/reset");
  /* a meal made of a food from the checked table, so it may be saved as a recipe */
  await L.stage("POST", "kcal_meals", "", {user_id: ID.tester, day: new Date().toLocaleDateString("sv"), title: "Nudeln Test", emoji: "🍝", source: "voice", kcal: 390, carbs: 77.2, protein: 13.6, fat: 1.6, items: [{name: "Nudeln", amount: "250 g gekocht", kcal: 390, carbs: 77.2, protein: 13.6, fat: 1.6, ref: "pasta", st: "cooked"}]});
  /* and a long one: its sheet fills the whole screen */
  await L.stage("POST", "kcal_meals", "", {user_id: ID.tester, day: new Date().toLocaleDateString("sv"), title: "Cookie-Trauben-Dessert", emoji: "🍨", source: "voice", kcal: 515, carbs: 49.6, protein: 7.7, fat: 33.2,
    items: [["Mascarpone", "36 g", 140], ["Magerquark", "29 g", 20], ["Sahne", "36 ml (36 g)", 87], ["Zucker", "5,76 g", 23], ["Vanillezucker", "1 Päckchen (1,15 g)", 5], ["Grüne kernlose Trauben", "86 g", 60], ["Chocolate Chip Cookies", "36 g", 180]].map(([name, amount, kcal]) => ({name, amount, kcal, carbs: 5, protein: 1, fat: 4}))});
  const page = await L.open(browser, "tester", {before: [sim, model]});
  const P = (n, s, o) => probe(page, model, n, s, o), step = async (n, f) => { if (process.env.ONLY && !process.env.ONLY.split(",").some(x => n.includes(x))) return; try { await f(); } catch(e) { results.push({name: n, model, skip: String(e.message || e).split("\n")[0].slice(0, 90)}); } await close(page); };
  await step("Kalorien: Suche", async () => { await page.tap("#main [data-kc-find]"); await sleep(700); await P("Kalorien: Suche (Feld oben)", "#kcq"); await page.tap("#kcq"); await page.keyboard.type("milch"); await page.waitForSelector('.kc-sres:has-text("Weihenstephan")', {timeout: 6000}); await page.tap('.kc-sres:has-text("Weihenstephan")'); await sleep(600); await P("Suche: Gramm unter dem Treffer", ".kc-sadd input"); });
  await step("Selbst eintragen", async () => { await page.tap("#kcmanual"); await sleep(700); await P("Selbst eintragen: Was", "#kcmt"); await P("Selbst eintragen: kcal", '.dsheet [data-k="kcal"]'); await P("Selbst eintragen: Fett", '.dsheet [data-k="fat"]'); });
  await step("Eintrag", async () => { await page.locator("#main [data-meal]", {hasText: "Haferflocken"}).first().tap(); await sleep(600); await P("Eintrag: Davon gegessen", ".dsheet [data-tg]"); await P("Eintrag: Gramm einer Zutat", '.dsheet input[data-g="0"]'); await P("Eintrag: Gramm letzte Zutat", '.dsheet input[data-g="2"]'); });
  await step("Eintrag lang", async () => { await page.locator("#main [data-meal]", {hasText: "Cookie"}).first().tap(); await sleep(600); await P("Langer Eintrag: Davon gegessen", ".dsheet [data-tg]"); await P("Langer Eintrag: Gramm 1. Zutat", '.dsheet input[data-g="0"]'); await P("Langer Eintrag: Gramm letzte Zutat", '.dsheet input[data-g="6"]'); });
  await step("Ändern", async () => { await page.locator("#main [data-meal]", {hasText: "Haferflocken"}).first().tap(); await sleep(500); await page.locator('.dsheet [data-it="0"]').tap(); await sleep(600); await P("Ändern: Was", "#kpn"); await P("Ändern: Menge", "#kpa"); await P("Ändern: kcal", '.dsheet [data-k="kcal"]'); });
  await step("Barcode", async () => { await page.tap("#main [data-kc-scan]"); await page.waitForSelector("#kccode", {timeout: 5000}); await sleep(500); await P("Barcode: Nummer eintippen", "#kccode"); await page.fill("#kccode", "4000000000079"); await page.locator("#kcman button").tap(); await page.waitForSelector("#kcg", {timeout: 5000}); await sleep(500); await P("Produkt: Gramm", "#kcg"); await P("Produkt: Portionen", "#kcn"); });
  await page.evaluate(() => document.querySelectorAll(".kc-ov-full").forEach(e => e.remove())); 
  await step("Einstellungen", async () => { await page.tap("#kcset"); await sleep(600); await P("Kalorien-Einstellungen: Tagesziel", "#kcgoal"); });
  await step("Wiegen", async () => { await page.tap('#main [data-tab="stats"]'); await sleep(400); await page.tap("#kcwnow"); await sleep(600); await P("Wiegen: Gewicht", "#kwkg"); });
  await step("Kochen", async () => { await page.tap("#kccook"); await sleep(600); await P("Kochen: Was hast du da", "#kch"); });
  await step("Rezept", async () => { await page.tap('#main [data-tab="today"]'); await sleep(300); await page.locator("#main [data-meal]", {hasText: "Nudeln Test"}).first().tap(); await sleep(500); await page.locator(".dsheet [data-pub]").tap(); await sleep(700); await P("Rezept: Name", "#kcrn"); });
  await step("Einkaufsliste", async () => { await page.tap("#kcshop"); await page.waitForSelector("#kcsha"); await sleep(700); await P("Einkaufsliste: Was fehlt", "#kcsha"); });
  await step("Haushalt", async () => { await page.tap('#main [data-tab="today"]').catch(() => {}); await sleep(300); await page.tap("#kchaus"); await page.waitForSelector("#hsti"); await sleep(900); await P("Haushalt: Neue Aufgabe", "#hsti");
    await page.tap(".hs-ov [data-addr]"); await page.waitForSelector("#hsai"); await sleep(700); await P("Haushalt: Adresse", "#hsai"); await page.tap("#hsax").catch(() => {}); await sleep(300); await page.tap("#hsx").catch(() => {}); });
  await step("Einkaufs-Frage", async () => { await L.stage("POST", "shop_asks", "", {list_id: "aaaaaaaa-0000-4000-8000-000000000001", kind: "shop", from_id: ID.mila}); await page.waitForSelector(".kc-askc .kc-aski", {timeout: 5000}); await sleep(500); await P("Karte „ist einkaufen“: Wunsch", ".kc-askc .kc-aski"); });
  await step("Feedback", async () => { await page.evaluate(() => Feedback.open()); await sleep(700); await P("Feedback: Text", "#fbtx"); });
  await step("Chat", async () => { await page.evaluate(id => App.go("chat", {id}), ID.mila); await page.waitForSelector("#ctext"); await sleep(900); await P("Chat: Nachricht", "#ctext", {wait: 1500}); });
  await step("Freunde", async () => { await page.evaluate(() => App.go("friends", {tab: "friends"})); await sleep(900); const s = await page.evaluate(() => { const i = [...document.querySelectorAll("#main input")].find(x => x.offsetParent && !/checkbox|radio/.test(x.type)); if (i) i.id = i.id || "probeF"; return i ? "#" + i.id : null; }); if (s) await P("Freunde: Suche (Seite, schiebt das iPhone selbst)", s, {native: true}); });
  await step("Song raten", async () => { await page.evaluate(() => { PG.opt("song", {}).genre = "own"; PG.opt("song", {}).own = "Queen"; PG.opt("song", {}).answer = "type"; App.go("party", {g: "song"}); }); await sleep(900);
    await P("Song raten: Eigene Künstler", "#sgown"); await page.tap("#sggo"); await page.waitForSelector("#sgplay", {timeout: 8000}); await page.tap("#sgplay"); await sleep(300); await P("Song raten: Titel", "#sgt", {tap: false}); await page.evaluate(() => App.go("games")); await sleep(400); });
  await step("Einstellungen-Seite", async () => { await page.evaluate(() => App.go("settings")); await sleep(700); await P("Einstellungen: Name (Seite)", "#nm", {native: true}); });
  await step("Ziele einrichten", async () => { await page.evaluate(() => { document.querySelectorAll(".dsheet,.kc-sov,.kc-ov-full").forEach(e => e.remove()); document.documentElement.classList.remove("kc-sopen"); document.body.classList.remove("chatting"); App.go("home"); }); await sleep(900); await page.tap("#kcset"); await sleep(500); await page.tap(".dsheet [data-kcs-setup]"); await sleep(900);
    for (let i = 0; i < 6 && !(await page.locator(".kc-setup input:visible").count()); i++){ const b = page.locator(".kc-setup button.go:visible, .kc-setup [data-v]:visible").first(); if (!(await b.count())) break; await b.tap().catch(() => {}); await sleep(500); } const ids = await page.evaluate(() => [...document.querySelectorAll(".kc-setup input")].filter(x => x.offsetParent && !/checkbox|radio/.test(x.type)).map(x => "#" + x.id)); for (const s of ids.slice(0, 3)) await P("Ziele: " + s, s); });
  await page.context().close();
}
(async () => {
  const {browser, stop} = await L.start();
  for (const model of ["meldet", "stumm"]) await run(browser, model).catch(e => console.log("Abbruch (" + model + "):", String(e.message || e).split("\n")[0]));
  await stop();
  const pad = (s, n) => String(s).padEnd(n).slice(0, n); let bad = 0;
  console.log(pad("Feld", 38) + pad("Tastatur", 9) + pad("von→nach", 11) + pad("sichtbar", 9) + pad("weich", 7) + "größter Sprung / Richtungswechsel");
  for (const r of results){ if (r.skip){ console.log(pad(r.name, 38) + pad(r.model, 9) + "– " + r.skip); continue; } if (!r.visible || !r.smooth) bad++;
    console.log(pad(r.name, 38) + pad(r.model, 9) + pad(r.from + "→" + r.to, 11) + pad(r.native ? "iPhone" : r.visible ? "ja" : "NEIN " + r.bottom, 9) + pad(r.smooth ? "ja" : "NEIN", 7) + Math.round(r.maxStep) + " px" + (r.maxStep > JUMP ? " bei " + r.tJump + " ms" : "") + " / " + r.rev + (r.drop > 6 ? "  Blatt sackt " + r.drop + " px ab und kommt wieder hoch" : "") + (r.focused ? "" : "  (Fokus kam nicht an)")); }
  console.log("\n" + (results.filter(r => !r.skip).length - bad) + " von " + results.filter(r => !r.skip).length + " in Ordnung (Tastatur " + KB + " px, sichtbar = Feld endet darüber; weich = kein Sprung über " + JUMP + " px in einem Bild, kein Hin und Her)");
  process.exit(bad ? 1 : 0);
})();
