/* ===== Chess.nat as a home-screen app =====
   - registers the service worker (fast start, works offline)
   - marks <html class="app-mode"> when started from the home screen, so the CSS can behave like an app
   - in app mode: no pinch/double-tap zoom, no rubber-band, sound comes back after the app was in the background
   - in Safari on iPhone/iPad: a one-time hint how to put Chess.nat on the home screen
   - in Chrome/Edge/Android: an "Install" button using the browser's own prompt */
(function(){
  const isApp = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
  const height = () => window.innerHeight;
  window.ChessApp = {isApp, isIOS, height};
  if (isApp){
    document.documentElement.classList.add("app-mode");
    // like a native app: the page never zooms, also not when a text field gets the focus
    const vp = document.querySelector('meta[name="viewport"]');
    if (vp) vp.content = "width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover";
    // solid bar behind the status bar, so iOS 26 doesn't draw its blur over the top of the app
    const edge = () => { if (!document.querySelector(".edge-top")){ const d = document.createElement("div"); d.className = "edge-top"; d.setAttribute("aria-hidden", "true"); document.body.appendChild(d); } };
    if (document.body) edge(); else document.addEventListener("DOMContentLoaded", edge);
    // when the keyboard closes, iOS can leave the page shifted: snap back
    document.addEventListener("focusout", () => setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) window.scrollTo(0, 0); }, 100));
  }

  /* ---- service worker ---- */
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")){
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").then(reg => {
        // look for a new version whenever the app comes back to the front
        document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
      }).catch(() => {});
    });
  }

  /* ---- app behaviour ---- */
  if (isApp){
    // iOS ignores user-scalable=no, so stop the zoom gestures directly (only in the app, the website stays zoomable)
    ["gesturestart", "gesturechange", "gestureend"].forEach(t => document.addEventListener(t, e => e.preventDefault(), {passive: false}));
    // iOS suspends audio while the app is in the background; wake it on the next touch
    const wake = () => { try { if (typeof Sound !== "undefined" && Sound.ac && Sound.ac.state !== "running") Sound.ac.resume(); } catch(e) {} };
    document.addEventListener("visibilitychange", () => { if (!document.hidden) document.addEventListener("pointerdown", wake, {once: true}); });
    // links to other websites open in the browser instead of replacing the app
    document.addEventListener("click", e => {
      const a = e.target.closest && e.target.closest("a[href]"); if (!a) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin && !a.target){ a.target = "_blank"; a.rel = "noopener"; }
    }, true);
  }

  /* ---- install (website only) ----
     Android/Chrome/Edge: the browser's own install prompt, kept so a button anywhere in the app can use it.
     iPhone: Share → Add to Home Screen. Others: how to find "Install" in the browser menu. */
  const isAndroid = /Android/i.test(ua);
  const Install = window.ChessInstall = {ev: null, isApp, isIOS, isAndroid,
    can(){ return !isApp; },
    async run(){
      if (this.ev){ const e = this.ev; this.ev = null; e.prompt(); try { await e.userChoice; } catch(x) {} return; }
      const steps = isIOS ? `<li>Open chess-nat.vercel.app in <b>Safari</b></li><li>Tap ${shareIcon} <b>Share</b></li><li>Tap <b>Add to Home Screen</b></li>`
        : isAndroid ? `<li>Open chess-nat.vercel.app in <b>Chrome</b></li><li>Tap <b>⋮</b> at the top right</li><li>Tap <b>Install app</b> (or <b>Add to Home screen</b>)</li>`
        : `<li>In Chrome or Edge, click the <b>install icon</b> at the right end of the address bar</li><li>or open the browser menu and choose <b>Install Chess.nat</b></li>`;
      if (typeof detailSheet === "function") detailSheet(`<div style="text-align:center"><img src="/icons/icon-192.png" alt="" width="64" height="64" style="border-radius:16px"><div style="font:900 21px var(--display);margin-top:8px">Get the app</div><p class="muted" style="margin:6px 0 0">Full screen, on your home screen, with notifications.</p></div><ol style="margin:12px 0 0;padding-left:20px;line-height:1.7">${steps}</ol>`);
    }};
  if (isApp) return;
  const KEY = "chessnat-install-hint";
  /* the banner comes back a week after it was closed */
  let seen = false; try { const t = +localStorage.getItem(KEY) || 0; seen = t > 1 && Date.now() - t < 7 * 864e5 || localStorage.getItem(KEY) === "1" && false; } catch(e) {}
  const dismiss = el => { el.remove(); try { localStorage.setItem(KEY, String(Date.now())); } catch(e) {} };
  const shareIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>`;
  function banner(html, action){
    const el = document.createElement("div"); el.className = "install-hint"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Install Chess.nat");
    el.innerHTML = `<img src="/icons/icon-192.png" alt="" width="40" height="40"><div class="ih-t">${html}</div>${action ? `<button class="btn go sm" type="button" data-act>${action}</button>` : ""}<button class="ih-x" type="button" aria-label="Close">×</button>`;
    el.querySelector(".ih-x").onclick = () => dismiss(el);
    document.body.appendChild(el); return el;
  }
  const onb = () => window.Onboard && window.Onboard.active();
  if (isIOS && isSafari && !seen){
    setTimeout(() => !onb() && banner(`<b>Get the app</b><span>Tap ${shareIcon} Share, then <b>Add to Home Screen</b>.</span>`), 2500);
  }
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); Install.ev = e; if (seen || onb() || document.querySelector(".install-hint")) return;
    const el = banner(`<b>Install Chess.nat</b><span>Play full screen from your home screen.</span>`, "Install");
    el.querySelector("[data-act]").onclick = () => { Install.ev = null; e.prompt(); e.userChoice.finally(() => dismiss(el)); };
  });
  if (isAndroid && !seen) setTimeout(() => { if (!onb() && !Install.ev && !document.querySelector(".install-hint")) { const el = banner(`<b>Get the app</b><span>Tap <b>⋮</b> in Chrome, then <b>Install app</b>.</span>`); } }, 6000);
  window.addEventListener("appinstalled", () => { const el = document.querySelector(".install-hint"); if (el) dismiss(el); });
})();
