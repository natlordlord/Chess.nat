/* Chess.nat service worker: lets the home-screen app start instantly and work offline.
   - Page and app code (index, config.js, platform.js, pwa.js, *index.json): network first, so every
     launch with a connection gets the newest version; the cached copy is only the offline fallback.
   - Static files (vendor, engine, sounds, icons, puzzle buckets, fonts): served from the cache and
     refreshed in the background.
   - Supabase (login, saves, live games) and the coach voice clips are never touched.
   Bump VERSION to throw away all cached files. */
const VERSION = "chessnat-v1";
const SHELL = [
  "/", "/config.js", "/platform.js", "/pwa.js", "/manifest.webmanifest", "/favicon.svg",
  "/vendor/chess.js", "/vendor/supabase.js", "/engine/sf.js",
  "/puzzles/index.json", "/voice/index.json",
  "/icons/icon-192.png", "/icons/apple-touch-icon.png",
  "/sounds/Move.mp3", "/sounds/Capture.mp3", "/sounds/Check.mp3",
  "/sounds/Victory.mp3", "/sounds/Defeat.mp3", "/sounds/GenericNotify.mp3"
];
const FRESH = /^\/(config\.js|platform\.js|pwa\.js|manifest\.webmanifest|puzzles\/index\.json|voice\/index\.json)$/;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u =>
    fetch(u, {cache: "reload"}).then(r => { if (r.ok) return c.put(u, r); }).catch(() => {})
  ))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const keep = (req, res) => {
  if (res && res.ok && (res.type === "basic" || res.type === "cors")){
    const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
  }
  return res;
};

/* waitMs: on a very slow connection, fall back to the cached copy after this long (the network
   answer still refreshes the cache for the next launch) */
async function networkFirst(req, key, waitMs){
  const k = key || req;
  const net = fetch(req).then(res => {
    if (res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(k, copy)); }
    return res;
  });
  const cached = () => caches.match(k);
  if (waitMs){
    const slow = new Promise(r => setTimeout(r, waitMs)).then(cached);
    const first = await Promise.race([net.catch(() => null), slow]);
    if (first) return first;
  }
  try { return await net; }
  catch (err) { const hit = await cached(); if (hit) return hit; throw err; }
}

async function cacheFirstRefresh(req, e){
  const hit = await caches.match(req);
  const net = fetch(req).then(res => keep(req, res));
  if (hit){ e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);

  if (url.origin === location.origin){
    if (req.mode === "navigate") return e.respondWith(networkFirst(req, "/", 4000));
    if (url.pathname === "/sw.js" || url.pathname.startsWith("/voice/") && url.pathname.endsWith(".mp3")) return;
    if (FRESH.test(url.pathname)) return e.respondWith(networkFirst(req));
    return e.respondWith(cacheFirstRefresh(req, e));
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com"){
    return e.respondWith(cacheFirstRefresh(req, e));
  }
  // everything else (Supabase, Lichess links, …) goes straight to the network
});
