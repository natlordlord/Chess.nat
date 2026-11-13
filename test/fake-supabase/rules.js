/* The rules of the real database, rewritten by hand in JavaScript from what the database reported on 2026-11-11:
   CHECK constraints, row level security policies, triggers and the functions behind /rpc.
   "R" is the raw row store ({table: [rows]}), "uid" the signed-in user (null = not signed in). */
const len = v => v == null ? null : [...String(v)].length;
const between = (v, a, b) => v == null || (Number(v) >= a && Number(v) <= b);
const oneOf = (v, list) => v == null || list.includes(v);
const maxLen = (v, n) => v == null || len(v) <= n;
const size = v => v == null ? 0 : Buffer.byteLength(JSON.stringify(v));
const day = d => { const p = n => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
const addDays = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return day(d); };

/* CHECK constraints: [constraint name, row => ok] */
const CHECKS = {
  chess_duels: [["chess_duels_check", r => r.white !== r.black], ["chess_duels_id_check", r => maxLen(r.id, 40)], ["chess_duels_reason_check", r => maxLen(r.reason, 40)], ["chess_duels_result_check", r => oneOf(r.result, ["1-0", "0-1", "1/2-1/2"])]],
  chess_events: [["chess_events_device_check", r => maxLen(r.device, 12)], ["chess_events_kind_check", r => maxLen(r.kind, 24)], ["chess_events_name_check", r => maxLen(r.name, 64)]],
  chess_feedback: [["chess_feedback_body_check", r => len(r.body) >= 1 && len(r.body) <= 2000], ["chess_feedback_img_check", r => maxLen(r.img, 400000)], ["chess_feedback_info_check", r => maxLen(r.info, 300)], ["chess_feedback_name_check", r => maxLen(r.name, 60)]],
  chess_friends: [["chess_friends_check", r => r.a < r.b], ["chess_friends_check1", r => r.requested_by === r.a || r.requested_by === r.b], ["chess_friends_status_check", r => oneOf(r.status, ["pending", "accepted"])]],
  chess_gifts: [["chess_gifts_kind_check", r => oneOf(r.kind, ["heart", "poop"])]],
  chess_invites: [["chess_invites_code_check", r => /^[a-z0-9]{4,12}$/.test(r.code)], ["chess_invites_status_check", r => oneOf(r.status, ["open", "accepted", "declined", "cancelled"])], ["chess_invites_tc_check", r => maxLen(r.tc, 12)]],
  chess_matches: [["chess_matches_status_check", r => oneOf(r.status, ["live", "done", "void", "disputed"])]],
  chess_messages: [["chess_messages_body_check", r => len(r.body) >= 1 && len(r.body) <= 500]],
  chess_news: [["chess_news_audio_url_check", r => r.audio_url == null || len(r.audio_url) < 500], ["chess_news_body_check", r => len(r.body) >= 1 && len(r.body) <= 300], ["chess_news_title_check", r => len(r.title) >= 1 && len(r.title) <= 80]],
  chess_players: [["chess_players_avatar_size", r => size(r.avatar) < 2000], ["chess_players_handle_format", r => r.handle == null || /^[a-z0-9_]{3,20}$/.test(r.handle)],
    ["chess_players_name_check", r => { const n = len(String(r.name).trim()); return n >= 2 && n <= 24; }], ["chess_players_ratings_size", r => size(r.ratings) < 600], ["chess_players_ref_not_self", r => r.referred_by == null || r.referred_by !== r.id]],
  chess_push: [["chess_push_hour_check", r => between(r.hour, 0, 23)]],
  chess_ratings: [["chess_ratings_cat_check", r => oneOf(r.cat, ["bullet", "blitz", "rapid"])]],
  kcal_body: [["kcal_body_activity_check", r => between(r.activity, 1, 2.5)], ["kcal_body_aim_check", r => oneOf(r.aim, ["lose", "keep", "gain", "muscle", "bulk"])], ["kcal_body_born_check", r => between(r.born, 1900, 2030)],
    ["kcal_body_height_check", r => between(r.height, 100, 250)], ["kcal_body_sex_check", r => oneOf(r.sex, ["m", "f"])], ["kcal_body_weigh_min_check", r => between(r.weigh_min, 0, 1439)], ["kcal_body_weight_check", r => between(r.weight, 25, 400)]],
  kcal_invites: [["kcal_invites_check", r => r.from_id !== r.to_id]],
  kcal_claps: [["kcal_claps_check", r => r.from_id !== r.to_id]],
  /* private.kcal_recipe_stamp: only ingredients with checked values (fixed table, checked database, real product) */
  kcal_recipes: [["kcal_recipes_checked_only", r => Array.isArray(r.items) && r.items.every(e => e && (e.ref || e.code || (e.per && e.per.tab) || e.food))]],
  kcal_meals: [["kcal_meals_emoji_check", r => maxLen(r.emoji, 16)], ["kcal_meals_kcal_check", r => between(r.kcal, 0, 20000)], ["kcal_meals_note_check", r => maxLen(r.note, 500)], ["kcal_meals_said_check", r => maxLen(r.said, 2000)],
    ["kcal_meals_source_check", r => oneOf(r.source, ["voice", "barcode", "manual", "text", "search", "quick"])], ["kcal_meals_title_check", r => len(r.title) >= 1 && len(r.title) <= 120]],
  kcal_profile: [["kcal_profile_goal_check", r => between(r.goal, 800, 7000)], ["kcal_profile_ice_check", r => between(r.ice, 0, 2)],
    ["kcal_profile_pins_ok", r => Array.isArray(r.pins) && r.pins.length <= 12 && size(r.pins) < 60000],
    ["kcal_profile_show_ok", r => r.show == null || (r.show.length >= 1 && r.show.length <= 3 && r.show.every(x => ["kcal", "carbs", "protein", "fat"].includes(x)))]],
  kcal_weights: [["kcal_weights_kg_check", r => between(r.kg, 25, 400)]],
  kv: [["kv_size", r => size(r.data) < 1000000]],
  shop_answers: [["shop_answers_amount_check", r => maxLen(r.amount, 40)], ["shop_answers_answer_check", r => oneOf(r.answer, ["yes", "no", "maybe"])]],
  shop_asks: [["shop_asks_kind_check", r => oneOf(r.kind, ["shop", "home"])]],
  shop_items: [["shop_items_amount_check", r => maxLen(r.amount, 60)], ["shop_items_kind_check", r => oneOf(r.kind, ["product", "dish"])], ["shop_items_name_check", r => len(r.name) >= 1 && len(r.name) <= 120]],
  shop_lists: [["shop_lists_name_check", r => len(r.name) >= 1 && len(r.name) <= 60]],
  tipp_groups: [["tipp_groups_name_check", r => len(r.name) >= 1 && len(r.name) <= 40]],
  tipp_picks: [["tipp_picks_check", r => (r.user_id == null) !== (r.bot == null)], ["tipp_picks_sa_check", r => between(r.sa, 0, 20)], ["tipp_picks_sh_check", r => between(r.sh, 0, 20)], ["tipp_picks_w_check", r => oneOf(r.w, ["a", "b"])]],
  tipp_tips: [["tipp_tips_stake_check", r => between(r.stake, 1, 1000000)]]
};
/* UNIQUE constraints besides the primary keys */
const UNIQUE = {chess_players: [["chess_players_name_lc_key", ["name_lc"]]], tipp_groups: [["tipp_groups_code_key", ["code"]]], tipp_picks: [["tipp_picks_user_event", ["user_id", "event_id"]]], kcal_recipes: [["kcal_recipes_own_name", ["user_id", "name"]]]};
const GENERATED = {chess_players: {name_lc: r => r.name == null ? null : String(r.name).trim().toLowerCase()}};

module.exports = db => {
  const R = db.rows;
  const friends = (a, b) => !!a && !!b && R.chess_friends.some(f => f.status === "accepted" && f.a === (a < b ? a : b) && f.b === (a < b ? b : a));
  const kcalCanSee = (uid, owner) => owner === uid || (R.kcal_profile.some(k => k.user_id === owner && k.enabled && k.share) && friends(owner, uid));
  const shopOwns = (uid, l) => R.shop_lists.some(s => s.id === l && s.owner === uid);
  const shopCan = (uid, l) => shopOwns(uid, l) || R.shop_members.some(m => m.list_id === l && m.user_id === uid);
  const isAdmin = uid => db.admins.includes(uid);
  const own = col => ({all: (r, u) => r[col] === u});
  const T = () => true;
  const homeOwns = (u, g) => R.home_groups.some(x => x.id === g && x.owner === u), homeCan = (u, g) => homeOwns(u, g) || R.home_members.some(m => m.group_id === g && m.user_id === u);

  /* Row level security. select/delete: USING; insert: WITH CHECK; update: {using, check}; "all" covers every command.
     A command without a policy is not allowed at all, exactly like in Postgres. Every policy is for signed-in users. */
  const POLICIES = {
    kv: own("user_id"), chess_push: own("user_id"), kcal_body: own("user_id"), kcal_weights: own("user_id"),
    chess_players: {select: T, insert: (r, u) => r.id === u, update: {using: (r, u) => r.id === u, check: (r, u) => r.id === u}},
    home_groups: {select: (r, u) => r.owner === u || homeCan(u, r.id), insert: (r, u) => r.owner === u, update: {using: (r, u) => r.owner === u, check: (r, u) => r.owner === u}, delete: (r, u) => r.owner === u},
    home_members: {select: (r, u) => homeCan(u, r.group_id), insert: (r, u) => homeOwns(u, r.group_id), delete: (r, u) => homeOwns(u, r.group_id) || r.user_id === u},
    home_tasks: {select: (r, u) => homeCan(u, r.group_id), insert: (r, u) => homeCan(u, r.group_id) && r.created_by === u, delete: (r, u) => r.created_by === u || homeOwns(u, r.group_id)},
    home_log: {select: (r, u) => homeCan(u, r.group_id)},
    home_plan_wishes: {insert: (r, u) => r.user_id === u},
    chess_ideas: {select: () => true, insert: (r, u) => r.user_id === u},
    chess_idea_votes: {select: () => true, insert: (r, u) => r.user_id === u, delete: (r, u) => r.user_id === u},
    kcal_own_products: {select: (r, u) => r.user_id === u || r.status !== "bad", insert: (r, u) => r.user_id === u && r.status === "new", update: (r, u) => r.user_id === u},
    home_thanks: {select: (r, u) => R.home_tasks.some(t => t.id === r.task_id && homeCan(u, t.group_id)), insert: (r, u) => r.user_id === u && R.home_tasks.some(t => t.id === r.task_id && homeCan(u, t.group_id) && t.state === "done" && t.done_by !== u)},
    chess_now: {select: (r, u) => r.user_id === u || friends(r.user_id, u), insert: (r, u) => r.user_id === u, update: {using: (r, u) => r.user_id === u, check: (r, u) => r.user_id === u}, delete: (r, u) => r.user_id === u},
    chess_friends: {select: (r, u) => r.a === u || r.b === u, delete: (r, u) => r.a === u || r.b === u, insert: (r, u) => r.requested_by === u && r.status === "pending",
      update: {using: (r, u) => (r.a === u || r.b === u) && r.requested_by !== u, check: r => r.status === "accepted"}},
    chess_duels: {select: (r, u) => r.white === u || r.black === u,
      insert: (r, u) => r.reported_by === u && ((r.result === "1-0" && r.black === u) || (r.result === "0-1" && r.white === u) || (r.result === "1/2-1/2" && (r.white === u || r.black === u)))},
    chess_gifts: {select: (r, u) => r.from_id === u || r.to_id === u,
      insert: (r, u) => r.from_id === u && R.chess_duels.some(d => (d.result === "1-0" && d.white === u && d.black === r.to_id) || (d.result === "0-1" && d.black === u && d.white === r.to_id))},
    chess_invites: {select: (r, u) => r.from_id === u || r.to_id === u, insert: (r, u) => r.from_id === u && r.status === "open" && friends(u, r.to_id),
      update: {using: (r, u) => r.from_id === u || r.to_id === u, check: (r, u) => r.from_id === u || r.to_id === u}},
    chess_messages: {select: (r, u) => r.from_id === u || r.to_id === u, insert: (r, u) => r.from_id === u && r.to_id !== r.from_id && friends(r.from_id, r.to_id),
      update: {using: (r, u) => r.to_id === u, check: (r, u) => r.to_id === u}},
    chess_news: {select: T}, chess_ratings: {select: T}, chess_matches: {select: T}, tipp_events: {select: T}, tipp_tips: {select: T}, tipp_admins: {select: T},
    chess_events: {insert: (r, u) => r.user_id === u && size(r.meta) < 2000},
    chess_queue: {select: (r, u) => r.user_id === u}, chess_fixes: {select: (r, u) => r.user_id === u},
    chess_feedback: {select: (r, u) => r.user_id === u || isAdmin(u), insert: (r, u) => r.user_id === u, delete: (r, u) => isAdmin(u)},
    kcal_profile: {select: (r, u) => kcalCanSee(u, r.user_id), insert: (r, u) => r.user_id === u, update: {using: (r, u) => r.user_id === u, check: (r, u) => r.user_id === u}},
    kcal_meals: {select: (r, u) => kcalCanSee(u, r.user_id), insert: (r, u) => r.user_id === u, update: {using: (r, u) => r.user_id === u, check: (r, u) => r.user_id === u}, delete: (r, u) => r.user_id === u},
    kcal_invites: {select: (r, u) => r.from_id === u || r.to_id === u, delete: (r, u) => r.from_id === u || r.to_id === u},
    kcal_ice: {select: (r, u) => kcalCanSee(u, r.user_id)},
    kcal_foods: {select: (r, u) => !!u},
    kcal_recipes: {select: (r, u) => !!u, insert: (r, u) => r.user_id === u, update: {using: (r, u) => r.user_id === u, check: (r, u) => r.user_id === u}, delete: (r, u) => r.user_id === u},
    kcal_claps: {select: (r, u) => r.from_id === u || r.to_id === u, insert: (r, u) => r.from_id === u},
    tipp_picks: {select: (r, u) => r.user_id === u || R.tipp_events.some(e => e.id === r.event_id && (e.state !== "pre" || Date.parse(e.start_at) <= Date.now()))},
    tipp_groups: {}, tipp_members: {},
    shop_lists: {select: (r, u) => r.owner === u || shopCan(u, r.id), insert: (r, u) => r.owner === u, update: {using: (r, u) => r.owner === u, check: (r, u) => r.owner === u}, delete: (r, u) => r.owner === u},
    shop_members: {select: (r, u) => shopCan(u, r.list_id), insert: (r, u) => shopOwns(u, r.list_id), delete: (r, u) => shopOwns(u, r.list_id) || r.user_id === u},
    shop_items: {select: (r, u) => shopCan(u, r.list_id), insert: (r, u) => shopCan(u, r.list_id) && r.added_by === u, update: {using: (r, u) => shopCan(u, r.list_id), check: (r, u) => shopCan(u, r.list_id)}, delete: (r, u) => shopCan(u, r.list_id)},
    shop_asks: {select: (r, u) => shopCan(u, r.list_id), insert: (r, u) => shopCan(u, r.list_id) && r.from_id === u, delete: (r, u) => r.from_id === u},
    shop_answers: {select: (r, u) => R.shop_asks.some(a => a.id === r.ask_id && shopCan(u, a.list_id)), insert: (r, u) => r.user_id === u && R.shop_asks.some(a => a.id === r.ask_id && shopCan(u, a.list_id)),
      update: {using: (r, u) => r.user_id === u, check: (r, u) => r.user_id === u}}
  };

  /* private.kcal_recalc: the flame (days in a row with the goal reached), bridged by streak freezes */
  function kcalRecalc(uid){
    const k = R.kcal_profile.find(p => p.user_id === uid); if (!k) return;
    const today = day(new Date()), sum = d => R.kcal_meals.filter(m => m.user_id === uid && m.day === d).reduce((s, m) => s + m.kcal, 0);
    const has = d => R.kcal_meals.some(m => m.user_id === uid && m.day === d);
    const hitToday = sum(today) >= k.goal, oldDay = k.flame_day; let d = hitToday ? today : addDays(today, -1), n = 0, last = null;
    for (let i = 0; i < 3650; i++){
      if (has(d) && sum(d) >= k.goal){ if (!last) last = d; n++; } else if (!R.kcal_ice.some(x => x.user_id === uid && x.day === d)) break;
      d = addDays(d, -1);
    }
    if (hitToday && oldDay !== today && n > 0 && n % 7 === 0) k.ice = Math.min(2, k.ice + 1);
    k.flame = n; k.flame_day = last; k.best = Math.max(k.best, n);
  }
  /* AFTER triggers: (op, new row, old row) */
  const TRIGGERS = {
    kcal_meals: (op, n, o) => kcalRecalc((n || o).user_id),
    /* private.kcal_recipe_stamp: who published it comes from the players table, never from the phone */
    kcal_recipes: (op, n) => { if (n){ const p = R.chess_players.find(x => x.id === n.user_id); n.author = (p && p.name) || "A friend"; } },
    /* private.kcal_own_stamp: who photographed it comes from the players table */
    kcal_own_products: (op, n) => { if (n){ const p = R.chess_players.find(x => x.id === n.user_id); n.author = (p && p.name) || "A friend"; } },
    kcal_profile: (op, n, o) => { if (op === "INSERT" || (op === "UPDATE" && n.goal !== o.goal)) kcalRecalc(n.user_id); }
  };

  const raise = (message, code = "P0001") => { throw {status: 400, body: {code, message, details: null, hint: null}}; };
  const tippPts = (sport, sh, sa, w, rh, ra, rw) => (sport === "mma" || sport === "lol") ? (w == null || rw == null ? null : w === rw ? 3 : 0)
    : sh == null || sa == null || rh == null || ra == null ? null : sh === rh && sa === ra ? 4
    : Math.sign(sh - sa) === Math.sign(rh - ra) && rh !== ra && sh - sa === rh - ra ? 3 : Math.sign(sh - sa) === Math.sign(rh - ra) ? 2 : 0;
  const evPts = (e, sh, sa, w, final = true) => e.state === "canc" || (final && e.state !== "post") || e.state === "pre" ? null
    : tippPts(e.sport, sh, sa, w, e.meta && e.meta.reg ? Number(e.meta.reg[0]) : e.score_h, e.meta && e.meta.reg ? Number(e.meta.reg[1]) : e.score_a, e.state === "post" ? (e.meta && e.meta.winner) || null : null);
  const player = id => R.chess_players.find(p => p.id === id);

  /* the functions behind /rest/v1/rpc. Anything in the real database that the app doesn't call answers with a plain default. */
  /* the household functions of supabase/schema_home.sql, in the same order of thought. The real database starts the asking in an
     insert trigger and a cron job; here the test calls home_tick() for that. */
  const homePeople = g => { const x = R.home_groups.find(y => y.id === g); return x ? [x.owner].concat(R.home_members.filter(m => m.group_id === g && m.user_id !== x.owner).map(m => m.user_id)) : []; };
  const homeLog = (t, u, what) => R.home_log.push({id: R.home_log.length + 1, group_id: t.group_id, task_id: t.id, title: t.title, emoji: t.emoji, user_id: u, what, at: db.now()});
  const homeAsk = t => { if (["done", "skipped", "taken"].includes(t.state)) return; const L = R.home_log.filter(l => l.group_id === t.group_id), lastDone = u => Math.max(0, ...L.filter(l => l.user_id === u && l.what === "done").map(l => Date.parse(l.at)));
    const owes = u => { const mine = L.filter(l => l.user_id === u), d = mine.map(l => l.what).lastIndexOf("done"); return mine.slice(d + 1).some(l => l.what !== "done"); };
    const done = u => L.filter(l => l.user_id === u && l.what === "done").length;
    const c = homePeople(t.group_id).filter(u => !(t.passed || []).includes(u)).sort((a, b) => (owes(b) ? 1 : 0) - (owes(a) ? 1 : 0) || done(a) - done(b) || lastDone(a) - lastDone(b));
    if (!c.length) Object.assign(t, {state: "open", asked: null, asked_at: db.now()}); else Object.assign(t, {state: "asked", asked: c[0], asked_at: db.now()}); };
  const homeStart = t => { if (t.state !== "wait") return; if (t.everyone) Object.assign(t, {state: "open", asked_at: db.now()}); else homeAsk(t); };
  const homeTask = (u, id) => { if (!u) raise("not signed in"); const t = R.home_tasks.find(x => x.id === id); if (!t || !homeCan(u, t.group_id)) raise("no such task"); return t; };
  const RPC = {
    /* a picture of the front for a photographed pack that has none yet; never replaces one */
    kcal_own_pic(u, {p_code, p_pic}){ if (!u) raise("not signed in"); const l = R.kcal_own_products.filter(x => x.code === p_code && !x.pic && x.status !== "bad"); l.forEach(x => { x.pic = p_pic; }); return l.length > 0; },
    home_can: (u, a) => homeCan(u, a.g), home_owns: (u, a) => homeOwns(u, a.g),
    home_tick(){ R.home_tasks.filter(t => t.state === "wait" && Date.parse(t.ask_at) <= Date.now()).forEach(homeStart); return null; },
    home_answer(u, {p_task, p_yes}){ const t = homeTask(u, p_task); if (["done", "skipped"].includes(t.state)) return "closed";
      if (p_yes){ if (t.state === "taken") return t.taken_by === u ? "taken" : "gone"; Object.assign(t, {state: "taken", taken_by: u, taken_at: db.now(), asked: null, reminded_at: null}); return "taken"; }
      if (t.state === "taken" && t.taken_by === u){ homeLog(t, u, "pass"); Object.assign(t, {state: "wait", taken_by: null, taken_at: null, passed: (t.passed || []).concat(u)}); homeAsk(t); return "passed"; }
      if (t.state === "asked" && t.asked === u){ homeLog(t, u, "pass"); t.passed = (t.passed || []).concat(u); homeAsk(t); return "passed"; }
      if (t.state === "open"){ if (!(t.passed || []).includes(u)) t.passed = (t.passed || []).concat(u); return "passed"; }
      return "not yours"; },
    home_done(u, {p_task}){ const t = homeTask(u, p_task); if (t.state === "done") return "done"; Object.assign(t, {state: "done", done_by: u, done_at: db.now(), asked: null}); homeLog(t, u, "done");
      if (t.kind === "repeat" && t.every_days){ let na = Date.parse(t.ask_at) + t.every_days * 864e5; while (na <= Date.now()) na += t.every_days * 864e5;
        R.home_tasks.push(Object.assign({}, t, {id: require("crypto").randomUUID(), state: "wait", asked: null, asked_at: null, passed: [], taken_by: null, taken_at: null, reminded_at: null, done_by: null, done_at: null, img: null, ask_at: new Date(na).toISOString(), created_at: db.now()})); }
      return "done"; },
    kcal_can_see: (u, a) => kcalCanSee(u, a.owner), shop_can: (u, a) => shopCan(u, a.l), shop_owns: (u, a) => shopOwns(u, a.l),
    news_is_admin: u => isAdmin(u), push_config: () => ({}), events_summary: () => [],
    /* public.kcal_foods_lookup: reads the checked foods by name, never writes */
    kcal_foods_lookup(u, {names}){ if (!u) raise("Bitte anmelden"); if (!Array.isArray(names) || names.length > 40) return [];
      const key = t => String(t || "").replace(/\(.*?\)/g, " ").toLowerCase().replace(/[äöüßéèêàáâíóúñç]/g, ch => "aouseeeaaaiounc"["äöüßéèêàáâíóúñç".indexOf(ch)]).replace(/[^a-z0-9]+/g, " ").trim().slice(0, 60);
      return names.map(n => R.kcal_foods.find(x => x.key === key(n)) || null); },
    kcal_buy_ice(u){ if (!u) raise("Bitte anmelden"); const k = R.kcal_profile.find(p => p.user_id === u); if (!k || k.ice >= 2) raise("Du hast schon zwei"); k.ice++; return k.ice; },
    kcal_invite(u, {target}){
      if (!u || !target || target === u) return "invalid"; if (!friends(u, target)) return "not_friends";
      if (R.kcal_profile.some(k => k.user_id === target && k.enabled)) return "already";
      const ex = R.kcal_invites.find(i => i.from_id === u && i.to_id === target); if (ex && Date.now() - Date.parse(ex.created_at) < 20 * 3600e3) return "sent";
      if (ex) ex.created_at = db.now(); else R.kcal_invites.push({from_id: u, to_id: target, created_at: db.now()}); return "ok";
    },
    tipp_pick(u, {p_event, p_h = null, p_a = null, p_w = null}){
      if (!u) raise("not signed in"); const ev = R.tipp_events.find(e => e.id === p_event); if (!ev) raise("no such event");
      if (ev.state !== "pre" || Date.parse(ev.start_at) <= Date.now()) raise("closed");
      if (ev.sport === "fb"){ if (p_h == null || p_a == null || p_h < 0 || p_h > 20 || p_a < 0 || p_a > 20) raise("bad score"); p_w = null; }
      else if (ev.sport === "lol" || (ev.sport === "mma" && ev.meta && String(ev.meta.title) === "true")){ if (!["a", "b"].includes(p_w)) raise("bad pick"); p_h = p_a = null; }
      else raise("not tippable");
      let r = R.tipp_picks.find(p => p.user_id === u && p.event_id === p_event);
      if (r) Object.assign(r, {sh: p_h, sa: p_a, w: p_w, updated_at: db.now()});
      else { r = {id: db.nextId("tipp_picks"), user_id: u, bot: null, event_id: p_event, sh: p_h, sa: p_a, w: p_w, created_at: db.now(), updated_at: db.now()}; R.tipp_picks.push(r); }
      return {event_id: r.event_id, sh: r.sh, sa: r.sa, w: r.w, updated_at: r.updated_at};
    },
    tipp_table(){
      const g = new Map();
      R.tipp_picks.forEach(p => { const e = R.tipp_events.find(x => x.id === p.event_id); if (!e) return; const k = (p.user_id || "") + "|" + (p.bot || ""), pl = player(p.user_id), pts = evPts(e, p.sh, p.sa, p.w);
        const o = g.get(k) || {uid: p.user_id, bot: p.bot, name: pl ? pl.name : p.bot === "ki" ? "Nat-KI" : "?", avatar: pl ? pl.avatar : null, pts: 0, exact: 0, n: 0, open: 0}; g.set(k, o);
        if (pts != null){ o.pts += pts; o.n++; if ((e.sport === "fb" && pts === 4) || ((e.sport === "mma" || e.sport === "lol") && pts === 3)) o.exact++; } else if (e.state !== "canc") o.open++; });
      return [...g.values()].sort((a, b) => b.pts - a.pts || b.exact - a.exact || a.n - b.n);
    },
    tipp_event_picks(u, {p_event}){
      const ev = R.tipp_events.find(e => e.id === p_event); if (!ev) return [];
      const row = (p, pts, final) => { const pl = player(p.user_id); return {uid: p.user_id, bot: p.bot, name: pl ? pl.name : p.bot === "ki" ? "Nat-KI" : "?", avatar: pl ? pl.avatar : null, sh: p.sh, sa: p.sa, w: p.w, pts, final}; };
      const mine = R.tipp_picks.filter(p => p.event_id === p_event);
      if (ev.state === "pre" && Date.parse(ev.start_at) > Date.now()) return mine.filter(p => p.user_id === u).map(p => row(p, null, false));
      return mine.map(p => row(p, evPts(ev, p.sh, p.sa, p.w, false), ev.state === "post")).sort((a, b) => (b.pts == null ? -1 : b.pts) - (a.pts == null ? -1 : a.pts) || a.name.localeCompare(b.name));
    },
    tipp_claim(u){ if (!u) return {sum: 0, n: 0}; const c = R.tipp_tips.filter(t => t.user_id === u && !t.claimed && ["won", "void"].includes(t.status)); c.forEach(t => { t.claimed = true; });
      return {sum: c.reduce((s, t) => s + t.payout, 0), n: c.length, won: c.filter(t => t.status === "won").length}; },
    tipp_board: () => [], tipp_board_group: () => [], tipp_groups_mine: () => [], tipp_event_tips: () => [], tipp_lines: () => [],
    ranked_me: u => R.chess_ratings.filter(r => r.user_id === u).map(r => ({cat: r.cat, r: Math.round(r.r), rd: Math.round(r.rd), games: r.games, w: r.w, d: r.d, l: r.l, peak: r.peak})),
    ranked_lobby: () => ({}), ranked_top: () => [], ranked_leave: () => null, ranked_queue: () => ({status: "waiting"}), ranked_report: () => ({status: "ok"}),
    nudge_turn: () => null, news_reshow: () => null, news_delete: () => null, news_broadcast: () => 0, news_post: () => db.nextId("chess_news"), news_post_v: () => db.nextId("chess_news"),
    chess_gift_send: (u, {targets}) => (targets || []).filter(t => friends(u, t)).length
  };
  return {CHECKS, UNIQUE, GENERATED, POLICIES, TRIGGERS, RPC};
};
