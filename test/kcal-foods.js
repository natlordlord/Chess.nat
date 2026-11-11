/* Kalorien-Tracker: die gemeinsame Lebensmittel-Datenbank. Was nicht in der festen Tabelle steht, wird beim ersten Mal gespeichert;
   danach bekommen alle dieselben Werte pro 100 g, und jedes Lebensmittel gibt es nur einmal.   node test/kcal-foods.js */
const T = require("./lib"), assert = require("assert");
(async () => {
  const {browser, stop} = await T.start(); let fail = null;
  try {
    const tok = async who => { const s = await (await fetch(T.BASE + "/__fake/session?u=" + who)).json(); return s.access_token || (s.session && s.session.access_token) || s.token; };
    const say = async (who, text) => { const r = await fetch(T.BASE + "/api/kcal", {method: "POST", headers: {"content-type": "application/json", authorization: "Bearer " + await tok(who)}, body: JSON.stringify({text})}); assert.equal(r.status, 200); return (await r.json()).meal; };
    const per = (i, g) => Math.round(i.kcal / g * 100);
    const a = await say("tester", "250 g Mascarpone und 600 g Trauben"), M = a.items.find(i => /Mascarpone/.test(i.name)), W = a.items.find(i => /traube/i.test(i.name));
    let rows = await T.table("kcal_foods"); assert.equal(rows.length, 2, "two foods stored: " + JSON.stringify(rows)); const m0 = rows.find(r => r.key === "mascarpone");
    assert.ok(Math.abs(M.kcal - m0.k * 2.5) <= 1, "first person gets the stored values"); assert.equal(M.food, "mascarpone");
    /* someone else, another amount, the "AI" guesses differently: same values per 100 g */
    for (let n = 0; n < 4; n++){ const b = await say(n % 2 ? "tester" : "mila", "100 g Mascarpone mit 200 g Trauben"), M2 = b.items.find(i => /Mascarpone/.test(i.name)), W2 = b.items.find(i => /traube/i.test(i.name));
      assert.equal(M2.kcal, Math.round(m0.k), "100 g Mascarpone = stored value, every time"); assert.equal(per(W2, 200), per(W, 600), "grapes per 100 g the same for both"); assert.ok(Math.abs(M2.fat - m0.f) < .06); }
    rows = await T.table("kcal_foods"); assert.equal(rows.length, 2, "no duplicates"); assert.ok(rows.find(r => r.key === "mascarpone").uses >= 5);
    /* nobody can write to the table directly */
    const d = await fetch(T.BASE + "/rest/v1/kcal_foods", {method: "POST", headers: {"content-type": "application/json", authorization: "Bearer " + await tok("mila")}, body: JSON.stringify({key: "x y", name: "X", k: 1, c: 0, p: 0, f: 0})}); assert.ok(d.status >= 400, "direct insert refused: " + d.status);
    /* the fixed table still wins, and meals without a weight are left as the AI gave them */
    const n = await say("mila", "250 g gekochte Nudeln"); assert.equal(n.items[0].kcal, 390); const br = await say("mila", "zwei Brötchen mit Nutella"); assert.equal(br.kcal, 674);
    assert.equal((await T.table("kcal_foods")).length, 2);
    console.log("OK", JSON.stringify(rows.map(r => [r.name, r.k, r.uses])));
  } catch(e) { fail = e; console.error(e); }
  await stop(); process.exit(fail ? 1 : 0);
})();
