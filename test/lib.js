/* Shared helpers for the browser tests: start the stand-in database, open the app as a signed-in test person on a phone-sized screen,
   and keep a list of everything that went wrong (page errors, console errors, failed requests, database errors). */
const path = require("path"), fs = require("fs");
let playwright; try { playwright = require("playwright"); } catch(e) { playwright = require(path.join(require("child_process").execSync("npm root -g").toString().trim(), "playwright")); }
const fake = require("./fake-supabase/server");
const PORT = Number(process.env.PORT || 4188), BASE = "http://localhost:" + PORT, OUT = process.env.SHOTS || path.join(__dirname, "out");

async function start(){
  await new Promise(ok => fake.server.listen(PORT, ok)); fs.mkdirSync(OUT, {recursive: true});
  const browser = await playwright.chromium.launch({executablePath: process.env.CHROME || (fs.existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined), args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"]});
  return {browser, stop: async () => { await browser.close(); await new Promise(ok => fake.server.close(ok)); fake.server.closeAllConnections && fake.server.closeAllConnections(); }};
}
/* 12 seconds of quiet sound as a WAV file, 8 kHz, 8 bit */
const WAV = (() => { const n = 8000 * 12, b = Buffer.alloc(44 + n, 128); b.write("RIFF", 0); b.writeUInt32LE(36 + n, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(8000, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write("data", 36); b.writeUInt32LE(n, 40);
  for (let i = 0; i < n; i++) b[44 + i] = 128 + Math.round(3 * Math.sin(i / 8)); return b; })();
/* artists the game has asked for: the library knows their songs too */
const ARTS = new Set();
const SONGS = {Queen: [["Bohemian Rhapsody (Remastered 2011)", "1975"], ["Don't Stop Me Now", "1978"], ["Another One Bites the Dust", "1980"], ["We Will Rock You", "1977"], ["Radio Ga Ga", "1984"], ["Under Pressure", "1981"]],
  Nena: [["99 Luftballons", "1983"], ["Irgendwie, irgendwo, irgendwann", "1984"], ["Leuchtturm", "1983"]], "a-ha": [["Take On Me", "1985"], ["The Sun Always Shines on T.V.", "1985"], ["Hunting High and Low", "1985"]]};
/* a phone (iPhone-sized, touch, German, Berlin time) with that person already signed in; who = null → not signed in */
async function open(browser, who, {route = "", desktop = false, app = true, seasoned = true, before} = {}){
  const ctx = await browser.newContext(Object.assign({locale: "de-DE", timezoneId: "Europe/Berlin", serviceWorkers: "block", permissions: ["microphone", "camera", "notifications"]},
    desktop ? {viewport: {width: 1280, height: 800}} : {viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"}));
  const page = await ctx.newPage(), bad = []; page.bad = bad; page.who = who || "guest";
  page.on("pageerror", e => bad.push({kind: "Fehler im Code", text: String(e.message || e), stack: String(e.stack || "").split("\n").slice(0, 4).join(" | ")}));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) bad.push({kind: "Konsole", text: m.text().slice(0, 400)}); });
  page.on("response", r => { const u = r.url(); if (r.status() >= 400 && u.startsWith(BASE) && !/favicon|apple-touch/.test(u)) bad.push({kind: "Anfrage " + r.status(), text: r.request().method() + " " + decodeURIComponent(u.slice(BASE.length)).slice(0, 300)}); });
  /* the barcode lookup goes straight to Open Food Facts from the phone: answer it from the stand-in */
  await page.route(/^https?:\/\/(?!localhost)/, r => r.abort());   /* nothing leaves the machine */
  /* Song raten: Apple's song search answers from a small fixed list; the 30-second previews are one of the app's own sounds.
     The song's title is in its preview address, so a test knows which song is playing */
  await page.route(/itunes\.apple\.com\/search/, r => { const u = new URL(r.request().url()), term = u.searchParams.get("term") || "", cb = u.searchParams.get("callback") || "cb";
    const id = s => Math.abs([...s].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7)), hits = a => SONGS[a] || [1, 2, 3, 4, 5].map(i => [a + " Hit " + i, "2015"]);
    const song = (a, [t, y]) => ({wrapperType: "track", trackId: id(a + t), trackName: t, artistName: a, previewUrl: "https://audio-ssl.itunes.apple.com/fake/" + encodeURIComponent(t) + ".m4a", artworkUrl100: null, artworkUrl60: null, releaseDate: y + "-01-01T08:00:00Z"});
    let results;
    /* an artist's songs (the quiz) */
    if (u.searchParams.get("attribute") === "artistTerm"){ ARTS.add(term); results = hits(term).map(x => song(term, x)); }
    else { /* the song library: any song or artist containing the typed text */
      const q = term.toLowerCase(), m = /^(.+?) hit\b/i.exec(term), cat = Object.keys(SONGS).flatMap(a => SONGS[a].map(x => [a, x])).concat(m ? hits(m[1]).map(x => [m[1], x]) : []).concat([...ARTS].filter(a => !SONGS[a]).flatMap(a => hits(a).map(x => [a, x])));
      /* every word of the search somewhere in title or artist ("Bohemian Rhapsody Queen", "Radi") */
      const W = q.split(/\s+/).filter(Boolean), L = cat.filter(([a, [t]]) => W.every(w => (t + " " + a).toLowerCase().replace(/[^a-z0-9äöü ]/g, "").includes(w.replace(/[^a-z0-9äöü]/g, ""))));
      results = u.searchParams.get("entity") === "musicArtist" ? [...new Set(L.map(x => x[0]).concat(L.length ? [] : [term]))].map(a => ({wrapperType: "artist", artistName: a, artistId: id(a)})) : L.map(([a, x]) => song(a, x)); }
    r.fulfill({status: 200, contentType: "text/javascript", body: cb + "(" + JSON.stringify({resultCount: results.length, results}) + ")"}); });
  /* the previews: 12 quiet seconds (long enough to see a clip start, stop and start again) */
  /* with byte ranges like the real server, so a player can jump to a point in the song */
  await page.route(/audio-ssl\.itunes\.apple\.com\/fake\//, r => { const m = /bytes=(\d+)-(\d*)/.exec(r.request().headers().range || "");
    if (!m) return r.fulfill({status: 200, contentType: "audio/wav", headers: {"accept-ranges": "bytes"}, body: WAV});
    const a = +m[1], b = m[2] ? Math.min(+m[2], WAV.length - 1) : WAV.length - 1; return r.fulfill({status: 206, contentType: "audio/wav", headers: {"accept-ranges": "bytes", "content-range": `bytes ${a}-${b}/${WAV.length}`}, body: WAV.subarray(a, b + 1)}); });
  await page.route(/world\.openfoodfacts\.org\/api\/v2\/product\//, async r => { const code = /product\/(\d+)/.exec(r.request().url())[1]; const j = await (await fetch(BASE + "/__fake/off?code=" + code)).text(); r.fulfill({status: 200, contentType: "application/json", body: j}); });
  if (who){ const s = await (await fetch(BASE + "/__fake/session?u=" + who)).json(); await ctx.addInitScript(v => { try { if (!sessionStorage.getItem("fake-out")) localStorage.setItem("sb-localhost-auth-token", v); } catch(e) {} }, JSON.stringify(s)); }
  /* on the phone it runs from the home screen: say so, otherwise the "add to home screen" page covers everything */
  if (!desktop && app) await ctx.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, "standalone", {get: () => true}); } catch(e) {} });
  /* this person has used the app before: the first-start screens are done */
  if (seasoned) await ctx.addInitScript(() => { try { localStorage.setItem("chessnat-onb", "done"); localStorage.setItem("chessnat-mic", "1"); if (!sessionStorage.getItem("fake-wrap")) localStorage.setItem("chessnat-kc-wrap", String(Date.now())); } catch(e) {} });
  /* count what makes a screen flicker: the fade-in starting again, and the page being rebuilt */
  await ctx.addInitScript(() => { window.__fx = {fades: 0, rebuilds: 0}; document.addEventListener("animationstart", e => { if (e.animationName === "pageIn") window.__fx.fades++; }, true);
    addEventListener("DOMContentLoaded", () => { const m = document.querySelector("#main"); if (m) new MutationObserver(ms => { if (ms.some(x => x.target === m && x.addedNodes.length)) window.__fx.rebuilds++; }).observe(m, {childList: true}); }); });
  if (before) Array.isArray(before) ? await ctx.addInitScript(before[0], before[1]) : await ctx.addInitScript(before);
  await page.goto(BASE + "/" + route); await page.waitForFunction(() => typeof App !== "undefined" && App.view && document.querySelector("#main") && document.querySelector("#main").children.length > 0, null, {timeout: 20000});
  await page.waitForTimeout(900);
  page.shot = async name => { const f = path.join(OUT, name + ".png"); await page.screenshot({path: f}); return f; };
  return page;
}
const problems = async () => (await fetch(BASE + "/__fake/problems")).json();
const table = async (t, q = "") => (await fetch(BASE + "/__fake/table/" + t + (q ? "?" + q : ""))).json();
const stage = async (method, t, q, body) => (await fetch(BASE + "/__fake/table/" + t + (q ? "?" + q : ""), {method, headers: {"content-type": "application/json"}, body: JSON.stringify(body)})).json();
module.exports = {start, open, problems, table, stage, BASE, OUT, fake, SONGS, ID: require("./fake-supabase/seed").ID};
