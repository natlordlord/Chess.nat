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
    /* "2×" only shows what it would be; × leaves the meal as it was, "Passt" keeps it */
    const openHafer = async () => { await page.locator("#main [data-meal]", {hasText: "Haferflocken"}).first().tap(); await sleep(700); };
    await page.locator('.dsheet [data-f="2"]').tap(); await sleep(900);
    m = (await L.table("kcal_meals", "title=eq.Haferflocken mit Banane"))[0];
    ok(m.kcal === 810 && /1\.620/.test(await txt(page, ".dsheet")) && /Erst „Passt“/.test(await txt(page, ".dsheet")), "„2ד zeigt nur die Vorschau (1.620 kcal) mit Hinweis, gespeichert ist noch nichts", m.kcal + " / " + (await txt(page, ".dsheet")).slice(0, 120)); await page.shot("kcal-mal2");
    await page.locator(".dsheet .dx").last().tap(); await sleep(700);
    m = (await L.table("kcal_meals", "title=eq.Haferflocken mit Banane"))[0]; ok(m.kcal === 810 && !(await has(page, ".dsheet")), "mit × geschlossen: der Eintrag bleibt bei 810 kcal", m.kcal);
    await openHafer(); ok(/810/.test(await txt(page, ".dsheet .kc-mk")), "wieder geöffnet: zeigt den alten Wert", await txt(page, ".dsheet .kc-mk"));
    await page.locator('.dsheet [data-f="2"]').tap(); await sleep(500); await page.locator(".dsheet .kc-row2 .btn.go").tap(); await sleep(1000);
    m = (await L.table("kcal_meals", "title=eq.Haferflocken mit Banane"))[0]; ok(m.kcal === 1620 && !(await has(page, ".dsheet")), "„2ד und dann „Passt“ verdoppelt den Eintrag (1.620 kcal)", m.kcal);
    await openHafer();
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

    /* speaking on Android: after a pause the phone starts a new piece; nothing said before may get lost (Feedback von Adri) */
    { const R = a => Object.assign(a.map(t => Object.assign([{transcript: t}], {isFinal: true})), {length: a.length});
      const st = await page.evaluate(([x, y]) => [Kcal.srText(x, true), Kcal.srText(y, true)], [R(["zu Mittag gab's Nudeln", "und zu Abend Pizza", "dazu einen halben Liter Cola"]), R(["zu Mittag", "zu Mittag gab's Nudeln", "zu Mittag gab's Nudeln und zu Abend Pizza"])]);
      ok(st[0] === "zu Mittag gab's Nudeln und zu Abend Pizza dazu einen halben Liter Cola", "Android, neue Stücke nach Pausen: alles Gesagte bleibt", st[0]);
      ok(st[1] === "zu Mittag gab's Nudeln und zu Abend Pizza", "Android, Stücke wiederholen das Bisherige: nichts doppelt", st[1]); }

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

    /* a pack Open Food Facts doesn't know: photograph the nutrition table, confirm, and it is mine from then on */
    await page.tap("#main [data-kc-scan]"); await page.waitForSelector("#kccode", {timeout: 6000}).catch(() => {});
    await page.fill("#kccode", "4999999999993"); await page.locator("#kcman button").tap(); await page.waitForSelector("#kclab", {timeout: 6000}).catch(() => {});
    if (ok(await has(page, "#kclab") && await has(page, "#kcname"), "Unbekannte Packung: bietet „Nährwerte abfotografieren“ und „Beim Namen suchen“ an")){ await page.shot("kcal-unbekannt");
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC", "base64");
      const [fc] = await Promise.all([page.waitForEvent("filechooser", {timeout: 6000}), page.tap("#kclab")]); await fc.setFiles({name: "tabelle.png", mimeType: "image/png", buffer: png});
      await page.waitForSelector("#kclok", {timeout: 8000}).catch(() => {}); await sleep(900);
      const top = () => page.evaluate(() => { const l = [...document.querySelectorAll(".dsheet")]; return l.length ? l[l.length - 1].innerText.replace(/\s+/g, " ") : ""; });
      ok(/Stimmt das mit der Packung/.test(await top()) && /76 kcal/.test(await top()) && /9,4 g/.test(await top()) && !/Ballaststoffe/.test(await top()), "Foto der Nährwerttabelle: zeigt die abgelesenen Werte zum Bestätigen (nicht Gedrucktes fehlt)", (await top()).slice(0, 300)); await page.shot("kcal-etikett");
      ok(/Milbona Skyr Vanille/.test(await page.inputValue("#kcln")), "Name vom Etikett ist vorausgefüllt");
      /* "Stimmt" opens the camera once more, for the front of the pack; closing it without a picture saves nothing yet */
      { const [f0] = await Promise.all([page.waitForEvent("filechooser", {timeout: 6000}), page.tap("#kclok")]); await f0.setFiles([]); await page.evaluate(() => { const i = document.querySelector("#kclabf"); if (i) i.dispatchEvent(new Event("cancel")); }); await sleep(500);
        ok((await L.table("kcal_own_products")).length === 0 && await page.evaluate(() => { const b = document.querySelector("#kclnop"); return !!b && !b.hidden; }), "Vorderseite nicht fotografiert: noch nichts gespeichert, „Ohne Bild speichern“ wird angeboten"); }
      const [fc2] = await Promise.all([page.waitForEvent("filechooser", {timeout: 6000}), page.tap("#kclok")]); await fc2.setFiles({name: "vorne.png", mimeType: "image/png", buffer: png});
      await page.waitForSelector("#kcadd", {timeout: 6000}).catch(() => {}); await sleep(900);
      const own = await L.table("kcal_own_products"); ok(own.length === 1 && own[0].code === "4999999999993" && Number(own[0].k) === 76 && own[0].status === "new" && own[0].user_id === ID.tester && (own[0].img || "").startsWith("data:image/jpeg"), "gespeichert, mit Foto der Tabelle zum Prüfen", JSON.stringify(own.map(o => [o.code, o.k, o.status])));
      ok((own[0].pic || "").startsWith("data:image/jpeg;base64,") && own[0].pic.length < 60000 && await page.evaluate(() => { const l = [...document.querySelectorAll(".dsheet")], i = l.length && l[l.length - 1].querySelector(".kc-ph img"); return !!i && i.src.startsWith("data:image/jpeg"); }), "Foto der Vorderseite ist gespeichert und steht beim Produkt", String((own[0].pic || "").length));
      ok(/Skyr/.test(await top()) && /76 kcal/.test(await top()), "danach gleich die Menge wählen", (await top()).slice(0, 200));
      if (await has(page, "#kcadd")){ await page.tap("#kcadd"); await sleep(1000); m = (await meals("tester", "&limit=1"))[0]; ok(m.code === "4999999999993" && m.kcal > 0, "Mahlzeit mit dem eigenen Produkt eingetragen", JSON.stringify([m.title, m.kcal, m.grams])); }
      await closeSheets(page);
      /* scanned again (also on a fresh phone): found without a photo */
      await page.evaluate(() => localStorage.removeItem("chessnat-off-4999999999993"));
      await page.tap("#main [data-kc-scan]"); await page.waitForSelector("#kccode", {timeout: 6000}).catch(() => {}); await page.fill("#kccode", "4999999999993"); await page.locator("#kcman button").tap(); await page.waitForSelector("#kcadd", {timeout: 6000}).catch(() => {});
      ok(/Skyr/.test(await txt(page, ".dsheet")), "nochmal gescannt: wird ohne Foto gefunden", (await txt(page, ".dsheet")).slice(0, 120)); }
    /* everybody else gets it too, at once: by its barcode and in the search, with the name of who photographed it */
    { const b2 = await L.open(browser, "mila");
      await b2.tap("#main [data-kc-scan]"); await b2.waitForSelector("#kccode", {timeout: 6000}).catch(() => {}); await b2.fill("#kccode", "4999999999993"); await b2.locator("#kcman button").tap(); await b2.waitForSelector("#kcadd", {timeout: 6000}).catch(() => {});
      ok(/Skyr/.test(await txt(b2, ".dsheet")) && /76 kcal/.test(await txt(b2, ".dsheet")), "Foto-Produkt: eine andere Person findet es per Barcode, ohne selbst zu fotografieren", (await txt(b2, ".dsheet")).slice(0, 160));
      await closeSheets(b2); if (await has(b2, ".kc-scanov, .kc-ov-full")) await b2.evaluate(() => document.querySelectorAll(".kc-ov-full [data-x], .kc-ov-full .kc-x").forEach(x => x.click()));
      await b2.tap("[data-kc-find]"); await b2.waitForSelector("#kcq", {timeout: 6000}).catch(() => {});
      await b2.fill("#kcq", "Skyr Vanille"); await sleep(1800);
      const hit = await txt(b2, "#kcsr"); ok(/Milbona Skyr Vanille/.test(hit) && /Foto von Nat Tester/.test(hit), "Foto-Produkt: steht bei anderen in der Suche, mit dem Namen des Fotografen", hit.slice(0, 300));
      ok(await b2.evaluate(() => { const r = [...document.querySelectorAll("#kcsr .kc-sres")].find(x => /Skyr Vanille/.test(x.innerText)), i = r && r.querySelector("img"); return !!i && i.src.startsWith("data:image/jpeg"); }), "Foto-Produkt: in der Suche steht das Bild der Vorderseite statt des Kartons"); await b2.shot("kcal-foto-suche");
      /* a photographed pack without a picture: anybody adds one with a tap on the camera */
      await L.stage("PATCH", "kcal_own_products", "code=eq.4999999999993", {pic: null});
      await b2.fill("#kcq", "Skyr Vanill"); await sleep(1500); await b2.fill("#kcq", "Skyr Vanille"); await sleep(1800);
      await b2.evaluate(() => { const r = [...document.querySelectorAll("#kcsr .kc-sres")].find(x => /Skyr Vanille/.test(x.innerText)); if (r) r.click(); }); await b2.waitForSelector("#kcpic", {timeout: 6000}).catch(() => {});
      if (ok(await has(b2, "#kcpic"), "Foto-Produkt ohne Bild: in der Suche steht „Foto der Vorderseite hinzufügen“")){
        const png2 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC", "base64");
        const [f3] = await Promise.all([b2.waitForEvent("filechooser", {timeout: 6000}), b2.tap("#kcpic")]); await f3.setFiles({name: "vorne.png", mimeType: "image/png", buffer: png2}); await sleep(1200);
        const o2 = await L.table("kcal_own_products"); ok(o2.length === 1 && (o2[0].pic || "").startsWith("data:image/jpeg") && o2[0].user_id === ID.tester && await b2.evaluate(() => { const r = [...document.querySelectorAll("#kcsr .kc-sres")].find(x => /Skyr Vanille/.test(x.innerText)); return !!r && !!r.querySelector("img") && !document.querySelector("#kcpic"); }), "Bild nachgetragen von jemand anderem: gespeichert, das Produkt gehört weiter dem Fotografen", JSON.stringify(o2.map(o => [o.user_id === ID.tester, (o.pic || "").length]))); }
      await closeSheets(b2);
      await clean(b2, "Foto-Produkt für alle"); await b2.context().close(); }
    await closeSheets(page); if (await has(page, ".kc-scanov, .kc-ov-full")) await page.evaluate(() => document.querySelectorAll(".kc-ov-full [data-x], .kc-ov-full .kc-x").forEach(b => b.click()));
    await clean(page, "Etikett");

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
    ok(n1.kcal === 376 && n2.kcal === 271, "„gekochte Nudeln“: du 250 g = 376 kcal, die andere Person 180 g = 271 kcal", JSON.stringify([n1, n2]));
    ok(Math.abs(per(n1, 250) - per(n2, 180)) < .3 && Math.abs(per(n1, 250) - 150.4) < .5, "bei beiden derselbe Wert pro 100 g gekocht (150 kcal), egal was die KI schätzt", per(n1, 250) + " vs " + per(n2, 180));
    ok(m1.items.find(i => /Pesto/.test(i.name)).kcal === m2.items.find(i => /Pesto/.test(i.name)).kcal, "auch das Pesto hat bei beiden denselben Wert");
    ok(/gekocht/.test(n1.amount) && n1.ref === "pasta" && n1.st === "cooked", "die Position merkt sich „250 g gekocht“", JSON.stringify(n1));
    await closeSheets(a); await closeSheets(b);
    const m3 = await say(a, "tester", "100 g Nudeln trocken"); ok(m3.items[0].kcal === 346 && /trocken/.test(m3.items[0].amount), "„100 g Nudeln trocken“ = 346 kcal (Trockengewicht)", JSON.stringify(m3.items[0])); await closeSheets(a);
    /* a named product: exactly that product from Open Food Facts, not the value of the category */
    const m5 = await say(a, "tester", "250 g Barilla Spaghetti gekocht"), bs = m5.items[0];
    ok(/Spaghetti No\. 5 \(Barilla\)/.test(bs.name) && bs.code === "4000000000093", "Marke genannt („Barilla Spaghetti“): genau dieses Produkt aus Open Food Facts wird genommen", JSON.stringify([bs.name, bs.code]));
    ok(bs.kcal === 390 && bs.carbs === 77.4 && bs.per.ck === "cooked" && /250 g gekocht/.test(bs.amount), "mit den Werten der Packung (71,2 g KH trocken), umgerechnet auf 250 g gekocht", JSON.stringify([bs.kcal, bs.carbs, bs.amount, bs.per.k])); await closeSheets(a);
    const m6 = await say(a, "tester", "250 g Dingsbums Spaghetti gekocht");
    ok(m6.items[0].kcal === 376 && !m6.items[0].code && /Dingsbums Spaghetti.*nicht in Open Food Facts gefunden/.test(m6.note || ""), "unbekanntes Produkt: der allgemeine Wert wird genommen und das steht im Eintrag", JSON.stringify([m6.items[0].name, m6.items[0].kcal, m6.note])); await closeSheets(a);
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
    const first = await txt(a, ".kc-sres"); ok(/Nudeln, gekocht/.test(first) && /Bundeslebensmittelschlüssel/.test(first) && /150/.test(first), "Suche „nudeln“: zuerst „Nudeln, gekocht“ aus dem Bundeslebensmittelschlüssel mit 150 kcal", first); await a.shot("nudeln-suche");
    await a.tap(".kc-sres"); await sleep(500); await a.locator(".kc-sadd input").fill("200"); await a.locator(".kc-sadd input").blur(); await a.tap(".kc-sadd [data-add]"); await sleep(1100);
    m = (await meals("tester", "&limit=1"))[0]; ok(m.kcal === 301 && m.items[0].per.tab === "pasta", "200 g aus der Tabelle = 301 kcal", JSON.stringify([m.title, m.kcal, m.items[0].amount]));
    await clean(a, "Tabelle in der Suche");

    /* "wie letztes Mal" (Idee von Adri): oat flakes were scanned yesterday; said today without a brand, the scanned pack's values are taken */
    { const y = new Date(Date.now() - 864e5), day = y.getFullYear() + "-" + String(y.getMonth() + 1).padStart(2, "0") + "-" + String(y.getDate()).padStart(2, "0");
      await L.stage("POST", "kcal_meals", "", {user_id: ID.tester, day, ts: y.toISOString(), title: "Haferflocken", emoji: "🥣", source: "barcode", kcal: 144, carbs: 22.4, protein: 5.6, fat: 2.7, code: "4000000000055",
        items: [{name: "Haferflocken zart (Kölln)", amount: "40 g", kcal: 144, carbs: 22.4, protein: 5.6, fat: 2.7, code: "4000000000055", g: 40, per: {n: "Haferflocken zart", b: "Kölln", k: 361, c: 56, pr: 14, f: 6.7, s: 40, pk: 500, img: null, ss: "40 g", fi: 11, su: 0, sf: 0, sa: 0, ns: "", hd: 0}}]});
      await a.reload(); await a.waitForFunction(() => window.Kcal && Kcal.meals && Kcal.meals.some(m => m.code === "4000000000055"), null, {timeout: 10000}).catch(() => {}); await sleep(800);
      const m2 = await say(a, "tester", "60 g Haferflocken mit Milch"), oat = (m2.items || [])[0] || {};
      ok(/Kölln/.test(oat.name) && oat.kcal === 217 && oat.code === "4000000000055" && oat.last === 1, "„Haferflocken“ ohne Marke gesagt: die gestern gescannten von Kölln, 60 g = 217 kcal", JSON.stringify([oat.name, oat.kcal, oat.code]));
      ok(/Wie letztes Mal: Haferflocken zart \(Kölln\)/.test(m2.note || ""), "der Eintrag sagt „Wie letztes Mal“ und wie man es ändert", m2.note);
      ok(m2.items[1] && !m2.items[1].last && !m2.items[1].code, "die Milch (nie gescannt) bleibt eine Schätzung", JSON.stringify(m2.items[1])); }
    await clean(a, "Wie letztes Mal");

    /* a photo of the plate (Idee von Adri): the camera opens, the AI sees the food, "Passt" enters it */
    { const n0 = (await meals("tester")).length, png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
      const fc = a.waitForEvent("filechooser", {timeout: 5000}).catch(() => null); await a.tap("#main [data-kc-photo]"); const ch = await fc;
      ok(!!ch, "Foto-Knopf öffnet sofort die Kamera"); if (ch) await ch.setFiles({name: "teller.png", mimeType: "image/png", buffer: png});
      await a.waitForSelector(".dsheet [data-commit]", {timeout: 8000}).catch(() => {}); const st = await txt(a, ".dsheet"); await a.shot("kcal-foto-essen");
      ok(/Spaghetti Bolognese/.test(st) && /560/.test(st), "Foto vom Teller: die KI erkennt Spaghetti Bolognese, 560 kcal, erst „Passt“ speichert", st.slice(0, 160));
      if (await has(a, ".dsheet [data-commit]")) await a.tap(".dsheet [data-commit]"); for (let i = 0; i < 30 && (await meals("tester")).length === n0; i++) await sleep(200);
      const mp = (await meals("tester", "&limit=1"))[0] || {}; ok(/^📷 Foto/.test(mp.said || "") && mp.kcal === 560, "eingetragen, mit „📷 Foto“ als Herkunft", JSON.stringify([mp.title, mp.said, mp.kcal])); }
    await clean(a, "Foto vom Essen"); await a.context().close(); await b.context().close();
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
    ok(clap, "Applaudieren-Knopf bei Mila (Ziel heute erreicht)", "kein Knopf: fehlt die Tabelle kcal_claps?");
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
    ok(await page.locator("#main .kc-sum .kc-b2").count() === 1, "oben steht nur eines groß", String(await page.locator("#main .kc-sum .kc-b2").count()));
    ok(await page.locator("#main .kc-sum .kc-pf > span").count() === 3, "die anderen drei stehen klein darunter (auch was nicht angetippt wurde)", await txt(page, "#main .kc-sum .kc-pf"));
    ok(await page.evaluate(() => [...document.querySelectorAll("#main .kc-sum .kc-pf u")].every(u => !/255, 255, 255/.test(getComputedStyle(u).backgroundColor))), "die kleinen Balken sind farbig, nicht grau");
    await clean(page, "Einstellungen");

    /* streak freeze */
    await page.tap("#main .kc-top [data-kc-fl]"); await sleep(500); ok(/Ice|Eis|🧊/.test(await txt(page, ".dsheet")), "Flamme antippen zeigt „Streak on Ice“"); await page.shot("kcal-ice"); await closeSheets(page);
    /* weigh-in */
    await page.tap('#main [data-tab="stats"]'); await sleep(400); await page.tap("#kcwnow"); await sleep(500); await page.fill("#kwkg", "78,6");
    const poop = page.locator(".dsheet [data-p], .dsheet [data-pd]").first(); if (await poop.count()) await poop.tap(); await page.tap("#kwsave"); await sleep(900);
    const w = (await L.table("kcal_weights", "user_id=eq." + ID.tester + "&order=created_at.desc&limit=1"))[0]; ok(w && w.kg === 78.6, "Wiegen speichert 78,6 kg", JSON.stringify(w)); await closeSheets(page);
    await clean(page, "Flamme und Wiegen");
    /* cooking */
    await page.tap('#main [data-tab="today"]'); await sleep(500); await page.tap("#kccook"); await sleep(500); await page.fill("#kch", "Hähnchen, Reis, Paprika"); await page.tap("#kcgo"); await page.waitForFunction(() => /Hähnchen-Reis/.test(document.querySelector("#kcout").innerText), null, {timeout: 6000}).catch(() => {});
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
    /* the question mark can be taken back, and asked again right away */
    { const q = '#kcslst .kc-shr:has-text("Milch") [data-ask]', n0 = (await L.table("shop_asks", "kind=eq.home")).length;
      await a.locator(q).first().tap(); await sleep(1300); ok((await L.table("shop_asks", "kind=eq.home")).length === n0 + 1 && /Milch/.test(await txt(b, ".kc-askc")), "Fragezeichen bei Milch: Frage ist raus, Karte bei Mila", await txt(b, ".kc-askc"));
      await a.locator(q).first().tap(); await sleep(1500); ok((await L.table("shop_asks", "kind=eq.home")).length === n0, "zweiter Tipp nimmt die Frage zurück");
      ok(!(await has(a, '#kcslst .kc-shr:has-text("Milch") .kc-shq.on')), "das Fragezeichen leuchtet nicht mehr"); ok(!(await has(b, ".kc-askc")), "bei Mila geht die Karte wieder zu"); await a.shot("shop-frage-zurueck");
      await a.locator(q).first().tap(); await sleep(1300); ok((await L.table("shop_asks", "kind=eq.home")).length === n0 + 1 && /Milch/.test(await txt(b, ".kc-askc")), "dritter Tipp fragt sofort wieder", await txt(b, ".kc-askc"));
      await a.locator(q).first().tap(); await sleep(1500); ok((await L.table("shop_asks", "kind=eq.home")).length === n0 && !(await has(b, ".kc-askc")), "und lässt sich wieder zurücknehmen"); }
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
    const t = await txt(page, "#main"); ok(/Bayern/.test(t) && /Leipzig/.test(t) && /4 offen/.test(t), "Tippspiel zeigt die offenen Spiele (4 offen)", t.slice(0, 200)); await page.shot("tipp");
    ok(/Makhachev/.test(t), "UFC-Titelkampf ist tippbar gelistet", t.slice(0, 300));
    await clean(page, "Tippspiel öffnen");
    /* only the result: plus and minus, saved at once */
    const plus = page.locator('#main [data-d="1"]'); await plus.nth(0).tap(); await sleep(250); await plus.nth(0).tap(); await sleep(250); await plus.nth(1).tap(); await sleep(1500);
    const pick = (await L.table("tipp_picks", "event_id=eq.t-pre&user_id=eq." + ID.tester))[0];
    ok(pick && pick.sh != null && pick.sa != null, "Ergebnis mit + tippen wird sofort gespeichert", JSON.stringify(pick));
    if (pick) ok(new RegExp("Bayern . " + pick.sh + " . Dortmund . " + pick.sa).test((await txt(page, "#main")).replace(/[−+]/g, ".")), "die Seite zeigt denselben Tipp wie die Datenbank (" + pick.sh + ":" + pick.sa + ")", (await txt(page, "#main")).slice(120, 260));
    await page.tap('#main [data-w="a"]'); await sleep(1200); const ufc = (await L.table("tipp_picks", "event_id=eq.t-ufc&user_id=eq." + ID.tester))[0]; ok(ufc && ufc.w === "a", "UFC: Sieger tippen gespeichert", JSON.stringify(ufc));
    ok(/Worlds · Finale/i.test(await txt(page, "#main")) && /Bilibili Gaming/.test(await txt(page, "#main")), "League of Legends: das Worlds-Finale ist tippbar gelistet, mit vollem Teamnamen");
    await page.tap('#main [data-ev="t-lol"] [data-w="b"]'); await sleep(1200); const lol = (await L.table("tipp_picks", "event_id=eq.t-lol&user_id=eq." + ID.tester))[0]; ok(lol && lol.w === "b", "LoL: Sieger tippen gespeichert", JSON.stringify(lol)); await page.shot("tipp-lol");
    await page.tap('#main [data-tab="res"]'); await sleep(1000); const r = await txt(page, "#main"); ok(/Leverkusen/.test(r) && /Freiburg/.test(r), "Ergebnisse: laufendes und beendetes Spiel", r.slice(0, 250)); await page.shot("tipp-ergebnisse");
    await page.tap('#main [data-tab="table"]'); await sleep(1000); const tb = await txt(page, "#main"); ok(/Nat Tester|Du/.test(tb) && /Mila/.test(tb), "Rangliste zeigt dich und Mila", tb.slice(0, 250)); await page.shot("tipp-rangliste");
    await clean(page, "Tippen"); await page.context().close();
  },

  /* ---------- Feedback im Mehr-Menü ---------- */
  /* ---------- "is in a game right now": the status on the friends list and the profile, and joining from there ---------- */
  async now(browser){
    const a = await L.open(browser, "tester"), b = await L.open(browser, "mila");
    await b.evaluate(() => { PG.st.myName = "Mila"; App.go("lobby", {host: true, game: "imposter"}); }); await sleep(5500);
    const row = (await L.table("chess_now", "user_id=eq." + ID.mila))[0]; ok(row && row.what && row.what.k === "party" && row.what.g === "imposter" && /^[a-z0-9]{5}$/.test(row.what.c || ""), "Mila öffnet eine Imposter-Lobby: ihr Status steht in der Datenbank", JSON.stringify(row && row.what));
    await a.tap('#tabbar [data-t="friends"]'); await sleep(1800);
    const fr = await txt(a, '#main .fr:has-text("Mila")'); ok(/In der Lobby: Imposter/.test(fr) && /Mitspielen/.test(fr), "Freunde-Liste zeigt bei Mila „In der Lobby: Imposter“ mit Knopf „Mitspielen“", fr.slice(0, 200)); await a.shot("now-freunde");
    ok(!/Lobby|Spielt gerade/.test(await txt(a, '#main .fr:has-text("Jonas")')), "bei Jonas steht nichts");
    await a.evaluate(id => App.go("fprofile", {id}), ID.mila); await sleep(1800);
    const card = await txt(a, "#main .now-card"); ok(/Ist gerade im Game/i.test(card) && /Imposter/.test(card), "Profil zeigt die Karte „Ist gerade im Game“", card.slice(0, 200)); await a.shot("now-profil");
    await a.evaluate(() => { PG.st.myName = "Nat"; }); await a.tap("#main .now-card [data-now-join]"); await sleep(3000);
    ok(await a.evaluate(() => App.route === "lobby" && !!PNet.P && !PNet.P.isHost), "Tipp auf „Mitspielen“ führt in Milas Lobby");
    ok(await b.evaluate(() => PNet.P.roster.length === 2), "Mila sieht dich in ihrer Lobby", JSON.stringify(await b.evaluate(() => PNet.P.roster.map(r => r.name)))); await b.shot("now-lobby");
    await b.evaluate(() => { PNet.leave(true); App.go("home"); }); await sleep(5500);
    ok(!(await L.table("chess_now", "user_id=eq." + ID.mila)).length, "Mila verlässt die Lobby: der Status ist wieder weg");
    await clean([a, b], "Ist gerade im Game");
  },

  /* ---------- watching a friend's board: live position, a suggested move as an arrow ---------- */
  async watch(browser){
    const a = await L.open(browser, "tester"), b = await L.open(browser, "mila");
    await b.evaluate(() => App.go("puzzles")); await b.waitForSelector("#bw .board .pc, #bw .board [class*=pc]", {timeout: 15000}).catch(() => {}); await sleep(6000);
    const row = (await L.table("chess_now", "user_id=eq." + ID.mila))[0]; ok(row && row.what && row.what.k === "puzzle", "Mila löst ein Puzzle: Status „puzzle“ in der Datenbank", JSON.stringify(row && row.what));
    await a.evaluate(id => App.go("fprofile", {id}), ID.mila); await sleep(2000);
    const card = await txt(a, "#main .now-card"); ok(/Löst gerade Puzzles/.test(card) && /Zuschauen/.test(card), "Profil: „Löst gerade Puzzles“ mit Knopf „Zuschauen“", card.slice(0, 200));
    await a.tap("#main .now-card [data-now-watch]"); await sleep(3500);
    const fenB = await b.evaluate(() => App.view.board && App.view.board.live ? App.view.board.live.g.fen() : null), fenA = await a.evaluate(() => Views.watch.fen);
    ok(!!fenA && fenA === fenB, "du siehst dieselbe Stellung wie Mila", JSON.stringify([fenA, fenB])); await a.shot("watch-zuschauer");
    ok(/Nat Tester/.test(await txt(b, ".watch-pill")), "bei Mila steht, dass du zuschaust", await txt(b, ".watch-pill").catch(() => ""));
    ok(await a.evaluate(() => Views.watch.board.o) === await b.evaluate(() => App.view.board.o), "dein Brett steht so herum wie Milas");
    await b.evaluate(() => App.view.board.flip()); await sleep(1200);
    ok(await a.evaluate(() => Views.watch.board.o) === await b.evaluate(() => App.view.board.o), "Mila dreht ihr Brett: deins dreht sich mit", JSON.stringify([await a.evaluate(() => Views.watch.board.o), await b.evaluate(() => App.view.board.o)]));
    await b.evaluate(() => App.view.board.flip()); await sleep(1200);
    /* an arrow between any two squares, also for the side that is not to move: dragged with the finger */
    const box = async sq => { const r = await a.locator(`#bw .sq[data-sq="${sq}"]`).boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
    const dragArrow = async (f, t) => { const [x1, y1] = await box(f), [x2, y2] = await box(t); await a.mouse.move(x1, y1); await a.mouse.down(); await a.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, {steps: 4}); await a.mouse.move(x2, y2, {steps: 4}); await a.mouse.up(); };
    const sugB = () => b.evaluate(() => (App.view.board.sug || []).map(x => x[0] + x[1]).join());
    await dragArrow("a8", "h3"); await sleep(1500);
    ok(await sugB() === "a8h3", "ein frei gezogener Pfeil (kein legaler Zug, Gegner-Seite) kommt bei Mila an", await sugB());
    ok(await b.evaluate(() => /#003088/i.test(document.querySelector("#bw .arrows").innerHTML)), "der Pfeil ist blau auf ihrem Brett gezeichnet"); ok(/Vorschlag von Nat Tester/.test(await txt(b, ".watch-pill")), "und sie sieht, von wem er kommt"); await b.shot("watch-spieler");
    ok(/Mila sieht deinen Pfeil/.test(await txt(a, "#whint")), "bei dir steht die Bestätigung „Mila sieht deinen Pfeil“", await txt(a, "#whint"));
    ok(await b.evaluate(() => App.view.board.live.g.fen()) === fenB, "an Milas Stellung ändert der Vorschlag nichts");
    { const before = await a.evaluate(() => Object.keys(Views.watch.board.pieces).sort().join());
      await a.tap('#bw .sq[data-sq="d1"]'); await sleep(300); await a.tap('#bw .sq[data-sq="d7"]'); await sleep(1500);
      ok(await sugB() === "d1d7", "zwei Felder nacheinander angetippt: der neue Pfeil ersetzt den alten", await sugB());
      ok(await a.evaluate(() => Object.keys(Views.watch.board.pieces).sort().join()) === before, "auf deinem Brett bleibt die Stellung stehen (nur der Pfeil)"); await a.shot("watch-vorschlag"); }
    for (const [f, t] of [["e2", "e4"], ["g8", "f6"], ["h1", "a8"], ["c3", "c3x"]].slice(0, 3)){ await dragArrow(f, t); await sleep(900); }
    ok(await sugB() === "h1a8", "drei Pfeile schnell hintereinander: der letzte steht bei Mila", await sugB());
    await a.tap("#wmic"); await sleep(800); await b.tap(".watch-pill [data-watch-mic]"); await sleep(7000);
    ok(await a.evaluate(() => Watch.voice && PVoice.peers().length === 1) && await b.evaluate(() => Watch.voice && PVoice.peers().length === 1), "Sprachchat: beide schalten das Mikrofon ein und sind verbunden", JSON.stringify([await a.evaluate(() => [Watch.voice, PVoice.on, Object.values(PVoice._pcs).map(x => x.pc.connectionState)]), await b.evaluate(() => [Watch.voice, PVoice.on, Object.values(PVoice._pcs).map(x => x.pc.connectionState)])]));
    await a.evaluate(() => App.go("friends")); await sleep(1500); ok(!(await has(b, ".watch-pill")), "du gehst: der Hinweis bei Mila verschwindet");
    ok(await a.evaluate(() => !Watch.voice && !PVoice.on), "und der Sprachchat ist bei dir wieder aus");
    await clean([a, b], "Zuschauen");
  },

  /* ---------- household: bin plan from the address, whose turn, "can't" passes it on, tick box on the start page ---------- */
  async haus(browser){
    const a = await L.open(browser, "tester"), b = await L.open(browser, "mila"), tick = () => a.evaluate(() => ChessSite.sb.rpc("home_tick")), tasks = q => L.table("home_tasks", q || "");
    await a.evaluate(() => App.go("home")); await sleep(1200);
    ok(/Haushalt/.test(await txt(a, "#kchaus")), "Startseite: große Kachel „Haushalt“", await txt(a, "#kchaus")); await a.tap("#kchaus"); await sleep(1800);
    const g = (await L.table("home_groups", "owner=eq." + ID.tester))[0]; ok(!!g, "erstes Öffnen legt den Haushalt an"); ok(/allein/.test(await txt(a, ".hs-ov")), "Hinweis: noch allein, Mitbewohner hinzufügen"); await a.shot("haus-leer");
    await a.tap(".hs-ov [data-share]"); await sleep(600); await a.tap(`.kc-frr:has-text("Mila") [data-m]`); await sleep(900); await a.tap(".dsheet [data-dclose], .kc-shop [data-dclose]"); await sleep(1200);
    ok((await L.table("home_members", "group_id=eq." + g.id)).some(m => m.user_id === ID.mila), "Mila wohnt jetzt mit im Haushalt");
    /* the address: town, street, and the dates come in by themselves */
    await a.tap(".hs-ov [data-addr]"); await sleep(900); ok(await a.evaluate(() => document.activeElement && document.activeElement.id === "hsai"), "Adresse: das Feld hat sofort den Cursor (Tastatur geht auf)");
    await a.fill("#hsai", "geibelstr 5 berlin"); await sleep(900); await a.tap('#hsal .hs-ai:has-text("Berlin")'); await sleep(1500);
    ok(/noch kein Abfuhrkalender angebunden/.test(await txt(a, "#hsal")), "eine Adresse ohne angebundenen Kalender (Berlin): klare Auskunft statt Fehler", (await txt(a, "#hsal")).slice(0, 140)); ok((await L.table("home_plan_wishes", "")).some(w => w.city === "Berlin"), "und der Wunsch ist notiert");
    await a.fill("#hsai", "geiglbergstr 2a wang"); await sleep(900); const sug = await txt(a, "#hsal"); ok(/Geiglbergstraße 2a/.test(sug) && /85368 Wang/.test(sug) && /Landkreis Freising/.test(sug), "„geiglbergstr 2a wang“ schlägt die ganze Adresse vor: Straße, Hausnummer, PLZ, Ort", sug.slice(0, 120)); await a.shot("haus-adresse");
    await a.tap('#hsal .hs-ai:has-text("Geiglbergstraße")'); await sleep(2500);
    const g2 = (await L.table("home_groups", "id=eq." + g.id))[0], plan = (await tasks("kind=eq.plan")).sort((x, y) => x.due_at < y.due_at ? -1 : 1);
    ok(g2.ort === "85368 Wang" && g2.strasse === "Geiglbergstraße 2a" && g2.addr && g2.addr.hnr === "2a", "die Adresse ist gespeichert, mit Hausnummer und PLZ", JSON.stringify([g2.ort, g2.strasse])); ok(plan.length === 3 && plan[0].title === "Gelber Sack + Schwarze Tonne" && plan[1].title === "Biotonne + Papiertonne" && plan[2].title === "Restmüll + Wertstofftonne", "drei Abholungen der nächsten 8 Wochen sind eingetragen, Tonnen eines Tages zusammen (die in 90 Tagen noch nicht)", JSON.stringify(plan.map(p => p.title)));
    ok(/Geiglbergstraße 2a, 85368 Wang/.test(await txt(a, "#hsaddr")) && /Abholung morgen/.test(await txt(a, "#hsplan")), "der Müllplan zeigt die Adresse und „Abholung morgen“", (await txt(a, "#hsplan")).slice(0, 160)); await a.shot("haus-plan");
    await a.evaluate(() => Haus.sync()); await sleep(1200); ok((await tasks("kind=eq.plan")).length === 3, "nochmal laden trägt nichts doppelt ein");
    /* the evening before: one person is asked; "can't" passes it on */
    await L.stage("PATCH", "home_tasks", "id=eq." + plan[0].id, {ask_at: new Date(Date.now() - 60000).toISOString()}); /* it is 5 pm on the evening before */
    await tick(); await a.evaluate(() => Haus.load()); await sleep(1500);
    ok(/Du bist dran/.test(await txt(a, ".kc-askc")) && /Schwarze Tonne/.test(await txt(a, ".kc-askc")), "du bekommst die Frage als Karte: „Du bist dran“", (await txt(a, ".kc-askc").catch(() => "")).slice(0, 120)); await a.shot("haus-frage");
    await a.tap(".kc-askc [data-n]"); await sleep(1500); let t1 = (await tasks("id=eq." + plan[0].id))[0]; ok(t1.state === "asked" && t1.asked === ID.mila, "„Kann nicht“: jetzt ist Mila gefragt", JSON.stringify([t1.state, t1.asked]));
    await b.evaluate(() => { App.go("home"); }); await sleep(1200); await b.evaluate(() => Haus.load()); await sleep(1500);
    ok(/Du bist dran/.test(await txt(b, ".kc-askc")), "Mila bekommt die Karte"); await b.tap(".kc-askc [data-y]"); await sleep(1800);
    ok(/Schwarze Tonne/.test(await txt(b, "#hsslot .hs-todo")), "„Mach ich“: die Aufgabe steht als Kästchen oben auf Milas Startseite", JSON.stringify((await tasks("id=eq." + plan[0].id)).map(t => [t.state, t.asked, t.taken_by])) + " " + await b.evaluate(() => JSON.stringify([document.querySelectorAll(".kc-askc").length, Haus.tasks.map(t => [t.state, t.taken_by === Social.me])]))); await b.shot("haus-todo");
    await b.tap("#hsslot .hs-todo"); await sleep(2200); t1 = (await tasks("id=eq." + plan[0].id))[0]; ok(t1.state === "done" && t1.done_by === ID.mila, "ein Tipp hakt ab: erledigt von Mila"); ok(!(await has(b, "#hsslot .hs-todo")), "das Kästchen ist wieder weg");
    const log = await L.table("home_log", "group_id=eq." + g.id); ok(log.some(l => l.user_id === ID.tester && l.what === "pass") && log.some(l => l.user_id === ID.mila && l.what === "done"), "im Protokoll: du hast abgegeben, Mila hat es gemacht");
    /* the others say thank you: a heart to hold down until it is full */
    await a.evaluate(() => Haus.load()); await sleep(1500);
    ok(/Mila hat das erledigt/i.test(await txt(a, ".hs-hov")) && /Herz gedrückt/.test(await txt(a, ".hs-hov")), "du bekommst die Karte mit dem leeren Herz: „Mila hat das erledigt“", (await txt(a, ".hs-hov").catch(() => "")).slice(0, 120)); await a.shot("haus-herz-leer");
    { const r = await a.locator(".hs-heart").boundingBox(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      await a.mouse.move(x, y); await a.mouse.down(); await sleep(1200); await a.mouse.up(); await sleep(250);
      ok(await has(a, ".hs-hov") && !(await L.table("home_thanks", "")).length && /Nicht loslassen/.test(await txt(a, "#hstx")), "zu früh losgelassen: die Karte bleibt, noch kein Dank gespeichert", await txt(a, "#hstx")); await a.shot("haus-herz-halb");
      await sleep(1300); ok(await a.evaluate(() => +document.querySelector("#hsfill").getAttribute("y") > 90), "das Herz läuft wieder leer", String(await a.evaluate(() => document.querySelector("#hsfill").getAttribute("y"))));
      await a.mouse.down(); await sleep(3300); ok(/Dankeschön, Mila/.test(await txt(a, ".hs-hov")), "drei Sekunden gehalten: das Herz ist voll, „Dankeschön, Mila!“", await txt(a, "#hstx").catch(() => "")); await a.shot("haus-herz-voll"); await a.mouse.up(); await sleep(2200); }
    const th = await L.table("home_thanks", ""); ok(th.length === 1 && th[0].user_id === ID.tester && th[0].task_id === plan[0].id, "der Dank ist gespeichert", JSON.stringify(th)); ok(!(await has(a, ".hs-hov")), "erst jetzt schließt sich die Karte");
    await a.evaluate(() => Haus.load()); await sleep(1200); ok(!(await has(a, ".hs-hov")), "und sie kommt nicht noch einmal");
    /* next time the one who passed is first */
    await a.evaluate(() => Haus.load()); await sleep(800); await a.tap('.hs-ov [data-q="1"]'); await sleep(200); await a.tap("#hsadd"); await sleep(1200); await tick(); await a.evaluate(() => Haus.load()); await sleep(1500);
    const bad = (await tasks("title=eq.Bad putzen"))[0]; ok(bad && bad.state === "asked" && bad.asked === ID.tester && bad.emoji === "🚿", "neue Aufgabe „Bad putzen“: weil du vorher abgegeben hast, bist du jetzt als Erster dran", JSON.stringify(bad && [bad.state, bad.asked]));
    await a.tap(".kc-askc [data-y]"); await sleep(1500); ok(/machst das/.test(await txt(a, "#hsopen")) && /Erledigt/.test(await txt(a, "#hsopen")), "angenommen: in der Liste steht „Du machst das“ mit „Erledigt ✓“", (await txt(a, "#hsopen")).slice(0, 160));
    /* something urgent for everyone, with the first to say yes taking it */
    await a.fill("#hsti", "Küche ist dreckig"); await a.tap('.hs-ov [data-seg="who"] [data-v="all"]'); await a.tap("#hsadd"); await sleep(1200); await tick(); await b.evaluate(() => Haus.load()); await sleep(1500);
    ok(/Wer übernimmt das/.test(await txt(b, ".kc-askc")) && /Küche ist dreckig/.test(await txt(b, ".kc-askc")), "„Alle fragen“: Mila bekommt „Nat Tester fragt: Wer übernimmt das?“", (await txt(b, ".kc-askc").catch(() => "")).slice(0, 120));
    await b.tap(".kc-askc [data-y]"); await sleep(1500); const ku = (await tasks("title=eq.Küche ist dreckig"))[0]; ok(ku.state === "taken" && ku.taken_by === ID.mila && ku.emoji === "🍳", "Mila übernimmt sie");
    await a.evaluate(() => Haus.load()); await sleep(1200); ok(/Mila/.test(await txt(a, "#hsstat")) && /abgegeben/.test(await txt(a, "#hsstat")), "Statistik: wer wie viel gemacht hat, und wer abgegeben hat", (await txt(a, "#hsstat")).slice(0, 160)); await a.shot("haus-voll");
    /* housemates who aren't friends with each other still see each other's names (not "Player") */
    await L.stage("POST", "home_members", "", {group_id: g.id, user_id: ID.jonas}); await b.evaluate(() => Haus.load()); await sleep(1200); await b.evaluate(() => Haus.open()); await sleep(1800);
    const who = await txt(b, "#hsmem"); ok(!/Player|Mitbewohner<|Freund\b/.test(who) && await b.evaluate(id => Haus.nm(id) !== "Player" && Haus.nm(id) !== "Mitbewohner" && Haus.nm(id).length > 1, ID.jonas), "Mila sieht den Namen eines Mitbewohners, mit dem sie nicht befreundet ist", who.slice(0, 160) + " | " + await b.evaluate(id => Haus.nm(id), ID.jonas));
    await clean([a, b], "Haushalt");
  },

  async feedback(browser){
    const page = await L.open(browser, "tester"); await page.evaluate(() => openSheet()); await sleep(400); await page.locator('#sheet [data-s="__feedback"]').tap(); await sleep(600);
    /* ideas come first: a long wish is kept whole */
    if (!(await has(page, "#idt")) && await has(page, '.fb-ov [data-fbt="ideas"]')){ await page.locator('.fb-ov [data-fbt="ideas"]').tap(); await sleep(500); }
    const long = "Ich und Wolf haben das Problem, dass gewisse Produkte nicht erkannt werden. Falls das nicht geht, bitte eine Fotofunktion einbauen, mit der man die Nährwerte abfotografieren kann, damit sie gespeichert werden.";
    if (ok(await has(page, "#idt"), "Mehr → Feedback öffnet die Ideen")){ await page.fill("#idt", long); await page.locator("#idf button").tap(); await sleep(1200);
      const ideas = await L.table("chess_ideas"); ok(ideas.length === 1 && ideas[0].body === long && ideas[0].title.length <= 120 && /…$/.test(ideas[0].title), "lange Idee: ganzer Text gespeichert, Titel ist der Anfang", JSON.stringify(ideas.map(i => [i.title.length, (i.body || "").length])));
      ok((await txt(page, "#idl")).includes("abfotografieren kann, damit sie gespeichert werden."), "die Liste zeigt den ganzen Text", (await txt(page, "#idl")).slice(0, 200)); await page.shot("ideen"); }
    await clean(page, "Ideen");
    await page.locator('.fb-ov [data-fbt="report"]').tap(); await sleep(600);
    ok(await has(page, "#fbtx"), "Melden öffnet das Formular"); await page.fill("#fbtx", "Test: die Einkaufsliste ist super"); await page.tap("#fbs"); await sleep(1000);
    const f = await L.table("chess_feedback"); ok(f.length === 1 && f[0].name === "Nat Tester" && /Start|home/.test(f[0].info || ""), "Feedback mit Name und Geräte-Info gespeichert", JSON.stringify(f));
    ok(/die Einkaufsliste ist super/.test(await txt(page, "#fbl")), "es steht danach im eigenen Feedback-Log"); await page.shot("feedback"); await clean(page, "Feedback"); await page.context().close();

    /* Fair Play: the owner entered a case for Mila. She gets the screen instead of the app, her NatCoins are gone,
       and only holding the button (not a tap) brings the app back, with 5,000 NatCoins for the fresh start */
    await L.stage("POST", "chess_fairplay", "", {user_id: ID.mila, quote: "Bitte den User Tester aus der App entfernen"});
    const m = await L.open(browser, "mila", {before: () => { try { if (!sessionStorage.getItem("fp-seed")){ sessionStorage.setItem("fp-seed", "1"); const k = "chessnat-v2", st = JSON.parse(localStorage.getItem(k) || "{}"); st.natE = 1234; st.natS = 0; localStorage.setItem(k, JSON.stringify(st)); } } catch(e) {} }});
    await m.waitForSelector(".fpx", {timeout: 8000}).catch(() => {}); await sleep(500);
    const fp = await txt(m, ".fpx"); ok(/Das war nicht okay/.test(fp) && /Tester aus der App entfernen/.test(fp) && /Zusammenhalt/.test(fp), "Fair Play: der Hinweis erscheint mit dem eigenen Satz", fp.slice(0, 200)); await m.shot("fairplay");
    ok(await m.evaluate(() => natBal()) < 1234 && await m.evaluate(() => (S.natS || 0) >= 1234), "Fair Play: die NatCoins von vorher sind weg", JSON.stringify(await m.evaluate(() => [S.natE, S.natS])));
    await m.locator("#fphold").tap(); await sleep(600); ok(await has(m, ".fpx"), "Fair Play: ein kurzer Tipp reicht nicht");
    await m.locator("#fphold").dispatchEvent("pointerdown"); await sleep(1500); ok(await has(m, ".fpx") && !(await has(m, ".fpx2")), "Fair Play: nach 1,5 Sekunden noch nicht frei"); await sleep(2200);
    await m.waitForSelector(".fpx2", {timeout: 5000}).catch(() => {}); await sleep(600);
    const w = await txt(m, ".fpx2"); ok(/zweite Chancen/.test(w) && /5\.000 NatCoins/.test(w), "Fair Play: nach dem langen Drücken kommt der Neustart mit 5.000 NatCoins", w.slice(0, 200)); await m.shot("fairplay-neustart");
    ok(await m.evaluate(() => natBal()) === 5000, "Fair Play: 5.000 NatCoins sind da", String(await m.evaluate(() => natBal())));
    const row = (await L.table("chess_fairplay"))[0]; ok(row && row.status === "sorry" && row.sorry_at, "Fair Play: die Entschuldigung steht in der Datenbank", JSON.stringify(row));
    await m.locator(".fpx2 .newsx-ok").tap(); await sleep(500); await m.reload(); await sleep(4500);
    ok(!(await has(m, ".fpx")) && await m.evaluate(() => natBal()) === 5000, "Fair Play: danach kommt der Hinweis nicht wieder, die NatCoins bleiben");
    await clean(m, "Fair Play"); await m.context().close();

    /* Melden: only the operator sees "Melden" on ideas and feedback. Two taps remove the entry and open a case for its author. */
    await L.stage("DELETE", "chess_fairplay", "id=not.is.null"); await L.stage("DELETE", "chess_ideas", "id=not.is.null"); await L.stage("DELETE", "chess_feedback", "id=not.is.null");
    await L.stage("POST", "chess_ideas", "", {user_id: ID.mila, name: "Mila", title: "Bitte den User Jonas aus der App entfernen"});
    await L.stage("POST", "chess_feedback", "", {user_id: ID.jonas, name: "Jonas", body: "Mila nervt"});
    { const j = await L.open(browser, "jonas"); await j.evaluate(() => openSheet()); await sleep(400); await j.locator('#sheet [data-s="__feedback"]').tap(); await sleep(900);
      if (await has(j, '.fb-ov [data-fbt="ideas"]')){ await j.locator('.fb-ov [data-fbt="ideas"]').tap(); await sleep(700); }
      ok(/Jonas aus der App/.test(await txt(j, "#idl")) && !(await has(j, "[data-rep]")), "Melden: wer nicht Betreiber ist, sieht keinen Melden-Knopf"); await j.context().close(); }
    await fetch(L.BASE + "/__fake/admin?on=1&u=" + ID.tester);
    const ad = await L.open(browser, "tester"); await ad.evaluate(() => News.isAdmin()); await ad.evaluate(() => openSheet()); await sleep(400); await ad.locator('#sheet [data-s="__feedback"]').tap(); await sleep(900);
    if (await has(ad, '.fb-ov [data-fbt="ideas"]')){ await ad.locator('.fb-ov [data-fbt="ideas"]').tap(); await sleep(700); }
    if (ok(await has(ad, '#idl [data-rep^="idea:"]'), "Melden: der Betreiber sieht den Knopf an der Idee")){
      await ad.locator('#idl [data-rep^="idea:"]').tap(); await sleep(500);
      ok(/Wirklich/.test(await txt(ad, '#idl [data-rep^="idea:"]')) && (await L.table("chess_ideas")).length === 1, "Melden: ein Tipp fragt erst nach, es passiert noch nichts"); await ad.shot("melden-sicher");
      await ad.locator('#idl [data-rep^="idea:"]').tap(); await sleep(1200);
      const fp = await L.table("chess_fairplay"); ok(!(await L.table("chess_ideas")).length && !/Jonas aus der App/.test(await txt(ad, "#idl")), "Melden: die Idee ist weg, auch aus der Liste");
      ok(fp.length === 1 && fp[0].user_id === ID.mila && fp[0].quote === "Bitte den User Jonas aus der App entfernen" && fp[0].status === "open", "Melden: Mila bekommt einen Fall mit genau ihrem Satz", JSON.stringify(fp)); }
    await ad.locator('.fb-ov [data-fbt="report"]').tap(); await sleep(900);
    if (ok(await has(ad, '#fbl [data-rep^="feedback:"]'), "Melden: der Knopf steht auch am Feedback")){
      await ad.locator('#fbl [data-rep^="feedback:"]').tap(); await sleep(300); ok(await ad.locator('#fbl [data-shame]').isVisible(), "Melden: beim Nachfragen steht auch „Mit Schande“"); await ad.shot("melden-schande-wahl");
      await ad.locator('#fbl [data-shame]').tap(); await sleep(1200);
      const fp = await L.table("chess_fairplay"); ok(!(await L.table("chess_feedback")).length && fp.length === 2 && fp.some(f => f.user_id === ID.jonas && f.quote === "Mila nervt" && f.shame === true) && fp.some(f => f.user_id === ID.mila && !f.shame), "Melden: Feedback weg, Jonas bekommt einen Fall mit Schande (Mila ohne)", JSON.stringify(fp)); }
    await clean(ad, "Melden"); await ad.context().close(); await fetch(L.BASE + "/__fake/admin?on=0&u=" + ID.tester);
    /* Schande: before the apology Jonas has to ring the bell four times, each time after "Schande!" */
    { const j = await L.open(browser, "jonas", {before: () => { window.__said = []; const sp = {speak: u => window.__said.push(u.text), cancel(){}}; Object.defineProperty(window, "speechSynthesis", {get: () => sp}); }}); await j.evaluate(() => FairPlay.check()); await sleep(1500);
      if (ok(await has(j, "#fpbell") && !(await j.locator("#fphold").isVisible()), "Schande: erst die Glocke, der Entschuldigen-Knopf ist noch nicht da")){
        await j.shot("schande");
        for (let i = 0; i < 4; i++){ await sleep(1300); await j.locator("#fpbell").tap(); }
        await sleep(1700); ok(await j.evaluate(() => window.__said.filter(t => t === "Schande!").length) === 4, "Schande: die Stimme sagt viermal „Schande!“", await j.evaluate(() => JSON.stringify(window.__said)));
        ok(await j.locator("#fphold").isVisible() && !(await has(j, "#fpbell")), "Schande: nach viermal Klingeln kommt der Entschuldigen-Knopf"); await j.shot("schande-fertig"); }
      await clean(j, "Schande"); await j.context().close(); }
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
    const j = await (await fetch(L.BASE + "/api/foods?debug=1")).json(), pe = j.foods.pesto;
    ok(pe && pe.k === 471 && pe.n === 29, "/api/foods: Pesto = Median aus 29 Gläsern der Kategorie (471 kcal), das falsch einsortierte Produkt fliegt raus", JSON.stringify(pe));
    ok(j.miss.includes("nutella") && !j.foods.nutella, "ein Lebensmittel ohne genug Produkte wird als fehlend gemeldet und behält seinen Tabellenwert", JSON.stringify(j.miss).slice(0, 120));
    ok(!j.foods.pasta && !j.miss.includes("pasta") && !j.foods.reis, "was der Bundeslebensmittelschlüssel führt (Nudeln, Reis), wird bei Open Food Facts gar nicht mehr gefragt", JSON.stringify(Object.keys(j.foods)));
    const hear = () => { class SR { start(){ SR.cur = this; } stop(){ setTimeout(() => this.onend && this.onend(), 20); } abort(){ this.stop(); } }
      window.SpeechRecognition = window.webkitSpeechRecognition = SR; window.__hear = t => { const r = SR.cur; if (r && r.onresult) r.onresult({resultIndex: 0, results: Object.assign([Object.assign([{transcript: t, confidence: .9}], {isFinal: true})], {length: 1})}); }; };
    const page = await L.open(browser, "tester", {before: hear}); await page.evaluate(() => KCAL_FOODS.ready);
    ok(await page.evaluate(() => KCAL_FOODS.byId.pesto.k === 471 && KCAL_FOODS.byId.pesto.src.n === 29), "die App übernimmt die Werte von /api/foods (Pesto 471)");
    ok(await page.evaluate(() => { const p = KCAL_FOODS.byId.pasta, b = KCAL_BLS.pasta; return p.k === 346 && p.c === 68.8 && p.src.bls === "E401000" && b.code === "E401000" && KCAL_FOODS.byId.apfel.k === 58 && KCAL_FOODS.byId.nutella.k === 539 && !KCAL_FOODS.byId.nutella.bls; }), "Nudeln und Apfel haben die Werte des Bundeslebensmittelschlüssels (346 und 58 kcal), Nutella bleibt wie es war");
    await page.tap("#main [data-kc-find]"); await sleep(400); await page.keyboard.type("nudeln", {delay: 20}); await page.waitForFunction(() => /Bundeslebensmittel/.test((document.querySelector(".kc-sov") || {}).innerText || ""), null, {timeout: 5000}).catch(() => {});
    const first = await txt(page, ".kc-sres"); ok(/Nudeln, gekocht/.test(first) && /Bundeslebensmittelschlüssel/.test(first) && /150/.test(first), "Suche nennt die Quelle: „Bundeslebensmittelschlüssel“, 150 kcal gekocht", first); await page.shot("quelle-suche"); await page.tap("#kcsx"); await sleep(400);
    const n = (await meals("tester")).length; await page.tap("#main [data-kc-say]"); await sleep(700); await page.evaluate(() => window.__hear("250 g gekochte Nudeln")); await sleep(400);
    if (await page.locator("#kcmic").isVisible().catch(() => false)){ await page.tap("#kcmic"); await sleep(300); } if (await page.locator("#kcvdone").isVisible().catch(() => false)) await page.tap("#kcvdone");
    await page.waitForSelector(".dsheet [data-commit]", {timeout: 8000}); await page.tap(".dsheet [data-commit]");
    for (let i = 0; i < 30 && (await meals("tester")).length === n; i++) await sleep(200); const m = (await meals("tester", "&limit=1"))[0];
    ok(m.items[0].kcal === 376, "Sprechen rechnet mit demselben Wert: 250 g gekocht = 376 kcal (346 ÷ 2,3 × 2,5)", JSON.stringify(m.items[0]));
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
