/* ===== Chess.nat website platform layer =====
   Gives the app the same small API it uses inside Claude (window.claude.use("db" | "user" | "room")),
   backed by Supabase: email login, one private save per account, and realtime rooms for live games. */
(function(){
  const CFG = window.CHESSNAT_CONFIG || {};
  const ready = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase && !/YOUR-/.test(CFG.supabaseUrl));
  const sb = ready ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}}) : null;
  let session = null, booted = false, reloading = false;
  /* getSession() waits until the client has restored the saved session (and read any sign-in link in the URL).
     supabase-js also announces that restore as "SIGNED_IN", so events before boot must never trigger a reload. */
  const sessionReady = sb ? sb.auth.getSession().then(r => { session = r.data.session; return session; }).catch(() => null).finally(() => { booted = true; }) : Promise.resolve(null);
  if (sb) sb.auth.onAuthStateChange((ev, s) => {
    const before = session && session.user.id, after = s && s.user.id;
    session = s;
    if (!booted) return;
    // reload only when the person actually changed (signed in here or in another tab, or signed out)
    if ((ev === "SIGNED_IN" || ev === "SIGNED_OUT") && before !== after && !reloading){ reloading = true; setTimeout(() => location.reload(), 50); }
  });

  /* a sign-in link that failed (expired, already used) comes back with the error in the address */
  try { const h = new URLSearchParams((location.hash || "").replace(/^#/, "") + "&" + (location.search || "").replace(/^\?/, ""));
    if (h.get("error_description") || h.get("error_code")){ const code = h.get("error_code") || "";
      window.CHESSNAT_AUTH_ERROR = code === "otp_expired" ? "That sign-in link has expired or was already used. Sign in with your email and password, or request a new link." : (h.get("error_description") || "Sign-in didn't work.").replace(/\+/g, " ");
      history.replaceState(null, "", location.pathname + "#account"); } } catch(e) {}

  /* ---- db: documents stored in table kv(user_id, path, data) with row level security ---- */
  function docRef(path){
    const uidOf = () => session && session.user.id;
    return {
      path,
      async get(){ const {data, error} = await sb.from("kv").select("data").eq("user_id", uidOf()).eq("path", path).maybeSingle(); if (error) throw {code: "unavailable", message: error.message}; return {id: path.split("/").pop(), exists: !!data, data: () => data ? data.data : undefined, metadata: {fromCache: false, hasPendingWrites: false}}; },
      async set(body){ const {error} = await sb.from("kv").upsert({user_id: uidOf(), path, data: body, updated_at: new Date().toISOString()}); if (error) throw {code: /row-level|permission/i.test(error.message) ? "invalid_argument" : "unavailable", message: error.message}; },
      async delete(){ await sb.from("kv").delete().eq("user_id", uidOf()).eq("path", path); },
      onSnapshot(next, onErr){ let dead = false; this.get().then(s => { if (!dead) next(s); }).catch(e => onErr && onErr(e)); return () => { dead = true; }; }
    };
  }
  const db = {doc: p => docRef(p), collection: c => ({doc: id => docRef(c + "/" + id)})};

  /* ---- user ---- */
  const user = {
    async id(){ await sessionReady; return session ? session.user.id : null; },
    async isOwner(){ return false; }, async canEdit(){ await sessionReady; return !!session; },
    async email(){ await sessionReady; return session ? session.user.email : null; }
  };

  /* ---- room: shaped like Claude's named rooms ----
     Presence only says who is in the room (sent once). Game state travels as broadcast messages, which are
     fast and have a high rate limit; sending every move as presence ran into Supabase's presence rate limit. */
  const tabId = Math.random().toString(36).slice(2, 10);
  function join(name){
    return new Promise((resolve, reject) => {
      const ch = sb.channel("chessnat-" + name, {config: {presence: {key: tabId}, broadcast: {self: false, ack: false}}});
      let state = {}, connected = false, peersCbs = [], connCbs = [], snap = [];
      const here = new Set(), states = {}, by = {}, upd = {};
      const build = () => { snap = [...here].map(k => { const prev = snap.find(x => x.peer === k); const pres = states[k] || {}; const same = prev && prev.presence === pres;
        return Object.freeze({peer: k, by: by[k] || null, isMe: k === tabId, sameTab: k === tabId, kind: "viewer", guest: false, presence: pres, updatedAt: upd[k] || Date.now()}); }); return snap; };
      const fire = () => { const p = build(); peersCbs.forEach(cb => cb({peers: p, joined: [], left: [], updated: p})); };
      const me = () => { states[tabId] = Object.freeze(JSON.parse(JSON.stringify(state))); upd[tabId] = Date.now(); by[tabId] = session ? session.user.id : null; };
      let sendT = null, lastSent = 0;
      const send = () => { clearTimeout(sendT); sendT = null; lastSent = Date.now(); if (!connected) return;
        ch.send({type: "broadcast", event: "st", payload: {k: tabId, u: session ? session.user.id : null, p: state}}).catch(() => {}); };
      const sendSoon = () => { if (sendT) return; const wait = Math.max(0, 40 - (Date.now() - lastSent)); sendT = setTimeout(send, wait); };
      ch.on("broadcast", {event: "st"}, ({payload}) => { if (!payload || payload.k === tabId) return; states[payload.k] = Object.freeze(payload.p || {}); by[payload.k] = payload.u || null; upd[payload.k] = Date.now(); here.add(payload.k); fire(); });
      ch.on("broadcast", {event: "hi"}, ({payload}) => { if (payload && payload.k !== tabId) send(); });
      ch.on("presence", {event: "join"}, ({key}) => { here.add(key); if (key !== tabId) send(); fire(); });
      ch.on("presence", {event: "leave"}, ({key}) => { if (key === tabId) return; here.delete(key); delete states[key]; fire(); });
      ch.on("presence", {event: "sync"}, () => { const ps = ch.presenceState(); Object.keys(ps).forEach(k => here.add(k)); [...here].forEach(k => { if (!ps[k] && k !== tabId) { here.delete(k); delete states[k]; } }); fire(); });
      // a quiet heartbeat repeats our state now and then, so a missed message heals by itself
      const beat = setInterval(() => { if (connected) send(); }, 5000);
      const room = {
        name,
        presence: async patch => { for (const k in patch){ if (patch[k] === null) delete state[k]; else state[k] = patch[k]; }
          if (JSON.stringify(state).length > 60000) throw {code: "invalid_argument", message: "state too large"}; me(); fire(); sendSoon(); },
        peers: () => snap, onPeers: cb => { peersCbs.push(cb); setTimeout(() => cb({peers: snap, joined: snap, left: [], updated: []}), 0); return () => { peersCbs = peersCbs.filter(x => x !== cb); }; },
        connected: () => connected, onConnection: cb => { connCbs.push(cb); setTimeout(() => cb(connected), 0); return () => {}; },
        emit: async () => {}, on: () => () => {},
        leave: async () => { clearInterval(beat); try { await ch.untrack(); } catch(e) {} sb.removeChannel(ch); }
      };
      here.add(tabId); me();
      let settled = false;
      ch.subscribe(async status => {
        const was = connected; connected = status === "SUBSCRIBED"; if (was !== connected) connCbs.forEach(cb => cb(connected));
        if (connected){ try { await ch.track({u: session ? session.user.id : null}); } catch(e) {} send(); ch.send({type: "broadcast", event: "hi", payload: {k: tabId}}).catch(() => {}); }
        if (!settled && connected){ settled = true; resolve(room); }
        if (!settled && (status === "CHANNEL_ERROR" || status === "TIMED_OUT")){ settled = true; reject({code: "upstream_error", message: status}); }
      });
      setTimeout(() => { if (!settled){ settled = true; reject({code: "upstream_error", message: "timeout"}); } }, 10000);
    });
  }

  window.claude = {use: async n => {
    if (!sb) return null;
    if (n === "room") return {join};
    await sessionReady;
    if (n === "user") return user;
    if (n === "db") return session ? db : null;
    return null;
  }};
  window.ChessSite = {sb, ready, sessionReady, getSession: () => session,
    async signUp(email, password){ return sb.auth.signUp({email, password, options: {emailRedirectTo: location.origin + location.pathname}}); },
    async signIn(email, password){ return sb.auth.signInWithPassword({email, password}); },
    async magic(email){ return sb.auth.signInWithOtp({email, options: {emailRedirectTo: location.origin + location.pathname}}); },
    async google(){ return sb.auth.signInWithOAuth({provider: "google", options: {redirectTo: location.origin + location.pathname}}); },
    async reset(email){ return sb.auth.resetPasswordForEmail(email, {redirectTo: location.origin + location.pathname + "#account"}); },
    async signOut(){ await sb.auth.signOut(); }
  };
})();
