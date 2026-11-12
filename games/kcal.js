/* ===== Chess.nat Kalorien-Tracker =====
   Opt-in per person (Settings → Kalorien-Tracker). When on, the home screen gets a card with today's kcal, the flame
   and two big buttons: Sprechen (say what you ate, the KI in /api/kcal counts it) and Barcode (scan a pack, Open Food
   Facts has the values). The page #kcal has today, the history by day, and friends who track too.
   Data: Supabase tables kcal_profile / kcal_meals / kcal_invites (see supabase/schema_kcal.sql). Flames and the
   reminder pushes with a meal suggestion in grams are made by the database.
   No sounds here on purpose: recording only turns the button red. */
(() => {
  const sb = () => window.ChessSite && window.ChessSite.sb;
  /* who is signed in: known as soon as the saved session is back, before Social has started */
  const meId = () => (typeof Social !== "undefined" && Social.me) || (window.ChessSite && ChessSite.storedUid ? ChessSite.storedUid() : null);
  const h = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const fmt = n => Math.round(Number(n) || 0).toLocaleString("de-DE");
  const f1 = n => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString("de-DE");
  const pad = n => String(n).padStart(2, "0");
  const dayOf = d => { d = new Date(d); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const today = () => dayOf(Date.now());
  const addDays = (k, n) => { const [y, m, d] = k.split("-").map(Number); return dayOf(new Date(y, m - 1, d + n, 12)); };
  const dayLabel = k => { const t = today(); if (k === t) return "Heute"; if (k === addDays(t, -1)) return "Gestern";
    const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d, 12).toLocaleDateString("de-DE", {weekday: "long", day: "numeric", month: "long"}); };
  const nice = t => { t = String(t || "").trim(); return /\p{Ll}/u.test(t) || t.length < 5 ? t : t.toLowerCase().replace(/(^|[\s\-(\/])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()); };
  const g0 = n => fmt(Math.round(Number(n) || 0)) + " g";
  const hhmm = t => new Date(t).toLocaleTimeString("de-DE", {hour: "2-digit", minute: "2-digit"});
  const haptic = p => { try { if (typeof Haptic !== "undefined") Haptic.go(p || 10); } catch(e) {} };
  const say = (t, ms) => { try { toast(t, ms); } catch(e) {} };
  const svg = (p, s = 24) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const IC = {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    code: '<path d="M4 6v12M7 6v12M10 6v12M14 6v12M17 6v12M20 6v12"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', chef: '<path d="M6 13.5A4 4 0 0 1 7.5 6a4.5 4.5 0 0 1 9 0A4 4 0 0 1 18 13.5V20H6z"/><path d="M6 17h12"/>', list: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', kb: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 15h10"/>',
    torch: '<path d="M8 2h8l-2 6v13h-4V8z"/><path d="M12 12v2"/>',
    pin: '<path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>'
  };

  /* ---------- state ---------- */
  const LS = id => "chessnat-kcal-" + id;
  const K = {
    prof: null, meals: [], friends: [], fmeals: [], invites: [], body: null, weights: [], ice: [], loaded: false, loading: null, loadT: 0,
    on(){ return !!(this.prof && this.prof.enabled); },
    goal(){ return (this.prof && this.prof.goal) || 2500; },
    dayMeals(k){ return this.meals.filter(m => m.day === k).sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts)); },
    dayKcal(k){ return this.meals.filter(m => m.day === k).reduce((s, m) => s + (m.kcal || 0), 0); },
    /* the flame as the phone sees it right now (the database keeps the same count for friends and pushes) */
    flame(){ const g = this.goal(), t = today(), ice = new Set(this.ice || []), hit = d => this.dayKcal(d) >= g; let d = hit(t) ? t : addDays(t, -1), n = 0;
      /* a day covered by a streak freeze keeps the flame without counting */
      for (let k = 0; k < 3650; k++){ if (hit(d)) n++; else if (!ice.has(d)) break; d = addDays(d, -1); } return n; },
    daySum(k, f){ return this.meals.filter(m => m.day === k).reduce((s, m) => s + (Number(m[f]) || 0), 0); },
    /* the day's targets: from the goals set up (or, before that, a sensible split of the kcal goal) */
    targets(){ const p = this.prof || {}, g = this.goal(), b = this.body;
      /* building muscle used to be set up with 2 g protein per kg; it is 1.6 g now, and goals saved the old way follow (what is freed goes to carbs) */
      if (b && b.aim === "muscle" && Number(b.weight) > 0 && p.protein === Math.round(b.weight * 2)){ const pr = Math.round(b.weight * 1.6), fat = p.fat || Math.round(g * .27 / 9); return {kcal: g, protein: pr, fat, carbs: Math.max(0, Math.round((g - pr * 4 - fat * 9) / 4))}; }
      return {kcal: g, protein: p.protein || Math.round(g * .25 / 4), carbs: p.carbs || Math.round(g * .47 / 4), fat: p.fat || Math.round(g * .28 / 9)}; },
    litToday(){ return this.dayKcal(today()) >= this.goal(); },
    cache(){ const id = meId(); if (!id) return; try { localStorage.setItem(LS(id), JSON.stringify({prof: this.prof, body: this.body, weights: (this.weights || []).slice(0, 30), ice: this.ice, meals: this.meals.filter(m => m.day >= addDays(today(), -40))})); } catch(e) {} },
    fromCache(){ const id = meId(); if (!id || this.loaded) return; try { const c = JSON.parse(localStorage.getItem(LS(id)) || "null"); if (c){ this.prof = c.prof; this.meals = c.meals || []; this.body = c.body || null; this.weights = c.weights || []; this.ice = c.ice || []; } } catch(e) {} },
    async load(force){
      const c = sb(), id = meId(); if (!c || !id) return;
      if (this.loading) return this.loading;
      if (!force && this.loaded && Date.now() - this.loadT < 60000) return;
      this.loading = (async () => {
        const since = addDays(today(), -120);
        const opt = q => Promise.resolve(q).catch(() => ({data: null}));
        const [p, m, inv, bd, w, ice] = await Promise.all([
          c.from("kcal_profile").select("*").eq("user_id", id).maybeSingle(),
          c.from("kcal_meals").select("*").eq("user_id", id).gte("day", since).order("ts", {ascending: false}).limit(2000),
          c.from("kcal_invites").select("*").eq("to_id", id),
          opt(c.from("kcal_body").select("*").eq("user_id", id).maybeSingle()),
          opt(c.from("kcal_weights").select("*").eq("user_id", id).order("ts", {ascending: false}).limit(300)),
          opt(c.from("kcal_ice").select("day").eq("user_id", id).gte("day", since))
        ]);
        if (p.error && m.error) throw p.error;
        this.prof = p.data || null; this.meals = m.data || []; this.invites = inv.data || [];
        if (bd && !bd.error) this.body = bd.data || null; if (w && !w.error && w.data) this.weights = w.data; if (ice && !ice.error && ice.data) this.ice = ice.data.map(x => x.day);
        this.loaded = true; this.loadT = Date.now(); this.cache();
      })().finally(() => { this.loading = null; });
      return this.loading;
    },
    async loadFriends(){
      const c = sb(), id = meId(); if (!c || !id) return;
      const t = today();
      const [p, m] = await Promise.all([
        c.from("kcal_profile").select("user_id,enabled,goal,flame,flame_day,best").neq("user_id", id),
        c.from("kcal_meals").select("id,user_id,day,ts,title,emoji,kcal,carbs,protein,fat,items,source").neq("user_id", id).gte("day", addDays(t, -6)).order("ts", {ascending: false}).limit(500)
      ]);
      this.friends = (p.data || []).filter(x => x.enabled); this.fmeals = m.data || [];
    },
    async saveProf(patch){
      const c = sb(), id = meId(); if (!c || !id) throw new Error("Bitte anmelden");
      const row = Object.assign({goal: this.goal(), enabled: this.on(), share: this.prof ? this.prof.share : true, remind: this.prof ? this.prof.remind : true}, patch, {user_id: id});
      const r = this.prof ? await c.from("kcal_profile").update(Object.assign({}, patch, {updated_at: new Date().toISOString()})).eq("user_id", id).select().maybeSingle()
                          : await c.from("kcal_profile").insert(row).select().maybeSingle();
      if (r.error) throw r.error;
      this.prof = r.data || Object.assign({}, this.prof || {}, row); this.cache(); refreshHome();
      if (this.prof.enabled) KCScan.preload();
    },
    /* A draft: what was said is worked out and shown first, and only "Passt" enters it. Until then it lives on the phone alone:
       nothing is saved, the day's numbers don't move and friends get no "hat gegessen" message. Changing amounts, scanning packs,
       naming it all work on the draft. Closed without "Passt", it is gone (and says so). */
    drafts: {},
    watchDrafts(){ if (this._dw) return; let idle = 0; this._dw = setInterval(() => { const ids = Object.keys(this.drafts); if (!ids.length){ clearInterval(this._dw); this._dw = null; return; }
      if (document.querySelector(".dsheet, .kc-ov-full, .kc-sov")){ idle = 0; return; } if (++idle < 2) return; ids.forEach(k => delete this.drafts[k]); say("Nicht eingetragen (ohne „Passt“ geschlossen)"); }, 700); },
    async commit(id){ const d = this.drafts[id]; if (!d) throw new Error("Schon eingetragen"); delete this.drafts[id];
      try { return await this.add({source: d.source, said: d.said, ts: d.ts, day: d.day, title: d.title, emoji: d.emoji, kcal: d.kcal, carbs: d.carbs, protein: d.protein, fat: d.fat, grams: d.grams, code: d.code, items: d.items, note: d.note}); }
      catch(e) { this.drafts[id] = d; throw e; } },
    async add(meal){
      const c = sb(), id = meId(); if (!c || !id) throw new Error("Bitte anmelden");
      if (meal.draft){ const d = {id: "draft-" + Date.now(), draft: true, user_id: id, day: meal.day || dayOf(meal.ts || Date.now()), ts: meal.ts || new Date().toISOString(), title: String(meal.title || "Mahlzeit").slice(0, 120), emoji: meal.emoji || "🍽️", source: meal.source || "manual",
        kcal: Math.max(0, Math.round(meal.kcal || 0)), carbs: meal.carbs || 0, protein: meal.protein || 0, fat: meal.fat || 0, grams: meal.grams || null, code: meal.code || null, said: meal.said || null, items: meal.items || null, note: meal.note || null, created_at: new Date().toISOString()};
        this.drafts[d.id] = d; this.watchDrafts(); return d; }
      const row = {user_id: id, day: meal.day || dayOf(meal.ts || Date.now()), ts: meal.ts || new Date().toISOString(), title: String(meal.title || "Mahlzeit").slice(0, 120), emoji: meal.emoji || "🍽️",
        source: meal.source || "manual", kcal: Math.max(0, Math.round(meal.kcal || 0)), carbs: meal.carbs || 0, protein: meal.protein || 0, fat: meal.fat || 0,
        grams: meal.grams || null, code: meal.code || null, said: meal.said ? String(meal.said).slice(0, 2000) : null, items: meal.items || null, note: meal.note ? String(meal.note).slice(0, 500) : null};
      const r = await c.from("kcal_meals").insert(row).select().single();
      if (r.error) throw r.error;
      const before = snap();
      this.meals.unshift(r.data); this.cache(); refreshHome(); cheer(before);
      return r.data;
    },
    async update(id, patch){
      if (this.drafts[id]){ this.drafts[id] = Object.assign({}, this.drafts[id], patch); return this.drafts[id]; }
      const r = await sb().from("kcal_meals").update(patch).eq("id", id).select().single(); if (r.error) throw r.error;
      const before = snap(), i = this.meals.findIndex(m => m.id === id); if (i >= 0) this.meals[i] = r.data; this.cache(); refreshHome(); cheer(before); return r.data;
    },
    async saveBody(patch){
      const c = sb(), id = meId(); if (!c || !id) throw new Error("Bitte anmelden");
      const row = Object.assign({}, this.body || {}, patch, {user_id: id, updated_at: new Date().toISOString()});
      const r = await c.from("kcal_body").upsert(row).select().maybeSingle(); if (r.error) throw r.error; this.body = r.data || row; this.cache(); return this.body;
    },
    /* a weigh-in: fasted when nothing is logged today yet; the first fasted one sets the time to compare with */
    async addWeight(kg, pooped){
      const c = sb(), id = meId(); if (!c || !id) throw new Error("Bitte anmelden"); const at = new Date(), fasted = !this.dayMeals(today()).length;
      const r = await c.from("kcal_weights").insert({user_id: id, ts: at.toISOString(), day: today(), kg, fasted, pooped: pooped == null ? null : !!pooped}).select().single(); if (r.error) throw r.error;
      this.weights.unshift(r.data); const patch = {weight: kg}; if (this.body && this.body.weigh_min == null && fasted) patch.weigh_min = at.getHours() * 60 + at.getMinutes();
      await this.saveBody(patch);
      /* the needs follow the weight (unless the targets were set by hand) */
      if (this.body && this.body.setup_at && !this.body.custom){ const n = needs(this.body); if (n.kcal !== this.goal() || n.protein !== (this.prof || {}).protein) await this.saveProf({goal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat}); }
      this.cache(); refreshHome(); return r.data;
    },
    async buyIce(){ const r = await sb().rpc("kcal_buy_ice"); if (r.error) throw r.error; this.prof.ice = r.data; this.cache(); refreshHome(); return r.data; },
    async del(id){
      if (this.drafts[id]){ delete this.drafts[id]; return; }
      const r = await sb().from("kcal_meals").delete().eq("id", id); if (r.error) throw r.error;
      this.meals = this.meals.filter(m => m.id !== id); this.cache(); refreshHome();
    }
  };
  window.Kcal = K;

  /* a meal idea in grams that fills what is missing (same list as the reminder pushes) */
  const IDEAS = {
    morning: [["Müsli", 370, 130, " mit 200 ml Milch", 50, 150], ["Haferflocken", 370, 230, " mit 200 ml Milch und einer Banane", 50, 120], ["Vollkornbrot mit Erdnussbutter", 330, 0, "", 80, 250], ["Griechischer Joghurt mit Honig", 150, 120, " und einer Handvoll Nüssen", 150, 400]],
    day: [["Nudeln (trocken gewogen)", 355, 150, " mit Pesto", 80, 200], ["Reis (trocken gewogen)", 350, 180, " mit Hähnchen", 70, 180], ["Vollkornbrot mit Käse", 300, 0, "", 100, 300], ["Studentenfutter", 480, 0, "", 30, 120]],
    evening: [["Nudeln (trocken gewogen)", 355, 200, " mit Tomatensoße und Hackfleisch", 80, 200], ["Brot mit Käse und Butter", 330, 0, "", 80, 250], ["Kartoffeln", 75, 250, " mit Quark und Leinöl", 200, 600]],
    late: [["Erdnussbutter-Toast", 360, 0, "", 50, 200], ["Müsli", 370, 130, " mit 200 ml Milch", 50, 150], ["Nüsse", 620, 0, "", 25, 100], ["Quark mit Honig", 120, 60, "", 150, 500]]
  };
  function idea(missing){
    const hr = new Date().getHours() + new Date().getMinutes() / 60, slot = hr < 11 ? "morning" : hr < 17 ? "day" : hr < 20.5 ? "evening" : "late";
    const list = IDEAS[slot], pick = list[(new Date().getDate() + Math.floor(hr / 3)) % list.length];
    const [name, k100, extra, ex, mn, mx] = pick, want = Math.min(missing, slot === "late" ? 900 : 800);
    const g = Math.max(mn, Math.min(mx, Math.round(Math.max(0, want - extra) / (k100 / 100) / 5) * 5));
    return {text: `${g} g ${name}${ex}`, kcal: Math.round((g * k100 / 100 + extra) / 10) * 10};
  }
  /* how far along the day should be (goal spread from 8 to 21 Uhr) */
  const expected = () => { const hr = new Date().getHours() + new Date().getMinutes() / 60; return Math.round(K.goal() * Math.min(1, Math.max(0, (hr - 8) / 13))); };

  /* ---------- home card ---------- */
  let homeEl = null;
  const onPage = () => typeof App !== "undefined" && (App.route === "kcal" || (App.route === "home" && Views.home && Views.home.k));
  function refreshHome(){ if (homeEl && homeEl.isConnected) fillHome(homeEl); if (onPage()) Views.kcal.draw(); }
  function flameChip(n, lit, ice){ return ice == null ? `<span class="kc-fl ${lit ? "lit" : n ? "" : "off"}" title="${n} Tage Kalorienziel in Folge">🔥<b>${n}</b></span>`
    : `<button class="kc-fl big ${lit ? "lit" : n ? "" : "off"}" data-kc-fl aria-label="${n} Tage in Folge">🔥<b>${n}</b>${ice ? `<i class="kc-ice">${"🧊".repeat(Math.min(2, ice))}</i>` : ""}</button>`; }
  const myIce = () => (K.prof && K.prof.ice) || 0;
  function fillHome(el){
    homeEl = el;
    if (!K.on()){
      const inv = K.invites[0];
      if (inv){ const who = typeof Social !== "undefined" ? Social.P(inv.from_id).name : "Ein Freund";
        el.hidden = false; el.className = "unit kc-home kc-inv";
        el.innerHTML = `<div class="kc-invt">🍽️ <b>${h(who)}</b> lädt dich zum Kalorien-Tracker ein</div><p class="muted">Kalorien per Sprache oder Barcode eintragen, gegenseitig sehen und Flammen sammeln.</p>
          <div class="kc-row2"><button class="btn go" data-kc-act>Aktivieren</button><button class="btn ghost" data-kc-no>Nein danke</button></div>`;
        el.querySelector("[data-kc-act]").onclick = async () => { try { await K.saveProf({enabled: true}); say("Kalorien-Tracker ist an 🔥"); } catch(e) { say("Ging nicht: " + (e.message || e)); } };
        el.querySelector("[data-kc-no]").onclick = async () => { el.hidden = true; try { await sb().from("kcal_invites").delete().eq("to_id", meId()); K.invites = []; } catch(e) {} };
        return;
      }
      el.hidden = true; el.innerHTML = ""; return;
    }
    const t = today(), g = K.goal(), eaten = K.dayKcal(t), lit = eaten >= g, n = K.flame(), miss = g - eaten;
    let tip = "";
    if (!lit && new Date().getHours() >= 9 && (eaten < expected() - 250 || new Date().getHours() >= 20)){ const i = idea(miss); tip = `<div class="kc-tip">Noch <b>${fmt(miss)} kcal</b>. Zum Beispiel ${h(i.text)} (≈ ${fmt(i.kcal)} kcal)</div>`; }
    el.hidden = false; el.className = "unit kc-home";
    /* top: the day and its macros; middle (where the thumb is): speak and scan; below: search and what you eat often */
    el.innerHTML = `<div class="kc-hd"><button class="kc-ttl" data-kc-go>Kalorien heute</button>${flameChip(n, lit, myIce())}<button class="kc-ov" data-kc-go>${svg(IC.chart, 16)} Übersicht</button></div>
      ${sumHTML(t, true)}
      <div class="kc-btns two"><button class="kc-big kc-say" data-kc-say>${svg(IC.mic, 32)}<span>Sprechen</span></button><button class="kc-big kc-scan" data-kc-scan>${svg(IC.code, 32)}<span>Barcode</span></button></div>
      <button class="kc-sbar" data-kc-find>${svg(IC.search, 18)}<span>Lebensmittel suchen …</span></button>
      ${setupCard()}${quickHTML()}${tip}`;
    wireDay(el); animSum(el);
    if (K.loaded){ Weigh.check(); Wrap.check(); }
  }
  window.homeKcal = async el => {
    if (!el) return; homeEl = el;
    if (!meId() && typeof Social !== "undefined"){ el.hidden = true; let n = 0; const wait = () => { if (meId()) return window.homeKcal(el); if (++n < 20 && el.isConnected) setTimeout(wait, 500); }; setTimeout(wait, 500); return; }
    K.fromCache(); fillHome(el);
    try { await K.load(); } catch(e) { return; }
    if (K.on() && !window.__kcHomeSwap && typeof App !== "undefined" && App.route === "home" && typeof kcalHome === "function" && kcalHome() && !(App.busy && App.busy())){ window.__kcHomeSwap = 1; App.go("home", undefined, true); return; }
    if (el.isConnected) fillHome(el);
    if (K.on()) KCScan.preload();
  };

  /* ---------- celebration when the goal is reached ---------- */
  function celebrate(){
    const n = K.flame(); haptic([20, 40, 20]);
    const sh = detailSheet(`<div class="kc-cel"><div class="kc-celf">🔥</div><h2>Kalorienziel geschafft!</h2><p class="muted">${n > 1 ? `${n} Tage in Folge. Deine Flamme brennt weiter.` : "Deine Flamme brennt. Morgen wieder!"}</p></div>`);
    setTimeout(() => { try { sh.close(); } catch(e) {} }, 4000);
  }

  /* ---------- confetti: big for the day's goal, small for protein, carbs or fat ---------- */
  function confetti(big, from){ try {
    const cv = document.createElement("canvas"), dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight; cv.className = "kc-conf"; cv.width = W * dpr; cv.height = H * dpr; document.body.appendChild(cv);
    const c = cv.getContext("2d"); c.scale(dpr, dpr); const cols = ["#8FC458", "#FFD15C", "#E9573F", "#4FA3FF", "#B65CE0", "#F2A33A"], n = big ? 170 : 50, x0 = from ? from.x : W / 2, y0 = from ? from.y : H * .38, P = [];
    for (let i = 0; i < n; i++){ const a = -Math.PI / 2 + (Math.random() - .5) * (big ? 2.6 : 1.7), v = (big ? 9 : 6) + Math.random() * (big ? 10 : 5); P.push({x: x0, y: y0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6.3, vr: (Math.random() - .5) * .4, w: 5 + Math.random() * 6, h: 3 + Math.random() * 4, c: cols[i % cols.length]}); }
    const t0 = performance.now(), dur = big ? 2800 : 1600, f = t => { const k = (t - t0) / dur; c.clearRect(0, 0, W, H);
      P.forEach(q => { q.x += q.vx; q.y += q.vy; q.vy += .3; q.vx *= .99; q.r += q.vr; c.save(); c.globalAlpha = Math.max(0, 1 - Math.max(0, k - .6) / .4); c.translate(q.x, q.y); c.rotate(q.r); c.fillStyle = q.c; c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); c.restore(); });
      if (k < 1) requestAnimationFrame(f); else cv.remove(); }; requestAnimationFrame(f); } catch(e) {} }
  const snap = () => { const t = today(); return {kcal: K.dayKcal(t), protein: K.daySum(t, "protein"), carbs: K.daySum(t, "carbs"), fat: K.daySum(t, "fat")}; };
  /* a goal crossed just now: the day's kcal → the big celebration; protein, carbs, fat → a small burst (each once a day) */
  function cheer(before){ const t = today(), T = K.targets(), now2 = snap(), key = "chessnat-kc-cheer-" + t; let done = {}; try { done = JSON.parse(localStorage.getItem(key) || "{}"); } catch(e) {}
    const crossed = k => before[k] < T[k] && now2[k] >= T[k] && !done[k]; let big = false, small = null;
    if (crossed("kcal")){ done.kcal = 1; big = true; }
    [["protein", "💪 Proteinziel geschafft!"], ["carbs", "🍞 KH-Ziel erreicht"], ["fat", "🥑 Fett-Ziel erreicht"]].forEach(([k, l]) => { if (crossed(k)){ done[k] = 1; if (!small) small = l; } });
    if (!big && !small) return; try { localStorage.setItem(key, JSON.stringify(done)); } catch(e) {}
    setTimeout(() => { if (big){ celebrate(); confetti(true); } else { confetti(false); say(small); haptic([10, 30, 10]); } }, 450); }

  /* ---------- the day's needs, like a calorie calculator: Mifflin-St Jeor × activity, then the goal on top ---------- */
  const AIMS = [["lose", "🔥", "Abnehmen", "Fett verlieren, Muskeln halten", .8, 2], ["keep", "⚖️", "Gewicht halten", "Fit bleiben, so wie jetzt", 1, 1.6], ["muscle", "💪", "Muskeln aufbauen", "Sauber zunehmen, viel Protein", 1.1, 1.6], ["gain", "📈", "Zunehmen", "Mehr auf die Waage", 1.15, 1.7], ["bulk", "🦍", "Bulken", "So viel Masse wie geht", 1.2, 1.8]];
  const ACTS = [[1.2, "Kaum Bewegung", "Viel sitzen, kein Sport"], [1.375, "Etwas aktiv", "1–2× Sport pro Woche"], [1.55, "Aktiv", "3–5× Sport pro Woche"], [1.725, "Sehr aktiv", "6–7× Sport oder körperliche Arbeit"], [1.9, "Extrem aktiv", "Leistungssport und harte Arbeit"]];
  function needs(b){ const age = Math.max(14, new Date().getFullYear() - (b.born || 1995)), w = Number(b.weight) || 75, hg = Number(b.height) || 178, bmr = 10 * w + 6.25 * hg - 5 * age + (b.sex === "f" ? -161 : 5), tdee = bmr * (Number(b.activity) || 1.375), A = AIMS.find(a => a[0] === b.aim) || AIMS[1];
    const kcal = Math.round(tdee * A[4] / 10) * 10, protein = Math.round(w * A[5]), fat = Math.round(kcal * .27 / 9), carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    return {kcal, protein, carbs, fat, bmr: Math.round(bmr), tdee: Math.round(tdee), A}; }
  /* the questions at the start (and whenever the goal changes): one question per screen, big answers */
  const Setup = {
    open(done){
      if (!meId()) return say("Bitte erst anmelden");
      const b = Object.assign({aim: null, sex: null, born: null, height: null, weight: null, activity: null}, K.body || {}), steps = ["aim", "sex", "body", "act", "show", "res"], ov = document.createElement("div"); let step = 0, pick = null;
      ov.className = "kc-ov-full kc-setup"; ov.setAttribute("data-notr", ""); document.body.appendChild(ov);
      const close = () => ov.remove();
      const draw = () => { const k = steps[step]; let body = "";
        if (k === "aim") body = `<h2>Was ist dein Ziel?</h2><div class="kc-opts">${AIMS.map(a => `<button class="kc-opt ${b.aim === a[0] ? "on" : ""}" data-v="${a[0]}"><span>${a[1]}</span><b>${a[2]}<small>${a[3]}</small></b></button>`).join("")}</div>`;
        else if (k === "sex") body = `<h2>Du bist …</h2><div class="kc-opts two">${[["m", "👨", "Mann"], ["f", "👩", "Frau"]].map(a => `<button class="kc-opt ${b.sex === a[0] ? "on" : ""}" data-v="${a[0]}"><span>${a[1]}</span><b>${a[2]}</b></button>`).join("")}</div>`;
        else if (k === "body") body = `<h2>Ein paar Zahlen</h2><div class="kc-bform"><label><span>Alter</span><input id="sAge" inputmode="numeric" value="${b.born ? new Date().getFullYear() - b.born : ""}" placeholder="25"><em>Jahre</em></label><label><span>Größe</span><input id="sH" inputmode="numeric" value="${b.height || ""}" placeholder="180"><em>cm</em></label><label><span>Gewicht</span><input id="sW" inputmode="decimal" value="${b.weight ? nf(b.weight, 1) : ""}" placeholder="75"><em>kg</em></label></div><button class="btn go big" id="sNext">Weiter</button>`;
        else if (k === "show"){ pick = pick || shows().slice();
          body = `<h2>Was ist dir wichtig?</h2><p class="muted kc-ssub">Die ersten zwei, die du antippst, stehen oben groß, der Rest klein darunter.</p><div class="kc-opts">${NORD.map(x => `<button class="kc-opt ${pick.includes(x) ? "on" : ""}" data-sh="${x}"><span>${NUT[x].e}</span><b>${NUT[x].l}</b></button>`).join("")}</div><button class="btn go big" id="sNext2">Weiter</button>`; }
        else if (k === "act") body = `<h2>Wie viel bewegst du dich?</h2><div class="kc-opts">${ACTS.map(a => `<button class="kc-opt ${Number(b.activity) === a[0] ? "on" : ""}" data-v="${a[0]}"><b>${a[1]}<small>${a[2]}</small></b></button>`).join("")}</div>`;
        else { const n = needs(b); body = `<h2>Dein Tagesbedarf</h2><div class="kc-res"><div class="kc-resk"><b>${fmt(n.kcal)}</b><span>kcal am Tag</span></div>
            <div class="kc-macros"><span><b>${n.protein} g</b>Protein</span><span><b>${n.carbs} g</b>KH</span><span><b>${n.fat} g</b>Fett</span></div>
            <p class="muted">Grundumsatz ${fmt(n.bmr)} kcal, mit Bewegung ${fmt(n.tdee)} kcal${n.A[4] !== 1 ? `, für „${n.A[2]}“ ${n.A[4] > 1 ? "+" : "−"}${Math.round(Math.abs(n.A[4] - 1) * 100)} %` : ""}. Protein: ${nf(n.A[5], 1)} g pro kg Körpergewicht.</p></div>
            <button class="btn go big" id="sSave">Passt, los geht’s</button>`; }
        ov.innerHTML = `<div class="kc-vtop"><button class="kc-x" data-back aria-label="Zurück">${step ? svg('<path d="M15 5l-7 7 7 7"/>', 22) : svg(IC.x, 22)}</button><div class="kc-dots">${steps.map((x, i) => `<i class="${i <= step ? "on" : ""}"></i>`).join("")}</div><span style="width:44px"></span></div><div class="kc-smid">${body}</div>`;
        ov.querySelector("[data-back]").onclick = () => { if (step){ step--; draw(); } else close(); };
        ov.querySelectorAll("[data-v]").forEach(x => x.onclick = () => { haptic(10); const v = x.dataset.v; if (k === "aim") b.aim = v; if (k === "sex") b.sex = v; if (k === "act") b.activity = +v; x.classList.add("on"); setTimeout(() => { step++; draw(); }, 120); });
        ov.querySelectorAll("[data-sh]").forEach(x => x.onclick = () => { const v = x.dataset.sh; if (pick.includes(v)){ if (pick.length < 2) return say("Mindestens eins"); pick = pick.filter(y => y !== v); } else { pick.push(v); } haptic(8); x.classList.toggle("on", pick.includes(v)); });
        const n2 = ov.querySelector("#sNext2"); if (n2) n2.onclick = () => { step++; draw(); };
        const nx = ov.querySelector("#sNext"); if (nx){ const ins = ov.querySelectorAll("input"); ins.forEach(i => field(i)); try { ins[0].focus({preventScroll: true}); } catch(e) {}
          nx.onclick = () => { const age = num(ov.querySelector("#sAge").value), hh = num(ov.querySelector("#sH").value), w = num(ov.querySelector("#sW").value);
            if (!(age >= 12 && age <= 100)) return say("Alter zwischen 12 und 100"); if (!(hh >= 120 && hh <= 230)) return say("Größe in cm, z. B. 180"); if (!(w >= 30 && w <= 300)) return say("Gewicht in kg, z. B. 75");
            b.born = new Date().getFullYear() - Math.round(age); b.height = Math.round(hh); b.weight = Math.round(w * 10) / 10; try { document.activeElement.blur(); } catch(e) {} step++; draw(); }; }
        const sv = ov.querySelector("#sSave"); if (sv) sv.onclick = async () => { sv.disabled = true; const n = needs(b);
          try { const lastKg = K.weights[0] && Number(K.weights[0].kg);
            await K.saveBody({aim: b.aim, sex: b.sex, born: b.born, height: b.height, weight: b.weight, activity: b.activity, custom: false, setup_at: new Date().toISOString()});
            await K.saveProf(Object.assign({enabled: true, goal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat}, pick ? {show: pick.slice(0, 3)} : {})); if (pick) setPicked(pick.length);
            if (!(Math.abs(lastKg - b.weight) < .05)) await K.addWeight(b.weight, null).catch(() => {});
            close(); haptic([15, 30, 15]); confetti(false); say(`🎯 ${fmt(n.kcal)} kcal am Tag, ${n.protein} g Protein`); refreshHome(); if (done) done(); } catch(e) { sv.disabled = false; say("Ging nicht: " + (e.message || e)); } };
      };
      draw();
    }
  };
  /* ---------- weighing: about once a week, before the first meal, near the time of the first weigh-in ---------- */
  const Weigh = {
    shown: 0,
    due(){ const b = K.body; if (!b || !b.setup_at || !K.on()) return false; const last = K.weights[0], days = last ? (Date.now() - Date.parse(last.ts)) / 864e5 : 99;
      if (days < 6.5 || K.dayMeals(today()).length) return false; try { if (Date.now() - Number(localStorage.getItem("chessnat-kc-wlater") || 0) < 3 * 3600e3) return false; } catch(e) {}
      const mins = new Date().getHours() * 60 + new Date().getMinutes(); if (b.weigh_min == null) return mins >= 300 && mins <= 720; return Math.abs(mins - b.weigh_min) <= 75 || (days > 9 && mins >= 300 && mins <= 840); },
    check(){ if (Weigh.shown || !Weigh.due()) return; Weigh.shown = 1; setTimeout(() => { if (!document.querySelector(".dsheet,.kc-ov-full,.onb")) Weigh.open(); else Weigh.shown = 0; }, 900); },
    open(){ const last = K.weights[0], b = K.body || {}; let poop = null;
      const sh = detailSheet(`<div class="kc-form kc-weigh" data-notr><div class="kc-celf">⚖️</div><h3>Zeit fürs Wiegen</h3><p class="muted">Nüchtern, ${b.weigh_min != null ? `ungefähr wie beim ersten Mal (${pad(Math.floor(b.weigh_min / 60))}:${pad(b.weigh_min % 60)} Uhr)` : "am besten morgens"}. So kannst du die Werte vergleichen.</p>
        <div class="kc-gram"><label><input id="kwkg" inputmode="decimal" value="${last ? nf(last.kg, 1) : b.weight ? nf(b.weight, 1) : ""}"> kg</label></div>
        <p class="kc-pt">Warst du heute schon auf der Toilette?</p><div class="kc-seg"><button class="btn" data-p="1">Ja</button><button class="btn" data-p="0">Noch nicht</button></div>
        <div class="kc-row2"><button class="btn go" id="kwsave">Speichern</button><button class="btn" id="kwlater">Später</button></div></div>`);
      const el = sh.el, inp = el.querySelector("#kwkg"); field(inp);
      el.querySelectorAll("[data-p]").forEach(x => x.onclick = () => { poop = x.dataset.p === "1"; el.querySelectorAll("[data-p]").forEach(y => y.classList.toggle("go", y === x)); haptic(8); });
      el.querySelector("#kwlater").onclick = () => { try { localStorage.setItem("chessnat-kc-wlater", String(Date.now())); } catch(e) {} sh.close(); };
      el.querySelector("#kwsave").onclick = async () => { const kg = num(inp.value); if (!(kg >= 30 && kg <= 300)) return say("Gewicht in kg, z. B. 75,4"); if (poop == null) return say("Kurz noch: schon auf Toilette gewesen?");
        try { const prev = K.weights[0]; await K.addWeight(Math.round(kg * 10) / 10, poop); sh.close(); haptic(15); const d = prev ? Math.round((kg - prev.kg) * 10) / 10 : 0;
          say(`⚖️ ${nf(kg, 1)} kg gespeichert${prev ? ` (${d > 0 ? "+" : d < 0 ? "−" : "±"}${nf(Math.abs(d), 1)} kg)` : ""}`); } catch(e) { say("Ging nicht: " + (e.message || e)); } };
      return sh; }
  };
  /* ---------- the flame and the streak freezes ("Streak on Ice"): one for every full week, or bought; two at most ---------- */
  const ICE_PRICE = 500;
  function iceSheet(){ const n = myIce(), f = K.flame(), bal = typeof natBal === "function" ? natBal() : 0;
    const sh = detailSheet(`<div class="kc-form kc-icebox" data-notr><div class="kc-celf">🔥</div><h3>${f} ${f === 1 ? "Tag" : "Tage"} in Folge</h3><p class="muted">Jeden Tag, an dem du dein Kalorienziel schaffst, brennt deine Flamme weiter.</p>
      <div class="kc-ices">${[0, 1].map(i => `<span class="${i < n ? "on" : ""}">🧊</span>`).join("")}</div>
      <p class="kc-icet"><b>Streak on Ice:</b> Verpasst du mal einen Tag, bleibt deine Flamme trotzdem. Eins gibt’s für jede volle Woche, oder du kaufst es. Höchstens zwei.</p>
      ${n < 2 ? `<button class="btn go big" id="kcbuy" ${bal < ICE_PRICE ? "disabled" : ""}>🧊 Kaufen für ${ICE_PRICE} Natcoins</button>${bal < ICE_PRICE ? `<p class="muted">Du hast ${fmt(bal)} Natcoins.</p>` : ""}` : `<p class="muted">Du hast beide. Stark!</p>`}</div>`);
    const bb = sh.el.querySelector("#kcbuy"); if (bb) bb.onclick = async () => { if (!(typeof natSpend === "function" && natSpend(ICE_PRICE))) return say("Nicht genug Natcoins"); bb.disabled = true;
      try { await K.buyIce(); sh.close(); haptic([15, 30, 15]); confetti(false); say("🧊 Streak on Ice gekauft"); } catch(e) { if (typeof natEarn === "function") natEarn(ICE_PRICE, true); bb.disabled = false; say("Ging nicht: " + (e.message || e)); } };
    return sh; }
  /* ---------- what each person cares about (Settings): the first two big at the top, up to three as columns in the lists ---------- */
  const NUT = {kcal: {l: "Kalorien", s: "kcal", c: "k", e: "🔥"}, carbs: {l: "Kohlenhydrate", s: "KH", c: "c", e: "🍞"}, protein: {l: "Protein", s: "Protein", c: "p", e: "💪"}, fat: {l: "Fett", s: "Fett", c: "f", e: "🥑"}}, NORD = ["kcal", "protein", "carbs", "fat"];
  const aimShow = aim => ["kcal", ["muscle", "gain", "bulk"].includes(aim) ? "protein" : "carbs"];
  /* what you see, in the order you tapped it: the first two big at the top, the others small below, all of them as columns in the lists.
     Nobody picked yet: all four, calories and protein first. The profile keeps at most three (in order); "all four" is remembered
     on this phone (SHOWK = "4") and the one left over simply comes last */
  const SHOWK = "chessnat-kc-show4", pickedV = () => { try { return localStorage.getItem(SHOWK) || ""; } catch(e) { return ""; } }, setPicked = n => { try { localStorage.setItem(SHOWK, n >= NORD.length ? "4" : "1"); } catch(e) {} };
  function shows(){ const p = K.prof || {}, f = pickedV();
    if (f && Array.isArray(p.show)){ const s2 = p.show.filter((k, i) => NORD.includes(k) && p.show.indexOf(k) === i); if (s2.length) return f === "4" ? s2.concat(NORD.filter(k => !s2.includes(k))) : s2; }
    return NORD.slice(); }
  const vOf = (o, k) => Number(o[k]) || 0;
  /* in the lists only the two values that matter most to you (the ones shown big at the top): the name of what you ate gets the room */
  const cells = o => { const S = shows().slice(0, 2), n3 = S.length > 3 ? " n3 n4" : S.length > 2 ? " n3" : ""; return S.map(k => `<span class="kc-n ${NUT[k].c}${n3}">${k === "kcal" || S.length > 3 ? fmt(Math.round(vOf(o, k))) : g0(vOf(o, k))}</span>`).join(""); };
  const heads = () => { const S = shows().slice(0, 2), n3 = S.length > 3 ? " n3 n4" : S.length > 2 ? " n3" : ""; return S.map(k => `<span class="kc-n ${NUT[k].c}${n3}">${S.length > 3 ? ({kcal: "kcal", protein: "Prot.", carbs: "KH", fat: "Fett"})[k] : NUT[k].s}</span>`).join(""); };
  const one1 = (o, k) => k === "kcal" ? fmt(vOf(o, k)) + " kcal" : f1(vOf(o, k)) + " g " + NUT[k].s;
  /* a line of values: the chosen ones bold, the rest small */
  const vline = o => { const S = shows(), rest = NORD.filter(k => !S.includes(k));
    return S.map(k => k === "kcal" ? `<b>${fmt(vOf(o, k))}</b> kcal` : `<b>${f1(vOf(o, k))}</b> g ${NUT[k].s}`).join(" · ") + (rest.length ? `<small>${rest.map(k => one1(o, k)).join(" · ")}</small>` : ""); };
  const brief = o => shows().map(k => one1(o, k)).join(" · ");
  const P2o = (P, f = 1) => ({kcal: P.k * f, carbs: P.c * f, protein: P.pr * f, fat: P.f * f});
  const sumOf = ms => { const o = {kcal: 0, carbs: 0, protein: 0, fat: 0}; ms.forEach(m => NORD.forEach(k => { o[k] += Number(m[k]) || 0; })); return o; };

  /* ---------- the day at a glance: the two that matter most, big, against their targets ---------- */
  function sumHTML(t, go){ const T = K.targets(), S = shows(), top = S.slice(0, 2), rest = S.slice(2), v = k => k === "kcal" ? K.dayKcal(t) : K.daySum(t, k), pc = k => Math.round(Math.min(1, v(k) / (T[k] || 1)) * 100);
    const box = k => { const ok = v(k) >= T[k]; return `<div class="kc-b2 ${NUT[k].c} ${ok ? "ok" : ""}"><small>${NUT[k].l}${k === "kcal" && ok ? " 🔥" : ""}</small><b><var data-cnt="${k}" data-v="${Math.round(v(k))}">${fmt(v(k))}</var><em> / ${fmt(T[k])}${k === "kcal" ? "" : " g"}</em></b><i><u data-bar="${k}" style="width:${pc(k)}%"></u></i></div>`; };
    const small = k => `<span class="${v(k) >= T[k] ? "ok" : ""}">${NUT[k].s || NUT[k].l} <b data-cnt="${k}" data-v="${Math.round(v(k))}">${fmt(v(k))}</b> / ${fmt(T[k])}${k === "kcal" ? " kcal" : " g"}<i><u data-bar="${k}" style="width:${pc(k)}%"></u></i></span>`;
    return `<div class="kc-two ${top.length < 2 ? "one" : ""}" ${go ? "data-kc-go" : ""}>${top.map(box).join("")}</div>${rest.length ? `<div class="kc-pf">${rest.map(small).join("")}</div>` : ""}`; }
  /* ---------- suggestions: what's pinned first, then what is eaten again and again; + adds it once more, a tap on the row shows it ---------- */
  const keyOf = m => { const it = Array.isArray(m.items) && m.items.length === 1 ? m.items[0] : null; return m.code || (it && it.code) || String(m.title || "").toLowerCase().trim(); };
  const pins = () => Array.isArray(K.prof && K.prof.pins) ? K.prof.pins : [];
  const isPinned = m => pins().some(p => p.k === keyOf(m));
  async function togglePin(m){ const k = keyOf(m), on = isPinned(m), l = pins().filter(p => p.k !== k);
    if (!on){ if (l.length >= 12) throw new Error("Höchstens 12 angepinnt");
      l.unshift({k, title: String(m.title || "").slice(0, 120), emoji: m.emoji || "🍽️", kcal: m.kcal || 0, carbs: m.carbs || 0, protein: m.protein || 0, fat: m.fat || 0, grams: m.grams || null, code: m.code || null, note: m.note || null, items: Array.isArray(m.items) ? m.items.slice(0, 12) : null}); }
    await K.saveProf({pins: l}); haptic(10); say(on ? "Nicht mehr angepinnt" : "📌 Angepinnt: steht jetzt oben bei den Vorschlägen"); return !on; }
  const pinHTML = m => `<button class="kc-pin ${isPinned(m) ? "on" : ""}" data-pin>${svg(IC.pin, 16)}<span>${isPinned(m) ? "Angepinnt" : "Anpinnen"}</span></button>`;
  function wirePin(el, m){ const b = el.querySelector("[data-pin]"); if (!b) return;
    b.onclick = async e => { e.stopPropagation(); if (b.disabled) return; b.disabled = true; try { const on = await togglePin(m); b.classList.toggle("on", on); b.querySelector("span").textContent = on ? "Angepinnt" : "Anpinnen"; } catch(err) { say(err.message || "Ging nicht"); } b.disabled = false; }; }
  function frequent(){ const since = addDays(today(), -60), G = new Map(), hr = new Date().getHours() + new Date().getMinutes() / 60;
    K.meals.forEach(m => { if (m.day < since) return; const key = keyOf(m); if (!key) return;
      const g = G.get(key) || {n: 0, m, ts: 0, near: 0}; g.n++; const ts = Date.parse(m.ts) || 0, d = new Date(ts), mh = d.getHours() + d.getMinutes() / 60; if (Math.abs(mh - hr) <= 2) g.near++; if (ts > g.ts){ g.ts = ts; g.m = m; } G.set(key, g); });
    return [...G.values()].map(g => Object.assign(g, {sc: g.n * 3 + g.near * 2 + (Date.now() - g.ts < 3 * 864e5 ? 2 : 0)})).sort((a, b) => b.sc - a.sc || b.ts - a.ts).slice(0, 8).map(g => g.m); }
  let QL = [];
  function suggestions(){ const P = pins().slice(0, 8).map(p => ({m: K.meals.find(m => keyOf(m) === p.k) || p, pin: true})), keys = new Set(pins().map(p => p.k));
    return P.concat(frequent().filter(m => !keys.has(keyOf(m))).map(m => ({m, pin: false}))).slice(0, Math.max(4, P.length)); }
  function quickHTML(){ QL = suggestions(); if (!QL.length) return "";
    return `<div class="kc-quick"><div class="kc-lh q"><span>Vorschläge</span>${heads()}<i></i></div><div class="kc-qc">${QL.map((q, i) => `<div class="kc-q" data-qi="${i}" role="button" tabindex="0"><span class="kc-qn">${q.pin ? `<i class="kc-pinm">${svg(IC.pin, 13)}</i>` : ""}${h(nice(q.m.title))}</span>${cells(q.m)}<button class="kc-qa" data-qadd="${i}" aria-label="Hinzufügen">${svg(IC.plus, 18)}</button></div>`).join("")}</div></div>`; }
  const mealCopy = (m, o, items) => ({source: "quick", title: m.title, emoji: m.emoji || "🍽️", kcal: Math.round(o.kcal), carbs: r1(o.carbs), protein: r1(o.protein), fat: r1(o.fat),
    grams: items && items.length === 1 && items[0].g ? Math.round(items[0].g) : m.grams || null, code: (items && items.length === 1 && items[0].code) || m.code || null, items: items || m.items || null, note: m.note || null});
  async function quickAdd(q, btn){ if (!q || (btn && btn.disabled)) return; const m = q.m; if (btn){ btn.disabled = true; btn.classList.add("ok"); } haptic(12);
    try { const r = await K.add(mealCopy(m, m, Array.isArray(m.items) ? m.items : null)); say(`${m.emoji || "🍽️"} ${nice(m.title).slice(0, 30)} · ${brief(r)}`); }
    catch(e) { if (btn){ btn.disabled = false; btn.classList.remove("ok"); } say("Ging nicht: " + (e.message || e)); } }
  /* a suggestion tapped: what it is, how much, add it; pin it so it stays on top */
  function entrySheet(m, opt = {}){
    const parts = partsOf(m), one = parts.length === 1 && parts[0].per ? parts[0] : null;
    const addAs = async (o, items) => { const r = await K.add(mealCopy(m, o, items)); haptic(15); say(`✓ ${nice(m.title).slice(0, 30)} · ${brief(r)}`); };
    if (one) return amountSheet(perP(one), {g: one.g || gramsIn(one.amount) || 0, btn: "Hinzufügen", pin: m, done: async it => addAs(it, [it])});
    let f = 1;
    const sh = detailSheet(`<div class="kc-ms" data-notr><div class="kc-mh"><span class="kc-me">${h(m.emoji || "🍽️")}</span><div><div class="kc-mt">${h(nice(m.title))}</div></div>${pinHTML(m)}</div>
      <div class="kc-ek" id="kcek"></div>${totOK(parts) ? totHTML(parts, "Davon esse ich") : ""}<div class="kc-eit" id="kcei"></div>
      <div class="kc-portion"><span class="muted">Menge</span><div>${[[.5, "½"], [.75, "¾"], [1, "1×"], [1.5, "1½"], [2, "2×"], [3, "3×"]].map(([v, l]) => `<button class="chip ${v === 1 ? "on" : ""}" data-f="${v}">${l}</button>`).join("")}</div></div>
      <button class="btn go big" id="kceadd">Hinzufügen</button>${m.note && m.rid ? `<p class="muted kc-said">${h(m.note)}</p>` : ""}
      ${m.rid && m.ruid === meId() ? `<button class="btn ghost kc-man-b" data-rdel>Mein Rezept wieder entfernen</button>` : ""}</div>`);
    const el = sh.el, T0 = totG(parts), now = () => f === 1 ? parts.map(i => Object.assign({}, i)) : T0 > 0 ? scaleAll(parts, f) : parts.map(i => scalePart(i, f)),
      draw = () => { const ps = now(); const t = sumOf(ps);
        /* calm and lined up: the total like in a saved meal (kcal big, three tiles), the ingredients as one table with the same two columns as the day's list */
        el.querySelector("#kcek").innerHTML = `<div class="kc-mk"><b>${fmt(Math.round(t.kcal))}</b> kcal</div><div class="kc-macros"><span><b>${f1(t.carbs)} g</b>KH</span><span><b>${f1(t.protein)} g</b>Protein</span><span><b>${f1(t.fat)} g</b>Fett</span></div>`;
        el.querySelector("#kcei").innerHTML = `<div class="kc-eih"><span>${ps.length} ${ps.length === 1 ? "Zutat" : "Zutaten"}</span>${heads()}</div>` + ps.map(i => `<div class="kc-eir"><span class="kc-ein"><b>${h(nice(i.name))}</b><small>${h(i.amount || "")}</small></span>${cells(i)}</div>`).join(""); };
    draw(); wirePin(el, m);
    const tg = el.querySelector("[data-tg]"); if (tg) field(tg, v => { if (!(v > 0)) return; f = v / T0; el.querySelectorAll("[data-f]").forEach(x => x.classList.toggle("on", Math.abs(+x.dataset.f - f) < 1e-6)); draw(); });
    el.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { f = +b.dataset.f; haptic(8); el.querySelectorAll("[data-f]").forEach(x => x.classList.toggle("on", x === b)); if (tg) tg.value = nf(T0 * f, 0); draw(); });
    if (opt.focus && tg) try { tg.focus({preventScroll: true}); } catch(e) {}
    const rd = el.querySelector("[data-rdel]"); if (rd) rd.onclick = async () => { if (!rd.dataset.armed){ rd.dataset.armed = 1; rd.textContent = "Wirklich für alle entfernen?"; return; }
      try { await Recipes.del(m.rid); sh.close(); say("Rezept entfernt"); } catch(e) { say("Ging nicht: " + (e.message || e)); } };
    el.querySelector("#kceadd").onclick = async e => { const b = e.currentTarget; if (b.disabled) return; b.disabled = true; const ps = now();
      try { await addAs(sumOf(ps), ps); sh.close(); } catch(err) { b.disabled = false; say("Ging nicht: " + (err.message || err)); } };
    return sh; }
  const setupCard = () => K.on() && !(K.body && K.body.setup_at) ? `<button class="kc-setup-b" data-kc-setup><span>🎯</span><b>Ziele einrichten<small>Gewicht, Größe, Ziel: dein Tagesbedarf und deine Makros</small></b></button>` : "";
  /* the buttons of a summary block (home card and the page) */
  function wireDay(el){
    el.querySelectorAll("[data-kc-go]").forEach(b => b.onclick = () => App.go("kcal"));
    const w = (s2, f) => el.querySelectorAll(s2).forEach(b => b.onclick = f);
    w("[data-kc-say]", () => Voice2.open()); w("[data-kc-scan]", () => KCScan.open()); w("[data-kc-find]", e => Search.open({}, e.currentTarget)); w("[data-kc-fl]", () => iceSheet()); w("[data-kc-setup]", () => Setup.open());
    el.querySelectorAll("[data-qadd]").forEach(b => b.onclick = e => { e.stopPropagation(); quickAdd(QL[+b.dataset.qadd], b); });
    el.querySelectorAll("[data-qi]").forEach(r => { r.onclick = () => { const q = QL[+r.dataset.qi]; if (q){ haptic(8); entrySheet(q.m); } }; r.onkeydown = e => { if (e.key === "Enter") r.onclick(); }; });
  }

  /* ---------- numbers you type: a tap selects all of it, so typing replaces it; the field never jumps while you type ---------- */
  const r1 = x => Math.round((Number(x) || 0) * 10) / 10;
  const num = s => { s = String(s == null ? "" : s).trim().replace(",", "."); const fr = {"¼": .25, "½": .5, "¾": .75}; let m = /^(\d+(?:\.\d+)?)?\s*([¼½¾])$/.exec(s); if (m) return (Number(m[1]) || 0) + fr[m[2]];
    m = /^(\d+)\s*\/\s*(\d+)$/.exec(s); if (m && +m[2]) return +m[1] / +m[2]; const n = parseFloat(s); return isFinite(n) ? n : NaN; };
  const nf = (n, d = 1) => { const k = Math.pow(10, d); return String(Math.round((Number(n) || 0) * k) / k).replace(".", ","); };
  const fracTxt = n => { const w = Math.floor(n + 1e-9), r = Math.round((n - w) * 4); return (w || !r ? String(w || "") : "") + (r === 1 ? "¼" : r === 2 ? "½" : r === 3 ? "¾" : "") || "0"; };
  function field(inp, onNum){ const sel = () => { try { inp.setSelectionRange(0, inp.value.length); } catch(e) { try { inp.select(); } catch(_) {} } };
    inp.addEventListener("focus", () => { sel(); setTimeout(sel, 0); setTimeout(sel, 60); });
    inp.addEventListener("mouseup", e => { if (inp._sel){ inp._sel = 0; e.preventDefault(); } }); inp.addEventListener("mousedown", () => { inp._sel = document.activeElement !== inp; });
    if (onNum) inp.addEventListener("input", () => { const v = num(inp.value); if (isFinite(v)) onNum(v); });
    inp.addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); inp.blur(); } }); }

  /* ---------- a product (Open Food Facts) and how much of it: grams, or portions (½ slice, 2 slices …) ---------- */
  const prodOf = (code, p) => { const n = p.nutriments || {}, per = k => Number(n[k + "_100g"] != null ? n[k + "_100g"] : n[k]) || 0, k100 = per("energy-kcal") || (per("energy") ? per("energy") / 4.184 : 0);
    return {code, name: p.product_name_de || p.product_name || p.generic_name || "Produkt " + code, brand: (Array.isArray(p.brands) ? p.brands[0] || "" : String(p.brands || "").split(",")[0]).trim(), img: p.image_front_small_url || null,
      k: k100, c: per("carbohydrates"), pr: per("proteins"), f: per("fat"), serving: Math.round(Number(p.serving_quantity) || 0), pack: Math.round(Number(p.product_quantity) || 0), ss: String(p.serving_size || "").slice(0, 60),
      /* for the health score: fibre, sugar, saturated fat and salt per 100 g, and the Nutri-Score letter, when the product has them */
      fi: per("fiber"), su: per("sugars"), sf: per("saturated-fat"), sa: per("salt"), ns: /^[a-e]$/.test(String(p.nutriscore_grade || "").toLowerCase()) ? String(p.nutriscore_grade).toLowerCase() : "", hd: "sugars_100g" in n || "fiber_100g" in n || "saturated-fat_100g" in n ? 1 : 0}; };
  const nsQ = ns => ({a: 5, b: 4, c: 3, d: 2, e: 1})[ns] || 0;
  /* ---------- typing in a full-screen layer (iPhone): the field you tap must not end up behind the keyboard ----------
     The sheets from the bottom look after themselves (detailSheet). The full-screen layers didn't: the number field under the barcode
     camera, the fields of the goal questions, the amount under a search result. The iPhone often doesn't say how high the keyboard is,
     so, like the sheets do: a field in the lower half glides into the upper half the moment it is tapped (the layer moves up, or the
     list scrolls), and glides back when typing ends. One movement each way, eased, nothing jumps. */
  (() => { const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); if (!IOS) return;
    const isText = a => !!a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && !/^(checkbox|radio|range|button|file|submit)$/.test(a.type); let t = 0;
    const calm = matchMedia("(prefers-reduced-motion:reduce)").matches;
    const lift = a => { if (!a.isConnected || document.activeElement !== a) return; const H = window.innerHeight, sb = a.closest(".kc-sovb"), ov = a.closest(".kc-ov-full");
      if (sb){ const r = a.getBoundingClientRect(); if (r.bottom <= H * .5) return; /* room to scroll into: an own spacer at the end, so nothing else that sets the list's padding can take it away again */
        if (!sb._kbs){ sb._kbs = document.createElement("div"); sb._kbs.style.cssText = "flex:none;height:" + Math.round(H * .52) + "px"; sb.appendChild(sb._kbs); }
        try { sb.scrollBy({top: r.bottom - H * .44, behavior: calm ? "auto" : "smooth"}); } catch(e) { sb.scrollTop += r.bottom - H * .44; } return; }
      if (!ov) return; const cur = ov._up || 0, nat = a.getBoundingClientRect().bottom + cur, up = Math.max(0, Math.round(nat - H * .46)); if (up === cur) return;
      ov._up = up; ov.style.transition = calm ? "" : "transform .42s cubic-bezier(.22,1,.36,1)"; ov.style.transform = up ? `translateY(${-up}px)` : ""; };
    const drop = () => { document.querySelectorAll(".kc-ov-full").forEach(ov => { if (ov._up){ ov._up = 0; ov.style.transform = ""; } });
      document.querySelectorAll(".kc-sovb").forEach(sb => { if (sb._kbs){ sb._kbs.remove(); sb._kbs = null; } }); };
    document.addEventListener("focusin", e => { const a = e.target; if (!isText(a) || a.closest(".dsheet") || !a.closest(".kc-sovb, .kc-ov-full")) return; clearTimeout(t); t = setTimeout(() => lift(a), 30); });
    document.addEventListener("focusout", () => { clearTimeout(t); t = setTimeout(() => { if (!isText(document.activeElement)) drop(); }, 140); });
  })();
  /* ---------- dry or cooked: noodles, rice, lentils … weigh more once cooked, meat weighs less ----------
     A pack always states the dry (or raw) weight. The food table (data/foods.js) knows the cooking factor of each such food,
     so you can scan the pack and enter what you weighed on the plate: 250 g cooked noodles are 250 ÷ 2.3 = 109 g dry.
     cookOf: is this product such a food? cookP: the same product with its values per 100 g of the state you weighed in. */
  const TAB = (typeof window !== "undefined" && window.KCAL_FOODS) || {list: [], byId: {}};
  const cookOf = P => { const b = (P && P.base) || P; if (!b) return null; if (b.tab) return TAB.byId[b.tab] && TAB.byId[b.tab].cf ? TAB.byId[b.tab] : null;
    const t = String(b.name || ""), k = Number(b.k) || 0; return TAB.list.find(f => f.cf && f.scan && new RegExp(f.scan, "i").test(t) && !(f.not && new RegExp(f.not, "i").test(t)) && (!f.kr || (k >= f.kr[0] && k <= f.kr[1]))) || null; };
  const ckGet = () => { try { const v = localStorage.getItem("chessnat-kc-ck"); return v === "cooked" || v === "dry" ? v : ""; } catch(e) { return ""; } }, ckSet = v => { try { localStorage.setItem("chessnat-kc-ck", v); } catch(e) {} };
  const cookP = (P, mode) => { const b = P.base || P, F = cookOf(b); if (!F) return b; if (mode !== "cooked" && mode !== "dry") return Object.assign({}, b, {base: b, ck: "", cfood: F});
    const nm = b.tab ? {name: F.n + ", " + F.st[mode === "cooked" ? 1 : 0]} : {};
    if (mode === "dry") return Object.assign({}, b, {base: b, ck: "dry", cfood: F}, nm); const d = v => (Number(v) || 0) / F.cf;
    return Object.assign({}, b, nm, {base: b, ck: "cooked", cfood: F, k: d(b.k), c: d(b.c), pr: d(b.pr), f: d(b.f), fi: d(b.fi), su: d(b.su), sf: d(b.sf), sa: d(b.sa), serving: b.serving ? Math.round(b.serving * F.cf) : 0, pack: b.pack ? Math.round(b.pack * F.cf) : 0, ss: ""}); };
  /* the first time you are asked how you weighed; after that your last answer is taken */
  const cookInit = P => { if (!P || P.cfood || !cookOf(P)) return P; return cookP(P, P.ck0 || ckGet()); };
  const cookHTML = P => { if (!P || !P.cfood) return ""; const F = P.cfood, a = F.st[0], b = F.st[1], up = F.cf >= 1;
    return `<div class="kc-ck ${P.ck ? "" : "ask"}"><b>Wie hast du gewogen?</b><div class="kc-ckb"><button class="chip ${P.ck === "cooked" ? "on" : ""}" data-ck="cooked">${up ? "🍝" : "🍳"} ${b}</button><button class="chip ${P.ck === "dry" ? "on" : ""}" data-ck="dry">📦 ${a} (wie in der Packung)</button></div>
      <small class="muted">Die Packung nennt das Gewicht ${a}. 100 g ${a} ${up ? "werden" : "sind"} ${b} etwa ${nf(100 * F.cf, 0)} g${P.ck === "cooked" ? `, also ${fmt((P.base || P).k)} kcal pro 100 g ${a} = ${fmt(P.k)} kcal pro 100 g ${b}` : ""}.</small></div>`; };
  const cookWire = (el, P, again) => el.querySelectorAll("[data-ck]").forEach(b => b.onclick = () => { haptic(8); ckSet(b.dataset.ck); again(cookP(P, b.dataset.ck)); });
  /* the foods of the table show up in the search too, before the products: "Nudeln, gekocht" has one value for everybody */
  const tabP = (F, cooked) => { const base = {tab: F.id, code: null, name: F.n, brand: F.src ? "Open Food Facts · Mittel aus " + F.src.n + " Produkten" : "Standardwert", img: null, k: F.k, c: F.c, pr: F.p, f: F.f, fi: F.fi, su: F.su, sf: F.sf, sa: 0, ns: "", hd: 1, q: F.q, serving: 0, pack: 0, ss: ""}; return F.cf ? cookP(base, cooked ? "cooked" : "dry") : base; };
  const tabSrc = id => { const F = TAB.byId[id]; return F && F.src ? "Open Food Facts: Mittel aus " + F.src.n + " Produkten der Kategorie " + F.src.cat : "Standardwerte aus der Nährwert-Tabelle"; };
  const tabFind = v => { const norm = t => String(t).toLowerCase().trim(), q = norm(v).replace(/\b(gekochte[rsn]?|gebratene[rsn]?|trockene?|rohe[rsn]?|ungekochte[rsn]?)\b/g, "").trim(), dry = /trocken|roh|ungekocht/.test(norm(v)); if (q.length < 2) return [];
    const hit = TAB.list.filter(F => new RegExp("^(" + F.al + ")$", "i").test(q)).concat(TAB.list.filter(F => !new RegExp("^(" + F.al + ")$", "i").test(q) && (norm(F.n).startsWith(q) || new RegExp("^(" + F.al + ")", "i").test(q) && q.length >= 4))).slice(0, 3);
    return hit.flatMap(F => F.cf ? (dry ? [tabP(F, false), tabP(F, true)] : [tabP(F, true), tabP(F, false)]) : [tabP(F)]); };
  const hOf = (P, f) => P.hd || P.ns ? Object.assign({fi: r1((P.fi || 0) * f), su: r1((P.su || 0) * f), sf: r1((P.sf || 0) * f), sa: Math.round((P.sa || 0) * f * 100) / 100}, P.hd ? {} : {nq: 1}, P.q ? {q: P.q} : nsQ(P.ns) ? {q: nsQ(P.ns)} : {}) : null;
  /* pieces instead of grams where that's how you count it: 1 Ei, 2 Eier; 1 Scheibe; else the product's portion */
  const UW = [[/^(scheiben?|slices?)$/i, "Scheibe", "Scheiben"], [/^(stücke?|stk\.?|st\.|pieces?|pcs?)$/i, "Stück", "Stück"], [/^(riegel|bars?)$/i, "Riegel", "Riegel"], [/^(becher|pots?)$/i, "Becher", "Becher"],
    [/^(ei|eier|eggs?)$/i, "Ei", "Eier"], [/^(keks|kekse|cookies?|biscuits?)$/i, "Keks", "Kekse"], [/^(brötchen|rolls?)$/i, "Brötchen", "Brötchen"], [/^(flaschen?|bottles?)$/i, "Flasche", "Flaschen"], [/^(dosen?|cans?)$/i, "Dose", "Dosen"],
    [/^(tafeln?)$/i, "Tafel", "Tafeln"], [/^(kugeln?|scoops?)$/i, "Kugel", "Kugeln"], [/^(tassen?|cups?)$/i, "Tasse", "Tassen"], [/^(glas|gläser|glass(es)?)$/i, "Glas", "Gläser"], [/^(beutel|tüten?|packungen?|packs?)$/i, "Packung", "Packungen"]];
  const PIECE = [[/(^|[^a-zäöüß])eier?\b|eier\b|\beggs?\b/i, 60, "Ei", "Eier", /likör|nudel|spätzle|teigwar|pasta|noodle|salat|waffel|kuchen/i], [/brötchen|semmel|schrippe|\bweck(le|erl)?\b|baguettebrötchen/i, 60, "Brötchen", "Brötchen"],
    [/croissant/i, 60, "Croissant", "Croissants"], [/brezel|\bbreze\b/i, 80, "Brezel", "Brezeln", /stange|sticks?|chips|mini/i], [/banane/i, 120, "Banane", "Bananen", /chips|saft|shake|milch|brot/i], [/apfel|äpfel/i, 150, "Apfel", "Äpfel", /saft|mus|essig|schorle|chips|kuchen|strudel|ringe/i],
    [/\bkiwi/i, 75, "Kiwi", "Kiwis", /saft/i], [/mandarine|clementine/i, 60, "Stück", "Stück", /saft|dose/i], [/toast|sandwich/i, 25, "Scheibe", "Scheiben"], [/(voll|roggen|dinkel|bauern|misch|sauerteig|körner|schwarz)brot\b|\bbrot\b/i, 45, "Scheibe", "Scheiben", /brötchen|chips|aufstrich|krümel|panier/i]];
  function unitOf(P){ if (!P) return null; const s0 = Number(P.serving) || 0;
    const m = /^\s*(\d+(?:[.,]\d+)?|½|¼)?\s*([A-Za-zÄÖÜäöüß.]+)[^(\d]*\(?\s*(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i.exec(String(P.ss || ""));
    if (m){ const w = UW.find(u => u[0].test(m[2])), n = m[1] ? num(m[1]) : 1, g = num(m[3]); if (w && n > 0 && g > 0) return {g: Math.round(g / n * 10) / 10, one: w[1], many: w[2]}; }
    const t = String(P.name || "");
    for (const [re, g, one, many, ex] of PIECE) if (re.test(t) && !(ex && ex.test(t))) return {g: s0 >= g * .5 && s0 <= g * 1.7 ? s0 : g, one, many};
    return s0 ? {g: s0, one: "Portion", many: "Portionen"} : null; }
  const cntTxt = (U, g) => { if (!U) return ""; const n = g / U.g; return n >= .25 && Math.abs(n - Math.round(n * 4) / 4) < .01 ? fracTxt(n) + " " + (n > 1 ? U.many : U.one) : ""; };
  const amtText = (P, g) => { const c = cntTxt(unitOf(P), g); return (c ? c + " · " : "") + nf(g, g < 10 ? 1 : 0) + " g"; };
  /* a part of a meal made from a product keeps the values per 100 g, so its amount can be changed later */
  const itemOf = (P, g) => { const f = g / 100, stn = P.ck && P.cfood ? P.cfood.st[P.ck === "cooked" ? 1 : 0] : ""; return {name: P.name + (P.brand && !P.tab ? " (" + P.brand + ")" : ""), amount: amtText(P, g) + (stn && !new RegExp(stn + "$").test(P.name) ? " " + stn : ""), kcal: Math.round(P.k * f), carbs: r1(P.c * f), protein: r1(P.pr * f), fat: r1(P.f * f), code: P.code || null, g, h: hOf(P, f),
    per: {n: P.name, b: P.brand || "", k: P.k, c: P.c, pr: P.pr, f: P.f, s: P.serving || 0, pk: P.pack || 0, img: P.img || null, ss: P.ss || "", fi: P.fi || 0, su: P.su || 0, sf: P.sf || 0, sa: P.sa || 0, ns: P.ns || "", hd: P.hd ? 1 : 0, ...(P.ck ? {ck: P.ck, cf: P.cfood.cf} : {}), ...(P.tab ? {tab: P.tab, q: P.q} : {})}}; };
  const perP = it => ({code: it.code || null, name: it.per.n, brand: it.per.b, img: it.per.img, k: it.per.k, c: it.per.c, pr: it.per.pr, f: it.per.f, serving: it.per.s, pack: it.per.pk, ss: it.per.ss || "", fi: it.per.fi || 0, su: it.per.su || 0, sf: it.per.sf || 0, sa: it.per.sa || 0, ns: it.per.ns || "", hd: it.per.hd ? 1 : 0});
  function amountSheet(P, opt = {}){
    P = cookInit(P);
    const U = unitOf(P), s = U ? U.g : 0, chips = [30, 50, 100, 150, 200, 250].map(v => [v, v + " g"]); if (P.pack && P.pack <= 3000 && P.pack !== s) chips.push([P.pack, "Packung"]);
    let g = opt.g || s || 100;
    const sh = detailSheet(`<div class="kc-prod" data-notr><div class="kc-ph">${P.img ? `<img src="${h(P.img)}" alt="">` : `<span>📦</span>`}<div><div class="kc-mt">${h(P.name)}</div><div class="muted">${h(P.brand || "")}</div></div>${opt.pin ? pinHTML(opt.pin) : ""}</div>
      <p class="muted kc-per">pro 100 g${P.ck && P.cfood ? " " + P.cfood.st[P.ck === "cooked" ? 1 : 0] : ""}: ${fmt(P.k)} kcal · ${f1(P.c)} g KH · ${f1(P.pr)} g Protein · ${f1(P.f)} g Fett</p>${cookHTML(P)}
      ${s ? `<div class="kc-amt"><span class="kc-al">${U.many} <small class="muted">à ${nf(s, 0)} g</small></span><div class="kc-gram"><button class="btn" data-pd="-1">−</button><label><input id="kcn" inputmode="decimal" autocomplete="off" enterkeyhint="done"> ×</label><button class="btn" data-pd="1">+</button></div>
        <div class="kc-chips">${[[.25, "¼"], [.5, "½"], [1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"]].filter(x => !(U.one === "Ei" && x[0] < .5)).map(([v, l]) => `<button class="chip" data-n="${v}">${l}</button>`).join("")}</div></div>` : ""}
      <div class="kc-amt"><span class="kc-al">Gramm</span><div class="kc-gram"><button class="btn" data-d="-1">−</button><label><input id="kcg" inputmode="decimal" autocomplete="off" enterkeyhint="done"> g</label><button class="btn" data-d="1">+</button></div>
        <div class="kc-chips">${chips.map(([v, l]) => `<button class="chip" data-g="${v}">${l}</button>`).join("")}</div></div>
      <div class="kc-mk" id="kcpk"></div><button class="btn go big" id="kcadd">${h(opt.btn || "Eintragen")}</button></div>`);
    const el = sh.el, gi = el.querySelector("#kcg"), ni = el.querySelector("#kcn");
    const show = from => { const f = g / 100; if (from !== "g") gi.value = nf(g, g < 10 ? 1 : 0); if (ni && from !== "n") ni.value = nf(g / s, 2);
      el.querySelector("#kcpk").innerHTML = vline(P2o(P, f));
      el.querySelectorAll("[data-g]").forEach(c => c.classList.toggle("on", Math.abs(+c.dataset.g - g) < .05)); el.querySelectorAll("[data-n]").forEach(c => c.classList.toggle("on", Math.abs(+c.dataset.n * s - g) < .05)); };
    const setG = (v, from) => { g = Math.max(.5, Math.min(5000, Math.round(v * 10) / 10)); show(from); };
    show();
    field(gi, v => { if (v > 0) setG(v, "g"); }); gi.addEventListener("blur", () => show());
    if (ni){ field(ni, v => { if (v > 0) setG(v * s, "n"); }); ni.addEventListener("blur", () => show()); }
    el.querySelectorAll("[data-g]").forEach(c => c.onclick = () => { haptic(8); setG(+c.dataset.g); });
    el.querySelectorAll("[data-n]").forEach(c => c.onclick = () => { haptic(8); setG(+c.dataset.n * s); });
    el.querySelectorAll("[data-d]").forEach(b => b.onclick = () => { const st = g >= 50 ? 10 : 5; setG(+b.dataset.d > 0 ? Math.floor(g / st + 1e-6) * st + st : g <= st ? Math.max(1, g - 1) : Math.ceil(g / st - 1e-6) * st - st); });
    el.querySelectorAll("[data-pd]").forEach(b => b.onclick = () => { const n = g / s, up = +b.dataset.pd > 0, q = up ? (n < 1 ? Math.floor(n * 4 + 1e-6) / 4 + .25 : Math.floor(n + 1e-6) + 1) : (n <= 1 ? Math.max(.25, Math.ceil(n * 4 - 1e-6) / 4 - .25) : Math.ceil(n - 1e-6) - 1); setG(q * s); });
    if (opt.pin) wirePin(el, opt.pin);
    /* dry or cooked: the sheet comes up again with the values of that state; the grams you typed stay */
    cookWire(el, P, P2 => { sh.close(); amountSheet(P2, Object.assign({}, opt, {g: opt.g || (gi.value ? g : 0)})); });
    el.querySelector("#kcadd").onclick = async () => { const b = el.querySelector("#kcadd"); if (b.disabled) return; if (P.cfood && !P.ck){ say("Erst oben wählen: " + P.cfood.st[1] + " oder " + P.cfood.st[0] + " gewogen?"); const c = el.querySelector(".kc-ck"); if (c){ c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake"); } return; } b.disabled = true; recent(P.base || P);
      try { await opt.done(itemOf(P, g), g); sh.close(); } catch(e) { b.disabled = false; say("Ging nicht: " + (e.message || e)); } };
    return sh;
  }
  /* a product picked from the scan or the search becomes a new meal */
  const addProduct = (P, src) => amountSheet(P, {done: async it => { const m = await K.add({source: src || "barcode", code: it.code, grams: Math.round(it.g), title: P.name.slice(0, 80), emoji: "📦", kcal: it.kcal, carbs: it.carbs, protein: it.protein, fat: it.fat, items: [it], note: P.tab ? tabSrc(P.tab) : "Nährwerte von Open Food Facts"});
    haptic(15); say(`📦 ${brief(m)} eingetragen`); }});

  /* a product from Open Food Facts by its barcode (kept on the phone once seen) */
  async function offGet(code, ms){
    let p = null; try { p = JSON.parse(localStorage.getItem("chessnat-off-" + code) || "null"); } catch(e) {}
    if (p) return p;
    try { const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms || 6000);
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_de,generic_name,brands,nutriments,serving_quantity,serving_size,image_front_small_url,product_quantity,nutriscore_grade`, {signal: ctl.signal});
      clearTimeout(to); const j = await r.json(); if (j && j.status !== 0 && j.product && j.product.nutriments) p = j.product;
      if (p) try { localStorage.setItem("chessnat-off-" + code, JSON.stringify(p)); } catch(e) {}
    } catch(e) {}
    return p;
  }
  /* ---------- search: type a name (Open Food Facts via /api/food), pick the product, say how much ---------- */
  const RK = "chessnat-kcal-recent";
  const recents = () => { try { return JSON.parse(localStorage.getItem(RK) || "[]"); } catch(e) { return []; } };
  function recent(P){ try { const key = P.code || P.name, l = recents().filter(x => (x.code || x.name) !== key); l.unshift({code: P.code || null, name: P.name, brand: P.brand || "", img: P.img || null, k: P.k, c: P.c, pr: P.pr, f: P.f, serving: P.serving || 0, pack: P.pack || 0, ss: P.ss || ""}); localStorage.setItem(RK, JSON.stringify(l.slice(0, 12))); } catch(e) {} }
  /* the search fills the screen: the field glides up from where it was tapped, the keyboard is already open,
     results come while typing (kcal and carbs per 100 g); tapping one opens how much right there, one more tap adds it */
  const Search = {
    open(opt = {}, from){
      if (!meId()) return say("Bitte erst anmelden");
      const ov = document.createElement("div"); ov.className = "kc-sov"; ov.setAttribute("data-notr", "");
      ov.innerHTML = `<div class="kc-sovt"><div class="kc-sq">${svg(IC.search, 18)}<input id="kcq" type="search" enterkeyhint="search" placeholder="${h(opt.title || "Lebensmittel suchen …")}" autocomplete="off" autocorrect="off" value="${h(opt.q || "")}"></div><button class="kc-sx" id="kcsx">Abbrechen</button></div>
        <div class="kc-sovb" id="kcsovb"><div class="kc-sr" id="kcsr"></div><button class="btn ghost kc-man-b" id="kcsm">${svg(IC.plus, 16)} Selbst eintragen</button></div>`;
      document.body.appendChild(ov); document.documentElement.classList.add("kc-sopen");
      const q = ov.querySelector("#kcq"), out = ov.querySelector("#kcsr"), body = ov.querySelector("#kcsovb"); let seq = 0, tmr = 0, list = [], busy = 0, closed = false;
      /* the keyboard opens in the same tap (iPhone only allows that), then the field glides from where the bar was to the top */
      if (!opt.q){ try { q.focus({preventScroll: true}); } catch(e) {} }
      if (from && from.getBoundingClientRect && ov.animate){ const r = from.getBoundingClientRect(), sq = ov.querySelector(".kc-sq"), r2 = sq.getBoundingClientRect();
        /* one soft move: the bar itself lifts off (its place on the page is hidden meanwhile), travels up and narrows on the way,
           the dark background and "Abbrechen" fade in behind it */
        try { const E = "cubic-bezier(.22,1,.36,1)", D = 560; from.style.visibility = "hidden"; ov._from = from;
          sq.animate([{transform: `translate(${r.left - r2.left}px,${r.top - r2.top}px)`, width: r.width + "px"}, {transform: "none", width: r2.width + "px"}], {duration: D, easing: E});
          ov.querySelector(".kc-sx").animate([{opacity: 0, transform: "translateX(14px)"}, {opacity: 0, transform: "translateX(14px)", offset: .35}, {opacity: 1, transform: "none"}], {duration: D, easing: "ease-out"});
          ov.animate([{backgroundColor: "rgba(20,19,17,0)"}, {backgroundColor: "rgba(20,19,17,1)"}], {duration: 380, easing: "ease-out"}); body.animate([{opacity: 0, transform: "translateY(22px)"}, {opacity: 1, transform: "none"}], {duration: 420, delay: 160, easing: E, fill: "backwards"}); } catch(e) {} }
      /* always exactly the visible part of the screen, the keyboard never covers a result */
      /* the search covers the whole screen (also behind the keyboard, which is see-through on the iPhone); the list ends above the keyboard */
      const vv = window.visualViewport, fit = () => { if (!vv || closed) return; const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); body.style.paddingBottom = (kb + 24) + "px"; ov.style.transform = vv.offsetTop ? `translateY(${vv.offsetTop}px)` : ""; };
      if (vv){ vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit); } fit();
      const close = () => { if (closed) return; closed = true; if (vv){ vv.removeEventListener("resize", fit); vv.removeEventListener("scroll", fit); } try { q.blur(); } catch(e) {} document.documentElement.classList.remove("kc-sopen"); if (ov._from) ov._from.style.visibility = "";
        if (ov.animate){ const an = ov.animate([{opacity: 1}, {opacity: 0}], {duration: 160, easing: "ease-in"}); an.onfinish = () => ov.remove(); } else ov.remove(); };
      ov.querySelector("#kcsx").onclick = () => { haptic(6); close(); };
      /* nothing typed yet: a tap on the dark area closes it again */
      ov.addEventListener("click", e => { if (q.value.trim() || e.target.closest("button,input,.kc-sovt,.kc-sadd")) return; close(); });
      ov.querySelector("#kcsm").onclick = () => { close(); (opt.manual || manual)(q.value.trim()); };
      const per = P => { const S = shows(), o = P2o(P), k0 = S[0]; return `<b>${k0 === "kcal" ? fmt(o.kcal) : f1(o[k0])}<small>${k0 === "kcal" ? "kcal" : "g " + NUT[k0].s}</small>${S.slice(1).map(k => `<small class="${NUT[k].c}">${one1(o, k)}</small>`).join("")}</b>`; };
      const row = (P, i) => { const U = unitOf(P), ut = U && U.one !== "Portion" ? `1 ${U.one} ≈ ${nf(U.g, 0)} g` : P.serving ? `Portion ${P.serving} g` : "";
        return `<button class="kc-sres" data-i="${i}">${P.img ? `<img src="${h(P.img)}" alt="" loading="lazy">` : `<span class="kc-sph">📦</span>`}<span class="kc-sn">${h(P.name)}<small>${h(P.brand || "")}${ut ? `${P.brand ? " · " : ""}${ut}` : ""}</small></span>${per(P)}</button>`; };
      /* recipes people published stand above the products; a tap opens the recipe with the gram field ready */
      let recs = [];
      const rrow = (R, i) => `<button class="kc-sres" data-rc="${i}"><span class="kc-sph kc-srec">${h(R.emoji || "🍽️")}</span><span class="kc-sn">${h(R.name)}<small>Rezept${R.author ? " von " + h(R.author) : ""} · ${(R.items || []).length} Zutaten · ${fmt(Math.round(R.grams))} g</small></span>${per(Recipes.per(R))}</button>`;
      const draw = (l, head) => { list = l; out.innerHTML = (recs.length ? `<div class="kc-sh muted">Rezepte <span>pro 100 g</span></div>` + recs.map(rrow).join("") : "") + (l.length ? (head ? `<div class="kc-sh muted">${head} <span>pro 100 g</span></div>` : `<div class="kc-sh muted">${recs.length ? "Produkte " : ""}<span>pro 100 g</span></div>`) + l.map(row).join("") : "");
        out.querySelectorAll("[data-i]").forEach(b => b.onclick = () => pick(list[+b.dataset.i], b)); out.querySelectorAll("[data-rc]").forEach(b => b.onclick = () => { const R = recs[+b.dataset.rc]; if (!R) return; haptic(10); close(); entrySheet(Recipes.asMeal(R), {focus: true}); }); };
      const empty = () => { const r = recents(), my = seq; recs = []; if (r.length) draw(r, "Zuletzt"); else out.innerHTML = `<p class="muted kc-sh">Tipp den Namen ein, z. B. Eier, Toast, Nutella.</p>`;
        if (!opt.pick) Recipes.find("").then(R => { if (closed || my !== seq || !R.length || q.value.trim().length >= 2) return; recs = R; draw(recents(), "Zuletzt"); }); };
      const go = async () => { const v = q.value.trim(), my = ++seq; if (v.length < 2) return empty(); out.classList.add("busy");
        try { const rq = opt.pick ? Promise.resolve([]) : Recipes.find(v), r = await fetch("/api/food?q=" + encodeURIComponent(v)).catch(e => e), j = r && r.json ? await r.json().catch(() => ({})) : {}, R = await rq; if (my !== seq) return; recs = R;
          /* the foods of the table come first ("Nudeln, gekocht" is the same for everybody), then the products */
          const loc = tabFind(v);
          if (!r.ok || !Array.isArray(j.items)){ if (R.length || loc.length) return draw(loc); throw new Error(j.error || (r.ok === false ? "Suche gerade nicht erreichbar" : "Keine Verbindung")); }
          if (!j.items.length && !R.length && !loc.length) out.innerHTML = `<p class="muted kc-sh">Nichts gefunden. Anders schreiben oder selbst eintragen.</p>`; else draw(loc.concat(j.items)); }
        catch(e) { if (my === seq) out.innerHTML = `<p class="muted kc-sh">⚠️ ${h(e.message || "Keine Verbindung")}</p>`; }
        finally { if (my === seq) out.classList.remove("busy"); } };
      q.oninput = () => { clearTimeout(tmr); tmr = setTimeout(go, 320); };
      q.onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); clearTimeout(tmr); go(); q.blur(); } };
      /* tapped a product: how much, right under it (the portion size comes from the product itself) */
      let pickG = 0;
      const pick = async (P, b) => { if (busy) return; haptic(10);
        if (b.classList.contains("open")){ b.classList.remove("open"); const nx = b.nextElementSibling; if (nx && nx.classList.contains("kc-sadd")) nx.remove(); return; }
        busy = 1; b.classList.add("load");
        if (P.code && !P.serving && !P.ss && !unitOf(P)){ const full = await Promise.race([offGet(P.code, 3000), new Promise(r => setTimeout(r, 3200))]); if (full){ const F = prodOf(P.code, full); P = Object.assign({}, P, {serving: F.serving || P.serving, pack: F.pack || P.pack, img: P.img || F.img, ss: F.ss || P.ss || ""}); } }
        busy = 0; b.classList.remove("load"); if (closed) return;
        if (opt.pick){ close(); opt.pick(P); return; }
        out.querySelectorAll(".kc-sres.open").forEach(x => { x.classList.remove("open"); const nx = x.nextElementSibling; if (nx && nx.classList.contains("kc-sadd")) nx.remove(); });
        try { q.blur(); } catch(e) {} b.classList.add("open");
        P = cookInit(P);
        const U = unitOf(P), u = U ? U.g : 0; let g = pickG || u || 100; pickG = 0;
        /* counted in pieces where that's natural: 1 Ei, 2 Eier, 3 Eier … (and 100 g for comparing) */
        const chips = U ? [...(U.one === "Ei" ? [] : [[u / 2, "½ " + U.one]]), [u, "1 " + U.one], [u * 2, "2 " + U.many], [u * 3, "3 " + U.many], ...(U.one === "Portion" ? [] : [[u * 4, "4 " + U.many]]), ...(Math.abs(u - 100) > 1 && u * 4 !== 100 ? [[100, "100 g"]] : [])]
          : [[50, "50 g"], [100, "100 g"], [150, "150 g"], [200, "200 g"], [250, "250 g"]];
        const pn = document.createElement("div"); pn.className = "kc-sadd";
        pn.innerHTML = `${cookHTML(P)}<div class="kc-chips">${chips.map(([v, l]) => `<button class="chip" data-g="${v}">${l}</button>`).join("")}</div>
          <div class="kc-srow"><div class="kc-gram"><button class="btn" data-d="-1">−</button><label><input inputmode="decimal" autocomplete="off" enterkeyhint="done"> g</label><button class="btn" data-d="1">+</button></div></div>
          <div class="kc-sk" id="kcsk"></div><button class="btn go big" data-add>Hinzufügen</button>`;
        b.after(pn); const gi = pn.querySelector("input");
        const show = from2 => { const f = g / 100, c = cntTxt(U, g); if (from2 !== "g") gi.value = nf(g, g < 10 ? 1 : 0); pn.querySelector("#kcsk").innerHTML = (c ? `<em>${c}</em>` : "") + vline(P2o(P, f));
          pn.querySelectorAll("[data-g]").forEach(c => c.classList.toggle("on", Math.abs(+c.dataset.g - g) < .05)); };
        const setG = (v, from2) => { g = Math.max(.5, Math.min(5000, Math.round(v * 10) / 10)); show(from2); };
        show(); field(gi, v => { if (v > 0) setG(v, "g"); }); gi.addEventListener("blur", () => show());
        pn.querySelectorAll("[data-g]").forEach(c => c.onclick = () => { haptic(6); setG(+c.dataset.g); });
        /* − / + : one piece at a time (½ below one), or grams when there are no pieces */
        pn.querySelectorAll("[data-d]").forEach(x => x.onclick = () => { haptic(6); const up = +x.dataset.d > 0;
          if (U){ const n = g / u, q2 = up ? (n < 1 ? Math.floor(n * 2 + 1e-6) / 2 + .5 : Math.floor(n + 1e-6) + 1) : (n <= 1 ? Math.max(.5, Math.ceil(n * 2 - 1e-6) / 2 - .5) : Math.ceil(n - 1e-6) - 1); return setG(q2 * u); }
          const st = g >= 50 ? 10 : 5; setG(up ? Math.floor(g / st + 1e-6) * st + st : g <= st ? Math.max(1, g - 1) : Math.ceil(g / st - 1e-6) * st - st); });
        cookWire(pn, P, P2 => { pickG = g; b.classList.remove("open"); pn.remove(); pick(P2, b); });
        pn.querySelector("[data-add]").onclick = async e2 => { const ab = e2.currentTarget; if (ab.disabled) return; if (P.cfood && !P.ck){ say("Erst wählen: " + P.cfood.st[1] + " oder " + P.cfood.st[0] + " gewogen?"); const c = pn.querySelector(".kc-ck"); if (c){ c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake"); } return; } ab.disabled = true; recent(P.base || P); const it = itemOf(P, g);
          try { const m = await K.add({source: "search", code: it.code, grams: Math.round(g), title: P.name.slice(0, 80), emoji: "📦", kcal: it.kcal, carbs: it.carbs, protein: it.protein, fat: it.fat, items: [it], note: P.tab ? tabSrc(P.tab) : "Nährwerte von Open Food Facts"});
            haptic(15); close(); say(`✓ ${P.name.slice(0, 30)} · ${brief(m)}`); } catch(err) { ab.disabled = false; say("Ging nicht: " + (err.message || err)); } };
        requestAnimationFrame(() => { try { pn.scrollIntoView({block: "nearest", behavior: "smooth"}); } catch(e) {} }); };
      if (q.value.trim().length >= 2) go(); else empty();
      return {close};
    }
  };

  /* ---------- a meal and its parts: every part can be changed, swapped for the real product (barcode or search), or removed ---------- */
  const partsOf = m => Array.isArray(m.items) && m.items.length ? m.items.map(i => Object.assign({}, i)) : [{name: m.title, amount: m.grams ? m.grams + " g" : "", kcal: m.kcal || 0, carbs: m.carbs || 0, protein: m.protein || 0, fat: m.fat || 0, code: m.code || null, g: m.grams || null}];
  async function saveParts(m, parts){ const sum = k => parts.reduce((s, i) => s + (Number(i[k]) || 0), 0), one = parts.length === 1 ? parts[0] : null;
    /* one part: the meal is called like it (the product's name without the brand) */
    const title = one && (!Array.isArray(m.items) || m.items.length <= 1) ? (one.per && one.per.n) || one.name : m.title;
    return K.update(m.id, {items: parts, kcal: Math.round(sum("kcal")), carbs: r1(sum("carbs")), protein: r1(sum("protein")), fat: r1(sum("fat")), title: String(title || m.title || "Mahlzeit").slice(0, 120), grams: one && one.g ? Math.round(one.g) : null, code: (one && one.code) || null}); }
  const scalePart = (i, f) => { const o = Object.assign({}, i, {kcal: Math.round((Number(i.kcal) || 0) * f), carbs: r1(i.carbs * f), protein: r1(i.protein * f), fat: r1(i.fat * f)});
    if (i.h) o.h = Object.assign({}, i.h, {fi: r1((i.h.fi || 0) * f), su: r1((i.h.su || 0) * f), sf: r1((i.h.sf || 0) * f), sa: Math.round((i.h.sa || 0) * f * 100) / 100});
    if (i.per && i.g){ o.g = Math.round(i.g * f * 10) / 10; o.amount = amtText(perP(i), o.g); } else { /* no weight: the count itself moves ("2 Scheiben" → "1 Scheiben"), an earlier "×" is folded in */
      const t = String(i.amount || ""), x = /^(.*?)\s*×\s*(\d+(?:[.,]\d+)?)$/.exec(t), n = /^(\d+(?:[.,]\d+)?)(\s+\S.*)$/.exec(x ? x[1] : t), k = f * (x ? num(x[2]) : 1);
      o.amount = n ? nf(num(n[1]) * k, 2) + n[2] : (x ? x[1] : t) + (Math.abs(k - 1) < 1e-9 ? "" : ` ×${nf(k, 2)}`); } return o; };
  /* a number that travels to its new value instead of jumping: counts up or down and nudges in that direction, tinted for a moment */
  function tweenNum(el, to, show, dur = 520){ if (!el) return; to = Number(to) || 0; const from = el._cur != null ? el._cur : el._v != null ? el._v : to; el._v = to; cancelAnimationFrame(el._raf);
    if (Math.abs(from - to) < 1e-9 || matchMedia("(prefers-reduced-motion:reduce)").matches){ el._cur = to; el.textContent = show(to); return; }
    el.classList.remove("kc-up", "kc-dn"); void el.offsetWidth; el.classList.add(to > from ? "kc-up" : "kc-dn"); const t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el._cur = from + (to - from) * e; el.textContent = show(el._cur); if (k < 1) el._raf = requestAnimationFrame(step); else { el._cur = to; el.textContent = show(to); } };
    el._raf = requestAnimationFrame(step); }
  /* the day's boxes: after a redraw the numbers and bars run from what stood there before to what is true now */
  const SUMV = {};
  function animSum(root){ if (!root) return; root.querySelectorAll("[data-cnt]").forEach(el => { const k = el.dataset.cnt, to = Number(el.dataset.v) || 0, was = SUMV[k]; SUMV[k] = to; if (was == null || was === to) return; el._v = was; el.textContent = fmt(Math.round(was)); tweenNum(el, to, x => fmt(Math.round(x)), 700); });
    root.querySelectorAll("[data-bar]").forEach(u => { const k = "b" + u.dataset.bar, to = u.style.width, was = SUMV[k]; SUMV[k] = to; if (was == null || was === to) return; u.style.transition = "none"; u.style.width = was; void u.offsetWidth; u.style.transition = "width .7s cubic-bezier(.22,1,.36,1)"; u.style.width = to; }); }
  /* ---------- the health score: one number from 0 to 100 for a day ----------
     Amount (35): calories close to the goal; too little counts against you just like too much. Protein (15): reaching the target.
     Fibre (15): 14 g per 1000 kcal. Sugar and saturated fat (15): each under a tenth of the calories. Quality (20): how good the
     foods themselves are (Nutri-Score of products, the estimate for spoken meals). The last three need entries that carry these
     values; when less than half of a day's calories do, the day is judged on amount and protein, the rest counts as average (part: true).
     G is the amount for the "Einhaltung" ranking: the goal reached or passed is 100 %, only too little counts against you */
  const clamp01 = x => Math.max(0, Math.min(1, x));
  function dayHealth(ms, goal, protT){ const kcal = ms.reduce((s, m) => s + (Number(m.kcal) || 0), 0); if (!(kcal > 0) || !(goal > 0)) return null;
    const r = kcal / goal, A = r >= .9 && r <= 1.1 ? 1 : r < .9 ? clamp01((r - .5) / .4) : clamp01((1.5 - r) / .4), G = r >= .9 ? 1 : A, pg = ms.reduce((s, m) => s + (Number(m.protein) || 0), 0), P = clamp01(pg / (protT || goal * .16 / 4));
    let hk = 0, fi = 0, su = 0, sf = 0, qk = 0, qs = 0, nk = 0; ms.forEach(m => (Array.isArray(m.items) ? m.items : []).forEach(i => { const k = Number(i.kcal) || 0, hh = i.h; if (!hh) return; if (!hh.nq){ nk += k; fi += Number(hh.fi) || 0; su += Number(hh.su) || 0; sf += Number(hh.sf) || 0; } if (hh.q){ qk += k; qs += k * hh.q; } hk += k; }));
    if (hk / kcal < .5 || !(nk > 0)) return {s: Math.round(A * 35 + P * 15 + 25), A, G, P, part: true, kc: kcal, pg}; /* what can't be judged counts as average: half of the other 50 points */
    const up = kcal / nk, F = clamp01(fi * up / (14 * goal / 1000)), L = (clamp01((.25 - su * up * 4 / goal) / .15) + clamp01((.2 - sf * up * 9 / goal) / .1)) / 2, Q = qk > 0 ? clamp01((qs / qk - 1) / 4) : L;
    return {s: Math.round(A * 35 + P * 15 + F * 15 + L * 15 + Q * 20), A, G, P, F, L, Q, kc: kcal, pg}; }
  /* the last seven finished days that have entries (today only when there is nothing else) */
  function weekHealth(ms, goal, protT){ const t = today(), by = {}; ms.forEach(m => { (by[m.day] = by[m.day] || []).push(m); });
    let days = Object.keys(by).filter(d => d < t && d >= addDays(t, -7)); if (!days.length) days = by[t] ? [t] : []; const L = days.map(d => dayHealth(by[d], goal, protT)).filter(Boolean); if (!L.length) return null;
    const avg = k => { const v = L.filter(x => x[k] != null); return v.length ? v.reduce((s, x) => s + x[k], 0) / v.length : null; };
    return {s: Math.round(avg("s")), A: avg("A"), G: avg("G"), P: avg("P"), F: avg("F"), L: avg("L"), Q: avg("Q"), kc: avg("kc"), pg: avg("pg"), n: L.length, part: L.every(x => x.part)}; }
  /* the weight or volume in a part: from its text ("2 Scheiben (80 g)", "0,5 l") or, without one, its stored grams */
  const amtOf = i => { const m = /(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l)\b/i.exec(String(i.amount || "")); if (m) return {v: num(m[1]), u: m[2].toLowerCase(), m: m[0]}; return Number(i.g) > 0 ? {v: Number(i.g), u: "g", m: ""} : null; };
  /* the same part with another weight: calories, carbs, protein and fat follow, the text shows the new number */
  const regram = (i, v2) => { const a = amtOf(i); if (!a || !(a.v > 0) || !(v2 > 0)) return i; const f = v2 / a.v, o = scalePart(i, f);
    if (!(i.per && i.g)){ const t = nf(v2, v2 < 10 ? 2 : 0) + " " + a.u; const one = x => nf(x, x < 10 ? 2 : 0); o.amount = a.m ? String(i.amount).replace(/(\d+(?:[.,]\d+)?)(\s*)(kg|g|ml|l)\b/gi, (x, n, sp, u) => x === a.m ? t : one(num(n) * f) + sp + u) : t; if (Number(i.g) > 0) o.g = Math.round(i.g * f * 10) / 10; } return o; };
  /* a dish of several parts and how much of all of it was eaten: the weights add up to the whole (kg and l count as 1000), and a
     new total moves every part by the same share ("230 g of the 1.600 g dessert") */
  const totG = ps => ps.reduce((s, i) => { const a = amtOf(i); return s + (a ? a.v * (a.u === "kg" || a.u === "l" ? 1000 : 1) : 0); }, 0);
  const scaleAll = (ps, f) => ps.map(i => { const a = amtOf(i); return a ? regram(i, a.v * f) : scalePart(i, f); });
  const totOK = ps => ps.length > 1 && totG(ps) > 0;
  const totHTML = (ps, lead) => `<div class="kc-tot"><span>${lead}<small data-tgo>von ${fmt(Math.round(totG(ps)))} g insgesamt</small></span><label class="kc-gi"><input data-tg inputmode="decimal" enterkeyhint="done" value="${nf(totG(ps), 0)}" aria-label="Gegessene Gramm von allem"><i>g</i></label></div>`;
  /* grams in a text like "2 Scheiben (80 g)" */
  const gramsIn = t => { const m = /(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i.exec(String(t || "")); return m ? num(m[1]) : 0; };
  /* ---------- recipes for everyone: a dish of several parts gets a name and is published; everyone signed in finds it in the
     search and only types how many grams of it they eat (table kcal_recipes, supabase/kcal_recipes.sql) ---------- */
  const Recipes = {
    async find(q){ const c = sb(); if (!c || !meId()) return []; q = String(q || "").replace(/[%_\\,()]/g, " ").trim();
      try { let x = c.from("kcal_recipes").select("*").order("created_at", {ascending: false}).limit(q ? 8 : 5); if (q) x = x.ilike("name", "%" + q + "%"); const r = await x; return r.error ? [] : r.data || []; } catch(e) { return []; } },
    async publish(m, name){ const c = sb(); if (!c || !meId()) throw new Error("Bitte anmelden");
      const ps = partsOf(m), T = sumOf(ps), row = {name: String(name).trim().slice(0, 80), emoji: m.emoji || "🍽️", items: ps, grams: Math.round(totG(ps)), kcal: Math.round(T.kcal), carbs: r1(T.carbs), protein: r1(T.protein), fat: r1(T.fat)};
      /* the same name again from the same person: the recipe is replaced */
      const pat = row.name.replace(/[%_\\]/g, "\\$&"), had = await c.from("kcal_recipes").select("id").eq("user_id", meId()).ilike("name", pat).limit(1), id = had.data && had.data[0] && had.data[0].id;
      let r = id ? await c.from("kcal_recipes").update(row).eq("id", id).select().single() : await c.from("kcal_recipes").insert(row).select().single();
      if (!id && r.error && r.error.code === "23505") r = await c.from("kcal_recipes").update(row).eq("user_id", meId()).ilike("name", pat).select().single();
      if (r.error) throw r.error; return r.data; },
    async del(id){ const r = await sb().from("kcal_recipes").delete().eq("id", id); if (r.error) throw r.error; },
    asMeal: R => ({title: R.name, emoji: R.emoji || "🍽️", items: Array.isArray(R.items) ? R.items : [], kcal: R.kcal, carbs: R.carbs, protein: R.protein, fat: R.fat, note: R.author ? "Rezept von " + R.author : "Rezept", rid: R.id, ruid: R.user_id}),
    per: R => { const g = Number(R.grams) || 0, f = g > 0 ? 100 / g : 0; return {k: R.kcal * f, c: R.carbs * f, pr: R.protein * f, f: R.fat * f}; }
  };
  /* an ingredient with checked values: from the fixed table (ref / per.tab), the checked database (food) or a real product (barcode).
     Only such ingredients may go into a recipe for everyone; what the AI merely estimated may not */
  const isChecked = i => !!(i && (i.ref || i.food || i.code || (i.per && i.per.tab)));
  function recipeSheet(m){ const ps = partsOf(m), T = sumOf(ps), g = totG(ps), bad = ps.filter(i => !isChecked(i)); let sent = false;
    const list = `<div class="kc-items">${ps.map(i => `<div><span>${h(nice(i.name))}<small>${h(i.amount || "")}${isChecked(i) ? "" : ` · <u class="kc-est">nur geschätzt</u>`}</small></span><b>${fmt(i.kcal)} kcal</b></div>`).join("")}</div>`;
    if (bad.length){ const sh = detailSheet(`<div class="kc-form" data-notr><h3>Noch nicht für alle</h3><p class="muted">Ein Rezept für alle darf nur aus Zutaten mit geprüften Werten bestehen. ${bad.length === 1 ? "Eine Zutat ist" : bad.length + " Zutaten sind"} nur geschätzt:</p>${list}
      <p class="muted kc-said">Tipp die Zutat im Gericht an und tausch sie gegen das echte Produkt (Barcode oder Suche). Danach kannst du das Rezept veröffentlichen.</p><button class="btn go big" data-dclose>Zurück zum Gericht</button></div>`, () => setTimeout(() => mealSheet(m), 0)); return sh; }
    const sh = detailSheet(`<div class="kc-form" data-notr><h3>Rezept für alle</h3><p class="muted">Gib dem Ganzen einen Namen. Alle finden es dann in der Suche und tippen nur noch ein, wie viel Gramm sie davon essen.</p>
      <label>Name<input id="kcrn" maxlength="80" enterkeyhint="done" autocomplete="off" autocapitalize="sentences" value="${h(nice(m.title))}"></label>
      ${list}
      <p class="muted kc-said">Das ganze Rezept, so wie es jetzt dasteht: ${fmt(Math.round(g))} g · ${fmt(Math.round(T.kcal))} kcal · ${fmt(Math.round(T.kcal / g * 100))} kcal pro 100 g</p>
      <button class="btn go big" id="kcrp">Veröffentlichen</button></div>`, () => { if (!sent) setTimeout(() => mealSheet(m), 0); });
    const inp = sh.el.querySelector("#kcrn"), b = sh.el.querySelector("#kcrp"); try { inp.focus({preventScroll: true}); inp.setSelectionRange(0, inp.value.length); } catch(e) {}
    const go = async () => { const name = inp.value.trim(); if (name.length < 2){ say("Bitte einen Namen eintippen"); inp.focus(); return; } if (b.disabled) return; b.disabled = true;
      try { const R = await Recipes.publish(m, name); haptic(15); sent = true; sh.close(); say(`📖 „${R.name.slice(0, 30)}“ ist jetzt für alle in der Suche`, 3200);
        /* the meal carries the recipe's name from now on */
        let nm = m; if (R.name !== m.title) try { nm = await K.update(m.id, {title: R.name}); } catch(e) {} mealSheet(nm); }
      catch(e) { b.disabled = false; say("Ging nicht: " + (e.message || e)); } };
    b.onclick = go; inp.addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); go(); } });
    return sh; }
  function mealSheet(m, own = true){
    const items = own ? partsOf(m) : (Array.isArray(m.items) ? m.items : []);
    const sh = detailSheet(`<div class="kc-ms" data-notr><div class="kc-mh"><span class="kc-me">${h(m.emoji || "🍽️")}</span><div><div class="kc-mt">${h(m.title)}</div><div class="muted">${dayLabel(m.day)}, ${hhmm(m.ts)}${m.source === "barcode" ? " · Barcode" : m.source === "search" ? " · Suche" : m.source === "voice" ? " · gesprochen" : ""}</div></div>${own ? pinHTML(m) : ""}</div>
      <div class="kc-mk"><b data-t="kcal">${fmt(m.kcal)}</b> kcal</div>
      <div class="kc-macros"><span><b data-t="carbs">${f1(m.carbs)} g</b>KH</span><span><b data-t="protein">${f1(m.protein)} g</b>Protein</span><span><b data-t="fat">${f1(m.fat)} g</b>Fett</span></div>
      ${own && totOK(items) ? totHTML(items, "Davon gegessen") : ""}
      ${items.length ? `${own ? `<div class="kc-ih muted">Menge antippen und neu eintippen, alles rechnet mit</div>` : ""}<div class="kc-items">${items.map((i, ix) => { const a = own && amtOf(i); return own ? `<div class="kc-irow"><button data-it="${ix}"><span>${h(i.name)}<small data-ra="${ix}">${h(i.amount || "")}</small></span><b data-rk="${ix}">${fmt(i.kcal)} kcal</b>${a ? "" : `<em>${svg(IC.pen, 15)}</em>`}</button>${a ? `<label class="kc-gi"><input data-g="${ix}" inputmode="decimal" enterkeyhint="done" value="${nf(a.v, a.v < 10 ? 2 : 0)}" aria-label="Menge"><i>${a.u}</i></label>` : ""}</div>` : `<div><span>${h(i.name)}<small>${h(i.amount || "")}</small></span><b>${fmt(i.kcal)} kcal</b></div>`; }).join("")}</div>` : ""}
      ${own && items.length ? `<button class="kc-roundb" data-round>${svg(IC.code, 22)}<b>Packungen scannen<small>Für genaue Werte: alles scannen, was du gegessen hast, in beliebiger Reihenfolge</small></b></button>` : ""}
      ${own ? `<button class="btn ghost kc-man-b" data-it="-1">${svg(IC.plus, 16)} Etwas dazu</button>` : ""}
      ${own && totOK(items) ? `<button class="btn ghost kc-man-b" data-pub>📖 Als Rezept für alle speichern</button>` : ""}
      ${m.said ? `<p class="muted kc-said">„${h(m.said)}“</p>` : ""}${m.note ? `<p class="muted kc-said">${h(m.note)}</p>` : ""}
      ${own ? `<div class="kc-portion"><span class="muted">Alles mal</span><div>${[[.5, "½"], [.75, "¾"], [1.25, "1¼"], [1.5, "1½"], [2, "2×"], [3, "3×"]].map(([f, l]) => `<button class="chip" data-f="${f}">${l}</button>`).join("")}</div></div>
      <div class="kc-row2">${m.draft ? `<button class="btn go" data-commit>Passt</button><button class="btn" data-kc-del>Verwerfen</button>` : `<button class="btn go" data-dclose>Passt</button><button class="btn" data-kc-del>Löschen</button>`}</div>${m.draft ? `<p class="muted kc-drn">Noch nicht eingetragen. Erst „Passt“ speichert es.</p>` : ""}` : ""}</div>`);
    /* a draft is entered by "Passt": first let a field that is still being typed in finish, then save what the draft is now */
    { const cb = sh.el.querySelector("[data-commit]"); if (cb) cb.onclick = async () => { if (cb.disabled) return; cb.disabled = true; const E = document.activeElement; if (E && sh.el.contains(E)) try { E.blur(); } catch(e) {}
        await new Promise(r => setTimeout(r, 60)); try { const saved = await K.commit(m.id); sh.close(); haptic(15); say(`✓ ${brief(saved)} eingetragen`); } catch(e) { cb.disabled = false; say("Ging nicht: " + (e.message || e)); } }; }
    if (!own) return sh;
    wirePin(sh.el, m);
    sh.el.querySelectorAll("[data-it]").forEach(b => b.onclick = () => { haptic(8); sh.close(); partSheet(m, +b.dataset.it); });
    /* a new weight typed into the row: with every digit the numbers travel to their new values (5 → way down, 500 → way up);
       leaving the field or OK saves it, the sheet stays as it is */
    { const E = sh.el, q = x => E.querySelector(x), SH = {kcal: x => fmt(Math.round(x)), carbs: x => f1(x) + " g", protein: x => f1(x) + " g", fat: x => f1(x) + " g"};
      const prime = () => { const ps = partsOf(m), T = sumOf(ps); Object.keys(SH).forEach(k => { const el = q(`[data-t="${k}"]`); if (el) el._v = el._cur = T[k]; }); ps.forEach((i, ix) => { const el = q(`[data-rk="${ix}"]`); if (el) el._v = el._cur = Number(i.kcal) || 0; }); }; prime();
      const paint = ps => { const T = sumOf(ps); Object.keys(SH).forEach(k => tweenNum(q(`[data-t="${k}"]`), T[k], SH[k])); ps.forEach((i, ix) => { tweenNum(q(`[data-rk="${ix}"]`), i.kcal, x => fmt(Math.round(x)) + " kcal"); const a = q(`[data-ra="${ix}"]`); if (a && a.textContent !== (i.amount || "")) a.textContent = i.amount || ""; const g = q(`[data-g="${ix}"]`), w = g && amtOf(i); if (w && document.activeElement !== g) g.value = nf(w.v, w.v < 10 ? 2 : 0); });
        const tg = q("[data-tg]"); if (tg && document.activeElement !== tg) tg.value = nf(totG(ps), 0); };
      E.querySelectorAll("[data-g]").forEach(inp => { field(inp); let busy = false, next = null;
        const preview = () => { const ps = partsOf(m), ix = +inp.dataset.g, a = amtOf(ps[ix]), v = num(inp.value); if (!a) return null; if (!isFinite(v) || v <= 0) return null; ps[ix] = regram(ps[ix], v); return ps; };
        inp.addEventListener("input", () => { const ps = preview(); if (ps){ next = ps; paint(ps); } });
        const go = async () => { const a = amtOf(partsOf(m)[+inp.dataset.g]); if (!next){ if (a) inp.value = nf(a.v, a.v < 10 ? 2 : 0); paint(partsOf(m)); return; } if (busy) return; busy = true; const ps = next; next = null;
          try { m = await saveParts(m, ps); haptic(12); } catch(e) { if (a) inp.value = nf(a.v, a.v < 10 ? 2 : 0); paint(partsOf(m)); say("Ging nicht: " + (e.message || e)); } busy = false; if (next) go(); };
        inp.addEventListener("change", go); inp.addEventListener("blur", () => { if (next) go(); }); inp.addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); inp.blur(); } }); });
      /* grams of the whole dish: every part follows by the same share while you type, leaving the field or OK saves it */
      const tg = q("[data-tg]"); if (tg){ field(tg); let busy = false, next = null; const of = q("[data-tgo]"), show = () => { tg.value = nf(totG(partsOf(m)), 0); };
        tg.addEventListener("input", () => { const ps = partsOf(m), T = totG(ps), v = num(tg.value); if (!(T > 0) || !isFinite(v) || v <= 0){ next = null; return; } next = scaleAll(ps, v / T); paint(next); });
        const go = async () => { if (!next){ show(); paint(partsOf(m)); return; } if (busy) return; busy = true; const ps = next; next = null;
          try { m = await saveParts(m, ps); haptic(12); if (of) of.textContent = `von ${fmt(Math.round(totG(partsOf(m))))} g insgesamt`; } catch(e) { show(); paint(partsOf(m)); say("Ging nicht: " + (e.message || e)); } busy = false; if (next) go(); };
        tg.addEventListener("change", go); tg.addEventListener("blur", () => { if (next) go(); }); } }
    const pb = sh.el.querySelector("[data-pub]"); if (pb) pb.onclick = () => { haptic(10); const E = document.activeElement; if (E && sh.el.contains(E)) try { E.blur(); } catch(e) {} sh.close(); recipeSheet(m); };
    const rb = sh.el.querySelector("[data-round]"); if (rb) rb.onclick = () => { haptic(10); sh.close(); KCScan.open({round: m}); };
    sh.el.querySelectorAll("[data-f]").forEach(b => b.onclick = async () => { try { const nm = await saveParts(m, partsOf(m).map(i => scalePart(i, +b.dataset.f))); sh.close(); mealSheet(nm); } catch(e) { say("Ging nicht: " + (e.message || e)); } });
    const del = sh.el.querySelector("[data-kc-del]"); del.onclick = async () => { if (!m.draft && !del.dataset.armed){ del.dataset.armed = 1; del.textContent = "Wirklich löschen?"; return; }
      try { await K.del(m.id); sh.close(); say(m.draft ? "Verworfen" : "Gelöscht"); } catch(e) { say("Ging nicht: " + (e.message || e)); } };
    return sh;
  }
  function partSheet(m, idx){
    const parts = partsOf(m), add = idx < 0, w = add ? {name: "", amount: "", kcal: 0, carbs: 0, protein: 0, fat: 0} : Object.assign({}, parts[idx]);
    /* an older scanned part without the values per 100 g: they are still in this phone's product cache */
    if (!add && !w.per){ const code = w.code || (parts.length === 1 && m.code); if (code) try { const p = JSON.parse(localStorage.getItem("chessnat-off-" + code) || "null"); if (p){ const P = prodOf(code, p); w.per = itemOf(P, 100).per; w.code = code; w.g = w.g || m.grams || gramsIn(w.amount) || null; } } catch(e) {} }
    const KS = [["kcal", "kcal"], ["carbs", "KH g"], ["protein", "Protein g"], ["fat", "Fett g"]];
    const sh = detailSheet(`<div class="kc-form kc-pe" data-notr><h3>${add ? "Etwas dazu" : "Ändern"}</h3>
      <p class="muted kc-pt">${add ? "Produkt suchen oder scannen:" : "Das echte Produkt nehmen:"}</p>
      <div class="kc-rep"><button class="btn" data-rep="scan">${svg(IC.code, 18)} Barcode</button><button class="btn" data-rep="search">${svg(IC.search, 18)} Suchen</button></div>
      ${!add && w.per && w.g ? `<button class="btn kc-amtb" data-rep="amount">Menge ändern <small>${h(w.amount || nf(w.g, 0) + " g")}</small></button>` : ""}
      <p class="muted kc-pt">Oder hier tippen und das echte Produkt aus Open Food Facts antippen:</p>
      <label>Was<input id="kpn" maxlength="80" value="${h(w.name || "")}" placeholder="z. B. Spaghetti Barilla" autocomplete="off" autocorrect="off" enterkeyhint="search"></label><div id="kpsg"></div>
      <label>Menge<input id="kpa" maxlength="60" value="${h(w.amount || "")}" placeholder="z. B. 2 Scheiben"></label>
      <div class="kc-nums">${KS.map(([k, l]) => `<label>${l}<input data-k="${k}" inputmode="decimal" value="${nf(w[k] || 0, k === "kcal" ? 0 : 1)}"></label>`).join("")}</div>
      ${add ? "" : `<div class="kc-portion"><span class="muted">Mal nehmen</span><div>${[[.25, "¼"], [.5, "½"], [2, "2×"], [3, "3×"], [4, "4×"], [5, "5×"]].map(([f, l]) => `<button class="chip" data-f="${f}">${l}</button>`).join("")}</div></div>`}
      <div class="kc-row2"><button class="btn go" id="kps">${add ? "Dazu" : "Speichern"}</button>${add ? "" : `<button class="btn" id="kpd">${parts.length > 1 ? "Entfernen" : "Löschen"}</button>`}</div></div>`);
    const el = sh.el, ins = el.querySelectorAll("[data-k]");
    ins.forEach(i => field(i)); field(el.querySelector("#kpa"));
    const read = () => { w.name = el.querySelector("#kpn").value.trim(); w.amount = el.querySelector("#kpa").value.trim(); ins.forEach(i => { const v = num(i.value); w[i.dataset.k] = isFinite(v) && v >= 0 ? (i.dataset.k === "kcal" ? Math.round(v) : r1(v)) : 0; }); };
    const fill = () => { el.querySelector("#kpa").value = w.amount || ""; ins.forEach(i => { i.value = nf(w[i.dataset.k] || 0, i.dataset.k === "kcal" ? 0 : 1); }); };
    /* a new weight typed into "Menge" (60, 60 g, 0,5 l): the numbers below follow */
    { const pa = el.querySelector("#kpa"); let before = Object.assign({}, w); pa.addEventListener("change", () => { const a = amtOf(before), t = pa.value.trim(), bare = /^\d+(?:[.,]\d+)?$/.test(t), b2 = bare ? {v: num(t), u: a ? a.u : "g"} : amtOf({amount: t});
        if (a && b2 && b2.v > 0 && b2.u === a.u && Math.abs(b2.v - a.v) > 1e-6){ const o = regram(before, b2.v); if (!bare && !(before.per && before.g)) o.amount = t; Object.assign(w, o); fill(); haptic(8); }
        else if (bare && !a){ w.amount = t + " g"; pa.value = w.amount; read(); } else read();
        before = Object.assign({}, w); });
      /* numbers typed by hand become the new base; while a weight is being typed, the numbers already follow, digit by digit */
      ins.forEach(i => i.addEventListener("change", () => { const v = num(i.value); before[i.dataset.k] = isFinite(v) && v >= 0 ? v : 0; }));
      pa.addEventListener("input", () => { const a = amtOf(before), t = pa.value.trim(), bare = /^\d+(?:[.,]\d+)?$/.test(t), b2 = bare ? {v: num(t), u: a ? a.u : "g"} : amtOf({amount: t}); if (!(a && b2 && b2.v > 0 && b2.u === a.u)) return;
        const o = regram(before, b2.v); ins.forEach(i => { const k = i.dataset.k, nv = nf(o[k] || 0, k === "kcal" ? 0 : 1); if (i.value !== nv){ i.value = nv; i.classList.remove("kc-up", "kc-dn"); void i.offsetWidth; i.classList.add(b2.v > a.v ? "kc-up" : "kc-dn"); } }); }); }
    el.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { read(); Object.assign(w, scalePart(w, +b.dataset.f)); fill(); haptic(8); el.querySelectorAll("[data-f]").forEach(x => x.classList.toggle("on", x === b)); });
    const done = async ps => { const nm = await saveParts(m, ps); haptic(15); mealSheet(nm); };
    /* the real product instead: scanned or searched, then how much */
    const swap = P => amountSheet(P, {g: (!add && (w.g || gramsIn(w.amount))) || 0, btn: add ? "Dazu" : "Übernehmen", done: async it => { const ps = partsOf(m); if (add) ps.push(it); else ps[idx] = it; await done(ps); }});
    /* typing into "Was" searches the real products (the food table first, then Open Food Facts); a tap takes that product with its own
       values. The amount stays: if the grams are known the part is replaced at once, otherwise the amount is asked. Something that is
       weighed cooked (noodles, rice …) keeps that: the pack's dry values are converted. Typing a name without picking still works. */
    { const pn = el.querySelector("#kpn"), sg = el.querySelector("#kpsg"); let tm = 0, seq = 0, L = [];
      const said = () => String(w.amount || "") + " " + String(w.name || ""), stOf = () => w.st === "dry" || (w.per && w.per.ck === "dry") || /trocken|\broh|ungekocht/i.test(said()) ? "dry" : w.st === "cooked" || (w.per && w.per.ck === "cooked") || /gekocht|gebraten/i.test(said()) ? "cooked" : "";
      const take = async P => { const st0 = stOf(); w.name = el.querySelector("#kpn").defaultValue; const g = (!add && (w.g || gramsIn(w.amount))) || 0, ck = !!cookOf(P), P2 = ck ? (st0 ? cookP(P, st0) : null) : P; haptic(10); sh.close();
        if (g > 0 && P2){ recent(P.base || P); const ps = partsOf(m); ps[idx] = itemOf(P2, g); try { await done(ps); say("✓ " + String(P.name).slice(0, 30)); } catch(e) { say("Ging nicht: " + (e.message || e)); } }
        else swap(ck && st0 ? Object.assign({}, P, {ck0: st0}) : P); };
      const draw = () => { sg.innerHTML = L.length ? `<div class="kc-shsg kc-psg">${L.map((x, i) => `<button type="button" data-sg="${i}"><b>${h(x.name)}</b><small>${h(x.brand || "")}${x.brand ? " · " : ""}${fmt(x.k)} kcal / 100 g</small><i>›</i></button>`).join("")}</div>` : "";
        sg.querySelectorAll("[data-sg]").forEach(b => b.onclick = () => take(L[+b.dataset.sg])); };
      pn.addEventListener("input", () => { clearTimeout(tm); const v = pn.value.trim(), my = ++seq; if (v.length < 2){ L = []; draw(); return; }
        L = tabFind(v).slice(0, 2); draw();
        tm = setTimeout(async () => { try { const r = await fetch("/api/food?q=" + encodeURIComponent(v)), j = await r.json().catch(() => ({})); if (my !== seq || !Array.isArray(j.items)) return; L = tabFind(v).slice(0, 2).concat(j.items).slice(0, 7); draw(); } catch(e) {} }, 300); }); }
    el.querySelectorAll("[data-rep]").forEach(b => b.onclick = () => { const k = b.dataset.rep; read(); sh.close();
      if (k === "scan") KCScan.open({pick: swap}); else if (k === "search") Search.open({pick: swap, q: add ? "" : (w.per && w.per.n) || w.name.replace(/\(.*?\)/g, "").trim(), title: add ? "Etwas dazu suchen" : "Echtes Produkt suchen"}); else swap(perP(w)); });
    el.querySelector("#kps").onclick = async () => { read(); if (!w.name) return say("Wie heißt es?"); const ps = partsOf(m); if (add) ps.push(w); else ps[idx] = w;
      try { sh.close(); await done(ps); } catch(e) { say("Ging nicht: " + (e.message || e)); } };
    const del = el.querySelector("#kpd"); if (del) del.onclick = async () => { if (!del.dataset.armed){ del.dataset.armed = 1; del.textContent = parts.length > 1 ? "Wirklich entfernen?" : "Wirklich löschen?"; return; }
      try { sh.close(); if (parts.length > 1){ const ps = partsOf(m); ps.splice(idx, 1); await done(ps); } else { await K.del(m.id); say("Gelöscht"); } } catch(e) { say("Ging nicht: " + (e.message || e)); } };
    return sh;
  }

  /* ---------- voice: tap = record, tap again = done. It never stops by itself: when the phone's speech
     recognition ends after a pause, it starts again at once and keeps what was said. While recording nothing
     pops up (Focus.hush), a live voice band and a timer show that it really records. No sounds. ---------- */
  const Voice2 = (() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition, MB = "chessnat-kc-meterbad";
    let ov = null, rec = null, heard = "", base = "", startT = null, finT = null, mode = "idle", want = false, t0 = 0, raf = 0, meter = null, pulse = 0, lastStart = 0, quick = 0;
    const bars = [];
    function ui(){
      ov = document.createElement("div"); ov.className = "kc-ov-full kc-voice"; ov.setAttribute("data-notr", "");
      ov.innerHTML = `<div class="kc-vtop"><button class="kc-x" data-x aria-label="Schließen">${svg(IC.x, 22)}</button><span class="kc-vtime" id="kcvtime"></span><span style="width:44px"></span></div>
        <div class="kc-vmid"><div class="kc-vt" id="kcvt">Ich höre zu</div><div class="kc-heard dim" id="kcheard">„Zwei Brötchen mit Nutella und ein Kakao …“</div>
          <canvas class="kc-wave" id="kcwave"></canvas>
          <button class="kc-mic" id="kcmic" aria-label="Aufnahme"><i class="kc-ring"></i><span class="kc-mi">${svg(IC.mic, 54)}</span><span class="kc-ms2"></span></button><div class="kc-vh muted" id="kcvh"></div>
          <button class="btn go big kc-vdone" id="kcvdone" hidden>Fertig, rechnen</button>
          <form class="kc-type" id="kctype" hidden><textarea id="kctext" rows="3" placeholder="Was hast du gegessen?"></textarea><button class="btn go big">Rechnen</button></form></div>
        <div class="kc-vbot"><button class="btn ghost" id="kckb">${svg(IC.kb, 18)} Tippen</button></div>`;
      document.body.appendChild(ov);
      ov.querySelector("[data-x]").onclick = close;
      ov.querySelector("#kcmic").onclick = () => { if (mode === "listening") finish(); else if (mode === "idle" || mode === "paused") listen(mode === "paused"); };
      ov.querySelector("#kcvdone").onclick = () => { if (heard) analyze(heard); };
      ov.querySelector("#kckb").onclick = () => typeMode();
      ov.querySelector("#kctype").onsubmit = e => { e.preventDefault(); const v = ov.querySelector("#kctext").value.trim(); if (!v) return say("Schreib kurz, was du gegessen hast"); ov.querySelector("#kctext").blur(); analyze(v); };
      draw();
    }
    function set(state, hint){
      mode = state; if (!ov) return;
      ov.classList.toggle("rec", state === "listening"); ov.classList.toggle("think", state === "thinking" || state === "finishing"); ov.classList.toggle("typing", state === "typing");
      ov.querySelector("#kcvt").textContent = state === "thinking" || state === "finishing" ? "Ich rechne …" : state === "typing" ? "Was hast du gegessen?" : state === "listening" ? "Ich höre zu" : state === "paused" ? "Pause" : "Tippen zum Sprechen";
      ov.querySelector("#kcvh").textContent = hint || "";
      ov.querySelector("#kctype").hidden = state !== "typing"; ov.querySelector("#kcmic").hidden = state === "typing"; ov.querySelector("#kcwave").hidden = state === "typing";
      ov.querySelector("#kckb").hidden = state === "typing" || state === "thinking" || state === "finishing" || state === "listening";
      ov.querySelector("#kcvdone").hidden = !(state === "paused" && heard);
    }
    function open(){
      if (!meId()) return say("Bitte erst anmelden");
      if (ov) close(); heard = base = ""; bars.length = 0; ui(); listen();
    }
    const show = () => { const hd = ov && ov.querySelector("#kcheard"); if (!hd) return; if (heard){ hd.textContent = heard; hd.classList.remove("dim"); hd.scrollTop = hd.scrollHeight; } };
    function listen(more){
      if (!more){ heard = base = ""; const hd = ov.querySelector("#kcheard"); hd.textContent = "„Zwei Brötchen mit Nutella und ein Kakao …“"; hd.classList.add("dim"); t0 = Date.now(); } else base = heard;
      if (!SR) return typeMode("Spracherkennung gibt’s hier nicht. Tipp oder diktier über das 🎤 der Tastatur.");
      want = true; quick = 0; set("listening", "Tippen, wenn du fertig bist"); try { Focus.hush(true); } catch(e) {} haptic(12);
      startSR(true); startMeter();
      clearTimeout(startT); startT = setTimeout(() => { if (want && mode === "listening" && !heard && !lastStart){ stop(); typeMode("Die Spracherkennung startet nicht. Tipp oder diktier über die Tastatur."); } }, 4500);
    }
    function startSR(first){
      let r; try { r = new SR(); } catch(e) { return first ? typeMode() : pause(); }
      rec = r; r.lang = "de-DE"; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1; const at = Date.now();
      r.onstart = r.onaudiostart = () => { if (rec === r) lastStart = lastStart || Date.now(); };
      r.onresult = e => { if (rec !== r) return; const sess = /Android/i.test(navigator.userAgent) ? (e.results.length ? e.results[e.results.length - 1][0].transcript : "") : Array.from(e.results).map(x => x[0].transcript).join(" "); heard = (base + " " + sess).replace(/\s+/g, " ").trim(); pulse = 1; show(); };
      r.onerror = e => { if (rec !== r) return;
        if (e.error === "not-allowed" || e.error === "service-not-allowed"){ if (first && !heard){ stop(); typeMode("Kein Mikrofon-Zugriff. Tipp stattdessen."); } else { rec = null; pause(); } }
        else if (e.error === "audio-capture" && meter){ stopMeter(true); } };
      /* the phone ended the recognition (a pause, a time limit): start again and keep what was said */
      r.onend = () => { if (rec !== r) return; rec = null; base = heard;
        if (want && mode === "listening"){ if (Date.now() - at < 1500 && ++quick >= 3){ if (meter) stopMeter(true); else if (quick >= 6) return pause(); } setTimeout(() => { if (want && mode === "listening" && !rec) startSR(false); }, 80); return; }
        if (mode === "finishing") done(); };
      try { r.start(); } catch(e) { rec = null; return first ? typeMode() : pause(); }
    }
    /* recognition can't go on by itself (some phones need a new tap): keep the text, tap continues */
    function pause(){ want = false; stopMeter(); try { Focus.hush(false); } catch(e) {} set("paused", heard ? "Tippen zum Weitersprechen" : "Tippen zum Sprechen"); }
    function stop(){ want = false; clearTimeout(startT); clearTimeout(finT); const r = rec; rec = null; if (r) try { r.abort(); } catch(e) {} stopMeter(); try { Focus.hush(false); } catch(e) {} }
    function finish(){ if (mode !== "listening") return; want = false; haptic([10, 30, 10]); stopMeter(); try { Focus.hush(false); } catch(e) {}
      set("finishing"); const r = rec; if (r){ try { r.stop(); } catch(e) {} clearTimeout(finT); finT = setTimeout(done, 1500); } else done(); }
    function done(){ clearTimeout(finT); if (mode !== "finishing") return; const r = rec; rec = null; if (r) try { r.abort(); } catch(e) {}
      if (heard) analyze(heard); else set("idle", "Nichts gehört. Tipp auf den Knopf und sprich."); }
    /* the voice band: the real microphone level where the phone allows a second listener, else it moves with what is recognised */
    /* Android: the level meter opens the microphone a second time, and then the speech recognition gets no sound at all
       (the bars move, but it ends with "Nichts gehört"). So there is no meter on Android; the bars follow what is recognised */
    let meterBad = /Android/i.test(navigator.userAgent); try { meterBad = meterBad || localStorage.getItem(MB) === "1"; } catch(e) {}
    async function startMeter(){ if (meterBad || meter || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
      try { const st = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}}); if (!want){ st.getTracks().forEach(t => t.stop()); return; }
        const AC = window.AudioContext || window.webkitAudioContext, ac = new AC(), an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(st).connect(an); meter = {st, ac, an, buf: new Uint8Array(an.fftSize)}; } catch(e) {} }
    function stopMeter(bad){ if (bad){ meterBad = true; try { localStorage.setItem(MB, "1"); } catch(e) {} } if (!meter) return; try { meter.st.getTracks().forEach(t => t.stop()); meter.ac.close(); } catch(e) {} meter = null; }
    const level = () => { if (meter){ meter.an.getByteTimeDomainData(meter.buf); let s = 0; for (let i = 0; i < meter.buf.length; i++){ const d = (meter.buf[i] - 128) / 128; s += d * d; } return Math.min(1, Math.sqrt(s / meter.buf.length) * 5); }
      pulse *= .9; return mode === "listening" ? Math.min(1, .08 + pulse * (.45 + Math.random() * .5)) : 0; };
    let lastBar = 0;
    function draw(){
      cancelAnimationFrame(raf); if (!ov) return; raf = requestAnimationFrame(draw);
      const cv = ov.querySelector("#kcwave"), tm = ov.querySelector("#kcvtime"); if (!cv || cv.hidden) return; const dpr = Math.min(3, window.devicePixelRatio || 1), w = cv.clientWidth, hh = cv.clientHeight; if (!w) return;
      if (cv.width !== Math.round(w * dpr)){ cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); }
      const n = Math.floor(w / 7), now2 = Date.now(), lv = level(); if (now2 - lastBar > 55){ lastBar = now2; bars.push(mode === "listening" ? lv : 0); while (bars.length > n) bars.shift(); }
      const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, hh); c.lineCap = "round"; c.lineWidth = 4;
      for (let i = 0; i < n; i++){ const v = bars[bars.length - n + i] || 0, x = i * 7 + 3.5, bh = Math.max(4, v * (hh - 8)); c.strokeStyle = mode === "listening" ? `rgba(255,${90 + Math.round(v * 60)},80,${.35 + (i / n) * .65})` : "rgba(255,255,255,.18)"; c.beginPath(); c.moveTo(x, hh / 2 - bh / 2); c.lineTo(x, hh / 2 + bh / 2); c.stroke(); }
      const ring = ov.querySelector(".kc-ring"); if (ring) ring.style.transform = `scale(${1 + (mode === "listening" ? lv * .45 : 0)})`;
      if (tm){ const sec = mode === "listening" || mode === "paused" ? Math.floor((now2 - t0) / 1000) : -1, txt = sec >= 0 ? Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0") : ""; if (tm.textContent !== txt) tm.textContent = txt; }
    }
    function typeMode(hint){ stop(); set("typing", hint || ""); const t = ov.querySelector("#kctext"); t.value = heard || ""; setTimeout(() => t.focus(), 60); }
    function close(){ stop(); mode = "idle"; cancelAnimationFrame(raf); if (ov){ ov.remove(); ov = null; } }
    async function analyze(text){
      set("thinking", ""); const hd = ov.querySelector("#kcheard"); hd.textContent = text; hd.classList.remove("dim");
      const at = Date.now();
      try {
        const s = window.ChessSite && window.ChessSite.getSession();
        const res = await fetch("/api/kcal", {method: "POST", headers: {"Content-Type": "application/json", Authorization: "Bearer " + (s ? s.access_token : "")}, body: JSON.stringify({text})});
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.meal) throw new Error(j.error || "Das hat nicht geklappt.");
        const m = j.meal;
        if (!m.items.length && !m.kcal) throw new Error(m.note || "Da hab ich nichts Essbares erkannt.");
        const ts = new Date(at - (m.minutesAgo || 0) * 60000).toISOString();
        const saved = await K.add({draft: true, source: "voice", said: text, ts, day: dayOf(ts), title: m.title, emoji: m.emoji, kcal: m.kcal, carbs: m.carbs, protein: m.protein, fat: m.fat, items: m.items, note: m.note});
        close(); haptic(15); mealSheet(saved);
      } catch(e) {
        if (!ov) return say("Konnte nicht rechnen: " + (e.message || e));
        set("typing", "⚠️ " + (e.message || "Keine Verbindung. Nochmal versuchen?")); ov.querySelector("#kctext").value = text;
      }
    }
    return {open, close};
  })();

  /* ---------- barcode: fast, any angle ---------- */
  const KCScan = (() => {
    let MINLINES = 3;
    const FORMATS_NATIVE = ["ean_13", "ean_8", "upc_a", "upc_e"], FORMATS_ZX = ["EAN13", "EAN8", "UPCA", "UPCE"];
    let native = null, zx = null, zxLoading = null, stream = null, camOff = null, ov = null, scanning = false, frame = 0, torchOn = false;
    /* native BarcodeDetector (Android Chrome) reads any angle; elsewhere (iPhone) zxing-cpp as WebAssembly */
    async function engine(){
      if (native || zx) return;
      if ("BarcodeDetector" in window){ try { const f = await BarcodeDetector.getSupportedFormats(); if (f.includes("ean_13")) { native = new BarcodeDetector({formats: FORMATS_NATIVE.filter(x => f.includes(x))}); return; } } catch(e) {} }
      await loadZx();
    }
    function loadZx(){
      if (zx) return Promise.resolve(zx);
      if (zxLoading) return zxLoading;
      zxLoading = new Promise((ok, bad) => { const s = document.createElement("script"); s.src = "vendor/zxing/zxing-reader.js?v=3.1.6"; s.onload = ok; s.onerror = bad; document.head.appendChild(s); })
        .then(() => { const Z = window.ZXingWASM; Z.prepareZXingModule({overrides: {locateFile: (p, pre) => p.endsWith(".wasm") ? location.origin + "/vendor/zxing/" + p + "?v=3.1.6" : pre + p}, fireImmediately: true}); zx = Z; return Z; })
        .catch(e => { zxLoading = null; throw e; });
      return zxLoading;
    }
    /* warm up while the home screen shows, so the first scan starts at once */
    let pre = false;
    function preload(){ if (pre) return; pre = true; const go = () => engine().catch(() => { pre = false; }); setTimeout(() => window.requestIdleCallback ? requestIdleCallback(go, {timeout: 3000}) : go(), 1200); }
    const camLive = () => stream && stream.getVideoTracks().some(t => t.readyState === "live");
    async function getCam(){
      clearTimeout(camOff);
      if (!camLive()) stream = await navigator.mediaDevices.getUserMedia({audio: false, video: {facingMode: {ideal: "environment"}, width: {ideal: 1920}, height: {ideal: 1080}, frameRate: {ideal: 30}}});
      stream.getTracks().forEach(t => { t.enabled = true; });
      const tr = stream.getVideoTracks()[0];
      try { const cap = tr.getCapabilities ? tr.getCapabilities() : {}; const adv = {};
        if (cap.focusMode && cap.focusMode.includes("continuous")) adv.focusMode = "continuous";
        if (Object.keys(adv).length) await tr.applyConstraints({advanced: [adv]}); } catch(e) {}
      return stream;
    }
    /* one camera stream per visit: iPhone asks for the camera once, not on every scan */
    function releaseCam(now){
      clearTimeout(camOff); const kill = () => { if (stream){ stream.getTracks().forEach(t => t.stop()); stream = null; } };
      if (now) return kill(); if (stream) stream.getTracks().forEach(t => { t.enabled = false; }); camOff = setTimeout(kill, 3 * 60000);
    }
    document.addEventListener("visibilitychange", () => { if (document.hidden && !scanning) releaseCam(true); });

    function ui(){
      ov = document.createElement("div"); ov.className = "kc-ov-full kc-scanov"; ov.setAttribute("data-notr", "");
      ov.innerHTML = `<video id="kcv" playsinline muted autoplay></video><div class="kc-frame"><i></i><i></i><i></i><i></i><b class="kc-laser"></b></div>
        <div class="kc-vtop"><button class="kc-x" data-x aria-label="Schließen">${svg(IC.x, 22)}</button><button class="kc-x" id="kctorch" hidden aria-label="Licht">${svg(IC.torch, 20)}</button></div>
        <div class="kc-sbot"><div class="kc-hint" id="kchint">${round ? "Scann alles, was du gegessen hast. Egal in welcher Reihenfolge." : "Barcode in den Rahmen halten, egal wie gedreht"}</div>
          ${round ? `<div class="kc-rp" id="kcrp"></div>` : `<form id="kcman" class="kc-man"><input id="kccode" inputmode="numeric" placeholder="oder Nummer eintippen" autocomplete="off"><button class="btn go">OK</button></form>`}</div>`;
      document.body.appendChild(ov); if (round) roundDraw();
      ov.querySelector("[data-x]").onclick = close;
      if (!round) ov.querySelector("#kcman").onsubmit = e => { e.preventDefault(); const c = ov.querySelector("#kccode").value.replace(/\D/g, ""); if (c.length < 6) return say("Die Nummer ist zu kurz"); ov.querySelector("#kccode").blur(); got(c); };
    }
    /* pick: what to do with the product (swap a part of a meal); without it the product becomes a new meal */
    let pickCb = null;
    async function open(opt){
      if (!meId()) return say("Bitte erst anmelden");
      if (ov) close(); pickCb = opt && opt.pick || null; round = opt && opt.round ? {m: opt.round, parts: partsOf(opt.round), got: {}, codes: new Set(), busy: 0, msg: ""} : null; ui(); scanning = true; frame = 0; torchOn = false;
      const hint = t => { if (ov) ov.querySelector("#kchint").textContent = t; };
      try {
        const [s] = await Promise.all([getCam(), engine()]);
        if (!ov) return;
        const v = ov.querySelector("#kcv"); v.srcObject = s; await v.play().catch(() => {});
        const tr = s.getVideoTracks()[0]; try { const cap = tr.getCapabilities ? tr.getCapabilities() : {}; if (cap.torch){ const tb = ov.querySelector("#kctorch"); tb.hidden = false;
          tb.onclick = () => { torchOn = !torchOn; tb.classList.toggle("on", torchOn); tr.applyConstraints({advanced: [{torch: torchOn}]}).catch(() => {}); }; } } catch(e) {}
        loop(v);
      } catch(e) { hint(e && e.name === "NotAllowedError" ? "Kein Kamera-Zugriff. Nummer unten eintippen." : "Kamera nicht verfügbar. Nummer unten eintippen."); }
    }
    const cv = document.createElement("canvas"), cx = cv.getContext("2d", {willReadFrequently: true});
    /* each frame: the middle of the picture, every second frame turned by 45°, so a code at any angle reads
       (a barcode line still reads when it is tilted up to about 30°; tryRotate covers the right angles) */
    async function readFrame(v){
      const vw = v.videoWidth || v.width, vh = v.videoHeight || v.height; if (!vw || !vh) return null;
      if (native){ const r = await native.detect(v); return r && r[0] ? r[0].rawValue : null; }
      const side = Math.round(Math.min(vw, vh) * .82), sx = (vw - side) / 2, sy = (vh - side) / 2, out = Math.min(900, side);
      const tilt = frame++ % 2 === 1;
      cv.width = out; cv.height = out; cx.save();
      if (tilt){ cx.fillStyle = "#fff"; cx.fillRect(0, 0, out, out); cx.translate(out / 2, out / 2); cx.rotate(Math.PI / 4); const s2 = out; cx.drawImage(v, sx, sy, side, side, -s2 / 2, -s2 / 2, s2, s2); }
      else cx.drawImage(v, sx, sy, side, side, 0, 0, out, out);
      cx.restore();
      const img = cx.getImageData(0, 0, out, out);
      const r = await zx.readBarcodes(img, {formats: FORMATS_ZX, tryHarder: true, tryRotate: true, tryInvert: false, tryDownscale: true, maxNumberOfSymbols: 1, minLineCount: MINLINES});
      const ok = r && r.find(x => x.isValid && x.text);
      return ok ? ok.text : null;
    }
    function loop(v){
      const next = () => { if (!scanning) return; if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(step); else requestAnimationFrame(step); };
      /* a code counts once two frames agree: one stray misread can never open the wrong product */
      const seen = {};
      const step = async () => { if (!scanning) return; let code = null; try { code = await readFrame(v); } catch(e) {}
        if (code && scanning){ const now = Date.now(), s0 = seen[code]; if (s0 && now - s0 < 2000){ if (!round) return got(code); delete seen[code]; roundGot(code); } else seen[code] = now; }
        next(); };
      next();
    }
    function stopScan(){ scanning = false; if (ov){ const v = ov.querySelector("#kcv"); try { v.pause(); } catch(e) {} v.srcObject = null; } releaseCam(false); }
    function close(){ stopScan(); if (ov){ ov.remove(); ov = null; } round = null; }
    const cacheKey = c => "chessnat-off-" + c;
    /* ---- the round: after speaking, scan every pack you ate from, in any order; each one goes to the part it fits ---- */
    let round = null;
    const words = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").split(/[^a-z0-9]+/).filter(w => w.length >= 3);
    const fit = (part, P) => { const a = words(part.name), b = words(P.name + " " + (P.brand || "")); let n = 0; a.forEach(w => { if (b.some(x => x === w || (w.length >= 4 && (x.startsWith(w) || w.startsWith(x) || x.includes(w))))) n++; }); return n; };
    /* how much: grams named in the part ("80 g"), else a count × the pack's portion ("2 Scheiben"), else the same kcal as guessed */
    const howMuch = (part, P) => { const g = gramsIn(part.amount); if (g > 0) return g; const m = /(\d+(?:[.,]\d+)?|½|¼|¾)/.exec(String(part.amount || "")); if (m && P.serving) return num(m[1]) * P.serving;
      return P.k > 0 && part.kcal > 0 ? Math.round(part.kcal / P.k * 1000) / 10 : P.serving || 100; };
    function roundDraw(){ const el = ov && ov.querySelector("#kcrp"); if (!el || !round) return; const R = round;
      el.innerHTML = `${R.msg ? `<div class="kc-rmsg ${R.msgOk ? "ok" : ""}">${R.msg}</div>` : ""}${R.ask ? `<div class="kc-rask"><span>Wozu gehört <b>${h(R.ask.P.name)}</b>?</span><div>${R.parts.map((p2, i) => R.got[i] ? "" : `<button class="chip" data-to="${i}">${h(p2.name)}</button>`).join("")}<button class="chip" data-to="new">+ Dazu</button><button class="chip" data-to="skip">Nichts</button></div></div>` : ""}
        <div class="kc-rl">${R.parts.map((p2, i) => `<div class="${R.got[i] ? "ok" : ""}"><i>${R.got[i] ? "✓" : ""}</i><span>${h(R.got[i] ? R.got[i] : p2.name)}<small>${h(p2.amount || "")} · ${fmt(p2.kcal)} kcal</small></span></div>`).join("")}</div>
        <button class="btn go big" id="kcrdone">${Object.keys(R.got).length ? "Fertig, übernehmen" : "Fertig"}</button>`;
      el.querySelectorAll("[data-to]").forEach(b => b.onclick = () => { const to = b.dataset.to, P = R.ask.P; R.ask = null; if (to === "skip"){ R.msg = ""; roundDraw(); return; } assign(to === "new" ? -1 : +to, P); });
      el.querySelector("#kcrdone").onclick = roundSave; }
    function assign(i, P){ const R = round; if (!R) return; if (i < 0){ const g = P.serving || 100; R.parts.push(itemOf(P, g)); i = R.parts.length - 1; } else { const was = R.parts[i];
      /* what you said was weighed on the plate (cooked), the pack you scan states the dry weight: take the pack's values for the cooked food,
         so 250 g cooked noodles stay 250 g cooked noodles. Only if you said "trocken" or "roh" the pack's values are taken as they are */
      if (cookOf(P)) P = cookP(P, was.st === "dry" || /trocken|\broh|ungekocht/i.test(String(was.amount) + " " + String(was.name)) ? "dry" : "cooked");
      R.parts[i] = itemOf(P, howMuch(was, P)); }
      R.got[i] = P.name + (P.brand ? " (" + P.brand + ")" : ""); R.msg = `✓ ${h(P.name)}`; R.msgOk = 1; haptic([12, 25, 12]); roundDraw(); }
    async function roundGot(code){ const R = round; if (!R) return;
      if (R.codes.has(code)){ if (Date.now() - (R.dupT || 0) > 2500){ R.dupT = Date.now(); R.msg = "Schon gescannt"; R.msgOk = 0; roundDraw(); } return; }
      R.codes.add(code); R.busy++; R.msg = "Gefunden, suche Produkt …"; R.msgOk = 0; roundDraw(); haptic(10);
      const p = await offGet(code, 8000); R.busy--; if (round !== R) return;
      if (!p){ R.msg = "Nicht in der Datenbank"; R.msgOk = 0; roundDraw(); return; }
      const P = prodOf(code, p); let best = -1, bs = 0; R.parts.forEach((p2, i) => { const f2 = fit(p2, P) * (R.got[i] ? .5 : 1); if (f2 > bs){ bs = f2; best = i; } });
      /* "Nudeln" was said and a pack of spaghetti is scanned: the food table knows they are the same thing */
      const F = cookOf(P), same = F ? R.parts.findIndex((p2, i) => !R.got[i] && (p2.ref === F.id || new RegExp("^(" + F.al + ")$", "i").test(String(p2.name || "").toLowerCase().replace(/\b(gekochte[rsn]?|gebratene[rsn]?|trockene?|rohe[rsn]?)\b/g, "").trim()))) : -1;
      if (same >= 0) assign(same, P); else if (best >= 0 && bs >= 1) assign(best, P); else { R.ask = {P}; R.msg = ""; roundDraw(); } }
    async function roundSave(){ const R = round; if (!R) return; const b = ov.querySelector("#kcrdone"); if (b) b.disabled = true;
      try { const nm = Object.keys(R.got).length ? await saveParts(R.m, R.parts) : R.m; close(); if (Object.keys(R.got).length){ haptic(15); say(`📦 ${Object.keys(R.got).length} Produkt${Object.keys(R.got).length > 1 ? "e" : ""} übernommen`); } mealSheet(nm); }
      catch(e) { if (b) b.disabled = false; say("Ging nicht: " + (e.message || e)); } }
    async function got(code){
      if (!ov) return; stopScan(); haptic([15, 30, 15]);
      ov.classList.add("found"); ov.querySelector("#kchint").textContent = "Gefunden: " + code + " … suche Produkt";
      const p = await offGet(code, 9000);
      if (!ov) return;
      if (!p){ ov.querySelector("#kchint").textContent = "Nicht in der Datenbank. Such es lieber beim Namen."; const cb = pickCb; setTimeout(() => { if (ov){ close(); Search.open(cb ? {pick: cb} : {}); } }, 1500); return; }
      const cb = pickCb; close(); const P = prodOf(code, p); if (cb) cb(P); else addProduct(P, "barcode");
    }
    /* test hook: decode one picture (a canvas) the same way as a camera frame */
    const decode = async (c, ml) => { await engine(); if (ml) MINLINES = ml; return readFrame(c); };
    return {open, close, preload, decode, _round: c => roundGot(c), get engine(){ return native ? "native" : zx ? "zxing" : "none"; }};
  })();
  window.KCScan = KCScan;

  /* ---------- cooking: what's at home → one dish and how many grams of each, to fill what's still missing today ---------- */
  const api = async body => { const s2 = window.ChessSite && window.ChessSite.getSession(), r = await fetch("/api/kcal", {method: "POST", headers: {"Content-Type": "application/json", Authorization: "Bearer " + (s2 ? s2.access_token : "")}, body: JSON.stringify(body)});
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Das hat nicht geklappt."); return j; };
  const aimName = () => { const a = AIMS.find(x => x[0] === (K.body || {}).aim); return a ? a[2] : ""; };
  const Cook = {
    open(){
      if (!meId()) return say("Bitte erst anmelden");
      const T = K.targets(), t = today(), miss = {kcal: Math.max(0, T.kcal - K.dayKcal(t)), protein: Math.max(0, Math.round(T.protein - K.daySum(t, "protein"))), carbs: Math.max(0, Math.round(T.carbs - K.daySum(t, "carbs"))), fat: Math.max(0, Math.round(T.fat - K.daySum(t, "fat")))};
      let last = ""; try { last = localStorage.getItem("chessnat-kc-fridge") || ""; } catch(e) {}
      const sh = detailSheet(`<div class="kc-form kc-cook" data-notr><h3>👨‍🍳 Was soll ich kochen?</h3><p class="muted kc-miss">Heute fehlen noch <b>${fmt(miss.kcal)} kcal</b> · ${miss.protein} g Protein · ${miss.carbs} g KH · ${miss.fat} g Fett</p>
        <label>Was hast du da?<textarea id="kch" rows="3" placeholder="z. B. Nudeln, Hackfleisch, Tomaten, Zwiebeln, Käse, Eier">${h(last)}</textarea></label><button class="btn go big" id="kcgo">Vorschlag holen</button><div id="kcout"></div></div>`);
      const el = sh.el, ta = el.querySelector("#kch"), out = el.querySelector("#kcout"), go = el.querySelector("#kcgo"); if (!last) try { ta.focus({preventScroll: true}); } catch(e) {}
      go.onclick = async () => { const have = ta.value.trim(); if (have.length < 3) return say("Schreib kurz, was du da hast"); try { localStorage.setItem("chessnat-kc-fridge", have); } catch(e) {} ta.blur(); go.disabled = true; go.textContent = "Ich überlege …"; out.innerHTML = `<div class="kc-think"><i></i><i></i><i></i></div>`;
        try { const j = await api({mode: "cook", have, missing: miss, aim: aimName(), usual: frequent().map(m => m.title).concat(K.meals.slice(0, 30).map(m => m.title)).filter((x, i, a) => a.indexOf(x) === i).slice(0, 12)}), d = j.dish;
          out.innerHTML = `<div class="kc-dish"><div class="kc-mh"><span class="kc-me">${h(d.emoji)}</span><div><div class="kc-mt">${h(d.title)}</div><div class="muted">${fmt(d.kcal)} kcal · ${f1(d.protein)} g Protein · ${f1(d.carbs)} g KH · ${f1(d.fat)} g Fett</div></div></div>
            <p class="kc-why">${h(d.why)}</p><div class="kc-items">${d.items.map(i => `<div><span>${h(i.name)}<small>${fmt(i.grams)} g</small></span><b>${fmt(i.kcal)} kcal</b></div>`).join("")}</div>
            ${d.steps.length ? `<ol class="kc-steps">${d.steps.map(x => `<li>${h(x)}</li>`).join("")}</ol>` : ""}${d.tip ? `<p class="muted kc-said">💡 ${h(d.tip)}</p>` : ""}
            <button class="btn go big" id="kceat">Gegessen, so eintragen</button></div>`;
          out.querySelector("#kceat").onclick = async () => { try { const m = await K.add({source: "text", title: d.title, emoji: d.emoji, kcal: d.kcal, carbs: d.carbs, protein: d.protein, fat: d.fat, items: d.items.map(i => ({name: i.name, amount: fmt(i.grams) + " g", kcal: i.kcal, carbs: i.carbs, protein: i.protein, fat: i.fat})), note: "Gekocht nach Vorschlag"}); sh.close(); haptic(15); say(`${m.emoji} ${fmt(m.kcal)} kcal eingetragen`); } catch(e) { say("Ging nicht: " + (e.message || e)); } };
          go.textContent = "Anderer Vorschlag"; } catch(e) { out.innerHTML = `<p class="muted">⚠️ ${h(e.message || "Keine Verbindung")}</p>`; go.textContent = "Nochmal"; }
        go.disabled = false; };
      return sh; }
  };
  /* ---------- the weekly wrap-up: once a week, big, it can't be swiped away: the numbers and an honest coach ---------- */
  const Wrap = {
    key: "chessnat-kc-wrap",
    days(){ const t = today(), d = []; for (let i = 7; i >= 1; i--) d.push(addDays(t, -i)); return d; },
    due(){ if (!K.on() || !K.body || !K.body.setup_at) return false; const logged = this.days().filter(d => K.dayMeals(d).length).length; if (logged < 4) return false;
      let last = 0; try { last = Number(localStorage.getItem(this.key) || 0); } catch(e) {} return Date.now() - last > 6.5 * 864e5; },
    check(){ if (this.shown || !this.due() || document.querySelector(".dsheet,.kc-ov-full,.onb")) return; this.shown = 1; setTimeout(() => { if (!document.querySelector(".dsheet,.kc-ov-full,.onb")) this.open(); else this.shown = 0; }, 1200); },
    data(){ const T = K.targets(), D = this.days(), logged = D.filter(d => K.dayMeals(d).length), avg = f => Math.round(logged.reduce((s, d) => s + (f === "kcal" ? K.dayKcal(d) : K.daySum(d, f)), 0) / Math.max(1, logged.length));
      const W = (K.weights || []).filter(w => Date.parse(w.ts) > Date.now() - 15 * 864e5).slice().reverse(), dW = W.length >= 2 ? Math.round((W[W.length - 1].kg - W[0].kg) * 10) / 10 : null;
      const foods = {}; K.meals.filter(m => D.includes(m.day)).forEach(m => (Array.isArray(m.items) && m.items.length ? m.items : [{name: m.title, kcal: m.kcal}]).forEach(i => { const k = String(i.name || "").replace(/\(.*?\)/g, "").trim().slice(0, 40); if (k) foods[k] = (foods[k] || 0) + (Number(i.kcal) || 0); }));
      return {ziel: aimName(), ziele: {kcal: T.kcal, protein: T.protein, kh: T.carbs, fett: T.fat}, tageMitEintrag: logged.length, tageZielGeschafft: logged.filter(d => K.dayKcal(d) >= T.kcal).length,
        schnitt: {kcal: avg("kcal"), protein: avg("protein"), kh: avg("carbs"), fett: avg("fat")}, tage: D.map(d => ({tag: d, kcal: K.dayKcal(d), protein: Math.round(K.daySum(d, "protein"))})),
        gewicht: W.length ? {jetzt: Number(W[W.length - 1].kg), aenderung: dW} : null, lebensmittel: Object.entries(foods).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => k + " " + Math.round(v) + " kcal")}; },
    open(manual){
      const d = this.data(), T = K.targets(), pc = (a, b) => b ? Math.round(a / b * 100) : 0, ov = document.createElement("div"); ov.className = "kc-ov-full kc-wrap"; ov.setAttribute("data-notr", "");
      const D = this.days(), from = new Date(D[0] + "T12:00").toLocaleDateString("de-DE", {day: "numeric", month: "short"}), to = new Date(D[6] + "T12:00").toLocaleDateString("de-DE", {day: "numeric", month: "short"});
      ov.innerHTML = `<div class="kc-wtop"><small>Wochen-Rückblick · ${from} – ${to}</small><h2>Deine Woche</h2></div>
        <div class="kc-wst"><div><b>${fmt(d.schnitt.kcal)}</b><span>Ø kcal · ${pc(d.schnitt.kcal, T.kcal)} %</span></div><div><b>${d.tageZielGeschafft}/${d.tageMitEintrag}</b><span>Tage Ziel geschafft</span></div>
          <div><b>${d.schnitt.protein} g</b><span>Ø Protein · ${pc(d.schnitt.protein, T.protein)} %</span></div><div><b>${d.gewicht && d.gewicht.aenderung != null ? (d.gewicht.aenderung > 0 ? "+" : d.gewicht.aenderung < 0 ? "−" : "±") + nf(Math.abs(d.gewicht.aenderung), 1) + " kg" : d.gewicht ? nf(d.gewicht.jetzt, 1) + " kg" : "–"}</b><span>Gewicht</span></div></div>
        <div class="kc-wai" id="kcwai"><div class="kc-think"><i></i><i></i><i></i></div><p class="muted">Dein Coach schaut sich die Woche an …</p></div>
        <button class="btn go big kc-wok" id="kcwok" disabled>Gelesen</button>`;
      document.body.appendChild(ov); try { localStorage.setItem(this.key, String(Date.now())); } catch(e) {}
      /* "Gelesen" only after a few seconds, so it's really read */
      const ok = ov.querySelector("#kcwok"); let left = 5; const tick = () => { if (!ov.isConnected) return; if (left > 0){ ok.textContent = `Gelesen (${left})`; left--; setTimeout(tick, 1000); } else { ok.textContent = "Gelesen"; ok.disabled = false; } }; tick();
      ok.onclick = () => { ov.remove(); haptic(10); };
      api({mode: "week", data: d}).then(j => { const w = j.week, box = ov.querySelector("#kcwai"); if (!box) return;
        box.className = "kc-wai " + w.mood; box.innerHTML = `<h3>${w.mood === "great" ? "🔥 " : w.mood === "bad" ? "⚠️ " : "💡 "}${h(w.headline)}</h3><p>${h(w.summary)}</p>${w.good.length ? `<ul class="g">${w.good.map(x => `<li>${h(x)}</li>`).join("")}</ul>` : ""}${w.better.length ? `<ul class="b">${w.better.map(x => `<li>${h(x)}</li>`).join("")}</ul>` : ""}${w.focus ? `<p class="kc-focus">🎯 ${h(w.focus)}</p>` : ""}`;
        if (w.mood === "great") confetti(true); })
        .catch(e => { const box = ov.querySelector("#kcwai"); if (box) box.innerHTML = `<p class="muted">Der Coach ist gerade nicht erreichbar. Die Zahlen oben stimmen trotzdem.</p>`; });
      return ov; }
  };

  /* ---------- manual entry ---------- */
  function manual(name){
    const sh = detailSheet(`<div class="kc-form" data-notr><h3>Selbst eintragen</h3><label>Was<input id="kcmt" maxlength="80" placeholder="z. B. Proteinshake" value="${h(name || "")}"></label>
      <div class="kc-nums">${[["kcal", "kcal"], ["carbs", "KH g"], ["protein", "Protein g"], ["fat", "Fett g"]].map(([k, l]) => `<label>${l}<input data-k="${k}" inputmode="decimal" placeholder="${k === "kcal" ? "0" : "–"}"></label>`).join("")}</div>
      <button class="btn go big" id="kcms">Eintragen</button></div>`);
    const el = sh.el, ins = el.querySelectorAll("[data-k]"); ins.forEach(i => field(i));
    try { (name ? ins[0] : el.querySelector("#kcmt")).focus({preventScroll: true}); } catch(e) {}
    el.querySelector("#kcms").onclick = async () => { const t = el.querySelector("#kcmt").value.trim(), v = {}; ins.forEach(i => { const n = num(i.value); v[i.dataset.k] = isFinite(n) && n >= 0 ? n : 0; });
      if (!t || !(v.kcal > 0)) return say("Name und Kalorien eintragen");
      try { await K.add({source: "manual", title: t, emoji: "✍️", kcal: Math.round(v.kcal), carbs: r1(v.carbs), protein: r1(v.protein), fat: r1(v.fat)}); sh.close(); say(`✍️ ${brief(v)} eingetragen`); } catch(e) { say("Ging nicht: " + (e.message || e)); } };
  }

  /* ---------- settings (Settings page and the page's gear) ---------- */
  function settingsHTML(full){
    const on = K.on(), p = K.prof || {};
    return `<h3>Kalorien-Tracker</h3>
      <label class="chk"><input type="checkbox" data-kcs="enabled" ${on ? "checked" : ""}> Auf der Startseite zeigen (Sprechen + Barcode)</label>
      ${on || full ? `<div class="kc-showp"><b>Was dich interessiert</b><div class="kc-chips">${NORD.map(k => { const i = shows().indexOf(k); return `<button class="chip ${i >= 0 ? "on" : ""}" data-show="${k}">${i >= 0 ? `<b class="kc-ord">${i + 1}</b> ` : ""}${NUT[k].e} ${NUT[k].l}</button>`; }).join("")}</div><small class="muted">Die Reihenfolge zählt: Was du zuerst antippst, steht oben groß (1 und 2), der Rest klein darunter. Zum Umsortieren abwählen und neu antippen.</small></div>
      <div class="kc-goal"><span>Tagesziel</span><input id="kcgoal" inputmode="numeric" value="${K.goal()}"><span>kcal</span></div>
      <div class="kc-chips">${[2000, 2500, 2800, 3000, 3500].map(v => `<button class="chip ${K.goal() === v ? "on" : ""}" data-goal="${v}">${fmt(v)}</button>`).join("")}</div>
      ${(() => { const T = K.targets(), b = K.body || {}, A = AIMS.find(a => a[0] === b.aim), lw = K.weights[0];
        return `<div class="kc-tgt"><div><b>${fmt(T.kcal)} kcal</b><span>${T.protein} g Protein · ${T.carbs} g KH · ${T.fat} g Fett</span>${A ? `<small>${A[1]} ${A[2]}${lw ? ` · ${nf(lw.kg, 1)} kg` : ""}</small>` : ""}</div></div>
        <div class="kc-row2"><button class="btn" data-kcs-setup>🎯 ${b.setup_at ? "Ziele neu berechnen" : "Ziele einrichten"}</button>${b.setup_at ? `<button class="btn" data-kcs-weigh>⚖️ Gewicht</button>` : ""}</div>`; })()}
      <label class="chk"><input type="checkbox" data-kcs="share" ${p.share !== false ? "checked" : ""}> Freunde mit Tracker sehen meine Kalorien und Flammen</label>
      <label class="chk"><input type="checkbox" data-kcs="fpush" ${p.fpush !== false ? "checked" : ""}> Push, wenn Freunde essen oder ihr Ziel schaffen</label>
      <label class="chk"><input type="checkbox" data-kcs="remind" ${p.remind !== false ? "checked" : ""}> Erinnerungen mit Essensvorschlag (Push)</label>
      <p class="muted" style="font-size:12.5px;margin:6px 0 0">Push muss in der App an sein (Freunde → Benachrichtigungen). Eine Flamme gibt es für jeden Tag, an dem du dein Ziel erreichst.</p>` : ""}`;
  }
  function wireSettings(el, redraw){
    el.querySelectorAll("[data-kcs]").forEach(c => c.onchange = async () => { const k = c.dataset.kcs;
      try { await K.saveProf({[k]: c.checked}); if (k === "enabled") say(c.checked ? "Kalorien-Tracker ist auf der Startseite" : "Kalorien-Tracker ist aus"); redraw(); if (k === "enabled" && c.checked && !(K.body && K.body.setup_at)) Setup.open(redraw); } catch(e) { c.checked = !c.checked; say("Ging nicht: " + (e.message || e)); } });
    const set = async v => { v = Math.round(Number(v) || 0); if (v < 800 || v > 7000) return say("Ziel zwischen 800 und 7000 kcal");
      try { await K.saveProf({goal: v}); if (K.body && K.body.setup_at) await K.saveBody({custom: true}).catch(() => {}); say("Ziel: " + fmt(v) + " kcal"); redraw(); } catch(e) { say("Ging nicht: " + (e.message || e)); } };
    const gi = el.querySelector("#kcgoal"); if (gi){ field(gi); gi.onchange = () => set(gi.value); }
    const su = el.querySelector("[data-kcs-setup]"); if (su) su.onclick = () => { const sh0 = el.closest(".dsheet"); if (sh0) sh0.querySelector("[data-dclose]").click(); Setup.open(redraw); };
    const wb = el.querySelector("[data-kcs-weigh]"); if (wb) wb.onclick = () => { const sh0 = el.closest(".dsheet"); if (sh0) sh0.querySelector("[data-dclose]").click(); Weigh.open(); };
    el.querySelectorAll("[data-goal]").forEach(b => b.onclick = () => set(b.dataset.goal));
    el.querySelectorAll("[data-show]").forEach(b => b.onclick = async () => { const k = b.dataset.show, cur = shows(), nx = cur.includes(k) ? cur.filter(x => x !== k) : cur.concat(k);
      if (!nx.length) return say("Mindestens eins"); const was = pickedV(); setPicked(nx.length); haptic(8);
      b.classList.toggle("on"); try { await K.saveProf({show: nx.slice(0, 3)}); redraw(); } catch(e) { try { was ? localStorage.setItem(SHOWK, was) : localStorage.removeItem(SHOWK); } catch(_) {} b.classList.toggle("on"); say("Ging nicht: " + (e.message || e)); } });
  }
  window.kcalSettings = async el => {
    if (!el) return;
    if (!meId()){ el.innerHTML = `<h3>Kalorien-Tracker</h3><p class="muted">Zum Einschalten bitte anmelden.</p>`; return; }
    K.fromCache(); const draw = () => { if (!el.isConnected) return; el.innerHTML = settingsHTML(false); el.setAttribute("data-notr", ""); wireSettings(el, draw); };
    draw(); try { await K.load(true); } catch(e) {} draw();
  };

  /* ---------- the page ---------- */
  const avatar = id => { try { return Social.face(Social.P(id), 40); } catch(e) { return "🙂"; } };
  const pname = id => { try { return Social.P(id).name; } catch(e) { return "Freund"; } };
  /* ---------- the shopping list: lists you share with the friends you pick. Everyone on a list adds products (typed or searched),
     ticks off what is bought and can say "I'll buy that"; every row shows who put it there and who takes care of it.
     Changes by the others arrive live ---------- */
  const Shop = { lists: [], cur: null, items: [], mem: [], sh: null, ch: null,
    async open(){ if (!meId() || !sb()) return say("Bitte erst anmelden");
      /* a full screen like the food search, the way that already works with the iPhone keyboard: everything sits at the top,
         the screen follows when iOS pushes the page, and the list ends above the keyboard */
      const ov = document.createElement("div"); ov.className = "kc-sov kc-shov"; ov.setAttribute("data-notr", ""); ov.lang = "de"; /* German hyphenation: long product names break at a syllable, not in the middle of a word */
      ov.innerHTML = `<div class="kc-sovt"><b class="kc-shtt">${svg(IC.list, 22)}<span>Einkaufsliste</span></b><button class="kc-sx" id="kcshx">Fertig</button></div><div class="kc-sovb kc-shop" id="kcshb"><p class="muted">Lädt …</p></div>`;
      document.body.appendChild(ov); document.documentElement.classList.add("kc-sopen"); const body = this.box = ov.querySelector("#kcshb"); let closed = false;
      const vv = window.visualViewport, fit = () => { if (!vv || closed) return; const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); body.style.paddingBottom = (kb + 24) + "px"; ov.style.transform = vv.offsetTop ? `translateY(${vv.offsetTop}px)` : ""; };
      if (vv){ vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit); fit(); }
      const close = () => { if (closed) return; closed = true; if (vv){ vv.removeEventListener("resize", fit); vv.removeEventListener("scroll", fit); } try { document.activeElement && document.activeElement.blur(); } catch(e) {} document.documentElement.classList.remove("kc-sopen"); this.stop();
        if (ov.animate){ const an = ov.animate([{opacity: 1}, {opacity: 0}], {duration: 160, easing: "ease-in"}); an.onfinish = () => ov.remove(); } else ov.remove(); };
      ov.querySelector("#kcshx").onclick = close; this.sh = {el: ov, close};
      if (ov.animate) ov.animate([{opacity: 0}, {opacity: 1}], {duration: 200, easing: "ease-out"});
      try { await this.loadLists(); if (!this.lists.length){ const r = await sb().from("shop_lists").insert({owner: meId(), name: "Einkaufsliste"}).select().single(); if (r.error) throw r.error; this.lists = [r.data]; }
        let last = null; try { last = localStorage.getItem("chessnat-shop"); } catch(e) {} await this.pick((this.lists.find(l => l.id === last) || this.lists[0]).id); }
      catch(e) { this.box.innerHTML = `<p class="muted">Ging nicht: ${h(e.message || String(e))}</p>`; } },
    stop(){ try { if (this.ch) sb().removeChannel(this.ch); } catch(e) {} clearInterval(this.tick); this.ch = null; this.sh = null; },
    async loadLists(){ const r = await sb().from("shop_lists").select("*").order("created_at"); if (r.error) throw r.error; this.lists = r.data || []; },
    async pick(id){ this.cur = this.lists.find(l => l.id === id) || null; if (!this.cur) return; this.addTo = null; try { localStorage.setItem("chessnat-shop", id); } catch(e) {}
      try { if (this.ch) sb().removeChannel(this.ch); } catch(e) {}
      this.ch = sb().channel("shop-" + id).on("postgres_changes", {event: "*", schema: "public", table: "shop_items", filter: "list_id=eq." + id}, () => { clearTimeout(this.rt); this.rt = setTimeout(() => this.load(), 300); })
        .on("postgres_changes", {event: "*", schema: "public", table: "shop_answers"}, () => { clearTimeout(this.rt); this.rt = setTimeout(() => this.load(), 300); }).subscribe();
      this.pend = 0; clearInterval(this.tick); this.tick = setInterval(() => { if (this.sh && !this.pend) this.draw(); }, 60000);
      await this.load(); },
    async load(){ if (!this.cur || !this.sh) return; const my = this.lseq = (this.lseq || 0) + 1, id = this.cur.id, [a, b, c] = await Promise.all([/* things added together share one timestamp, and the database then hands them back in whatever order it likes, a different one after
         each tick. The id as a second key makes the order the same every time */
        sb().from("shop_items").select("*").eq("list_id", id).order("created_at").order("id"), sb().from("shop_members").select("user_id").eq("list_id", id), sb().from("shop_asks").select("*, shop_answers(*)").eq("list_id", id).gte("created_at", new Date(Date.now() - 24 * 3600e3).toISOString()).order("created_at", {ascending: false})]);
      if (!this.cur || this.cur.id !== id || !this.sh || this.pend || my !== this.lseq) return; if (a.error){ say("Ging nicht: " + a.error.message); return; } this.items = a.data || []; this.mem = (b.data || []).map(x => x.user_id); this.asks = (c && c.data) || []; this.draw(); },
    /* ask everyone on the list: "I'm at the shop, anything else?" or, about one product, "is this still at home?" */
    async ask(kind, item){ if (!this.cur) return; if (kind === "shop" && Date.now() - (this.askT || 0) < 60000) return say("Gerade erst gefragt"); const r = await sb().from("shop_asks").insert({list_id: this.cur.id, item_id: item || null, kind}); if (r.error) return say("Ging nicht: " + r.error.message);
      if (kind === "shop"){ this.askT = this.shopT = Date.now(); this.shopL = this.cur.id; } haptic([10, 30, 10]); this.snd("Move"); if (kind === "shop") say("Alle auf der Liste werden gefragt 🛒"); this.load(); },
    /* a second tap on the question mark takes the question back: it is gone for everyone, and the next tap asks again right away */
    async unask(item, b){ const me = meId(), all = (this.asks || []).filter(x => x.kind === "home" && x.item_id === item), mine = all.filter(x => x.from_id === me);
      if (!mine.length) return say(all.length ? pname(all[0].from_id) + " hat gefragt" : "Schon gefragt");
      this.asks = this.asks.filter(x => !mine.includes(x)); if (b && !this.asks.some(x => x.kind === "home" && x.item_id === item)) b.classList.remove("on"); haptic(10);
      const r = await sb().from("shop_asks").delete().in("id", mine.map(x => x.id)); if (r.error) say("Ging nicht: " + r.error.message); else say("Frage zurückgenommen"); this.load(); },
    /* the other side: whoever has the app open gets the question as a card (also the ones of the last half hour when the app starts) */
    watch(){ if (this.watching) return; this.watching = 1; const me = meId(), seen = {}, open = {};
      const answer = async (a, v, amount) => { /* a plain insert, and only when you had answered this one before, a change of that answer (the combined call failed for some answers) */
        let r = await sb().from("shop_answers").insert({ask_id: a.id, answer: v, amount: amount || null}); if (r.error && /23505|duplicate/i.test((r.error.code || "") + " " + (r.error.message || ""))) r = await sb().from("shop_answers").update({answer: v, amount: amount || null}).eq("ask_id", a.id).eq("user_id", me);
        if (r.error) say("Ging nicht: " + r.error.message); else { haptic(10); say("Antwort geschickt ✓"); } };
      const card = html => { const sh = detailSheet(`<div class="kc-askc" data-notr>${html}</div>`); sh.el.style.zIndex = 330; try { Sound.play("GenericNotify", .7); } catch(e) {} haptic([10, 30, 10]); return sh; };
      /* a question arrives: a card to answer right there. "I'm shopping": type what you want, it goes straight onto the list */
      const show = async a => { if (!a || a.from_id === me || seen[a.id]) return; seen[a.id] = 1; const nm = pname(a.from_id);
        if (a.kind === "shop"){ const sh = card(`<div class="kc-aske">🛒</div><h3>${h(nm)} ist gerade einkaufen</h3><p class="kc-askq">Willst du noch etwas?</p><input class="kc-aski" maxlength="200" placeholder="z. B. Milch, Brot und Eier" enterkeyhint="send" autocomplete="off"><div class="kc-askb"><button class="btn go big" data-send>Auf die Liste</button><button class="btn big" data-dclose>Nein danke</button></div>`);
          const inp = sh.el.querySelector(".kc-aski"), go = async () => { const parts = inp.value.split(/\s*(?:,|;|\n|\bund\b)\s*/i).map(x => x.trim()).filter(Boolean); if (!parts.length) return inp.focus();
            const r = await sb().from("shop_items").insert(parts.map(n => ({list_id: a.list_id, name: n.slice(0, 120), added_by: me}))); if (r.error) return say("Ging nicht: " + r.error.message); sh.close(); say("Steht auf der Liste ✓"); if (this.sh) this.load(); };
          sh.el.querySelector("[data-send]").onclick = go; inp.onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); go(); } }; return; }
        const it = await sb().from("shop_items").select("name").eq("id", a.item_id).maybeSingle(), name = it.data && it.data.name; if (!name) return;
        const sh = card(`<div class="kc-aske">❓</div><h3>${h(nm)} fragt:</h3><p class="kc-askq">Ist noch <b>${h(name)}</b> zu Hause?</p><input class="kc-aski" maxlength="40" placeholder="Wie viel? Oder kurz was dazu (kann leer bleiben)" autocomplete="off"><div class="kc-askb"><button class="btn go big" data-a="yes">Ja, ist da</button><button class="btn big" data-a="no">Nein</button><button class="btn big" data-a="maybe">Weiß nicht · nicht zu Hause</button></div>`); open[a.id] = sh;
        sh.el.querySelectorAll("[data-a]").forEach(b => b.onclick = () => { const am = sh.el.querySelector(".kc-aski").value.trim().slice(0, 40); sh.close(); answer(a, b.dataset.a, am); }); };
      /* an answer to a question of mine: a card, and the product is marked on the list */
      const onAns = async x => { const k = x && "a" + x.ask_id + x.user_id + x.answer; if (!x || x.user_id === me || seen[k]) return; seen[k] = 1; const q = await sb().from("shop_asks").select("from_id,kind,shop_items(name)").eq("id", x.ask_id).maybeSingle(), a = q.data; if (!a || a.from_id !== me || a.kind !== "home") return;
        const T = {yes: ["✅", "ist noch da"], no: ["❌", "ist nicht da"], maybe: ["🤷", "weiß es gerade nicht"]}[x.answer] || ["", ""], name = (a.shop_items && a.shop_items.name) || "Das";
        card(`<div class="kc-aske">${T[0]}</div><h3>${h(pname(x.user_id))}</h3><p class="kc-askq"><b>${h(name)}</b> ${T[1]}</p>${x.amount ? `<p class="kc-askn">„${h(x.amount)}“</p>` : ""}<button class="btn go big" data-dclose>OK</button>`); if (this.sh) this.load(); };
      /* while I'm shopping: what the others add comes in as a note */
      const onItem = x => { if (!x || x.added_by === me || !this.shopT || Date.now() - this.shopT > 45 * 60000 || x.list_id !== this.shopL || x.parent) return; say("🛒 " + pname(x.added_by) + " möchte: " + x.name); try { Sound.play("GenericNotify", .7); } catch(e) {} haptic([10, 30, 10]); };
      sb().channel("shop-asks-" + me).on("postgres_changes", {event: "INSERT", schema: "public", table: "shop_asks"}, p => show(p.new))
        .on("postgres_changes", {event: "DELETE", schema: "public", table: "shop_asks"}, p => { const id = p.old && p.old.id, sh = id && open[id]; if (sh){ delete open[id]; try { sh.close(); } catch(e) {} } if (id && this.sh) this.load(); }) /* taken back: the card goes away */
        .on("postgres_changes", {event: "INSERT", schema: "public", table: "shop_answers"}, p => onAns(p.new)).on("postgres_changes", {event: "UPDATE", schema: "public", table: "shop_answers"}, p => onAns(p.new))
        .on("postgres_changes", {event: "INSERT", schema: "public", table: "shop_items"}, p => onItem(p.new)).subscribe();
      sb().from("shop_asks").select("*, shop_answers(user_id)").gte("created_at", new Date(Date.now() - 30 * 60000).toISOString()).order("created_at").then(r => { (r.data || []).filter(a => !(a.shop_answers || []).some(x => x.user_id === me) && !(a.kind === "shop" && Date.now() - Date.parse(a.created_at) > 20 * 60000)).forEach(show); }, () => {}); },
    who(id){ return id === meId() ? "du" : pname(id); },
    snd(k){ try { if (k === "tap") Sound.tap(); else Sound.play(k, .5); } catch(e) {} },
    /* the bar at the top is built once and stays (so typing is never interrupted); only the list below it is redrawn.
       One field for everything: type a product and pick a suggestion, type "Milch, Zucker und Mehl" and press OK, or speak */
    shell(){ this._lst = this._ftr = null; this.box.innerHTML = `<div id="kcsftr"></div><div id="kcsto"></div><div class="kc-shbar"><input id="kcsha" maxlength="300" enterkeyhint="done" autocomplete="off" autocorrect="off"><button class="kc-shmic" data-mic aria-label="Sprechen">${svg(IC.mic, 24)}</button><button class="kc-shok" data-add>OK</button></div><div id="kcssug"></div><button class="kc-shgob" data-imshop>🛒 Ich bin einkaufen. Wollt ihr noch was?</button><div class="kc-shtg"><button data-view="all">Gesamt</button><button data-view="dish">Gerichte</button></div><div id="kcslst"></div>`;
      const B = this.box, inp = B.querySelector("#kcsha"), sug = B.querySelector("#kcssug"); let tm = 0, seq = 0;
      const clear = () => { inp.value = ""; sug.innerHTML = ""; seq++; };
      const send = () => { if (this.micLive && this.micLive()){ const t = this.micStop(); if (t){ clear(); this.sort(t); } return; } const v = inp.value.trim(); if (!v) return; clear();
        const parts = v.split(/\s*(?:,|;|\n|\bund\b)\s*/i).map(x => x.trim()).filter(Boolean); if (parts.every(x => x.split(/\s+/).length <= 3)) this.addMany(parts); else this.sort(v); };
      inp.onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); send(); } }; B.querySelector("[data-add]").onclick = send;
      B.querySelector("[data-imshop]").onclick = () => this.ask("shop", null);
      B.querySelectorAll("[data-view]").forEach(b => b.onclick = () => { this.view = b.dataset.view; this.snd("tap"); this.draw(); });
      /* while typing one product: the same suggestions as the food search, a tap puts it on the list */
      inp.oninput = () => { clearTimeout(tm); const v = inp.value.trim(), my = ++seq; if (v.length < 2 || /[,;]| und /i.test(v)){ sug.innerHTML = ""; return; }
        tm = setTimeout(async () => { try { const r = await fetch("/api/food?q=" + encodeURIComponent(v)), j = await r.json().catch(() => ({})); if (my !== seq || !Array.isArray(j.items)) return; const L = j.items.slice(0, 5); this.sugL = L;
            sug.innerHTML = L.length ? `<div class="kc-shsg">${L.map((x, i) => `<button data-sg="${i}"><b>${h(x.name)}</b>${x.brand ? `<small>${h(x.brand)}</small>` : ""}<i>+</i></button>`).join("")}</div>` : "";
            sug.querySelectorAll("[data-sg]").forEach(b => b.onclick = () => { const x = this.sugL[+b.dataset.sg]; clear(); this.addMany([x.name + (x.brand ? " (" + x.brand + ")" : "")], x.code); }); } catch(e) {} }, 260); };
      /* speaking: it keeps listening (through pauses too) until you press OK or the microphone again; only then is it sorted */
      const mic = B.querySelector("[data-mic]"), SR = window.SpeechRecognition || window.webkitSpeechRecognition; let want = false, base = "";
      /* some phones only do one sentence at a time (or stop at every pause): then it simply starts again by itself,
         as long as you haven't pressed OK or the microphone. What was said so far is kept */
      const again = () => setTimeout(() => { if (!want) return; try { listen(); } catch(e) { want = false; mic.classList.remove("on"); say("Das Mikrofon ging nicht mehr an"); } }, 220);
      const listen = () => { const r = this.rec = new SR(), t0 = Date.now(); let cur = "", got = false, bad = ""; r.lang = "de-DE"; r.interimResults = true; r.continuous = !this.oneShot;
        r.onresult = e => { let t = ""; if (/Android/i.test(navigator.userAgent)) t = e.results.length ? e.results[e.results.length - 1][0].transcript : ""; else for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; cur = t; got = true; inp.value = (base + " " + t).trim(); };
        r.onerror = e => { bad = e.error || "?"; if (/not-allowed|service-not-allowed|audio-capture/.test(bad)){ want = false; say("Das Mikrofon ist nicht erlaubt. Nimm das Mikrofon der Tastatur."); } else if (!/no-speech|aborted/.test(bad) && this.oneShot) say("Mikrofon: " + bad); };
        r.onend = () => { base = (base + " " + cur).trim(); this.rec = null; if (!want){ mic.classList.remove("on"); return; }
          /* the long mode ended at once without hearing anything: this phone can't do it, take the one-sentence mode from now on */
          if (!this.oneShot && !got && (bad && !/no-speech/.test(bad) || Date.now() - t0 < 1500)) this.oneShot = true; again(); };
        r.start(); };
      this.micLive = () => want; this.micStop = () => { want = false; try { if (this.rec) this.rec.stop(); } catch(e) {} mic.classList.remove("on"); const t = inp.value.trim(); base = ""; return t; };
      mic.onclick = () => { if (want){ const t = this.micStop(); if (t){ clear(); this.sort(t); } return; }
        if (!SR){ inp.focus(); return say("Tipp auf das Mikrofon der Tastatur und sprich, dann OK"); }
        want = true; base = inp.value.trim(); mic.classList.add("on"); haptic(12); try { listen(); } catch(e) { want = false; mic.classList.remove("on"); say("Das Mikrofon ging nicht"); } }; },
    /* walking through the shop: every product gets an aisle from its name, and each chain has its usual order of aisles
       (typical layouts; a single shop can differ) */
    CATS: [["obst", "🥦 Obst & Gemüse", /apfel|äpfel|banane|birne|beere|traube|zitrone|orange|mandarine|kiwi|mango|ananas|melone|avocado|tomate|gurke|paprika|salat|zwiebel|knoblauch|kartoffel|karotte|möhre|zucchini|aubergine|brokkoli|blumenkohl|spinat|pilz|champignon|lauch|sellerie|ingwer|kräuter|petersilie|basilikum|schnittlauch|obst|gemüse|kürbis|kohl|rucola|radieschen|mais(?!stärke)/i],
      ["brot", "🥖 Brot & Backwaren", /brot|brötchen|toast|baguette|croissant|brezel|semmel|wrap|tortilla|kuchen(?!glasur)|gebäck/i],
      ["fleisch", "🥩 Fleisch, Wurst & Fisch", /fleisch|hack|hähnchen|hühn|pute|rind|schwein|steak|schnitzel|wurst|würst|salami|schinken|speck|bacon|mett|lachs|fisch|thunfisch|garnele|filet|gulasch|bratwurst|aufschnitt/i],
      ["kuehl", "🥛 Kühlregal", /milch|joghurt|quark|käse|butter|margarine|sahne|schmand|frischkäse|mozzarella|parmesan|feta|ei\b|eier|skyr|pudding|hefe|tofu|creme fraiche|crème|mascarpone|ricotta|teig\b|blätterteig/i],
      ["tk", "🧊 Tiefkühl", /tiefkühl|tk[- ]|gefror|\beis\b|pizza|pommes|fischstäbchen/i],
      ["grund", "🥫 Nudeln, Mehl & Konserven", /nudel|spaghetti|pasta|penne|lasagneplatten|reis|mehl|zucker|salz|pfeffer|gewürz|öl\b|essig|dose|konserve|passiert|tomatenmark|bohnen|linsen|kichererbse|brühe|soße|sauce|ketchup|senf|mayo|backpulver|vanille|stärke|haferflocken|müsli|cornflakes|flakes|honig|marmelade|nutella|aufstrich|kakao|kaffee|tee\b|nuss|nüsse|mandel|rosine|puderzucker|grieß|couscous|pesto/i],
      ["suess", "🍫 Süßes & Snacks", /schoko|keks|chips|gummi|bonbon|riegel|snack|süß|praline|cracker|salzstange|popcorn/i],
      ["trink", "🥤 Getränke", /wasser|saft|cola|limo|bier|wein|sekt|schorle|sprudel|getränk|energy|eistee|sirup/i],
      ["haus", "🧻 Drogerie & Haushalt", /papier|klopapier|toilettenpapier|küchenrolle|spülmittel|waschmittel|seife|shampoo|duschgel|zahnpasta|zahnbürste|deo|müllbeutel|schwamm|folie|tücher|taschentuch|reiniger|windel|rasier|creme\b|batterie/i]],
    STORES: {aldi: ["Aldi", ["obst", "brot", "grund", "suess", "kuehl", "fleisch", "tk", "trink", "haus"]], lidl: ["Lidl", ["brot", "obst", "kuehl", "fleisch", "grund", "suess", "tk", "trink", "haus"]],
      kaufland: ["Kaufland", ["obst", "brot", "fleisch", "kuehl", "tk", "grund", "suess", "trink", "haus"]], rewe: ["Rewe", ["obst", "brot", "fleisch", "kuehl", "grund", "suess", "tk", "trink", "haus"]], edeka: ["Edeka", ["obst", "brot", "fleisch", "kuehl", "grund", "suess", "tk", "trink", "haus"]]},
    catOf(n){ const c = this.CATS.find(x => x[2].test(n)); return c ? c[0] : "sonst"; },
    /* the list is always grouped by aisle, in the order you usually walk through a supermarket; inside an aisle in the order things were added.
       So a row has one fixed place and never moves */
    WALK: ["obst", "brot", "fleisch", "kuehl", "grund", "suess", "tk", "trink", "haus", "sonst"],
    openHTML(L0, row){ return this.WALK.map(k => { const L = L0.filter(i => this.catOf(i.name) === k); if (!L.length) return ""; const c = this.CATS.find(x => x[0] === k); return `<div class="kc-shcat">${c ? c[1] : "🧺 Sonstiges"}</div><div class="kc-shs">${L.map(i => row(i)).join("")}</div>`; }).join(""); },
    draw(){ if (!this.sh) return; if (!this.box.querySelector("#kcsha")) this.shell(); const B = this.box, me = meId(), L = this.cur, own = L.owner === me, dishes = this.items.filter(i => i.kind === "dish"), prods = this.items.filter(i => i.kind !== "dish"), open = prods.filter(i => !i.done_by), done = prods.filter(i => i.done_by);
      const dishOf = i => i.parent ? dishes.find(d => d.id === i.parent) : null, to = this.addTo ? dishes.find(d => d.id === this.addTo) : null; if (!to) this.addTo = null;
      const tt = this.sh.el.querySelector(".kc-shtt span"); if (tt) tt.textContent = L.name;
      B.querySelector("#kcsha").placeholder = to ? "Zutat für " + to.name + " …" : "Was fehlt?";
      B.querySelector("#kcsto").innerHTML = to ? `<div class="kc-shto">Zutat für <b>${h(to.name)}</b><button class="kc-shx" data-noto aria-label="Abbrechen">×</button></div>` : "";
      /* bought more than half an hour ago: off the list and into the log below, locked, with who bought it and when */
      const old = i => !!(i.done_by && i.done_at && Date.now() - Date.parse(i.done_at) > 30 * 60000), when = i => { const d = new Date(i.done_at), td = new Date().toDateString() === d.toDateString(); return (td ? "heute" : d.toLocaleDateString("de-DE", {day: "2-digit", month: "2-digit"})) + ", " + d.toLocaleTimeString("de-DE", {hour: "2-digit", minute: "2-digit"}) + " Uhr"; };
      const others = a => [L.owner].concat(this.mem).filter((x, k, A) => A.indexOf(x) === k && x !== a.from_id).length, AW = {yes: "ja", no: "nein", maybe: "weiß nicht"};
      const askOf = i => (this.asks || []).find(x => x.kind === "home" && x.item_id === i.id);
      const askTxt = i => { const a = askOf(i); if (!a) return ""; const an = a.shop_answers || [], y = an.find(x => x.answer === "yes"); if (y) return `<i class="kc-shtag y">✓ Noch da${y.amount ? " · " + h(y.amount) : ""}</i>`; return an.length && an.every(x => x.answer === "no") ? `<i class="kc-shtag n">Nicht da</i>` : ""; };
      const logRow = i => `<div class="kc-shr done log"><span class="kc-shc lock">✓</span><span class="kc-shn"><b>${h(i.name)}${i.amount ? ` <em>${h(i.amount)}</em>` : ""}</b><small>gekauft von ${h(this.who(i.done_by))} · ${when(i)}</small></span></div>`;
      const row = (i, inDish) => `<div class="kc-shr ${i.done_by ? "done" : ""} ${i.tmp ? "tmp" : ""}"><button class="kc-shc" data-done="${i.id}" aria-label="Abhaken">${i.done_by ? "✓" : ""}</button><span class="kc-shn" data-done="${i.id}"><b>${h(i.name)}${i.amount ? ` <em>${h(i.amount)}</em>` : ""}</b></span>${i.done_by ? "" : `<button class="kc-shbuy ${i.claimed_by === me ? "on" : ""}" data-claim="${i.id}" ${i.claimed_by && i.claimed_by !== me ? "disabled" : ""}>${i.claimed_by === me ? "Kaufe ich ✓" : "Kaufe ich"}</button>`}${i.done_by || i.tmp ? "" : `<button class="kc-shq ${askOf(i) ? "on" : ""}" data-ask="${i.id}" aria-label="Noch zu Hause?">?</button>`}<button class="kc-shx" data-del="${i.id}" aria-label="Entfernen">×</button><span class="kc-shsub" data-done="${i.id}"><small>${!inDish && dishOf(i) ? `für ${h(dishOf(i).name)} · ` : ""}von ${h(this.who(i.added_by))}${i.done_by ? ` · gekauft von ${h(this.who(i.done_by))}` : i.claimed_by ? ` · <u>${i.claimed_by === me ? "kaufst du" : "kauft " + h(this.who(i.claimed_by))}</u>` : ""}</small>${i.done_by ? "" : askTxt(i)}</span></div>`;
      const dishHTML = dishes.length ? `<div class="kc-day"><span>Gerichte</span></div>${dishes.map(d => { const ch = prods.filter(i => i.parent === d.id), left = ch.filter(i => !i.done_by).length; return `<div class="kc-shd ${ch.length && !left ? "ok" : ""}"><div class="kc-shdh"><span>🍽️</span><b>${h(d.name)}</b><small>${ch.length ? (left ? `${left} von ${ch.length} fehlen` : "alles da ✓") : "noch keine Zutaten"} · von ${h(this.who(d.added_by))}</small><button class="kc-shx" data-del="${d.id}" aria-label="Gericht entfernen">×</button></div>${ch.map(i => row(i, true)).join("")}<button class="kc-link" data-to="${d.id}">+ Zutat</button></div>`; }).join("")}` : "";
      /* ticked products stay exactly where they are (struck through); nothing jumps into another section */
      const live = prods.filter(i => !old(i)), log = prods.filter(old).sort((a, b) => Date.parse(b.done_at) - Date.parse(a.done_at));
      const prodHTML = `${dishes.length || live.length ? `<div class="kc-day"><span>Gesamte Einkaufsliste · ${open.length} offen</span></div>` : ""}${live.length ? this.openHTML(live, row) : `<p class="muted kc-empty">${log.length ? "Alles gekauft 🎉" : "Noch nichts auf der Liste."}</p>`}`;
      const logHTML = log.length ? `<div class="kc-day"><span>Gekauft · ${log.length}</span><button class="kc-link" data-clear>Verlauf leeren</button></div><div class="kc-shs">${log.slice(0, 60).map(logRow).join("")}</div>` : ""; this.logIds = log.map(i => i.id);
/* the page is only touched when something really changed, so a re-read with the same content moves nothing */
      { const sa = (this.asks || []).find(x => x.kind === "shop" && x.from_id === me && Date.now() - Date.parse(x.created_at) < 30 * 60000), ib = B.querySelector("[data-imshop]"), tx = sa ? "🛒 Alle gefragt. Wünsche landen auf der Liste" : "🛒 Ich bin einkaufen. Wollt ihr noch was?"; ib.classList.toggle("on", !!sa); if (ib.textContent !== tx) ib.textContent = tx; if (sa){ this.shopT = Date.parse(sa.created_at); this.shopL = L.id; } }
      B.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("on", (this.view || "all") === b.dataset.view));
      { const html = this.view === "dish" ? (dishHTML || `<p class="muted kc-empty">Noch keine Gerichte. Sag oder tipp zum Beispiel „Ich will Lasagne machen“.</p>`) : prodHTML + logHTML, le = B.querySelector("#kcslst"); if (this._lst !== html || !le.firstChild){ this._lst = html; le.innerHTML = html; } }
      const ftrHTML = `<div class="kc-shl">${this.lists.map(l => `<button class="chip ${l.id === L.id ? "on" : ""}" data-list="${l.id}">${h(l.name)}</button>`).join("")}<button class="chip" data-new>+ Liste</button></div>
        <div class="kc-shm">${[L.owner].concat(this.mem.filter(x => x !== L.owner)).map(id => `<span class="kc-av" title="${h(this.who(id))}">${avatar(id)}</span>`).join("")}<small class="muted">${this.mem.filter(x => x !== L.owner).length ? "teilen diese Liste" : own ? "Nur du" : ""}</small>${own ? `<button class="btn sm" data-share>Teilen</button>` : ""}</div>
        ${own && this.lists.length > 1 ? `<button class="kc-link" data-dellist>Diese Liste löschen</button>` : !own ? `<button class="kc-link" data-leave>Liste verlassen</button>` : ""}`; { const fe = B.querySelector("#kcsftr"); if (this._ftr !== ftrHTML || !fe.firstChild){ this._ftr = ftrHTML; fe.innerHTML = ftrHTML; } }
      this.wire(); },
    /* what you do shows at once; the server follows, and the list is read again afterwards */
    /* While a change of yours is still on its way to the server, nothing read from the server is shown: such an answer can be
       older than your tap and would flip the row back for a moment. The list is read again once all your changes have arrived */
    async mut(fn, q){ this.pend = (this.pend || 0) + 1; fn(); this.draw(); let r = null; try { r = await q; } catch(e) { r = {error: e}; } this.pend--; if (r && r.error) say("Ging nicht: " + (r.error.message || r.error)); if (!this.pend) await this.load(); },
    addMany(names, code){ const me = meId(), id = this.cur.id, par = this.addTo || null, rows = names.map(n => String(n).trim()).filter(Boolean).map(n => ({list_id: id, name: n.slice(0, 120), code: code || null, added_by: me, parent: par})); if (!rows.length) return;
      haptic(10); this.snd("Move"); return this.mut(() => rows.forEach((r, i) => this.items.push(Object.assign({id: "tmp" + Date.now() + i, kind: "product", tmp: 1}, r))), sb().from("shop_items").insert(rows)); },
    /* a whole sentence, typed or spoken: the AI sorts it into products and dishes with their ingredients */
    async sort(text){ text = String(text || "").trim(); if (text.length < 2) return; const sug = this.box.querySelector("#kcssug"); if (sug) sug.innerHTML = `<p class="kc-shwait">Sortiere „${h(text.slice(0, 60))}${text.length > 60 ? "…" : ""}“ …</p>`;
      try { const s2 = window.ChessSite && window.ChessSite.getSession(), r = await fetch("/api/kcal", {method: "POST", headers: {"Content-Type": "application/json", Authorization: "Bearer " + (s2 ? s2.access_token : "")}, body: JSON.stringify({mode: "shop", text})}), j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Ging nicht"); const me = meId(), id = this.cur.id, base = i => ({list_id: id, name: String(i.name).slice(0, 120), amount: i.amount ? String(i.amount).slice(0, 60) : null, added_by: me});
        if (!(j.products || []).length && !(j.dishes || []).length) throw new Error("Nichts erkannt");
        const par = this.addTo && this.items.some(x => x.id === this.addTo) ? this.addTo : null;
        if (par){ const rows = (j.products || []).concat(...(j.dishes || []).map(d => d.items)).map(i => Object.assign(base(i), {parent: par})); if (rows.length){ const a = await sb().from("shop_items").insert(rows); if (a.error) throw a.error; } }
        else if ((j.products || []).length){ const a = await sb().from("shop_items").insert(j.products.map(base)); if (a.error) throw a.error; }
        for (const d of par ? [] : j.dishes || []){ const a = await sb().from("shop_items").insert(Object.assign(base(d), {kind: "dish", amount: null})).select().single(); if (a.error) throw a.error;
          if (d.items.length){ const c = await sb().from("shop_items").insert(d.items.map(i => Object.assign(base(i), {parent: a.data.id}))); if (c.error) throw c.error; } }
        haptic([10, 30, 10]); this.snd("Move"); }
      catch(e) { say("Ging nicht: " + (e.message || e)); } if (sug && sug.querySelector(".kc-shwait")) sug.innerHTML = ""; await this.load(); },
    wire(){ const B = this.box, me = meId(), q = x => B.querySelector(x), all = (x, f) => B.querySelectorAll(x).forEach(b => b.onclick = () => f(b)), stamp = () => ({updated_by: me, updated_at: new Date().toISOString()}), real = i => i && !i.tmp;
      const gs = q("[data-gostore]"); if (gs) gs.onclick = () => { this.storePick = 1; this.snd("tap"); this.draw(); };
      all("[data-store]", b => { this.store = b.dataset.store || null; this.storePick = 0; try { this.store ? localStorage.setItem("chessnat-shop-store", this.store) : localStorage.removeItem("chessnat-shop-store"); } catch(e) {} haptic(10); this.snd("Move"); this.draw(); });
      all("[data-ask]", b => { if (b.classList.contains("on")) return this.unask(b.dataset.ask, b); b.classList.add("on"); this.ask("home", b.dataset.ask); });
      const nt = q("[data-noto]"); if (nt) nt.onclick = () => { this.addTo = null; this.draw(); };
      all("[data-to]", b => { this.addTo = b.dataset.to; this.snd("tap"); this.draw(); q("#kcsha").focus(); });
      all("[data-done]", b => { const i = this.items.find(x => x.id === b.dataset.done); if (!real(i)) return; const on = !i.done_by; haptic(12); this.snd(on ? "Capture" : "tap");
        /* ticking fast, one after the other: only this row is changed on the page (nothing is rebuilt under your finger, so no tap gets lost);
           the server follows in the background, and the list is read again only once you have paused */
        const at = on ? new Date().toISOString() : null; i.done_by = on ? me : null; i.done_at = at;
        B.querySelectorAll(`[data-done="${i.id}"]`).forEach(e => { const r = e.closest(".kc-shr"); if (!r) return; r.classList.toggle("done", on); const c = r.querySelector(".kc-shc"); if (c) c.textContent = on ? "✓" : ""; r.querySelectorAll(".kc-shbuy,.kc-shq").forEach(x => { x.style.display = on ? "none" : ""; }); });
        this.pend = (this.pend || 0) + 1; clearTimeout(this.calm);
        sb().from("shop_items").update(Object.assign({done_by: on ? me : null, done_at: at}, stamp())).eq("id", i.id).then(r => r, e => ({error: e})).then(r => { this.pend--; if (r && r.error) say("Ging nicht: " + (r.error.message || r.error)); if (!this.pend){ clearTimeout(this.calm); this.calm = setTimeout(() => { if (!this.pend) this.load(); }, 900); } }); });
      all("[data-claim]", b => { const i = this.items.find(x => x.id === b.dataset.claim); if (!real(i)) return; const on = i.claimed_by !== me; haptic(8); this.snd("tap");
        this.mut(() => { i.claimed_by = on ? me : null; }, sb().from("shop_items").update(Object.assign({claimed_by: on ? me : null}, stamp())).eq("id", i.id)); });
      /* removing takes two taps: the first one asks */
      all("[data-del]", b => { if (!b.dataset.armed){ b.dataset.armed = 1; b.classList.add("arm"); b.textContent = "Löschen?"; this.snd("tap"); setTimeout(() => { if (b.isConnected){ delete b.dataset.armed; b.classList.remove("arm"); b.textContent = "×"; } }, 2600); return; }
        const id = b.dataset.del; if (/^tmp/.test(id)) return; haptic(10); this.mut(() => { this.items = this.items.filter(x => x.id !== id && x.parent !== id); }, sb().from("shop_items").delete().eq("id", id)); });
      all("[data-list]", b => { this.snd("tap"); this.pick(b.dataset.list); });
      const cl = q("[data-clear]"); if (cl) cl.onclick = () => { const ids = (this.logIds || []).slice(); if (!ids.length) return; if (!cl.dataset.armed){ cl.dataset.armed = 1; cl.textContent = "Wirklich leeren?"; return; } this.mut(() => { this.items = this.items.filter(x => !ids.includes(x.id)); }, sb().from("shop_items").delete().in("id", ids)); };
      q("[data-new]").onclick = async () => { const n = (prompt("Wie heißt die neue Liste?") || "").trim(); if (!n) return; const r = await sb().from("shop_lists").insert({owner: me, name: n.slice(0, 60)}).select().single(); if (r.error) return say("Ging nicht: " + r.error.message); this.lists.push(r.data); this.pick(r.data.id); };
      const sh = q("[data-share]"); if (sh) sh.onclick = () => this.share();
      const dl = q("[data-dellist]"); if (dl) dl.onclick = async () => { if (!dl.dataset.armed){ dl.dataset.armed = 1; dl.textContent = "Wirklich löschen?"; return; } const r = await sb().from("shop_lists").delete().eq("id", this.cur.id); if (r.error) return say("Ging nicht: " + r.error.message); await this.loadLists(); this.pick(this.lists[0].id); };
      const lv = q("[data-leave]"); if (lv) lv.onclick = async () => { await sb().from("shop_members").delete().eq("list_id", this.cur.id).eq("user_id", me); await this.loadLists(); if (this.lists.length) this.pick(this.lists[0].id); else this.sh.close(); }; },
    /* the owner picks the friends who share this list */
    share(){ const me = meId(), fr = (typeof Social !== "undefined" ? Social.data.friends : []).filter(r => r.status === "accepted").map(r => r.a === me ? r.b : r.a), id = this.cur.id;
      const s2 = detailSheet(`<div class="kc-shop" data-notr><h3>Wer teilt „${h(this.cur.name)}“?</h3>${fr.length ? `<div class="kc-fr">${fr.map(f => `<div class="kc-frr"><span class="kc-av">${avatar(f)}</span><span class="kc-frm"><b>${h(pname(f))}</b></span><button class="btn sm ${this.mem.includes(f) ? "" : "go"}" data-m="${h(f)}">${this.mem.includes(f) ? "Dabei ✓" : "Hinzufügen"}</button></div>`).join("")}</div>` : `<p class="muted">Füg erst unter Freunde jemanden hinzu.</p>`}<button class="btn go big" data-dclose style="margin-top:10px">Fertig</button></div>`, () => this.load()); s2.el.style.zIndex = 320;
      s2.el.querySelectorAll("[data-m]").forEach(b => b.onclick = async () => { const f = b.dataset.m, on = this.mem.includes(f); b.disabled = true;
        const r = on ? await sb().from("shop_members").delete().eq("list_id", id).eq("user_id", f) : await sb().from("shop_members").insert({list_id: id, user_id: f}); b.disabled = false; if (r.error) return say("Ging nicht: " + r.error.message);
        this.mem = on ? this.mem.filter(x => x !== f) : this.mem.concat(f); b.textContent = on ? "Hinzufügen" : "Dabei ✓"; b.classList.toggle("go", on); haptic(8); }); } };
  (function w(n){ try { if (meId() && sb()) return Shop.watch(); } catch(e) {} if (n < 90) setTimeout(() => w(n + 1), 2000); })(0);

  /* ===== Household: chores and the bin plan. One household (home_groups) with the people who live there; things to do
     (home_tasks) are asked of whoever's turn it is ("Mach ich" / "Kann nicht", the database passes it on and remembers who
     passed) or of everyone at once; whoever takes one has it as a tick box at the top of their start page, and ticking it
     tells the others. All changes of state run in the database (home_answer, home_done), which also sends the pushes. ===== */
  const Haus = { g: null, mem: [], tasks: [], log: [], sh: null, seen: {}, loaded: false,
    COLS: "id,group_id,title,emoji,note,kind,every_days,everyone,due_at,ask_at,state,asked,asked_at,passed,taken_by,taken_at,done_by,done_at,created_by,created_at",
    QUICK: [["🗑️", "Müll rausbringen"], ["🚿", "Bad putzen"], ["🍳", "Küche aufräumen"], ["🍽️", "Spülmaschine ausräumen"], ["🧹", "Staubsaugen"], ["🧺", "Wäsche machen"]],
    BINS: [["⚫", "Schwarze Tonne"], ["🟡", "Gelbe Tonne"], ["🟤", "Biotonne"], ["🔵", "Papiertonne"]],
    people(){ return this.g ? [this.g.owner].concat(this.mem.filter(x => x !== this.g.owner)) : []; },
    who(id){ return id === meId() ? "Du" : pname(id); },
    emojiFor(t){ const x = t.toLowerCase(); return /müll|tonne|abfall|papier|glas/.test(x) ? "🗑️" : /bad|dusch|klo|toilet|wc/.test(x) ? "🚿" : /küche|herd|kochen/.test(x) ? "🍳" : /spül|geschirr|abwasch/.test(x) ? "🍽️" : /saug|wisch|boden|fegen/.test(x) ? "🧹" : /wäsche|wasch/.test(x) ? "🧺" : /einkauf/.test(x) ? "🛒" : /pflanz|gieß|blume/.test(x) ? "🪴" : "🧹"; },
    day(d){ const a = new Date(d), t0 = new Date(); t0.setHours(0, 0, 0, 0); const n = Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()) - t0) / 864e5);
      return n === 0 ? "heute" : n === 1 ? "morgen" : n === -1 ? "gestern" : a.toLocaleDateString("de-DE", {weekday: "short", day: "2-digit", month: "2-digit"}); },
    when(t){ return t.kind === "plan" && t.due_at ? "Abholung " + this.day(t.due_at) : t.kind === "repeat" ? (t.every_days === 1 ? "täglich" : t.every_days === 7 ? "wöchentlich" : "alle " + t.every_days + " Tage") : ""; },
    async load(){ if (!meId() || !sb()) return; const my = this.lseq = (this.lseq || 0) + 1;
      const gr = await sb().from("home_groups").select("*").order("created_at"); if (gr.error || my !== this.lseq) return; this.loaded = true; this.g = (gr.data || [])[0] || null;
      if (!this.g){ this.mem = []; this.tasks = []; this.log = []; this.paint(); if (this.sh) this.draw(); return; }
      const id = this.g.id, [m, t, l] = await Promise.all([sb().from("home_members").select("user_id").eq("group_id", id),
        sb().from("home_tasks").select(this.COLS).eq("group_id", id).in("state", ["wait", "asked", "open", "taken"]).order("ask_at").order("id"),
        sb().from("home_log").select("user_id,what,title,emoji,at").eq("group_id", id).gte("at", new Date(Date.now() - 30 * 864e5).toISOString()).order("at", {ascending: false}).limit(400)]);
      if (my !== this.lseq) return; this.mem = (m.data || []).map(x => x.user_id); this.tasks = t.data || []; this.log = l.data || []; this.paint(); if (this.sh) this.draw(); this.cards(); this.hearts();
      /* with an address saved, new collection dates come in by themselves (looked up at most every twelve hours) */
      if (this.where()){ let last = 0; try { last = +localStorage.getItem("chessnat-muell") || 0; } catch(e) {} if (Date.now() - last > 12 * 3600e3) this.sync().then(n => { if (n > 0) this.load(); }); } },
    /* what concerns me right now: asked of me (or of everyone and I haven't said no), and what I took */
    asks(){ const me = meId(); return this.tasks.filter(t => (t.state === "asked" && t.asked === me) || (t.state === "open" && !(t.passed || []).includes(me))); },
    todos(){ const me = meId(); return this.tasks.filter(t => t.state === "taken" && t.taken_by === me); },
    /* the start page: questions and my tick boxes at the very top, and the next collection on the tile */
    paint(){ const el = document.querySelector("#hsslot"); if (el){ const a = this.asks(), d = this.todos();
        const x = a.map(t => `<div class="hs-ask"><span class="hs-e">${h(t.emoji)}</span><span class="hs-tx"><b>${t.state === "open" ? "Wer übernimmt das?" : "Du bist dran"}</b>${h(t.title)}${this.when(t) ? `<small>${h(this.when(t))}</small>` : ""}</span><button class="btn sm go" data-hs-yes="${h(t.id)}">Mach ich</button><button class="btn sm" data-hs-no="${h(t.id)}">Kann nicht</button></div>`).join("")
          + d.map(t => `<button class="hs-todo" data-hs-done="${h(t.id)}"><i class="hs-box"></i><span class="hs-e">${h(t.emoji)}</span><span class="hs-tx">${h(t.title)}${this.when(t) ? `<small>${h(this.when(t))}</small>` : ""}</span></button>`).join("");
        if (el._x !== x){ el._x = x; el.innerHTML = x; } }
      const sm = document.querySelector("#hsnext"); if (sm){ const n = this.tasks.filter(t => t.kind === "plan" && t.due_at).sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at))[0], o = this.tasks.filter(t => t.kind !== "plan" && t.state !== "wait").length;
        sm.textContent = n ? `${n.emoji} ${n.title} · ${this.day(n.due_at)}` : o ? `${o} offen` : "Müllplan & Aufgaben"; } },
    async answer(id, yes){ const t = this.tasks.find(x => x.id === id); const r = await sb().rpc("home_answer", {p_task: id, p_yes: !!yes}); if (r.error) return say("Ging nicht: " + r.error.message);
      haptic(yes ? [10, 30, 10] : 10); say(r.data === "gone" ? "Das hat schon jemand übernommen" : r.data === "closed" ? "Ist schon erledigt" : yes ? "Steht jetzt oben auf deiner Startseite ✓" : t && t.state === "open" ? "Alles klar" : "Alles klar, der Nächste wird gefragt"); this.load(); },
    async done(id, el){ const t = this.tasks.find(x => x.id === id); if (el){ el.classList.add("ok"); el.disabled = true; } haptic([10, 40, 20]); try { Sound.play("GenericNotify", .6); } catch(e) {}
      const r = await sb().rpc("home_done", {p_task: id}); if (r.error){ if (el){ el.classList.remove("ok"); el.disabled = false; } return say("Ging nicht: " + r.error.message); }
      say(`✅ ${t ? t.title : "Erledigt"}: ${this.people().length > 1 ? "alle wissen Bescheid" : "abgehakt"}`); setTimeout(() => this.load(), el ? 500 : 0); },
    /* a question comes in while the app is open: a card to answer right there (with the photo, if there is one) */
    async cards(){ const me = meId(); for (const t of this.asks()){ const k = t.id + t.state + (t.asked_at || ""); if (this.seen[k] || t.created_by === me && t.state === "open") continue; this.seen[k] = 1;
        let img = null; try { const r = await sb().from("home_tasks").select("img").eq("id", t.id).maybeSingle(); img = r.data && r.data.img; } catch(e) {}
        const sh = detailSheet(`<div class="kc-askc" data-notr><div class="kc-aske">${h(t.emoji)}</div><h3>${t.state === "open" ? h(this.who(t.created_by)) + " fragt: Wer übernimmt das?" : "Du bist dran"}</h3><p class="kc-askq"><b>${h(t.title)}</b></p>${this.when(t) ? `<p class="kc-askn">${h(this.when(t))}</p>` : ""}${t.note ? `<p class="kc-askn">„${h(t.note)}“</p>` : ""}${img && /^data:image\//.test(img) ? `<img class="hs-img" src="${img}" alt="">` : ""}<div class="kc-askb"><button class="btn go big" data-y>Mach ich</button><button class="btn big" data-n>Kann nicht</button></div></div>`);
        sh.el.style.zIndex = 330; try { Sound.play("GenericNotify", .7); } catch(e) {} haptic([10, 30, 10]);
        sh.el.querySelector("[data-y]").onclick = () => { sh.close(); this.answer(t.id, true); }; sh.el.querySelector("[data-n]").onclick = () => { sh.close(); this.answer(t.id, false); }; } },
    /* a heart as a thank-you: for everything someone else ticked off in the last 24 hours that I haven't thanked for yet, a card
       with an empty heart. It fills while you hold it (three seconds, a tick of vibration at every eighth), runs empty again when
       you let go early, and only a full heart closes the card; then the one who did it hears "… sagt Danke". */
    async hearts(){ const me = meId(); if (!this.g || this.hearting) return;
      const d = await sb().from("home_tasks").select("id,title,emoji,done_by,done_at").eq("group_id", this.g.id).eq("state", "done").neq("done_by", me).gte("done_at", new Date(Date.now() - 864e5).toISOString()).order("done_at", {ascending: false}).limit(3); if (d.error || !(d.data || []).length) return;
      const th = await sb().from("home_thanks").select("task_id").eq("user_id", me).in("task_id", d.data.map(x => x.id)); if (th.error) return; const got = (th.data || []).map(x => x.task_id);
      const q = d.data.filter(x => !got.includes(x.id) && !this.seen["h" + x.id]).reverse(); if (!q.length || this.hearting) return; this.hearting = true;
      const next = () => { const t = q.shift(); if (!t){ this.hearting = false; return; } this.seen["h" + t.id] = 1; this.heart(t, next); }; next(); },
    heart(t, after){ const who = pname(t.done_by), ov = document.createElement("div"); ov.className = "hs-hov"; ov.setAttribute("data-notr", ""); ov.lang = "de";
      const P = "M50 88 C 20 66, 6 50, 6 31 C 6 16, 17 7, 29 7 C 38 7, 46 12, 50 20 C 54 12, 62 7, 71 7 C 83 7, 94 16, 94 31 C 94 50, 80 66, 50 88 Z";
      ov.innerHTML = `<div class="hs-hc"><small>${h(who)} hat das erledigt</small><b>${h(t.emoji || "")} ${h(t.title)}</b>
        <div class="hs-heart" role="button" aria-label="Herz gedrückt halten"><svg viewBox="0 0 100 96"><defs><clipPath id="hsclip"><rect id="hsfill" x="0" y="96" width="100" height="96"/></clipPath></defs><path d="${P}" fill="rgba(255,255,255,.06)" stroke="#FF6B8A" stroke-width="4" stroke-linejoin="round"/><path d="${P}" fill="#FF4D73" clip-path="url(#hsclip)"/></svg></div>
        <p id="hstx">Halte das Herz gedrückt, um Danke zu sagen</p></div>`;
      document.body.appendChild(ov); if (ov.animate) ov.animate([{opacity: 0}, {opacity: 1}], {duration: 220, easing: "ease-out"});
      const el = ov.querySelector(".hs-heart"), fill = ov.querySelector("#hsfill"), tx = ov.querySelector("#hstx"); let p = 0, hold = false, done = false, last = 0, step = 0, raf = 0;
      const frame = now => { raf = 0; const dt = Math.min(64, now - (last || now)); last = now; if (done) return;
        p = Math.max(0, Math.min(1, p + (hold ? dt / 3000 : -dt / 700))); fill.setAttribute("y", String(96 - 96 * p)); el.style.transform = `scale(${1 + p * .12})`;
        const s8 = Math.floor(p * 8); if (hold && s8 > step){ haptic(10 + s8 * 3); try { Sound.tap(); } catch(e) {} } step = s8;
        if (p >= 1) return finish(); if (hold || p > 0) raf = requestAnimationFrame(frame); else last = 0; };
      const down = e => { e.preventDefault(); if (done) return; hold = true; tx.textContent = "Weiter halten …"; if (!raf){ last = 0; raf = requestAnimationFrame(frame); } };
      const up = () => { if (done || !hold) return; hold = false; tx.textContent = "Nicht loslassen. Halte das Herz, bis es voll ist"; };
      const finish = () => { done = true; hold = false; haptic([20, 50, 20, 50, 70]); try { Sound.play("GenericNotify", .8); } catch(e) {} el.classList.add("full"); el.style.transform = ""; tx.innerHTML = `<b>Dankeschön, ${h(who)}!</b>`;
        sb().from("home_thanks").insert({task_id: t.id, user_id: meId()}).then(() => {}, () => {});
        setTimeout(() => { const end = () => { ov.remove(); after && after(); }; if (ov.animate){ const an = ov.animate([{opacity: 1}, {opacity: 0}], {duration: 240, easing: "ease-in"}); an.onfinish = end; } else end(); }, 1500); };
      el.addEventListener("pointerdown", down); ["pointerup", "pointercancel", "pointerleave"].forEach(k => el.addEventListener(k, up)); el.addEventListener("contextmenu", e => e.preventDefault()); },
    watch(){ if (this.watching) return; this.watching = 1; const me = meId(); let tm = 0; const again = () => { clearTimeout(tm); tm = setTimeout(() => this.load(), 350); };
      sb().channel("home-" + me).on("postgres_changes", {event: "*", schema: "public", table: "home_tasks"}, p => { const n = p.new, o = p.old || {};
        if (n && n.state === "taken" && n.taken_by && n.taken_by !== me && o.state !== "taken" && !this.seen["t" + n.id + n.taken_at]){ this.seen["t" + n.id + n.taken_at] = 1; say(`${n.emoji || ""} ${pname(n.taken_by)} übernimmt: ${n.title}`, 3600); }
        again(); })
        .on("postgres_changes", {event: "*", schema: "public", table: "home_members"}, again)
        .on("postgres_changes", {event: "INSERT", schema: "public", table: "home_thanks"}, async p => { const n = p.new; if (!n || n.user_id === me || this.seen["th" + n.task_id + n.user_id]) return; this.seen["th" + n.task_id + n.user_id] = 1;
          const r = await sb().from("home_tasks").select("title,emoji,done_by").eq("id", n.task_id).maybeSingle(); if (!r.data || r.data.done_by !== me) return; say(`❤️ ${pname(n.user_id)} sagt Danke: ${r.data.emoji || ""} ${r.data.title}`, 4600); haptic([15, 40, 15]); try { Sound.play("GenericNotify", .7); } catch(e) {} })
        .subscribe();
      setInterval(() => { if (!document.hidden && (this.g || this.sh)) this.load(); }, 90000); document.addEventListener("visibilitychange", () => { if (!document.hidden) this.load(); });
      document.addEventListener("click", e => { const c = e.target.closest && e.target.closest("[data-hs-yes],[data-hs-no],[data-hs-done],[data-hs-take]"); if (!c) return; e.preventDefault(); e.stopPropagation(); const d = c.dataset;
        if (d.hsYes || d.hsTake) this.answer(d.hsYes || d.hsTake, true); else if (d.hsNo) this.answer(d.hsNo, false); else this.done(d.hsDone, c); }, true);
      this.load(); },

    /* ---- the household screen ---- */
    async open(){ if (!meId() || !sb()) return say("Bitte erst anmelden");
      const ov = document.createElement("div"); ov.className = "kc-sov hs-ov"; ov.setAttribute("data-notr", ""); ov.lang = "de";
      ov.innerHTML = `<div class="kc-sovt"><b class="kc-shtt"><span style="font-size:22px">🏠</span><span>Haushalt</span></b><button class="kc-sx" id="hsx">Fertig</button></div><div class="kc-sovb" id="hsb"><p class="muted">Lädt …</p></div>`;
      document.body.appendChild(ov); document.documentElement.classList.add("kc-sopen"); const body = this.box = ov.querySelector("#hsb"); let closed = false;
      const vv = window.visualViewport, fit = () => { if (!vv || closed) return; const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); body.style.paddingBottom = (kb + 24) + "px"; ov.style.transform = vv.offsetTop ? `translateY(${vv.offsetTop}px)` : ""; };
      if (vv){ vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit); fit(); }
      const close = () => { if (closed) return; closed = true; if (vv){ vv.removeEventListener("resize", fit); vv.removeEventListener("scroll", fit); } try { document.activeElement && document.activeElement.blur(); } catch(e) {} document.documentElement.classList.remove("kc-sopen"); this.sh = null; this.built = false;
        if (ov.animate){ const an = ov.animate([{opacity: 1}, {opacity: 0}], {duration: 160, easing: "ease-in"}); an.onfinish = () => ov.remove(); } else ov.remove(); };
      ov.querySelector("#hsx").onclick = close; this.sh = {el: ov, close}; this.built = false; this.form = {emoji: null, who: "turn", rep: 0, img: null, bin: 0};
      if (ov.animate) ov.animate([{opacity: 0}, {opacity: 1}], {duration: 200, easing: "ease-out"});
      await this.load();
      if (!this.g){ const r = await sb().from("home_groups").insert({owner: meId(), name: "Zuhause"}).select().single(); if (r.error){ body.innerHTML = `<p class="muted">Ging nicht: ${h(r.error.message)}</p>`; return; } await this.load(); } },
    /* the form at the top is built once (typing is never interrupted); the lists below it are redrawn */
    draw(){ if (!this.sh || !this.g) return; const B = this.box, me = meId(), F = this.form;
      if (!this.built){ this.built = true; const d0 = new Date(Date.now() + 864e5), iso = d0.getFullYear() + "-" + String(d0.getMonth() + 1).padStart(2, "0") + "-" + String(d0.getDate()).padStart(2, "0");
        B.innerHTML = `<div id="hsme"></div>
          <div class="hs-card"><div class="hs-h">Neue Aufgabe</div><input id="hsti" maxlength="80" placeholder="Was ist zu tun? z. B. Küche aufräumen" enterkeyhint="done" autocomplete="off">
            <div class="kc-chips hs-quick">${this.QUICK.map((q, i) => `<button class="chip" data-q="${i}">${q[0]} ${h(q[1])}</button>`).join("")}</div>
            <div class="hs-seg" data-seg="who"><button data-v="turn" class="on">Wer dran ist</button><button data-v="all">Alle fragen</button></div>
            <div class="hs-seg" data-seg="rep"><button data-v="0" class="on">Einmalig</button><button data-v="1">Täglich</button><button data-v="7">Wöchentlich</button><button data-v="14">Alle 2 Wochen</button></div>
            <div class="hs-row"><label class="btn hs-pic"><input type="file" accept="image/*" id="hsf" hidden>📷 Foto</label><button class="btn go" id="hsadd">Anlegen</button></div><div id="hsprev"></div></div>
          <div id="hsopen"></div>
          <div class="hs-card"><div class="hs-h">Müllplan</div><div id="hsaddr"></div><div id="hsplan"></div><div class="hs-h">Termin von Hand</div>
            <div class="kc-chips hs-bins">${this.BINS.map((b, i) => `<button class="chip ${i === 0 ? "on" : ""}" data-bin="${i}">${b[0]} ${h(b[1])}</button>`).join("")}</div>
            <div class="hs-row"><input type="date" id="hspd" value="${iso}"><button class="btn go" id="hspadd">Termin eintragen</button></div></div>
          <div class="hs-card"><div class="hs-h">Wer hat wie viel gemacht · 30 Tage</div><div id="hsstat"></div></div>
          <div class="hs-card"><div class="hs-h">Wer wohnt hier</div><div id="hsmem"></div></div>`;
        const q = x => B.querySelector(x), ti = q("#hsti");
        B.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { const Q = this.QUICK[+b.dataset.q]; ti.value = Q[1]; F.emoji = Q[0]; haptic(6); });
        ti.oninput = () => { F.emoji = null; };
        B.querySelectorAll(".hs-seg").forEach(sg => sg.querySelectorAll("button").forEach(b => b.onclick = () => { sg.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); F[sg.dataset.seg] = sg.dataset.seg === "rep" ? +b.dataset.v : b.dataset.v; haptic(6); }));
        B.querySelectorAll("[data-bin]").forEach(b => b.onclick = () => { F.bin = +b.dataset.bin; B.querySelectorAll("[data-bin]").forEach(x => x.classList.toggle("on", x === b)); haptic(6); });
        /* a photo is shrunk on the phone (longest side 900 px, JPEG) so it fits into the task */
        q("#hsf").onchange = e => { const f = e.target.files && e.target.files[0]; if (!f) return; const im = new Image(), url = URL.createObjectURL(f); im.onload = () => { const k = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
            let d = c.toDataURL("image/jpeg", .55); if (d.length > 380000) d = c.toDataURL("image/jpeg", .3); URL.revokeObjectURL(url); if (d.length > 380000) return say("Das Bild ist zu groß"); F.img = d; q("#hsprev").innerHTML = `<div class="hs-prev"><img src="${d}" alt=""><button class="btn sm" id="hsrm">Entfernen</button></div>`; q("#hsrm").onclick = () => { F.img = null; q("#hsprev").innerHTML = ""; }; };
          im.onerror = () => say("Das Bild ließ sich nicht lesen"); im.src = url; };
        const add = async () => { const t = ti.value.trim(); if (!t){ ti.focus(); return say("Schreib kurz, was zu tun ist"); } const b = q("#hsadd"); b.disabled = true;
          const r = await sb().from("home_tasks").insert({group_id: this.g.id, title: t.slice(0, 80), emoji: F.emoji || this.emojiFor(t), kind: F.rep ? "repeat" : "once", every_days: F.rep || null, everyone: F.who === "all", img: F.img, created_by: me}); b.disabled = false;
          if (r.error) return say("Ging nicht: " + r.error.message); ti.value = ""; F.emoji = null; F.img = null; q("#hsprev").innerHTML = ""; try { ti.blur(); } catch(e) {} haptic([10, 30, 10]);
          say(this.people().length < 2 ? "Angelegt ✓" : F.who === "all" ? "Alle werden gefragt ✓" : "Wer dran ist, wird gefragt ✓"); this.load(); };
        q("#hsadd").onclick = add; ti.onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); add(); } };
        q("#hspadd").onclick = async () => { const v = q("#hspd").value, m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v); if (!m) return say("Wähl ein Datum"); const bin = this.BINS[F.bin];
          const due = new Date(+m[1], +m[2] - 1, +m[3], 6, 0, 0), ask = new Date(+m[1], +m[2] - 1, +m[3] - 1, 17, 0, 0); if (due.getTime() < Date.now() - 12 * 3600e3) return say("Der Tag ist schon vorbei");
          const r = await sb().from("home_tasks").insert({group_id: this.g.id, title: bin[1], emoji: bin[0], kind: "plan", due_at: due.toISOString(), ask_at: new Date(Math.max(ask.getTime(), Date.now())).toISOString(), created_by: me});
          if (r.error) return say("Ging nicht: " + r.error.message); haptic(10); say(`${bin[0]} ${bin[1]} · ${this.day(due)} eingetragen ✓`); this.load(); }; }
      const set = (id, x) => { const el = B.querySelector(id); if (el && el._x !== x){ el._x = x; el.innerHTML = x; } }, mine = t => t.created_by === me || this.g.owner === me;
      const status = t => t.state === "taken" ? `${this.who(t.taken_by)} ${t.taken_by === me ? "machst" : "macht"} das` : t.state === "asked" ? `${this.who(t.asked)} ${t.asked === me ? "bist" : "ist"} gefragt` : t.state === "open" ? "Alle sind gefragt" : "Gefragt wird " + this.day(t.ask_at) + ", " + new Date(t.ask_at).toLocaleTimeString("de-DE", {hour: "2-digit", minute: "2-digit"}) + " Uhr";
      const row = t => `<div class="hs-t"><span class="hs-e">${h(t.emoji)}</span><span class="hs-tx">${h(t.title)}<small>${h([this.when(t), status(t)].filter(Boolean).join(" · "))}</small></span>${t.state === "taken" && t.taken_by === me ? `<button class="btn sm go" data-hs-done="${h(t.id)}">Erledigt ✓</button>` : t.state === "taken" ? "" : `<button class="btn sm" data-hs-take="${h(t.id)}">Ich mach's</button>`}${mine(t) ? `<button class="hs-del" data-del="${h(t.id)}" aria-label="Löschen">✕</button>` : ""}</div>`;
      const a = this.asks(), d = this.todos();
      set("#hsme", !this.mem.length && this.g.owner === me ? `<div class="hs-hint">Noch wohnst du hier allein. Füg unten deine Mitbewohner hinzu, dann werden Aufgaben reihum verteilt.</div>` : "");
      const open = this.tasks.filter(t => t.kind !== "plan"), plan = this.tasks.filter(t => t.kind === "plan").sort((x, y) => Date.parse(x.due_at) - Date.parse(y.due_at));
      set("#hsopen", `<div class="hs-card"><div class="hs-h">Aufgaben${open.length ? " · " + open.length : ""}</div>${open.map(row).join("") || `<p class="muted">Gerade ist nichts offen.</p>`}</div>`);
      set("#hsaddr", this.g.ort && this.g.strasse ? `<div class="hs-adr"><span><b>📍 ${h(this.g.strasse)}, ${h(this.g.ort)}</b><small>Die Abholtermine kommen von selbst.</small></span>${this.g.owner === me ? `<button class="btn sm" data-addr>Ändern</button>` : ""}</div>`
        : this.g.owner === me ? `<button class="btn go" data-addr>📍 Adresse eintragen, Termine kommen von selbst</button>` : "");
      const ad = B.querySelector("[data-addr]"); if (ad) ad.onclick = () => this.addr();
      set("#hsplan", plan.map(row).join("") || `<p class="muted">Noch keine Termine. Am Abend vor jeder Abholung um 17 Uhr wird gefragt, wer die Tonne rausstellt.</p>`);
      const P = this.people(), cnt = P.map(u => ({u, n: this.log.filter(l => l.user_id === u && l.what === "done").length, p: this.log.filter(l => l.user_id === u && l.what !== "done").length})).sort((x, y) => y.n - x.n), mx = Math.max(1, ...cnt.map(c => c.n));
      set("#hsstat", cnt.map(c => `<div class="hs-st"><span class="hs-sn">${h(this.who(c.u))}</span><span class="hs-bar"><i style="width:${Math.round(c.n / mx * 100)}%"></i></span><b>${c.n}</b>${c.p ? `<small>${c.p}× abgegeben</small>` : ""}</div>`).join("")
        + (this.log.filter(l => l.what === "done").slice(0, 6).map(l => `<div class="hs-lg">${h(l.emoji || "✅")} ${h(this.who(l.user_id))}: ${h(l.title)} <small>${h(this.day(l.at))}</small></div>`).join("")));
      set("#hsmem", `<div class="hs-who">${P.map(u => `<span class="chip">${h(this.who(u))}${u === this.g.owner ? " · Gründer" : ""}</span>`).join("")}</div>${this.g.owner === me ? `<button class="btn" data-share>Mitbewohner hinzufügen</button>` : `<button class="btn" data-leave>Haushalt verlassen</button>`}`);
      B.querySelectorAll("[data-del]").forEach(b => b.onclick = async e => { e.stopPropagation(); const r = await sb().from("home_tasks").delete().eq("id", b.dataset.del); if (r.error) return say("Ging nicht: " + r.error.message); haptic(8); this.load(); });
      const sh = B.querySelector("[data-share]"); if (sh) sh.onclick = () => this.share(); const lv = B.querySelector("[data-leave]"); if (lv) lv.onclick = async () => { await sb().from("home_members").delete().eq("group_id", this.g.id).eq("user_id", me); this.sh.close(); this.load(); }; },
    /* the address, on a screen of its own with the one field at the very top (so the keyboard never covers it): type street, house
       number and town in one go, complete addresses come up as suggestions (like at a checkout), one tap picks it and the
       region's calendar is found from it */
    addr(){ const ov = document.createElement("div"); ov.className = "kc-sov hs-ov"; ov.style.zIndex = 310; ov.setAttribute("data-notr", ""); ov.lang = "de";
      ov.innerHTML = `<div class="kc-sovt"><b class="kc-shtt"><span style="font-size:22px">📍</span><span>Wo wohnt ihr?</span></b><button class="kc-sx" id="hsax">Abbrechen</button></div><div class="hs-abar"><input id="hsai" maxlength="80" placeholder="Straße, Hausnummer, Ort" enterkeyhint="search" autocomplete="street-address" autocorrect="off" spellcheck="false"></div><div class="kc-sovb" id="hsal"><p class="muted">Tipp eure Adresse ein, z. B. „Geiglbergstr 2a Wang“.</p></div>`;
      document.body.appendChild(ov); const inp = ov.querySelector("#hsai"), list = ov.querySelector("#hsal"); let closed = false, seq = 0, tm = 0, items = [];
      const vv = window.visualViewport, fit = () => { if (!vv || closed) return; const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); list.style.paddingBottom = (kb + 24) + "px"; ov.style.transform = vv.offsetTop ? `translateY(${vv.offsetTop}px)` : ""; };
      if (vv){ vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit); fit(); }
      const close = () => { if (closed) return; closed = true; clearTimeout(tm); if (vv){ vv.removeEventListener("resize", fit); vv.removeEventListener("scroll", fit); } try { inp.blur(); } catch(e) {} if (ov.animate){ const an = ov.animate([{opacity: 1}, {opacity: 0}], {duration: 160, easing: "ease-in"}); an.onfinish = () => ov.remove(); } else ov.remove(); };
      ov.querySelector("#hsax").onclick = close; if (ov.animate) ov.animate([{opacity: 0}, {opacity: 1}], {duration: 200, easing: "ease-out"});
      const msg = t => { list.innerHTML = `<p class="muted">${t}</p>`; };
      /* while typing the suggestions come by themselves; when that search is down, one tap on "Adresse suchen" (or Enter) asks the slower one */
      const find = async go => { const t = inp.value.trim(), my = ++seq; if (t.length < 3) return msg("Tipp eure Adresse ein, z. B. „Geiglbergstr 2a Wang“."); if (go) msg("Suche …");
        try { const r = await fetch("/api/muell?suggest=" + encodeURIComponent(t) + (go ? "&go=1" : "")), j = await r.json(); if (my !== seq || closed) return; if (!r.ok) throw new Error(j.error || "HTTP " + r.status); items = j.list || [];
          if (j.slow || (!items.length && !go)){ list.innerHTML = `<button class="btn go big" id="hsgo">Adresse suchen</button><p class="muted">Schreib Straße, Hausnummer und Ort aus, dann tippe auf „Adresse suchen“.</p>`; list.querySelector("#hsgo").onclick = () => find(true); return; }
          list.innerHTML = items.map((x, i) => `<button class="hs-ai" data-i="${i}"><b>${h(x.street)}${x.hnr ? " " + h(x.hnr) : ""}</b><small>${h([x.plz, x.city].filter(Boolean).join(" "))}${x.county ? " · " + h(x.county) : ""}</small></button>`).join("") || `<p class="muted">Nichts gefunden. Schreib Straße und Ort aus.</p>`;
          list.querySelectorAll("[data-i]").forEach(b => b.onclick = () => choose(items[+b.dataset.i])); }
        catch(e) { if (my === seq) msg("Die Adresssuche ist gerade nicht erreichbar. Probier es gleich nochmal."); } };
      const choose = async a => { haptic(8); seq++; try { inp.blur(); } catch(e) {} msg(`Suche den Abfuhrplan für ${h(a.label)} …`);
        let n; try { n = await this.fetchPlan(a); } catch(e) { n = {err: "net"}; }
        if (n.err){ if (n.err === "unsupported" || n.err === "empty"){ try { sb().from("home_plan_wishes").insert({user_id: meId(), city: a.city, county: a.county, state: a.state, why: n.err}).then(() => {}, () => {}); } catch(e) {} }
          list.innerHTML = `<div class="hs-hint">${n.err === "street" ? `Im Abfuhrkalender von ${h(a.county || a.city)} steht die ${h(a.street)} nicht. Probier eine Nachbarstraße oder den Ortsteil.` : n.err === "net" ? "Der Abfuhrkalender ist gerade nicht erreichbar. Probier es später nochmal." : `Für ${h(a.county || a.city)} ist noch kein Abfuhrkalender angebunden. Ich habe den Wunsch notiert. Bis dahin kannst du die Termine von Hand eintragen.`}</div>`; return; }
        const two = {ort: ((a.plz ? a.plz + " " : "") + a.city).slice(0, 80), strasse: (a.street + (a.hnr ? " " + a.hnr : "")).slice(0, 80)};
        const r = await sb().from("home_groups").update(two).eq("id", this.g.id); if (r.error){ say("Ging nicht: " + r.error.message); return close(); }
        sb().from("home_groups").update({addr: a}).eq("id", this.g.id).then(() => {}, () => {}); Object.assign(this.g, two, {addr: a}); const k = await this.sync(n.termine); close(); say(k > 0 ? `📍 ${k} Abholtermine eingetragen ✓` : "📍 Adresse gespeichert, alle Termine sind schon drin ✓", 3600); this.load(); };
      inp.oninput = () => { clearTimeout(tm); tm = setTimeout(() => find(false), 280); }; inp.onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); const b = list.querySelector("[data-i]"); if (b) b.click(); else { clearTimeout(tm); find(true); } } };
      try { inp.focus(); } catch(e) {} /* the keyboard opens right away: one tap less */ },
    /* the dates for an address: {termine} or {err: "unsupported" | "street" | "empty" | "net"} */
    async fetchPlan(a){ const qs = a.street != null ? ["street", "hnr", "plz", "city", "district", "county", "state", "alt"].map(k => k + "=" + encodeURIComponent(a[k] || "")).join("&") : "ort=" + encodeURIComponent(a.ort) + "&strasse=" + encodeURIComponent(a.strasse);
      const r = await fetch("/api/muell?" + qs), j = await r.json().catch(() => ({})); if (!r.ok) return {err: "net"}; if (j.error) return {err: j.error}; return (j.termine || []).length ? {termine: j.termine} : {err: "empty"}; },
    /* the address a household saved: the full one, or (until the database has that column) rebuilt from "85368 Wang" and "Geiglbergstraße 2a"; the first version saved town and street only */
    where(){ const g = this.g; if (!g) return null; if (g.addr && g.addr.street) return g.addr; const m = /^(\d{5}) (.+)$/.exec(g.ort || ""); if (m && g.strasse){ const n = /^(.*?)\s+(\d+\s?[a-zA-Z]?)$/.exec(g.strasse) || [0, g.strasse, ""]; return {street: n[1], hnr: n[2], plz: m[1], city: m[2]}; }
      return g.ort && g.strasse ? {ort: g.ort, strasse: g.strasse} : null; },
    /* the collections of the next eight weeks for the saved address, entered as plan tasks (what is already there is left alone) */
    FRAK: {restabfall: ["⚫", "Schwarze Tonne"], restmüll: ["⚫", "Schwarze Tonne"], "gelber sack": ["🟡", "Gelber Sack"], "gelbe tonne": ["🟡", "Gelbe Tonne"], bio: ["🟤", "Biotonne"], bioabfall: ["🟤", "Biotonne"], papier: ["🔵", "Papiertonne"]},
    /* every region names its bins differently: the known names first, then by what the word contains */
    frak(w){ const x = String(w).toLowerCase(), k = this.FRAK[x]; if (k) return k; const short = String(w).replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim().slice(0, 28);
      return /bio|grün|gruen|garten/.test(x) ? ["🟤", /bio/.test(x) ? "Biotonne" : short] : /papier|pappe|altpapier|blau/.test(x) ? ["🔵", "Papiertonne"] : /gelb|wertstoff|leichtverp|lvp|verpackung/.test(x) ? ["🟡", /sack/.test(x) ? "Gelber Sack" : /gelb/.test(x) ? "Gelbe Tonne" : "Wertstofftonne"] : /rest|hausm|grau|schwarz/.test(x) ? ["⚫", "Restmüll"] : ["🗑️", short || "Abholung"]; },
    async sync(given){ const g = this.g, w = this.where(); if (!g || !w || this.syncing) return -1; this.syncing = true;
      try { let j = {termine: given}; if (!given){ const f = await this.fetchPlan(w); if (f.err) throw new Error(f.err); j = f; }
        const lim = Date.now() + 56 * 864e5, have = await sb().from("home_tasks").select("title,due_at").eq("group_id", g.id).eq("kind", "plan").gte("due_at", new Date(Date.now() - 864e5).toISOString()), seen = {}; (have.data || []).forEach(x => { seen[x.title + "|" + new Date(x.due_at).toDateString()] = 1; });
        const rows = []; for (const t of j.termine || []){ const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t.d); if (!m) continue; const due = new Date(+m[1], +m[2] - 1, +m[3], 6, 0, 0), ask = new Date(+m[1], +m[2] - 1, +m[3] - 1, 17, 0, 0); if (due.getTime() > lim || due.getTime() < Date.now()) continue;
          const F = []; (t.was || []).forEach(w => { const f = this.frak(w); if (!F.some(x => x[1] === f[1])) F.push(f); }); const title = F.map(f => f[1]).join(" + ").slice(0, 80); if (!title || seen[title + "|" + due.toDateString()]) continue;
          rows.push({group_id: g.id, title, emoji: F.length === 1 ? F[0][0] : "🗑️", note: t.zusatz ? String(t.zusatz).slice(0, 300) : null, kind: "plan", due_at: due.toISOString(), ask_at: new Date(Math.max(ask.getTime(), Date.now())).toISOString(), created_by: meId()}); }
        let n = 0; if (rows.length){ const ins = await sb().from("home_tasks").insert(rows); if (!ins.error) n = rows.length; else for (const x of rows){ const one = await sb().from("home_tasks").insert(x); if (!one.error) n++; } }
        try { localStorage.setItem("chessnat-muell", String(Date.now())); } catch(e) {} return n; }
      catch(e) { return -1; } finally { this.syncing = false; } },
    /* the founder picks who lives here from their friends */
    share(){ const me = meId(), fr = (typeof Social !== "undefined" ? Social.data.friends : []).filter(r => r.status === "accepted").map(r => r.a === me ? r.b : r.a), id = this.g.id;
      const s2 = detailSheet(`<div class="kc-shop" data-notr><h3>Wer wohnt hier?</h3>${fr.length ? `<div class="kc-fr">${fr.map(f => `<div class="kc-frr"><span class="kc-av">${avatar(f)}</span><span class="kc-frm"><b>${h(pname(f))}</b></span><button class="btn sm ${this.mem.includes(f) ? "" : "go"}" data-m="${h(f)}">${this.mem.includes(f) ? "Dabei ✓" : "Hinzufügen"}</button></div>`).join("")}</div>` : `<p class="muted">Füg erst unter Freunde jemanden hinzu.</p>`}<button class="btn go big" data-dclose style="margin-top:10px">Fertig</button></div>`, () => this.load()); s2.el.style.zIndex = 320;
      s2.el.querySelectorAll("[data-m]").forEach(b => b.onclick = async () => { const f = b.dataset.m, on = this.mem.includes(f); b.disabled = true;
        const r = on ? await sb().from("home_members").delete().eq("group_id", id).eq("user_id", f) : await sb().from("home_members").insert({group_id: id, user_id: f}); b.disabled = false; if (r.error) return say("Ging nicht: " + r.error.message);
        this.mem = on ? this.mem.filter(x => x !== f) : this.mem.concat(f); b.textContent = on ? "Hinzufügen" : "Dabei ✓"; b.classList.toggle("go", on); haptic(8); }); } };
  (function w(n){ try { if (meId() && sb()) return Haus.watch(); } catch(e) {} if (n < 90) setTimeout(() => w(n + 1), 2000); })(0);
  try { window.Haus = Haus; } catch(e) {}
  Views.kcal = {
    tab: "today", sel: null,
    mount(main, arg){
      this.main = main; if (arg && arg.tab) this.tab = arg.tab;
      if (!meId()){ main.innerHTML = `<div class="page kc-page"><h1 class="h-title">Kalorien</h1><div class="unit"><p>Bitte melde dich an, um den Kalorien-Tracker zu nutzen.</p><button class="btn go" id="kcsign">Anmelden</button></div></div>`;
        main.querySelector("#kcsign").onclick = () => App.go(typeof Views.account === "object" ? "account" : "settings"); return; }
      K.fromCache(); this.draw();
      /* fresh data from the server: build the page again only if something is different from what is already showing */
      const sig = () => { try { return JSON.stringify([K.prof, K.meals, K.body, K.weights, K.ice, K.invites]); } catch(e) { return ""; } }, was = K.loaded ? sig() : null;
      K.load(true).then(() => { if (was && was === sig()) return; this.draw(); }).catch(() => {});
      this.loadFr();
    },
    /* the Freunde tab needs two things: who your friends are (the friends list, which loads a moment after the app starts)
       and what they track. Draw again once both are there, otherwise it says "noch keiner deiner Freunde trackt" for good */
    loadFr(){ const soc = typeof Social !== "undefined" && Social.load ? Promise.resolve(Social.load()).catch(() => {}) : Promise.resolve();
      return Promise.all([K.loadFriends().catch(() => {}), soc]).then(() => { if (this.tab === "friends") this.draw(); }); },
    draw(){
      const main = this.main; if (!main || !main.isConnected || !onPage()) return;
      if (!K.on()){
        main.innerHTML = `<div class="page kc-page" data-notr><h1 class="h-title">Kalorien</h1><div class="unit kc-intro"><div class="kc-celf">🔥</div><h2>Kalorien-Tracker</h2>
          <p class="muted">Sag einfach, was du gegessen hast, oder scann den Barcode. Die Kalorien landen automatisch beim richtigen Tag. Mit Freunden, die auch tracken, seht ihr euch gegenseitig und sammelt Flammen, wenn ihr euer Ziel schafft.</p>
          ${K.invites.length ? `<p><b>${h(pname(K.invites[0].from_id))}</b> hat dich eingeladen.</p>` : ""}
          <button class="btn go big" id="kcon">Einschalten</button></div></div>`;
        main.querySelector("#kcon").onclick = () => Setup.open(() => this.draw());
        return;
      }
      const tabs = [["today", "Heute"], ["history", "Verlauf"], ["stats", "Analyse"], ["friends", "Freunde"]];
      main.innerHTML = `<div class="page kc-page" data-notr><div class="kc-top"><h1 class="h-title">Kalorien</h1>${flameChip(K.flame(), K.litToday(), myIce())}<button class="kc-x kc-gear" id="kcset" aria-label="Einstellungen">${svg(IC.gear, 20)}</button></div>
        <div class="row kc-tabs">${tabs.map(([k, l]) => `<button class="btn sm ${this.tab === k ? "go" : ""}" data-tab="${k}">${l}</button>`).join("")}</div><div id="kcbody"></div></div>`;
      main.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { this.tab = b.dataset.tab; this.sel = null; this.draw(); if (this.tab === "friends") this.loadFr(); });
      main.querySelector("#kcset").onclick = () => { const sh = detailSheet(`<div class="kc-setsheet" data-notr>${settingsHTML(true)}</div>`); const box = sh.el.querySelector(".kc-setsheet");
        const re = () => { box.innerHTML = settingsHTML(true); wireSettings(box, re); this.draw(); }; wireSettings(box, re); };
      const fl = main.querySelector(".kc-top [data-kc-fl]"); if (fl) fl.onclick = () => iceSheet();
      /* the first visit with the tracker on: the goal questions, once */
      if (K.loaded && !(K.body && K.body.setup_at) && !this.setupAsked && !document.querySelector(".kc-setup")){ this.setupAsked = 1; setTimeout(() => { if (onPage() && !(K.body && K.body.setup_at)) Setup.open(() => this.draw()); }, 300); }
      else if (K.loaded) Weigh.check();
      const body = main.querySelector("#kcbody");
      if (this.tab === "today") this.today(body); else if (this.tab === "history") this.history(body); else if (this.tab === "stats") this.stats(body); else this.friendsTab(body);
      if (K.loaded) Wrap.check();
    },
    /* Analyse: averages against the targets, kcal and protein per day, the macro split, weight, what brings the most kcal */
    stats(el){
      const n = this.range || 7, T = K.targets(), t = today(), days = []; for (let i = n; i >= 1; i--) days.push(addDays(t, -i)); if (K.dayMeals(t).length) days.push(t);
      const logged = days.filter(d => K.dayMeals(d).length), avg = f => logged.length ? logged.reduce((s, d) => s + (f === "kcal" ? K.dayKcal(d) : K.daySum(d, f)), 0) / logged.length : 0;
      const A = {kcal: avg("kcal"), protein: avg("protein"), carbs: avg("carbs"), fat: avg("fat")}, hit = logged.filter(d => K.dayKcal(d) >= T.kcal).length;
      const tile = (k, l, u) => { const pc = T[k] ? Math.round(A[k] / T[k] * 100) : 0; return `<div class="kc-st"><small>Ø ${l}</small><b>${fmt(A[k])}<span> ${u}</span></b><i><u style="width:${Math.min(100, pc)}%"></u></i><em class="${pc >= 95 ? "ok" : pc < 80 ? "lo" : ""}">${pc} % vom Ziel</em></div>`; };
      const bars = (f, goal, col) => { const vals = days.map(d => f === "kcal" ? K.dayKcal(d) : K.daySum(d, f)), mx = Math.max(goal * 1.2, ...vals) || 1;
        return `<div class="kc-ch" style="--goal:${(goal / mx * 100).toFixed(1)}%">${days.map((d, i) => `<span title="${dayLabel(d)}: ${fmt(vals[i])}"><i style="height:${(vals[i] / mx * 100).toFixed(1)}%;background:${vals[i] >= goal ? col : col + "99"}"></i><small>${n <= 7 ? new Date(d + "T12:00").toLocaleDateString("de-DE", {weekday: "short"}).slice(0, 2) : +d.slice(8)}</small></span>`).join("")}<b class="kc-chg"></b></div>`; };
      /* the energy split: what share of the kcal came from carbs, protein, fat, against the targets' split */
      const e = {carbs: A.carbs * 4, protein: A.protein * 4, fat: A.fat * 9}, et = e.carbs + e.protein + e.fat || 1, tt = T.carbs * 4 + T.protein * 4 + T.fat * 9 || 1;
      const split = (o, tot) => `<div class="kc-split"><i style="width:${o.carbs / tot * 100}%" class="c"></i><i style="width:${o.protein / tot * 100}%" class="p"></i><i style="width:${o.fat / tot * 100}%" class="f"></i></div>`;
      /* weight: every weigh-in as a line */
      const W = (K.weights || []).slice().reverse(), wl = W.length >= 2 ? (() => { const ks = W.map(w => Number(w.kg)), lo = Math.min(...ks) - .5, hi = Math.max(...ks) + .5, X = i => 8 + i / (W.length - 1) * 284, Y = k => 92 - (k - lo) / (hi - lo) * 80;
        return `<svg class="kc-wl" viewBox="0 0 300 100"><polyline points="${W.map((w, i) => X(i).toFixed(1) + "," + Y(+w.kg).toFixed(1)).join(" ")}"/>${W.map((w, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(+w.kg).toFixed(1)}" r="3.5"/>`).join("")}</svg>`; })() : "";
      const dW = W.length >= 2 ? Math.round((W[W.length - 1].kg - W[0].kg) * 10) / 10 : null;
      /* the foods that brought the most kcal */
      const F = new Map(); K.meals.filter(m => days.includes(m.day)).forEach(m => (Array.isArray(m.items) && m.items.length ? m.items : [{name: m.title, kcal: m.kcal}]).forEach(i => { const k = String(i.name || "").replace(/\(.*?\)/g, "").trim(); if (!k) return; const o = F.get(k.toLowerCase()) || {name: k, kcal: 0, n: 0}; o.kcal += Number(i.kcal) || 0; o.n++; F.set(k.toLowerCase(), o); }));
      const top = [...F.values()].sort((a, b) => b.kcal - a.kcal).slice(0, 8), tk = top.length ? top[0].kcal : 1, all = logged.reduce((s, d) => s + K.dayKcal(d), 0) || 1;
      el.innerHTML = `<div class="row kc-rng">${[[7, "7 Tage"], [30, "30 Tage"]].map(([v, l]) => `<button class="chip ${n === v ? "on" : ""}" data-rng="${v}">${l}</button>`).join("")}<button class="chip" id="kcwrap">📋 Wochen-Rückblick</button></div>
        ${logged.length ? `<div class="kc-sts">${tile("kcal", "Kalorien", "kcal")}${tile("protein", "Protein", "g")}${tile("carbs", "KH", "g")}${tile("fat", "Fett", "g")}</div>
        <div class="unit kc-an"><h3>Kalorien <small>${hit} von ${logged.length} Tagen geschafft</small></h3>${bars("kcal", T.kcal, "#7FB24A")}</div>
        <div class="unit kc-an"><h3>Kohlenhydrate <small>Ziel ${T.carbs} g</small></h3>${bars("carbs", T.carbs, "#E9A92B")}</div>
        <div class="unit kc-an"><h3>Protein <small>Ziel ${T.protein} g</small></h3>${bars("protein", T.protein, "#4FA3FF")}</div>
        <div class="unit kc-an"><h3>Aufteilung der Kalorien</h3><div class="kc-spl"><span>Du</span>${split(e, et)}</div><div class="kc-spl"><span>Ziel</span>${split({carbs: T.carbs * 4, protein: T.protein * 4, fat: T.fat * 9}, tt)}</div>
          <div class="kc-leg"><span class="c">KH ${Math.round(e.carbs / et * 100)} %</span><span class="p">Protein ${Math.round(e.protein / et * 100)} %</span><span class="f">Fett ${Math.round(e.fat / et * 100)} %</span></div></div>` : `<p class="muted kc-empty">In diesem Zeitraum ist noch nichts eingetragen.</p>`}
        <div class="unit kc-an"><h3>Gewicht ${dW != null ? `<small>${dW > 0 ? "+" : dW < 0 ? "−" : "±"}${nf(Math.abs(dW), 1)} kg seit ${new Date(W[0].ts).toLocaleDateString("de-DE", {day: "numeric", month: "short"})}</small>` : ""}</h3>${wl || `<p class="muted">${W.length ? `${nf(W[0].kg, 1)} kg. Der Verlauf erscheint ab der zweiten Messung.` : "Noch nicht gewogen."}</p>`}<button class="btn sm" id="kcwnow">⚖️ Jetzt wiegen</button></div>
        ${top.length ? `<div class="unit kc-an"><h3>Das bringt die meisten Kalorien</h3><div class="kc-top8">${top.map(o => `<div><span>${h(o.name)}<small>${o.n}× · ${Math.round(o.kcal / all * 100)} %</small></span><i><u style="width:${(o.kcal / tk * 100).toFixed(0)}%"></u></i><b>${fmt(o.kcal)}</b></div>`).join("")}</div></div>` : ""}`;
      el.querySelectorAll("[data-rng]").forEach(b => b.onclick = () => { this.range = +b.dataset.rng; this.draw(); });
      el.querySelector("#kcwrap").onclick = () => Wrap.open(true); el.querySelector("#kcwnow").onclick = () => Weigh.open();
    },
    dayBlock(k, own = true){
      const ms = own ? K.dayMeals(k) : [];
      if (!ms.length) return `<p class="muted kc-empty">${k === today() ? "Heute noch nichts eingetragen." : "Nichts eingetragen."}</p>`;
      const G = []; ms.forEach(m => { const g = G[G.length - 1], ts = Date.parse(m.ts) || 0; if (g && g.last - ts <= 15 * 60000){ g.ms.push(m); g.last = ts; } else G.push({ms: [m], last: ts}); });
      const name = ts => { const d = new Date(ts), hr = d.getHours() + d.getMinutes() / 60; return hr >= 5 && hr < 10.75 ? "Frühstück" : hr >= 11 && hr < 14.75 ? "Mittagessen" : hr >= 17 && hr < 21.75 ? "Abendessen" : "Snack"; };
      const card = g => { const one = g.ms.length < 2, m0 = g.ms[0], tot = sumOf(g.ms);
        return `<div class="kc-mcard">${one ? `<button class="kc-mrow head" data-meal="${h(m0.id)}"><span class="kc-mt2"><span class="kc-mtn">${h(nice(m0.title))}</span><small>${hhmm(m0.ts)}</small></span>${cells(tot)}</button>`
          : `<div class="kc-mrow head"><span class="kc-mt2"><span class="kc-mtn">${name(g.last)}</span><small>${hhmm(g.last)}</small></span>${cells(tot)}</div>${g.ms.slice().reverse().map(m => `<button class="kc-mrow" data-meal="${h(m.id)}"><span class="kc-mt2"><span class="kc-mtn">${h(nice(m.title))}</span><small>${hhmm(m.ts)}</small></span>${cells(m)}</button>`).join("")}`}</div>`; };
      return `<div class="kc-list2">${G.map(card).join("")}</div>`;
    },
    wireMeals(el){ el.querySelectorAll("[data-meal]").forEach(b => b.onclick = () => { const m = K.meals.find(x => x.id === b.dataset.meal); if (m) mealSheet(m); }); },
    today(el){
      const t = today(), g = K.goal(), eaten = K.dayKcal(t), lit = eaten >= g, miss = g - eaten, i = !lit ? idea(miss) : null;
      el.innerHTML = `<div id="hsslot" data-notr></div><div class="unit kc-sum">${sumHTML(t, false)}
        <div class="kc-btns two"><button class="kc-big kc-say" data-kc-say>${svg(IC.mic, 32)}<span>Sprechen</span></button><button class="kc-big kc-scan" data-kc-scan>${svg(IC.code, 32)}<span>Barcode</span></button></div>
        <button class="kc-sbar" data-kc-find>${svg(IC.search, 18)}<span>Lebensmittel suchen …</span></button>
        <div class="kc-btns two"><button class="kc-tile shop" id="kcshop">${svg(IC.list, 24)}<span><b>Einkaufsliste</b><small>mit Freunden</small></span></button><button class="kc-tile cook" id="kccook">${svg(IC.chef, 24)}<span><b>Kochen</b><small>Was hast du da?</small></span></button><button class="kc-tile haus" id="kchaus" data-notr><span class="hs-ti">🏠</span><span><b>Haushalt</b><small id="hsnext">Müllplan &amp; Aufgaben</small></span></button></div>
        ${setupCard()}</div>
        <div class="kc-lh"><span>Heute</span>${heads()}</div>${this.dayBlock(t)}
        <button class="kc-link" id="kcmanual">${svg(IC.plus, 15)} Selbst eintragen</button>
        ${(q => q ? `<div class="unit kc-sum kc-sugg">${q}</div>` : "")(quickHTML())}`; el.querySelector("#kcshop").onclick = () => Shop.open(); el.querySelector("#kccook").onclick = () => Cook.open(); el.querySelector("#kchaus").onclick = () => Haus.open(); Haus.paint();
      wireDay(el); animSum(el); el.querySelector("#kcmanual").onclick = () => manual();
      this.wireMeals(el);
    },
    history(el){
      const g = K.goal(), t = today(), days = []; for (let i = 13; i >= 0; i--) days.push(addDays(t, -i));
      const max = Math.max(g * 1.25, ...days.map(d => K.dayKcal(d)));
      const all = [...new Set(K.meals.map(m => m.day))].sort().reverse();
      const hit = all.filter(d => K.dayKcal(d) >= g).length, avg7 = Math.round(days.slice(-7).reduce((s, d) => s + K.dayKcal(d), 0) / 7);
      el.innerHTML = `<div class="unit"><div class="kc-stats"><div><b>${fmt(avg7)}</b><small>Ø kcal (7 Tage)</small></div><div><b>🔥 ${K.flame()}</b><small>Flamme</small></div><div><b>${Math.max(K.flame(), (K.prof && K.prof.best) || 0)}</b><small>Rekord</small></div><div><b>${hit}</b><small>Tage geschafft</small></div></div>
        <div class="kc-chart" style="--goal:${(g / max * 100).toFixed(1)}">${days.map(d => { const v = K.dayKcal(d); const [, , dd] = d.split("-");
          return `<button class="kc-col ${v >= g ? "hit" : ""} ${this.sel === d ? "sel" : ""}" data-day="${d}" title="${dayLabel(d)}: ${fmt(v)} kcal"><i style="height:${(v / max * 100).toFixed(1)}%"></i><small>${+dd}</small></button>`; }).join("")}<b class="kc-gl"><span>${fmt(g)}</span></b></div></div>
        ${all.length ? all.slice(0, 60).map(d => { const v = K.dayKcal(d); return `<div class="kc-day ${v >= g ? "hit" : ""}" id="kcd-${d}"><span>${dayLabel(d)}</span><b>${v >= g ? "🔥 " : ""}${fmt(v)} kcal</b></div>${this.dayBlock(d)}`; }).join("") : `<p class="muted kc-empty">Noch keine Einträge.</p>`}`;
      el.querySelectorAll("[data-day]").forEach(b => b.onclick = () => { this.sel = b.dataset.day; const t2 = el.querySelector("#kcd-" + b.dataset.day); if (t2) t2.scrollIntoView({behavior: "smooth", block: "start"}); else say("An dem Tag ist nichts eingetragen");
        el.querySelectorAll("[data-day]").forEach(x => x.classList.toggle("sel", x === b)); });
      this.wireMeals(el);
    },
    friendsTab(el){
      const t = today(), me = meId();
      const fr = (typeof Social !== "undefined" ? Social.data.friends : []).filter(r => r.status === "accepted").map(r => r.a === me ? r.b : r.a);
      const tracking = K.friends.filter(p => fr.includes(p.user_id));
      const notYet = fr.filter(id => !K.friends.some(p => p.user_id === id));
      const rows = [{user_id: me, goal: K.goal(), flame: K.flame(), me: true}, ...tracking].map(p => {
        const eaten = p.me ? K.dayKcal(t) : K.fmeals.filter(m => m.user_id === p.user_id && m.day === t).reduce((s, m) => s + (m.kcal || 0), 0);
        const lit = eaten >= p.goal, flame = p.me ? K.flame() : (p.flame_day === t || p.flame_day === addDays(t, -1) ? p.flame : 0);
        return {p, eaten, lit, flame};
      }).sort((a, b) => b.flame - a.flame || b.eaten / b.p.goal - a.eaten / a.p.goal);
      /* the health ranking among friends: who ate best over the last days, not who ate most */
      /* the rankings among friends over the last days, one tab each: sticking to the goals, health, calories, protein */
      const HR = rows.map(({p}) => ({p, w: weekHealth(p.me ? K.meals : K.fmeals.filter(m => m.user_id === p.user_id), p.goal, p.me ? K.targets().protein : 0)})).filter(x => x.w);
      const HT = {adh: ["Einhaltung", w => Math.round((w.G * .7 + w.P * .3) * 100), "%", "Kalorien- und Protein-Ziel erreicht, im Schnitt pro Tag. Mehr als das Ziel zählt voll."], health: ["Gesundheit", w => w.s, "", "0 bis 100: passende Menge, Protein, Ballaststoffe, wenig Zucker und gesättigtes Fett, Qualität der Lebensmittel."],
        kcal: ["Kalorien", w => Math.round(w.kc || 0), "kcal", "Kalorien pro Tag im Schnitt."], prot: ["Protein", w => Math.round(w.pg || 0), "g", "Protein pro Tag im Schnitt."]};
      const hbar = (l, v) => v == null ? "" : `<span class="kc-hb"><i><u style="width:${Math.round(v * 100)}%"></u></i>${l}</span>`;
      const hrRows = () => { const T = HT[this.hrTab] || HT.adh, L = HR.slice().sort((a, b) => T[1](b.w) - T[1](a.w)), hl = this.hrTab === "health";
        return L.map(({p, w}, i) => { const v = T[1](w); return `<div class="kc-hrr ${p.me ? "me" : ""}"><span class="r">${i + 1}</span><span class="kc-av">${avatar(p.user_id)}</span><span class="kc-hrm"><b>${p.me ? "Du" : h(pname(p.user_id))}</b>${hl ? `<span class="kc-hbs">${hbar("Menge", w.A)}${hbar("Protein", w.P)}${hbar("Ballast", w.F)}${hbar("Zucker/Fett", w.L)}${hbar("Qualität", w.Q)}</span>${w.part ? `<small>nur Menge und Protein, Nährwerte fehlen noch</small>` : ""}` : ""}</span><b class="kc-hs ${T[2] === "%" || hl ? (v >= 75 ? "g" : v >= 50 ? "m" : "b") : ""}">${fmt(v)}<em>${T[2]}</em></b></div>`; }).join("") + `<small class="muted kc-hrn">${T[3]} Letzte 7 Tage.</small>`; };
      if (!HT[this.hrTab]) this.hrTab = "adh";
      const hrHTML = HR.length ? `<div class="unit kc-hr"><div class="kc-hrh"><b>Rankings</b><small>letzte 7 Tage</small></div><div class="kc-hrt">${Object.entries(HT).map(([k, t]) => `<button class="chip ${k === this.hrTab ? "on" : ""}" data-hr="${k}">${t[0]}</button>`).join("")}</div><div id="kchrl" class="kc-hrl">${hrRows()}</div></div>` : "";
      el.innerHTML = `${hrHTML}<div class="kc-fr">${rows.map(({p, eaten, lit, flame}) => `<button class="kc-frr ${p.me ? "me" : ""}" data-fr="${h(p.user_id)}"><span class="kc-av">${avatar(p.user_id)}</span><span class="kc-frm"><b>${p.me ? "Du" : h(pname(p.user_id))}</b>
          <span class="kc-bar sm ${lit ? "done" : ""}"><i style="width:${Math.round(Math.min(1, eaten / p.goal) * 100)}%"></i></span><small>${fmt(eaten)} / ${fmt(p.goal)} kcal heute</small></span>${flameChip(flame, lit)}</button>`).join("")}</div>
        ${tracking.length ? "" : `<p class="muted kc-empty">Noch keiner deiner Freunde trackt. Lad sie ein!</p>`}
        ${notYet.length ? `<div class="kc-day">Einladen</div><div class="kc-fr">${notYet.map(id => `<div class="kc-frr"><span class="kc-av">${avatar(id)}</span><span class="kc-frm"><b>${h(pname(id))}</b><small>trackt noch nicht</small></span><button class="btn sm go" data-inv="${h(id)}">Einladen</button></div>`).join("")}</div>` : ""}
        ${fr.length ? "" : `<p class="muted kc-empty">Füg erst unter Freunde jemanden hinzu.</p>`}`;
      /* applause: whoever reached their goal today gets a clap button under their row; under your own row you see who clapped for you.
         (Needs the table kcal_claps; until it exists, nothing is shown) */
      (async () => { const r = await sb().from("kcal_claps").select("from_id,to_id").eq("day", t); if (r.error || !el.isConnected) return; const C = r.data || [];
        rows.forEach(({p, lit}) => { const b = el.querySelector(`[data-fr="${p.user_id}"]`); if (!b) return;
          if (p.me){ const from = C.filter(c => c.to_id === me).map(c => pname(c.from_id)); if (from.length) b.insertAdjacentHTML("afterend", `<div class="kc-clapd">👏 ${h(from.join(", "))} ${from.length > 1 ? "applaudieren" : "applaudiert"} dir</div>`); return; }
          if (!lit) return; const done = C.some(c => c.from_id === me && c.to_id === p.user_id); b.insertAdjacentHTML("afterend", `<button class="kc-clap ${done ? "on" : ""}" data-clap="${h(p.user_id)}" ${done ? "disabled" : ""}>👏 ${done ? "Applaudiert" : "Applaudieren"}</button>`); });
        el.querySelectorAll("[data-clap]").forEach(b => b.onclick = async () => { b.disabled = true; const r2 = await sb().from("kcal_claps").insert({to_id: b.dataset.clap, day: t}); if (r2.error){ b.disabled = false; return say("Ging nicht: " + r2.error.message); }
          b.classList.add("on"); b.textContent = "👏 Applaudiert"; haptic([10, 30, 10]); try { Sound.play("Victory", .4); } catch(e) {} }); })();
      el.querySelectorAll("[data-hr]").forEach(b => b.onclick = () => { this.hrTab = b.dataset.hr; haptic(8); el.querySelectorAll("[data-hr]").forEach(x => x.classList.toggle("on", x === b)); const box = el.querySelector("#kchrl"); box.innerHTML = hrRows(); if (box.animate) box.animate([{opacity: 0, transform: "translateY(6px)"}, {opacity: 1, transform: "none"}], {duration: 220, easing: "cubic-bezier(.22,1,.36,1)"});
        try { b.scrollIntoView({behavior: "smooth", inline: "center", block: "nearest"}); } catch(e) {} });
      el.querySelectorAll("[data-inv]").forEach(b => b.onclick = async () => { b.disabled = true;
        try { const r = await sb().rpc("kcal_invite", {target: b.dataset.inv}); const v = r.data;
          say(v === "ok" ? "Einladung geschickt 📨" : v === "sent" ? "Heute schon eingeladen" : v === "already" ? "Trackt schon mit" : "Ging nicht"); b.textContent = v === "ok" || v === "sent" ? "Eingeladen ✓" : b.textContent; }
        catch(e) { b.disabled = false; say("Ging nicht"); } });
      el.querySelectorAll("[data-fr]").forEach(b => b.onclick = () => { const id = b.dataset.fr; if (id === me){ this.tab = "today"; return this.draw(); } this.friendDay(id); });
    },
    friendDay(id){
      const t = today(), ms = K.fmeals.filter(m => m.user_id === id).sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
      const days = [...new Set(ms.map(m => m.day))].sort().reverse(), p = K.friends.find(x => x.user_id === id) || {goal: 2500};
      const sh = detailSheet(`<div data-notr><div class="kc-mh"><span class="kc-av">${avatar(id)}</span><div><div class="kc-mt">${h(pname(id))}</div><div class="muted">Ziel ${fmt(p.goal)} kcal · 🔥 ${p.flame_day === t || p.flame_day === addDays(t, -1) ? p.flame : 0}</div></div></div>
        ${days.length ? days.map(d => { const v = ms.filter(m => m.day === d).reduce((s, m) => s + (m.kcal || 0), 0); return `<div class="kc-day ${v >= p.goal ? "hit" : ""}"><span>${dayLabel(d)}</span><b>${v >= p.goal ? "🔥 " : ""}${fmt(v)} kcal</b></div><div class="kc-list">${ms.filter(m => m.day === d).map(m => `<button class="kc-meal" data-fm="${h(m.id)}"><span class="kc-tm">${hhmm(m.ts)}</span><span class="kc-em">${h(m.emoji || "🍽️")}</span><span class="kc-mn">${h(m.title)}</span><b>${fmt(m.kcal)}</b></button>`).join("")}</div>`; }).join("") : `<p class="muted">Diese Woche noch nichts eingetragen.</p>`}</div>`);
      sh.el.querySelectorAll("[data-fm]").forEach(b => b.onclick = () => { const m = ms.find(x => x.id === b.dataset.fm); if (m) mealSheet(m, false); });
    }
  };
  if (typeof TAB_OF !== "undefined") TAB_OF.kcal = "home";

  /* a friend logs something: refresh the friends tab if it is open */
  let rt = null;
  function realtime(){ const c = sb(); if (!c || !meId() || rt) return;
    rt = c.channel("kcal-" + meId()).on("postgres_changes", {event: "*", schema: "public", table: "kcal_meals"}, p => {
      const row = p.new && p.new.user_id ? p.new : p.old; if (!row || row.user_id === meId()) return;
      if (onPage() && Views.kcal.tab === "friends") K.loadFriends().then(() => Views.kcal.draw()).catch(() => {});
    }).subscribe(); }
  setTimeout(function wait(){ if (meId()){ K.fromCache(); K.load().then(() => { if (K.on()) realtime(); }).catch(() => {}); } else setTimeout(wait, 1500); }, 1500);

  const css = document.createElement("style"); css.textContent = `
.kc-home{display:flex;flex-direction:column;gap:8px;padding:14px!important}.kc-home[hidden]{display:none}
.kc-hd{display:flex;align-items:center;gap:8px}.kc-ttl{flex:1;text-align:left;border:0;background:none;color:var(--muted);font:900 13px var(--body);letter-spacing:.06em;text-transform:uppercase;padding:0;cursor:pointer}
.kc-ov{display:inline-flex;align-items:center;gap:5px;border:0;background:var(--panel-2);color:var(--fg);font:800 13px var(--body);padding:7px 11px;border-radius:999px;cursor:pointer}
.kc-fl{display:inline-flex;align-items:center;gap:2px;font:900 15px var(--display);padding:4px 10px;border-radius:999px;background:var(--panel-2);filter:grayscale(.2)}.kc-fl.off{filter:grayscale(1);opacity:.6}.kc-fl.lit{background:linear-gradient(180deg,#ff9a3c,#e8541e);color:#fff;filter:none;box-shadow:0 0 14px rgba(255,120,40,.45)}
.kc-num{display:flex;align-items:baseline;gap:6px;border:0;background:none;color:var(--fg);padding:0;cursor:pointer;text-align:left}.kc-num b{font:900 40px/1 var(--display)}.kc-num span{color:var(--muted);font:800 16px var(--body)}
.kc-bar{height:12px;border-radius:999px;background:var(--panel-3);overflow:hidden}.kc-bar i{display:block;height:100%;border-radius:999px;background:var(--go);transition:width .5s cubic-bezier(.2,.8,.2,1)}.kc-bar.done i{background:linear-gradient(90deg,#ffb347,#ff6a2b)}.kc-bar.sm{height:7px;display:block;margin:4px 0 3px}
.kc-last{color:var(--muted);font:700 13px var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kc-btns{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:2px}
.kc-big{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;height:96px;border:0;border-radius:18px;color:#fff;font:900 18px var(--display);cursor:pointer;background:var(--go);box-shadow:inset 0 -5px 0 var(--go-deep);-webkit-tap-highlight-color:transparent}
.kc-big:active{transform:translateY(2px);box-shadow:inset 0 -2px 0 var(--go-deep)}
.kc-rng{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 10px}.kc-sts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:10px}
.kc-st{background:var(--panel);border-radius:16px;padding:10px 12px;display:flex;flex-direction:column;gap:4px}.kc-st small{color:var(--muted);font:800 12px var(--body)}.kc-st b{font:900 24px var(--display)}.kc-st b span{font:800 13px var(--body);color:var(--muted)}
.kc-st i{display:block;height:6px;border-radius:3px;background:var(--panel-2);overflow:hidden}.kc-st u{display:block;height:100%;background:var(--go);border-radius:3px}.kc-st em{font:800 12px var(--body);font-style:normal;color:var(--muted)}.kc-st em.ok{color:#9BE25A}.kc-st em.lo{color:#ff8a78}
.kc-an h3{margin:0 0 10px;font:900 17px var(--display);display:flex;justify-content:space-between;align-items:baseline;gap:8px}.kc-an h3 small{color:var(--muted);font:800 12px var(--body)}
.kc-ch{position:relative;display:flex;align-items:flex-end;gap:3px;height:130px;padding-bottom:18px}.kc-ch span{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:0;position:relative}
.kc-ch span i{display:block;width:100%;max-width:26px;border-radius:5px 5px 2px 2px;min-height:2px}.kc-ch span small{position:absolute;bottom:-17px;font:800 10px var(--body);color:var(--muted)}
.kc-chg{position:absolute;left:0;right:0;bottom:calc(18px + (100% - 18px) * var(--goal) / 100%);border-top:2px dashed rgba(255,255,255,.35);pointer-events:none}
.kc-spl{display:flex;align-items:center;gap:8px;margin:4px 0}.kc-spl span{width:34px;font:800 12px var(--body);color:var(--muted)}.kc-split{flex:1;display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--panel-2)}.kc-split i{display:block;height:100%}
.kc-split .c,.kc-leg .c::before{background:#E9A92B}.kc-split .p,.kc-leg .p::before{background:#4FA3FF}.kc-split .f,.kc-leg .f::before{background:#E9573F}.kc-leg{display:flex;gap:12px;flex-wrap:wrap;margin-top:6px;font:800 12px var(--body)}.kc-leg span::before{content:"";display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:5px}
.kc-wl{width:100%;height:110px;display:block;margin-bottom:8px}.kc-wl polyline{fill:none;stroke:var(--go);stroke-width:3;stroke-linejoin:round;stroke-linecap:round}.kc-wl circle{fill:var(--panel);stroke:var(--go);stroke-width:2.5}
.kc-top8{display:flex;flex-direction:column;gap:6px}.kc-top8>div{display:grid;grid-template-columns:minmax(0,1.2fr) 1fr auto;gap:8px;align-items:center}.kc-top8 span{display:flex;flex-direction:column;font:800 13.5px var(--body);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kc-top8 small{color:var(--muted);font-weight:700;font-size:11.5px}
.kc-top8 i{display:block;height:8px;border-radius:4px;background:var(--panel-2);overflow:hidden}.kc-top8 u{display:block;height:100%;background:#E9A92B;border-radius:4px}.kc-top8 b{font:900 14px var(--display)}
.kc-cook textarea{width:100%;box-sizing:border-box;border-radius:12px;border:1px solid var(--line);background:var(--panel-2);color:var(--fg);font:600 16px var(--body);padding:10px}.kc-miss{margin:0}
.kc-dish{display:flex;flex-direction:column;gap:10px;margin-top:6px}.kc-why{margin:0;font:700 14px/1.4 var(--body)}.kc-steps{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;font:600 14px/1.4 var(--body)}
.kc-think{display:flex;gap:6px;justify-content:center;padding:14px}.kc-think i{width:10px;height:10px;border-radius:50%;background:var(--go);animation:kcThink 1s ease-in-out infinite}.kc-think i:nth-child(2){animation-delay:.15s}.kc-think i:nth-child(3){animation-delay:.3s}@keyframes kcThink{50%{transform:translateY(-6px);opacity:.5}}
.kc-wrap{overflow:auto;gap:14px;justify-content:flex-start;padding-top:calc(env(safe-area-inset-top,0px) + 24px)}.kc-wtop{text-align:center}.kc-wtop small{color:rgba(255,255,255,.55);font:800 13px var(--body)}.kc-wtop h2{margin:2px 0 0;font:900 34px var(--display)}
.kc-wst{display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:480px;width:100%;margin:0 auto}.kc-wst>div{background:#211F1C;border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:2px}.kc-wst b{font:900 24px var(--display)}.kc-wst span{font:800 12px var(--body);color:rgba(255,255,255,.6)}
.kc-wai{max-width:480px;width:100%;margin:0 auto;background:#211F1C;border-radius:18px;padding:14px 16px;border:2px solid rgba(255,255,255,.08)}.kc-wai.great{border-color:#8FC458}.kc-wai.bad{border-color:#E9573F}.kc-wai h3{margin:0 0 6px;font:900 20px var(--display)}.kc-wai p{margin:0 0 8px;font:600 15px/1.45 var(--body)}
.kc-wai ul{margin:0 0 8px;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px;font:700 14px/1.4 var(--body)}.kc-wai ul.g li::before{content:"✓ ";color:#9BE25A;font-weight:900}.kc-wai ul.b li::before{content:"→ ";color:#FFD15C;font-weight:900}.kc-focus{font-weight:800!important}
.kc-wok{max-width:480px;width:100%;margin:6px auto 0}
.kc-two{display:grid;grid-template-columns:1fr 1fr;gap:8px;cursor:pointer}.kc-two.one{grid-template-columns:1fr}.kc-b2{background:var(--panel-2);border-radius:18px;padding:12px 14px;display:flex;flex-direction:column;gap:3px;min-width:0;container-type:inline-size}
.kc-b2 small{font:900 11.5px var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}.kc-b2 b{font:900 30px/1.1 var(--display);font-size:clamp(19px,21cqi,36px);white-space:nowrap;font-variant-numeric:tabular-nums}.kc-b2 b em{font:800 .48em var(--display);font-style:normal;color:var(--muted)}.kc-b2 span{font:800 12.5px var(--body);color:var(--muted)}
.kc-b2 i{display:block;height:8px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:4px}.kc-b2 u{display:block;height:100%;border-radius:4px;background:var(--go);transition:width .4s}.kc-b2.c u{background:#E9A92B}.kc-b2.p u{background:#4FA3FF}.kc-b2.f u{background:#EF7A5F}.kc-b2{transition:background .5s,box-shadow .5s}.kc-b2.ok{background:rgba(127,178,74,.2);box-shadow:inset 0 0 0 1.5px rgba(155,226,90,.6)}.kc-b2.ok u{background:linear-gradient(90deg,#7FB24A,#9BE25A)}.kc-b2.ok small,.kc-b2.ok var{color:#9BE25A}
.kc-mac.two{grid-template-columns:1fr 1fr}
.kc-mk2{display:flex;flex-direction:column;align-items:flex-end;white-space:nowrap}.kc-mk2 b{font:900 16px var(--display)}.kc-mk2 b small{font:800 11px var(--body);color:var(--muted)}.kc-mk2 em{font:800 12.5px var(--body);font-style:normal;color:#E9A92B}
.kc-grp{display:flex;flex-direction:column;gap:2px;background:var(--panel);border-radius:14px;padding:4px}.kc-grp .kc-meal{background:var(--panel-2);border-radius:10px}.kc-gh{display:flex;justify-content:space-between;gap:8px;padding:6px 8px 4px;font:900 13px var(--body)}.kc-gh b{font:900 13px var(--body);color:#E9A92B}
.kc-tipb{margin-top:12px}
html.kc-sopen,html.kc-sopen body{overflow:hidden}
.kc-sov{position:fixed;left:0;right:0;top:0;height:100vh;height:100lvh;z-index:300;background:#141312;display:flex;flex-direction:column;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 0;will-change:transform}
.kc-sovt{display:flex;align-items:center;gap:10px}.kc-sovt .kc-sq{flex:1;min-width:0;background:#2A2825;border-color:var(--go)}.kc-sx{flex:none;white-space:nowrap;border:0;background:none;color:var(--go-hi,#8FC458);font:800 16px var(--body);padding:8px 2px;cursor:pointer}
.kc-sovb>*{flex-shrink:0}.kc-sovb{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:10px 0 calc(env(safe-area-inset-bottom,0px) + 16px);display:flex;flex-direction:column;gap:8px;overscroll-behavior:contain}
.kc-sres b .c{color:#E9A92B;font-weight:800}.kc-sres b .p{color:#5AAEFF;font-weight:800}.kc-sres b .f{color:#EF7A5F;font-weight:800}.kc-sres.open{background:#33302C;border-radius:14px 14px 4px 4px}.kc-sh span{float:right}
.kc-sadd{background:#33302C;border-radius:4px 4px 14px 14px;margin-top:-6px;padding:10px;display:flex;flex-direction:column;gap:10px;animation:kcIn .2s ease-out}@keyframes kcIn{from{opacity:0;transform:translateY(-6px)}}
.kc-sk{font:800 15px var(--body);text-align:center}.kc-sk b{font:900 22px var(--display)}.kc-sk small{display:block;color:var(--muted);font-weight:700;font-size:12px;margin-top:2px}
.kc-pf{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:2px 4px;font:700 13px var(--body);color:var(--muted)}.kc-pf b{color:var(--fg);font:900 14px var(--display)}
.kc-pf i{display:block;height:4px;border-radius:2px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:5px}.kc-pf u{display:block;height:100%;background:rgba(255,255,255,.45);border-radius:2px}.kc-pf .ok u{background:#9BE25A}.kc-pf .ok,.kc-pf .ok b{color:#9BE25A}
.kc-quick{gap:6px}.kc-qc{background:var(--panel-2);border-radius:16px;overflow:hidden}.kc-qc .kc-q{background:none;border-radius:0;padding:10px 10px 10px 14px;gap:10px}.kc-qc .kc-q+.kc-q{border-top:1px solid rgba(255,255,255,.06)}
.kc-qc .kc-qn{flex:1;min-width:0;display:block;font:800 15px var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kc-qv{font:700 13px var(--body);color:var(--muted);white-space:nowrap;font-variant-numeric:tabular-nums}
.kc-qa{position:relative;width:32px;height:32px;border-radius:50%;background:none;border:2px solid var(--go);color:var(--go-hi,#8FC458);display:grid;place-items:center;flex:none;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}.kc-qa::after{content:"";position:absolute;inset:-9px}.kc-qa:active,.kc-qa.ok{background:var(--go);color:#fff}.kc-qc .kc-q:has(.kc-qa:active){transform:none}
.kc-lh.q{margin:4px 10px 4px 14px}.kc-lh.q i{width:32px;flex:none}.kc-qc .kc-q .kc-n{font:800 14.5px var(--body)}.kc-qc .kc-q .kc-n.k{color:var(--fg)}
.kc-lh{display:flex;align-items:center;gap:10px;margin:20px 14px 8px;font:800 12px var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}.kc-lh>span:first-child{flex:1}
.kc-n{width:58px;text-align:right;flex:none;font-variant-numeric:tabular-nums;white-space:nowrap}.kc-n.c{color:#E9A92B}.kc-n.p{color:#5AAEFF}.kc-n.f{color:#EF7A5F}.kc-lh .kc-n{letter-spacing:.02em}.kc-ord{display:inline-grid;place-items:center;width:17px;height:17px;border-radius:50%;background:rgba(0,0,0,.28);font:900 11px var(--body);margin-right:2px}.kc-n.n3{width:50px}.kc-n.n4{width:41px;font-size:13px}.kc-n.n4.k{width:46px}.kc-lh .kc-n.n3{letter-spacing:0}
.kc-list2{display:flex;flex-direction:column;gap:10px}.kc-mcard{background:var(--panel);border-radius:16px;overflow:hidden}
.kc-mrow{display:flex;align-items:center;gap:10px;width:100%;padding:9px 14px;border:0;background:none;color:var(--muted);text-align:left;font:700 14.5px var(--body);cursor:pointer;-webkit-tap-highlight-color:transparent}
.kc-mrow+.kc-mrow{border-top:1px solid rgba(255,255,255,.05)}.kc-mrow:active{background:rgba(255,255,255,.04)}
.kc-mrow.head{padding:12px 14px;color:var(--fg);font:900 16px var(--body);cursor:default}button.kc-mrow.head{cursor:pointer}.kc-mrow.head .kc-n{font:900 16px var(--display)}.kc-mrow .kc-n{font:800 14.5px var(--body)}
.kc-mt2{flex:1;min-width:0;white-space:nowrap;overflow:hidden;display:flex;flex-direction:column;align-items:flex-start;gap:1px}.kc-mtn{max-width:100%;overflow:hidden;text-overflow:ellipsis}.kc-mt2 small{order:-1;font-variant-numeric:tabular-nums}.kc-mt2 small{font:600 11px var(--body);color:var(--muted);opacity:.75;margin:0;letter-spacing:.02em}
.kc-link{display:flex;align-items:center;justify-content:center;gap:6px;margin:14px auto 4px;border:0;background:none;color:var(--muted);font:800 14px var(--body);cursor:pointer}
.kc-btns.two{grid-template-columns:1fr 1fr;gap:10px}
.kc-tile{display:flex;align-items:center;gap:8px;height:76px;padding:0 12px;border:0;border-radius:20px;color:#fff;text-align:left;cursor:pointer;min-width:0;-webkit-tap-highlight-color:transparent}
.kc-tile svg{flex:none}.kc-tile span{display:flex;flex-direction:column;min-width:0}.kc-tile b{font:900 16px var(--display);white-space:nowrap}.kc-tile small{font:700 11.5px var(--body);opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kc-tile.shop{background:#D9952A;box-shadow:inset 0 -5px 0 #A86E16}
.kc-tile.haus{grid-column:1/-1;height:64px;background:#3B8C88;box-shadow:inset 0 -5px 0 #276562}.hs-ti{font-size:24px;line-height:1}
#hsslot{display:flex;flex-direction:column;gap:8px}#hsslot:empty{display:none}#hsslot:not(:empty){margin-bottom:10px}
.hs-ask,.hs-todo,.hs-t{display:flex;align-items:center;gap:10px;min-width:0}
.hs-ask{padding:10px 12px;border-radius:16px;background:rgba(59,140,136,.22);box-shadow:inset 0 0 0 1.5px rgba(96,196,190,.55);animation:hsIn .35s cubic-bezier(.2,.8,.2,1)}
.hs-todo{width:100%;padding:12px;border:0;border-radius:16px;background:var(--panel-2);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.1);color:var(--fg);text-align:left;cursor:pointer;animation:hsIn .35s cubic-bezier(.2,.8,.2,1);transition:opacity .4s,transform .4s}
.hs-todo.ok{opacity:.5;transform:scale(.98)}.hs-todo.ok .hs-tx{text-decoration:line-through}
.hs-box{width:26px;height:26px;border-radius:8px;box-shadow:inset 0 0 0 2.5px var(--muted);flex:none;transition:background .2s,box-shadow .2s;position:relative}
.hs-todo.ok .hs-box{background:var(--go);box-shadow:none}.hs-todo.ok .hs-box::after{content:"";position:absolute;left:9px;top:4px;width:6px;height:12px;border:solid #fff;border-width:0 3px 3px 0;transform:rotate(45deg)}
@keyframes hsIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
.hs-e{font-size:22px;flex:none}.hs-tx{flex:1;min-width:0;display:flex;flex-direction:column;font:800 15px var(--body);overflow-wrap:anywhere}.hs-tx b{font:900 11px var(--body);letter-spacing:.06em;text-transform:uppercase;color:#7FD6D0}.hs-tx small{font:700 12px var(--body);color:var(--muted)}
.hs-card{background:var(--panel);border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:10px}.hs-h{font:900 12px var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.hs-card input:not([type=file]){width:100%;box-sizing:border-box;padding:13px;border-radius:14px;border:2px solid var(--line);background:#2A2825;color:var(--fg);font:700 16px var(--body)}
.hs-row{display:flex;gap:8px;align-items:center}.hs-row .btn{flex:1}.hs-row input[type=date]{flex:1.2;min-width:0}
.hs-seg{display:flex;background:#2A2825;border-radius:12px;padding:3px;gap:3px}.hs-seg button{flex:1;border:0;border-radius:9px;padding:9px 4px;background:none;color:var(--muted);font:800 12.5px var(--body);cursor:pointer}.hs-seg button.on{background:var(--go);color:#fff}
.hs-t{padding:8px 0;border-top:1px solid rgba(255,255,255,.07)}.hs-t:first-of-type{border-top:0}.hs-del{border:0;background:none;color:var(--muted);font-size:15px;padding:8px 4px;cursor:pointer;flex:none}
.hs-prev{display:flex;gap:8px;align-items:flex-start}.hs-prev img{width:96px;border-radius:10px}.hs-img{width:100%;max-height:38vh;object-fit:cover;border-radius:14px}
.hs-st{display:flex;align-items:center;gap:8px;font:800 14px var(--body)}.hs-sn{width:84px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hs-bar{flex:1;height:10px;border-radius:5px;background:#2A2825;overflow:hidden}.hs-bar i{display:block;height:100%;background:var(--go);border-radius:5px;transition:width .6s}.hs-st small{font:700 11px var(--body);color:var(--muted)}
.hs-lg{font:700 13px var(--body);color:var(--muted)}.hs-sm{font-size:12.5px;margin:0}
.hs-hov{position:fixed;inset:0;z-index:340;background:rgba(10,9,8,.86);display:flex;align-items:center;justify-content:center;padding:24px;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.hs-hc{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;color:#fff;max-width:340px}.hs-hc small{font:900 12px var(--body);letter-spacing:.06em;text-transform:uppercase;color:#FF9DB2}.hs-hc>b{font:900 22px var(--display);overflow-wrap:anywhere}
.hs-hc p{margin:6px 0 0;font:800 15px var(--body);color:rgba(255,255,255,.8);min-height:22px}.hs-hc p b{font:900 22px var(--display);color:#fff}
.hs-heart{width:190px;height:182px;margin:18px 0 6px;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:pointer;transition:transform .12s ease-out;-webkit-tap-highlight-color:transparent}
.hs-heart svg{width:100%;height:100%;display:block;overflow:visible;pointer-events:none;filter:drop-shadow(0 10px 26px rgba(255,77,115,.35))}
.hs-heart.full{animation:hsBeat .7s cubic-bezier(.2,.8,.2,1) 2}@keyframes hsBeat{0%{transform:scale(1.12)}35%{transform:scale(1.32)}100%{transform:scale(1.12)}}
@media (prefers-reduced-motion: reduce){.hs-heart.full{animation:none}}
.hs-adr{display:flex;align-items:center;gap:10px}.hs-adr span{flex:1;min-width:0;display:flex;flex-direction:column;font:700 15px var(--body)}.hs-adr small{font:700 12px var(--body);color:var(--muted)}
.hs-abar{padding:10px 0 4px}.hs-abar input{width:100%;box-sizing:border-box;padding:14px;border-radius:14px;border:2px solid var(--line);background:#2A2825;color:var(--fg);font:700 17px var(--body)}
.hs-ai{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;border:0;border-radius:12px;padding:12px 14px;background:var(--panel);color:var(--fg);font:800 16px var(--body);cursor:pointer;flex:none;animation:hsIn .25s cubic-bezier(.2,.8,.2,1)}.hs-ai small{font:700 12.5px var(--body);color:var(--muted)}.hs-who{display:flex;flex-wrap:wrap;gap:6px}.hs-hint{padding:12px;border-radius:14px;background:rgba(59,140,136,.2);font:700 14px var(--body)}.kc-tile.cook{background:#E0694E;box-shadow:inset 0 -5px 0 #B04A32}
.kc-tile:active{transform:translateY(2px);box-shadow:inset 0 -2px 0 rgba(0,0,0,.3)}.kc-btns.two .kc-big{height:112px;font-size:19px;border-radius:22px}
.kc-num em{margin-left:auto;align-self:center;font:900 13px var(--body);color:var(--muted);background:var(--panel-2);border-radius:999px;padding:4px 10px;font-style:normal}.kc-num em.ok{color:#fff;background:linear-gradient(180deg,#ff9a3c,#e9573f)}.kc-num{width:100%}
.kc-mac{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.kc-mc{background:var(--panel-2);border-radius:14px;padding:8px 10px;display:flex;flex-direction:column;gap:3px;min-width:0}
.kc-mc span{font:800 11.5px var(--body);color:var(--muted);letter-spacing:.02em}.kc-mc b{font:900 17px var(--display);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kc-mc b small{font:800 11.5px var(--body);color:var(--muted)}
.kc-mc i{display:block;height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden}.kc-mc u{display:block;height:100%;border-radius:3px;background:var(--go);transition:width .4s}.kc-mc.ok{background:rgba(127,178,74,.2)}.kc-mc.ok u{background:linear-gradient(90deg,#7FB24A,#9BE25A)}.kc-mc.ok b{color:#9BE25A}
.kc-sbar{display:flex;align-items:center;gap:10px;width:100%;padding:13px 14px;border-radius:16px;border:2px solid var(--line);background:var(--panel-2);color:var(--muted);font:800 16px var(--body);cursor:text;text-align:left;-webkit-tap-highlight-color:transparent}.kc-sbar:active{border-color:var(--go)}
.kc-hr{display:flex;flex-direction:column;gap:8px}.kc-hrh{display:flex;justify-content:space-between;align-items:baseline}.kc-hrh b{font:900 18px var(--display)}.kc-hrh small{color:var(--muted);font:700 12px var(--body)}
.kc-clap{align-self:flex-end;margin:-2px 0 4px;border:0;border-radius:12px;padding:9px 14px;background:linear-gradient(180deg,var(--go-hi),var(--go));color:#fff;font:800 14px var(--body);box-shadow:inset 0 -3px 0 var(--go-deep);cursor:pointer}.kc-clap:active{transform:translateY(2px)}.kc-clap.on{background:var(--panel-3);box-shadow:none;color:var(--muted)}.kc-clapd{margin:-2px 4px 4px;font:700 13px var(--body);color:var(--go-hi)}.kc-hrt{display:flex;gap:6px;overflow-x:auto;scroll-snap-type:x proximity;margin:0 -4px;padding:0 4px}.kc-hrt .chip{flex:none;scroll-snap-align:center;font-size:14px;padding:8px 14px}.kc-hrl{display:flex;flex-direction:column;gap:8px}.kc-hs em{font:700 12px var(--body);font-style:normal;color:var(--muted);margin-left:3px}.kc-hrr{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:12px;background:var(--panel-2)}.kc-hrr.me{box-shadow:inset 0 0 0 1.5px rgba(143,196,88,.5)}.kc-hrr .r{width:16px;text-align:center;font:900 14px var(--display);color:var(--muted)}.kc-hrr:first-of-type .r{color:#FFD15C}
.kc-hrm{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}.kc-hrm>b{font:800 15px var(--body)}.kc-hrm small{color:var(--muted);font:600 11.5px var(--body)}.kc-hbs{display:flex;gap:6px;flex-wrap:wrap}
.kc-hb{display:flex;flex-direction:column;gap:2px;font:700 10px var(--body);color:var(--muted);width:52px}.kc-hb i{display:block;height:4px;border-radius:2px;background:rgba(255,255,255,.09);overflow:hidden}.kc-hb u{display:block;height:100%;background:#9BE25A;border-radius:2px}
.kc-hs{font:900 26px var(--display);font-variant-numeric:tabular-nums}.kc-hs.g{color:#9BE25A}.kc-hs.m{color:#F2C23A}.kc-hs.b{color:#EF7A5F}.kc-hrn{line-height:1.35}
.kc-top{gap:8px}.kc-top .kc-gear{flex:none}.kc-shop{display:flex;flex-direction:column;gap:10px}.kc-shop h3{margin:0;font:900 20px var(--display);display:flex;align-items:center;gap:8px}#kcshb{display:flex;flex-direction:column;gap:10px}
.kc-shh{display:flex;justify-content:space-between;align-items:center;gap:8px}.kc-shtt{flex:1;display:flex;align-items:center;gap:8px;font:900 19px var(--display);color:var(--fg)}.kc-shov .kc-sovb{gap:10px}.kc-shl{display:flex;gap:6px;overflow-x:auto}.kc-shl .chip{flex:none}
.kc-shm{display:flex;align-items:center;gap:4px}.kc-shm .kc-av{width:28px;height:28px;border-radius:50%;overflow:hidden;display:inline-block}.kc-shm .kc-av svg{width:100%;height:100%}.kc-shm small{margin-left:6px;font:600 12px var(--body)}
.kc-sha{display:flex;gap:6px}.kc-sha input{flex:1;min-width:0;padding:12px!important;font:700 16px var(--body)!important;border-radius:12px!important}.kc-sha .btn{flex:none;min-width:46px;font-size:20px}
.kc-shs{display:flex;flex-direction:column;gap:4px}.kc-shr{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 10px;background:var(--panel-2);border-radius:12px}
.kc-shc{flex:none;width:28px;height:28px;border-radius:9px;border:2px solid var(--go);background:none;color:#fff;font:900 16px var(--body);cursor:pointer;transition:transform .12s,background-color .15s}.kc-shc:active{transform:scale(.88)}
.kc-shr.done .kc-shc{background:var(--go)}.kc-shr.done .kc-shn b{text-decoration:line-through;color:var(--muted)}
.kc-shn{flex:1;min-width:0;display:flex;flex-direction:column}.kc-shn b{font:800 15px var(--body);overflow-wrap:anywhere}.kc-shn em{font-style:normal;color:var(--muted);font-weight:700}.kc-shn small{color:var(--muted);font:600 11.5px var(--body)}.kc-shn u{text-decoration:none;color:var(--go-hi)}
.kc-shd{display:flex;flex-direction:column;gap:4px;padding:10px;border-radius:14px;background:rgba(233,169,43,.08);box-shadow:inset 0 0 0 1.5px rgba(233,169,43,.35)}.kc-shd.ok{background:rgba(127,178,74,.1);box-shadow:inset 0 0 0 1.5px rgba(143,196,88,.45)}
.kc-shdh{display:grid;grid-template-columns:auto 1fr auto;column-gap:8px;align-items:center}.kc-shdh span{grid-row:span 2;font-size:24px}.kc-shdh b{font:900 17px var(--display)}.kc-shdh small{grid-column:2;color:var(--muted);font:600 11.5px var(--body)}.kc-shdh .kc-shx{grid-row:1 / span 2;grid-column:3}
.kc-shd .kc-shr{background:rgba(0,0,0,.2)}.kc-shd .kc-link{align-self:flex-start}.kc-shto{display:flex;align-items:center;gap:6px;font:700 13px var(--body);color:#E9A92B}.kc-shhint{font:600 11.5px/1.35 var(--body)}
.kc-shbar{display:flex;gap:8px;align-items:stretch}.kc-shbar input{flex:1;min-width:0;padding:15px 14px!important;font:800 17px var(--body)!important;border-radius:16px!important;border:2px solid var(--go)!important;background:#2A2825!important;color:var(--fg)}
.kc-shmic{flex:none;width:54px;border-radius:16px;border:0;background:var(--panel-3);color:var(--fg);display:grid;place-items:center;box-shadow:inset 0 -4px 0 rgba(0,0,0,.28);cursor:pointer;transition:transform .12s}.kc-shmic:active{transform:translateY(2px)}.kc-shmic.on{background:#E2523E;animation:kcMic 1s ease-in-out infinite}@keyframes kcMic{50%{box-shadow:0 0 0 8px rgba(226,82,62,.25)}}
.kc-shok{flex:none;min-width:62px;border-radius:16px;border:0;background:linear-gradient(180deg,var(--go-hi),var(--go));color:#fff;font:900 17px var(--display);box-shadow:inset 0 -4px 0 var(--go-deep);cursor:pointer;transition:transform .12s}.kc-shok:active{transform:translateY(2px)}
.kc-shsg{display:flex;flex-direction:column;gap:4px}.kc-shsg button{display:flex;align-items:center;gap:8px;text-align:left;padding:12px 14px;border-radius:14px;border:0;background:var(--panel-2);color:var(--fg);cursor:pointer}.kc-shsg b{font:800 15px var(--body);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kc-shsg small{color:var(--muted);font:600 12px var(--body);flex:none;max-width:35%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kc-shsg i{font-style:normal;color:var(--go-hi);font:900 20px var(--body)}
.kc-shgob{border:0;border-radius:16px;padding:15px;background:#C9853F;color:#fff;font:900 18px var(--display);box-shadow:inset 0 -4px 0 #9A6228;text-shadow:0 1px 0 rgba(0,0,0,.2);cursor:pointer}.kc-shgob:active{transform:translateY(2px)}
.kc-shst{display:grid;grid-template-columns:1fr 1fr;gap:8px}.kc-shst button{border:0;border-radius:18px;padding:26px 8px;background:var(--panel-3);color:var(--fg);font:900 22px var(--display);box-shadow:inset 0 -5px 0 rgba(0,0,0,.28);cursor:pointer}.kc-shst button:active{transform:translateY(2px)}.kc-shst button:last-child:nth-child(odd){grid-column:1 / -1}
.kc-shgo{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-radius:14px;background:rgba(201,133,63,.16);box-shadow:inset 0 0 0 1.5px rgba(201,133,63,.55)}.kc-shgo b{font:900 15px var(--display);color:#E0A262}.kc-shgo button{border:0;border-radius:10px;padding:7px 10px;background:var(--panel-3);color:var(--fg);font:800 13px var(--body)}
.kc-shcat{font:900 14px var(--display);margin:8px 2px 0;color:var(--fg)}.kc-shc.lock{display:grid;place-items:center;background:var(--panel-3);border-color:var(--panel-3);color:var(--muted)}.kc-shr.log{opacity:.75}
.kc-shwait{color:var(--muted);font:700 14px var(--body);margin:2px 4px}#kcslst,#kcsftr{display:flex;flex-direction:column;gap:8px}#kcsftr{margin:0}.kc-shov .kc-shgob{padding:12px;font-size:15px}
.kc-shtg{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:14px;background:var(--panel-2)}.kc-shtg button{border:0;border-radius:11px;padding:10px;background:none;color:var(--muted);font:900 15px var(--display);cursor:pointer}.kc-shtg button.on{background:var(--go);color:#fff;box-shadow:inset 0 -3px 0 var(--go-deep)}
.kc-shq{flex:none;width:34px;height:34px;border-radius:11px;border:0;background:var(--panel-3);color:#E0A262;font:900 17px var(--display);box-shadow:inset 0 -3px 0 rgba(0,0,0,.25);cursor:pointer}.kc-shq.on{background:#C9853F;color:#fff;box-shadow:inset 0 -3px 0 #9A6228}
.kc-shr{flex-wrap:wrap;row-gap:4px}.kc-shsub{flex:0 0 100%;display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;padding-left:38px;cursor:pointer}.kc-shsub small{color:var(--muted);font:600 11.5px var(--body)}.kc-shsub u{text-decoration:none;color:var(--go-hi)}
.kc-shsub{margin-top:-4px}.kc-shov .kc-shsub{padding-left:48px;margin-top:-9px}.kc-shov .kc-shsub small{font-size:12.5px}.kc-shn em{white-space:nowrap}
.kc-shtag{font:800 12.5px var(--body);font-style:normal;border-radius:9px;padding:4px 9px}.kc-shtag.y{background:rgba(127,178,74,.2);color:#B8F07A}.kc-shtag.n{background:rgba(226,82,62,.18);color:#FF9A88}
.kc-shgob.on{background:var(--panel-2);color:#E0A262;box-shadow:inset 0 0 0 2px #C9853F;text-shadow:none}
.kc-aski{width:100%;box-sizing:border-box;padding:14px!important;border-radius:14px!important;border:2px solid var(--line)!important;background:#2A2825!important;color:var(--fg);font:700 16px var(--body)!important;text-align:center}.kc-askn{margin:0;font:700 16px var(--body);color:var(--muted)}
.kc-askc{display:flex;flex-direction:column;gap:10px;text-align:center}.kc-aske{font-size:44px}.kc-askc h3{margin:0;font:900 22px var(--display)}.kc-askq{font:700 18px var(--body);margin:0}.kc-askb{display:flex;flex-direction:column;gap:8px}
.kc-shov .kc-shr{padding:12px 10px 12px 12px;border-radius:16px;gap:12px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}.kc-shr.new,.kc-shd.new{animation:kcRow .26s cubic-bezier(.22,1,.36,1)}@keyframes kcRow{from{opacity:0;transform:translateY(6px)}}.kc-shr.tmp{opacity:.6}
.kc-shov .kc-shc{width:36px;height:36px;border-radius:12px;font-size:20px;border-width:2.5px}.kc-shov .kc-shn{cursor:pointer}.kc-shov .kc-psg{margin:-2px 0 8px}.kc-psg button{width:100%}.kc-psg small{max-width:58%}.kc-ek{display:flex;flex-direction:column;gap:10px;margin:2px 0 12px}.kc-eit{background:var(--panel-2);border-radius:14px;padding:4px 14px;margin:12px 0}
.kc-eih,.kc-eir{display:flex;align-items:center;gap:10px}.kc-eih{padding:9px 0 7px;font:800 11.5px var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}.kc-eih>span:first-child{flex:1}
.kc-eir{padding:9px 0;border-top:1px solid rgba(255,255,255,.06)}.kc-ein{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}.kc-ein b{font:800 15px var(--body);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kc-ein small{font:600 12px var(--body);color:var(--muted)}
.kc-eir .kc-n.k{color:var(--fg);font:900 15px var(--display)}
.kc-drn{text-align:center;font-size:12.5px;margin:6px 0 0}.kc-ck{margin:8px 0 10px;padding:10px 12px;border-radius:14px;background:var(--panel-2);display:flex;flex-direction:column;gap:7px}.kc-ck b{font:800 14px var(--body)}.kc-ckb{display:flex;gap:8px;flex-wrap:wrap}.kc-ckb .chip{flex:1 1 auto;justify-content:center;white-space:nowrap}.kc-ck small{font-size:12px;line-height:1.35}.kc-ck.ask{box-shadow:inset 0 0 0 2px var(--go)}.kc-ck.shake{animation:kcShake .32s}@keyframes kcShake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}.kc-sadd .kc-ck{margin-top:0}
.kc-shn b{font:800 17px var(--body);overflow-wrap:break-word;-webkit-hyphens:auto;hyphens:auto}.kc-shr{gap:9px}.kc-shov .kc-shn small{font-size:12.5px}
.kc-shbuy{flex:none;border:0;border-radius:12px;padding:9px 9px;background:var(--panel-3);color:var(--fg);font:800 12.5px var(--body);box-shadow:inset 0 -3px 0 rgba(0,0,0,.25);cursor:pointer}.kc-shbuy.on{background:var(--go);color:#fff;box-shadow:inset 0 -3px 0 var(--go-deep)}.kc-shbuy[disabled]{opacity:.4}
.kc-shov .kc-shx{font-size:24px;padding:6px 8px;border-radius:10px}.kc-shx.arm{background:#E2523E;color:#fff;font:800 13px var(--body);padding:9px 10px}
.kc-shov .kc-shm{flex-wrap:wrap}.kc-shov .kc-shm .btn{margin-left:auto}
.kc-shr .chip{flex:none;font-size:12px;padding:5px 9px}.kc-shr .chip[disabled]{opacity:.45}.kc-shx{flex:none;border:0;background:none;color:var(--muted);font:700 22px/1 var(--body);padding:2px 6px;cursor:pointer}
.kc-quick{display:flex;flex-direction:column;gap:6px}.kc-sugg{margin-top:16px}.kc-qh{font:900 12px var(--body);color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin:2px 2px 0}
.kc-q{display:flex;align-items:center;gap:10px;width:100%;padding:8px 8px 8px 12px;border-radius:14px;border:0;background:var(--panel-2);color:var(--fg);text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}.kc-q:active{transform:scale(.98)}
.kc-qe{font-size:24px}.kc-qn{flex:1;min-width:0;display:flex;flex-direction:column;font:800 15px var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kc-qn small{color:var(--muted);font-weight:700;font-size:12px}
.kc-q em{width:38px;height:38px;border-radius:12px;background:var(--go);color:#fff;display:grid;place-items:center;flex:none;box-shadow:inset 0 -3px 0 var(--go-deep)}.kc-q.ok em{background:#ffb84d}
.kc-setup-b{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border-radius:16px;border:2px solid var(--go);background:rgba(127,178,74,.12);color:var(--fg);text-align:left;cursor:pointer}.kc-setup-b span{font-size:28px}.kc-setup-b b{display:flex;flex-direction:column;font:900 16px var(--body)}.kc-setup-b small{color:var(--muted);font:700 12.5px var(--body)}
.kc-fl.big{border:0;cursor:pointer;font-size:18px;padding:5px 12px;color:var(--fg)}.kc-fl .kc-ice{font-style:normal;font-size:13px;margin-left:4px;letter-spacing:-2px}
.kc-conf{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:400}
.kc-setup .kc-vtop{align-items:center}.kc-dots{display:flex;gap:6px}.kc-dots i{width:22px;height:6px;border-radius:3px;background:rgba(255,255,255,.15)}.kc-dots i.on{background:var(--go)}
.kc-smid{flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px;max-width:480px;width:100%;margin:0 auto;padding-bottom:6vh}.kc-smid h2{font:900 28px var(--display);margin:0;text-align:center}
.kc-opts{display:flex;flex-direction:column;gap:10px}.kc-opts.two{flex-direction:row}.kc-opts.two .kc-opt{flex:1;flex-direction:column;justify-content:center;padding:22px 10px}
.kc-opt{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:18px;border:2px solid rgba(255,255,255,.08);background:#211F1C;color:#fff;text-align:left;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.35);transition:transform .1s,border-color .15s;-webkit-tap-highlight-color:transparent}
.kc-opt:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.35)}.kc-opt.on{border-color:var(--go);background:rgba(127,178,74,.16)}.kc-opt span{font-size:32px}.kc-opt b{display:flex;flex-direction:column;font:900 18px var(--body)}.kc-opt small{font:700 13px var(--body);color:rgba(255,255,255,.55);margin-top:2px}
.kc-bform{display:flex;flex-direction:column;gap:10px}.kc-bform label{display:flex;align-items:center;gap:10px;background:#211F1C;border-radius:16px;padding:6px 14px;border:2px solid rgba(255,255,255,.08)}.kc-bform label:focus-within{border-color:var(--go)}
.kc-bform span{flex:1;font:800 16px var(--body);color:rgba(255,255,255,.7)}.kc-bform input{width:110px;text-align:right;border:0;background:none;color:#fff;font:900 26px var(--display);padding:8px 0;outline:none}.kc-bform em{font-style:normal;font:800 15px var(--body);color:rgba(255,255,255,.55);width:44px}
.kc-res{display:flex;flex-direction:column;gap:12px;text-align:center}.kc-resk b{display:block;font:900 64px/1 var(--display);color:#9BE25A}.kc-resk span{font:800 16px var(--body);color:rgba(255,255,255,.6)}.kc-res p{margin:0;font-size:13.5px}
.kc-weigh{text-align:center;align-items:stretch}.kc-weigh h3{margin:0}.kc-weigh .kc-gram label{justify-content:center}.kc-seg{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.kc-icebox{text-align:center}.kc-icebox h3{margin:0;font:900 24px var(--display)}.kc-ices{display:flex;justify-content:center;gap:14px;font-size:44px}.kc-ices span{filter:grayscale(1) opacity(.3)}.kc-ices span.on{filter:none}.kc-icet{margin:0;font-size:14px;line-height:1.4}
.kc-tgt>div{display:flex;flex-direction:column;gap:2px;background:var(--panel-2);border-radius:14px;padding:10px 12px;margin:6px 0}.kc-tgt b{font:900 20px var(--display)}.kc-tgt span{font:800 13px var(--body)}.kc-tgt small{color:var(--muted);font:700 12px var(--body)}
.kc-find{background:#E9A92B;box-shadow:inset 0 -5px 0 #B47E18}.kc-find:active{box-shadow:inset 0 -2px 0 #B47E18}
.kc-amt{display:flex;flex-direction:column;gap:6px}.kc-al{font:800 13px var(--body)}.kc-al small{font-weight:700}
.kc-srch{display:flex;flex-direction:column;gap:10px}.kc-srch h3{margin:0}
.kc-sq{display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:14px;border:2px solid var(--line);background:var(--panel-2);color:var(--muted)}.kc-sq:focus-within{border-color:var(--go)}
.kc-sq input{flex:1;min-width:0;border:0;background:none;color:var(--fg);font:800 17px var(--body);padding:12px 0;outline:none;-webkit-appearance:none}
.kc-sr{display:flex;flex-direction:column;gap:6px;min-height:140px;transition:opacity .15s}.kc-sr.busy{opacity:.5}
.kc-sres{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:14px;border:0;background:var(--panel-2);color:var(--fg);text-align:left;cursor:pointer;width:100%;-webkit-tap-highlight-color:transparent}.kc-sres:active{transform:scale(.98)}.kc-sres.load{opacity:.55}
.kc-est{text-decoration:none;color:#FF9A88;font-weight:800}
.kc-sph.kc-srec{background:var(--panel-3)}
.kc-sres img,.kc-sph{width:44px;height:44px;border-radius:10px;object-fit:contain;flex:none;background:#fff;display:flex;align-items:center;justify-content:center;font-size:24px}
.kc-sn{flex:1;min-width:0;display:flex;flex-direction:column;font:800 15px var(--body);line-height:1.2}.kc-sn small{color:var(--muted);font-weight:700;font-size:12px;margin-top:2px}
.kc-sres b{display:flex;flex-direction:column;align-items:flex-end;font:900 17px var(--display);white-space:nowrap}.kc-sres b small{font:700 11px var(--body);color:var(--muted)}
.kc-sh{font:800 12px var(--body);margin:2px 2px 0}
.kc-rep{display:grid;grid-template-columns:1fr 1fr;gap:8px}.kc-rep .btn{display:flex;align-items:center;justify-content:center;gap:6px}
.kc-amtb{display:flex;justify-content:space-between;align-items:center;gap:8px}.kc-amtb small{color:var(--muted);font-weight:800}
.kc-nums{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.kc-nums input{text-align:center;padding:10px 2px;min-width:0;width:100%;box-sizing:border-box}
.kc-pt{margin:2px 0 -2px;font:800 12px var(--body)}.kc-ih{font:800 12px var(--body);margin-bottom:-4px}
.kc-items button[data-it]{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;background:var(--panel-2);border-radius:10px;border:0;width:100%;text-align:left;color:var(--fg);cursor:pointer;-webkit-tap-highlight-color:transparent}
.kc-items button[data-it] span{flex:1;min-width:0}.kc-items button[data-it] em{color:var(--muted);display:flex;flex:none}.kc-items button[data-it]:active{transform:scale(.98)}
@media (max-width:380px){.kc-big{height:84px;font-size:15px}}.kc-scan{background:#5AA3E0;box-shadow:inset 0 -5px 0 #3B7FC0}.kc-scan:active{box-shadow:inset 0 -2px 0 #3B7FC0}
.kc-tip{background:var(--panel-2);border-radius:12px;padding:9px 12px;font:700 13.5px/1.35 var(--body);color:var(--fg)}.kc-tip.ok{background:linear-gradient(90deg,rgba(255,150,60,.22),rgba(255,90,40,.12))}
.kc-inv .kc-invt{font:800 16px var(--body)}.kc-inv p{margin:0}.kc-row2{display:flex;gap:8px;margin-top:6px}.kc-row2 .btn{flex:1}
.kc-ov-full{position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;background:#141312;color:#fff;padding:calc(env(safe-area-inset-top,0px) + 10px) 16px calc(env(safe-area-inset-bottom,0px) + 16px)}
.kc-vtop{display:flex;justify-content:space-between;position:relative;z-index:3}.kc-x{width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.12);color:#fff;display:grid;place-items:center;cursor:pointer}.kc-x.on{background:#ffd34d;color:#222}
.kc-vmid{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;max-width:520px;margin:0 auto;width:100%}
.kc-vt{font:900 26px var(--display)}.kc-heard{font:700 20px/1.35 var(--body);min-height:2.7em;max-height:40vh;overflow:auto}.kc-heard.dim{color:rgba(255,255,255,.35)}.kc-vh{font:700 14px var(--body);color:rgba(255,255,255,.6);min-height:1.3em}
.kc-mic{width:132px;height:132px;border-radius:50%;border:0;display:grid;place-items:center;cursor:pointer;color:#fff;background:#3D3A35;box-shadow:inset 0 -6px 0 rgba(0,0,0,.3);transition:background .2s,transform .15s}
.kc-voice.rec .kc-mic{background:#E23B3B;box-shadow:0 0 0 0 rgba(226,59,59,.6),inset 0 -6px 0 #a52525;animation:kcPulse 1.4s infinite}
.kc-wave{width:min(420px,100%);height:84px;display:block}
.kc-mic{position:relative}.kc-ring{position:absolute;inset:-10px;border-radius:50%;border:4px solid rgba(255,90,80,.0);transition:transform .08s linear;pointer-events:none}
.kc-voice.rec .kc-ring{border-color:rgba(255,90,80,.45)}.kc-voice.rec .kc-mic{animation:none}.kc-mi{display:grid;place-items:center}.kc-ms2{display:none;width:40px;height:40px;border-radius:9px;background:#fff}
.kc-voice.rec .kc-mi{display:none}.kc-voice.rec .kc-ms2{display:block}.kc-mic:active{transform:scale(.94)}
.kc-vtime{font:800 17px var(--body);font-variant-numeric:tabular-nums;color:#ff6b6b;align-self:center}.kc-vdone{width:min(320px,100%)}
.kc-voice.typing .kc-wave{display:none}
.kc-voice.rec .kc-vt{color:#ff6b6b}.kc-voice.think .kc-mic{background:#3D3A35;animation:kcSpin 1s linear infinite;opacity:.7}
@keyframes kcPulse{0%{box-shadow:0 0 0 0 rgba(226,59,59,.55),inset 0 -6px 0 #a52525}70%{box-shadow:0 0 0 26px rgba(226,59,59,0),inset 0 -6px 0 #a52525}100%{box-shadow:0 0 0 0 rgba(226,59,59,0),inset 0 -6px 0 #a52525}}
@keyframes kcSpin{50%{transform:scale(.92)}}
.kc-type{width:100%;display:flex;flex-direction:column;gap:10px}.kc-type textarea{width:100%;box-sizing:border-box;border-radius:14px;border:2px solid #3F3B36;background:#211F1C;color:#fff;font:600 18px var(--body);padding:12px}
.kc-vbot{display:flex;justify-content:center}.kc-vbot .btn{color:rgba(255,255,255,.7)}
.kc-scanov:has(.kc-rp) .kc-frame{top:30%;width:min(62vw,280px)}.kc-rp{width:100%;max-width:460px;display:flex;flex-direction:column;gap:8px;background:rgba(20,19,17,.88);border-radius:20px;padding:12px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.kc-rl{display:flex;flex-direction:column;gap:4px;max-height:30vh;overflow:auto}.kc-rl>div{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:12px;background:rgba(255,255,255,.06)}.kc-rl>div.ok{background:rgba(127,178,74,.22)}
.kc-rl i{width:24px;height:24px;border-radius:50%;border:2px solid rgba(255,255,255,.35);display:grid;place-items:center;font:900 13px var(--body);font-style:normal;flex:none}.kc-rl .ok i{background:var(--go);border-color:var(--go)}
.kc-rl span{display:flex;flex-direction:column;font:800 14px var(--body);min-width:0}.kc-rl small{color:rgba(255,255,255,.55);font-weight:700;font-size:12px}
.kc-rmsg{font:900 15px var(--body);text-align:center;color:#fff}.kc-rmsg.ok{color:#9BE25A}.kc-rask{display:flex;flex-direction:column;gap:6px;font:800 14px var(--body)}.kc-rask>div{display:flex;flex-wrap:wrap;gap:6px}
.kc-roundb{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border-radius:16px;border:0;background:#5AA3E0;color:#fff;text-align:left;cursor:pointer;box-shadow:inset 0 -4px 0 #3B7FC0}.kc-roundb b{display:flex;flex-direction:column;font:900 16px var(--body)}.kc-roundb small{font:700 12px var(--body);opacity:.85}.kc-roundb:active{transform:translateY(2px)}
.kc-scanov{padding:0;background:#000}.kc-scanov video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.kc-scanov .kc-vtop{position:absolute;top:calc(env(safe-area-inset-top,0px) + 10px);left:16px;right:16px}
.kc-frame{position:absolute;left:50%;top:44%;width:min(74vw,340px);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:24px;box-shadow:0 0 0 100vmax rgba(0,0,0,.45)}
.kc-frame i{position:absolute;width:42px;height:42px;border:5px solid #fff;border-radius:6px}.kc-frame i:nth-child(1){left:-3px;top:-3px;border-right:0;border-bottom:0;border-top-left-radius:22px}.kc-frame i:nth-child(2){right:-3px;top:-3px;border-left:0;border-bottom:0;border-top-right-radius:22px}
.kc-frame i:nth-child(3){left:-3px;bottom:-3px;border-right:0;border-top:0;border-bottom-left-radius:22px}.kc-frame i:nth-child(4){right:-3px;bottom:-3px;border-left:0;border-top:0;border-bottom-right-radius:22px}
.kc-laser{position:absolute;left:8%;right:8%;top:50%;height:2px;background:#ff4b4b;box-shadow:0 0 10px #ff4b4b;animation:kcLaser 1.6s ease-in-out infinite}@keyframes kcLaser{0%,100%{top:18%}50%{top:82%}}
.kc-scanov.found .kc-frame i{border-color:var(--go)}.kc-scanov.found .kc-laser{display:none}
.kc-sbot{position:absolute;left:16px;right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 18px);display:flex;flex-direction:column;gap:10px;align-items:center}
.kc-hint{font:800 15px var(--body);text-align:center;text-shadow:0 1px 4px rgba(0,0,0,.6)}.kc-man{display:flex;gap:8px;width:100%;max-width:420px}.kc-man input{flex:1;min-width:0;border-radius:12px;border:0;background:rgba(255,255,255,.14);color:#fff;font:700 17px var(--body);padding:12px}
.kc-ms,.kc-prod,.kc-form{display:flex;flex-direction:column;gap:10px}.kc-mh,.kc-ph{display:flex;align-items:center;gap:12px}.kc-mh>div,.kc-ph>div{min-width:0}
.kc-pin{margin-left:auto;flex:none;display:inline-flex;align-items:center;gap:5px;border:1.5px solid var(--line);background:none;color:var(--muted);font:800 13px var(--body);padding:7px 11px;border-radius:999px;cursor:pointer;-webkit-tap-highlight-color:transparent}.kc-pin.on{background:var(--go);border-color:var(--go);color:#fff}.kc-pin:active{transform:scale(.96)}
.kc-pinm{display:inline-flex;vertical-align:-1px;margin-right:6px;color:var(--go-hi,#8FC458);font-style:normal}
.kc-showp{display:flex;flex-direction:column;gap:7px;margin:8px 0 12px}.kc-showp>b{font:900 15px var(--body)}.kc-showp small{font-size:12.5px}.kc-ssub{margin:-8px 0 0;text-align:center}
.kc-sk em{display:block;font:900 16px var(--body);font-style:normal;color:var(--fg);margin-bottom:3px}.kc-me{font-size:40px}.kc-mt{font:900 20px var(--display)}
.kc-ph img{width:64px;height:64px;object-fit:contain;border-radius:10px;background:#fff}.kc-ph>span{font-size:44px}
.kc-mk{font:800 15px var(--body);color:var(--muted)}.kc-mk small{display:block;font:700 13px var(--body);margin-top:2px}.kc-mk b{font:900 32px var(--display);color:var(--fg)}
.kc-macros{display:flex;gap:8px}.kc-macros span{flex:1;background:var(--panel-2);border-radius:12px;padding:8px;text-align:center;color:var(--muted);font:700 12px var(--body);display:flex;flex-direction:column}.kc-macros b{color:var(--fg);font:900 16px var(--display)}
.kc-up{animation:kcUp .5s cubic-bezier(.22,1,.36,1)}.kc-dn{animation:kcDn .5s cubic-bezier(.22,1,.36,1)}[data-t],[data-rk],[data-cnt]{display:inline-block;font-variant-numeric:tabular-nums}var[data-cnt]{font:inherit;font-style:normal;color:inherit;letter-spacing:inherit}
@keyframes kcUp{0%{transform:translateY(7px);color:#FFB45A}60%{color:#FFB45A}100%{transform:none}}@keyframes kcDn{0%{transform:translateY(-7px);color:#8FD4FF}60%{color:#8FD4FF}100%{transform:none}}
.kc-items{display:flex;flex-direction:column;gap:4px}
.kc-items>.kc-irow{display:flex;align-items:stretch;gap:4px;padding:0;background:none}.kc-irow>button{flex:1;min-width:0}
.kc-gi{flex:none;display:flex;align-items:center;gap:4px;padding:0 10px;border-radius:10px;background:var(--panel-2);border:2px solid var(--line);color:var(--muted);font:800 14px var(--body);cursor:text}
.kc-tot{display:flex;align-items:stretch;justify-content:space-between;gap:10px;padding:8px 6px 8px 12px;border-radius:12px;border:2px solid var(--go);background:var(--panel-2)}.kc-tot>span{display:flex;flex-direction:column;justify-content:center;font:900 15px var(--body);min-width:0}.kc-tot small{color:var(--muted);font:700 12px var(--body)}.kc-tot .kc-gi{background:var(--panel)}.kc-tot .kc-gi input{width:64px}
.kc-gi:focus-within{border-color:var(--go)}.kc-gi input{width:52px;border:0!important;background:none!important;color:var(--fg);font:900 17px var(--display);text-align:right;padding:8px 0;outline:none}.kc-gi i{font-style:normal}.kc-items>div{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;background:var(--panel-2);border-radius:10px}.kc-items span{display:flex;flex-direction:column;font:800 14px var(--body)}.kc-items small{color:var(--muted);font-weight:700}.kc-items b{white-space:nowrap;font:900 14px var(--body)}
.kc-said{margin:0;font-size:13px}.kc-portion{display:flex;flex-direction:column;gap:6px}.kc-portion>div,.kc-chips{display:flex;flex-wrap:wrap;gap:6px}.kc-chips .chip.on{background:var(--go);border-color:var(--go);color:#fff}
.kc-per{margin:0}.kc-gram{display:flex;align-items:center;gap:8px}.kc-gram .btn{width:52px;flex:none;font-size:22px}.kc-gram label{flex:1;min-width:0;display:flex;align-items:center;gap:6px;font:800 18px var(--body)}.kc-gram input{flex:1;min-width:0;width:100%;box-sizing:border-box;text-align:center;font:900 24px var(--display);padding:8px;border-radius:12px;border:2px solid var(--line);background:var(--panel-2);color:var(--fg)}
.kc-form label{display:flex;flex-direction:column;gap:4px;font:700 13px var(--body);color:var(--muted)}.kc-form input{font:700 17px var(--body);padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--panel-2);color:var(--fg)}
.kc-goal{display:flex;align-items:center;gap:8px;margin:8px 0 6px;font:800 14px var(--body)}.kc-goal input{width:90px;text-align:center;font:900 18px var(--display);padding:6px;border-radius:10px;border:1px solid var(--line);background:var(--panel-2);color:var(--fg)}
.kc-page{max-width:640px}.kc-top{display:flex;align-items:center;gap:10px}.kc-top .h-title{flex:1;margin:0}.kc-gear{background:var(--panel-2);color:var(--fg)}
.kc-tabs{margin:12px 0}.kc-tabs .btn{flex:1}.kc-sum{display:flex;flex-direction:column;gap:10px}.kc-man-b{align-self:center}
.kc-day{display:flex;justify-content:space-between;align-items:baseline;margin:16px 2px 7px;font:800 12px var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);scroll-margin-top:70px}.kc-day b{font:900 14px var(--display);letter-spacing:0;text-transform:none;color:var(--fg)}.kc-day.hit b{color:#ff8a3d}
.kc-list{display:flex;flex-direction:column;gap:6px}.kc-meal{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:0;border-radius:12px;background:var(--panel);color:var(--fg);text-align:left;cursor:pointer;font:inherit}
.kc-tm{color:var(--muted);font:800 12px var(--body);min-width:38px}.kc-em{font-size:22px}.kc-mn{flex:1;min-width:0;display:flex;flex-direction:column;font:800 15px var(--body)}.kc-mn small{color:var(--muted);font:700 12px var(--body)}.kc-meal b{font:900 16px var(--display)}
.kc-empty{text-align:center;padding:14px 6px}
.kc-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px}.kc-stats>div{display:flex;flex-direction:column;align-items:center;text-align:center}.kc-stats b{font:900 20px var(--display)}.kc-stats small{color:var(--muted);font:700 11px var(--body)}
.kc-chart{position:relative;height:150px;display:flex;align-items:flex-end;gap:4px;padding-bottom:18px}.kc-col{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;border:0;background:none;padding:0;cursor:pointer;position:relative}
.kc-col i{display:block;width:100%;border-radius:6px 6px 2px 2px;background:var(--panel-3);min-height:3px}.kc-col.hit i{background:linear-gradient(180deg,#ffb347,#ff6a2b)}.kc-col.sel i{outline:2px solid var(--fg)}
.kc-col small{position:absolute;bottom:-17px;color:var(--muted);font:700 10.5px var(--body)}
.kc-gl{position:absolute;left:0;right:0;bottom:calc(18px + (100% - 18px) * var(--goal) / 100);border-top:2px dashed rgba(255,255,255,.35);pointer-events:none}.kc-gl span{position:absolute;right:0;top:-17px;font:800 10.5px var(--body);color:var(--muted)}
.kc-fr{display:flex;flex-direction:column;gap:6px}.kc-frr{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:0;border-radius:14px;background:var(--panel);color:var(--fg);text-align:left;cursor:pointer;font:inherit}.kc-frr.me{outline:2px solid color-mix(in srgb,var(--go) 55%,transparent)}
.kc-av{width:40px;height:40px;flex:none;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:var(--panel-3)}.kc-av svg{width:40px;height:40px}.kc-frm{flex:1;min-width:0;display:flex;flex-direction:column}.kc-frm b{font:800 15px var(--body)}.kc-frm small{color:var(--muted);font:700 12px var(--body)}
.kc-cel,.kc-intro{text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px}.kc-cel h2,.kc-intro h2{margin:0}.kc-celf{font-size:72px;animation:kcFl 1.2s ease-in-out infinite}@keyframes kcFl{50%{transform:scale(1.12) rotate(-4deg)}}
.kc-setsheet h3{margin:0 0 8px}`;
  document.head.appendChild(css);
})();
