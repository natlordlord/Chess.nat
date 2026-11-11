/* Kalorien-Tracker: Gramm vom Ganzen eintippen (alle Zutaten rechnen anteilig mit) und ein Gericht als Rezept für alle veröffentlichen.
   node test/kcal-recipes.js */
const T = require("./lib"), assert = require("assert");
(async () => {
  const {browser, stop} = await T.start(); let fail = null;
  try {
    const p = await T.open(browser, "tester", {route: "#kcal"});
    await p.locator('[data-meal]', {hasText: "Haferflocken"}).first().click(); await p.waitForSelector("[data-tg]");
    assert.equal(await p.inputValue("[data-tg]"), "280");            /* 80 g + 200 ml, the banana has no weight */
    await p.shot("recipes-1-meal");
    /* the field for the whole dish stands right under the numbers: tapping it moves nothing, it is above the keyboard as it is */
    const b0 = await p.locator("[data-tg]").boundingBox(); await p.locator("[data-tg]").focus(); await p.waitForTimeout(700); const b1 = await p.locator("[data-tg]").boundingBox();
    assert.ok(b1.y + b1.height < 844 * .56, "field above the keyboard: " + JSON.stringify(b1)); await p.shot("recipes-1b-typing");
    await p.fill("[data-tg]", "140"); await p.waitForTimeout(900);
    assert.equal(await p.inputValue('[data-g="0"]'), "40"); assert.equal(await p.inputValue('[data-g="2"]'), "100");
    assert.equal((await p.textContent('[data-t="kcal"]')).trim(), "260");
    await p.locator("[data-tg]").blur(); await p.waitForTimeout(500);
    let m = (await T.table("kcal_meals")).find(x => x.title === "Haferflocken mit Banane"); assert.equal(m.kcal, 260); assert.equal(m.items[0].amount, "40 g");
    await p.shot("recipes-2-scaled");
    /* the ingredients are only estimated: a recipe for everyone is refused, in the app and in the database */
    await p.click("[data-pub]"); await p.waitForSelector(".kc-est"); assert.equal(await p.locator("#kcrn").count(), 0, "no publishing with estimated ingredients"); assert.equal(await p.locator(".kc-est").count(), 3); await p.shot("recipes-3a-refused");
    await p.getByRole("button", {name: "Zurück zum Gericht"}).click(); await p.waitForTimeout(400); await p.waitForSelector("[data-pub]");
    const direct = await T.stage("POST", "kcal_recipes", "", {user_id: T.ID.tester, name: "Geschummelt", items: m.items, grams: 140, kcal: 260}); assert.ok(direct.code, "database refuses it too: " + JSON.stringify(direct).slice(0, 200)); assert.equal((await T.table("kcal_recipes")).length, 0);
    /* with checked ingredients (fixed table, a scanned product, the checked database) it goes through */
    await T.stage("PATCH", "kcal_meals", "id=eq." + m.id, {items: m.items.map((i, n) => Object.assign({}, i, n === 0 ? {ref: "haferflocken"} : n === 1 ? {code: "4000000000024"} : {food: "milch"}))});
    await p.reload(); await p.waitForTimeout(1500); await p.locator('[data-meal]', {hasText: "Haferflocken"}).first().click(); await p.waitForSelector("[data-pub]");
    /* publish it under a name */
    await p.click("[data-pub]"); await p.waitForSelector("#kcrn"); await p.fill("#kcrn", "Bananen-Porridge Zauber"); await p.shot("recipes-3-publish"); await p.click("#kcrp"); await p.waitForTimeout(700);
    const R = await T.table("kcal_recipes"); assert.equal(R.length, 1); assert.equal(R[0].name, "Bananen-Porridge Zauber"); assert.equal(R[0].grams, 140); assert.equal(R[0].kcal, 260); assert.ok(R[0].author);
    /* publishing the same name again replaces it */
    await p.waitForSelector("[data-pub]"); await p.click("[data-pub]"); await p.waitForSelector("#kcrn"); await p.click("#kcrp"); await p.waitForTimeout(700); assert.equal((await T.table("kcal_recipes")).length, 1);
    assert.deepEqual(p.bad, [], "tester: " + JSON.stringify(p.bad));
    /* someone else finds it in the search, types the grams and adds it */
    const q = await T.open(browser, "mila", {route: "#kcal"});
    await q.addStyleTag({content: ".kc-setup{display:none!important}"});   /* Mila has not set up her goals yet */
    await q.click("[data-kc-find]"); await q.waitForSelector("#kcq"); await q.waitForSelector("[data-rc]"); await q.shot("recipes-4-search-empty");
    await q.fill("#kcq", "porridge"); await q.waitForTimeout(1200); await q.waitForSelector("[data-rc]"); await q.shot("recipes-5-search");
    await q.click("[data-rc]"); await q.waitForSelector("[data-tg]"); assert.equal(await q.inputValue("[data-tg]"), "140");
    await q.fill("[data-tg]", "70"); await q.waitForTimeout(300); await q.shot("recipes-6-entry"); await q.click("#kceadd"); await q.waitForTimeout(700);
    m = (await T.table("kcal_meals")).find(x => x.title === "Bananen-Porridge Zauber" && x.user_id === T.ID.mila); assert.ok(m, "meal added"); assert.ok(Math.abs(m.kcal - 130) <= 2, "half the recipe: " + m.kcal); assert.equal(m.items.length, 3); assert.equal(m.items[0].amount, "20 g");
    assert.deepEqual(q.bad, [], "mila: " + JSON.stringify(q.bad));
    const pr = (await T.problems()).filter(x => !/Geschummelt/.test(x.req || "")); assert.ok(!pr.length, JSON.stringify(pr).slice(0, 600));
    console.log("OK");
  } catch(e) { fail = e; console.error(e); }
  await stop(); process.exit(fail ? 1 : 0);
})();
