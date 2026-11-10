/* ===== Online party games: everyone on their own phone, like a chess invite.
   One phone hosts (it runs the game), the others join by link, QR code, 5-letter code or a friend invite.
   Each phone only shows its own part: your card, your role, your vote.
   Transport: a Supabase realtime channel per lobby (broadcast for messages, presence for who's connected).
   The host sends every phone a small "view" (plain text and choices, no HTML), phones send back taps. ===== */
const PNet = (() => {
  const {T} = PG;
  const me = (() => { let id = null; try { id = sessionStorage.getItem("chessnat-pid"); } catch(e) {} if (!id){ id = Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem("chessnat-pid", id); } catch(e) {} } return id; })();
  const ok = () => !!(window.ChessSite && window.ChessSite.sb);
  const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";
  const newCode = () => Array.from({length: 5}, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");
  const link = code => location.origin + "/#p-" + code;

  /* one realtime channel; reconnects by itself when the phone comes back from the background */
  function open(code, {onMsg, onPeers, onConn}){
    const sb = window.ChessSite.sb; let cur = null, dead = false, live = false;
    const sub = () => {
      const ch = sb.channel("chessnat-party-" + code, {config: {broadcast: {self: false, ack: false}, presence: {key: me}}}); cur = ch;
      ch.on("broadcast", {event: "m"}, ({payload}) => { if (ch === cur && payload) onMsg(payload); });
      ch.on("presence", {event: "sync"}, () => { if (ch === cur) try { onPeers(Object.keys(ch.presenceState())); } catch(e) {} });
      ch.subscribe(async st => { if (ch !== cur) return; live = st === "SUBSCRIBED"; onConn(live);
        if (live){ try { await ch.track({t: Date.now()}); } catch(e) {} }
        else if (!dead && /ERROR|TIMED_OUT|CLOSED/.test(st)) setTimeout(revive, 1500); });
    };
    const revive = () => { if (dead || (cur && cur.state === "joined")) return; const old = cur; cur = null; try { sb.removeChannel(old); } catch(e) {} sub(); };
    const vis = () => { if (!document.hidden) revive(); };
    document.addEventListener("visibilitychange", vis); window.addEventListener("online", revive);
    sub();
    return {send(m){ if (cur && live) cur.send({type: "broadcast", event: "m", payload: m}).catch(() => {}); }, get live(){ return live; },
      close(){ dead = true; document.removeEventListener("visibilitychange", vis); window.removeEventListener("online", revive); const c = cur; cur = null; try { c.untrack(); } catch(e) {} try { sb.removeChannel(c); } catch(e) {} }};
  }

  /* ---------- the running party (survives switching screens) ---------- */
  let P = null;
  const myName = () => (PG.st.myName || (typeof S !== "undefined" && S.name && S.name !== "You" ? S.name : "") || "").slice(0, 16);

  /* --- host --- */
  function host(game){
    leave(true);
    const code = newCode();
    P = {code, isHost: true, game: game || "imposter", opts: Object.assign({}, defaults(game || "imposter"), (PG.st.onOpts || {})[game || "imposter"] || {}), roster: [{id: me, name: myName() || T("Host", "Gastgeber"), av: myAv(), uid: (typeof Social !== "undefined" && Social.me) || null}], on: new Set([me]), G: null, seq: 0, view: null, last: Date.now()};
    start(); save(); return P;
  }
  /* practice: just you and the bots, on this phone only (works offline too) */
  function practice(game, extra){
    leave(true);
    P = {code: "solo", solo: true, isHost: true, game, opts: Object.assign({}, defaults(game), (PG.st.onOpts || {})[game] || {}, extra || {}, (PG.st.soloOpts || {})[game] || {}), roster: [{id: me, name: myName() || T("You", "Du"), av: myAv(), uid: null}], on: new Set([me]), G: null, seq: 0, view: null, last: Date.now()};
    start(); begin(); return P;
  }
  function resume(){
    try { const r = JSON.parse(sessionStorage.getItem("chessnat-party-host") || "null"); if (!r || Date.now() - r.t > 3 * 3600e3) return false;
      P = Object.assign(r.P, {isHost: true, on: new Set([me]), seq: 0, view: null}); start(); return true; } catch(e) { return false; }
  }
  const save = () => { if (!P || !P.isHost || P.solo) return; try { const {conn, on, timer, beat, ...rest} = P; sessionStorage.setItem("chessnat-party-host", JSON.stringify({t: Date.now(), P: rest})); } catch(e) {} };
  const eng = () => P && PG.online[P.game];
  const nameOf = id => { const L = P.roster || (P.msg && P.msg.players) || []; const r = L.find(x => x.id === id); return r ? r.name : "?"; };

  function start(){
    if (P.solo) P.conn = {send(){}, live: true, close(){}};
    else P.conn = open(P.code, {
      onMsg: m => { if (!P) return; if (m && m.t === "host") return clientMsg(m); P.isHost ? hostMsg(m) : clientMsg(m); },
      onPeers: ids => { if (!P) return; P.on = new Set(ids.concat(me)); if (P.isHost) push(); else redraw(); },
      onConn: live => { if (!P) return; if (live){ if (P.isHost) push(true); else hello(); } redraw(); }});
    beat();
  }
  function beat(){
    clearInterval(P.beat);
    if (P.isHost){
      P.beat = setInterval(() => { if (!P || !P.isHost) return; const e = eng(); let ch = false;
        if (P.G && e && e.tick){ try { ch = !!e.tick(P.G, api()); } catch(err) { console.error(err); } }
        /* someone who has been gone for a while is out of the running round */
        if (P.G && !P.solo && e && e.gone){ P.offT = P.offT || {}; P.roster.forEach(r => { if (r.id === me || P.on.has(r.id)){ delete P.offT[r.id]; return; } if (!P.offT[r.id]) P.offT[r.id] = Date.now(); else if (Date.now() - P.offT[r.id] > 45000 && P.G.ids.includes(r.id)){ try { e.gone(P.G, r.id, api()); } catch(err) {} ch = true; } }); }
        if (ch || Date.now() - (P.sent || 0) > 2500) push(true); }, 1000);
    } else {
      P.beat = setInterval(() => { if (!P || P.isHost) return; if (!P.gotMe || Date.now() - P.last > 6000) hello();
        /* the host is gone without a word: the first one still here takes over, everyone goes back to the lobby */
        const m = P.msg; if (m && Date.now() - P.last > 15000 && !P.on.has(m.host)){ const left = m.players.filter(x => x.id !== m.host && (P.on.has(x.id) || x.id === me)).map(x => x.id).sort(); if (left[0] === me) takeOver({roster: m.players.filter(x => x.id !== m.host).map(x => ({id: x.id, name: x.name, av: x.av, uid: x.uid})), game: m.game, opts: m.opts, G: null, seq: m.seq + 5}, m.host); } }, 3000);
    }
  }
  /* the host hands the party to someone else when leaving */
  function takeOver(snap, old){
    if (!P) return; P.isHost = true; P.game = snap.game; P.opts = snap.opts || defaults(snap.game); P.roster = (snap.roster || []).map(r => r.id === old ? Object.assign({}, r, {gone: 1}) : r); if (!P.roster.some(r => r.id === me)) P.roster.unshift({id: me, name: P.name || myName() || T("Host", "Gastgeber"), av: myAv(), uid: (typeof Social !== "undefined" && Social.me) || null});
    P.G = snap.G || null; P.seq = snap.seq || 0; P.on = P.on || new Set([me]); P.on.add(me); P.view = null;
    if (P.G){ P.G.host = me; const e = eng(); if (e && e.gone) try { e.gone(P.G, old, api()); } catch(err) {} }
    beat(); save(); push(true); toast(T("You're the host now.", "Du bist jetzt Gastgeber."), 2500); }
  function hostMsg(m){
    if (!m || m.code !== P.code) return;
    if (m.t === "mv" || m.t === "mvb"){ PG.onMv && PG.onMv(m); return; }
    if (/^a(m|mb|s|h|hp|fl|br)$/.test(m.t)){ PG.onArena && PG.onArena(m); return; }
    if (m.t === "rtc"){ PVoice.onMsg(m); return; }
    if (m.t === "hi"){ const n = String(m.name || "").replace(/\s+/g, " ").trim().slice(0, 16) || T("Player", "Spieler");
      const r = P.roster.find(x => x.id === m.id), uid = typeof m.uid === "string" && /^[0-9a-f-]{36}$/.test(m.uid) ? m.uid : null;
      const av = m.av && typeof m.av === "object" && JSON.stringify(m.av).length < 1500 ? m.av : null;
      if (r){ r.name = uniq(n, m.id); r.uid = uid; r.av = av; r.gone = 0; if (P.on) P.on.add(m.id); } else { if (P.roster.length >= 24) return; P.roster.push({id: m.id, name: uniq(n, m.id), uid, av}); if (P.on) P.on.add(m.id); Sound.blub ? Sound.blub() : Sound.tap(); PG.vib(20); }
      push(true); }
    else if (m.t === "act" && P.G){ const e = eng(); if (!e) return; try { e.act(P.G, m.id, m.a || {}, api()); } catch(err) { console.error(err); } push(); }
    else if (m.t === "bye"){ const inG = P.G && P.G.ids.includes(m.id); if (inG){ const e = eng(); if (e && e.gone) try { e.gone(P.G, m.id, api()); } catch(err) {} const r = P.roster.find(x => x.id === m.id); if (r) r.gone = 1; } P.roster = P.roster.filter(x => x.id !== m.id || inG); if (P.on) P.on.delete(m.id); push(true); }
  }
  const uniq = (n, id) => { let k = n, i = 2; while (P.roster.some(x => x.id !== id && x.name.toLowerCase() === k.toLowerCase())) k = n + " " + i++; return k; };
  /* what the engines get to work with */
  function api(){
    return {T, me, now: () => Date.now(), av: id => { const r = P.roster.find(x => x.id === id); return r && r.av; }, name: id => nameOf(id), push: () => push(), online: id => P.on.has(id), roster: () => P.roster.slice()};
  }
  let pushT = null;
  function push(now){
    if (!P || !P.isHost) return;
    if (!now){ if (pushT) return; pushT = setTimeout(() => { pushT = null; push(true); }, 60); return; }
    if (P.G && P.G.s && P.G.s.toLobby){ P.G = null; P.roster = P.roster.filter(r => !r.gone && (r.id === me || P.on.has(r.id))); }
    const e = eng(), views = {};
    if (P.G && e){ P.roster.forEach(r => { let v; try { v = P.G.ids.includes(r.id) ? e.view(P.G, r.id, api()) : spect(); } catch(err) { console.error(err); v = {say: "…"}; } views[r.id] = v; }); }
    const msg = {t: "v", code: P.code, seq: ++P.seq, host: me, game: P.game, opts: P.opts, lobby: !P.G, players: P.roster.map(r => ({id: r.id, name: r.name, on: P.on.has(r.id), uid: r.uid || null, av: r.av || null})), views};
    P.conn && P.conn.send(msg); P.sent = Date.now(); P.msg = msg; save(); redraw();
  }
  const spect = () => ({k: "spect", emo: "👀", say: T("A round is running. You're in from the next round.", "Gerade läuft eine Runde. Ab der nächsten bist du dabei.")});

  /* --- client --- */
  function join(code, name){
    leave(true);
    P = {code: code.toLowerCase(), isHost: false, name, msg: null, last: Date.now(), gotMe: false, on: new Set([me])};
    PG.st.myName = name; PG.persist(); start(); return P;
  }
  const myAv = () => { try { const a = typeof myAvatar === "function" ? myAvatar() : null; const j = a ? JSON.stringify(a) : ""; return j && j.length < 1500 ? JSON.parse(j) : null; } catch(e) { return null; } };
  const hello = () => { if (P && !P.isHost) P.conn.send({t: "hi", code: P.code, id: me, name: P.name, av: myAv(), uid: (typeof Social !== "undefined" && Social.me) || null}); };
  function clientMsg(m){
    if (!m || m.code !== P.code) return;
    if (m.t === "mv" || m.t === "mvb"){ PG.onMv && PG.onMv(m); return; }
    if (/^a(m|mb|s|h|hp|fl|br)$/.test(m.t)){ PG.onArena && PG.onArena(m); return; }
    if (m.t === "rtc"){ PVoice.onMsg(m); return; }
    if (m.t === "host"){ if (m.to === me && m.snap) takeOver(m.snap, m.id); return; }
    if (m.t === "v"){ if (P.isHost) return; if (P.msg && m.seq < P.msg.seq && m.host === P.msg.host && P.msg.seq - m.seq < 50) return;
      P.msg = m; P.last = Date.now(); P.gotMe = m.players.some(p => p.id === me); P.game = m.game; redraw(); }
    else if (m.t === "kick" && m.id === me){ leave(true); toast(T("The host removed you from the lobby.", "Der Gastgeber hat dich aus der Lobby entfernt."), 3500); if (App.route === "lobby") App.go("games"); }
    else if (m.t === "end" && (!P.msg || m.id === P.msg.host || !m.id)){ leave(true); toast(T("The host closed the lobby.", "Der Gastgeber hat die Lobby geschlossen."), 3500); if (App.route === "lobby") App.go("games"); }
  }
  function act(a){ if (!P) return; if (P.isHost){ const e = eng(); if (P.G && e){ try { e.act(P.G, me, a, api()); } catch(err) { console.error(err); } push(); } } else P.conn.send({t: "act", code: P.code, id: me, a}); }

  function leave(quiet){
    if (!P) return;
    if (!quiet && !P.solo){ PG.st.left = {c: P.code, t: Date.now()}; PG.persist(); }
    try { if (P.isHost && !P.solo){ const next = P.roster.filter(r => r.id !== me && P.on.has(r.id) && !r.gone)[0];
        if (next){ const G = P.G ? JSON.parse(JSON.stringify(P.G)) : null; P.conn.send({t: "host", code: P.code, id: me, to: next.id, snap: {roster: P.roster.map(r => r.id === me ? Object.assign({}, r, {gone: 1}) : r), game: P.game, opts: P.opts, G, seq: P.seq + 5}}); }
        else P.conn && P.conn.send({t: "end", code: P.code, id: me}); }
      else if (!P.isHost) P.conn && P.conn.send({t: "bye", code: P.code, id: me}); } catch(e) {}
    clearInterval(P.beat); const c = P.conn; P = null; setTimeout(() => c && c.close(), 300);
    try { sessionStorage.removeItem("chessnat-party-host"); } catch(e) {}
    PG.awake(false); if (PG.custom) Object.values(PG.custom).forEach(c => c.stop && c.stop()); pill(); if (!quiet) redraw();
  }

  /* host controls */
  function setGame(g){ if (!P || !P.isHost) return; P.game = g; P.opts = Object.assign({}, defaults(g), (PG.st.onOpts || {})[g] || {}); push(); }
  const defaults = g => { const e = PG.online[g]; const o = {}; (e && e.opts || []).forEach(x => { o[x.k] = x.d; }); return o; };
  function setOpt(k, v){ if (!P || !P.isHost) return; P.opts[k] = v; const key = P.solo ? "soloOpts" : "onOpts"; PG.st[key] = PG.st[key] || {}; PG.st[key][P.game] = Object.assign({}, P.opts); PG.persist(); push(); }
  function begin(){
    const e = eng(); if (!e) return;
    const ids = P.roster.filter(r => P.on.has(r.id)).map(r => r.id);
    const extra = e.extra ? e.extra(Object.assign({}, defaults(P.game), P.opts), !!P.solo) : 0;
    if (ids.length + extra < e.min) return toast(T(`${e.min} players needed (bots count).`, `Mindestens ${e.min} Spieler nötig (Bots zählen mit).`));
    if (e.max && ids.length > e.max) return toast(T(`At most ${e.max} players.`, `Höchstens ${e.max} Spieler.`));
    P.G = {ids, host: me, solo: !!P.solo, opts: Object.assign({}, defaults(P.game), P.opts), s: {}, sk: 0};
    try { e.start(P.G, api()); } catch(err) { console.error(err); P.G = null; return toast("Error: " + err.message); }
    PG.awake(true); push();
  }
  function toLobby(){ if (!P || !P.isHost) return; P.G = null; P.roster = P.roster.filter(r => !r.gone && (r.id === me || P.on.has(r.id))); push(); }
  function kick(id){ if (!P || !P.isHost || id === me) return; P.roster = P.roster.filter(r => r.id !== id); P.conn.send({t: "kick", code: P.code, id}); push(); }

  /* the one place that draws: the lobby screen, if it's open; otherwise the little "back to the game" pill */
  function redraw(){ pill(); if (App.route === "lobby" && Views.lobby.draw) Views.lobby.draw(); }
  function pill(){
    let el = document.querySelector(".pg-pill");
    if (!P || App.route === "lobby"){ if (el) el.remove(); return; }
    if (!el){ el = document.createElement("button"); el.className = "pg-pill"; el.onclick = () => App.go("lobby"); document.body.appendChild(el); }
    const g = PG.games.find(x => x.id === P.game);
    el.innerHTML = `${icon("users", 18)}<span>${T("Back to the game", "Zurück zum Spiel")}${g ? " · " + PG.h(T(g.name[0], g.name[1])) : ""}</span>`;
  }
  window.addEventListener("chessnat:route", pill);

  /* someone opened an invite link */
  const fromHash = h => { const m = /^#?p-([a-z0-9]{4,12})$/i.exec(h || ""); return m ? m[1].toLowerCase() : null; };
  const refresh = () => { if (!P) return; if (P.isHost){ const r = P.roster.find(x => x.id === me); if (r){ r.av = myAv(); r.name = myName() || r.name; } push(); } else hello(); };
  const raw = m => { if (P && P.conn) P.conn.send(Object.assign({code: P.code, id: me}, m)); };
  return {refresh, practice, raw, me, ok, link, newCode, host, resume, join, act, leave, setGame, setOpt, begin, toLobby, kick, fromHash, get P(){ return P; }, nameOf: id => P ? nameOf(id) : "", myName, defaults};
})();
PG.online = {};

/* ---------- voice chat: every phone talks straight to every other phone (WebRTC); the party channel only carries the hand-shake.
   The game decides when your microphone is open (e.g. only in meetings, and never when you're dead). ---------- */
const PVoice = (() => {
  const STUN = [{urls: "stun:stun.l.google.com:19302"}, {urls: "stun:stun.cloudflare.com:3478"}];
  /* phones on mobile data or behind strict routers can't reach each other directly: a TURN relay passes the audio through.
     Open Relay's shared-secret TURN; the short-lived login is made here (HMAC of the expiry), so there's nothing to sign up for. */
  let ICE = STUN, iceAt = 0;
  async function iceServers(){
    if (ICE !== STUN && Date.now() - iceAt < 6 * 3600e3) return ICE;
    try { const user = Math.floor(Date.now() / 1000 + 24 * 3600) + ":chessnat", enc = new TextEncoder();
      const k = await crypto.subtle.importKey("raw", enc.encode("openrelayprojectsecret"), {name: "HMAC", hash: "SHA-1"}, false, ["sign"]);
      const cred = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(user))))), H = "staticauth.openrelay.metered.ca";
      ICE = [STUN[0], {urls: [`turn:${H}:80`, `turn:${H}:443?transport=tcp`, `turns:${H}:443?transport=tcp`], username: user, credential: cred}]; iceAt = Date.now(); } catch(e) { ICE = STUN; }
    return ICE;
  }
  const log = (n, m) => { try { if (typeof Track !== "undefined") Track.push("voice", n, m); } catch(e) {} };
  let stream = null, keep = null, keepT = 0, on = false, starting = null, mic = false, mute = false, pcs = {}, lastHi = 0, hiT = 0, lvT = 0;
  const level = {}, an = {};
  const send = (to, d) => PNet.raw({t: "rtc", to, d});
  const me = () => PNet.me;
  async function start(){
    if (on || starting) return starting; if (!navigator.mediaDevices || !window.RTCPeerConnection) return false;
    /* the microphone is asked for once: the stream stays with the app (muted) between lobby and rounds, so the phone doesn't ask again every game */
    starting = (async () => { try { clearTimeout(keepT); if (keep && keep.getAudioTracks().some(t => t.readyState === "live")) stream = keep; else { stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true}, video: false}); keep = stream; } }
      catch(e) { starting = null; PVoice.denied = true; log("deny", {e: String(e && e.name || e).slice(0, 30)}); return false; }
      await iceServers(); log("start", {turn: ICE !== STUN ? 1 : 0});
      on = true; PVoice.denied = false; applyMic(); watch(me(), stream); send("*", {hi: 1}); lastHi = Date.now();
      hiT = setInterval(() => { if (on) send("*", {hi: 1}); }, 4000); lvT = setInterval(levels, 180); starting = null; return true; })();
    return starting;
  }
  function stop(){ if (!on && !starting) return; if (on) send("*", {bye: 1}); on = false; clearInterval(hiT); clearInterval(lvT); Object.keys(pcs).forEach(close); if (stream) stream.getTracks().forEach(t => { t.enabled = false; }); stream = null; clearTimeout(keepT); keepT = setTimeout(() => { if (!on && keep){ keep.getTracks().forEach(t => t.stop()); keep = null; } }, 10 * 60e3); }
  function close(id){ const x = pcs[id]; if (!x) return; try { x.pc.close(); } catch(e) {} if (x.au){ x.au.srcObject = null; x.au.remove(); } delete pcs[id]; delete level[id]; delete an[id]; }
  function applyMic(){ if (stream) stream.getAudioTracks().forEach(t => { t.enabled = mic && !mute; }); }
  /* one fixed side makes the offer (the smaller id), so two phones never offer at the same time and get stuck */
  const offerer = id => me() < id;
  function peer(id){
    close(id);
    const pc = new RTCPeerConnection({iceServers: ICE}), x = pcs[id] = {pc, au: null, t: Date.now(), sid: Math.random().toString(36).slice(2, 8), rs: null, pend: [], q: Promise.resolve()};
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));
    pc.onicecandidate = e => { if (e.candidate) send(id, {s: x.sid, r: x.rs, cand: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate}); };
    pc.ontrack = e => { const st = e.streams && e.streams[0] || new MediaStream([e.track]); if (!x.au){ x.au = document.createElement("audio"); x.au.autoplay = true; x.au.setAttribute("playsinline", ""); x.au.style.display = "none"; document.body.appendChild(x.au); }
      x.au.srcObject = st; x.au.play().catch(() => {}); watch(id, st); };
    pc.onconnectionstatechange = () => { const s = pc.connectionState; if (pcs[id] !== x) return; if (s === "disconnected") x.dis = Date.now();
      if (s === "connected" && !x.up){ x.up = 1; pc.getStats().then(r => { let pair = null; const L = {}; r.forEach(v => { L[v.id] = v; if (v.type === "candidate-pair" && v.nominated && v.state === "succeeded") pair = v; });
        log("up", {ms: Date.now() - x.t, l: pair && L[pair.localCandidateId] ? L[pair.localCandidateId].candidateType : "?", r: pair && L[pair.remoteCandidateId] ? L[pair.remoteCandidateId].candidateType : "?"}); }).catch(() => log("up", {ms: Date.now() - x.t})); }
      if (s === "failed"){ log("fail", {ms: Date.now() - x.t, up: x.up ? 1 : 0}); close(id); if (offerer(id)) offer(id); else send(id, {hi: 1}); } };
    return x;
  }
  /* the offerer starts a fresh connection and sends its offer */
  function offer(id){ const x = peer(id), pc = x.pc;
    x.q = x.q.then(async () => { try { await pc.setLocalDescription(await pc.createOffer()); if (pcs[id] === x) send(id, {s: x.sid, desc: {type: "offer", sdp: pc.localDescription.sdp}}); } catch(e) { console.warn("voice", e); } }); }
  /* who is talking right now: a little level meter per voice */
  function watch(id, st){ try { const ac = Sound.ac; if (!ac) return; const src = ac.createMediaStreamSource(st), a = ac.createAnalyser(); a.fftSize = 256; src.connect(a); an[id] = a; } catch(e) {} }
  function levels(){ const buf = new Uint8Array(128); Object.entries(an).forEach(([id, a]) => { a.getByteTimeDomainData(buf); let m = 0; for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i] - 128)); level[id] = m > 10; }); }
  async function onMsg(m){
    if (!on || !m || !m.id || m.id === me() || (m.to !== "*" && m.to !== me())) return; const d = m.d || {}, id = m.id;
    if (d.bye){ close(id); return; }
    let x = pcs[id];
    /* "I'm here": the offerer connects (again, if the last try is stuck); the other side just answers with its own hello */
    if (d.hi){ if (offerer(id)){ const st = x && x.pc.connectionState, age = x ? Date.now() - x.t : 0;
        if (!x || (st === "disconnected" ? Date.now() - x.dis > 6000 : st !== "connected" && age > (st === "connecting" ? 20000 : 9000))){ if (x) log("retry", {st}); offer(id); } }
      else if (!x) send(id, {hi: 1}); return; }
    if (d.desc && d.desc.type === "offer"){ if (offerer(id)) return; /* a new offer: always a fresh connection */ x = peer(id); x.rs = d.s; }
    else { if (!x || (d.r && d.r !== x.sid)) return; if (d.desc){ if (d.r !== x.sid) return; if (!x.rs) x.rs = d.s; } else if (x.rs && d.s !== x.rs) return; }
    const X = x; X.q = X.q.then(() => handle(X, d, id)); }
  /* one message at a time per connection, so a candidate never overtakes the offer it belongs to; early candidates wait for it */
  async function handle(x, d, id){ const pc = x.pc; if (pcs[id] !== x) return;
    try {
      if (d.desc){ if (d.desc.type === "answer" && pc.signalingState !== "have-local-offer") return;
        await pc.setRemoteDescription(d.desc);
        if (d.desc.type === "offer"){ await pc.setLocalDescription(await pc.createAnswer()); if (pcs[id] === x) send(id, {s: x.sid, r: x.rs, desc: {type: "answer", sdp: pc.localDescription.sdp}}); }
        const P = x.pend; x.pend = []; for (const c of P){ try { await pc.addIceCandidate(c); } catch(e) {} } }
      else if (d.cand){ if (!pc.remoteDescription) x.pend.push(d.cand); else { try { await pc.addIceCandidate(d.cand); } catch(e) {} } }
    } catch(e) { console.warn("voice", e); }
  }
  return {start, stop, onMsg, get on(){ return on; }, get starting(){ return !!starting; }, denied: false,
    setMic(v){ mic = !!v; applyMic(); }, get mic(){ return mic; }, toggleMute(){ mute = !mute; applyMic(); return mute; }, get muted(){ return mute; },
    talking: id => !!level[id], peers: () => Object.keys(pcs).filter(id => pcs[id].pc.connectionState === "connected"), get _pcs(){ return pcs; }};
})();

/* ---------- safe rendering of a view: plain text, *bold*, line breaks; never HTML from another phone ---------- */
const PView = (() => {
  const {T} = PG;
  const md = s => esc(String(s == null ? "" : s)).replace(/\*([^*\n]+)\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  const SND = {night: () => { if (Sound.fx && Sound.fx()) [79, 76, 72, 67, 64].forEach((m, i) => Sound.note(m, i * .2, 1.4, .06, "bell")); },
    day: () => { if (Sound.fx && Sound.fx()){ [60, 64, 67, 72, 76].forEach((m, i) => Sound.note(m, i * .1, .7, .08, "marimba")); Sound.sparkle && Sound.sparkle(.5, 5, 0, .02); } },
    death: () => { Sound.play("Capture", .8); PG.vib([60, 40, 120]); }, cheer: () => PG.cheer(3), win: () => PG.cheer(3), lose: () => Sound.play("Defeat", .7), victory: () => Sound.play("Victory", .7),
    reveal: () => Sound.play("Capture", .5), xp: () => Sound.xp ? Sound.xp() : Sound.right(), right: () => Sound.right(), wrong: () => Sound.wrong(), notify: () => Sound.play("GenericNotify", .7), plop: () => Sound.play("Move", .6),
    heart: () => Sound.heart && Sound.heart(), unlock: () => Sound.unlock && Sound.unlock(), tick: () => Sound.tick(),
    boom: () => { PG.vib([200, 80, 400]); if (Sound.fx && Sound.fx()){ Sound.air(0, 1.1, 1400, 60, .3, .6); Sound.air(.05, .6, 300, 40, .25, .8); } Sound.play("Capture", 1); setTimeout(() => Sound.play("Defeat", .8), 350); },
    bomb: () => { if (Sound.fx && Sound.fx()) Sound.tone([[1500, .035]], "square", .045); }};
  const st = {open: {}, snd: null, tk: {}, sel: {}, sent: {}, tick: null};
  const c4 = c => `<div class="row" style="justify-content:space-between;width:100%;max-width:440px"><span class="pill ${c.turn === 1 && !c.over ? "go" : ""}">⚪ ${md(c.names[0])}${c.mine === 1 ? " (" + T("you", "du") + ")" : ""}</span><span class="pill ${c.turn === 2 && !c.over ? "go" : ""}">⚫ ${md(c.names[1])}${c.mine === 2 ? " (" + T("you", "du") + ")" : ""}</span></div>
    <div class="pg-c4">${c.b.map((col, ci) => `<div class="pg-c4c" ${c.mine === c.turn && !c.over ? `data-a="drop" data-v="${ci}"` : ""}>${col.slice().reverse().map((x, ri) => { const y = 5 - ri, last = c.last && c.last[0] === ci && c.last[1] === y, w = c.win && c.win.some(([a, b]) => a === ci && b === y);
      return `<div class="pg-c4h">${x ? `<i class="pg-d d${x} ${last ? "drop" : ""} ${w ? "win" : ""}" style="--r:${ri + 1}"></i>` : ""}</div>`; }).join("")}</div>`).join("")}</div>`;
  const cardH = c => `<button class="pg-card ${c.mini ? "mini" : ""} ${st.open[c.k] ? "open" : ""}" data-card data-quiet><span class="in"><span class="b"><span class="pg-cardtag">${T("Tap to look", "Tippen zum Aufdecken")}</span></span><span class="f ${c.bad ? "bad" : ""} ${c.night ? "night" : ""}">${c.lab ? `<span class="lab">${md(c.lab)}</span>` : ""}${c.em ? `<span class="em">${md(c.em)}</span>` : ""}${c.big ? `<span class="big">${md(c.big)}</span>` : ""}${(c.sm || []).map(x => `<span class="sm">${md(x)}</span>`).join("")}</span></span></button><p class="pg-hint">${T("Tap to look, tap again to hide. Only you see it.", "Antippen zum Anschauen, nochmal zum Verdecken. Nur du siehst das.")}</p>`;
  function html(v){
    const c = v.card, p = v.pick;
    return `<div class="pg-stage pg-on">${v.emo ? `<div class="pg-moon">${md(v.emo)}</div>` : ""}${v.who ? `<div class="pg-who">${md(v.who)}</div>` : ""}${v.name ? `<div class="pg-name" style="${v.nameSize ? `font-size:${+v.nameSize}px` : ""}">${md(v.name)}</div>` : ""}
      ${v.say ? `<p class="pg-say">${md(v.say)}${v.small ? `<small>${md(v.small)}</small>` : ""}</p>` : v.small ? `<p class="muted" style="margin:0">${md(v.small)}</p>` : ""}
      ${c && !c.mini ? cardH(c) : ""}
      ${v.big ? `<div class="pg-big ${v.big.c === "bad" ? "pg-bad" : v.big.c === "light" ? "pg-light" : ""}" ${v.big.tap ? `data-a="${esc(v.big.tap)}" style="cursor:pointer"` : ""}>${v.big.k ? `<span class="k">${md(v.big.k)}</span>` : ""}<div class="q" style="${v.big.size ? `font-size:${+v.big.size}px` : ""}">${md(v.big.q)}</div>${(v.big.sub || []).map(x => `<span style="font:800 17px var(--body);color:${v.big.subc || "#F07B68"}">${md(x)}</span>`).join("")}${v.big.hint ? `<p class="pg-hint" style="margin:0">${md(v.big.hint)}</p>` : ""}</div>` : ""}
      ${v.timer ? `<div class="pg-timer" data-tm></div>` : ""}
      ${v.stats ? `<div class="grid${v.stats.length > 2 ? 3 : 2}" style="width:100%">${v.stats.map(s => `<div class="stat"><b>${md(s[0])}</b><span>${md(s[1])}</span></div>`).join("")}</div>` : ""}
      ${p ? `${p.title ? `<div class="pg-who">${md(p.title)}</div>` : ""}<div class="pg-grid">${p.opts.map(o => `<button class="btn ${o.sel ? "go" : ""} ${o.off ? "pg-off" : ""}" data-pv="${esc(String(o.v))}" ${o.off || p.lock ? "disabled" : ""}>${md(o.l)}${o.mark ? `<small class="pg-mk">${md(o.mark)}</small>` : ""}</button>`).join("")}</div>` : ""}
      ${v.input ? `<div class="unit" style="width:100%;text-align:left;margin:0">${v.input.fields.map(f => `<label class="muted" style="display:block;margin:6px 0 2px;font-weight:800">${md(f.l)}</label><input type="text" data-in="${esc(f.k)}" maxlength="${f.max || 40}" value="${esc(f.v || "")}" ${v.input.lock ? "disabled" : ""} style="width:100%" autocomplete="off" autocapitalize="sentences">`).join("")}</div>` : ""}
      ${(v.btns || []).length ? `<div class="pg-btns ${v.btns.length === 2 && !v.btnsCol && !v.btns.some(b => b.s === "ghost") ? "two" : ""}">${v.btns.map(b => `<button class="btn ${b.s === "go" ? "go big" : b.s === "bad" ? "big pg-badb" : b.s === "ghost" ? "ghost" : "big"}" data-a="${esc(b.a)}" data-v="${esc(b.v == null ? "" : String(b.v))}" ${b.dis ? "disabled" : ""}>${md(b.l)}</button>`).join("")}</div>` : ""}
      ${v.c4 ? c4(v.c4) : ""}
      ${(v.lists || []).concat(v.list ? [v.list] : []).map(L => `<div class="unit" style="width:100%;text-align:left;margin:0">${L.t ? `<h3>${md(L.t)}</h3>` : ""}<div class="list">${L.rows.map(r => `<div class="li" ${r.a ? `data-a="${esc(r.a)}" data-v="${esc(String(r.v))}" style="cursor:pointer;${r.d ? "opacity:.5" : ""}"` : `style="${r.d ? "opacity:.5" : ""}"`}>${r.e != null ? `<span style="font-size:20px;width:28px;text-align:center">${md(r.e)}</span>` : ""}<div class="grow"><div class="t">${md(r.l)}</div>${r.s ? `<div class="s">${md(r.s)}</div>` : ""}</div>${r.r != null ? `<b style="font:900 18px var(--display);color:${r.c === "go" ? "var(--go-hi)" : r.c === "bad" ? "#F07B68" : "var(--fg)"}">${md(r.r)}</b>` : ""}</div>`).join("")}</div></div>`).join("")}
      ${v.foot ? `<p class="pg-hint">${md(v.foot)}</p>` : ""}${c && c.mini ? cardH(c) : ""}${v.hostBack ? `<button class="btn ghost sm" data-a="lobby" style="margin-top:10px;opacity:.75">${T("End round · back to the lobby", "Runde beenden · zurück zur Lobby")}</button>` : ""}</div>`;
  }
  /* draw a view; same view again = nothing changes (typed text and open cards stay) */
  function draw(box, v, act){
    if (!v) return;
    const json = JSON.stringify(v); if (box._json === json && box.isConnected && box.firstChild) return; box._json = json;
    const keep = {}; let foc = null; $$("[data-in]", box).forEach(i => { keep[i.dataset.in] = i.value; if (document.activeElement === i) foc = i.dataset.in; });
    const sameK = box._k === v.k; box._k = v.k;
    box.innerHTML = html(v);
    if (sameK) $$("[data-in]", box).forEach(i => { if (keep[i.dataset.in] != null && !v.input.force) i.value = keep[i.dataset.in]; if (foc === i.dataset.in) i.focus(); });
    document.documentElement.classList.toggle("pg-night", !!v.night);
    if (v.snd && v.snd.k !== st.snd){ st.snd = v.snd.k; try { (SND[v.snd.n] || (() => {}))(); } catch(e) {} }
    if (!sameK){ window.scrollTo(0, 0); if (v.pick && !v.pick.lock || v.input && !v.input.lock || (v.btns || []).some(b => b.s === "go" || b.s === "bad")) PG.vib(25); }
    /* card: tap to open, tap to close */
    const c = box.querySelector("[data-card]"); if (c){ const k = v.card.k; c.onclick = () => { st.open[k] = !st.open[k]; c.classList.toggle("open", st.open[k]); if (st.open[k]) Sound.play("Capture", .45); else Sound.tap(); if (v.card.seen && st.open[k]) act({a: v.card.seen}); }; }
    /* timer counts down on this phone from what the host said was left */
    const tm = box.querySelector("[data-tm]"); if (tm && v.timer){ const t = v.timer, k = t.k; let o = st.tk[k]; const end = Date.now() + t.left;
      if (!o || Math.abs(o.end - end) > 2500 || t.paused) o = st.tk[k] = {end, last: null}; const paused = t.paused;
      const run = () => { if (!tm.isConnected) return clearInterval(id); const left = paused ? t.left : o.end - Date.now(), s = Math.max(0, Math.ceil(left / 1000)); tm.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); tm.classList.toggle("low", s <= 10);
        if (!paused && s !== o.last && s <= 5 && s > 0){ Sound.tick(); PG.vib(s <= 3 ? 40 : 20); } o.last = s; };
      const id = setInterval(run, 250); run(); }
    $$("[data-pv]", box).forEach(b => b.onclick = () => { b.classList.toggle("go"); act({a: v.pick.act, v: b.dataset.pv}); });
    /* the bomb ticks on the phone that holds it, faster as the fuse burns */
    clearTimeout(st.tick); if (v.ticking != null){ let i = 0; const loop = () => { if (!box.isConnected || box._k !== v.k) return; SND.bomb(); if (i++ % 2) PG.vib(8); st.tick = setTimeout(loop, 760 - 560 * Math.pow(v.ticking, 1.3)); }; loop(); }
    /* time's up: hand in what you typed */
    if (v.input && v.input.auto && !st.sent[v.k]){ st.sent[v.k] = 1; const f = {}; Object.entries(keep).forEach(([k, val]) => { f[k] = String(val).trim().slice(0, 60); }); $$("[data-in]", box).forEach(i => { if (f[i.dataset.in] == null) f[i.dataset.in] = i.value.trim().slice(0, 60); }); act({a: v.input.act, f}); }
    $$("[data-a]", box).forEach(b => b.onclick = () => {
      if (b.dataset.armed === undefined && /^(end|lobby|leave)$/.test(b.dataset.a)){ b.dataset.armed = ""; b.textContent = T("Sure? Tap again", "Sicher? Nochmal tippen"); return; }
      const a = {a: b.dataset.a, v: b.dataset.v};
      if (v.input && b.dataset.a === v.input.act){ a.f = {}; $$("[data-in]", box).forEach(i => { a.f[i.dataset.in] = i.value.trim().slice(0, 60); }); }
      act(a); });
  }
  return {draw, md};
})();

/* ===== The lobby screen ===== */
Views.lobby = {
  mount(main, arg){
    const {T} = PG; this.main = main;
    if (arg && arg.practice){ PNet.practice(arg.practice, arg.opts); this.draw(); return; }
    if (!PNet.ok() && !(PNet.P && PNet.P.solo)){ main.innerHTML = `<div class="page"><div class="msg no"><div class="ic">!</div><div><h4>${T("Online games need the website", "Online-Spiele brauchen die Website")}</h4><p>${T("Open Chess.nat at chess-nat.vercel.app to play with several phones.", "Öffne Chess.nat unter chess-nat.vercel.app, um mit mehreren Handys zu spielen.")}</p></div></div></div>`; return; }
    let code = arg && arg.join ? String(arg.join).toLowerCase() : PNet.fromHash(location.hash) || window.__pgJoin || null; window.__pgJoin = null;
    /* a lobby you just left doesn't pull you back in by itself, only a fresh tap on an invite does */
    if (code && !(arg && arg.join) && PG.st.left && PG.st.left.c === code && Date.now() - PG.st.left.t < 3 * 3600e3) code = null;
    if (arg && arg.join && PG.st.left && PG.st.left.c === code){ PG.st.left = null; PG.persist(); }
    if (arg && arg.host){ PNet.host(arg.game); }
    else if (code && (!PNet.P || PNet.P.code !== code)){ if (PNet.P) PNet.leave(true); const nm = PNet.myName(); if (!(arg && arg.join) || !nm) return this.ask(code); PNet.join(code, nm); }
    else if (!PNet.P && !PNet.resume()) return this.start();
    this.npSet = false; PNet.refresh(); this.draw();
  },
  unmount(){ if (PG.custom) Object.values(PG.custom).forEach(c => c.stop && c.stop()); document.documentElement.classList.remove("pg-night"); setTimeout(() => window.dispatchEvent(new Event("chessnat:route")), 0); },
  /* no lobby yet: make one or type a code */
  start(){
    const {T} = PG;
    this.main.innerHTML = `<div class="page pg" data-notr style="max-width:640px"><button class="btn ghost sm" id="lb">← ${T("Games", "Spiele")}</button>${`<h1 class="h-title" style="margin-top:6px">${T("Play together", "Zusammen spielen")}</h1>`}
      <p class="muted">${T("Everyone on their own phone: you host, your friends join by link, QR code or code.", "Jeder auf seinem eigenen Handy: Du bist Gastgeber, deine Freunde kommen per Link, QR-Code oder Code dazu.")}</p>
      <div class="unit"><h3>${T("Host a lobby", "Lobby erstellen")}</h3><p class="pg-sub">${T("Your phone runs the game. Keep the app open.", "Dein Handy steuert das Spiel. Lass die App dabei offen.")}</p><button class="btn go big" id="lh" style="margin-top:10px">${T("Create lobby", "Lobby erstellen")}</button></div>
      <div class="unit"><h3>${T("Join a lobby", "Lobby beitreten")}</h3><form class="pg-add" id="lj" style="margin-top:8px"><input type="text" maxlength="12" placeholder="${T("Code, e.g. K7QXM", "Code, z. B. K7QXM")}" autocapitalize="characters" autocomplete="off" style="text-transform:uppercase;letter-spacing:.12em;font-weight:800"><button class="btn go" type="submit">${T("Join", "Beitreten")}</button></form></div></div>`;
    $("#lb").onclick = () => App.go("games");
    $("#lh").onclick = () => { PNet.host(PG.st.last && PG.online[PG.st.last] ? PG.st.last : "imposter"); this.draw(); };
    $("#lj").onsubmit = e => { e.preventDefault(); const c = e.target.querySelector("input").value.trim().toLowerCase().replace(/[^a-z0-9]/g, ""); if (c.length < 4) return toast(PG.T("Enter the code from the host's screen.", "Gib den Code vom Gastgeber-Handy ein.")); this.ask(c); };
  },
  /* joining: what's your name? */
  ask(code){
    const {T} = PG;
    this.main.innerHTML = `<div class="page pg" data-notr style="max-width:640px"><div class="pg-stage"><div class="pg-who">${T("Lobby", "Lobby")}</div><div class="pg-name" style="letter-spacing:.12em">${esc(code.toUpperCase())}</div>
      <div class="unit" style="width:100%;text-align:left"><h3>${T("Your name", "Dein Name")}</h3><form class="pg-add" id="ln" style="margin-top:8px"><input type="text" maxlength="16" value="${esc(PNet.myName())}" placeholder="${T("Name", "Name")}" autocomplete="off"><button class="btn go" type="submit">${T("Join", "Beitreten")}</button></form></div>
      <p class="pg-hint">${T("You'll see your own card, role and vote on this phone.", "Auf diesem Handy siehst du deine eigene Karte, Rolle und Stimme.")}</p></div></div>`;
    const f = $("#ln"), i = f.querySelector("input"); if (!i.value) i.focus();
    f.onsubmit = e => { e.preventDefault(); const n = i.value.trim().replace(/\s+/g, " "); if (!n) return toast(T("Enter your name.", "Gib deinen Namen ein.")); PNet.join(code, n); this.draw(); };
  },
  draw(){
    const {T, h} = PG, P = PNet.P, main = this.main; if (!P || !main || !main.isConnected) return;
    if (!main.querySelector(".pg-lob")){
      main.innerHTML = `<div class="page pg pg-lob" data-notr style="max-width:640px"><div class="row pg-lbar"><span class="pill" id="lcode"></span><span class="grow"></span><button class="btn ghost sm" id="lleave"></button></div><div id="lbody"></div></div>`;
      const lv = $("#lleave", main); lv.onclick = () => { if (!lv.dataset.armed){ lv.dataset.armed = 1; lv.textContent = T("Sure? Tap again", "Sicher? Nochmal tippen"); setTimeout(() => { if (lv.isConnected){ delete lv.dataset.armed; this.draw(); } }, 3000); return; } PNet.leave(); App.go("games"); };
    }
    const lv = $("#lleave", main); if (!lv.dataset.armed) lv.textContent = P.solo ? T("End", "Beenden") : P.isHost ? T("Close lobby", "Lobby schließen") : T("Leave", "Verlassen");
    const m = P.isHost ? P.msg : P.msg, conn = P.conn && P.conn.live;
    $("#lcode", main).innerHTML = P.solo ? `🤖 ${T("Practice", "Übungsmodus")}` : `<span style="width:8px;height:8px;border-radius:50%;background:${conn ? "var(--go-hi)" : "var(--warn)"};display:inline-block"></span> ${T("Lobby", "Lobby")} <b style="letter-spacing:.1em">${esc(P.code.toUpperCase())}</b>`;
    const body = $("#lbody", main);
    if (!m){ P.t0 = P.t0 || Date.now(); const gone = Date.now() - P.t0 > 12000;
      body.innerHTML = `<div class="pg-stage"><div class="pg-moon">${gone ? "🌑" : "📡"}</div><p class="pg-say">${gone ? T("This lobby isn't there anymore", "Diese Lobby gibt es nicht mehr") : T("Connecting…", "Verbinde…")}<small>${gone ? T("The game is over or the host closed it.", "Das Spiel ist vorbei oder der Gastgeber hat sie geschlossen.") : T("Waiting for the host's phone.", "Warte auf das Handy des Gastgebers.")}</small></p>${gone ? `<button class="btn go big" id="lgone">${T("Back to games", "Zurück zu den Spielen")}</button>` : ""}</div>`; body._json = null;
      const bg = $("#lgone", body); if (bg) bg.onclick = () => { PNet.leave(true); App.go("games"); }; if (!gone) setTimeout(() => { if (PNet.P === P && !P.msg) this.draw(); }, 12500); return; }
    if (!P.isHost && Date.now() - P.last > 15000) toast(T("Lost the host… reconnecting", "Verbindung zum Gastgeber weg… verbinde neu"), 1800);
    if (m.lobby && m.game === "natposter" && !P.solo && !this.npSet && PG.custom.np){ body._json = null; body._lk = null;
      const lv = {custom: "np", k: "lobby", phase: "lobby", round: 0, alive: true, imp: false, mates: [], tasks: [], fake: [], prog: 0, bodies: [], kill: 0, emer: 0, intro: 0, sab: null, sabCd: 0, meet: null, eject: null, deadList: [], bots: (() => { const f = +(m.opts || {}).fill || 0; try { return f && typeof BOTS !== "undefined" ? BOTS.slice(0, f).map((b, i) => ({id: "lb-" + i, name: b.name, av: botCfg(b)})) : []; } catch(e) { return []; } })(), doors: {}, host: P.isHost, lob: {code: P.code, fill: +(m.opts || {}).fill || 0, n: m.players.filter(p => p.on).length, min: (PG.online.natposter || {}).min || 4}};
      PG.custom.np.draw(body, lv, m, a => { if (a.a === "start") PNet.begin(); else if (a.a === "settings"){ this.npSet = true; PG.custom.np.stop(); this.draw(); } else if (a.a === "invite") this.inviteSheet(m); else if (a.a === "look") App.go("me"); });
      return; }
    if (m.lobby){ if (PG.custom) Object.values(PG.custom).forEach(c => c.stop && c.stop()); return this.lobby(body, m); }
    body._lk = null;
    const v = m.views[PNet.me];
    if (v && v.custom && PG.custom && PG.custom[v.custom]){ body._json = null; body._lk = null; PG.custom[v.custom].draw(body, v, m, a => { if (a.a === "lobby"){ PNet.toLobby(); return; } PNet.act(a); }); return; }
    if (PG.custom) Object.values(PG.custom).forEach(c => c.stop && c.stop());
    if (!v){ PView.draw(body, {k: "wait-join", emo: "⏳", say: T("Joining…", "Trete bei…")}, () => {}); return; }
    /* the host also gets a small bar to end the round */
    const hv = P.isHost ? Object.assign({}, v, {hostBack: true}) : v;
    PView.draw(body, hv, a => { if (a.a === "lobby"){ PNet.toLobby(); return; } PNet.act(a); });
  },
  practiceUI(body, m, e, g){
    const {T, h} = PG; document.documentElement.classList.remove("pg-night"); const lk = JSON.stringify(["solo", m.game, m.opts]); if (body._lk === lk && body.querySelector(".pg-solo")) return; body._lk = lk; body._json = null;
    body.innerHTML = `<div class="pg-stage pg-solo"><div class="pg-moon">🤖</div><div class="pg-name">${g ? h(T(g.name[0], g.name[1])) : ""}</div><p class="muted" style="margin:0">${T("Practice with bots", "Üben mit Bots")}</p>
      <div class="unit" style="width:100%;text-align:left;margin:0">${(e.opts || []).filter(o => !o.online).slice().sort((a, b) => (b.solo ? 1 : 0) - (a.solo ? 1 : 0)).map(o => `<div style="margin-top:8px"><div class="pg-who" style="text-align:left">${h(T(o.l[0], o.l[1]))}</div><div class="pg-opt">${(typeof o.c === "function" ? o.c() : o.c).map(([v, l]) => `<button class="btn sm ${String(m.opts[o.k]) === String(v) ? "go" : ""}" data-ok="${o.k}" data-ov="${esc(String(v))}">${h(Array.isArray(l) ? T(l[0], l[1]) : l)}</button>`).join("")}</div></div>`).join("")}</div>
      <button class="btn go big" id="lgo" style="max-width:400px">${T("Play", "Spielen")}</button></div>`;
    $$("[data-ok]", body).forEach(b => b.onclick = () => { const o = e.opts.find(x => x.k === b.dataset.ok), v = (typeof o.c === "function" ? o.c() : o.c).find(c => String(c[0]) === b.dataset.ov)[0]; PNet.setOpt(o.k, v); });
    $("#lgo", body).onclick = () => PNet.begin();
  },
  inviteSheet(m){
    const {T} = PG, P = PNet.P; const sh = detailSheet(`<div style="text-align:center"><div class="pg-qr" id="iqr" style="margin:0 auto"></div><div class="pg-name" style="letter-spacing:.14em;font-size:34px;margin-top:8px">${esc(P.code.toUpperCase())}</div>
      <button class="btn go" id="ish" style="margin:8px 0">${icon("send", 16)} ${T("Share link", "Link teilen")}</button></div><div id="ifl" class="list"></div>`);
    PG.qr(PNet.link(P.code)).then(svg => { const q = sh.el.querySelector("#iqr"); if (q) q.innerHTML = svg; });
    sh.el.querySelector("#ish").onclick = async () => { const url = PNet.link(P.code); try { if (navigator.share){ await navigator.share({title: "Natposter", url}); return; } } catch(e) { if (e && e.name === "AbortError") return; } try { await navigator.clipboard.writeText(url); toast(T("Link copied", "Link kopiert")); } catch(e) {} };
    const fl = sh.el.querySelector("#ifl"); if (fl) PG.friendList(fl, P.code, m.game, m.players.map(p => p.uid).filter(Boolean));
  },
  lobby(body, m){
    const {T, h} = PG, P = PNet.P, isH = P.isHost, e = PG.online[m.game], g = PG.games.find(x => x.id === m.game);
    if (P.solo) return this.practiceUI(body, m, e, g);
    document.documentElement.classList.remove("pg-night"); body._json = null;
    const lk = JSON.stringify([m.players, m.game, m.opts, isH, P.code]); if (body._lk === lk && body.querySelector(".pg-pls")) return; body._lk = lk;
    const online = m.players.filter(p => p.on), need = e ? Math.max(1, e.min - (e.extra ? e.extra(Object.assign({}, PNet.defaults(m.game), m.opts || {}), false) : 0)) : 2;
    body.innerHTML = `<div class="pg-stage" style="padding-top:4px">
      ${isH ? `<div class="unit pg-inv" style="width:100%;margin:0"><div class="pg-qr" id="lqr"></div><div style="flex:1;min-width:0;text-align:left"><div class="pg-who">${T("Join code", "Beitritts-Code")}</div><div class="pg-name" style="letter-spacing:.14em;font-size:38px">${esc(P.code.toUpperCase())}</div>
          <p class="pg-sub">${T("Scan the QR code with the camera, or open chess-nat.vercel.app → Games → Join.", "QR-Code mit der Kamera scannen oder chess-nat.vercel.app → Spiele → Beitreten.")}</p>
          <div class="row" style="margin-top:8px"><button class="btn go sm" id="lshare">${icon("send", 16)} ${T("Share link", "Link teilen")}</button></div></div></div>`
        : `<div class="pg-who">${T("You're in", "Du bist drin")}</div><div class="pg-name">${h(m.players.find(p => p.id === PNet.me) ? m.players.find(p => p.id === PNet.me).name : P.name)}</div>`}
      <div class="unit" style="width:100%;text-align:left;margin:0"><h3>${T("Players", "Spieler")} <span class="muted" style="font:700 14px var(--body)">${online.length}</span></h3>
        <div class="pg-pls">${m.players.map(p => `<span class="pg-chip" style="${p.on ? "" : "opacity:.45"}"><i style="width:8px;height:8px;border-radius:50%;background:${p.on ? "var(--go-hi)" : "var(--dim)"};display:inline-block"></i><span>${h(p.name)}${p.id === m.host ? " 👑" : ""}</span>${p.uid && typeof Social !== "undefined" && Social.me && p.uid !== Social.me && Social.rel(p.uid) === "none" ? `<button data-fr="${esc(p.uid)}" title="${T("Add friend", "Als Freund hinzufügen")}" style="width:auto;padding:0 8px;border-radius:999px;color:var(--go-hi)">+ ${T("Friend", "Freund")}</button>` : ""}${isH && p.id !== PNet.me ? `<button data-kick="${esc(p.id)}" aria-label="${T("Remove", "Entfernen")}">×</button>` : ""}</span>`).join("")}</div>
        ${online.length < need ? `<p class="pg-sub">${T("Waiting for the others to join…", "Warte, bis die anderen beitreten…")}</p>` : ""}</div>
      ${typeof Social !== "undefined" && Social.me ? `<div class="unit" style="width:100%;text-align:left;margin:0"><h3>${T("Invite friends", "Freunde einladen")}</h3><p class="pg-sub">${T("Like a puzzle duel: they get a notification and land right here.", "Wie beim Puzzle-Duell: Sie bekommen eine Benachrichtigung und landen direkt hier.")}</p><div id="lfl" class="list" style="margin-top:6px"></div></div>` : ""}
      ${isH ? `<div class="unit" style="width:100%;text-align:left;margin:0"><h3>${T("Game", "Spiel")}</h3><div class="grid2" style="margin-top:8px">${Object.keys(PG.online).map(id => { const gg = PG.games.find(x => x.id === id); return gg ? `<button class="btn ${id === m.game ? "go" : ""}" data-g="${id}" style="justify-content:flex-start;gap:8px">${icon(gg.icon, 20)}<span style="text-align:left">${h(T(gg.name[0], gg.name[1]))}</span></button>` : ""; }).join("")}</div>
          ${e && e.opts && e.opts.length ? e.opts.filter(o => !o.solo).map(o => `<div style="margin-top:12px"><div class="pg-who" style="text-align:left">${h(T(o.l[0], o.l[1]))}</div><div class="pg-opt">${(typeof o.c === "function" ? o.c() : o.c).map(([v, l]) => `<button class="btn sm ${String(m.opts[o.k]) === String(v) ? "go" : ""}" data-ok="${o.k}" data-ov="${esc(String(v))}">${h(Array.isArray(l) ? T(l[0], l[1]) : l)}</button>`).join("")}</div></div>`).join("") : ""}
          ${e && e.note ? `<p class="pg-sub" style="margin-top:10px">${h(T(e.note[0], e.note[1]))}</p>` : ""}
          ${m.game === "natposter" ? `<button class="btn big" id="lnp" style="margin-top:14px;width:100%">🚀 ${T("Back to the station", "Zurück zur Station")}</button>` : ""}
          <button class="btn go big" id="lgo" style="margin-top:14px" ${online.length < need ? "disabled" : ""}>${online.length < need ? T(`${need} players needed`, `Mindestens ${need} Spieler`) : T("Start", "Los geht's")}</button></div>`
        : `${m.game === "natposter" ? `<button class="btn go big" id="lnp" style="width:100%">🚀 ${T("Back to the station", "Zurück zur Station")}</button>` : ""}<div class="pg-big" style="min-height:0">${g ? icon(g.icon, 40) : ""}<span class="k">${T("Next game", "Nächstes Spiel")}</span><div class="q">${g ? h(T(g.name[0], g.name[1])) : "…"}</div><p class="pg-hint" style="margin:0">${T("The host starts the game. Keep this screen open.", "Der Gastgeber startet das Spiel. Lass diesen Bildschirm offen.")}</p></div>`}
    </div>`;
    const bn2 = !isH && $("#lnp", body); if (bn2) bn2.onclick = () => { this.npSet = false; body._lk = null; this.draw(); };
    const fl = $("#lfl", body); if (fl) PG.friendList(fl, P.code, m.game, m.players.map(p => p.uid).filter(Boolean));
    $$("[data-fr]", body).forEach(b => b.onclick = async () => { b.disabled = true; await Social.request(b.dataset.fr); b.textContent = "✓"; });
    if (isH){
      const qr = $("#lqr", body); PG.qr(PNet.link(P.code)).then(svg => { if (qr.isConnected) qr.innerHTML = svg; });
      $("#lshare", body).onclick = async () => { const url = PNet.link(P.code), txt = T(`Join my ${g ? T(g.name[0], g.name[1]) : "game"} lobby on Chess.nat: `, `Komm in meine ${g ? T(g.name[0], g.name[1]) : "Spiele"}-Lobby auf Chess.nat: `);
        try { if (navigator.share){ await navigator.share({title: "Chess.nat", text: txt, url}); return; } } catch(err) { if (err && err.name === "AbortError") return; }
        try { await navigator.clipboard.writeText(url); toast(T("Link copied", "Link kopiert")); } catch(err) { prompt("Link", url); } };
      $$("[data-g]", body).forEach(b => b.onclick = () => PNet.setGame(b.dataset.g));
      $$("[data-ok]", body).forEach(b => b.onclick = () => { const o = e.opts.find(x => x.k === b.dataset.ok), v = (typeof o.c === "function" ? o.c() : o.c).find(c => String(c[0]) === b.dataset.ov)[0]; PNet.setOpt(o.k, v); });
      $$("[data-kick]", body).forEach(b => b.onclick = () => PNet.kick(b.dataset.kick));
      const go = $("#lgo", body); if (go) go.onclick = () => PNet.begin();
      const bn = $("#lnp", body); if (bn) bn.onclick = () => { this.npSet = false; body._lk = null; this.draw(); };
    }
  }
};

/* ---- QR code (vendor/qrcode.js, loaded the first time it's needed) ---- */
PG.qr = (() => { let lib = null;
  const load = () => lib || (lib = new Promise((res, rej) => { if (window.qrcode) return res(); const s = document.createElement("script"); s.src = "vendor/qrcode.js?v=1"; s.onload = res; s.onerror = rej; document.head.appendChild(s); }));
  return async text => { try { await load(); const q = qrcode(0, "M"); q.addData(text); q.make(); const n = q.getModuleCount(); let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
    return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges" aria-label="QR"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#262421"/></svg>`; } catch(e) { return ""; } }; })();

/* ---- invite friends, right in the lobby: the same invite as for a chess game or a puzzle duel ---- */
const pgInvited = {};
PG.friendList = (box, code, game, inLobby) => {
  const {T, h} = PG; if (typeof Social === "undefined" || !Social.me) return;
  const me = Social.me, ids = Social.data.friends.filter(r => r.status === "accepted").map(r => r.a === me ? r.b : r.a).filter(id => !inLobby.includes(id));
  ids.sort((a, b) => (Social.isOnline(Social.P(b)) ? 1 : 0) - (Social.isOnline(Social.P(a)) ? 1 : 0));
  box.innerHTML = ids.map(id => { const p = Social.P(id), on = Social.isOnline(p), done = pgInvited[code + id];
    return `<div class="li">${Social.face ? Social.face(p, 34) : ""}<div class="grow"><div class="t">${h(p.name)}</div><div class="s" style="${on ? "color:var(--go-hi)" : ""}">${on ? "● " + T("online", "online") : T("offline", "offline")}</div></div><button class="btn sm ${done ? "" : "go"}" data-inv="${esc(id)}" ${done ? "disabled" : ""}>${done ? T("Invited ✓", "Eingeladen ✓") : T("Invite", "Einladen")}</button></div>`; }).join("")
    || `<p class="muted" style="margin:4px 0">${T("All your friends are here, or you have none yet. Share the link or the QR code.", "Alle deine Freunde sind schon da oder du hast noch keine. Teil den Link oder den QR-Code.")}</p>`;
  $$("[data-inv]", box).forEach(b => b.onclick = async () => { b.disabled = true;
    const {error} = await Social.sb.from("chess_invites").insert({from_id: me, to_id: b.dataset.inv, code, tc: ("p:" + game).slice(0, 12)});
    if (error){ b.disabled = false; toast(T("Couldn't send: ", "Ging nicht: ") + error.message, 3500); return; }
    pgInvited[code + b.dataset.inv] = 1; b.textContent = T("Invited ✓", "Eingeladen ✓"); b.classList.remove("go"); PG.vib(15); });
};

/* ---- links: #p-CODE opens the lobby (at start and while the app is open) ---- */
(() => {
  const c = PNet.fromHash(location.hash);
  if (c){ window.__pgJoin = c; try { history.replaceState(null, "", "#lobby"); } catch(e) {} }
  window.addEventListener("hashchange", () => { if (document.documentElement.classList.contains("np-on")) return; const k = PNet.fromHash(location.hash); if (k) App.go("lobby", {join: k}); });
  Object.assign(TAB_OF, {lobby: "games"});
  const css = `.pg-lbar{gap:8px;align-items:center;margin-bottom:6px}
.pg-inv{display:flex;gap:14px;align-items:center}
.pg-qr{width:132px;height:132px;flex:0 0 auto;background:#fff;border-radius:10px;padding:6px}
.pg-qr svg{width:100%;height:100%;display:block}
.pg-btns{display:flex;flex-direction:column;gap:8px;width:100%;max-width:400px;align-items:stretch}
.pg-btns.two{display:grid;grid-template-columns:1fr 1fr}
.pg-badb{background:var(--bad)!important;color:#fff!important;box-shadow:inset 0 -4px 0 rgba(0,0,0,.25)!important}
.pg-big.pg-bad{background:#E2523E;color:#fff}.pg-big.pg-bad .k{color:rgba(255,255,255,.8)}
.pg-big.pg-light{background:#F4F2EE;color:#262421}.pg-big.pg-light .k{color:#6b665f}
.pg-card.mini{width:min(150px,40vw);margin-top:6px}.pg-card.mini .big{font-size:20px}.pg-card.mini .em{font-size:34px}.pg-card.mini .sm{font-size:11.5px;line-height:1.3}.pg-card.mini .f,.pg-card.mini .b{padding:10px;gap:4px}.pg-card.mini .pg-cardtag{font-size:12px;padding:6px 10px}
.pg-pill{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--tab-h,0px) + env(safe-area-inset-bottom,0px) + 12px);z-index:2500;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:11px 18px;background:var(--go);color:#fff;font:800 15px var(--body);box-shadow:0 8px 22px rgba(0,0,0,.45),inset 0 -3px 0 var(--go-deep);cursor:pointer;white-space:nowrap}
@media (min-width:901px){.pg-pill{bottom:20px}}
@media (max-width:420px){.pg-inv{flex-direction:column;text-align:center}.pg-inv>div{text-align:center!important}.pg-inv .row{justify-content:center}}`;
  const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
})();
