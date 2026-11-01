/* ===== Chess.nat website platform layer =====
   Gives the app the same small API it uses inside Claude (window.claude.use("db" | "user" | "room")),
   backed by Supabase: email login, one private save per account, and realtime rooms for live games. */
(function(){
  const CFG = window.CHESSNAT_CONFIG || {};
  const ready = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase && !/YOUR-/.test(CFG.supabaseUrl));
  const sb = ready ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}}) : null;
  let session = null;
  const sessionReady = sb ? sb.auth.getSession().then(r => { session = r.data.session; return session; }).catch(() => null) : Promise.resolve(null);
  if (sb) sb.auth.onAuthStateChange((ev, s) => { const before = session && session.user.id; session = s; const after = s && s.user.id; if (ev === "SIGNED_IN" && before !== after) location.reload(); if (ev === "SIGNED_OUT" && before) location.reload(); });

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

  /* ---- room: Supabase Realtime presence, shaped like Claude's named rooms ---- */
  const tabId = Math.random().toString(36).slice(2, 10);
  function join(name){
    return new Promise((resolve, reject) => {
      const ch = sb.channel("chessnat-" + name, {config: {presence: {key: tabId}}});
      let state = {}, connected = false, peersCbs = [], connCbs = [], snap = [], updatedAt = {};
      const build = () => { const ps = ch.presenceState(); snap = Object.keys(ps).map(k => { const meta = ps[k][ps[k].length - 1] || {}; const pres = JSON.parse(JSON.stringify(meta.p || {})); const prev = snap.find(x => x.peer === k); const same = prev && JSON.stringify(prev.presence) === JSON.stringify(pres); return Object.freeze({peer: k, by: meta.u || null, isMe: k === tabId, sameTab: k === tabId, kind: "viewer", guest: false, presence: same ? prev.presence : Object.freeze(pres), updatedAt: same ? prev.updatedAt : Date.now()}); }); return snap; };
      ch.on("presence", {event: "sync"}, () => { const p = build(); peersCbs.forEach(cb => cb({peers: p, joined: [], left: [], updated: p})); });
      const room = {
        name,
        presence: async patch => { for (const k in patch){ if (patch[k] === null) delete state[k]; else state[k] = patch[k]; } if (JSON.stringify(state).length > 8000) throw {code: "invalid_argument", message: "presence too large"}; await ch.track({p: JSON.parse(JSON.stringify(state)), u: session ? session.user.id : null}); },
        peers: () => snap, onPeers: cb => { peersCbs.push(cb); setTimeout(() => cb({peers: snap, joined: snap, left: [], updated: []}), 0); return () => { peersCbs = peersCbs.filter(x => x !== cb); }; },
        connected: () => connected, onConnection: cb => { connCbs.push(cb); setTimeout(() => cb(connected), 0); return () => {}; },
        emit: async () => {}, on: () => () => {},
        leave: async () => { try { await ch.untrack(); } catch(e) {} sb.removeChannel(ch); }
      };
      let settled = false;
      ch.subscribe(status => {
        connected = status === "SUBSCRIBED"; connCbs.forEach(cb => cb(connected));
        if (!settled && status === "SUBSCRIBED"){ settled = true; resolve(room); }
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
