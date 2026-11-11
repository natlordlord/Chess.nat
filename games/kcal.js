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
  const hhmm = t => new Date(t).toLocaleTimeString("de-DE", {hour: "2-digit", minute: "2-digit"});
  const haptic = p => { try { if (typeof Haptic !== "undefined") Haptic.go(p || 10); } catch(e) {} };
  const say = (t, ms) => { try { toast(t, ms); } catch(e) {} };
  const svg = (p, s = 24) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const IC = {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    code: '<path d="M4 6v12M7 6v12M10 6v12M14 6v12M17 6v12M20 6v12"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', chef: '<path d="M6 13.5A4 4 0 0 1 7.5 6a4.5 4.5 0 0 1 9 0A4 4 0 0 1 18 13.5V20H6z"/><path d="M6 17h12"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', kb: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 15h10"/>',
    torch: '<path d="M8 2h8l-2 6v13h-4V8z"/><path d="M12 12v2"/>',
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
    targets(){ const p = this.prof || {}, g = this.goal(); return {kcal: g, protein: p.protein || Math.round(g * .25 / 4), carbs: p.carbs || Math.round(g * .47 / 4), fat: p.fat || Math.round(g * .28 / 9)}; },
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
    async add(meal){
      const c = sb(), id = meId(); if (!c || !id) throw new Error("Bitte anmelden");
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
    wireDay(el);
    if (K.loaded){ Weigh.check(); Wrap.check(); }
  }
  window.homeKcal = async el => {
    if (!el) return; homeEl = el;
    if (!meId() && typeof Social !== "undefined"){ el.hidden = true; let n = 0; const wait = () => { if (meId()) return window.homeKcal(el); if (++n < 20 && el.isConnected) setTimeout(wait, 500); }; setTimeout(wait, 500); return; }
    K.fromCache(); fillHome(el);
    try { await K.load(); } catch(e) { return; }
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
  const AIMS = [["lose", "🔥", "Abnehmen", "Fett verlieren, Muskeln halten", .8, 2], ["keep", "⚖️", "Gewicht halten", "Fit bleiben, so wie jetzt", 1, 1.6], ["muscle", "💪", "Muskeln aufbauen", "Sauber zunehmen, viel Protein", 1.1, 2], ["gain", "📈", "Zunehmen", "Mehr auf die Waage", 1.15, 1.7], ["bulk", "🦍", "Bulken", "So viel Masse wie geht", 1.2, 1.8]];
  const ACTS = [[1.2, "Kaum Bewegung", "Viel sitzen, kein Sport"], [1.375, "Etwas aktiv", "1–2× Sport pro Woche"], [1.55, "Aktiv", "3–5× Sport pro Woche"], [1.725, "Sehr aktiv", "6–7× Sport oder körperliche Arbeit"], [1.9, "Extrem aktiv", "Leistungssport und harte Arbeit"]];
  function needs(b){ const age = Math.max(14, new Date().getFullYear() - (b.born || 1995)), w = Number(b.weight) || 75, hg = Number(b.height) || 178, bmr = 10 * w + 6.25 * hg - 5 * age + (b.sex === "f" ? -161 : 5), tdee = bmr * (Number(b.activity) || 1.375), A = AIMS.find(a => a[0] === b.aim) || AIMS[1];
    const kcal = Math.round(tdee * A[4] / 10) * 10, protein = Math.round(w * A[5]), fat = Math.round(kcal * .27 / 9), carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    return {kcal, protein, carbs, fat, bmr: Math.round(bmr), tdee: Math.round(tdee), A}; }
  /* the questions at the start (and whenever the goal changes): one question per screen, big answers */
  const Setup = {
    open(done){
      if (!meId()) return say("Bitte erst anmelden");
      const b = Object.assign({aim: null, sex: null, born: null, height: null, weight: null, activity: null}, K.body || {}), steps = ["aim", "sex", "body", "act", "res"], ov = document.createElement("div"); let step = 0;
      ov.className = "kc-ov-full kc-setup"; ov.setAttribute("data-notr", ""); document.body.appendChild(ov);
      const close = () => ov.remove();
      const draw = () => { const k = steps[step]; let body = "";
        if (k === "aim") body = `<h2>Was ist dein Ziel?</h2><div class="kc-opts">${AIMS.map(a => `<button class="kc-opt ${b.aim === a[0] ? "on" : ""}" data-v="${a[0]}"><span>${a[1]}</span><b>${a[2]}<small>${a[3]}</small></b></button>`).join("")}</div>`;
        else if (k === "sex") body = `<h2>Du bist …</h2><div class="kc-opts two">${[["m", "👨", "Mann"], ["f", "👩", "Frau"]].map(a => `<button class="kc-opt ${b.sex === a[0] ? "on" : ""}" data-v="${a[0]}"><span>${a[1]}</span><b>${a[2]}</b></button>`).join("")}</div>`;
        else if (k === "body") body = `<h2>Ein paar Zahlen</h2><div class="kc-bform"><label><span>Alter</span><input id="sAge" inputmode="numeric" value="${b.born ? new Date().getFullYear() - b.born : ""}" placeholder="25"><em>Jahre</em></label><label><span>Größe</span><input id="sH" inputmode="numeric" value="${b.height || ""}" placeholder="180"><em>cm</em></label><label><span>Gewicht</span><input id="sW" inputmode="decimal" value="${b.weight ? nf(b.weight, 1) : ""}" placeholder="75"><em>kg</em></label></div><button class="btn go big" id="sNext">Weiter</button>`;
        else if (k === "act") body = `<h2>Wie viel bewegst du dich?</h2><div class="kc-opts">${ACTS.map(a => `<button class="kc-opt ${Number(b.activity) === a[0] ? "on" : ""}" data-v="${a[0]}"><b>${a[1]}<small>${a[2]}</small></b></button>`).join("")}</div>`;
        else { const n = needs(b); body = `<h2>Dein Tagesbedarf</h2><div class="kc-res"><div class="kc-resk"><b>${fmt(n.kcal)}</b><span>kcal am Tag</span></div>
            <div class="kc-macros"><span><b>${n.protein} g</b>Protein</span><span><b>${n.carbs} g</b>KH</span><span><b>${n.fat} g</b>Fett</span></div>
            <p class="muted">Grundumsatz ${fmt(n.bmr)} kcal, mit Bewegung ${fmt(n.tdee)} kcal${n.A[4] !== 1 ? `, für „${n.A[2]}“ ${n.A[4] > 1 ? "+" : "−"}${Math.round(Math.abs(n.A[4] - 1) * 100)} %` : ""}. Protein: ${nf(n.A[5], 1)} g pro kg Körpergewicht.</p></div>
            <button class="btn go big" id="sSave">Passt, los geht’s</button>`; }
        ov.innerHTML = `<div class="kc-vtop"><button class="kc-x" data-back aria-label="Zurück">${step ? svg('<path d="M15 5l-7 7 7 7"/>', 22) : svg(IC.x, 22)}</button><div class="kc-dots">${steps.map((x, i) => `<i class="${i <= step ? "on" : ""}"></i>`).join("")}</div><span style="width:44px"></span></div><div class="kc-smid">${body}</div>`;
        ov.querySelector("[data-back]").onclick = () => { if (step){ step--; draw(); } else close(); };
        ov.querySelectorAll("[data-v]").forEach(x => x.onclick = () => { haptic(10); const v = x.dataset.v; if (k === "aim") b.aim = v; if (k === "sex") b.sex = v; if (k === "act") b.activity = +v; x.classList.add("on"); setTimeout(() => { step++; draw(); }, 120); });
        const nx = ov.querySelector("#sNext"); if (nx){ const ins = ov.querySelectorAll("input"); ins.forEach(i => field(i)); try { ins[0].focus({preventScroll: true}); } catch(e) {}
          nx.onclick = () => { const age = num(ov.querySelector("#sAge").value), hh = num(ov.querySelector("#sH").value), w = num(ov.querySelector("#sW").value);
            if (!(age >= 12 && age <= 100)) return say("Alter zwischen 12 und 100"); if (!(hh >= 120 && hh <= 230)) return say("Größe in cm, z. B. 180"); if (!(w >= 30 && w <= 300)) return say("Gewicht in kg, z. B. 75");
            b.born = new Date().getFullYear() - Math.round(age); b.height = Math.round(hh); b.weight = Math.round(w * 10) / 10; try { document.activeElement.blur(); } catch(e) {} step++; draw(); }; }
        const sv = ov.querySelector("#sSave"); if (sv) sv.onclick = async () => { sv.disabled = true; const n = needs(b);
          try { const lastKg = K.weights[0] && Number(K.weights[0].kg);
            await K.saveBody({aim: b.aim, sex: b.sex, born: b.born, height: b.height, weight: b.weight, activity: b.activity, custom: false, setup_at: new Date().toISOString()});
            await K.saveProf({enabled: true, goal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat});
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
  /* ---------- the day at a glance: kcal, then carbs, protein and fat against their targets ---------- */
  function sumHTML(t, go){ const T = K.targets(), eaten = K.dayKcal(t), carbs = K.daySum(t, "carbs"), lit = eaten >= T.kcal, pk = Math.round(Math.min(1, eaten / T.kcal) * 100), pc = Math.round(Math.min(1, carbs / T.carbs) * 100);
    const small = (k, l) => { const v = K.daySum(t, k), g = T[k]; return `<div class="kc-mc ${v >= g ? "ok" : ""}"><span>${l}</span><b>${fmt(v)}<small> / ${fmt(g)} g</small></b><i><u style="width:${Math.round(Math.min(1, v / g) * 100)}%"></u></i></div>`; };
    return `<div class="kc-two" ${go ? "data-kc-go" : ""}><div class="kc-b2 ${lit ? "ok" : ""}"><small>Kalorien</small><b>${fmt(eaten)}</b><span>von ${fmt(T.kcal)} kcal · ${lit ? "🔥 geschafft" : pk + " %"}</span><i><u style="width:${pk}%"></u></i></div>
        <div class="kc-b2 kh ${carbs >= T.carbs ? "ok" : ""}"><small>Kohlenhydrate</small><b>${fmt(carbs)}<em> g</em></b><span>von ${fmt(T.carbs)} g · ${pc} %</span><i><u style="width:${pc}%"></u></i></div></div>
      <div class="kc-mac two">${small("protein", "Protein")}${small("fat", "Fett")}</div>`; }
  /* what is eaten again and again: one tap adds it once more */
  function frequent(){ const since = addDays(today(), -60), G = new Map(), hr = new Date().getHours() + new Date().getMinutes() / 60;
    K.meals.forEach(m => { if (m.day < since) return; const it = Array.isArray(m.items) && m.items.length === 1 ? m.items[0] : null, key = m.code || (it && it.code) || String(m.title || "").toLowerCase().trim(); if (!key) return;
      const g = G.get(key) || {n: 0, m, ts: 0, near: 0}; g.n++; const ts = Date.parse(m.ts) || 0, d = new Date(ts), mh = d.getHours() + d.getMinutes() / 60; if (Math.abs(mh - hr) <= 2) g.near++; if (ts > g.ts){ g.ts = ts; g.m = m; } G.set(key, g); });
    return [...G.values()].map(g => Object.assign(g, {sc: g.n * 3 + g.near * 2 + (Date.now() - g.ts < 3 * 864e5 ? 2 : 0)})).sort((a, b) => b.sc - a.sc || b.ts - a.ts).slice(0, 5).map(g => g.m); }
  function quickHTML(){ const l = frequent(); if (!l.length) return ""; return `<div class="kc-quick"><div class="kc-qh">Vorschläge</div>${l.map(m => `<button class="kc-q" data-quick="${h(m.id)}"><span class="kc-qe">${h(m.emoji || "🍽️")}</span><span class="kc-qn">${h(m.title)}<small>${fmt(m.kcal)} kcal · ${f1(m.carbs)} g KH${m.grams ? " · " + m.grams + " g" : ""}</small></span><em>${svg(IC.plus, 20)}</em></button>`).join("")}</div>`; }
  async function quickAdd(id, btn){ const m = K.meals.find(x => x.id === id); if (!m || (btn && btn.disabled)) return; if (btn){ btn.disabled = true; btn.classList.add("ok"); } haptic(12);
    try { await K.add({source: "quick", title: m.title, emoji: m.emoji, kcal: m.kcal, carbs: m.carbs, protein: m.protein, fat: m.fat, grams: m.grams, code: m.code, items: m.items, note: m.note}); say(`${m.emoji || "🍽️"} ${m.title} · ${fmt(m.kcal)} kcal · ${f1(m.carbs)} g KH`); }
    catch(e) { if (btn){ btn.disabled = false; btn.classList.remove("ok"); } say("Ging nicht: " + (e.message || e)); } }
  const setupCard = () => K.on() && !(K.body && K.body.setup_at) ? `<button class="kc-setup-b" data-kc-setup><span>🎯</span><b>Ziele einrichten<small>Gewicht, Größe, Ziel: dein Tagesbedarf und deine Makros</small></b></button>` : "";
  /* the buttons of a summary block (home card and the page) */
  function wireDay(el){
    el.querySelectorAll("[data-kc-go]").forEach(b => b.onclick = () => App.go("kcal"));
    const w = (s2, f) => el.querySelectorAll(s2).forEach(b => b.onclick = f);
    w("[data-kc-say]", () => Voice2.open()); w("[data-kc-scan]", () => KCScan.open()); w("[data-kc-find]", e => Search.open({}, e.currentTarget)); w("[data-kc-fl]", () => iceSheet()); w("[data-kc-setup]", () => Setup.open());
    el.querySelectorAll("[data-quick]").forEach(b => b.onclick = () => quickAdd(b.dataset.quick, b));
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
      k: k100, c: per("carbohydrates"), pr: per("proteins"), f: per("fat"), serving: Math.round(Number(p.serving_quantity) || 0), pack: Math.round(Number(p.product_quantity) || 0)}; };
  const amtText = (P, g) => { const s = P.serving, n = s ? g / s : 0; return (s && n >= .25 && Math.abs(n - Math.round(n * 4) / 4) < .01 ? fracTxt(n) + (n > 1 ? " Portionen" : " Portion") + " · " : "") + nf(g, g < 10 ? 1 : 0) + " g"; };
  /* a part of a meal made from a product keeps the values per 100 g, so its amount can be changed later */
  const itemOf = (P, g) => { const f = g / 100; return {name: P.name + (P.brand ? " (" + P.brand + ")" : ""), amount: amtText(P, g), kcal: Math.round(P.k * f), carbs: r1(P.c * f), protein: r1(P.pr * f), fat: r1(P.f * f), code: P.code || null, g,
    per: {n: P.name, b: P.brand || "", k: P.k, c: P.c, pr: P.pr, f: P.f, s: P.serving || 0, pk: P.pack || 0, img: P.img || null}}; };
  const perP = it => ({code: it.code || null, name: it.per.n, brand: it.per.b, img: it.per.img, k: it.per.k, c: it.per.c, pr: it.per.pr, f: it.per.f, serving: it.per.s, pack: it.per.pk});
  function amountSheet(P, opt = {}){
    const s = P.serving, chips = [30, 50, 100, 150, 200, 250].map(v => [v, v + " g"]); if (P.pack && P.pack <= 3000 && P.pack !== s) chips.push([P.pack, "Packung"]);
    let g = opt.g || s || 100;
    const sh = detailSheet(`<div class="kc-prod" data-notr><div class="kc-ph">${P.img ? `<img src="${h(P.img)}" alt="">` : `<span>📦</span>`}<div><div class="kc-mt">${h(P.name)}</div><div class="muted">${h(P.brand || "")}</div></div></div>
      <p class="muted kc-per">pro 100 g: ${fmt(P.k)} kcal · ${f1(P.c)} g KH · ${f1(P.pr)} g Protein · ${f1(P.f)} g Fett</p>
      ${s ? `<div class="kc-amt"><span class="kc-al">Portionen <small class="muted">à ${s} g</small></span><div class="kc-gram"><button class="btn" data-pd="-1">−</button><label><input id="kcn" inputmode="decimal" autocomplete="off" enterkeyhint="done"> ×</label><button class="btn" data-pd="1">+</button></div>
        <div class="kc-chips">${[[.25, "¼"], [.5, "½"], [1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"]].map(([v, l]) => `<button class="chip" data-n="${v}">${l}</button>`).join("")}</div></div>` : ""}
      <div class="kc-amt"><span class="kc-al">Gramm</span><div class="kc-gram"><button class="btn" data-d="-1">−</button><label><input id="kcg" inputmode="decimal" autocomplete="off" enterkeyhint="done"> g</label><button class="btn" data-d="1">+</button></div>
        <div class="kc-chips">${chips.map(([v, l]) => `<button class="chip" data-g="${v}">${l}</button>`).join("")}</div></div>
      <div class="kc-mk" id="kcpk"></div><button class="btn go big" id="kcadd">${h(opt.btn || "Eintragen")}</button></div>`);
    const el = sh.el, gi = el.querySelector("#kcg"), ni = el.querySelector("#kcn");
    const show = from => { const f = g / 100; if (from !== "g") gi.value = nf(g, g < 10 ? 1 : 0); if (ni && from !== "n") ni.value = nf(g / s, 2);
      el.querySelector("#kcpk").innerHTML = `<b>${fmt(P.k * f)}</b> kcal <small class="muted">· ${f1(P.c * f)} g KH · ${f1(P.pr * f)} g Protein · ${f1(P.f * f)} g Fett</small>`;
      el.querySelectorAll("[data-g]").forEach(c => c.classList.toggle("on", Math.abs(+c.dataset.g - g) < .05)); el.querySelectorAll("[data-n]").forEach(c => c.classList.toggle("on", Math.abs(+c.dataset.n * s - g) < .05)); };
    const setG = (v, from) => { g = Math.max(.5, Math.min(5000, Math.round(v * 10) / 10)); show(from); };
    show();
    field(gi, v => { if (v > 0) setG(v, "g"); }); gi.addEventListener("blur", () => show());
    if (ni){ field(ni, v => { if (v > 0) setG(v * s, "n"); }); ni.addEventListener("blur", () => show()); }
    el.querySelectorAll("[data-g]").forEach(c => c.onclick = () => { haptic(8); setG(+c.dataset.g); });
    el.querySelectorAll("[data-n]").forEach(c => c.onclick = () => { haptic(8); setG(+c.dataset.n * s); });
    el.querySelectorAll("[data-d]").forEach(b => b.onclick = () => { const st = g >= 50 ? 10 : 5; setG(+b.dataset.d > 0 ? Math.floor(g / st + 1e-6) * st + st : g <= st ? Math.max(1, g - 1) : Math.ceil(g / st - 1e-6) * st - st); });
    el.querySelectorAll("[data-pd]").forEach(b => b.onclick = () => { const n = g / s, up = +b.dataset.pd > 0, q = up ? (n < 1 ? Math.floor(n * 4 + 1e-6) / 4 + .25 : Math.floor(n + 1e-6) + 1) : (n <= 1 ? Math.max(.25, Math.ceil(n * 4 - 1e-6) / 4 - .25) : Math.ceil(n - 1e-6) - 1); setG(q * s); });
    el.querySelector("#kcadd").onclick = async () => { const b = el.querySelector("#kcadd"); if (b.disabled) return; b.disabled = true; recent(P);
      try { await opt.done(itemOf(P, g), g); sh.close(); } catch(e) { b.disabled = false; say("Ging nicht: " + (e.message || e)); } };
    return sh;
  }
  /* a product picked from the scan or the search becomes a new meal */
  const addProduct = (P, src) => amountSheet(P, {done: async it => { const m = await K.add({source: src || "barcode", code: it.code, grams: Math.round(it.g), title: P.name.slice(0, 80), emoji: "📦", kcal: it.kcal, carbs: it.carbs, protein: it.protein, fat: it.fat, items: [it], note: "Nährwerte von Open Food Facts"});
    haptic(15); say(`📦 ${fmt(m.kcal)} kcal eingetragen`); }});

  /* a product from Open Food Facts by its barcode (kept on the phone once seen) */
  async function offGet(code, ms){
    let p = null; try { p = JSON.parse(localStorage.getItem("chessnat-off-" + code) || "null"); } catch(e) {}
    if (p) return p;
    try { const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms || 6000);
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_de,generic_name,brands,nutriments,serving_quantity,serving_size,image_front_small_url,product_quantity`, {signal: ctl.signal});
      clearTimeout(to); const j = await r.json(); if (j && j.status !== 0 && j.product && j.product.nutriments) p = j.product;
      if (p) try { localStorage.setItem("chessnat-off-" + code, JSON.stringify(p)); } catch(e) {}
    } catch(e) {}
    return p;
  }
  /* ---------- search: type a name (Open Food Facts via /api/food), pick the product, say how much ---------- */
  const RK = "chessnat-kcal-recent";
  const recents = () => { try { return JSON.parse(localStorage.getItem(RK) || "[]"); } catch(e) { return []; } };
  function recent(P){ try { const key = P.code || P.name, l = recents().filter(x => (x.code || x.name) !== key); l.unshift({code: P.code || null, name: P.name, brand: P.brand || "", img: P.img || null, k: P.k, c: P.c, pr: P.pr, f: P.f, serving: P.serving || 0, pack: P.pack || 0}); localStorage.setItem(RK, JSON.stringify(l.slice(0, 12))); } catch(e) {} }
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
        try { sq.animate([{transform: `translate(${r.left - r2.left}px,${r.top - r2.top}px)`, width: r.width + "px"}, {transform: "none", width: r2.width + "px"}], {duration: 280, easing: "cubic-bezier(.2,.85,.25,1)"});
          ov.animate([{backgroundColor: "rgba(20,19,17,0)"}, {backgroundColor: "rgba(20,19,17,1)"}], {duration: 220, easing: "ease-out"}); body.animate([{opacity: 0, transform: "translateY(16px)"}, {opacity: 1, transform: "none"}], {duration: 300, delay: 60, easing: "ease-out", fill: "backwards"}); } catch(e) {} }
      /* always exactly the visible part of the screen, the keyboard never covers a result */
      /* the search covers the whole screen (also behind the keyboard, which is see-through on the iPhone); the list ends above the keyboard */
      const vv = window.visualViewport, fit = () => { if (!vv || closed) return; const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); body.style.paddingBottom = (kb + 24) + "px"; ov.style.transform = vv.offsetTop ? `translateY(${vv.offsetTop}px)` : ""; };
      if (vv){ vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit); } fit();
      const close = () => { if (closed) return; closed = true; if (vv){ vv.removeEventListener("resize", fit); vv.removeEventListener("scroll", fit); } try { q.blur(); } catch(e) {} document.documentElement.classList.remove("kc-sopen");
        if (ov.animate){ const an = ov.animate([{opacity: 1}, {opacity: 0}], {duration: 160, easing: "ease-in"}); an.onfinish = () => ov.remove(); } else ov.remove(); };
      ov.querySelector("#kcsx").onclick = () => { haptic(6); close(); };
      ov.querySelector("#kcsm").onclick = () => { close(); (opt.manual || manual)(q.value.trim()); };
      const per = P => `${fmt(P.k)} kcal · ${f1(P.c)} g KH`;
      const row = (P, i) => `<button class="kc-sres" data-i="${i}">${P.img ? `<img src="${h(P.img)}" alt="" loading="lazy">` : `<span class="kc-sph">📦</span>`}<span class="kc-sn">${h(P.name)}<small>${h(P.brand || "")}${P.serving ? `${P.brand ? " · " : ""}Portion ${P.serving} g` : ""}</small></span><b>${fmt(P.k)}<small>kcal</small><small class="kh">${f1(P.c)} g KH</small></b></button>`;
      const draw = (l, head) => { list = l; out.innerHTML = (head ? `<div class="kc-sh muted">${head} <span>pro 100 g</span></div>` : `<div class="kc-sh muted">pro 100 g</div>`) + l.map(row).join(""); out.querySelectorAll("[data-i]").forEach(b => b.onclick = () => pick(list[+b.dataset.i], b)); };
      const empty = () => { const r = recents(); if (r.length) draw(r, "Zuletzt"); else out.innerHTML = `<p class="muted kc-sh">Tipp den Namen ein, z. B. Eier, Toast, Nutella.</p>`; };
      const go = async () => { const v = q.value.trim(), my = ++seq; if (v.length < 2) return empty(); out.classList.add("busy");
        try { const r = await fetch("/api/food?q=" + encodeURIComponent(v)), j = await r.json().catch(() => ({})); if (my !== seq) return; if (!r.ok || !Array.isArray(j.items)) throw new Error(j.error || "Suche gerade nicht erreichbar");
          if (!j.items.length) out.innerHTML = `<p class="muted kc-sh">Nichts gefunden. Anders schreiben oder selbst eintragen.</p>`; else draw(j.items); }
        catch(e) { if (my === seq) out.innerHTML = `<p class="muted kc-sh">⚠️ ${h(e.message || "Keine Verbindung")}</p>`; }
        finally { if (my === seq) out.classList.remove("busy"); } };
      q.oninput = () => { clearTimeout(tmr); tmr = setTimeout(go, 320); };
      q.onkeydown = e => { if (e.key === "Enter"){ e.preventDefault(); clearTimeout(tmr); go(); q.blur(); } };
      /* tapped a product: how much, right under it (the portion size comes from the product itself) */
      const pick = async (P, b) => { if (busy) return; haptic(10);
        if (b.classList.contains("open")){ b.classList.remove("open"); const nx = b.nextElementSibling; if (nx && nx.classList.contains("kc-sadd")) nx.remove(); return; }
        busy = 1; b.classList.add("load");
        if (P.code && !P.serving){ const full = await Promise.race([offGet(P.code, 3000), new Promise(r => setTimeout(r, 3200))]); if (full){ const F = prodOf(P.code, full); P = Object.assign({}, P, {serving: F.serving || P.serving, pack: F.pack || P.pack, img: P.img || F.img}); } }
        busy = 0; b.classList.remove("load"); if (closed) return;
        if (opt.pick){ close(); opt.pick(P); return; }
        out.querySelectorAll(".kc-sres.open").forEach(x => { x.classList.remove("open"); const nx = x.nextElementSibling; if (nx && nx.classList.contains("kc-sadd")) nx.remove(); });
        try { q.blur(); } catch(e) {} b.classList.add("open");
        const s2 = P.serving; let g = s2 || 100;
        const chips = s2 ? [[s2 / 2, "½ Portion"], [s2, `1 Portion · ${s2} g`], [s2 * 2, "2 Portionen"], [s2 * 3, "3"]] : [[50, "50 g"], [100, "100 g"], [150, "150 g"], [200, "200 g"], [250, "250 g"]];
        const pn = document.createElement("div"); pn.className = "kc-sadd";
        pn.innerHTML = `<div class="kc-chips">${chips.map(([v, l]) => `<button class="chip" data-g="${v}">${l}</button>`).join("")}</div>
          <div class="kc-srow"><div class="kc-gram"><button class="btn" data-d="-1">−</button><label><input inputmode="decimal" autocomplete="off" enterkeyhint="done"> g</label><button class="btn" data-d="1">+</button></div></div>
          <div class="kc-sk" id="kcsk"></div><button class="btn go big" data-add>Hinzufügen</button>`;
        b.after(pn); const gi = pn.querySelector("input");
        const show = from2 => { const f = g / 100; if (from2 !== "g") gi.value = nf(g, g < 10 ? 1 : 0); pn.querySelector("#kcsk").innerHTML = `<b>${fmt(P.k * f)}</b> kcal · <b>${f1(P.c * f)}</b> g KH <small>· ${f1(P.pr * f)} g Protein · ${f1(P.f * f)} g Fett</small>`;
          pn.querySelectorAll("[data-g]").forEach(c => c.classList.toggle("on", Math.abs(+c.dataset.g - g) < .05)); };
        const setG = (v, from2) => { g = Math.max(.5, Math.min(5000, Math.round(v * 10) / 10)); show(from2); };
        show(); field(gi, v => { if (v > 0) setG(v, "g"); }); gi.addEventListener("blur", () => show());
        pn.querySelectorAll("[data-g]").forEach(c => c.onclick = () => { haptic(6); setG(+c.dataset.g); });
        pn.querySelectorAll("[data-d]").forEach(x => x.onclick = () => { const st = g >= 50 ? 10 : 5; setG(+x.dataset.d > 0 ? Math.floor(g / st + 1e-6) * st + st : g <= st ? Math.max(1, g - 1) : Math.ceil(g / st - 1e-6) * st - st); });
        pn.querySelector("[data-add]").onclick = async e2 => { const ab = e2.currentTarget; if (ab.disabled) return; ab.disabled = true; recent(P); const it = itemOf(P, g);
          try { const m = await K.add({source: "search", code: it.code, grams: Math.round(g), title: P.name.slice(0, 80), emoji: "📦", kcal: it.kcal, carbs: it.carbs, protein: it.protein, fat: it.fat, items: [it], note: "Nährwerte von Open Food Facts"});
            haptic(15); close(); say(`✓ ${P.name.slice(0, 30)} · ${fmt(m.kcal)} kcal · ${f1(m.carbs)} g KH`); } catch(err) { ab.disabled = false; say("Ging nicht: " + (err.message || err)); } };
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
    if (i.per && i.g){ o.g = Math.round(i.g * f * 10) / 10; o.amount = amtText(perP(i), o.g); } else o.amount = (i.amount || "") + ` ×${nf(f, 2)}`; return o; };
  /* grams in a text like "2 Scheiben (80 g)" */
  const gramsIn = t => { const m = /(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i.exec(String(t || "")); return m ? num(m[1]) : 0; };
  function mealSheet(m, own = true){
    const items = own ? partsOf(m) : (Array.isArray(m.items) ? m.items : []);
    const sh = detailSheet(`<div class="kc-ms" data-notr><div class="kc-mh"><span class="kc-me">${h(m.emoji || "🍽️")}</span><div><div class="kc-mt">${h(m.title)}</div><div class="muted">${dayLabel(m.day)}, ${hhmm(m.ts)}${m.source === "barcode" ? " · Barcode" : m.source === "search" ? " · Suche" : m.source === "voice" ? " · gesprochen" : ""}</div></div></div>
      <div class="kc-mk"><b>${fmt(m.kcal)}</b> kcal</div>
      <div class="kc-macros"><span><b>${f1(m.carbs)} g</b>KH</span><span><b>${f1(m.protein)} g</b>Protein</span><span><b>${f1(m.fat)} g</b>Fett</span></div>
      ${items.length ? `${own ? `<div class="kc-ih muted">Antippen zum Ändern</div>` : ""}<div class="kc-items">${items.map((i, ix) => own ? `<button data-it="${ix}"><span>${h(i.name)}<small>${h(i.amount || "")}</small></span><b>${fmt(i.kcal)} kcal</b><em>${svg(IC.pen, 15)}</em></button>` : `<div><span>${h(i.name)}<small>${h(i.amount || "")}</small></span><b>${fmt(i.kcal)} kcal</b></div>`).join("")}</div>` : ""}
      ${own && items.length ? `<button class="kc-roundb" data-round>${svg(IC.code, 22)}<b>Packungen scannen<small>Für genaue Werte: alles scannen, was du gegessen hast, in beliebiger Reihenfolge</small></b></button>` : ""}
      ${own ? `<button class="btn ghost kc-man-b" data-it="-1">${svg(IC.plus, 16)} Etwas dazu</button>` : ""}
      ${m.said ? `<p class="muted kc-said">„${h(m.said)}“</p>` : ""}${m.note ? `<p class="muted kc-said">${h(m.note)}</p>` : ""}
      ${own ? `<div class="kc-portion"><span class="muted">Alles mal</span><div>${[[.5, "½"], [.75, "¾"], [1.25, "1¼"], [1.5, "1½"], [2, "2×"], [3, "3×"]].map(([f, l]) => `<button class="chip" data-f="${f}">${l}</button>`).join("")}</div></div>
      <div class="kc-row2"><button class="btn go" data-dclose>Passt</button><button class="btn" data-kc-del>Löschen</button></div>` : ""}</div>`);
    if (!own) return sh;
    sh.el.querySelectorAll("[data-it]").forEach(b => b.onclick = () => { haptic(8); sh.close(); partSheet(m, +b.dataset.it); });
    const rb = sh.el.querySelector("[data-round]"); if (rb) rb.onclick = () => { haptic(10); sh.close(); KCScan.open({round: m}); };
    sh.el.querySelectorAll("[data-f]").forEach(b => b.onclick = async () => { try { const nm = await saveParts(m, partsOf(m).map(i => scalePart(i, +b.dataset.f))); sh.close(); mealSheet(nm); } catch(e) { say("Ging nicht: " + (e.message || e)); } });
    const del = sh.el.querySelector("[data-kc-del]"); del.onclick = async () => { if (!del.dataset.armed){ del.dataset.armed = 1; del.textContent = "Wirklich löschen?"; return; }
      try { await K.del(m.id); sh.close(); say("Gelöscht"); } catch(e) { say("Ging nicht: " + (e.message || e)); } };
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
      <p class="muted kc-pt">Oder selbst eintippen:</p>
      <label>Was<input id="kpn" maxlength="80" value="${h(w.name || "")}" placeholder="z. B. Honey Nut Flakes"></label>
      <label>Menge<input id="kpa" maxlength="60" value="${h(w.amount || "")}" placeholder="z. B. 2 Scheiben"></label>
      <div class="kc-nums">${KS.map(([k, l]) => `<label>${l}<input data-k="${k}" inputmode="decimal" value="${nf(w[k] || 0, k === "kcal" ? 0 : 1)}"></label>`).join("")}</div>
      ${add ? "" : `<div class="kc-portion"><span class="muted">Mal nehmen</span><div>${[[.25, "¼"], [.5, "½"], [2, "2×"], [3, "3×"], [4, "4×"], [5, "5×"]].map(([f, l]) => `<button class="chip" data-f="${f}">${l}</button>`).join("")}</div></div>`}
      <div class="kc-row2"><button class="btn go" id="kps">${add ? "Dazu" : "Speichern"}</button>${add ? "" : `<button class="btn" id="kpd">${parts.length > 1 ? "Entfernen" : "Löschen"}</button>`}</div></div>`);
    const el = sh.el, ins = el.querySelectorAll("[data-k]");
    ins.forEach(i => field(i)); field(el.querySelector("#kpa"));
    const read = () => { w.name = el.querySelector("#kpn").value.trim(); w.amount = el.querySelector("#kpa").value.trim(); ins.forEach(i => { const v = num(i.value); w[i.dataset.k] = isFinite(v) && v >= 0 ? (i.dataset.k === "kcal" ? Math.round(v) : r1(v)) : 0; }); };
    const fill = () => { el.querySelector("#kpa").value = w.amount || ""; ins.forEach(i => { i.value = nf(w[i.dataset.k] || 0, i.dataset.k === "kcal" ? 0 : 1); }); };
    el.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { read(); Object.assign(w, scalePart(w, +b.dataset.f)); fill(); haptic(8); el.querySelectorAll("[data-f]").forEach(x => x.classList.toggle("on", x === b)); });
    const done = async ps => { const nm = await saveParts(m, ps); haptic(15); mealSheet(nm); };
    /* the real product instead: scanned or searched, then how much */
    const swap = P => amountSheet(P, {g: (!add && (w.g || gramsIn(w.amount))) || 0, btn: add ? "Dazu" : "Übernehmen", done: async it => { const ps = partsOf(m); if (add) ps.push(it); else ps[idx] = it; await done(ps); }});
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
      r.onresult = e => { if (rec !== r) return; const sess = Array.from(e.results).map(x => x[0].transcript).join(" "); heard = (base + " " + sess).replace(/\s+/g, " ").trim(); pulse = 1; show(); };
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
    let meterBad = false; try { meterBad = localStorage.getItem(MB) === "1"; } catch(e) {}
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
        const saved = await K.add({source: "voice", said: text, ts, day: dayOf(ts), title: m.title, emoji: m.emoji, kcal: m.kcal, carbs: m.carbs, protein: m.protein, fat: m.fat, items: m.items, note: m.note});
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
    function assign(i, P){ const R = round; if (!R) return; if (i < 0){ const g = P.serving || 100; R.parts.push(itemOf(P, g)); i = R.parts.length - 1; } else R.parts[i] = itemOf(P, howMuch(R.parts[i], P));
      R.got[i] = P.name + (P.brand ? " (" + P.brand + ")" : ""); R.msg = `✓ ${h(P.name)}`; R.msgOk = 1; haptic([12, 25, 12]); roundDraw(); }
    async function roundGot(code){ const R = round; if (!R) return;
      if (R.codes.has(code)){ if (Date.now() - (R.dupT || 0) > 2500){ R.dupT = Date.now(); R.msg = "Schon gescannt"; R.msgOk = 0; roundDraw(); } return; }
      R.codes.add(code); R.busy++; R.msg = "Gefunden, suche Produkt …"; R.msgOk = 0; roundDraw(); haptic(10);
      const p = await offGet(code, 8000); R.busy--; if (round !== R) return;
      if (!p){ R.msg = "Nicht in der Datenbank"; R.msgOk = 0; roundDraw(); return; }
      const P = prodOf(code, p); let best = -1, bs = 0; R.parts.forEach((p2, i) => { const f2 = fit(p2, P) * (R.got[i] ? .5 : 1); if (f2 > bs){ bs = f2; best = i; } });
      if (best >= 0 && bs >= 1) assign(best, P); else { R.ask = {P}; R.msg = ""; roundDraw(); } }
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
      try { await K.add({source: "manual", title: t, emoji: "✍️", kcal: Math.round(v.kcal), carbs: r1(v.carbs), protein: r1(v.protein), fat: r1(v.fat)}); sh.close(); say(`✍️ ${fmt(v.kcal)} kcal · ${f1(v.carbs)} g KH eingetragen`); } catch(e) { say("Ging nicht: " + (e.message || e)); } };
  }

  /* ---------- settings (Settings page and the page's gear) ---------- */
  function settingsHTML(full){
    const on = K.on(), p = K.prof || {};
    return `<h3>Kalorien-Tracker</h3>
      <label class="chk"><input type="checkbox" data-kcs="enabled" ${on ? "checked" : ""}> Auf der Startseite zeigen (Sprechen + Barcode)</label>
      ${on || full ? `<div class="kc-goal"><span>Tagesziel</span><input id="kcgoal" inputmode="numeric" value="${K.goal()}"><span>kcal</span></div>
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
  Views.kcal = {
    tab: "today", sel: null,
    mount(main, arg){
      this.main = main; if (arg && arg.tab) this.tab = arg.tab;
      if (!meId()){ main.innerHTML = `<div class="page kc-page"><h1 class="h-title">Kalorien</h1><div class="unit"><p>Bitte melde dich an, um den Kalorien-Tracker zu nutzen.</p><button class="btn go" id="kcsign">Anmelden</button></div></div>`;
        main.querySelector("#kcsign").onclick = () => App.go(typeof Views.account === "object" ? "account" : "settings"); return; }
      K.fromCache(); this.draw();
      K.load(true).then(() => this.draw()).catch(() => {});
      K.loadFriends().then(() => { if (this.tab === "friends") this.draw(); }).catch(() => {});
    },
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
      main.innerHTML = `<div class="page kc-page" data-notr><div class="kc-top"><h1 class="h-title">Kalorien</h1>${flameChip(K.flame(), K.litToday(), myIce())}<button class="kc-x kc-gear" id="kccook" aria-label="Kochen">${svg(IC.chef, 20)}</button><button class="kc-x kc-gear" id="kcset" aria-label="Einstellungen">${svg(IC.gear, 20)}</button></div>
        <div class="row kc-tabs">${tabs.map(([k, l]) => `<button class="btn sm ${this.tab === k ? "go" : ""}" data-tab="${k}">${l}</button>`).join("")}</div><div id="kcbody"></div></div>`;
      main.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { this.tab = b.dataset.tab; this.sel = null; this.draw(); if (this.tab === "friends") K.loadFriends().then(() => this.draw()).catch(() => {}); });
      main.querySelector("#kcset").onclick = () => { const sh = detailSheet(`<div class="kc-setsheet" data-notr>${settingsHTML(true)}</div>`); const box = sh.el.querySelector(".kc-setsheet");
        const re = () => { box.innerHTML = settingsHTML(true); wireSettings(box, re); this.draw(); }; wireSettings(box, re); };
      const fl = main.querySelector(".kc-top [data-kc-fl]"); if (fl) fl.onclick = () => iceSheet();
      main.querySelector("#kccook").onclick = () => Cook.open();
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
      const row = m => `<button class="kc-meal" data-meal="${h(m.id)}"><span class="kc-tm">${hhmm(m.ts)}</span><span class="kc-em">${h(m.emoji || "🍽️")}</span><span class="kc-mn">${h(m.title)}<small>${f1(m.protein)} g Protein${m.source === "barcode" ? " · Barcode" : ""}</small></span><span class="kc-mk2"><b>${fmt(m.kcal)}<small> kcal</small></b><em>${f1(m.carbs)} g KH</em></span></button>`;
      const name = ts => { const d = new Date(ts), hr = d.getHours() + d.getMinutes() / 60; return hr >= 5 && hr < 10.75 ? "Frühstück" : hr >= 11 && hr < 14.75 ? "Mittagessen" : hr >= 17 && hr < 21.75 ? "Abendessen" : "Mahlzeit"; };
      return `<div class="kc-list">${G.map(g => g.ms.length < 2 ? row(g.ms[0]) : `<div class="kc-grp"><div class="kc-gh"><span>${name(g.last)} · ${hhmm(g.last)}</span><b>${fmt(g.ms.reduce((a2, m) => a2 + (m.kcal || 0), 0))} kcal · ${f1(g.ms.reduce((a2, m) => a2 + (Number(m.carbs) || 0), 0))} g KH</b></div>${g.ms.slice().reverse().map(row).join("")}</div>`).join("")}</div>`;
    },
    wireMeals(el){ el.querySelectorAll("[data-meal]").forEach(b => b.onclick = () => { const m = K.meals.find(x => x.id === b.dataset.meal); if (m) mealSheet(m); }); },
    today(el){
      const t = today(), g = K.goal(), eaten = K.dayKcal(t), lit = eaten >= g, miss = g - eaten, i = !lit ? idea(miss) : null;
      el.innerHTML = `<div class="unit kc-sum">${sumHTML(t, false)}
        <div class="kc-btns two"><button class="kc-big kc-say" data-kc-say>${svg(IC.mic, 32)}<span>Sprechen</span></button><button class="kc-big kc-scan" data-kc-scan>${svg(IC.code, 32)}<span>Barcode</span></button></div>
        <button class="kc-sbar" data-kc-find>${svg(IC.search, 18)}<span>Lebensmittel suchen …</span></button>
        ${setupCard()}${quickHTML()}</div>
        <div class="kc-day"><span>Heute</span><b>${fmt(eaten)} kcal · ${fmt(K.daySum(t, "carbs"))} g KH</b></div>${this.dayBlock(t)}
        ${lit ? `<div class="kc-tip ok kc-tipb">🔥 Ziel geschafft!</div>` : `<div class="kc-tip kc-tipb">Noch <b>${fmt(miss)} kcal</b>. Zum Beispiel ${h(i.text)} (≈ ${fmt(i.kcal)} kcal)</div>`}
        <button class="btn ghost kc-man-b" id="kcmanual">${svg(IC.plus, 16)} Selbst eintragen</button>`;
      wireDay(el); el.querySelector("#kcmanual").onclick = () => manual();
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
      el.innerHTML = `<div class="kc-fr">${rows.map(({p, eaten, lit, flame}) => `<button class="kc-frr ${p.me ? "me" : ""}" data-fr="${h(p.user_id)}"><span class="kc-av">${avatar(p.user_id)}</span><span class="kc-frm"><b>${p.me ? "Du" : h(pname(p.user_id))}</b>
          <span class="kc-bar sm ${lit ? "done" : ""}"><i style="width:${Math.round(Math.min(1, eaten / p.goal) * 100)}%"></i></span><small>${fmt(eaten)} / ${fmt(p.goal)} kcal heute</small></span>${flameChip(flame, lit)}</button>`).join("")}</div>
        ${tracking.length ? "" : `<p class="muted kc-empty">Noch keiner deiner Freunde trackt. Lad sie ein!</p>`}
        ${notYet.length ? `<div class="kc-day">Einladen</div><div class="kc-fr">${notYet.map(id => `<div class="kc-frr"><span class="kc-av">${avatar(id)}</span><span class="kc-frm"><b>${h(pname(id))}</b><small>trackt noch nicht</small></span><button class="btn sm go" data-inv="${h(id)}">Einladen</button></div>`).join("")}</div>` : ""}
        ${fr.length ? "" : `<p class="muted kc-empty">Füg erst unter Freunde jemanden hinzu.</p>`}`;
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
.kc-two{display:grid;grid-template-columns:1fr 1fr;gap:8px;cursor:pointer}.kc-b2{background:var(--panel-2);border-radius:18px;padding:12px 14px;display:flex;flex-direction:column;gap:3px;min-width:0}
.kc-b2 small{font:900 11.5px var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}.kc-b2 b{font:900 36px/1.05 var(--display)}.kc-b2 b em{font:900 20px var(--display);font-style:normal;color:var(--muted)}.kc-b2 span{font:800 12.5px var(--body);color:var(--muted)}
.kc-b2 i{display:block;height:8px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:4px}.kc-b2 u{display:block;height:100%;border-radius:4px;background:var(--go);transition:width .4s}.kc-b2.kh u{background:#E9A92B}.kc-b2.ok u{background:linear-gradient(90deg,#FFD15C,#ff9a3c)}
.kc-mac.two{grid-template-columns:1fr 1fr}
.kc-mk2{display:flex;flex-direction:column;align-items:flex-end;white-space:nowrap}.kc-mk2 b{font:900 16px var(--display)}.kc-mk2 b small{font:800 11px var(--body);color:var(--muted)}.kc-mk2 em{font:800 12.5px var(--body);font-style:normal;color:#E9A92B}
.kc-grp{display:flex;flex-direction:column;gap:2px;background:var(--panel);border-radius:14px;padding:4px}.kc-grp .kc-meal{background:var(--panel-2);border-radius:10px}.kc-gh{display:flex;justify-content:space-between;gap:8px;padding:6px 8px 4px;font:900 13px var(--body)}.kc-gh b{font:900 13px var(--body);color:#E9A92B}
.kc-tipb{margin-top:12px}
html.kc-sopen,html.kc-sopen body{overflow:hidden}
.kc-sov{position:fixed;left:0;right:0;top:0;height:100vh;height:100lvh;z-index:300;background:#141312;display:flex;flex-direction:column;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 0;will-change:transform}
.kc-sovt{display:flex;align-items:center;gap:10px}.kc-sovt .kc-sq{flex:1;min-width:0;background:#2A2825;border-color:var(--go)}.kc-sx{flex:none;white-space:nowrap;border:0;background:none;color:var(--go-hi,#8FC458);font:800 16px var(--body);padding:8px 2px;cursor:pointer}
.kc-sovb>*{flex-shrink:0}.kc-sovb{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:10px 0 calc(env(safe-area-inset-bottom,0px) + 16px);display:flex;flex-direction:column;gap:8px;overscroll-behavior:contain}
.kc-sres b .kh{color:#E9A92B;font-weight:800}.kc-sres.open{background:#33302C;border-radius:14px 14px 4px 4px}.kc-sh span{float:right}
.kc-sadd{background:#33302C;border-radius:4px 4px 14px 14px;margin-top:-6px;padding:10px;display:flex;flex-direction:column;gap:10px;animation:kcIn .2s ease-out}@keyframes kcIn{from{opacity:0;transform:translateY(-6px)}}
.kc-sk{font:800 15px var(--body);text-align:center}.kc-sk b{font:900 22px var(--display)}.kc-sk small{display:block;color:var(--muted);font-weight:700;font-size:12px;margin-top:2px}
.kc-btns.two{grid-template-columns:1fr 1fr;gap:10px}.kc-btns.two .kc-big{height:112px;font-size:19px;border-radius:22px}
.kc-num em{margin-left:auto;align-self:center;font:900 13px var(--body);color:var(--muted);background:var(--panel-2);border-radius:999px;padding:4px 10px;font-style:normal}.kc-num em.ok{color:#fff;background:linear-gradient(180deg,#ff9a3c,#e9573f)}.kc-num{width:100%}
.kc-mac{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.kc-mc{background:var(--panel-2);border-radius:14px;padding:8px 10px;display:flex;flex-direction:column;gap:3px;min-width:0}
.kc-mc span{font:800 11.5px var(--body);color:var(--muted);letter-spacing:.02em}.kc-mc b{font:900 17px var(--display);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kc-mc b small{font:800 11.5px var(--body);color:var(--muted)}
.kc-mc i{display:block;height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden}.kc-mc u{display:block;height:100%;border-radius:3px;background:var(--go);transition:width .4s}.kc-mc.ok u{background:linear-gradient(90deg,#FFD15C,#ff9a3c)}
.kc-sbar{display:flex;align-items:center;gap:10px;width:100%;padding:13px 14px;border-radius:16px;border:2px solid var(--line);background:var(--panel-2);color:var(--muted);font:800 16px var(--body);cursor:text;text-align:left;-webkit-tap-highlight-color:transparent}.kc-sbar:active{border-color:var(--go)}
.kc-quick{display:flex;flex-direction:column;gap:6px}.kc-qh{font:900 12px var(--body);color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin:2px 2px 0}
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
.kc-sres img,.kc-sph{width:44px;height:44px;border-radius:10px;object-fit:contain;flex:none;background:#fff;display:flex;align-items:center;justify-content:center;font-size:24px}
.kc-sn{flex:1;min-width:0;display:flex;flex-direction:column;font:800 15px var(--body);line-height:1.2}.kc-sn small{color:var(--muted);font-weight:700;font-size:12px;margin-top:2px}
.kc-sres b{display:flex;flex-direction:column;align-items:flex-end;font:900 17px var(--display);white-space:nowrap}.kc-sres b small{font:700 11px var(--body);color:var(--muted)}
.kc-sh{font:800 12px var(--body);margin:2px 2px 0}
.kc-rep{display:grid;grid-template-columns:1fr 1fr;gap:8px}.kc-rep .btn{display:flex;align-items:center;justify-content:center;gap:6px}
.kc-amtb{display:flex;justify-content:space-between;align-items:center;gap:8px}.kc-amtb small{color:var(--muted);font-weight:800}
.kc-nums{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.kc-nums input{text-align:center;padding:10px 2px;min-width:0;width:100%;box-sizing:border-box}
.kc-pt{margin:2px 0 -2px;font:800 12px var(--body)}.kc-ih{font:800 12px var(--body);margin-bottom:-4px}
.kc-items>button{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;background:var(--panel-2);border-radius:10px;border:0;width:100%;text-align:left;color:var(--fg);cursor:pointer;-webkit-tap-highlight-color:transparent}
.kc-items>button span{flex:1;min-width:0}.kc-items>button em{color:var(--muted);display:flex;flex:none}.kc-items>button:active{transform:scale(.98)}
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
.kc-ms,.kc-prod,.kc-form{display:flex;flex-direction:column;gap:10px}.kc-mh,.kc-ph{display:flex;align-items:center;gap:12px}.kc-me{font-size:40px}.kc-mt{font:900 20px var(--display)}
.kc-ph img{width:64px;height:64px;object-fit:contain;border-radius:10px;background:#fff}.kc-ph span{font-size:44px}
.kc-mk{font:800 15px var(--body);color:var(--muted)}.kc-mk b{font:900 38px var(--display);color:var(--fg)}
.kc-macros{display:flex;gap:8px}.kc-macros span{flex:1;background:var(--panel-2);border-radius:12px;padding:8px;text-align:center;color:var(--muted);font:700 12px var(--body);display:flex;flex-direction:column}.kc-macros b{color:var(--fg);font:900 16px var(--display)}
.kc-items{display:flex;flex-direction:column;gap:4px}.kc-items>div{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;background:var(--panel-2);border-radius:10px}.kc-items span{display:flex;flex-direction:column;font:800 14px var(--body)}.kc-items small{color:var(--muted);font-weight:700}.kc-items b{white-space:nowrap;font:900 14px var(--body)}
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
