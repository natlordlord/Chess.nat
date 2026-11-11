/* Kalorien-Tracker: die geprüfte Lebensmittel-Datenbank. Nur was der Betreiber eingetragen hat, zählt; die App und die KI
   können nichts hineinschreiben. Steht ein Lebensmittel drin, bekommen alle dieselben Werte pro 100 g.   node test/kcal-foods.js */
process.env.KCAL_KNOWN_MS = "0";   /* the list of checked names is read fresh for every request */
const T = require("./lib"), assert = require("assert");
(async () => {
  const {browser, stop} = await T.start(); let fail = null;
  try {
    const tok = async who => { const s = await (await fetch(T.BASE + "/__fake/session?u=" + who)).json(); return s.access_token || (s.session && s.session.access_token) || s.token; };
    const say = async (who, text) => { const r = await fetch(T.BASE + "/api/kcal", {method: "POST", headers: {"content-type": "application/json", authorization: "Bearer " + await tok(who)}, body: JSON.stringify({text})}); assert.equal(r.status, 200); return (await r.json()).meal; };
    /* nothing checked yet: the AI's estimate is used for this meal, and NOTHING is stored */
    const a = await say("tester", "250 g Mascarpone und 600 g Trauben"); assert.equal(a.items.length, 2); assert.ok(a.kcal > 0); assert.ok(!a.items[0].food);
    assert.equal((await T.table("kcal_foods")).length, 0, "the AI stores nothing");
    /* nobody can write: not into the table, and there is no function that creates foods */
    const hd = {"content-type": "application/json", authorization: "Bearer " + await tok("mila")};
    const d = await fetch(T.BASE + "/rest/v1/kcal_foods", {method: "POST", headers: hd, body: JSON.stringify({key: "x y", name: "X Y", k: 1, c: 0, p: 0, f: 0, source: "nobody"})}); assert.ok(d.status >= 400, "direct insert refused: " + d.status);
    const u = await fetch(T.BASE + "/rest/v1/kcal_foods?key=eq.mascarpone", {method: "PATCH", headers: hd, body: JSON.stringify({k: 1})}); assert.ok(u.status >= 400 || !(await u.json().catch(() => [])).length, "direct change refused");
    assert.equal((await T.table("kcal_foods")).length, 0);
    /* the owner enters a checked food: from then on everyone gets exactly these values, whatever the AI guesses */
    const ins = await T.stage("POST", "kcal_foods", "", {key: "mascarpone", name: "Mascarpone", k: 400, c: 3, p: 4.5, f: 41, fi: 0, su: 3, sf: 27, q: 2, source: "Test"}); assert.ok(!ins.code, JSON.stringify(ins));
    for (let n = 0; n < 4; n++){ const b = await say(n % 2 ? "tester" : "mila", (n < 2 ? "100" : "250") + " g Mascarpone mit 200 g Trauben"), M = b.items.find(i => /Mascarpone/.test(i.name)), W = b.items.find(i => /traube/i.test(i.name));
      assert.equal(M.food, "mascarpone", "checked food used"); assert.equal(M.kcal, n < 2 ? 400 : 1000); assert.equal(M.fat, n < 2 ? 41 : 102.5); assert.ok(!W.food, "grapes are not checked: estimate only"); }
    assert.equal((await T.table("kcal_foods")).length, 1, "still only what the owner entered");
    const nn = await say("mila", "250 g gekochte Nudeln"); assert.equal(nn.items[0].kcal, 390); const br = await say("mila", "zwei Brötchen mit Nutella"); assert.equal(br.kcal, 674);
    console.log("OK");
  } catch(e) { fail = e; console.error(e); }
  await stop(); process.exit(fail ? 1 : 0);
})();
