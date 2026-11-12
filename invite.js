/* ===== Einladungsfilm: chess-nat.vercel.app/?ref=<handle>#invite
   Läuft hochkant wie ein Spot von selbst durch, gebaut aus den echten Teilen der App (Brett, Figuren, Avatare, Ränge,
   Kalorien-Kacheln, Spiele-Kacheln, Freunde-Zeile, Ideen, Trophäen). Erzählstimme aus invite/voice/s<N>.mp3 mit
   wortgenauen Untertiteln (invite/voice/timing.json, erzeugt von invite/narrate.py); Nathans Sprüche aus sounds/lines
   als Ausrufe. Tippen rechts = weiter, links = zurück. Der Film merkt sich ref und führt in die App. ===== */
const Invite = (() => {
  const W = 1080, H = 1920;
  const h = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const LINE = id => "sounds/lines/" + id + ".mp3?v=3";
  const UP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
  const MIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`;
  const CODE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M8 8v8M11 8v8M14 8v8M17 8v8"/></svg>`;
  const CHEF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h16v2a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7z"/><path d="M8 4c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3M16 4c0 1.5 1 1.5 1 3"/></svg>`;
  const CAM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10l5-3v10l-5-3z"/></svg>`;

  const CSS = `
.inv{position:fixed;inset:0;z-index:5000;background:#141312;color:var(--fg);font-family:var(--display);user-select:none;-webkit-user-select:none;overflow:hidden}
.inv .st{position:absolute;left:50%;top:50%;width:${W}px;height:${H}px;transform:translate(-50%,-50%) scale(var(--s,1));background:var(--bg);overflow:hidden;border-radius:44px;box-shadow:0 0 0 1px #000,0 40px 120px rgba(0,0,0,.7)}
@media (max-aspect-ratio:9/16){.inv .st{border-radius:0;box-shadow:none}}
.inv .iv-bars{position:absolute;left:36px;right:36px;top:calc(28px + var(--sat,0px));display:flex;gap:8px;z-index:30}
.inv .iv-bars i{flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,.22);overflow:hidden}.inv .iv-bars i b{display:block;height:100%;width:0;background:#fff}
.inv .iv-brand{position:absolute;left:36px;top:calc(58px + var(--sat,0px));z-index:30;display:flex;align-items:center;gap:14px;font:900 40px var(--display);letter-spacing:-.02em}.inv .iv-brand svg{width:52px;height:52px}.inv .iv-brand b{color:var(--go-hi)}
.inv .iv-mute{position:absolute;right:36px;top:calc(50px + var(--sat,0px));z-index:30;width:72px;height:72px;border-radius:50%;border:0;background:rgba(0,0,0,.35);color:#fff;display:grid;place-items:center;font-size:34px;cursor:pointer}
.inv .iv-skip{position:absolute;right:36px;bottom:calc(40px + var(--sab,0px));z-index:30;border:0;background:rgba(0,0,0,.35);color:#fff;font:800 26px var(--display);padding:16px 26px;border-radius:999px;cursor:pointer}
.inv .iv-tap{position:absolute;inset:0;z-index:20;display:grid;grid-template-columns:1fr 2fr}
.inv .iv-sub{position:absolute;left:60px;right:60px;top:calc(150px + var(--sat,0px));z-index:25;text-align:center;font:800 40px/1.25 var(--display);color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.7),0 0 24px rgba(0,0,0,.5);text-wrap:balance}
.inv .iv-sub span{opacity:.38;transition:opacity .12s}.inv .iv-sub span.said{opacity:1}.inv .iv-sub span.now{opacity:1;color:var(--go-hi)}
.inv .iv-pop{position:absolute;left:50%;top:50%;z-index:26;transform:translate(-50%,-50%) scale(0);font:900 170px/1 var(--display);letter-spacing:-.04em;color:#fff;text-shadow:0 10px 0 var(--go-deep),0 30px 60px rgba(0,0,0,.6);white-space:nowrap;pointer-events:none}
.inv .iv-pop.in{animation:invPop 1.1s cubic-bezier(.2,.8,.2,1) forwards}
@keyframes invPop{0%{transform:translate(-50%,-50%) scale(0) rotate(-8deg);opacity:0}18%{transform:translate(-50%,-50%) scale(1.12) rotate(2deg);opacity:1}75%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(-50%,-60%) scale(1.05);opacity:0}}
.inv .iv-sc{position:absolute;inset:0;padding:300px 64px 160px;display:flex;flex-direction:column;justify-content:center;gap:34px;opacity:0;visibility:hidden;transition:opacity .35s,visibility 0s .35s}
.inv .iv-sc.on{opacity:1;visibility:visible;transition:opacity .35s}
.inv .iv-sc.out{opacity:0;transform:scale(1.04);transition:opacity .3s,transform .3s,visibility 0s .3s}
.inv h1{margin:0;font:900 118px/.98 var(--display);letter-spacing:-.03em;text-wrap:balance}.inv h1 b{color:var(--go-hi)}
.inv .iv-cap{font:600 40px/1.3 var(--display);color:var(--muted)}.inv .iv-cap b{color:var(--fg);font-weight:800}
.inv .iv-rise{opacity:0;transform:translateY(60px)}.inv .on .iv-rise{animation:invRise .7s cubic-bezier(.2,.8,.2,1) var(--d,0s) forwards}
@keyframes invRise{to{opacity:1;transform:none}}
.inv .iv-zoom{transform-origin:50% 50%}.inv .on .iv-zoom{animation:invZoom 9s linear forwards}
@keyframes invZoom{from{transform:scale(1)}to{transform:scale(1.08)}}
.inv .iv-sticker{position:absolute;padding:14px 28px;border-radius:999px;font:900 34px var(--display);color:#fff;transform:rotate(-6deg) scale(0);box-shadow:0 10px 30px rgba(0,0,0,.4);z-index:5}
.inv .on .iv-sticker{animation:invStick .5s cubic-bezier(.2,.8,.2,1) var(--d,1.2s) forwards}
@keyframes invStick{from{transform:rotate(-14deg) scale(0)}70%{transform:rotate(-4deg) scale(1.12)}to{transform:rotate(-6deg) scale(1)}}
/* echte App-Teile, groß auf der Bühne */
.inv .big{transform:scale(var(--z,1.9));transform-origin:50% 50%}
.inv .iv-boardbox{width:860px;height:860px;margin:0 auto;position:relative;--bs:860px;transform:rotate(-2deg);box-shadow:0 40px 90px rgba(0,0,0,.55);border-radius:12px}
.inv .iv-boardbox .boardwrap{width:860px;height:860px}
.inv .iv-rankup{position:absolute;left:50%;bottom:-70px;transform:translate(-50%,40px);background:#fff;color:#1E1C1A;border-radius:26px;padding:16px 28px;font:900 40px var(--display);display:flex;align-items:center;gap:18px;opacity:0;box-shadow:0 20px 50px rgba(0,0,0,.5);white-space:nowrap}
.inv .on .iv-rankup{animation:invRankup .6s cubic-bezier(.2,.8,.2,1) 4.4s forwards}
@keyframes invRankup{to{opacity:1;transform:translate(-50%,0)}}
.inv .iv-who{display:flex;align-items:center;gap:26px;background:rgba(0,0,0,.3);border-radius:30px;padding:24px 30px}.inv .iv-who .iv-t{font:900 42px var(--display);line-height:1.1}.inv .iv-who .iv-s{font:600 30px var(--display);color:var(--muted)}
.inv .iv-crew{position:relative;height:620px;border-radius:40px;background:linear-gradient(180deg,#232A3A,#171B26);overflow:hidden;box-shadow:inset 0 0 0 3px rgba(255,255,255,.06)}
.inv .iv-crew::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 2px,transparent 2px),linear-gradient(90deg,rgba(255,255,255,.05) 2px,transparent 2px);background-size:80px 80px}
.inv .iv-crew .iv-av{position:absolute;width:200px;height:230px;display:grid;place-items:center}.inv .iv-crew .iv-av svg{width:100%;height:100%}
.inv .on .iv-crew .iv-av{animation:invWalk 2.6s ease-in-out infinite}
@keyframes invWalk{0%,100%{transform:translateX(0)}50%{transform:translateX(var(--dx,40px))}}
.inv .iv-crew .iv-tag{position:absolute;left:50%;top:-30px;transform:translateX(-50%) scale(0);white-space:nowrap;font:900 30px var(--display);background:var(--bad);color:#fff;padding:10px 22px;border-radius:999px;z-index:3}
.inv .on .iv-crew .iv-tag{animation:invPopIn .4s cubic-bezier(.2,.8,.2,1) 5.6s forwards}
@keyframes invPopIn{from{transform:translateX(-50%) scale(0)}70%{transform:translateX(-50%) scale(1.2)}to{transform:translateX(-50%) scale(1)}}
.inv .iv-crew .iv-alarm{position:absolute;inset:0;pointer-events:none}.inv .on .iv-crew .iv-alarm{animation:invAlarm 1.2s ease 5.4s 2}
@keyframes invAlarm{50%{background:rgba(226,82,62,.3)}}
.inv .iv-kc{display:flex;flex-direction:column;gap:18px}
.inv .iv-kc .kc-two{font-size:28px}.inv .iv-kc .kc-b2{padding:26px;border-radius:28px}.inv .iv-kc .kc-b2 small{font-size:26px}.inv .iv-kc .kc-b2 b{font-size:64px}.inv .iv-kc .kc-b2 b em{font-size:28px}.inv .iv-kc .kc-b2 i{height:16px;margin-top:16px}
.inv .iv-kc .kc-pf{font-size:28px;gap:16px}.inv .iv-kc .kc-pf span{padding:16px 20px;border-radius:22px}.inv .iv-kc .kc-pf i{height:12px}
.inv .iv-kc .kc-btns.two{gap:18px}.inv .iv-kc .kc-big{font-size:34px;padding:30px;border-radius:28px;gap:14px}.inv .iv-kc .kc-big svg{width:56px;height:56px}
.inv .iv-tiles2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.inv .iv-tile2{display:flex;align-items:center;text-align:left;font:900 32px var(--display);padding:26px;border-radius:28px;gap:18px;border:0;color:#fff;box-shadow:inset 0 -8px 0 rgba(0,0,0,.25)}.inv .iv-tile2 svg{width:48px;height:48px;flex:none}.inv .iv-tile2 span{display:flex;flex-direction:column}.inv .iv-tile2 small{font:600 24px var(--display);color:rgba(255,255,255,.85)}.inv .iv-tile2.shop{background:var(--go)}.inv .iv-tile2.cook{background:#E8793A}
.inv .on .kc-b2.ok{animation:invGreen .5s ease 4.6s both}
@keyframes invGreen{from{box-shadow:0 0 0 0 rgba(127,178,74,.0)}50%{box-shadow:0 0 0 14px rgba(127,178,74,.35)}to{box-shadow:0 0 0 0 rgba(127,178,74,0)}}
.inv .iv-rank{background:#fff;color:#1E1C1A;border-radius:30px;padding:24px 32px;display:grid;grid-template-columns:auto 1fr auto;gap:24px;align-items:center}
.inv .iv-rank .iv-n{font:900 56px var(--mono)}.inv .iv-rank .iv-who2{font:900 44px var(--display)}.inv .iv-rank .iv-who2 small{display:block;font:600 28px var(--display);color:#8C867C}.inv .iv-rank .iv-pct{font:900 60px var(--display);color:var(--go-deep)}
.inv .tiles{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.inv .tile.pg-gt{padding:28px;border-radius:30px;gap:12px;min-height:0}.inv .tile.pg-gt h3{font-size:38px}.inv .tile.pg-gt p{font-size:26px}.inv .tile.pg-gt .pg-art{font-size:64px}
.inv .tile.pg-gt.wide{grid-column:1/-1}
.inv .iv-brawl{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
.inv .iv-brawl div{border-radius:26px;padding:24px 10px;text-align:center;font:900 24px var(--display);color:#fff;box-shadow:inset 0 -8px 0 rgba(0,0,0,.25);display:flex;flex-direction:column;gap:10px;align-items:center}
.inv .iv-brawl div i{width:70px;height:70px;border-radius:50%;background:rgba(255,255,255,.25);display:grid;place-items:center;font-size:36px;font-style:normal}
.inv .iv-brawl div small{font:700 20px var(--display);opacity:.85}
.inv .on .iv-brawl div{opacity:0;animation:invRise .5s cubic-bezier(.2,.8,.2,1) var(--d) forwards}
.inv .iv-shop{background:var(--panel);border-radius:34px;padding:30px;display:flex;flex-direction:column;gap:14px;transform:rotate(1.5deg);box-shadow:0 30px 80px rgba(0,0,0,.5)}
.inv .iv-shop .kc-shr{font-size:34px;padding:16px 18px;border-radius:22px}.inv .iv-shop .kc-shc{width:54px;height:54px;border-radius:16px;font-size:30px}.inv .iv-shop .kc-shn b{font-size:34px}
.inv .iv-shop .kc-day{font-size:28px}
.inv .iv-phones{display:flex;gap:14px;justify-content:center}.inv .iv-phones i{width:70px;height:120px;border-radius:16px;background:var(--panel-2);box-shadow:inset 0 0 0 4px var(--line);display:block;opacity:0}.inv .on .iv-phones i{animation:invRise .4s cubic-bezier(.2,.8,.2,1) var(--d) forwards}
.inv .li.fr{font-size:30px;background:var(--panel);border-radius:28px;padding:22px 26px;gap:22px;border:0}.inv .li.fr .iv-t{font-size:38px}.inv .li.fr .iv-s{font-size:28px}.inv .li.fr .now-chip{font-size:26px}.inv .li.fr .btn{font-size:30px;padding:18px 28px;border-radius:20px}
.inv .li.fr .iv-av,.inv .li.fr .avb{transform:scale(2);transform-origin:left center;margin-right:50px}
.inv .iv-match{background:var(--panel);border-radius:30px;padding:28px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:20px}
.inv .iv-team{text-align:center}.inv .iv-team .iv-badge{width:110px;height:110px;border-radius:30px;margin:0 auto 14px;display:grid;place-items:center;font:900 34px var(--display);color:#fff}.inv .iv-team .iv-nm{font:900 34px var(--display)}.inv .iv-team .iv-pick{margin-top:12px;font:800 28px var(--display);color:var(--go-hi);opacity:0}.inv .on .iv-team .iv-pick{animation:invRise .4s ease 2.6s forwards}
.inv .iv-vs{font:900 34px var(--mono);color:var(--dim)}
.inv .iv-miniboard{position:relative;height:300px;border-radius:30px;overflow:hidden;background:repeating-conic-gradient(var(--sq-d) 0 25%,var(--sq-l) 0 50%) 0 0/150px 150px}
.inv .iv-miniboard svg{position:absolute;inset:0;width:100%;height:100%}.inv .iv-miniboard path{stroke-dasharray:900;stroke-dashoffset:900}.inv .on .iv-miniboard path{animation:invDraw .8s ease 5.4s forwards}
@keyframes invDraw{to{stroke-dashoffset:0}}
.inv .iv-ticker{overflow:hidden;width:calc(100% + 128px);margin-left:-64px;padding:10px 0;mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
.inv .iv-tk{display:flex;gap:16px;width:max-content}.inv .on .iv-tk{animation:invTk 16s linear infinite}
@keyframes invTk{to{transform:translateX(-50%)}}
.inv .iv-tk span{flex:none;padding:16px 28px;border-radius:999px;background:var(--panel);font:800 32px var(--display);white-space:nowrap}.inv .iv-tk span.g{background:var(--go);color:#fff}
.inv .iv-ideas{display:flex;flex-direction:column;gap:18px}
.inv .iv-ideas .id-i{padding:26px 30px;border-radius:30px;gap:24px}.inv .iv-ideas .id-v{width:130px;padding:18px 0;border-radius:22px;font-size:48px}.inv .iv-ideas .id-v svg{width:34px;height:34px}.inv .iv-ideas .id-t{font-size:40px;line-height:1.1}.inv .iv-ideas .id-m{font-size:28px;margin-top:6px}
.inv .iv-ideas .id-i .iv-build{position:absolute;right:26px;top:-26px;font:900 28px var(--display);background:var(--go);color:#fff;padding:12px 24px;border-radius:999px;transform:scale(0)}.inv .on .iv-ideas .id-i.top .iv-build{animation:invPopIn2 .5s cubic-bezier(.2,.8,.2,1) 5.2s forwards}
@keyframes invPopIn2{from{transform:scale(0)}70%{transform:scale(1.2)}to{transform:scale(1)}}
.inv .iv-ideas .id-i{position:relative}
.inv .iv-founder{display:grid;grid-template-columns:auto 1fr;gap:26px;align-items:center;background:#fff;color:#1E1C1A;border-radius:30px;padding:26px 30px}
.inv .iv-founder .iv-cam{width:110px;height:110px;border-radius:28px;background:var(--bad);display:grid;place-items:center;color:#fff;position:relative}.inv .iv-founder .iv-cam svg{width:60px;height:60px}
.inv .iv-founder .iv-cam::after{content:"LIVE";position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);font:900 20px var(--display);background:#1E1C1A;color:#fff;padding:4px 12px;border-radius:999px;letter-spacing:.1em}
.inv .iv-founder .iv-t{font:900 38px var(--display);line-height:1.1}.inv .iv-founder .iv-s{font:600 28px var(--display);color:#8C867C;margin-top:6px}
.inv .iv-zero{text-align:center}.inv .iv-zero .iv-n{font:900 560px/.85 var(--display);letter-spacing:-.06em;color:#fff;text-shadow:0 30px 0 var(--go-deep);transform:scale(0)}.inv .on .iv-zero .iv-n{animation:invZero .7s cubic-bezier(.2,.8,.2,1) .8s forwards}
@keyframes invZero{from{transform:scale(0) rotate(-20deg)}70%{transform:scale(1.1) rotate(3deg)}to{transform:scale(1) rotate(0)}}
.inv .iv-zero .iv-e{font:900 150px var(--display);margin-top:-40px}
.inv .iv-strike{display:grid;gap:10px;font:800 38px var(--display);color:rgba(255,255,255,.85);text-align:center}.inv .iv-strike span{text-decoration:line-through;text-decoration-thickness:6px;text-decoration-color:#1E1C1A;opacity:0}.inv .on .iv-strike span{animation:invRise .4s cubic-bezier(.2,.8,.2,1) var(--d) forwards}
.inv .iv-no{font:900 54px var(--display);color:#1E1C1A;text-align:center}
.inv .iv-reward{display:grid;grid-template-columns:auto 1fr;gap:26px;align-items:center;background:var(--panel);border-radius:30px;padding:28px 30px}.inv .iv-reward .iv-t{font:900 38px var(--display);line-height:1.1}.inv .iv-reward .iv-s{font:600 30px var(--display);color:var(--muted);margin-top:6px}.inv .iv-reward .iv-s b{color:var(--warn);font-weight:900}
.inv .cta{font-size:56px;padding:40px;border-radius:30px;box-shadow:inset 0 -10px 0 var(--go-deep),0 30px 70px rgba(0,0,0,.45)}
.inv .iv-again{text-align:center;font:800 30px var(--display);color:var(--muted);cursor:pointer}
.inv .iv-fine{text-align:center;font:600 26px var(--display);color:var(--dim)}
.inv .iv-start{position:absolute;inset:0;z-index:40;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:36px;padding:80px;text-align:center;cursor:pointer}
.inv .iv-start .iv-play{width:220px;height:220px;border-radius:50%;background:var(--go);display:grid;place-items:center;box-shadow:0 0 0 0 rgba(127,178,74,.6);animation:invPing 1.6s ease-out infinite}
.inv .iv-start .iv-play svg{width:100px;height:100px;margin-left:14px}
@keyframes invPing{to{box-shadow:0 0 0 50px rgba(127,178,74,0)}}
.inv .iv-start h1{font-size:120px}.inv .iv-start p{margin:0;font:600 40px var(--display);color:var(--muted)}
.inv .iv-start .iv-brand2{display:flex;align-items:center;gap:16px;font:900 56px var(--display)}.inv .iv-start .iv-brand2 svg{width:70px;height:70px}.inv .iv-start .iv-brand2 b{color:var(--go-hi)}
@media (prefers-reduced-motion:reduce){.inv *{animation-duration:.01s!important}}
`;

  /* Texte der Szenen: Erzählung (gleich wie invite/narrate.py), Schlagwörter, die groß aufpoppen, Nathans Ausrufe */
  const SCENES = [
    {id: 0, pops: ["Schach-App", "zwei"], cues: [[200, LINE("l-hallo")]]},
    {id: 1, pops: ["Puzzles", "Ränge", "verliert"], cues: [[3200, LINE("l-brillant")], [4600, LINE("l-levelup")]]},
    {id: 2, pops: ["Imposter", "Dreimal"], cues: [[5700, LINE("l-waswar")]]},
    {id: 3, pops: ["Kalorien", "Nö", "Ranking"], cues: [[4800, "sounds/GenericNotify.mp3"], [8200, LINE("l-platz1")]]},
    {id: 4, pops: ["Brawl", "Nat", "Bock"], cues: [[3800, LINE("l-geilo")]]},
    {id: 5, pops: ["Supermarkt", "Einkaufsliste", "Kochen"], cues: [[8600, LINE("l-sahne")]]},
    {id: 6, pops: ["Werwolf", "Handy", "niemand"], cues: [[2400, LINE("l-istdasgut")]]},
    {id: 7, pops: ["Worlds-Finale", "Tipp-App", "rein"], cues: [[6800, LINE("l-dran")]]},
    {id: 8, pops: ["keine", "Community", "alles", "nie"], cues: [[1200, LINE("l-carlsen")]]},
    {id: 9, pops: ["Top-Kommentar", "Egal", "Live-Update"], cues: [[5200, LINE("l-frei")]]},
    {id: 10, pops: ["Null", "Trick"], cues: [[600, "sounds/cheer2.mp3"], [1800, LINE("l-ohyeah")]]},
    {id: 11, pops: ["eingeladen", "250", "alles"], cues: [[600, LINE("l-gg")]], last: true}
  ];
  const FALLBACK = [6500, 8000, 8500, 10000, 8700, 10600, 9000, 9100, 11600, 8900, 5800, 9800];
  const BRAWL = [["Schrotflinte", "#E9573F", "💥", "Nah · 5 Kugeln"], ["Bomber", "#F2A33A", "💣", "Wirft über Wände"], ["Scharfschütze", "#4FA3FF", "🎯", "Halten = aufladen"], ["Boxer", "#B65CE0", "🥊", "Ganz nah"], ["Revolver", "#2FB39A", "🔫", "6 Schüsse · weit"]];

  let timing = null, who = null, ref = "";
  const av = (cfg, opt) => { try { return avatarSVG(Object.assign({}, AV_DEFAULT, cfg || {}), opt || {fit: true}); } catch(e){ return ""; } };
  const face = (p, size) => { try { return Social.face(p, size); } catch(e){ return av(p && p.avatar, {size}); } };
  const crest = r => { try { return emblem(rankOf(r), 110); } catch(e){ return ""; } };
  const medal = () => { try { return achMedal(achById("recruit-1"), 120, true); } catch(e){ return "🏆"; } };
  const PGx = () => typeof PG !== "undefined" ? PG : null;
  const gameTile = (id, cls) => { const P = PGx(), g = (P && P.games || []).find(x => x.id === id); const a = P && P.ART && P.ART[id] || (id === "natposter" ? ["🚀", "#7B5CD6"] : id === "arena" ? ["⚔️", "#E06CA0"] : ["🎲", "#7FB24A"]);
    const name = g ? g.name[1] : id, sub = g ? g.sub[1] : ""; return `<div class="tile pg-gt ${cls ||""}" style="--ac:${a[1]}"><span class="pg-art">${a[0]}</span><h3>${h(name)}</h3><p>${h(sub)}</p></div>`; };
  const brand = `${typeof LOGO !== "undefined" ? LOGO : ""}<span>Chess<b>.nat</b></span>`;
  const whoName = () => who && who.name ? String(who.name).slice(0, 24) : "";

  /* ---- die Szenen, gebaut aus echten App-Teilen ---- */
  function build(i){
    const n = whoName();
    switch (i){
      case 0: return `<div class="iv-rise" style="display:flex;justify-content:center"><i class="pc wp" style="position:static;width:380px;height:380px;display:block;filter:drop-shadow(0 30px 60px rgba(0,0,0,.6))"></i></div>
        <h1 class="iv-rise" style="--d:.15s">Das hier war mal eine <b>Schach-App.</b></h1>
        <div class="iv-who iv-rise" style="--d:.4s">${who ? face({id: "inv", name: n, avatar: who.avatar}, 96) : `<div class="iv-av" style="width:96px;height:96px;border-radius:26px;background:var(--info);display:grid;place-items:center;font:900 44px var(--display);color:#fff">?</div>`}<div><div class="iv-t">${n ? h(n) + " lädt dich ein" : "Jemand lädt dich ein"}</div><div class="iv-s">Echt alles aus der App. 100 Sekunden.</div></div></div>`;
      case 1: return `<h1 class="iv-rise">Puzzles. Bots. <b>Ränge.</b></h1>
        <div class="iv-rise" style="--d:.2s;position:relative;padding:20px 0 90px"><div class="iv-boardbox"><div id="invbw"></div></div><div class="iv-rankup">${crest(880)} Eisen IV → Bronze I</div></div>
        <p class="iv-cap iv-rise" style="--d:.3s">35 Bots von 250 bis 3500, 200.000 Puzzles, Ränge wie in League. <b>Dann verliert Wolf.</b></p>`;
      case 2: return `<h1 class="iv-rise">Also: <b>Imposter</b> nachgebaut.</h1>
        <div class="iv-crew iv-rise" style="--d:.2s">${[["classic", "12%", "48%", "50px"], ["caramel", "32%", "58%", "-30px"], ["pink", "54%", "40%", "-60px"], ["choco", "74%", "56%", "30px"]].map(([fur, x, y, dx], k) => `<div class="iv-av" style="left:${x};top:${y};--dx:${dx}">${k === 2 ? `<span class="iv-tag">Imposter!</span>` : ""}${av({fur, shirt: "rags", expr: k === 2 ? "sly" : "friendly"})}</div>`).join("")}<div class="iv-alarm"></div></div>
        ${gameTile("natposter", "wide rise")}
        <div class="iv-sticker" style="right:40px;top:300px;background:var(--bad);--d:5.8s">sus 🤨</div>`;
      case 3: return `<h1 class="iv-rise">Nö. <b>Eingebaut.</b></h1>
        <div class="iv-kc iv-rise" style="--d:.2s"><div class="kc-two"><div class="kc-b2 k ok"><small>Kalorien 🔥</small><b><var>3.100</var><em> / 3.100</em></b><i><u style="width:100%"></u></i></div><div class="kc-b2 p ok"><small>Protein</small><b><var>182</var><em> / 180 g</em></b><i><u style="width:100%"></u></i></div></div>
          <div class="kc-pf"><span>KH <b>281</b> / 380 g<i><u style="width:74%"></u></i></span><span>Fett <b>64</b> / 103 g<i><u style="width:62%"></u></i></span></div>
          <div class="kc-btns two"><button class="kc-big kc-say">${MIC}<span>Sprechen</span></button><button class="kc-big kc-scan">${CODE}<span>Barcode</span></button></div></div>
        <div class="iv-rank iv-rise" style="--d:.4s"><span class="iv-n">1</span><span class="iv-who2">Adri<small>Ranking „Einhaltung“ · 3.860 von 3.100</small></span><span class="iv-pct">100 %</span></div>`;
      case 4: return `<h1 class="iv-rise"><b>Nat Stars.</b> Weil wir Bock hatten.</h1>
        <div class="iv-brawl iv-rise" style="--d:.1s">${BRAWL.map(([nm, c, e, s], k) => `<div style="background:${c};--d:${.4 + k * .15}s"><i>${e}</i>${nm}<small>${s}</small></div>`).join("")}</div>
        ${gameTile("arena", "wide rise")}
        <div class="iv-sticker" style="left:40px;bottom:420px;background:var(--pink);--d:4s">kein Download 🙅</div>`;
      case 5: return `<h1 class="iv-rise"><b>Einkaufsliste</b> und <b>Kochen.</b></h1>
        <div class="iv-shop iv-rise" style="--d:.2s"><div class="kc-day"><span>Einkauf Samstag · 4 offen</span></div>${["Hähnchenbrust 1 kg", "Reis", "Brokkoli", "Magerquark"].map((x, k) => `<div class="kc-shr" data-k="${k}"><button class="kc-shc"></button><span class="kc-shn"><b>${x}</b></span></div>`).join("")}</div>
        <div class="iv-tiles2 iv-rise" style="--d:.3s"><div class="iv-tile2 shop">${svgList()}<span><b>Einkaufsliste</b><small>mit Freunden</small></span></div><div class="iv-tile2 cook">${CHEF}<span><b>Kochen</b><small>Was hast du da?</small></span></div></div>`;
      case 6: return `<h1 class="iv-rise"><b>Partyspiele.</b> Ein Handy reicht.</h1>
        <div class="tiles iv-rise" style="--d:.2s">${["werwolf", "tabu", "heads", "tod", "never", "bomb"].map(id => gameTile(id)).join("")}</div>
        <div class="iv-phones">${[0, 1, 2, 3, 4, 5].map(k => `<i style="--d:${5.6 + k * .1}s"></i>`).join("")}</div>`;
      case 7: return `<h1 class="iv-rise">Also: <b>Tipp-App.</b> Mit deinen Freunden.</h1>
        <div class="iv-match iv-rise" style="--d:.2s"><div class="iv-team"><div class="iv-badge" style="background:#B8923A">GEN</div><div class="iv-nm">Gen.G</div><div class="iv-pick">✓ dein Tipp · 3 Punkte</div></div><div class="iv-vs">VS</div><div class="iv-team"><div class="iv-badge" style="background:#2E6FB5">BLG</div><div class="iv-nm">Bilibili</div></div></div>
        <div class="li fr iv-rise" style="--d:.4s">${face({id: "f1", name: "Wolf", avatar: {fur: "choco", shirt: "hoodie"}}, 78)}<div class="grow"><div class="iv-t"><span class="odot on"></span>Wolf</div><div class="iv-s"><span class="now-chip"><span class="now-dot"></span>Spielt gerade Schach</span></div></div><button class="btn sm go now-go">Zuschauen</button></div>
        <div class="iv-miniboard iv-rise" style="--d:.5s"><svg viewBox="0 0 1080 300"><path d="M180 230 L520 230 L520 90 L720 90" fill="none" stroke="#5AA3E0" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/><path d="M700 50 L760 90 L700 130" fill="none" stroke="#5AA3E0" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
      case 8: return `<h1 class="iv-rise">Das ist keine App. Das ist eine <b>Community.</b></h1>
        <div class="iv-ticker iv-rise" style="--d:.3s"><div class="iv-tk">${(() => { const t = things(); return (t + t); })()}</div></div>
        <p class="iv-cap iv-rise" style="--d:.4s">Ein Abo für tausend Apps? Nein. <b>Eine App für alles.</b> Und es steht nie still.</p>
        <div class="iv-sticker" style="right:50px;top:260px;background:var(--warn);color:#2A1E05;--d:2s">steht nie still ⚡</div>`;
      case 9: return `<h1 class="iv-rise">Der <b>Top-Kommentar</b> wird gebaut. Egal was.</h1>
        <div class="iv-ideas iv-rise" style="--d:.2s">${[["Nat Stars: Teams 2 gegen 2", "Wolf", 47, true], ["Kalorien per Foto", "Adri", 31], ["Schach-Turnier am Wochenende", "Mia", 19]].map(([t, n2, v, top]) => `<div class="id-i ${top ?"top" : ""}"><button class="id-v ${top ?"on" : ""}">${UP}<b data-count="${v}">0</b></button><div class="grow"><div class="id-t">${t}</div><div class="id-m">${n2} · ${top ? `<span class="id-st">wird gebaut</span>` : "vor 2 Tagen"}</div></div>${top ? `<span class="iv-build">wird gebaut</span>` : ""}</div>`).join("")}</div>
        <div class="iv-founder iv-rise" style="--d:.5s"><div class="iv-cam">${CAM}</div><div><div class="iv-t">Jeden Tag ein Update vom Gründer. Live.</div><div class="iv-s">Was ihr vorgeschlagen habt, was heute drin ist.</div></div></div>`;
      case 10: return `<div class="iv-zero"><div class="iv-n">0</div><div class="iv-e">Euro.</div></div>
        <div class="iv-strike">${["Yazio 9,99 €/Monat", "Schach-Premium 14,99 €/Monat", "Partyspiele-Bundle 4,99 €", "die App, die du nie geöffnet hast"].map((x, k) => `<span style="--d:${2 + k * .25}s">${x}</span>`).join("")}</div>
        <div class="iv-no iv-rise" style="--d:3.6s">Kein Abo für tausend Apps. Eine App für alles.</div>`;
      case 11: return `<h1 class="iv-rise">Komm rein. <b>Spiel gegen ${n ? h(n) : "uns"}.</b></h1>
        <div class="iv-reward iv-rise" style="--d:.3s"><div>${medal()}</div><div><div class="iv-t">${n ? h(n) + " freut sich doppelt" : "Wer dich eingeladen hat, freut sich doppelt"}</div><div class="iv-s">Annehmen, einmal gegeneinander spielen: <b>+250 NatCoins</b> für ${n ? h(n) : "den Einlader"}. Für dich: alles.</div></div></div>
        <button class="btn go big cta iv-rise" style="--d:.5s" data-inv-go>Einladung annehmen →</button>
        <div class="iv-again iv-rise" style="--d:.7s" data-inv-again>Noch mal von vorn</div>
        <div class="iv-fine iv-rise" style="--d:.8s">Konto in 20 Sekunden. Kostenlos, ohne Werbung.</div>`;
    }
    return "";
  }
  function svgList(){ return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>`; }
  function things(){ const P = PGx(), names = (P && P.games || []).map(g => g.name[1]); const all = ["Schach", "200.000 Puzzles", "Puzzle Rush", "35 Bots", "Natposter", "Nat Stars", ...names, "Kalorien", "Einkaufsliste", "Kochen", "Tippspiel", "Zuschauen", "Sprachchat", "Trophäen", "Battle Pass", "Freunde", "Käfig", "Partieanalyse", "Endspiele", "…und was du dir wünschst"].filter((x, k, a) => a.indexOf(x) === k); return all.map((t, k) => `<span class="${k % 5 === 4 ?"g" : ""}">${h(t)}</span>`).join(""); }

  /* ---- Szenen zum Leben erwecken: Brett spielt, Liste hakt ab, Stimmen zählen hoch ---- */
  function run(i, el, timers){
    if (i === 1 && typeof makeBoard === "function" && typeof Chess !== "undefined"){
      const g = new Chess("2r3k1/8/1q6/3N4/8/8/8/6K1 w - - 0 1"), b = makeBoard(el.querySelector("#invbw"), {orientation: "w"}); b.set(g, null);
      const mv = (san, at, badge) => timers.push(setTimeout(() => { const m = g.move(san); if (!m) return; b.set(g, {from: m.from, to: m.to}); try { Sound.forMove(m, g); } catch(e) {} if (badge) b.badge(m.to, "!!", "var(--brill)"); }, at));
      mv("Ne7+", 1400, true); mv("Kh8", 2600); mv("Nxc8", 3400);
    }
    if (i === 5) el.querySelectorAll(".kc-shr").forEach((r, k) => timers.push(setTimeout(() => { r.classList.add("done"); r.querySelector(".kc-shc").textContent = "✓"; try { Sound.play("Move", .5); } catch(e) {} }, 3200 + k * 500)));
    if (i === 9) el.querySelectorAll("[data-count]").forEach(x => { const to = +x.dataset.count, start = performance.now() + 900; const step = now => { if (now < start){ requestAnimationFrame(step); return; } const p = Math.min(1, (now - start) / 1400); x.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); });
  }

  /* ---- Untertitel: die Wörter der Erzählung, Wort für Wort hell, Schlagwörter poppen groß ---- */
  function tokens(i){ const t = timing && timing[i]; if (!t) return null; const toks = t.text.split(/\s+/), out = []; let w = 0;
    toks.forEach((tok, k) => { const bare = tok.replace(/[.,!?:…„“"]/g, ""); const tm = t.words[w] && t.words[w][1].replace(/[.,!?:…„“"]/g, "") === bare ? t.words[w++][0] : (out.length ? out[out.length - 1].t : 0); out.push({tok, bare, t: tm, end: /[.!?:]$/.test(tok)}); });
    return out; }

  /* ---- Ablauf ---- */
  function start(r){
    ref = r || ""; if (document.querySelector(".inv")) return;
    const css = document.createElement("style"); css.textContent = CSS; document.head.appendChild(css);
    const ov = document.createElement("div"); ov.className = "inv"; ov.setAttribute("data-notr", "");
    ov.innerHTML = `<div class="st"><div class="iv-bars">${SCENES.map(() => "<i><b></b></i>").join("")}</div><div class="iv-brand">${brand}</div><button class="iv-mute" aria-label="Ton aus">🔊</button><button class="iv-skip">Überspringen</button><div class="iv-sub"></div><div class="iv-pop"></div>
      ${SCENES.map(s => `<section class="iv-sc" data-i="${s.id}"></section>`).join("")}<div class="iv-tap"><div data-dir="-1"></div><div data-dir="1"></div></div>
      <div class="iv-start"><div class="iv-brand2">${brand}</div><div class="iv-play"><svg viewBox="0 0 24 24" fill="#fff"><path d="M6 4l14 8-14 8z"/></svg></div><h1 class="iv-sh">Du bist <b>eingeladen.</b></h1><p>Tippen. Ton an. 100 Sekunden.</p></div></div>`;
    document.body.appendChild(ov); document.documentElement.classList.add("inv-on");
    const q = s => ov.querySelector(s), qa = s => Array.from(ov.querySelectorAll(s)), st = q(".st");
    const fit = () => { const s = Math.min(innerWidth / W, innerHeight / H); st.style.setProperty("--s", s.toFixed(4)); }; addEventListener("resize", fit); fit();
    /* Einlader + Erzählung laden */
    const sb = window.ChessSite && window.ChessSite.sb;
    if (ref && sb) sb.rpc("invite_who", {h: ref}).then(({data}) => { const p = Array.isArray(data) ? data[0] : data; if (p && p.name){ who = p; q(".iv-start .sh").innerHTML = h(whoName()) + " lädt dich <b>ein.</b>"; } }).catch(() => {});
    fetch("invite/voice/timing.json", {cache: "no-cache"}).then(r => r.ok ? r.json() : null).then(j => { timing = Array.isArray(j) ? j : null; }).catch(() => {});
    const voices = SCENES.map((s, i) => { const a = new Audio("invite/voice/s" + i + ".mp3"); a.preload = "auto"; a.setAttribute("playsinline", ""); a.onerror = () => { a.bad = true; }; return a; });

    let cur = -1, t0 = 0, raf = 0, timers = [], dur = 0, muted = false, paused = false, pausedAt = 0; const playing = new Set();
    const sfx = (src, vol) => { if (muted) return; try { const a = new Audio(src); a.volume = vol == null ? 1 : vol; a.setAttribute("playsinline", ""); a.play().catch(() => {}); playing.add(a); a.onended = () => playing.delete(a); } catch(e) {} };
    const hush = () => { playing.forEach(a => { try { a.pause(); } catch(e) {} }); playing.clear(); };
    const clear = () => { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); hush(); };
    const bars = qa(".iv-bars i");
    function show(i){
      clear(); i = Math.max(0, Math.min(SCENES.length - 1, i)); cur = i; const el = qa(".iv-sc")[i];
      qa(".iv-sc").forEach(x => { if (x !== el && x.classList.contains("on")){ x.classList.add("out"); setTimeout(() => { x.classList.remove("on", "out"); x.innerHTML = ""; }, 320); } });
      el.innerHTML = build(i); el.classList.remove("on", "out"); void el.offsetWidth; el.classList.add("on");
      bars.forEach((b, k) => { b.querySelector("b").style.width = k < i ? "100%" : "0"; });
      q(".iv-skip").hidden = i === SCENES.length - 1;
      const voice = voices[i], useVoice = !muted && voice && !voice.bad;
      const toks = tokens(i); const sub = q(".iv-sub"); sub.innerHTML = ""; q(".iv-pop").className = "iv-pop";
      dur = useVoice && timing && timing[i] ? Math.round(timing[i].end * 1000) + 700 : FALLBACK[i];
      if (useVoice){ try { voice.currentTime = 0; voice.volume = 1; voice.play().catch(() => {}); playing.add(voice); } catch(e) {} }
      SCENES[i].cues.forEach(([at, src]) => timers.push(setTimeout(() => sfx(src, src.includes("/lines/") ? .9 : .5), at)));
      run(i, el, timers);
      if (el.querySelector("[data-inv-go]")) el.querySelector("[data-inv-go]").onclick = e => { e.stopPropagation(); finish(); };
      if (el.querySelector("[data-inv-again]")) el.querySelector("[data-inv-again]").onclick = e => { e.stopPropagation(); show(0); };
      t0 = performance.now(); let sentence = -1, said = -1;
      const tick = now => {
        const ms = useVoice && !voice.paused && voice.currentTime > 0 ? voice.currentTime * 1000 : now - t0;
        bars[i].querySelector("b").style.width = (Math.min(1, ms / dur) * 100).toFixed(1) + "%";
        if (toks){ let k = -1; for (let j = 0; j < toks.length; j++) if (toks[j].t * 1000 <= ms + 80) k = j;
          if (k !== said){ said = k; let s0 = 0, sn = 0; for (let j = 0; j <= k && j < toks.length; j++){ if (j > 0 && toks[j - 1].end){ s0 = j; sn++; } }
            if (sn !== sentence){ sentence = sn; let e = s0; while (e < toks.length - 1 && !toks[e].end) e++; sub.innerHTML = toks.slice(s0, e + 1).map((t, j) => `<span data-j="${s0 + j}">${h(t.tok)}</span>`).join(" "); }
            qa(".iv-sub span").forEach(sp => { const j = +sp.dataset.j; sp.classList.toggle("said", j < k); sp.classList.toggle("now", j === k); });
            if (k >= 0 && SCENES[i].pops.includes(toks[k].bare)){ const p = q(".iv-pop"); p.textContent = toks[k].tok.replace(/[.,!?:]$/, ""); p.className = "iv-pop"; void p.offsetWidth; p.className = "iv-pop in"; } } }
        if (ms >= dur){ if (!SCENES[i].last) show(i + 1); else bars[i].querySelector("b").style.width = "100%"; return; }
        raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }
    const pause = () => { if (paused || cur < 0) return; paused = true; pausedAt = performance.now() - t0; cancelAnimationFrame(raf); playing.forEach(a => { try { a.pause(); } catch(e) {} }); };
    const resume = () => { if (!paused) return; paused = false; show(cur); };
    qa(".iv-tap div").forEach(d => d.onclick = () => { if (cur < 0) return; const dir = +d.dataset.dir; if (dir > 0 && cur === SCENES.length - 1) return; show(cur + dir); });
    q(".iv-mute").onclick = e => { e.stopPropagation(); muted = !muted; if (muted) hush(); q(".iv-mute").textContent = muted ? "🔇" : "🔊"; };
    q(".iv-skip").onclick = e => { e.stopPropagation(); show(SCENES.length - 1); };
    document.addEventListener("visibilitychange", () => { if (!document.querySelector(".inv")) return; if (document.hidden) pause(); else resume(); });
    const key = e => { if (!document.querySelector(".inv") || cur < 0) return; if (e.key === "ArrowRight") show(cur + 1); if (e.key === "ArrowLeft") show(cur - 1); }; document.addEventListener("keydown", key);
    q(".iv-start").onclick = () => { q(".iv-start").remove(); try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch(e) {} try { Sound.init(); } catch(e) {} show(0); };
    function finish(){ clear(); ov.classList.add("out"); document.removeEventListener("keydown", key); document.documentElement.classList.remove("inv-on"); setTimeout(() => ov.remove(), 50);
      try { history.replaceState(null, "", "/" + (ref ? "?ref=" + encodeURIComponent(ref) : "") + "#home"); } catch(e) {}
      if (typeof App !== "undefined" && App.route !== "home") App.go("home"); }
  }
  return {start};
})();
