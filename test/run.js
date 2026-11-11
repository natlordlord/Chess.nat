#!/usr/bin/env node
/* Chess.nat, signed in, clicked through in a real browser against the stand-in database.
     node test/run.js            everything
     node test/run.js shop chat  only the parts named
   Every part opens the app as a test person on a phone-sized screen, does what a player would do and checks the result on the page
   and in the database. At the end: what failed, plus every error the page or the database reported on the way. */
const L = require("./lib"), {ID} = L;
const only = process.argv.slice(2), results = [], sleep = ms => new Promise(r => setTimeout(r, ms));
let part = "", seen = 0;
const ok = (cond, name, detail) => { results.push({part, name, ok: !!cond, detail: cond ? "" : detail}); console.log((cond ? "  ✓ " : "  ✗ ") + name + (cond || detail == null ? "" : "  →  " + String(detail).slice(0, 300))); return !!cond; };
/* errors the page or the database reported since the last check; "allow" = expected ones (regex on the text) */
async function clean(pages, name, allow){
  const db = (await L.problems()).slice(seen); seen += db.length; let bad = [];
  for (const p of [].concat(pages)) bad = bad.concat(p.bad.splice(0).map(b => p.who + ": " + b.kind + " " + b.text));
  bad = bad.concat(db.map(d => "Datenbank " + d.status + " " + (d.code || "") + " " + d.message + "  ←  " + d.req));
  if (allow) bad = bad.filter(b => !allow.test(b));
  /* a failed request shows up twice (page + database): one line is enough */
  bad = bad.filter(b => !(/^\w+: Anfrage \d+/.test(b) && db.length));
  ok(!bad.length, name + ": keine Fehler", bad.join("\n      "));
}
const txt = (page, sel) => page.locator(sel).first().innerText().then(s => s.replace(/\s+/g, " ").trim(), () => "");
const has = (page, sel) => page.locator(sel).count().then(n => n > 0);
const sums = page => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#main [data-cnt]")].map(e => [e.dataset.cnt, Number(e.dataset.v)])));
const closeSheets = async page => { for (let i = 0; i < 5 && await has(page, ".dsheet [data-dclose]"); i++){ await page.locator(".dsheet [data-dclose]").last().click({force: true}).catch(() => {}); await sleep(350); } };
const toast = page => page.evaluate(() => [...document.querySelectorAll(".toast")].map(e => e.innerText).join(" | "));
const meals = (who, q = "") => L.table("kcal_meals", "user_id=eq." + ID[who] + "&order=created_at.desc" + q);

const PARTS = {
  /* ---------- signing in with email and password ---------- */
  async login(browser){
    const page = await L.open(browser, null, {route: "#account"}); await sleep(600);
    ok(await has(page, 'input[type="email"]'), "Anmeldeseite zeigt das Formular");
    await page.fill('input[type="email"]', "tester@chessnat.test"); await page.fill('input[type="password"]', "falsch123");
    await page.locator("#afw button.go, #afw button[type=submit]").first().click(); await sleep(1200);
    ok(/invalid|falsch|stimmt|Passwort|credentials/i.test(await txt(page, "#afw") + await toast(page)), "falsches Passwort wird abgelehnt und gemeldet", await txt(page, "#afw"));
    await clean(page, "falsches Passwort", /invalid_credentials|Invalid login|Anfrage 400 POST \/auth\/v1\/token/);
    await page.fill('input[type="password"]', "test1234"); await page.locator("#afw button.go, #afw button[type=submit]").first().click();
    await page.waitForFunction(() => window.ChessSite && ChessSite.getSession() && typeof Social !== "undefined" && Social.me, null, {timeout: 15000}).catch(() => {});
    ok(await page.evaluate(() => !!(window.ChessSite.getSession() && Social.me)), "mit richtigem Passwort angemeldet");
    await clean(page, "Anmelden"); await page.context().close();
  },

  /* ---------- Kalorien: Start, Suche, Mengen, selbst eintragen, Vorschläge, Sprechen, Barcode ---------- */
  async kcal(browser){
    const page = await L.open(browser, "tester", {before: () => {
      /* a speech recognition that "hears" what the test says (headless browsers have none that works) */
      class SR { start(){ SR.cur = this; setTimeout(() => this.onstart && this.onstart(), 10); } stop(){ setTimeout(() => this.onend && this.onend(), 20); } abort(){ this.stop(); } }
      window.SpeechRecognition = window.webkitSpeechRecognition = SR; window.__hear = t => { const r = SR.cur; if (r && r.onresult) r.onresult({resultIndex: 0, results: Object.assign([Object.assign([{transcript: t, confidence: .9}], {isFinal: true})], {length: 1})}); };
    }});
    const s0 = await sums(page);
    ok(await page.evaluate(() => App.route === "home" && Views.home.k === true), "Start ist der Kalorien-Tracker");
    ok(s0.kcal === 1340 && s0.protein === 75 && s0.carbs === 175 && s0.fat === 31, "alle vier Werte stimmen mit der Datenbank (1.340 kcal, 75 P, 175 KH, 31 F)", JSON.stringify(s0));
    ok(/Frühstück/.test(await txt(page, "#main .kc-list2")), "Einträge innerhalb von 15 Minuten stehen als eine Mahlzeit (Frühstück) mit Summe");
    await clean(page, "Kalorien-Start");

    /* search: keyboard at once, pick, amount, add */
    await page.tap("[data-kc-find]"); await sleep(500);
    ok(await page.evaluate(() => document.activeElement && document.activeElement.id === "kcq"), "Suche: Tastatur-Fokus sofort im Suchfeld");
    await page.keyboard.type("milch", {delay: 20}); await page.waitForSelector('.kc-sres:has-text("Weihenstephan")', {timeout: 5000}).catch(() => {});
    ok(/Vollmilch/.test(await txt(page, ".kc-sres")), "Suche findet „Vollmilch“ mit kcal");
    await page.tap('.kc-sres:has-text("Weihenstephan")'); await sleep(600); await page.tap('.kc-sov [data-g="500"]'); await sleep(300); await page.tap(".kc-sov [data-add]"); await sleep(1200);
    let m = (await meals("tester", "&limit=1"))[0];
    ok(m && m.source === "search" && m.kcal === 320 && m.grams === 500, "2 Portionen (500 g) Vollmilch → 320 kcal gespeichert", m && [m.title, m.source, m.kcal, m.grams].join(" "));
    ok((await sums(page)).kcal === 1660, "Tageszahl läuft auf 1.660", JSON.stringify(await sums(page)));
    ok(!(await has(page, ".kc-sov")), "Suche schließt sich nach dem Hinzufügen");
    await clean(page, "Suche");

    /* eggs count in pieces */
    await page.tap("[data-kc-find]"); await sleep(400); await page.keyboard.type("eier", {delay: 20}); await page.waitForSelector('.kc-sres:has-text("Landliebe")', {timeout: 5000}).catch(() => {}); await page.tap('.kc-sres:has-text("Landliebe")'); await sleep(600);
    ok(/Stück|Ei\b|Eier/.test(await txt(page, ".kc-sov .kc-sres.open, .kc-sov")), "Eier: Auswahl in Stück", (await txt(page, ".kc-sov")).slice(0, 200));
    await page.shot("kcal-suche-eier"); await page.tap("#kcsx"); await sleep(400);

    /* an entry: type a new amount, everything follows live and is saved when you leave the field */
    await page.locator("#main [data-meal]", {hasText: "Haferflocken"}).first().tap(); await sleep(600);
    const g = page.locator(".dsheet input[data-g]").first(); await g.tap(); await sleep(150); await page.keyboard.type("160", {delay: 120}); await sleep(700);
    ok(/810 kcal/.test(await txt(page, ".dsheet")), "Menge 80 → 160 g Haferflocken: Kalorien laufen live mit (520 → 810 kcal)", (await txt(page, ".dsheet")).slice(0, 160));
    await page.keyboard.press("Tab"); await sleep(900);
    m = (await L.table("kcal_meals", "title=eq.Haferflocken mit Banane"))[0];
    ok(m.kcal === 810 && m.items[0].kcal === 580, "beim Verlassen des Felds gespeichert (810 kcal, Haferflocken 580)", m.kcal + " / " + JSON.stringify(m.items.map(i => i.kcal)));
    ok(await has(page, ".dsheet"), "der Dialog bleibt dabei offen");
    await page.locator('.dsheet [data-f="2"]').tap(); await sleep(900);
    m = (await L.table("kcal_meals", "title=eq.Haferflocken mit Banane"))[0]; ok(m.kcal === 1620, "„2ד verdoppelt den Eintrag (1.620 kcal)", m.kcal);
    await page.locator(".dsheet [data-pin]").tap(); await sleep(700);
    ok((await L.table("kcal_profile", "user_id=eq." + ID.tester))[0].pins.length === 1, "Anpinnen wird im Profil gespeichert");
    await closeSheets(page); await sleep(300);
    ok(await has(page, "#main .kc-pinm"), "Angepinntes steht bei den Vorschlägen mit Pin");
    await clean(page, "Eintrag ändern");

    /* "Ändern": typing into "Was" lists the real products, a tap takes that product and keeps the amount */
    await page.locator("#main [data-meal]", {hasText: "Hähnchen"}).first().tap(); await sleep(500); await page.locator('.dsheet [data-it="0"]').tap(); await sleep(500);
    await page.fill("#kpn", ""); await page.tap("#kpn"); await page.keyboard.type("hähnchen", {delay: 25}); await page.waitForSelector('#kpsg [data-sg]:has-text("Wiesenhof")', {timeout: 5000}).catch(() => {});
    ok(/Wiesenhof/.test(await txt(page, "#kpsg")) && /kcal \/ 100 g/.test(await txt(page, "#kpsg")), "Ändern: beim Tippen in „Was“ erscheinen die echten Produkte zur Auswahl", await txt(page, "#kpsg")); await page.shot("kcal-aendern-produkte");
    await page.locator('#kpsg [data-sg]:has-text("Wiesenhof")').tap(); await sleep(900);
    if (await has(page, '.dsheet [data-ck="cooked"]')){ await page.tap('.dsheet [data-ck="dry"]'); await sleep(500); await page.fill("#kcg", "200"); await page.locator("#kcg").blur(); await page.tap("#kcadd"); await sleep(1000); }
    else if (await has(page, "#kcadd")){ await page.fill("#kcg", "200"); await page.locator("#kcg").blur(); await page.tap("#kcadd"); await sleep(1000); }
    m = (await L.table("kcal_meals", "title=like.H*hnchen*"))[0];
    ok(m && m.items && /Hähnchenbrustfilet \(Wiesenhof\)/.test(m.items[0].name) && m.items[0].code === "4000000000086" && m.kcal === 212, "das gewählte Produkt ersetzt die Position mit seinen eigenen Werten (200 g = 212 kcal)", JSON.stringify(m && [m.kcal, m.items]).slice(0, 300));
    await closeSheets(page); await clean(page, "Produkt in „Ändern“ wählen");

    /* typing your own entry */
    await page.tap("#kcmanual"); await sleep(500); await page.fill("#kcmt", "Proteinshake");
    const nums = page.locator(".dsheet [data-k]"); await nums.nth(0).fill("210"); await nums.nth(1).fill("8,5"); await nums.nth(2).fill("32"); await nums.nth(3).fill("4");
    await page.tap("#kcms"); await sleep(900); m = (await meals("tester", "&limit=1"))[0];
    ok(m.title === "Proteinshake" && m.source === "manual" && m.kcal === 210 && m.carbs === 8.5 && m.protein === 32, "Selbst eintragen speichert Name, kcal und Makros (Komma-Zahl 8,5)", JSON.stringify([m.title, m.kcal, m.carbs, m.protein, m.fat]));
    await clean(page, "Selbst eintragen");

    /* suggestions: tap shows the entry, + adds it again */
    const before = (await meals("tester")).length; await page.locator("#main [data-qi]").first().tap(); await sleep(500);
    ok(await has(page, "#kceadd"), "Vorschlag antippen zeigt den Eintrag mit „Hinzufügen“"); await page.tap("#kceadd"); await sleep(900);
    m = (await meals("tester", "&limit=1"))[0]; ok((await meals("tester")).length === before + 1 && m.source === "quick", "Vorschlag wird als neuer Eintrag gespeichert (Quelle quick)", m.source);
    await closeSheets(page); await clean(page, "Vorschläge");

    /* speaking */
    await page.tap("#main [data-kc-say]"); await sleep(700); await page.evaluate(() => window.__hear("zwei Brötchen mit Nutella und ein Kakao")); await sleep(500);
    await page.shot("kcal-sprechen");
    if (await page.locator("#kcmic").isVisible().catch(() => false)){ await page.tap("#kcmic"); await sleep(400); }
    if (await page.locator("#kcvdone").isVisible().catch(() => false)) await page.tap("#kcvdone");
    await page.waitForSelector(".dsheet [data-commit]", {timeout: 8000}).catch(() => {});
    const nb = (await meals("tester")).length, sb0 = (await sums(page)).kcal;
    ok(/Brötchen/.test(await txt(page, ".dsheet")) && /674 kcal/.test(await txt(page, ".dsheet")), "Sprechen: Gesagtes wird ausgerechnet und gezeigt (674 kcal, drei Positionen)", (await txt(page, ".dsheet")).slice(0, 160));
    ok((await meals("tester")).length === nb && /Noch nicht eingetragen/.test(await txt(page, ".dsheet")), "noch nichts gespeichert: erst „Passt“ trägt es ein (vorher geht auch keine Nachricht an Freunde)");
    /* closed without "Passt": nothing is entered, and it says so */
    await page.locator(".dsheet .dx").first().tap(); await sleep(2400);
    ok((await meals("tester")).length === nb && /Nicht eingetragen/.test(await toast(page)), "ohne „Passt“ geschlossen: nichts eingetragen, mit Hinweis", await toast(page));
    await page.tap("#main [data-kc-say]"); await sleep(700); await page.evaluate(() => window.__hear("zwei Brötchen mit Nutella und ein Kakao")); await sleep(500);
    if (await page.locator("#kcmic").isVisible().catch(() => false)){ await page.tap("#kcmic"); await sleep(400); } if (await page.locator("#kcvdone").isVisible().catch(() => false)) await page.tap("#kcvdone");
    await page.waitForSelector(".dsheet [data-commit]", {timeout: 8000}).catch(() => {});
    /* change an amount on the draft, then "Passt" */
    const dg = page.locator(".dsheet input[data-g]").first(); await dg.tap(); await sleep(150); await page.keyboard.type("60", {delay: 120}); await page.keyboard.press("Tab"); await sleep(600);
    ok((await meals("tester")).length === nb, "Menge im Entwurf ändern speichert noch nichts"); await page.tap(".dsheet [data-commit]"); await sleep(1300);
    m = (await meals("tester", "&limit=1"))[0];
    ok((await meals("tester")).length === nb + 1 && m.source === "voice" && m.kcal === 508 && m.items.length === 3, "„Passt“ trägt den Entwurf ein, mit der geänderten Menge (1 Brötchen: 508 kcal)", JSON.stringify([m.title, m.source, m.kcal]));
    ok(m.items[0].h && m.items[0].h.q && m.said, "mit Gesundheits-Werten je Position und dem gesagten Satz", JSON.stringify(m.items[0]));
    ok((await sums(page)).kcal === sb0 + 508 && !(await has(page, ".dsheet")), "erst jetzt läuft die Tageszahl hoch, das Blatt schließt sich", JSON.stringify(await sums(page)));
    await closeSheets(page); await clean(page, "Sprechen");

    /* barcode typed by hand (the camera sees nothing in a test) */
    await page.tap("#main [data-kc-scan]"); await page.waitForSelector("#kccode", {timeout: 6000}).catch(() => {});
    if (ok(await has(page, "#kccode"), "Barcode: Scanner öffnet, Nummer lässt sich eintippen")){
      await page.fill("#kccode", "4000000000079"); await page.locator("#kcman button").tap(); await page.waitForSelector("#kcadd", {timeout: 6000}).catch(() => {});
      ok(/Nutella/.test(await txt(page, ".dsheet")), "Produkt zur Nummer wird gefunden (Nutella)", (await txt(page, ".dsheet")).slice(0, 160)); await page.shot("kcal-barcode");
      if (await has(page, "#kcadd")){ await page.tap("#kcadd"); await sleep(1000); m = (await meals("tester", "&limit=1"))[0]; ok(m.source === "barcode" && m.code === "4000000000079" && m.kcal > 0, "gescanntes Produkt gespeichert", JSON.stringify([m.title, m.source, m.kcal, m.grams])); } }
    await closeSheets(page); if (await has(page, ".kc-scanov, .kc-ov-full")) await page.evaluate(() => document.querySelectorAll(".kc-ov-full [data-x], .kc-ov-full .kc-x").forEach(b => b.click()));
    await clean(page, "Barcode");

    /* delete with two taps */
    await page.locator("#main [data-meal]", {hasText: "Proteinshake"}).first().tap(); await sleep(500); await page.tap(".dsheet [data-kc-del]"); await sleep(200);
    ok(/Wirklich/.test(await txt(page, ".dsheet [data-kc-del]")), "Löschen fragt erst nach"); await page.tap(".dsheet [data-kc-del]"); await sleep(900);
    ok(!(await L.table("kcal_meals", "title=eq.Proteinshake")).length, "zweiter Tipp löscht den Eintrag"); await closeSheets(page);
    await clean(page, "Löschen"); await page.context().close();
  },

  /* ---------- gleiche Werte für alle, trocken oder gekocht gewogen ---------- */
  async nudeln(browser){
    const hear = () => { class SR { start(){ SR.cur = this; } stop(){ setTimeout(() => this.onend && this.onend(), 20); } abort(){ this.stop(); } }
      window.SpeechRecognition = window.webkitSpeechRecognition = SR; window.__hear = t => { const r = SR.cur; if (r && r.onresult) r.onresult({resultIndex: 0, results: Object.assign([Object.assign([{transcript: t, confidence: .9}], {isFinal: true})], {length: 1})}); }; };
    const a = await L.open(browser, "tester", {before: hear}), b = await L.open(browser, "mila", {before: hear});
    const say = async (page, who, text) => { const n = (await meals(who)).length; await page.tap("#main [data-kc-say]"); await sleep(700); await page.evaluate(t => window.__hear(t), text); await sleep(400);
      if (await page.locator("#kcmic").isVisible().catch(() => false)){ await page.tap("#kcmic"); await sleep(300); } if (await page.locator("#kcvdone").isVisible().catch(() => false)) await page.tap("#kcvdone");
      await page.waitForSelector(".dsheet [data-commit]", {timeout: 8000}); await page.tap(".dsheet [data-commit]");
      for (let i = 0; i < 30 && (await meals(who)).length === n; i++) await sleep(200); return (await meals(who, "&limit=1"))[0]; };
    /* the stand-in AI guesses wildly different calories for the noodles each time; the table has to win */
    const m1 = await say(a, "tester", "250 g gekochte Nudeln mit Pesto"), m2 = await say(b, "mila", "180 Gramm gekochte Nudeln mit Pesto");
    const n1 = m1.items.find(i => /Nudeln/.test(i.name)), n2 = m2.items.find(i => /Nudeln/.test(i.name)), per = (i, g) => Math.round(i.kcal / g * 1000) / 10;
    ok(n1.kcal === 390 && n2.kcal === 281, "„gekochte Nudeln“: du 250 g = 390 kcal, die andere Person 180 g = 281 kcal", JSON.stringify([n1, n2]));
    ok(Math.abs(per(n1, 250) - per(n2, 180)) < .3 && Math.abs(per(n1, 250) - 156) < .5, "bei beiden derselbe Wert pro 100 g gekocht (156 kcal), egal was die KI schätzt", per(n1, 250) + " vs " + per(n2, 180));
    ok(m1.items.find(i => /Pesto/.test(i.name)).kcal === m2.items.find(i => /Pesto/.test(i.name)).kcal, "auch das Pesto hat bei beiden denselben Wert");
    ok(/gekocht/.test(n1.amount) && n1.ref === "pasta" && n1.st === "cooked", "die Position merkt sich „250 g gekocht“", JSON.stringify(n1));
    await closeSheets(a); await closeSheets(b);
    const m3 = await say(a, "tester", "100 g Nudeln trocken"); ok(m3.items[0].kcal === 359 && /trocken/.test(m3.items[0].amount), "„100 g Nudeln trocken“ = 359 kcal (Trockengewicht)", JSON.stringify(m3.items[0])); await closeSheets(a);
    /* a named product: exactly that product from Open Food Facts, not the value of the category */
    const m5 = await say(a, "tester", "250 g Barilla Spaghetti gekocht"), bs = m5.items[0];
    ok(/Spaghetti No\. 5 \(Barilla\)/.test(bs.name) && bs.code === "4000000000093", "Marke genannt („Barilla Spaghetti“): genau dieses Produkt aus Open Food Facts wird genommen", JSON.stringify([bs.name, bs.code]));
    ok(bs.kcal === 390 && bs.carbs === 77.4 && bs.per.ck === "cooked" && /250 g gekocht/.test(bs.amount), "mit den Werten der Packung (71,2 g KH trocken), umgerechnet auf 250 g gekocht", JSON.stringify([bs.kcal, bs.carbs, bs.amount, bs.per.k])); await closeSheets(a);
    const m6 = await say(a, "tester", "250 g Dingsbums Spaghetti gekocht");
    ok(m6.items[0].kcal === 390 && !m6.items[0].code && /Dingsbums Spaghetti.*nicht in Open Food Facts gefunden/.test(m6.note || ""), "unbekanntes Produkt: der allgemeine Wert wird genommen und das steht im Eintrag", JSON.stringify([m6.items[0].name, m6.items[0].kcal, m6.note])); await closeSheets(a);
    await clean([a, b], "Sprechen mit Tabelle");

    /* scan the pack over what was said: 250 g cooked stay 250 g cooked, with the pack's values */
    await a.locator("#main [data-meal]", {hasText: /250 g gekochte|Nudeln mit Pesto/}).first().tap(); await sleep(500); await a.locator(".dsheet [data-round]").tap(); await sleep(900);
    await a.evaluate(() => KCScan._round("4000000000093")); await a.waitForFunction(() => /Spaghetti/.test((document.querySelector("#kcrp") || {}).innerText || ""), null, {timeout: 6000}).catch(() => {});
    ok(/✓[\s\S]*Spaghetti/.test(await txt(a, "#kcrp")) && !(await has(a, "#kcrp .kc-rask")), "Packung Spaghetti gescannt: wird von selbst den gesagten „Nudeln“ zugeordnet", await txt(a, "#kcrp")); await a.shot("nudeln-scan-runde");
    await a.tap("#kcrdone"); await sleep(1200); const m4 = (await L.table("kcal_meals", "id=eq." + m1.id))[0], sp = m4.items.find(i => /Spaghetti/.test(i.name));
    ok(sp && sp.kcal === 390 && sp.g === 250 && sp.per.ck === "cooked", "die 250 g bleiben gekocht gewogen: 390 kcal mit den Werten der Packung (nicht 898 wie bei Trockengewicht)", JSON.stringify(sp && [sp.name, sp.amount, sp.kcal, sp.per.k]));
    await closeSheets(a); await clean(a, "Packung über Gesagtes scannen");

    /* scan a pack of noodles on its own: asked once how it was weighed */
    await a.tap("#main [data-kc-scan]"); await a.waitForSelector("#kccode"); await a.fill("#kccode", "4000000000093"); await a.locator("#kcman button").tap(); await a.waitForSelector("#kcadd", {timeout: 6000});
    ok(/Wie hast du gewogen/.test(await txt(a, ".dsheet")) && /100 g trocken werden gekocht etwa 230 g/.test(await txt(a, ".dsheet")), "Nudel-Packung scannen: fragt „Wie hast du gewogen?“ und nennt den Umrechnungssatz", (await txt(a, ".dsheet")).slice(0, 300));
    const n0 = (await meals("tester")).length; await a.tap("#kcadd"); await sleep(600); ok((await meals("tester")).length === n0 && await has(a, "#kcadd"), "ohne Auswahl wird nichts eingetragen");
    await a.tap('.dsheet [data-ck="cooked"]'); await sleep(600); await a.fill("#kcg", "250"); await a.locator("#kcg").blur(); await sleep(300); await a.shot("nudeln-scan-gekocht");
    ok(/pro 100 g gekocht: 156 kcal/.test(await txt(a, ".dsheet")), "gekocht gewählt: zeigt 156 kcal pro 100 g gekocht", (await txt(a, ".dsheet")).slice(0, 200));
    await a.tap("#kcadd"); await sleep(1100); let m = (await meals("tester", "&limit=1"))[0];
    ok(m.kcal === 390 && /gekocht/.test(m.items[0].amount), "250 g gekocht aus der gescannten Packung = 390 kcal", JSON.stringify([m.title, m.kcal, m.items[0].amount]));
    await a.tap("#main [data-kc-scan]"); await a.waitForSelector("#kccode"); await a.fill("#kccode", "4000000000109"); await a.locator("#kcman button").tap(); await a.waitForSelector("#kcadd", {timeout: 6000});
    ok(await has(a, '.dsheet [data-ck="cooked"].on'), "beim nächsten Mal (Reis) ist deine letzte Wahl schon gesetzt, kein Extra-Tipp"); await a.tap('.dsheet [data-ck="dry"]'); await sleep(600); await a.fill("#kcg", "100"); await a.locator("#kcg").blur(); await a.tap("#kcadd"); await sleep(1100);
    m = (await meals("tester", "&limit=1"))[0]; ok(m.kcal === 349 && /trocken/.test(m.items[0].amount), "Reis trocken gewogen: 100 g = 349 kcal wie auf der Packung", JSON.stringify([m.title, m.kcal, m.items[0].amount]));
    await a.tap("#main [data-kc-scan]"); await a.waitForSelector("#kccode"); await a.fill("#kccode", "4000000000116"); await a.locator("#kcman button").tap(); await a.waitForSelector("#kcadd", {timeout: 6000});
    ok(!(await has(a, ".dsheet .kc-ck")), "Reiswaffeln: keine Frage nach gekocht (wird nicht gekocht)"); await closeSheets(a); await clean(a, "Packung scannen");

    /* the table in the search */
    await a.tap("#main [data-kc-find]"); await sleep(400); await a.keyboard.type("nudeln", {delay: 20}); await a.waitForFunction(() => /Standardwert/.test((document.querySelector(".kc-sov") || {}).innerText || ""), null, {timeout: 5000}).catch(() => {});
    const first = await txt(a, ".kc-sres"); ok(/Nudeln, gekocht/.test(first) && /Standardwert/.test(first) && /156/.test(first), "Suche „nudeln“: zuerst „Nudeln, gekocht“ als Standardwert mit 156 kcal", first); await a.shot("nudeln-suche");
    await a.tap(".kc-sres"); await sleep(500); await a.locator(".kc-sadd input").fill("200"); await a.locator(".kc-sadd input").blur(); await a.tap(".kc-sadd [data-add]"); await sleep(1100);
    m = (await meals("tester", "&limit=1"))[0]; ok(m.kcal === 312 && m.items[0].per.tab === "pasta", "200 g aus der Tabelle = 312 kcal", JSON.stringify([m.title, m.kcal, m.items[0].amount]));
    await clean(a, "Tabelle in der Suche"); await a.context().close(); await b.context().close();
  },

  /* ---------- Kalorien: Reiter, Einstellungen, Ziel, Wiegen, Kochen, Wochen-Rückblick, Flamme ---------- */
  async kcal2(browser){
    const page = await L.open(browser, "tester");
    for (const [tab, re, name] of [["history", /Ø kcal|Rekord/, "Verlauf"], ["stats", /Ø Kalorien|Gewicht/, "Analyse"], ["friends", /Mila/, "Freunde"]]){
      await page.tap(`#main [data-tab="${tab}"]`); await sleep(900); ok(re.test(await txt(page, "#kcbody")), "Reiter " + name + " zeigt Inhalt", (await txt(page, "#kcbody")).slice(0, 120)); await page.shot("kcal-" + tab); }
    ok(/Mila/.test(await txt(page, "#kchrl")), "Freunde: Rankings zeigen Mila und dich");
    for (const k of ["health", "kcal", "prot", "adh"]){ await page.tap(`#main [data-hr="${k}"]`); await sleep(250); }
    ok(await has(page, '#main [data-hr="adh"].on'), "Ranking-Reiter lassen sich umschalten");
    ok(await has(page, '#main [data-inv]'), "Jonas (trackt nicht) lässt sich einladen");
    await page.tap("#main [data-inv]"); await sleep(800); ok((await L.table("kcal_invites", "to_id=eq." + ID.jonas)).length === 1, "Einladung landet in der Datenbank");
    /* applause: Mila reached her goal today */
    const clap = await has(page, "#main [data-clap]");
    ok(clap, "Applaudieren-Knopf bei Mila (Ziel heute erreicht)", "kein Knopf: die Tabelle kcal_claps gibt es in der echten Datenbank noch nicht");
    if (clap){ await page.tap("#main [data-clap]"); await sleep(700); ok((await L.table("kcal_claps")).length === 1, "Applaus wird gespeichert"); }
    await clean(page, "Reiter und Freunde", /kcal_claps/);

    /* settings */
    await page.tap('#main [data-tab="today"]'); await sleep(300); await page.tap("#kcset"); await sleep(500);
    await page.tap('.dsheet [data-goal="2800"]'); await sleep(800); ok((await L.table("kcal_profile", "user_id=eq." + ID.tester))[0].goal === 2800, "Tagesziel 2.800 gespeichert");
    for (const k of ["kcal", "protein", "carbs", "fat"]) if (await has(page, `.dsheet [data-show="${k}"].on`)){ await page.tap(`.dsheet [data-show="${k}"]`); await sleep(350); }
    for (const k of ["fat", "carbs", "kcal", "protein"]){ await page.tap(`.dsheet [data-show="${k}"]`); await sleep(450); }
    const show = (await L.table("kcal_profile", "user_id=eq." + ID.tester))[0].show;
    ok(JSON.stringify(show) === JSON.stringify(["fat", "carbs", "kcal"]), "Reihenfolge des Antippens gespeichert (höchstens drei: Fett, KH, Kalorien)", JSON.stringify(show));
    await page.shot("kcal-einstellungen"); await closeSheets(page); await sleep(400);
    ok(/FETT|Fett/.test(await txt(page, "#main .kc-sum .kc-b2")), "oben groß steht jetzt, was zuerst angetippt wurde (Fett)", await txt(page, "#main .kc-sum"));
    await clean(page, "Einstellungen");

    /* streak freeze */
    await page.tap("#main .kc-top [data-kc-fl]"); await sleep(500); ok(/Ice|Eis|🧊/.test(await txt(page, ".dsheet")), "Flamme antippen zeigt „Streak on Ice“"); await page.shot("kcal-ice"); await closeSheets(page);
    /* weigh-in */
    await page.tap('#main [data-tab="stats"]'); await sleep(400); await page.tap("#kcwnow"); await sleep(500); await page.fill("#kwkg", "78,6");
    const poop = page.locator(".dsheet [data-p], .dsheet [data-pd]").first(); if (await poop.count()) await poop.tap(); await page.tap("#kwsave"); await sleep(900);
    const w = (await L.table("kcal_weights", "user_id=eq." + ID.tester + "&order=created_at.desc&limit=1"))[0]; ok(w && w.kg === 78.6, "Wiegen speichert 78,6 kg", JSON.stringify(w)); await closeSheets(page);
    await clean(page, "Flamme und Wiegen");
    /* cooking */
    await page.tap("#kccook"); await sleep(500); await page.fill("#kch", "Hähnchen, Reis, Paprika"); await page.tap("#kcgo"); await page.waitForFunction(() => /Hähnchen-Reis/.test(document.querySelector("#kcout").innerText), null, {timeout: 6000}).catch(() => {});
    ok(/Hähnchen-Reis-Pfanne/.test(await txt(page, "#kcout")), "Kochen: Vorschlag mit Grammzahlen kommt", (await txt(page, "#kcout")).slice(0, 150)); await page.shot("kcal-kochen");
    const eat = page.locator("#kceat"); if (await eat.count()){ const n = (await meals("tester")).length; await eat.tap(); await sleep(900); ok((await meals("tester")).length === n + 1, "Gericht lässt sich direkt eintragen"); }
    await closeSheets(page); await clean(page, "Kochen");
    /* weekly review */
    await page.tap('#main [data-tab="stats"]'); await sleep(300); await page.tap("#kcwrap"); await page.waitForFunction(() => /Solide Woche/.test(document.body.innerText), null, {timeout: 8000}).catch(() => {});
    ok(/Solide Woche/.test(await txt(page, ".kc-wrap")), "Wochen-Rückblick: Zahlen und Coach-Text kommen", (await txt(page, ".kc-wrap")).slice(0, 200)); await page.shot("kcal-woche");
    ok(await page.locator("#kcwok").isDisabled(), "„Gelesen“ ist erst nach ein paar Sekunden tippbar"); await sleep(5600); await page.tap("#kcwok").catch(() => {}); await sleep(400);
    ok(!(await has(page, ".kc-wrap")), "danach lässt er sich schließen"); await clean(page, "Wochen-Rückblick"); await page.context().close();
  },

  /* ---------- Einkaufsliste zu zweit: Nat Tester (Besitzer) und Mila gleichzeitig ---------- */
  async shop(browser){
    const a = await L.open(browser, "tester"), b = await L.open(browser, "mila");
    a.on("dialog", d => d.accept(d.type() === "prompt" ? "Party" : undefined)); b.on("dialog", d => d.accept(d.type() === "prompt" ? "halbe Packung" : undefined));
    const rows = p => p.evaluate(() => [...document.querySelectorAll("#kcslst .kc-shr:not(.log) .kc-shn b")].map(e => e.firstChild.textContent.trim()));
    await a.tap("#kcshop"); await a.waitForSelector("#kcsha"); await sleep(700);
    ok(/Milch/.test(await txt(a, "#kcslst")), "Liste öffnet mit den Produkten", (await txt(a, "#kcslst")).slice(0, 200));
    ok(/Obst & Gemüse[\s\S]*Kühlregal/.test(await txt(a, "#kcslst")), "nach Abteilungen im Laufweg sortiert (Obst & Gemüse vor Kühlregal)");
    ok(await a.evaluate(() => document.querySelector("#kcsha").placeholder === "Was fehlt?"), "Feld zeigt „Was fehlt?“"); await a.shot("shop-liste");
    await b.evaluate(() => App.go("kcal")); await sleep(500); await b.tap("#kcshop"); await b.waitForSelector("#kcsha"); await sleep(700);
    ok(/Milch/.test(await txt(b, "#kcslst")), "Mila sieht die geteilte Liste");
    await clean([a, b], "Liste öffnen");

    /* several products at once */
    await a.fill("#kcsha", "Butter, Zucker und Mehl"); await a.tap("#kcshb [data-add]"); await sleep(1500);
    const it = await L.table("shop_items", "name=in.(Butter,Zucker,Mehl)");
    ok(it.length === 3 && it.every(i => i.added_by === ID.tester && i.kind === "product"), "„Butter, Zucker und Mehl“ + OK legt drei Produkte an", JSON.stringify(it.map(i => i.name)));
    ok(new Set(it.map(i => i.created_at)).size === 1, "(die drei haben in der Datenbank denselben Zeitstempel, wie echt)");
    await sleep(700); ok(/Butter/.test(await txt(b, "#kcslst")) && /Mehl/.test(await txt(b, "#kcslst")), "bei Mila erscheinen sie live", (await txt(b, "#kcslst")).slice(0, 250));
    const orderA = await rows(a); ok(JSON.stringify(orderA) === JSON.stringify(await rows(b)), "beide sehen dieselbe Reihenfolge", JSON.stringify(orderA) + " vs " + JSON.stringify(await rows(b)));
    await clean([a, b], "Mehrere Produkte");

    /* fast ticking: five taps in a row, nothing may move or get lost */
    const names = ["Milch", "Tomaten", "Butter", "Zucker", "Mehl"];
    for (const n of names) await a.locator("#kcslst .kc-shr", {hasText: n}).first().locator(".kc-shc").tap();
    ok(JSON.stringify(await rows(a)) === JSON.stringify(orderA), "schnelles Abhaken von fünf Produkten: keine Zeile wechselt den Platz", JSON.stringify(await rows(a)));
    await sleep(2200); const done = await L.table("shop_items", "name=in.(" + names.join(",") + ")");
    ok(done.every(i => i.done_by === ID.tester), "alle fünf sind in der Datenbank abgehakt", JSON.stringify(done.map(i => i.name + ":" + !!i.done_by)));
    ok(JSON.stringify(await rows(a)) === JSON.stringify(orderA), "auch nach dem Nachladen steht alles an seinem Platz", JSON.stringify(await rows(a)));
    ok(await a.locator("#kcslst .kc-shr.done", {hasText: "Butter"}).count() === 1, "Abgehaktes bleibt durchgestrichen stehen");
    ok(await b.locator("#kcslst .kc-shr.done", {hasText: "Butter"}).count() === 1, "Mila sieht das Abgehakte live"); await a.shot("shop-abgehakt");
    await a.locator("#kcslst .kc-shr", {hasText: "Milch"}).first().locator(".kc-shc").tap(); await sleep(1500);
    ok((await L.table("shop_items", "name=eq.Milch"))[0].done_by === null, "nochmal tippen nimmt den Haken zurück");
    await clean([a, b], "Abhaken");

    /* "I'll buy it", and asking whether it's still at home */
    await b.locator("#kcslst .kc-shr", {hasText: "Bananen"}).first().locator("[data-claim]").tap(); await sleep(1300);
    ok((await L.table("shop_items", "name=eq.Bananen"))[0].claimed_by === ID.mila, "„Kaufe ich“ von Mila gespeichert"); ok(/Mila/.test(await txt(a, '#kcslst .kc-shr:has-text("Bananen")')), "bei dir steht, dass Mila es kauft", await txt(a, '#kcslst .kc-shr:has-text("Bananen")'));
    await a.locator("#kcslst .kc-shr", {hasText: "Toilettenpapier"}).first().locator("[data-ask]").tap(); await sleep(1200);
    ok(/Toilettenpapier/.test(await txt(b, ".kc-askc")), "Fragezeichen: bei Mila geht die Karte „Ist noch Toilettenpapier zu Hause?“ auf", await txt(b, ".kc-askc")); await b.shot("shop-frage");
    if (await has(b, '.kc-askc [data-a="yes"]')){ await b.fill(".kc-askc .kc-aski", "halbe Packung"); await b.tap('.kc-askc [data-a="yes"]'); await sleep(1600);
      const ans = await L.table("shop_answers"); ok(ans.length === 1 && ans[0].answer === "yes" && ans[0].amount === "halbe Packung", "Milas Antwort „Ja, halbe Packung“ gespeichert", JSON.stringify(ans));
      ok(/Mila/.test(await txt(a, ".kc-askc")) && /Toilettenpapier ist noch da/.test(await txt(a, ".kc-askc")) && /halbe Packung/.test(await txt(a, ".kc-askc")), "die Antwort kommt bei dir als Karte an", await txt(a, ".kc-askc")); await a.shot("shop-antwort"); await closeSheets(a); await sleep(500);
      ok(/Noch da · halbe Packung/.test(await txt(a, '#kcslst .kc-shr:has-text("Toilettenpapier")')), "und steht als Marke „✓ Noch da“ am Produkt", await txt(a, '#kcslst .kc-shr:has-text("Toilettenpapier")'));
      ok(await has(a, '#kcslst .kc-shr:has-text("Toilettenpapier") .kc-shq.on'), "das Fragezeichen leuchtet nach der Frage"); }
    await a.tap("#kcshb [data-imshop]"); await sleep(1300);
    ok(/ist gerade einkaufen/.test(await txt(b, ".kc-askc")), "„Ich bin einkaufen“ kommt bei Mila als Karte an", (await txt(b, ".kc-askc")).slice(0, 150));
    ok(/Alle gefragt/.test(await txt(a, "#kcshb [data-imshop]")), "bei dir bleibt der Knopf markiert („Alle gefragt“)", await txt(a, "#kcshb [data-imshop]"));
    if (await has(b, ".kc-askc .kc-aski")){ await b.fill(".kc-askc .kc-aski", "Chips und Cola"); await b.tap(".kc-askc [data-send]"); await sleep(1600);
      const w = await L.table("shop_items", "name=in.(Chips,Cola)"); ok(w.length === 2 && w.every(i => i.added_by === ID.mila), "Milas Wünsche „Chips und Cola“ landen direkt auf der Liste", JSON.stringify(w.map(i => i.name)));
      ok(/Chips/.test(await txt(a, "#kcslst")) && /Cola/.test(await txt(a, "#kcslst")), "und erscheinen bei dir live"); }
    await closeSheets(b);
    await clean([a, b], "Kaufe ich / Fragen");

    /* dishes */
    await a.tap('#kcshb [data-view="dish"]'); await sleep(400); ok(/Lasagne/.test(await txt(a, "#kcslst")) && /3 von 3 fehlen/.test(await txt(a, "#kcslst")), "Umschalter „Gerichte“: Lasagne mit eigener Zutaten-Liste", (await txt(a, "#kcslst")).slice(0, 200)); await a.shot("shop-gerichte");
    await a.tap("#kcslst [data-to]"); await sleep(300); ok(/Zutat für Lasagne/.test(await a.evaluate(() => document.querySelector("#kcsha").placeholder)), "„+ Zutat“ schaltet das Feld auf das Gericht");
    await a.fill("#kcsha", "Mozzarella"); await a.keyboard.press("Enter"); await sleep(1300);
    ok((await L.table("shop_items", "name=eq.Mozzarella"))[0].parent === "aaaaaaaa-0000-4000-8000-0000000000d1", "die Zutat landet unter dem Gericht");
    await a.tap("#kcsto [data-noto]"); await sleep(300); ok(await a.evaluate(() => document.querySelector("#kcsha").placeholder === "Was fehlt?"), "× beendet „Zutat für …“ wieder");
    await a.tap('#kcshb [data-view="all"]'); await sleep(300); await a.fill("#kcsha", "Ich will Chili machen und brauche noch 2 Liter Cola"); await a.tap("#kcshb [data-add]"); await sleep(2500);
    const dish = await L.table("shop_items", "kind=eq.dish&order=created_at.desc&limit=1"); ok(dish.length && (await L.table("shop_items", "parent=eq." + dish[0].id)).length === 3, "ein ganzer Satz wird in Gericht + Zutaten sortiert", JSON.stringify(dish.map(d => d.name)));
    await clean([a, b], "Gerichte");

    /* delete with two taps, typing a space, lists and sharing */
    const del = a.locator("#kcslst .kc-shr", {hasText: "Tomaten"}).first().locator("[data-del]"); await del.tap(); await sleep(200); ok(/Löschen\?/.test(await del.innerText()), "Löschen fragt beim ersten Tipp nach"); await del.tap(); await sleep(1300);
    ok(!(await L.table("shop_items", "name=eq.Tomaten")).length, "zweiter Tipp löscht");
    await a.tap("#kcsha"); await a.keyboard.type("was sehr leckeres", {delay: 25}); ok(await a.inputValue("#kcsha") === "was sehr leckeres", "im Feld lassen sich Leerzeichen und alle Buchstaben tippen", await a.inputValue("#kcsha")); await a.fill("#kcsha", "");
    await a.tap("#kcsftr [data-new]"); await sleep(1200); ok((await L.table("shop_lists", "name=eq.Party")).length === 1 && /Noch nichts/.test(await txt(a, "#kcslst")), "neue Liste „Party“ angelegt und geöffnet");
    await a.tap("#kcsftr [data-share]"); await sleep(500); await a.locator(".dsheet [data-m]").first().tap(); await sleep(900);
    ok((await L.table("shop_members", "list_id=eq." + (await L.table("shop_lists", "name=eq.Party"))[0].id)).length === 1, "Teilen: Freund zur Liste hinzugefügt"); await closeSheets(a);
    await clean([a, b], "Löschen, Listen, Teilen", /Dialog/);
    /* a list Mila doesn't share stays hidden from her */
    const mine = await b.evaluate(async () => (await ChessSite.sb.from("shop_lists").select("name")).data.map(x => x.name)); ok(mine.includes("Einkaufsliste"), "Mila kommt nur an Listen, die mit ihr geteilt sind", JSON.stringify(mine));
    await a.tap("#kcshx"); await sleep(400); ok(!(await has(a, ".kc-shov")), "„Fertig“ schließt die Liste"); await a.context().close(); await b.context().close();
  },

  /* ---------- Chat zwischen zwei Handys, Freunde, Spielen ---------- */
  async chat(browser){
    const a = await L.open(browser, "tester"), b = await L.open(browser, "mila");
    await a.tap('#tabbar [data-t="friends"]'); await sleep(900); ok(/Mila/.test(await txt(a, "#main")) && /Jonas/.test(await txt(a, "#main")), "Freunde-Seite zeigt Mila und Jonas"); ok(/Ole/.test(await txt(a, "#main")), "offene Anfrage von Ole wird gezeigt"); await a.shot("freunde");
    await a.evaluate(id => App.go("chat", {id}), ID.mila); await a.waitForSelector("#ctext"); await sleep(800); await b.evaluate(id => App.go("chat", {id}), ID.tester); await b.waitForSelector("#ctext"); await sleep(800);
    ok(/Ich bin weiß/.test(await txt(a, "#cmsgs")), "Chat zeigt den bisherigen Verlauf");
    const SAY = "probier mal, ob es jetzt geht"; await a.tap("#ctext"); await a.keyboard.type(SAY, {delay: 20}); ok(await a.inputValue("#ctext") === SAY, "Tippen im Chat: jeder Buchstabe und jedes Leerzeichen kommt an", await a.inputValue("#ctext"));
    await a.keyboard.press("Enter"); await sleep(1200); ok(new RegExp(SAY).test(await txt(b, "#cmsgs")), "die Nachricht erscheint bei Mila live", (await txt(b, "#cmsgs")).slice(-120));
    await b.tap("#ctext"); await b.keyboard.type("Geht! 🎉", {delay: 20}); await b.keyboard.press("Enter"); await sleep(1200); ok(/Geht! 🎉/.test(await txt(a, "#cmsgs")), "Milas Antwort erscheint bei dir live");
    ok((await L.table("chess_messages", "body=eq." + encodeURIComponent(SAY)))[0].read_at, "gelesen-Haken: die Nachricht ist als gelesen markiert");
    await a.shot("chat"); await clean([a, b], "Chat");
    /* after a round of Nat Stars the keys must still type */
    await a.evaluate(() => App.go("party", {g: "arena"})); await sleep(900); await a.locator("#main button", {hasText: "Gegen Bots"}).first().tap(); await sleep(6500); await a.shot("natstars");
    ok(await a.evaluate(() => !!document.querySelector(".ar-l")), "Nat Stars startet gegen Bots"); await a.evaluate(() => document.querySelector("#lleave").click()); await sleep(1200);
    await a.evaluate(id => App.go("chat", {id}), ID.mila); await a.waitForSelector("#ctext"); await sleep(600); await a.tap("#ctext"); await a.keyboard.type("was die sache ist", {delay: 20});
    ok(await a.inputValue("#ctext") === "was die sache ist", "nach einer Runde Nat Stars: W A S D E Q und Leerzeichen lassen sich weiter tippen", await a.inputValue("#ctext"));
    await clean([a, b], "Nat Stars und zurück", /AudioContext|play\(\)/);
    /* friends → play leads to every game */
    await a.evaluate(() => App.go("friends", {tab: "friends"})); await sleep(900);
    const play = a.locator("#main .fa-play, #main [data-play], #main button:has-text('Spielen')").first();
    if (ok(await play.count() > 0, "Freunde: „Spielen“-Knopf bei einem Freund")){ await play.tap(); await sleep(600); const t = await txt(a, ".dsheet"); ok(/Schach/.test(t) && /Nat Stars/.test(t) && /Natposter/.test(t) && /Party/.test(t), "„Spielen“ führt zu jedem Spiel (Schach, Natposter, Nat Stars, Partyspiele)", t.slice(0, 200)); await a.shot("freunde-spielen"); await closeSheets(a); }
    await clean([a, b], "Freunde → Spielen"); await a.context().close(); await b.context().close();
  },

  /* ---------- Tippspiel ---------- */
  async tipp(browser){
    const page = await L.open(browser, "tester"); await page.tap('#tabbar [data-t="tipp"]'); await sleep(1500);
    const t = await txt(page, "#main"); ok(/Bayern/.test(t) && /Leipzig/.test(t) && /3 offen/.test(t), "Tippspiel zeigt die offenen Spiele (3 offen)", t.slice(0, 200)); await page.shot("tipp");
    ok(/Makhachev/.test(t), "UFC-Titelkampf ist tippbar gelistet", t.slice(0, 300));
    await clean(page, "Tippspiel öffnen");
    /* only the result: plus and minus, saved at once */
    const plus = page.locator('#main [data-d="1"]'); await plus.nth(0).tap(); await sleep(250); await plus.nth(0).tap(); await sleep(250); await plus.nth(1).tap(); await sleep(1500);
    const pick = (await L.table("tipp_picks", "event_id=eq.t-pre&user_id=eq." + ID.tester))[0];
    ok(pick && pick.sh != null && pick.sa != null, "Ergebnis mit + tippen wird sofort gespeichert", JSON.stringify(pick));
    if (pick) ok(new RegExp("Bayern . " + pick.sh + " . Dortmund . " + pick.sa).test((await txt(page, "#main")).replace(/[−+]/g, ".")), "die Seite zeigt denselben Tipp wie die Datenbank (" + pick.sh + ":" + pick.sa + ")", (await txt(page, "#main")).slice(120, 260));
    await page.tap('#main [data-w="a"]'); await sleep(1200); const ufc = (await L.table("tipp_picks", "event_id=eq.t-ufc&user_id=eq." + ID.tester))[0]; ok(ufc && ufc.w === "a", "UFC: Sieger tippen gespeichert", JSON.stringify(ufc));
    await page.tap('#main [data-tab="res"]'); await sleep(1000); const r = await txt(page, "#main"); ok(/Leverkusen/.test(r) && /Freiburg/.test(r), "Ergebnisse: laufendes und beendetes Spiel", r.slice(0, 250)); await page.shot("tipp-ergebnisse");
    await page.tap('#main [data-tab="table"]'); await sleep(1000); const tb = await txt(page, "#main"); ok(/Nat Tester|Du/.test(tb) && /Mila/.test(tb), "Rangliste zeigt dich und Mila", tb.slice(0, 250)); await page.shot("tipp-rangliste");
    await clean(page, "Tippen"); await page.context().close();
  },

  /* ---------- Feedback im Mehr-Menü ---------- */
  async feedback(browser){
    const page = await L.open(browser, "tester"); await page.evaluate(() => openSheet()); await sleep(400); await page.locator('#sheet [data-s="__feedback"]').tap(); await sleep(600);
    ok(await has(page, "#fbtx"), "Mehr → Feedback öffnet das Formular"); await page.fill("#fbtx", "Test: die Einkaufsliste ist super"); await page.tap("#fbs"); await sleep(1000);
    const f = await L.table("chess_feedback"); ok(f.length === 1 && f[0].name === "Nat Tester" && /Start|home/.test(f[0].info || ""), "Feedback mit Name und Geräte-Info gespeichert", JSON.stringify(f));
    ok(/die Einkaufsliste ist super/.test(await txt(page, "#fbl")), "es steht danach im eigenen Feedback-Log"); await page.shot("feedback"); await clean(page, "Feedback"); await page.context().close();
  },

  /* ---------- jede Seite einmal öffnen, am Handy und am PC ---------- */
  async seiten(browser){
    for (const desktop of [false, true]){
      const page = await L.open(browser, "tester", {desktop}), routes = await page.evaluate(() => Object.keys(Views)), broken = [];
      for (const r of routes){ if (["lobby", "linkgame", "duel", "online", "lesson", "jlevel", "fprofile", "repdrill"].includes(r)) continue;
        await page.evaluate(r => { try { App.go(r); } catch(e) { window.__goErr = String(e && e.stack || e); } }, r); await sleep(450);
        const st = await page.evaluate(() => { const e = window.__goErr; window.__goErr = null; return {e, empty: !document.querySelector("#main").innerText.trim() && !document.querySelector("#main canvas, #main svg, #main img")}; });
        const bad = page.bad.splice(0); if (st.e || st.empty || bad.length) broken.push(r + ": " + (st.e || (st.empty ? "leere Seite" : "") || bad.map(b => b.kind + " " + b.text).join("; ")).slice(0, 200));
        await page.evaluate(() => { document.querySelectorAll(".dsheet [data-dclose]").forEach(b => b.click()); }); }
      ok(!broken.length, (desktop ? "PC" : "Handy") + ": alle " + routes.length + " Seiten öffnen ohne Fehler", broken.join("\n      ")); await clean(page, "Seiten " + (desktop ? "PC" : "Handy"), /kcal_claps/); await page.context().close();
    }
  },

  /* ---------- Start und Home: nichts flackert ---------- */
  async start(browser){
    await fetch(L.BASE + "/__fake/delay?ms=250");
    const page = await L.open(browser, "tester"); const first = await page.evaluate(() => window.__fx);
    ok(first.rebuilds <= 2, "App-Start: die Startseite wird höchstens zweimal aufgebaut (einmal aus dem Handy-Speicher, einmal mit frischen Daten)", JSON.stringify(first));
    await page.tap('#tabbar [data-t="tipp"]'); await sleep(1500); await page.evaluate(() => { window.__fx.fades = 0; window.__fx.rebuilds = 0; }); await page.tap('#tabbar [data-t="home"]'); await sleep(2500);
    const fx = await page.evaluate(() => window.__fx); ok(fx.fades === 1 && fx.rebuilds === 1, "Tipp auf Home: die Seite blendet genau einmal ein und wird einmal aufgebaut (kein Flackern)", JSON.stringify(fx));
    await fetch(L.BASE + "/__fake/delay?ms=0"); await clean(page, "Start und Home"); await page.context().close();
  },

  /* ---------- die Tabellenwerte kommen aus Open Food Facts (Median der Kategorie). Muss der letzte Teil sein: er stellt die Tabelle um ---------- */
  async quelle(browser){
    await fetch(L.BASE + "/__fake/off-cats?on=1");
    const j = await (await fetch(L.BASE + "/api/foods?debug=1")).json(), pa = j.foods.pasta;
    ok(pa && pa.k === 351 && pa.n === 29, "/api/foods: Nudeln = Median aus 29 Packungen der Kategorie (351 kcal), das falsch einsortierte Fertiggericht fliegt raus", JSON.stringify(pa));
    ok(j.miss.includes("reis") && !j.foods.reis, "ein Lebensmittel ohne genug Produkte wird als fehlend gemeldet und behält seinen Tabellenwert", JSON.stringify(j.miss).slice(0, 120));
    const hear = () => { class SR { start(){ SR.cur = this; } stop(){ setTimeout(() => this.onend && this.onend(), 20); } abort(){ this.stop(); } }
      window.SpeechRecognition = window.webkitSpeechRecognition = SR; window.__hear = t => { const r = SR.cur; if (r && r.onresult) r.onresult({resultIndex: 0, results: Object.assign([Object.assign([{transcript: t, confidence: .9}], {isFinal: true})], {length: 1})}); }; };
    const page = await L.open(browser, "tester", {before: hear}); await page.evaluate(() => KCAL_FOODS.ready);
    ok(await page.evaluate(() => KCAL_FOODS.byId.pasta.k === 351 && KCAL_FOODS.byId.pasta.src.n === 29 && KCAL_FOODS.byId.reis.k === 351), "die App übernimmt die Werte von /api/foods (Nudeln 351), der Rest bleibt");
    await page.tap("#main [data-kc-find]"); await sleep(400); await page.keyboard.type("nudeln", {delay: 20}); await page.waitForFunction(() => /Open Food Facts/.test((document.querySelector(".kc-sov") || {}).innerText || ""), null, {timeout: 5000}).catch(() => {});
    const first = await txt(page, ".kc-sres"); ok(/Nudeln, gekocht/.test(first) && /Open Food Facts · Mittel aus 29 Produkten/.test(first) && /153/.test(first), "Suche nennt die Quelle: „Open Food Facts · Mittel aus 29 Produkten“, 153 kcal gekocht", first); await page.shot("quelle-suche"); await page.tap("#kcsx"); await sleep(400);
    const n = (await meals("tester")).length; await page.tap("#main [data-kc-say]"); await sleep(700); await page.evaluate(() => window.__hear("250 g gekochte Nudeln")); await sleep(400);
    if (await page.locator("#kcmic").isVisible().catch(() => false)){ await page.tap("#kcmic"); await sleep(300); } if (await page.locator("#kcvdone").isVisible().catch(() => false)) await page.tap("#kcvdone");
    await page.waitForSelector(".dsheet [data-commit]", {timeout: 8000}); await page.tap(".dsheet [data-commit]");
    for (let i = 0; i < 30 && (await meals("tester")).length === n; i++) await sleep(200); const m = (await meals("tester", "&limit=1"))[0];
    ok(m.items[0].kcal === 382, "Sprechen rechnet mit demselben Wert: 250 g gekocht = 382 kcal (351 ÷ 2,3 × 2,5)", JSON.stringify(m.items[0]));
    await fetch(L.BASE + "/__fake/off-cats?on=0"); await clean(page, "Quelle Open Food Facts"); await page.context().close();
  }
};

(async () => {
  const {browser, stop} = await L.start(); let crashed = 0;
  for (const [name, fn] of Object.entries(PARTS)){
    if (only.length && !only.includes(name)) continue;
    part = name; console.log("\n" + name); await fetch(L.BASE + "/__fake/reset" + (process.env.FAKE_PENDING === "1" ? "?pending=1" : "")); seen = 0;
    try { await fn(browser); } catch(e) { crashed++; ok(false, "Ablauf abgebrochen", String(e && e.message || e).split("\n").slice(0, 4).join(" ")); for (const c of browser.contexts()) await c.close().catch(() => {}); }
  }
  await stop();
  const bad = results.filter(r => !r.ok);
  console.log("\n" + "=".repeat(60) + "\n" + (results.length - bad.length) + " von " + results.length + " Prüfungen bestanden" + (bad.length ? ", " + bad.length + " nicht:" : "."));
  bad.forEach(r => console.log("  ✗ [" + r.part + "] " + r.name + (r.detail ? "\n      " + r.detail : "")));
  console.log("Bilder: " + L.OUT); process.exit(bad.length ? 1 : 0);
})();
