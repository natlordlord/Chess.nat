/* Test people and their data. Everything is relative to "now", so the tracker always has a today and a past week.
   Sign in as any of them with the password "test1234" (or open /__fake/login?u=<name>). */
const ID = {tester: "11111111-1111-4111-8111-111111111111", mila: "22222222-2222-4222-8222-222222222222", jonas: "33333333-3333-4333-8333-333333333333", ole: "44444444-4444-4444-8444-444444444444"};
const p2 = n => String(n).padStart(2, "0"), dayOf = d => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
module.exports = db => {
  const now = Date.now(), at = (days, h, m = 0) => { const d = new Date(now); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d; }, ago = min => new Date(now - min * 60000);
  Object.entries(ID).forEach(([name, id]) => db.users.push({id, name, email: name + "@chessnat.test", password: "test1234", created_at: new Date(now - 40 * 864e5).toISOString()}));
  const {tester, mila, jonas, ole} = ID;
  db.seed("chess_players", [{id: tester, name: "Nat Tester", handle: "nattester", rating: 820, trophies: 12, active_at: new Date(now).toISOString()}, {id: mila, name: "Mila", handle: "mila", rating: 640, active_at: new Date(now).toISOString()},
    {id: jonas, name: "Jonas", handle: "jonas", rating: 1100, last_seen: ago(3000).toISOString()}, {id: ole, name: "Ole", handle: "ole_k", rating: 900, last_seen: ago(9000).toISOString()}]);
  db.seed("chess_friends", [{a: tester, b: mila, requested_by: mila, status: "accepted"}, {a: tester, b: jonas, requested_by: tester, status: "accepted"}, {a: tester, b: ole, requested_by: ole, status: "pending"}]);
  db.seed("chess_messages", [{from_id: mila, to_id: tester, body: "Na, schon gegessen? 😄", created_at: ago(190).toISOString(), read_at: ago(180).toISOString()}, {from_id: tester, to_id: mila, body: "Gleich. Danach eine Runde Schach?", created_at: ago(170).toISOString(), read_at: ago(160).toISOString()},
    {from_id: mila, to_id: tester, body: "Klar! Ich bin weiß.", created_at: ago(150).toISOString()}]);
  db.seed("chess_news", {title: "Neu: Einkaufsliste", body: "Im Kalorien-Tracker gibt es jetzt eine geteilte Einkaufsliste."});

  /* calorie tracker: Nat Tester and Mila track and share, Jonas doesn't track yet (can be invited) */
  db.seed("kcal_profile", [{user_id: tester, enabled: true, goal: 3000, protein: 125, carbs: 380, fat: 95, ice: 1}, {user_id: mila, enabled: true, goal: 2000, protein: 90, carbs: 230, fat: 70}]);
  db.seed("kcal_body", {user_id: tester, aim: "muscle", sex: "m", born: 2001, height: 183, weight: 78, activity: 1.55, weigh_min: 480, setup_at: at(-20, 9).toISOString()});
  db.seed("kcal_weights", [{user_id: tester, ts: at(-9, 8).toISOString(), day: dayOf(at(-9, 8)), kg: 77.2, fasted: true}, {user_id: tester, ts: at(-2, 8).toISOString(), day: dayOf(at(-2, 8)), kg: 78, fasted: true}]);
  const meal = (user_id, when, title, emoji, kcal, carbs, protein, fat, source = "voice", items = null) => ({user_id, day: dayOf(when), ts: when.toISOString(), title, emoji, source, kcal, carbs, protein, fat, items});
  const h = new Date(now).getHours(), early = k => at(0, Math.max(0, Math.min(h, k)), k > h ? 0 : 10);
  db.seed("kcal_meals", [
    meal(tester, early(8), "Haferflocken mit Banane", "🥣", 520, 82, 18, 11, "voice", [{name: "Haferflocken", amount: "80 g", kcal: 290, carbs: 45, protein: 11, fat: 5.5, h: {fi: 8, su: 1, sf: 1, q: 5}}, {name: "Banane", amount: "1 Stück", kcal: 110, carbs: 25, protein: 1, fat: .3, h: {fi: 2, su: 15, sf: 0, q: 5}}, {name: "Milch", amount: "200 ml", kcal: 120, carbs: 12, protein: 6, fat: 5.2, h: {fi: 0, su: 10, sf: 3, q: 4}}]),
    meal(tester, new Date(early(8).getTime() + 5 * 60000), "Kaffee mit Milch", "☕", 40, 3, 2, 2, "quick"),
    meal(tester, early(13), "Hähnchen mit Reis", "🍗", 780, 90, 55, 18, "search"),
    ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap(d => [meal(tester, at(-d, 8, 30), "Müsli", "🥣", 600, 85, 22, 16), meal(tester, at(-d, 13), "Nudeln Bolognese", "🍝", 1100, 130, 48, 38), meal(tester, at(-d, 19, 30), d % 3 ? "Döner und Skyr" : "Salat", d % 3 ? "🥙" : "🥗", d % 3 ? 1400 : 500, 120, 70, 50)]),
    meal(mila, early(9), "Joghurt mit Beeren", "🫐", 380, 40, 20, 12), meal(mila, early(13), "Pasta Pesto", "🍝", 900, 110, 25, 38), meal(mila, early(15), "Kuchen und Latte", "🍰", 760, 95, 12, 36)
  ]);

  /* a shared shopping list: Nat Tester owns it, Mila is on it */
  const L = "aaaaaaaa-0000-4000-8000-000000000001", dish = "aaaaaaaa-0000-4000-8000-0000000000d1";
  db.seed("shop_lists", {id: L, owner: tester, name: "Einkaufsliste", created_at: at(-3, 10).toISOString()});
  db.seed("shop_members", {list_id: L, user_id: mila});
  const item = (o, min) => Object.assign({list_id: L, added_by: tester, created_at: ago(min).toISOString(), updated_at: ago(min).toISOString()}, o);
  db.seed("shop_items", [item({name: "Milch", amount: "2 Liter"}, 300), item({name: "Eier", amount: "10 Stück", done_by: mila, done_at: ago(5).toISOString()}, 300), item({name: "Bananen", added_by: mila}, 200), item({name: "Tomaten"}, 200), item({name: "Toilettenpapier"}, 100),
    item({id: dish, kind: "dish", name: "Lasagne"}, 90)]);
  db.seed("shop_items", [item({parent: dish, name: "Hackfleisch", amount: "500 g"}, 90), item({parent: dish, name: "Lasagneplatten", amount: "1 Packung"}, 90), item({parent: dish, name: "Passierte Tomaten", amount: "2 Dosen"}, 90)]);

  /* tipping game: a match tomorrow, one running, one finished, a UFC title fight */
  const ev = (id, home, away, when, o = {}) => Object.assign({id, sport: "fb", comp: "bl1", home, away, start_at: when.toISOString()}, o);
  db.seed("tipp_events", [ev("t-pre", "FC Bayern München", "Borussia Dortmund", new Date(now + 26 * 3600e3), {fav: true}), ev("t-pre2", "RB Leipzig", "VfB Stuttgart", new Date(now + 28 * 3600e3)),
    ev("t-live", "Bayer Leverkusen", "Eintracht Frankfurt", ago(50), {state: "in", clock: "50'", score_h: 1, score_a: 0}), ev("t-post", "SC Freiburg", "Werder Bremen", ago(26 * 60), {state: "post", score_h: 2, score_a: 1}),
    {id: "t-ufc", sport: "mma", comp: "ufc", name: "UFC 322 · Titelkampf", home: "Makhachev", away: "Della Maddalena", start_at: new Date(now + 3 * 864e5).toISOString(), meta: {title: true}}]);
  db.seed("tipp_picks", [{user_id: tester, event_id: "t-post", sh: 2, sa: 1}, {user_id: mila, event_id: "t-post", sh: 1, sa: 0}, {user_id: mila, event_id: "t-live", sh: 2, sa: 0}, {user_id: tester, event_id: "t-live", sh: 1, sa: 1}, {bot: "ki", event_id: "t-post", sh: 1, sa: 1}]);
};
module.exports.ID = ID;
