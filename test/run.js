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
    /* one list, not two (Wunsch von Nathan): every friend once, and every row opens that friend's days */
    ok(await page.evaluate(() => [...document.querySelectorAll("#main [data-fr]")].filter(b => /Mila/.test(b.innerText)).length === 1), "Mila steht nur einmal da (Ranking und Freundesliste sind eins)");
    await page.locator("#kchrl [data-fr]", {hasText: "Mila"}).first().tap(); await sleep(600);
    ok(/Mila/.test(await txt(page, ".dsheet")) && /Ziel/.test(await txt(page, ".dsheet")), "Tipp auf Mila im Ranking „Einhaltung“ öffnet ihre Tage (Deep Dive)", (await txt(page, ".dsheet")).slice(0, 120)); await closeSheets(page); await sleep(300);
    await page.tap('#main [data-hr="today"]'); await sleep(400);
    ok(/kcal heute/.test(await txt(page, "#kchrl")) && /heute/.test(await txt(page, "#kchrw")), "Reiter „Heute“: Fortschritt von heute mit Flamme", await txt(page, "#kchrl"));
    ok(await has(page, '#main [data-inv]'), "Jonas (trackt nicht) lässt sich einladen");
    await page.tap("#main [data-inv]"); await sleep(800); ok((await L.table("kcal_invites", "to_id=eq." + ID.jonas)).length === 1, "Einladung landet in der Datenbank");
    /* applause: Mila reached her goal today */
    if (!(await has(page, '#main [data-hr="today"].on'))){ await page.tap('#main [data-hr="today"]'); await sleep(500); }
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
    ok(await a.evaluate(() => !!document.querySelector(".ar-l")), "Nat Stars startet gegen Bots");
    for (let i = 0; i < 40 && (await a.evaluate(() => __ar().ph)) !== "fight"; i++) await sleep(250);
    const ar = await a.evaluate(() => __ar()); await sleep(1800); const ar2 = await a.evaluate(() => __ar()); await a.shot("natstars-kampf");
    ok(ar.ph === "fight" && ar.z < ar2.z * .8, "Nat Stars: zum Start kurz die ganze Karte, dann gleitet die Kamera zu dir (Zoom " + (ar.z || 0).toFixed(2) + " → " + (ar2.z || 0).toFixed(2) + ")", JSON.stringify([ar.z, ar2.z]));
    ok(ar.crates >= 10 && ar.crates <= 18 && ar.crateHp >= 200, "Nat Stars: wenige Kisten, meist einzeln (" + ar.crates + " auf der Karte „" + ar.map + "“, vorher 56 bis 68), jede hält " + ar.crateHp + " aus (vorher 72)", JSON.stringify({c: ar.crates, map: ar.map, hp: ar.crateHp}));
    await a.evaluate(() => __arAt(80000)); await sleep(600); await a.shot("natstars-gas");
    const pw = await a.evaluate(() => __arGive(15)); ok(pw === 15, "Nat Stars: kein Limit mehr bei 12 Power-Würfeln (15 aufgesammelt, 15 zählen)", String(pw));
    await a.evaluate(() => document.querySelector("#lleave").click()); await sleep(1200);
    await a.evaluate(id => App.go("chat", {id}), ID.mila); await a.waitForSelector("#ctext"); await sleep(600); await a.tap("#ctext"); await a.keyboard.type("was die sache ist", {delay: 20});
    ok(await a.inputValue("#ctext") === "was die sache ist", "nach einer Runde Nat Stars: W A S D E Q und Leerzeichen lassen sich weiter tippen", await a.inputValue("#ctext"));
    await clean([a, b], "Nat Stars und zurück", /AudioContext|play\(\)/);
    /* friends → play leads to every game */
    await a.evaluate(() => App.go("friends", {tab: "friends"})); await sleep(900);
    const play = a.locator("#main .fa-play, #main [data-play], #main button:has-text('Spielen')").first();
    if (ok(await play.count() > 0, "Freunde: „Spielen“-Knopf bei einem Freund")){ await play.tap(); await sleep(600); const t = await txt(a, ".dsheet"); ok(/Schach/.test(t) && /Nat Stars/.test(t) && /Natposter/.test(t) && /Party/.test(t), "„Spielen“ führt zu jedem Spiel (Schach, Natposter, Nat Stars, Partyspiele)", t.slice(0, 200)); await a.shot("freunde-spielen"); await closeSheets(a); }
    await clean([a, b], "Freunde → Spielen"); await a.context().close(); await b.context().close();
  },

  /* ---------- Nat Stars: der Lichtstrahl (neuer Kämpfer) ---------- */
  async natstars(browser){
    const a = await L.open(browser, "tester");
    await a.evaluate(() => App.go("party", {g: "arena"})); await sleep(900); await a.locator("#main button", {hasText: "Gegen Bots"}).first().tap();
    await a.waitForSelector('.ar-card[data-arc="beam"]', {timeout: 8000}).catch(() => {}); await sleep(400); await a.shot("natstars-auswahl");
    const cards = await a.$$eval(".ar-card", x => x.map(c => c.dataset.arc + ":" + c.getBoundingClientRect().width));
    ok(cards.length === 8 && cards.some(c => c.startsWith("beam")) && cards.some(c => c.startsWith("hammer")), "Auswahl: 8 Kämpfer, mit Lichtstrahl und neu dem Hammer", JSON.stringify(cards));
    ok(/Hammer/.test(await txt(a, '.ar-card[data-arc="hammer"]')) && /Erdbeben/.test(await txt(a, '.ar-card[data-arc="hammer"]')), "Hammer-Karte: Name, „Schlägt im Bogen“, Super „Erdbeben“", await txt(a, '.ar-card[data-arc="hammer"]'));
    ok(/Lichtstrahl/.test(await txt(a, '.ar-card[data-arc="beam"]')) && /Blendlicht/.test(await txt(a, '.ar-card[data-arc="beam"]')), "Lichtstrahl-Karte: Name, „Haftet · saugt Leben“, Super „Blendlicht“", await txt(a, '.ar-card[data-arc="beam"]'));
    await a.tap('.ar-card[data-arc="beam"]');
    for (let i = 0; i < 60 && (await a.evaluate(() => __ar().ph)) !== "fight"; i++) await sleep(250);
    await sleep(1800); await a.evaluate(() => __arFreeze(true));
    const me = await a.evaluate(() => { const r = __ar(), id = Object.keys(r.cls).find(x => r.cls[x] === "beam" && !/^bot/.test(x)) || Object.keys(r.cls).find(x => !/^bot/.test(x)); return {id, cls: r.cls[id], x: r.me.x, y: r.me.y, bot: Object.keys(r.cls).find(x => /^bot/.test(x) || x !== id)}; });
    ok(me.cls === "beam", "du kämpfst als Lichtstrahl", JSON.stringify(me));
    let f3 = []; for (let i = 0; i < 30; i++){ f3 = await a.evaluate(() => __ar3()); if (f3.length && f3.every(x => x[1] === "ok")) break; await sleep(250); }
    ok(f3.length >= 2 && f3.every(x => x[1] === "ok"), "3D-Kämpfer: jeder als eigene 3D-Figur mit Laufbildern (vorn und hinten)", JSON.stringify(f3));
    /* a bot right in front of you, frozen */
    const spot = await a.evaluate(m => { for (let r = 200; r <= 360; r += 40) for (let k = 0; k < 16; k++){ const an = k / 16 * Math.PI * 2, f = __arFree(m.x + Math.cos(an) * r, m.y + Math.sin(an) * r); if (!f) continue; const d = Math.hypot(f.x - m.x, f.y - m.y); if (d > 150 && d < 400 && __arClear(m, f)) return f; } return null; }, me);
    ok(!!spot, "freie Stelle mit Sicht für den Test-Gegner", JSON.stringify(me));
    await a.evaluate(([id, s]) => __arBot(id, s.x, s.y), [me.bot, spot]); await sleep(300);
    await a.evaluate(() => __arHurt(60)); await sleep(600);
    const hp0 = await a.evaluate(() => __ar().hp), b0 = await a.evaluate(id => __arBotS(id), me.bot);
    await a.evaluate(([m, s]) => __arFire(Math.atan2(s.y - m.y, s.x - m.x)), [me, spot]); await sleep(450);
    const mid = await a.evaluate(id => ({beams: __arBeams(), b: __arBotS(id)}), me.bot); await a.shot("natstars-lichtstrahl");
    ok(mid.beams.some(b => b.tg === me.bot && !b.heal) && mid.b.slow < 1, "der Strahl haftet am Gegner und bremst ihn", JSON.stringify(mid));
    await sleep(1800); const hp1 = await a.evaluate(() => __ar().hp), b1 = await a.evaluate(id => __arBotS(id), me.bot), st1 = await a.evaluate(id => __arBeams().filter(b => b.by === id), me.id);
    ok(st1.length === 1 && b0.hp - b1.hp >= 54, "der Strahl hält, solange der Gegner in Reichweite ist: nach gut 2 s " + (b0.hp - b1.hp) + " Schaden, Verbindung steht", JSON.stringify({b0, b1, st1}));
    ok(hp1[me.id] > hp0[me.id], "und du bekommst Leben zurück (" + hp0[me.id] + " → " + hp1[me.id] + ")", JSON.stringify([hp0[me.id], hp1[me.id]]));
    /* out of reach: a second to come back, then it is gone */
    await a.evaluate(([id, m]) => __arBot(id, m.x + 1400, m.y), [me.bot, me]); await sleep(500); await a.evaluate(([id, s]) => __arBot(id, s.x, s.y), [me.bot, spot]); await sleep(400);
    const mine = () => a.evaluate(id => __arBeams().filter(b => b.by === id), me.id);
    ok((await mine()).length === 1, "kurz außer Reichweite (0,5 s) und zurück: die Verbindung steht wieder", JSON.stringify(await mine()));
    await a.evaluate(([id, m]) => __arBot(id, m.x + 1400, m.y), [me.bot, me]); await sleep(1300); await a.evaluate(([id, s]) => __arBot(id, s.x, s.y), [me.bot, spot]); await sleep(300);
    ok((await mine()).length === 0, "über 1 s außer Reichweite: die Verbindung ist weg, man muss neu treffen", JSON.stringify(await mine()));
    await a.evaluate(([m, s]) => __arFire(Math.atan2(s.y - m.y, s.x - m.x)), [me, spot]); await sleep(300); const b1b = await a.evaluate(id => __arBotS(id), me.bot);
    /* the super: blinding light, the bot runs away (a fresh bot, the first one has taken a lot) */
    me.bot = await a.evaluate(([id, old]) => { const r = __ar(); return Object.keys(r.cls).filter(x => x !== id && x !== old && !r.out.includes(x)).sort((p, q) => r.hp[q] - r.hp[p])[0]; }, [me.id, me.bot]);
    await a.evaluate(([id, s]) => { __arNoCubes(); __arPark(id); __arBot(id, s.x, s.y); }, [me.bot, spot]); await sleep(300); const b1c = await a.evaluate(id => __arBotS(id), me.bot);
    await a.evaluate(() => __arSup(1)); await a.evaluate(([m, s]) => __arFire(Math.atan2(s.y - m.y, s.x - m.x), true), [me, spot]); await sleep(300); await a.shot("natstars-blendlicht");
    const b2 = await a.evaluate(id => __arBotS(id), me.bot);
    ok(!b2.fear && b1c.hp - b2.hp >= 60, "Blendlicht: Treffer (" + (b1c.hp - b2.hp) + "), keine Furcht mehr – niemand rennt weg", JSON.stringify(b2));
    await a.evaluate(() => __arFreeze(false)); await sleep(1200);
    /* the hammer: a wind-up, then a blow on everyone in the arc; the earthquake all around; its super charges while an enemy is close */
    await a.evaluate(() => { __arFreeze(true); __arCls("hammer"); __arSup(0); }); const m2 = await a.evaluate(() => __ar().me);
    /* a fresh bot for the rest (the first one has taken a lot by now) */
    me.bot = await a.evaluate(([id, old]) => { const r = __ar(); return Object.keys(r.cls).filter(x => x !== id && x !== old && !r.out.includes(x)).sort((p, q) => r.hp[q] - r.hp[p])[0]; }, [me.id, me.bot]);
    const near = await a.evaluate(m => { for (let r = 110; r <= 140; r += 10) for (let k = 0; k < 24; k++){ const an = k / 24 * Math.PI * 2, f = __arFree(m.x + Math.cos(an) * r, m.y + Math.sin(an) * r); if (!f) continue; const d = Math.hypot(f.x - m.x, f.y - m.y); if (d > 95 && d < 150 && __arClear(m, f)) return f; } return null; }, m2);
    if (ok(!!near, "freie Stelle direkt vor dem Hammer", JSON.stringify(m2))){
      await a.evaluate(([id, s]) => { __arNoCubes(); __arPark(id); __arBot(id, s.x, s.y); }, [me.bot, near]); await sleep(1200); const h0 = (await a.evaluate(id => __arBotS(id), me.bot)).hp, s0 = await a.evaluate(() => __ar().sup);
      ok(s0 > .05, "Lade-Radius: steht ein Gegner nah, lädt sich das Super von selbst (" + Math.round(s0 * 100) + " % nach gut 1 s)", String(s0));
      await a.evaluate(([m, s]) => __arFire(Math.atan2(s.y - m.y, s.x - m.x)), [m2, near]); await sleep(130); const h1 = (await a.evaluate(id => __arBotS(id), me.bot)).hp; await sleep(350); await a.shot("natstars-hammer"); const h2 = (await a.evaluate(id => __arBotS(id), me.bot)).hp;
      ok(h1 === h0 && h0 - h2 >= 38 && h0 - h2 <= 48, "Hammer: erst ausholen (nach 0,13 s noch kein Treffer), dann " + (h0 - h2) + " Schaden im Bogen", JSON.stringify([h0, h1, h2]));
      const q0 = await a.evaluate(id => __arBotS(id), me.bot); await a.evaluate(() => __arSup(1)); await a.evaluate(() => __arFire(null, true)); await sleep(260); const q1 = await a.evaluate(id => __arBotS(id), me.bot); await a.shot("natstars-erdbeben"); const away = q1.kb ? q1.kb[0] * (q0.x - m2.x) + q1.kb[1] * (q0.y - m2.y) : -1;
      ok(q0.hp - q1.hp >= 50 && away > 0, "Erdbeben: " + (q0.hp - q1.hp) + " Schaden rundherum, der Gegner wird weggestoßen", JSON.stringify([m2, q0, q1]));
      await a.evaluate(([id, m]) => __arBot(id, m.x + 2000, m.y + 2000), [me.bot, m2]); await a.evaluate(() => __arSup(0)); await sleep(1000); ok(await a.evaluate(() => __ar().sup) === 0, "ohne Gegner im Radius lädt sich nichts", String(await a.evaluate(() => __ar().sup))); }
    /* power cubes fly to you when you're close */
    const pwa = (await a.evaluate(() => __arPw())).pw, kNear = await a.evaluate(() => __arDrop(95, 40)), kFar = await a.evaluate(() => __arDrop(-260, 0)); await sleep(1000); const pwb = await a.evaluate(() => __arPw());
    ok(pwb.pw === pwa + 1 && !pwb.cubes.includes(kNear) && pwb.cubes.includes(kFar), "Power-Würfel: aus gut 100 px fliegt er von selbst zu dir, aus 260 px nicht", JSON.stringify({pwa, pwb, kNear, kFar}));
    /* the tap aims ahead of a running enemy; bots go easier when friends play together, not alone */
    await a.evaluate(() => __arCls("gun")); const m3 = await a.evaluate(() => __ar().me);
    await a.evaluate(id => __arPark(id), me.bot);
    const far = await a.evaluate(([m, id]) => { for (let r = 380; r <= 460; r += 20) for (let k = 0; k < 24; k++){ const an = k / 24 * Math.PI * 2, f = __arFree(m.x + Math.cos(an) * r, m.y + Math.sin(an) * r); if (!f || !__arClear(m, f) || Math.hypot(f.x - m.x, f.y - m.y) < 350) continue; const dr = Math.atan2(f.y - m.y, f.x - m.x), lp = {x: f.x - Math.sin(dr) * 130, y: f.y + Math.cos(dr) * 130}, lf = __arFree(lp.x, lp.y); if (!lf || Math.hypot(lf.x - lp.x, lf.y - lp.y) > 8 || !__arClear(m, lp)) continue; __arBot(id, f.x, f.y); const sn = __arSeen(id); if (sn && sn.vis) return f; } return null; }, [m3, me.bot]);
    if (ok(!!far, "freie, sichtbare Stelle für den laufenden Gegner")){
      await a.evaluate(([id, s]) => __arBot(id, s.x, s.y), [me.bot, far]); const dir = Math.atan2(far.y - m3.y, far.x - m3.x), vx = -Math.sin(dir) * 250, vy = Math.cos(dir) * 250;
      await a.evaluate(([id, x, y]) => __arMoving(id, x, y), [me.bot, vx, vy]); await sleep(100); const au = await a.evaluate(() => __arAuto(false)), da = Math.atan2(Math.sin(au.a - dir), Math.cos(au.a - dir));
      ok(au.id === me.bot && da > .12, "Auto-Zielen: zielt beim Revolver vor den laufenden Gegner (" + Math.round(da * 57) + "° voraus)", JSON.stringify({au, dir, da})); }
    const sf = await a.evaluate(() => { const was = PNet.P.solo, r1 = __arSoft(["u1", "bot1", "bot2"]); PNet.P.solo = false; const r2 = __arSoft(["u1", "u2", "bot1"]), r3 = __arSoft(["u1", "bot1"]); PNet.P.solo = was; return [r1, r2, r3]; });
    ok(!sf[0] && sf[1] && !sf[2], "Bots: mit 2+ Menschen etwas schwächer, allein gegen Bots nicht", JSON.stringify(sf));
    /* the sniper pressed while still reloading: it starts charging as soon as a shot is ready, no plain shot */
    await a.evaluate(() => { __arCls("snipe"); __arAmmo(0); }); await a.keyboard.down("Space"); await sleep(400); const w1 = await a.evaluate(() => __arChg());
    await sleep(2300); const w2 = await a.evaluate(() => __arChg()); await a.keyboard.up("Space"); await sleep(100);
    ok(w1.wait && !w1.chg && w2.chg > .5 && !w2.wait, "Scharfschütze: gedrückt ohne Munition → lädt auf, sobald der Schuss bereit ist (" + Math.round(w2.chg * 100) + " %)", JSON.stringify([w1, w2]));
    ok(!!(await a.evaluate(() => __arRigShot(2))), "Kämpfer laufen: Beine, Arme, Körper und Kopf als eigene Teile (Laufanimation)");
    await a.evaluate(() => __arFreeze(false));
    await a.evaluate(() => document.querySelector("#lleave").click()); await sleep(800);
    await clean(a, "Nat Stars Lichtstrahl", /AudioContext|play\(\)/); await a.context().close();
    /* on a laptop: ideas & feedback in the sidebar; the super with right-click, E, or the button */
    const d = await L.open(browser, "tester", {desktop: true}); await sleep(800);
    if (ok(await d.locator("#rail [data-fbk]").isVisible().catch(() => false), "Laptop: „Ideen & Feedback“ in der Seitenleiste")){ await d.locator("#rail [data-fbk]").click(); await sleep(700); ok(await has(d, ".fb-ov"), "Laptop: der Knopf öffnet Ideen & Feedback"); await d.evaluate(() => { const x = document.querySelector(".fb-ov #fbx"); if (x) x.click(); }); await sleep(400); }
    await d.evaluate(() => App.go("party", {g: "arena"})); await sleep(900); await d.locator("#main button", {hasText: "Gegen Bots"}).first().click();
    for (let i = 0; i < 80 && (await d.evaluate(() => __ar().ph)) !== "fight"; i++) await sleep(250); await sleep(1800); await d.evaluate(() => __arFreeze(true));
    const vw = d.viewportSize(), sup = [];
    await d.evaluate(() => __arSup(1)); await d.mouse.click(vw.width * .7, vw.height * .4, {button: "right"}); await sleep(250); sup.push(await d.evaluate(() => __ar().sup));
    await d.evaluate(() => __arSup(1)); await d.keyboard.press("e"); await sleep(250); sup.push(await d.evaluate(() => __ar().sup));
    await d.evaluate(() => __arSup(1)); await d.locator(".ar-sup").click(); await sleep(250); sup.push(await d.evaluate(() => __ar().sup));
    ok(sup.every(x => x === 0), "Laptop: Super per Rechtsklick, Taste E und Knopf", JSON.stringify(sup));
    ok(await d.locator(".ar-sk").isVisible().catch(() => false), "Laptop: am Super-Knopf steht „Rechtsklick · E“"); await d.shot("natstars-laptop");
    await d.evaluate(() => document.querySelector("#lleave").click()); await sleep(800); await clean(d, "Nat Stars am Laptop", /AudioContext|play\(\)/); await d.context().close();
  },

  /* ---------- Tippspiel ---------- */
  async tipp(browser){
    const page = await L.open(browser, "tester"); await page.tap('#tabbar [data-t="tipp"]'); await sleep(1500);
    const t = await txt(page, "#main"); ok(/Bayern/.test(t) && /Leipzig/.test(t) && /5 offen/.test(t), "Tippspiel zeigt die offenen Spiele (5 offen, mit Deutschland in der Nations League)", t.slice(0, 200)); await page.shot("tipp");
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

  /* ---------- Nations League: groups, what has to happen (with the tie-breakers), what if, bracket ---------- */
  async nations(browser){
    const page = await L.open(browser, "tester"); await page.tap('#tabbar [data-t="tipp"]'); await sleep(1500);
    /* the chip: only the Nations League games */
    await page.tap('#main [data-f="uefa.nations"]'); await sleep(500); let t = await txt(page, "#tpbody");
    ok(/Deutschland/.test(t) && /Niederlande/.test(t) && /Gruppe A2/.test(t) && !/Bayern/.test(t), "Chip „Nations League“: nur die Nations-League-Spiele, mit Gruppe", t.slice(0, 200));
    await page.tap('#main [data-f="all"]'); await sleep(300);
    await page.tap('#main [data-tab="nl"]'); await sleep(1500); t = await txt(page, "#tpbody"); await page.shot("nations");
    ok(/Gruppe A1/.test(t) && /Gruppe A2/.test(t), "Tab „Nations League“: die Gruppen mit Tabelle", t.slice(0, 200));
    ok(/Live/.test(t) && /Frankreich/.test(t) && /1:0/.test(t), "das laufende Spiel Frankreich – Türkei steht live oben", t.slice(0, 200));
    ok(/Deutschland kommt weiter, wenn/.test(t) && /Sieg gegen die Niederlande: sicher weiter/.test(t), "Deutschland: mit einem Sieg sicher weiter", t.slice(0, 600));
    ok(/Remis gegen die Niederlande: weiter nur, wenn Serbien gegen Griechenland gewinnt/.test(t), "Deutschland: bei Remis muss Serbien gegen Griechenland gewinnen (Griechenland hat den direkten Vergleich)", t.slice(0, 600));
    ok(/Niederlage gegen die Niederlande: raus \(Platz 3 → Relegation\)/.test(t), "Deutschland: bei einer Niederlage raus, Platz 3", t.slice(0, 600));
    ok(/Frankreich fliegt raus, wenn/.test(t) && /Niederlage gegen die Türkei: raus, wenn Belgien gegen Italien gewinnt/.test(t), "Frankreich fliegt nur raus, wenn es verliert und Belgien gegen Italien gewinnt", t.slice(0, 900));
    /* the tie-breakers on their own: Germany beat the Netherlands, Greece beat Serbia: three teams on 11 points */
    const tie = await page.evaluate(() => { const d = NL.d, A2 = d.matches.filter(m => m.grp === "A2" && m.state === "post"), ids = ["449", "481", "455", "6757"];
      const r = (g, x) => NL._order(ids, A2.concat([{h: "481", a: "449", sh: g, sa: 0}, {h: "455", a: "6757", sh: 1, sa: 0}]))[x][0];
      return [r(4, "449"), r(4, "481"), r(4, "455"), r(5, "481"), r(5, "449")]; });
    ok(JSON.stringify(tie) === "[1,2,3,1,2]", "Dreiergleichstand: direkter Vergleich (Tordifferenz, dann Tore) – 4:0 reicht nicht für Platz 1, 5:0 schon", JSON.stringify(tie));
    /* a team: what has to happen, and what if */
    await page.locator('#main .nl-g.ger [data-nlteam="481"]').first().tap(); await sleep(700); let sh = await txt(page, ".dsheet");
    ok(/Was muss passieren, damit Deutschland weiterkommt/.test(sh) && await has(page, ".dsheet .nl-mx .nl-c"), "Deutschland antippen: was muss passieren, mit allen Ausgängen", sh.slice(0, 300)); await page.shot("nations-team");
    const plus = (i, s) => page.locator(`.dsheet .nl-sm >> nth=${i}`).locator(`[data-s="${s}"] [data-d="1"]`).tap(), minus = (i, s) => page.locator(`.dsheet .nl-sm >> nth=${i}`).locator(`[data-s="${s}"] [data-d="-1"]`).tap();
    await plus(0, "h"); await sleep(300); ok(/Deutschland: Platz 1/.test(await txt(page, ".dsheet .nl-simv")), "Was wäre wenn: 1:0 gegen die Niederlande → Platz 1", await txt(page, ".dsheet .nl-simv"));
    await minus(0, "h"); await sleep(200); await plus(1, "h"); await sleep(300);
    ok(/Platz 3/.test(await txt(page, ".dsheet .nl-simv")), "Was wäre wenn: 0:0 und Griechenland gewinnt → Platz 3 (Relegation)", await txt(page, ".dsheet .nl-simv"));
    await page.locator(".dsheet [data-reset]").tap(); await sleep(200); ok(/\?/.test(await txt(page, ".dsheet .nl-sim .nl-sm")), "„Zurück auf Stand jetzt“ setzt die eigenen Ergebnisse zurück");
    await closeSheets(page);
    /* the bracket */
    await page.tap('#main [data-nlsub="tree"]'); await sleep(500); t = await txt(page, "#tpbody"); await page.shot("nations-tree");
    ok(/Viertelfinale/i.test(t) && /Halbfinale/i.test(t) && /Finale/i.test(t) && /Niederlande/.test(t), "Turnierbaum: Viertelfinale bis Finale, dazu wer Stand jetzt drin ist", t.slice(0, 300));
    await page.locator('#main .nl-seeds [data-nlteam]').first().tap(); await sleep(600); ok(/Was muss passieren/.test(await txt(page, ".dsheet")), "Team im Turnierbaum antippen öffnet „Was muss passieren“");
    await closeSheets(page); await page.tap('#main [data-nlsub="groups"]'); await sleep(300);
    await clean(page, "Nations League"); await page.context().close();
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

  /* ---------- the forgiving search (Wunsch von Nathan): typos, other spelling, other word order, and by meaning; what you ate before comes first ---------- */
  async suche(browser){
    const d3 = new Date(Date.now() - 3 * 864e5), day = d3.getFullYear() + "-" + String(d3.getMonth() + 1).padStart(2, "0") + "-" + String(d3.getDate()).padStart(2, "0"), code = "4063367101045";
    const trio = {name: "Buntes Frucht-Trio (Danone)", amount: "125 g", kcal: 120, carbs: 17, protein: 4, fat: 3.6, code, g: 125, per: {n: "Buntes Frucht-Trio", b: "Danone", k: 96, c: 13.6, pr: 3.2, f: 2.9, s: 125, pk: 500, img: null, ss: "125 g", fi: 0, su: 12, sf: 1.9, sa: .1, ns: "", hd: 1}};
    for (const hh of [0, 5]) await L.stage("POST", "kcal_meals", "", {user_id: ID.tester, day, ts: new Date(d3.getTime() + hh * 36e5).toISOString(), title: "Buntes Frucht-Trio", emoji: "📦", source: "barcode", kcal: 120, carbs: 17, protein: 4, fat: 3.6, code, items: [trio]});
    const page = await L.open(browser, "tester"); await page.waitForFunction(c => window.Kcal && Kcal.meals && Kcal.meals.some(m => m.code === c), code, {timeout: 10000}).catch(() => {});
    const search = async (text, want) => { await page.tap("#main [data-kc-find]"); await sleep(400); await page.keyboard.type(text, {delay: 15});
      await page.waitForFunction(w => { const o = document.querySelector("#kcsr"); return o && !o.classList.contains("busy") && new RegExp(w).test(o.innerText); }, want, {timeout: 7000}).catch(() => {}); await sleep(250); return txt(page, "#kcsr"); };
    const shut = async () => { if (await has(page, "#kcsx")){ await page.tap("#kcsx"); await sleep(400); } };
    const e0 = global.__embeds || 0;
    let t = await search("Fruchtrio", "Schon gegessen"); await page.shot("suche-fruchtrio");
    ok(/^Schon gegessen/.test(t) && /Buntes Frucht-Trio/.test(t) && /2× gegessen/.test(t), "„Fruchtrio“ (falsch geschrieben) findet das „Buntes Frucht-Trio“ ganz oben unter „Schon gegessen“ (2× gegessen)", t.slice(0, 160));
    /* taking it from there works like any product: its own portion, its own values */
    const n0 = (await L.table("kcal_meals", "user_id=eq." + ID.tester)).length;
    await page.tap('#kcsr .kc-sres:has-text("Buntes Frucht-Trio")'); await sleep(500); await page.tap(".kc-sov [data-add]"); await sleep(1100);
    const m = (await L.table("kcal_meals", "user_id=eq." + ID.tester + "&order=ts.desc&limit=1"))[0] || {};
    ok((await L.table("kcal_meals", "user_id=eq." + ID.tester)).length === n0 + 1 && m.code === code && m.kcal === 120 && m.source === "search", "angetippt und hinzugefügt: 125 g Frucht-Trio = 120 kcal, mit Barcode", JSON.stringify([m.title, m.kcal, m.code, m.source]));
    await clean(page, "Suche mit Tippfehler");
    t = await search("trio frucht", "Schon gegessen"); ok(/Schon gegessen[\s\S]*Buntes Frucht-Trio/.test(t), "andere Reihenfolge („trio frucht“) findet es auch", t.slice(0, 120)); await shut();
    t = await search("Fruchtjoghurt", "Passt vielleicht"); await page.shot("suche-fruchtjoghurt");
    ok(/Passt vielleicht[\s\S]*Buntes Frucht-Trio/.test(t), "„Fruchtjoghurt“: kein Wort gleich, trotzdem schlägt die Bedeutungs-Suche das Frucht-Trio vor", t.slice(0, 200));
    ok((global.__embeds || 0) > e0, "dafür wurde das Embedding-Modell gefragt");
    ok(!/Passt vielleicht[\s\S]*Haferflocken/.test(t), "Unpassendes (Haferflocken) steht nicht bei „Passt vielleicht“", t.slice(0, 200)); await shut();
    t = await search("Hafrflocken", "Haferflocken[\\s\\S]*pro 100 g|pro 100 g[\\s\\S]*Haferflocken"); ok(/Haferflocken/.test(t), "„Hafrflocken“ (Tippfehler) findet die Haferflocken", t.slice(0, 160)); await shut();
    /* nothing typed: what you eat often */
    await page.tap("#main [data-kc-find]"); await sleep(600); t = await txt(page, "#kcsr"); ok(/Buntes Frucht-Trio/.test(t), "leeres Suchfeld: zuletzt Gesuchtes und oft Gegessenes stehen schon da", t.slice(0, 160)); await shut();
    /* the free AI tier: no embedding model allowed; the language model picks instead, and a misspelt "Fruchtyogurt" still finds the Frucht-Trio */
    process.env.FAKE_EMBED_DOWN = "1"; const l0 = global.__findLLM || 0; t = await search("Fruchtyogurt", "Passt vielleicht|Am ehesten"); delete process.env.FAKE_EMBED_DOWN;
    ok(/Frucht-Trio/.test(t) && (global.__findLLM || 0) > l0, "kein Embedding-Modell erlaubt (kostenloser Tarif): die KI wählt, „Fruchtyogurt“ schlägt das Frucht-Trio vor", t.slice(0, 200)); await page.shot("suche-fruchtyogurt"); await shut();
    /* nothing at all fits: still the closest ones, never an empty list */
    t = await search("Xylophonbrei", "Am ehesten|Nichts"); ok(/Am ehesten/.test(t) && /pro 100 g/.test(t), "auch bei Unsinn steht nie „nichts“ da, sondern was am nächsten kommt", t.slice(0, 160)); await shut();
    /* the model is down: the forgiving search still works */
    process.env.FAKE_AI_DOWN = "1"; t = await search("Fruchtrio", "Schon gegessen"); delete process.env.FAKE_AI_DOWN;
    ok(/Schon gegessen[\s\S]*Buntes Frucht-Trio/.test(t), "ohne KI findet die Suche Bekanntes trotzdem", t.slice(0, 120)); await shut();
    await clean(page, "Suche nach Bedeutung"); await page.context().close();
  },

  /* ---------- the friends page: the friends that matter most first (Wunsch von Nathan) ---------- */
  async freunde(browser){
    const order = async page => { await page.evaluate(() => App.go("friends")); await page.waitForSelector(".fr-list .li", {timeout: 8000}).catch(() => {}); await sleep(1200);
      return page.evaluate(() => [...document.querySelectorAll(".fr-list .li .t")].map(x => x.innerText.replace(/\(.*\)/, "").trim())); };
    let page = await L.open(browser, "tester"), o = await order(page);
    ok(o[0] === "Mila" && o.includes("Jonas"), "ungelesene Nachricht von Mila: Mila steht oben", JSON.stringify(o)); await page.context().close();
    /* Mila's messages read; with Jonas written just now: Jonas comes first, even though Mila is online */
    await L.stage("PATCH", "chess_messages", "to_id=eq." + ID.tester, {read_at: new Date().toISOString()});
    for (let i = 0; i < 3; i++) await L.stage("POST", "chess_messages", "", {from_id: ID.tester, to_id: ID.jonas, body: "Hey Jonas " + i, created_at: new Date(Date.now() - (3 - i) * 60000).toISOString(), read_at: null});
    page = await L.open(browser, "tester"); o = await order(page); await page.shot("freunde-reihenfolge");
    ok(o[0] === "Jonas", "zuletzt mit Jonas geschrieben: Jonas steht oben", JSON.stringify(o));
    await clean(page, "Freunde-Reihenfolge"); await page.context().close();
  },

  /* ---------- Song raten (Wunsch von Nathan): its own game, genre or own artists, type the answer (typos forgiven) or pick of four ---------- */
  async song(browser){
    /* Safari's audio session, imitated: what the game tells the iPhone about its sound (silent switch) */
    const fakeAS = () => { Object.defineProperty(navigator, "audioSession", {value: {_t: "auto", get type(){ return this._t; }, set type(v){ this._t = v; }}, configurable: true}); };
    const page = await L.open(browser, "tester", {before: fakeAS}); let last = "";
    page.on("request", r => { const m = /audio-ssl\.itunes\.apple\.com\/fake\/([^?]+)\.m4a/.exec(r.url()); if (m) last = decodeURIComponent(m[1]); });
    /* the points are checked exactly: no connoisseur songs (+1) in between */
    const shares = await page.evaluate(() => JSON.parse(JSON.stringify(PG._song.LVL)));
    await page.evaluate(() => { const L2 = PG._song.LVL; L2.main = [.8, .2, 0]; L2.mid = [.6, .4, 0]; L2.fan = [.2, .8, 0]; });
    await page.evaluate(() => App.go("games")); await sleep(700);
    ok(await has(page, '#main [data-g="song"]'), "„Song raten“ steht bei den Spielen");
    const order = await page.$$eval("#main .pg-gt", x => x.map(b => b.querySelector("h3").innerText.trim()));
    ok(order.indexOf("Song raten") >= 0 && order.indexOf("Song raten") <= 3, "„Song raten“ steht weit oben (Platz " + (order.indexOf("Song raten") + 1) + ")", order.join(" · "));
    await page.tap('#main [data-g="song"]'); await sleep(700);
    ok(/Genre/.test(await txt(page, "#main")) && await has(page, '[data-gn="y80"]'), "Einstellungen: Genres zur Wahl (u. a. 80er)");
    ok(/Mainstream/.test(await txt(page, "#sgl")) && /Medium/.test(await txt(page, "#sgl")) && /Groupie/.test(await txt(page, "#sgl")), "„Wie bekannt“: Mainstream, Medium, Groupie", await txt(page, "#sgl"));
    const gens = await page.$$eval("[data-gn]", x => x.map(b => b.dataset.gn));
    ok(gens.length >= 22 && ["kpop", "latin", "rnb", "indie", "metal", "film", "xmas", "y60", "y20"].every(g => gens.includes(g)), "mehr Kategorien: " + gens.length + " (u. a. K-Pop, Latin, R&B, Indie, Metal, Film, Weihnachten, 60er/70er, 2020er)", gens.join(","));
    /* a Spotify playlist: paste the link, the songs are read in */
    await page.locator("#sgpl input").fill("https://open.spotify.com/playlist/pl1aaaaaaaaaaa?si=abc"); await page.locator("#sgpl button[type=submit]").tap(); await sleep(1500);
    ok(/Nats Mix/.test(await txt(page, "#sgpl")) && /6 Songs/.test(await txt(page, "#sgpl")) && await has(page, '[data-gn="pl"].go'), "Spotify-Playlist per Link geladen (Nats Mix, 6 Songs) und gleich als Genre gewählt", await txt(page, "#sgpl")); await page.shot("song-playlist");
    await page.tap('#sga [data-v="pick"]'); await page.tap('#sgr [data-v="3"]'); await page.tap('#sgc [data-v="10"]'); await page.tap("#sggo"); await page.waitForSelector("#sgplay", {timeout: 8000}).catch(() => {}); await sleep(400);
    const PL1 = ["Bohemian Rhapsody", "Don't Stop Me Now", "Radio Ga Ga", "99 Luftballons", "Leuchtturm", "Irgendwie, irgendwo, irgendwann"];
    ok(PL1.some(t => last.startsWith(t)), "die Songs kommen aus der Playlist („" + last + "“)", last);
    await page.evaluate(() => App.go("games")); await sleep(400); await page.tap('#main [data-g="song"]'); await sleep(700);
    await page.tap('[data-gn="own"]'); await sleep(300);
    ok(await page.evaluate(() => document.activeElement && document.activeElement.id === "sgown"), "„Eigene Künstler“: das Feld ist sofort zum Tippen offen");
    await page.keyboard.type("Queen", {delay: 15}); await page.tap('#sgr [data-v="3"]'); await page.tap('#sga [data-v="type"]'); await page.tap('#sgc [data-v="10"]'); await sleep(200);
    ok(/Song-Bibliothek/.test(await txt(page, "#sga")) && /Immer länger/.test(await txt(page, "#sgc")), "Antworten: Song-Bibliothek oder 4 zur Auswahl; Reinhören auch „Immer länger“", (await txt(page, "#sga")) + " | " + (await txt(page, "#sgc")));
    await page.tap("#sggo"); await page.waitForSelector("#sgplay", {timeout: 8000}).catch(() => {}); await sleep(400);
    const audio = () => page.evaluate(() => { const a = PG.songSA.au; return {on: !a.paused, t: a.currentTime, src: decodeURIComponent(a.src || "")}; });
    ok(!!last, "der Song lädt schon, während das Handy weitergegeben wird (vor dem Tippen)", last);
    const play = async () => { await page.tap("#sgplay"); await sleep(500); };
    await play(); await page.shot("song-frage");
    ok(await page.evaluate(() => document.activeElement && document.activeElement.id === "sgt"), "Abspielen: das Suchfeld ist gleich offen (Tastatur)");
    let au = await audio(); ok(au.on && au.t > .1 && au.t < 1.5 && au.src.includes(last), "der Song spielt sofort, ab der ersten Sekunde", JSON.stringify(au));
    ok(await page.evaluate(() => navigator.audioSession.type === "playback"), "iPhone: der Song zählt als Musik, spielt also auch im Stummmodus", await page.evaluate(() => navigator.audioSession.type));
    /* the right title with a typo and without "(Remastered …)", Enter without tapping a hit */
    /* "Keep listening": goes on where the clip stopped */
    await page.tap("#sgre"); await sleep(500); au = await audio(); ok(au.on && au.t > 9.9, "„Weiter hören“: geht da weiter, wo der Ausschnitt aufgehört hat (bei " + au.t.toFixed(1) + " s)", JSON.stringify(au));
    /* "Search" on the keyboard only searches: nothing is locked in, the hits can be tapped */
    const t1 = last, b1 = t1.replace(/\s*\(.*\)$/, ""); await page.tap("#sgt"); await page.keyboard.type(b1.slice(0, 5), {delay: 10}); await page.keyboard.press("Enter"); await sleep(900); await page.shot("song-suchen");
    ok(await has(page, ".sg-sug") && !(await has(page, ".sg-ans")) && !(await page.$eval(".sg-sug", b => b.disabled)), "Enter („Suchen“) sucht nur: keine Antwort abgegeben, die Treffer lassen sich antippen", (await txt(page, "#main")).slice(0, 160));
    await page.locator(".sg-sug", {hasText: b1}).first().tap(); await sleep(500); await page.shot("song-antwort");
    ok(/\+1/.test(await txt(page, "#main")) && /✓/.test(await txt(page, "#main")), "Treffer angetippt: +1, richtiger Titel steht da", (await txt(page, "#main")).slice(0, 160));
    /* the song library: a few letters, the song is listed, one tap */
    await page.tap("#sgnx"); await sleep(400); await play(); const t2 = last, b2 = t2.replace(/\s*\(.*\)$/, "");
    await page.keyboard.type(b2.slice(0, 4), {delay: 20}); await page.waitForSelector(".sg-sug", {timeout: 5000}).catch(() => {}); await sleep(200); await page.shot("song-bibliothek");
    const sugs = await page.$$eval(".sg-sug", x => x.map(y => y.innerText.replace(/\s+/g, " ")));
    ok(sugs.some(x => x.includes(b2) && /Queen/.test(x)), "Song-Bibliothek: nach 4 Buchstaben („" + b2.slice(0, 4) + "“) steht der Song mit Interpret da", JSON.stringify(sugs));
    await page.locator(".sg-sug", {hasText: b2}).first().tap(); await sleep(500);
    ok(/\+1/.test(await txt(page, "#main")) && /✓/.test(await txt(page, "#main")), "Song angetippt: zählt, +1", (await txt(page, "#main")).slice(0, 160));
    await page.tap("#sgnx"); await sleep(400); await play(); ok(/Weiß nicht/.test(await txt(page, "#sgno")) && await page.evaluate(() => { const r = document.querySelector("#sgno").getBoundingClientRect(); return r.height >= 50 && r.width >= 140; }), "„Weiß nicht“ ist ein großer, klarer Knopf");
    await page.tap("#sgno"); await sleep(400);
    ok(/✗/.test(await txt(page, "#main")) && /\b0\b/.test(await txt(page, ".pg-name")), "„Weiß nicht“: 0 Punkte, die Lösung steht da"); await page.tap("#sgnx"); await sleep(600);
    ok(/Ergebnis/i.test(await txt(page, "#main")) && /\b2\b/.test(await txt(page, ".pg-name")), "nach 3 Songs: Ergebnis 2 Punkte mit Liste der Songs", (await txt(page, "#main")).slice(0, 160)); await page.shot("song-ergebnis");
    /* the wrong answers: never a song that is still to come, never shown first and played later; the song's language */
    const fair = await page.evaluate(async () => { const {Pool, langOf} = PG._song, P = Pool.make({genre: "own", own: "Queen, Nena, a-ha"}); P.used.clear(); await P.fill(6); const bad = [], shown = new Set(), n = P.songs.length;
      for (let i = 0; i < n; i++){ const s = P.next(); if (!s) break; const N = x => x.toLowerCase().replace(/\s*\(.*\)$/, "");
        if (shown.has(N(s.title))) bad.push("schon als falsch gezeigt: " + s.title);
        const o = P.opts(s, "title", 4) || []; o.forEach(x => { if (P.songs.some(c => N(c.title) === N(x))) bad.push("kommt noch: " + x); if (N(x) !== N(s.title)) shown.add(N(x)); }); }
      return {n, bad, de: [langOf("Ich will nur, dass du weißt"), langOf("Bierkönig", "party"), langOf("Take On Me"), langOf("Don't Stop Me Now")]}; });
    ok(fair.n >= 4 && !fair.bad.length, "falsche Antworten: nie ein Song, der noch kommt, und kein Song kommt, der schon als falsch dastand", JSON.stringify(fair));
    ok(fair.de.join() === "de,de,en,en", "Sprache erkannt (deutsch / englisch), damit die falschen Titel zur Sprache passen", JSON.stringify(fair.de));
    /* how well known: Mainstream are mostly the radio hits everyone knows, Groupie mostly an artist's deep cuts */
    /* (the shares are random; here once only radio hits, once only deep cuts, to see where each comes from) */
    const lv = await page.evaluate(async () => { const {Pool, LVL} = PG._song, keep = JSON.stringify(LVL); LVL.main = [1, 0, 0]; LVL.fan = [0, 0, 1];
      const P1 = Pool.make({genre: "y80", lvl: "main"}); P1.used.clear(); await P1.fill(4); const P2 = Pool.make({genre: "own", own: "Queen", lvl: "fan"}); P2.used.clear(); await P2.fill(2);
      Object.assign(LVL, JSON.parse(keep)); return {main: P1.songs.map(x => x.tier + ":" + x.title), fan: P2.songs.map(x => x.tier + ":" + x.title)}; });
    ok(lv.main.length >= 2 && lv.main.some(x => /^hit:(Take On Me|99 Luftballons|Radio Ga Ga|Another One Bites the Dust|Under Pressure|Irgendwie)/.test(x)), "Radio-Hits: kommen aus der Liste der Songs, die jeder kennt (80er: " + lv.main.join(", ") + ")", JSON.stringify(lv.main));
    ok(lv.fan.length >= 1 && lv.fan.every(x => x.startsWith("fan:")), "Groupie mit nur Queen: Album-Songs für Kenner (" + lv.fan.join(", ") + ")", JSON.stringify(lv.fan));
    ok(shares.main[0] >= .8 && shares.main[2] > 0 && shares.mid[0] < shares.main[0] && shares.fan[2] >= .5, "Mainstream vor allem Hits (mit ein paar Kenner-Songs), Medium gemischt, Groupie vor allem Kenner-Songs", JSON.stringify(shares));
    /* four to pick from, guessing the artist, longer and longer; two players take turns */
    await page.tap("#sgset"); await sleep(500); await page.tap('[data-gn="y80"]'); await page.tap('#sgw [data-v="artist"]'); await page.tap('#sga [data-v="pick"]'); await page.tap('#sgc [data-v="up"]'); await sleep(200);
    await page.locator("#sgp input").fill("Anna"); await page.locator("#sgp input").press("Enter"); await sleep(200); await page.locator("#sgp input").fill("Ben"); await page.locator("#sgp input").press("Enter"); await sleep(200);
    await page.tap("#sggo"); await page.waitForSelector("#sgplay", {timeout: 8000}).catch(() => {}); await sleep(300);
    ok(/Anna/.test(await txt(page, "#main")), "zwei Spieler: „Gib das Handy an Anna“", (await txt(page, "#main")).slice(0, 80));
    await play(); const opts = await page.$$eval("[data-op]", b => b.map(x => x.innerText)); ok(opts.length === 4, "4 Interpreten zur Auswahl", JSON.stringify(opts));
    await sleep(900); au = await audio(); ok(!au.on && /1 s/.test(await txt(page, "#sgstg")) && /Mehr hören: 2 s/.test(await txt(page, "#sgre")), "„Immer länger“: erst nur 1 Sekunde, dann „Mehr hören: 2 s“", JSON.stringify(au) + " " + (await txt(page, "#sgre")));
    await page.tap("#sgre"); await sleep(400); au = await audio(); ok(au.on && au.t < 1, "Mehr hören: wieder von vorne, jetzt 2 Sekunden", JSON.stringify(au)); await page.shot("song-immer-laenger");
    /* which artist: in the fixed list, the one whose song is playing */
    const who = {"99 Luftballons": "Nena", "Irgendwie, irgendwo, irgendwann": "Nena", "Leuchtturm": "Nena", "Take On Me": "a-ha", "The Sun Always Shines on T.V.": "a-ha", "Hunting High and Low": "a-ha"}[last] || (last.match(/^(.*) Hit \d$/) || [])[1] || "Queen";
    await page.locator("[data-op]", {hasText: who}).first().tap(); await sleep(400);
    ok(/\+4/.test(await txt(page, "#main")) && /Anna/.test(await txt(page, "#main")) && /nach 2 s/.test(await txt(page, "#main")), "richtigen Interpreten nach 2 Sekunden angetippt: +4 für Anna (nach 1 s wären es 5)", (await txt(page, "#main")).slice(0, 160));
    await page.tap("#sgnx"); await sleep(400); ok(/Ben/.test(await txt(page, "#main")), "danach ist Ben dran");
    await play(); await page.tap("#sgno"); await sleep(400);
    ok(/✗/.test(await txt(page, "#main")) && /\b0\b/.test(await txt(page, ".pg-name")), "„Weiß nicht“: 0 Punkte, die Lösung steht da", (await txt(page, "#main")).slice(0, 120));
    await page.evaluate(() => App.go("games")); await sleep(400); ok(await page.evaluate(() => navigator.audioSession.type === "auto"), "raus aus dem Spiel: das iPhone entscheidet wieder selbst (Stummschalter gilt wieder)");
    await clean(page, "Song raten"); await page.context().close();
  },

  /* ---------- Song raten online: two phones, a lobby, voice chat button, the same song on both, answers, points ---------- */
  async songon(browser){
    const fakeAS = () => { Object.defineProperty(navigator, "audioSession", {value: {_t: "auto", get type(){ return this._t; }, set type(v){ this._t = v; }}, configurable: true}); };
    const a = await L.open(browser, "tester", {before: fakeAS}), b = await L.open(browser, "mila", {before: fakeAS}); const heard = {a: [], b: []};
    for (const [pg, k] of [[a, "a"], [b, "b"]]) pg.on("request", r => { const m = /audio-ssl\.itunes\.apple\.com\/fake\/([^?]+)\.m4a/.exec(r.url()); if (m && heard[k][heard[k].length - 1] !== decodeURIComponent(m[1])) heard[k].push(decodeURIComponent(m[1])); });
    /* what the fake catalog knows about a song: its artist and year ("Michael Jackson Hit 3": 2015) */
    const info = t => { for (const [ar, L2] of Object.entries(L.SONGS)) for (const [tt, y] of L2) if (tt === t) return {a: ar, y: +y}; const m = /^(.*) Hit \d$/.exec(t); return {a: m ? m[1] : "", y: 2015}; };
    const bareT = t => t.replace(/\s*\(.*\)$/, ""), cur = () => heard.a[heard.a.length - 1] || "", esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const audio = pg => pg.evaluate(() => ({on: !PG.songSA.au.paused, t: PG.songSA.au.currentTime}));
    const toLobby = async () => { await a.tap('[data-x="lobby"]').catch(() => {}); await sleep(300); if (await has(a, '[data-x="lobby"]')) await a.tap('[data-x="lobby"]').catch(() => {}); await a.waitForSelector("#lgo", {timeout: 6000}).catch(() => {}); await sleep(600); };
    const startAndPlay = async (sel) => { await a.tap("#lgo"); await a.waitForSelector(sel, {timeout: 12000}).catch(() => {}); await b.waitForSelector(sel, {timeout: 12000}).catch(() => {}); await sleep(2400); };
    await a.evaluate(() => { const L2 = PG._song.LVL; L2.main = [.8, .2, 0]; L2.mid = [.6, .4, 0]; L2.fan = [.2, .8, 0]; App.go("party", {g: "song"}); }); await sleep(600);
    ok(await has(a, "#pgon"), "„Song raten“ hat jetzt „Online spielen“");
    await a.tap("#pgon"); await sleep(1500);
    ok(await a.evaluate(() => App.route === "lobby" && PNet.P && PNet.P.isHost && PNet.P.game === "song"), "Online spielen öffnet eine Lobby für Song raten");
    /* game modes as packages: one tap instead of clicking everything together */
    let lob = await txt(a, "#main"); await a.shot("songon-modi");
    ok([/Party/, /Profi/, /Immer länger/, /Blitzrunde/, /Zeitstrahl/, /Musik-Bingo/, /Wessen Song/, /Jahr raten/, /Eigene Regeln/].every(re => re.test(lob)) && !/6 zur Auswahl/.test(lob), "Lobby: Spielmodi als Pakete (Party, Profi, Immer länger, Blitzrunde, Zeitstrahl, Musik-Bingo, Wessen Song?, Jahr raten, Eigene Regeln), die Einzelheiten erst bei „Eigene Regeln“", lob.slice(0, 400));
    ok(/Deine Spotify-Playlist/.test(lob) && /Jeder wünscht sich was/.test(lob) && /Eigene Künstler/.test(lob), "Lobby: Spotify-Playlist für jeden, Musik „Jeder wünscht sich was“ oder eigene Künstler", "");
    ok(/Wie bekannt/i.test(lob) && /Mainstream/.test(lob) && /Medium/.test(lob) && /Groupie/.test(lob), "Lobby: „Wie bekannt“ – Mainstream, Medium, Groupie", "");
    /* own artists for everyone: e.g. only Michael Jackson */
    await a.tap('[data-ok="genre"][data-ov="own"]'); await sleep(500); await a.locator("#sgown2 input").fill("Michael Jackson"); await a.locator("#sgown2 button").tap(); await sleep(600);
    ok(await a.evaluate(() => PNet.P.opts.own === "Michael Jackson") && /Michael Jackson/.test(await txt(a, "#sgown2")), "Musik „Eigene Künstler“: Feld für die Künstler (z. B. nur Michael Jackson)", await txt(a, "#sgown2"));
    await a.tap('[data-ok="genre"][data-ov="wish"]'); await sleep(400);
    await a.tap('.pg-pk[data-ov="custom"]'); await sleep(500); lob = await txt(a, "#main");
    ok([/4 zur Auswahl/, /6 zur Auswahl/, /Song-Bibliothek/, /Ganzer Song/, /Immer länger 1→10 s/, /Wer zuerst richtig hat/, /Als Spielmodus speichern/].every(re => re.test(lob)), "„Eigene Regeln“: alle Einstellungen und „Als Spielmodus speichern“", lob.slice(0, 300));
    await a.evaluate(() => { PNet.setOpt("what", "both"); PNet.setOpt("ans", "type"); PNet.setOpt("clip", 10); }); await sleep(400);
    await a.locator("#sgsv input").fill("Testrunde"); await a.locator("#sgsv button[type=submit]").tap(); await sleep(700);
    ok(await has(a, '.pg-pk.on[data-ov="c:Testrunde"]') && /Testrunde/.test(await txt(a, "#sgsv")) && /Beides/.test(await txt(a, "#sgsv")), "eigene Regeln gespeichert: „⭐ Testrunde“ ist jetzt ein eigener Spielmodus", await txt(a, "#sgsv"));
    await a.tap('.pg-pk[data-ov="party"]'); await sleep(300);
    await a.evaluate(() => { PNet.setOpt("rounds", 2); }); await sleep(300);
    const code = await a.evaluate(() => PNet.P.code);
    await b.evaluate(c => { PG.st.myName = "Mila"; App.go("lobby", {join: c}); }, code); await sleep(3000);
    ok(await a.evaluate(() => PNet.P.roster.length === 2), "Mila ist in der Lobby", JSON.stringify(await a.evaluate(() => PNet.P.roster.map(r => r.name))));
    /* voice chat: you turn it on, Mila sees that someone is in, joins, and the two phones are connected */
    await a.tap("#lvoice"); await sleep(2500);
    for (let i = 0; i < 8 && !/An/.test(await txt(a, "#lvoice")); i++) await sleep(500);
    ok(/An/.test(await txt(a, "#lvoice")), "Sprachchat-Knopf: an (Mikrofon erlaubt)", await txt(a, "#lvoice"));
    for (let i = 0; i < 12 && !/Sprechen · 1/.test(await txt(b, "#lvoice")); i++) await sleep(500);
    ok(/Sprechen · 1/.test(await txt(b, "#lvoice")), "Mila sieht: 1 ist schon im Sprachchat", await txt(b, "#lvoice"));
    await b.tap("#lvoice"); let vc = false; for (let i = 0; i < 20 && !vc; i++){ await sleep(500); vc = await a.evaluate(() => PVoice.peers().length === 1) && await b.evaluate(() => PVoice.peers().length === 1); }
    ok(vc, "beide im Sprachchat: die Handys sind verbunden", JSON.stringify([await a.evaluate(() => PVoice.peers()), await b.evaluate(() => PVoice.peers())]));
    /* Mila adds her Spotify playlist in the lobby */
    await b.locator("#sgpl input").fill("https://open.spotify.com/playlist/pl2bbbbbbbbbbb"); await b.locator("#sgpl button[type=submit]").tap(); await sleep(1500);
    ok(/Milas Lieblinge/.test(await txt(b, "#sgpl")), "Mila lädt ihre Spotify-Playlist in der Lobby", await txt(b, "#sgpl"));
    /* Party: first everyone wishes; you the 80s, Mila her playlist */
    await a.tap("#lgo"); await a.waitForSelector("[data-wg]", {timeout: 8000}).catch(() => {}); await b.waitForSelector("[data-wg]", {timeout: 8000}).catch(() => {}); await b.shot("songon-wunsch");
    ok(/Dein Musikwunsch/i.test(await txt(b, "#main")) && await has(b, '[data-wg="pl"]') && await has(b, '[data-wg="kpop"]') && await has(b, '[data-wg="own"]'), "vor dem ersten Song: jeder wünscht sich ein Genre oder seine Playlist", (await txt(b, "#main")).slice(0, 200));
    await a.tap('[data-wg="y80"]'); await sleep(400); ok(/1 von 2 haben gewählt/.test(await txt(b, "#main")), "Mila sieht: 1 von 2 haben gewählt", (await txt(b, "#main")).slice(-120));
    await b.tap('[data-wg="pl"]');
    await b.waitForSelector(".sg-cd.on", {timeout: 12000}).catch(() => {}); const cd = await txt(b, ".sg-cd"); await b.shot("songon-countdown");
    ok(/^[123]$/.test(cd.trim()), "vor dem Song: ein schnelles 3, 2, 1", cd);
    await a.waitForSelector("[data-op]", {timeout: 10000}).catch(() => {}); await b.waitForSelector("[data-op]", {timeout: 10000}).catch(() => {}); await sleep(2400); await a.shot("songon-frage");
    const auA = await audio(a), auB = await audio(b);
    ok(auA.on && auB.on && auA.t > .1 && auA.t < 2.5 && Math.abs(auA.t - auB.t) < .6, "nach dem 3-2-1 spielt der Song auf beiden Handys im selben Moment, ab Sekunde 0", JSON.stringify([auA, auB]));
    const wl = await txt(a, ".sg-wl"); ok(/Wunsch|·/.test(wl) && (/80er/.test(wl) || /Milas Lieblinge/.test(wl)), "der Song kommt aus einem der Wünsche: „" + wl.trim() + "“", wl);
    const oa = await a.$$eval("[data-op]", x => x.map(y => y.innerText)), ob = await b.$$eval("[data-op]", x => x.map(y => y.innerText));
    ok(oa.length === 4 && JSON.stringify(oa) === JSON.stringify(ob), "beide Handys: dieselben 4 Titel zur Auswahl", JSON.stringify([oa, ob]));
    ok(heard.a.length && heard.a[heard.a.length - 1] === heard.b[heard.b.length - 1], "beide Handys spielen denselben Song", JSON.stringify([heard.a.slice(-1), heard.b.slice(-1)]));
    ok(await b.evaluate(() => { const r = document.querySelector("[data-skip]").getBoundingClientRect(); return r.height >= 50 && /Weiß nicht/.test(document.querySelector("[data-skip]").innerText); }), "„Weiß nicht“ ist ein großer Knopf");
    const right = oa.find(x => bareT(cur()) === x || cur().startsWith(x));
    await b.tap("[data-skip]"); await sleep(400); ok(/Abgegeben/.test(await txt(b, "#main")), "Mila: „Weiß nicht“ – sie wartet");
    await a.locator("[data-op]", {hasText: right}).first().tap(); await a.waitForSelector(".sg-ans", {timeout: 6000}).catch(() => {}); await b.waitForSelector(".sg-ans", {timeout: 6000}).catch(() => {}); await sleep(1200); await a.shot("songon-aufloesung");
    const ra = await txt(a, "#main"), rb = await txt(b, "#main");
    ok(/\+3/.test(ra) && new RegExp(esc(bareT(cur()))).test(rb), "beide fertig: sofort die Auflösung, du +3 (2 richtig + 1 schnellster), Mila sieht die Lösung", ra.slice(0, 200));
    ok((await audio(a)).on && (await audio(b)).on, "nach der Auflösung läuft der Song weiter", JSON.stringify([await audio(a), await audio(b)]));
    /* singing along: Mila's phone measures how late your voice arrives; while you sing, her music runs that much later (gently, same pitch) */
    const aId = await a.evaluate(() => PNet.me); await sleep(2300);
    const lat = await b.evaluate(id => PG._song.Sing.L[id], aId);
    ok(lat > 0 && lat < 700, "Mitsingen: Milas Handy misst, wie spät deine Stimme ankommt (" + lat + " ms)", String(lat));
    await b.evaluate(id => { window.__sing = true; PG._song.Sing.test({talking: x => x === id && window.__sing, lat: {[id]: 220}}); }, aId); await sleep(1900);
    const s1 = await b.evaluate(() => ({lead: PG._song.Sing.lead, want: PG.songSA.lagWant, rate: PG.songSA.rate, txt: (document.querySelector(".sg-sing") || {}).innerText || ""}));
    ok(s1.lead === aId && s1.want === 220 && s1.rate < 1 && /singt mit/.test(s1.txt), "du singst: Milas Musik läuft sanft 220 ms später (etwas langsamer, gleiche Tonhöhe), mit Hinweis", JSON.stringify(s1));
    await sleep(2400); const s2 = await b.evaluate(() => ({lag: PG.songSA.lagMs, rate: PG.songSA.rate}));
    ok(Math.abs(s2.lag - 220) <= 30 && s2.rate === 1, "nach gut 2 s passt es: 220 ms später, wieder normales Tempo", JSON.stringify(s2));
    await b.evaluate(() => { window.__sing = false; }); await sleep(2900); const s3 = await b.evaluate(() => ({lead: PG._song.Sing.lead, want: PG.songSA.lagWant, rate: PG.songSA.rate, lag: PG.songSA.lagMs, paused: PG.songSA.au.paused}));
    ok(s3.lead === null && s3.want === 0 && (s3.rate > 1 || s3.lag < 200), "du hörst auf: nach 2,5 s holt Milas Musik wieder auf", JSON.stringify(s3));
    await b.evaluate(() => PG._song.Sing.test({talking: null, lat: null}));
    await b.tap('[data-x="nx"]'); await sleep(500); ok(/1\/2/.test(await txt(b, "[data-rdy]")) && await has(b, ".sg-ans"), "Mila tippt „Weiter“: 1/2, der Song läuft noch, bis alle weiter wollen", await txt(b, "[data-rdy]"));
    await a.tap('[data-x="next"]'); await a.waitForSelector("[data-op]", {timeout: 10000}).catch(() => {}); await b.waitForSelector("[data-op]", {timeout: 10000}).catch(() => {}); await sleep(2400);
    /* both "No idea": the answer comes at once */
    await a.tap("[data-skip]"); await b.tap("[data-skip]"); const t0 = Date.now(); await a.waitForSelector(".sg-ans", {timeout: 6000}).catch(() => {});
    ok(await has(a, ".sg-ans") && Date.now() - t0 < 2500, "beide „Weiß nicht“: sofort die Auflösung (" + (Date.now() - t0) + " ms)");
    await a.tap('[data-x="next"]'); await a.waitForSelector('[data-x="again"]', {timeout: 8000}).catch(() => {}); await b.waitForSelector(".pg-moon", {timeout: 8000}).catch(() => {});
    ok(/gewinnt/.test(await txt(a, "#main")) && /Die Songs/.test(await txt(b, "#main")), "nach 2 Songs: Sieger, Stand und die Songs auf beiden Handys", (await txt(b, "#main")).slice(0, 200)); await b.shot("songon-ende");
    await toLobby(); ok(await has(a, "#lgo"), "zurück in die Lobby");
    ok(await a.evaluate(() => PVoice.on) && /An/.test(await txt(a, "#lvoice")), "der Sprachchat lief das ganze Spiel über weiter");
    /* own rules: song library, 5 s, fastest takes it. Mila taps a wrong song; you want to hear more; "Search" only searches */
    await a.evaluate(() => { PNet.setOpt("pkg", "custom"); PNet.setOpt("genre", "y80"); PNet.setOpt("what", "title"); PNet.setOpt("ans", "type"); PNet.setOpt("clip", 5); PNet.setOpt("mode", "fast"); PNet.setOpt("rounds", 1); }); await sleep(500);
    await startAndPlay('.sg-lib input[data-in="t"]');
    const t2 = cur(), b2 = bareT(t2);
    const bot = await b.evaluate(() => Math.round(document.querySelector('.sg-lib input[data-in="t"]').getBoundingClientRect().bottom)); await b.shot("songon-tippen");
    ok(bot <= 844 - 336 - 4, "das Suchfeld liegt über einer iPhone-Tastatur (unterer Rand " + bot + " px)", String(bot));
    const other = ["Leuchtturm", "Take On Me", "Radio Ga Ga"].find(x => x !== b2);
    await b.locator('.sg-lib input[data-in="t"]').tap(); await b.keyboard.type(other.slice(0, 5), {delay: 20}); await b.waitForSelector(".sg-sug", {timeout: 5000}).catch(() => {}); await sleep(200);
    await b.locator(".sg-sug", {hasText: other}).first().tap(); await sleep(700);
    ok(/Leider falsch/.test(await txt(b, "#main")), "„Wer zuerst richtig hat“: Mila tippt in der Song-Bibliothek den falschen Song an und ist für diesen Song raus", (await txt(b, "#main")).slice(0, 160));
    await sleep(3200); ok(await has(a, "[data-more]:not([hidden])") && !(await audio(a)).on, "nach 5 s ist Pause, „Weiter hören“ erscheint", await txt(a, ".sg-act"));
    await a.tap("[data-more]"); await sleep(900); const ex = await audio(a);
    ok(ex.on && ex.t > 5, "„Weiter hören“: der Song geht weiter, ab Sekunde " + ex.t.toFixed(1), JSON.stringify(ex)); await a.shot("songon-weiterhoeren");
    await a.locator('.sg-lib input[data-in="t"]').tap(); await a.keyboard.type(b2.slice(0, 6), {delay: 15}); await a.keyboard.press("Enter"); await sleep(900);
    ok(!(await has(a, ".sg-ans")) && await has(a, ".sg-sug:not([disabled])"), "Enter („Suchen“) gibt nichts ab, die Treffer bleiben antippbar", (await txt(a, "#main")).slice(0, 160));
    await a.locator(".sg-sug", {hasText: b2}).first().tap(); await a.waitForSelector(".sg-ans", {timeout: 6000}).catch(() => {}); await sleep(300);
    ok(/\+3/.test(await txt(a, "#main")), "du tippst den richtigen Song an: +3, gleich die Auflösung", (await txt(a, "#main")).slice(0, 160));
    await a.tap('[data-x="next"]'); await a.waitForSelector('[data-x="again"]', {timeout: 8000}).catch(() => {}); await toLobby();
    /* longer and longer: both want the next part at once; then both "No idea" and it stops */
    await a.evaluate(() => { PNet.setOpt("pkg", "intro"); PNet.setOpt("rounds", 5); }); await sleep(500);
    await a.tap("#lgo"); await a.waitForSelector("[data-op], .sg-lib", {timeout: 12000}).catch(() => {}); await b.waitForSelector("[data-op], .sg-lib", {timeout: 12000}).catch(() => {}); await sleep(3000);
    const up1 = await b.evaluate(() => ({on: !PG.songSA.au.paused, chips: document.querySelector("[data-stg]").innerText}));
    ok(!up1.on && /Gleich: 2 s/.test(up1.chips), "„Immer länger“: 1 Sekunde, dann Pause („Gleich: 2 s“)", JSON.stringify(up1));
    await a.tap("[data-more]"); await sleep(300); ok(/1\/2/.test(await txt(b, "[data-more]")), "„Nächster Teil“: Mila sieht 1/2", await txt(b, "[data-more]"));
    await b.tap("[data-more]"); await sleep(900); const up2 = await audio(b);
    ok(up2.on && up2.t < 1.2, "beide wollen weiter: der nächste Teil (2 s) kommt sofort, wieder ab dem Anfang", JSON.stringify(up2)); await b.shot("songon-immer-laenger");
    await a.tap("[data-skip]"); await b.tap("[data-skip]"); const t3 = Date.now(); await a.waitForSelector(".sg-ans", {timeout: 6000}).catch(() => {});
    ok(await has(a, ".sg-ans") && Date.now() - t3 < 2500, "„Immer länger“: beide „Weiß nicht“ – es hört sofort auf, die Auflösung kommt (" + (Date.now() - t3) + " ms)");
    await toLobby();
    /* the timeline: everyone starts with one card and places each song by its year */
    await a.evaluate(() => { PNet.setOpt("pkg", "zeit"); PNet.setOpt("genre", "y80"); }); await sleep(500);
    await startAndPlay("[data-sl]"); await a.shot("songon-zeitstrahl");
    const tl = async pg => pg.$$eval(".sg-card b", x => x.map(y => +y.innerText)), ya = await tl(a), yb = await tl(b), y = info(cur()).y;
    ok(ya.length === 1 && yb.length === 1, "Zeitstrahl: jeder startet mit einer Karte (" + ya[0] + " / " + yb[0] + ")", JSON.stringify([ya, yb]));
    await a.tap(`[data-sl="${y >= ya[0] ? 1 : 0}"]`); await b.tap(`[data-sl="${y >= yb[0] ? 0 : 1}"]`).catch(() => {});
    await a.waitForSelector(".sg-ans", {timeout: 8000}).catch(() => {}); await sleep(400); const za = await txt(a, "#main");
    ok(/2 von 8 Karten/.test(za) && new RegExp("📅 " + y).test(za), "richtig eingeordnet: das Jahr (" + y + ") wird gezeigt, du hast 2 von 8 Karten", za.slice(0, 220));
    ok(y === ya[0] || y === yb[0] || /1 von 8 Karten/.test(await txt(b, "#main")), "Mila lag falsch: weiter 1 Karte", (await txt(b, "#main")).slice(0, 200));
    await toLobby();
    /* music bingo: artists on your card; you mark the one that sings (or say it isn't on your card), Mila taps a wrong one */
    await a.evaluate(() => { PNet.setOpt("pkg", "bingo"); PNet.setOpt("genre", "y80"); }); await sleep(500);
    await startAndPlay("[data-bc]"); await a.shot("songon-bingo");
    const cells = async pg => pg.$$eval(".sg-bc", x => x.map(y => y.innerText.replace("✓", "").trim())), ca = await cells(a), cb = await cells(b), who = info(cur()).a;
    ok(ca.length === 9 && cb.length === 9, "Musik-Bingo: jeder hat eine Karte mit 9 Künstlern", JSON.stringify([ca, cb]));
    const ia = ca.indexOf(who); if (ia >= 0) await a.tap(`[data-bc="${ia}"]`); else await a.tap("[data-skip]");
    const ib = cb.findIndex(x => x !== who); await b.tap(`[data-bc="${ib}"]`);
    await a.waitForSelector(".sg-ans", {timeout: 8000}).catch(() => {}); await sleep(400); const ba = await txt(a, "#main");
    ok(ia < 0 ? !/✓/.test(await a.$eval(".sg-bingo", x => x.innerText)) : (await a.$$eval(".sg-bc.m", x => x.length)) === 1, ia >= 0 ? "der Künstler stand auf deiner Karte: markiert ✓" : "nicht auf deiner Karte: nichts markiert", ba.slice(0, 200));
    ok((await b.$$eval(".sg-bc.m", x => x.length)) === 0, "Mila hat den falschen angetippt: nichts markiert");
    await toLobby();
    /* whose song: your playlist and Mila's; who owns it waits, the other guesses */
    await a.locator("#sgpl input").fill("https://open.spotify.com/playlist/pl1aaaaaaaaaaa"); await a.locator("#sgpl button[type=submit]").tap(); await sleep(1500);
    await a.evaluate(() => { PNet.setOpt("pkg", "wer"); PNet.setOpt("rounds", 5); }); await sleep(500);
    await a.tap("#lgo"); await a.waitForSelector("[data-op], .sg-own", {timeout: 15000}).catch(() => {}); await b.waitForSelector("[data-op], .sg-own", {timeout: 15000}).catch(() => {}); await sleep(2400); await a.shot("songon-wessen"); await b.shot("songon-wessen-mila");
    const PL1 = ["Radio Ga Ga", "99 Luftballons", "Leuchtturm", "Irgendwie, irgendwo, irgendwann"], mine = PL1.some(t => cur().startsWith(t)), owner = mine ? a : b, guesser = mine ? b : a;
    ok(await has(owner, ".sg-own") && !(await has(owner, "[data-op]")) && await has(guesser, "[data-op]"), "„Wessen Song?“: wem der Song gehört, der wartet („Der ist aus deiner Playlist!“), der andere rät", cur());
    await guesser.locator("[data-op]", {hasText: mine ? "Tester" : "Mila"}).first().tap(); await a.waitForSelector(".sg-ans", {timeout: 8000}).catch(() => {}); await sleep(400);
    const wa = await txt(a, "#main"); ok(new RegExp("Aus der Playlist von (Nat )?" + (mine ? "(Nat )?Tester" : "Mila")).test(wa) && /\+2/.test(await txt(guesser, "#main")), "richtig geraten: +2, die Auflösung zeigt, aus wessen Playlist er war", wa.slice(0, 200));
    await toLobby();
    /* the year */
    await a.evaluate(() => { PNet.setOpt("pkg", "jahr"); PNet.setOpt("genre", "y80"); PNet.setOpt("rounds", 5); }); await sleep(500);
    await startAndPlay('.sg-form input[data-in="y"]');
    ok(await has(b, '.sg-form input[data-in="y"][inputmode="numeric"]'), "„Jahr raten“: ein Zahlenfeld zum Schätzen");
    await a.locator('.sg-form input[data-in="y"]').fill("1985"); await a.locator('.sg-form input[data-in="y"]').press("Enter"); await b.locator('.sg-form input[data-in="y"]').fill("1950"); await b.locator('.sg-form input[data-in="y"]').press("Enter");
    await a.waitForSelector(".sg-ans", {timeout: 6000}).catch(() => {}); await sleep(300); const yr = await txt(a, "#main");
    ok(/· (19|20)\d\d/.test(yr) && /1985/.test(yr) && /1950/.test(yr), "Auflösung mit Jahr und den Schätzungen beider", yr.slice(0, 200));
    await toLobby();
    await a.evaluate(() => { PNet.leave(true); App.go("games"); }); await b.evaluate(() => { PNet.leave(true); App.go("games"); });
    await clean([a, b], "Song raten online"); await a.context().close(); await b.context().close();
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
