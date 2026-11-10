/* Chess.nat service worker: lets the home-screen app start instantly and work offline.
   - Page and app code (index, config.js, platform.js, pwa.js, *index.json): network first, so every
     launch with a connection gets the newest version; the cached copy is only the offline fallback.
   - Static files (vendor, engine, sounds, icons, puzzle buckets, fonts): served from the cache and
     refreshed in the background.
   - Supabase (login, saves, live games) and the coach voice clips are never touched.
   Bump VERSION to throw away all cached files. */
const VERSION = "chessnat-v33";
const SHELL = [
  "/", "/config.js", "/platform.js", "/pwa.js", "/manifest.webmanifest", "/favicon.svg",
  "/vendor/chess.js", "/vendor/supabase.js", "/vendor/three.min.js", "/engine/sf.js",
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

/* push: show it, put the flame on the icon, and open the right screen on tap */
const IOS_SW = /iPhone|iPad|iPod|Macintosh/.test(self.navigator.userAgent) && /Safari/.test(self.navigator.userAgent) && !/Chrome|CriOS|Android/.test(self.navigator.userAgent);
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch(_) { d = {title: "Chess.nat", body: e.data ? e.data.text() : ""}; }
  /* the app is open and in front: it shows its own card, so no phone notification (Android and desktop; on iPhone the server already holds it back) */
  if (!IOS_SW && d.kind !== "test") return e.waitUntil(self.clients.matchAll({type: "window", includeUncontrolled: true}).then(cs => {
    if (cs.some(c => c.visibilityState === "visible" && c.focused)) return;
    return showIt(d);
  }));
  e.waitUntil(showIt(d));
});
function showIt(d){
  const jobs = [self.registration.showNotification(d.title || "Chess.nat", {body: d.body || "", icon: "/icons/icon-192.png", badge: "/icons/badge-96.png", vibrate: [60, 40, 60], tag: d.tag || d.kind || "chessnat", renotify: true, data: {url: d.url || "/"}})];
  /* the icon number counts the notifications waiting for you (not your flame); opening the app clears it */
  return Promise.all(jobs).then(() => self.navigator && self.navigator.setAppBadge ? self.registration.getNotifications().then(ns => self.navigator.setAppBadge(ns.length || 1)).catch(() => {}) : null);
}
self.addEventListener("notificationclick", e => {
  e.notification.close(); const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({type: "window", includeUncontrolled: true}).then(cs => {
    for (const c of cs) if (c.url.startsWith(self.location.origin)){ c.postMessage({nav: url}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
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
