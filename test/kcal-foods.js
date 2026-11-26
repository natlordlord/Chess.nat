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
    const nn = await say("mila", "250 g gekochte Nudeln"); assert.equal(nn.items[0].kcal, 376); const br = await say("mila", "zwei Brötchen mit Nutella"); assert.equal(br.kcal, 674);
    /* the gaps: what could only be estimated was noted by name (never by person), and nobody but the operator can read or change the list */
    let G = await T.table("kcal_gaps"); const gk = G.map(g => g.key).sort().join(",");
    assert.ok(/mascarpone/.test(gk) && /weintraube/.test(gk), "estimated foods are noted: " + gk); assert.ok(G.every(g => !("user_id" in g)), "no person in the list");
    assert.equal(G.find(g => g.key === "mascarpone").status, "done", "the owner's entry filled that gap"); assert.ok(a.items[0].gap && a.items[0].gap.k === "mascarpone" && a.items[0].gap.g === 250 && a.items[0].gap.e === a.items[0].kcal, "the first meal waits: " + JSON.stringify(a.items[0]));
    const rd = await fetch(T.BASE + "/rest/v1/kcal_gaps?select=*", {headers: hd}), rj = await rd.json().catch(() => []); assert.ok(rd.status >= 400 || !rj.length, "players cannot read the list");
    const wr = await fetch(T.BASE + "/rest/v1/kcal_gaps", {method: "POST", headers: hd, body: JSON.stringify({key: "x y", name: "X Y"})}); assert.ok(wr.status >= 400, "players cannot write into it: " + wr.status);
    const rpc = async (fn, body) => (await fetch(T.BASE + "/rest/v1/rpc/" + fn, {method: "POST", headers: hd, body: JSON.stringify(body)})).json();
    let R = await rpc("kcal_gaps_resolved", {keys: ["mascarpone", "weintraube", "gibt es nicht"]}); assert.equal(R[0].key, "mascarpone"); assert.equal(R[0].k, 400); assert.equal(R[1], null); assert.equal(R[2], null);
    /* a gap filled under a better name: "Weintraube" becomes the checked food "Weintrauben"; from then on the estimate is replaced at once */
    assert.ok(!(await T.stage("POST", "kcal_foods", "", {key: "weintrauben", name: "Weintrauben", k: 70, c: 16, p: .7, f: .3, fi: 1, su: 16, sf: 0, q: 5, source: "Test"})).code);
    await T.stage("PATCH", "kcal_gaps", "key=eq.weintraube", {status: "done", food: "weintrauben"});
    const g2 = await say("tester", "300 g Trauben"), W2 = g2.items[0]; assert.equal(W2.food, "weintrauben"); assert.equal(W2.kcal, 210); assert.ok(!W2.gap, "nothing waits any more");
    /* a gap that will not be filled: the estimate stays and nothing says "wird geprüft" */
    await T.stage("PATCH", "kcal_gaps", "key=eq.weintraube", {status: "skipped", food: null});
    const g3 = await say("tester", "300 g Trauben"); assert.ok(!g3.items[0].gap && !g3.items[0].food, "skipped: plain estimate"); R = await rpc("kcal_gaps_resolved", {keys: ["weintraube"]}); assert.deepEqual(R[0], {skip: true});
    assert.equal((await T.table("kcal_foods")).length, 2, "the AI still stores no food and no number");
    console.log("OK");
  } catch(e) { fail = e; console.error(e); }
  await stop(); process.exit(fail ? 1 : 0);
})();
