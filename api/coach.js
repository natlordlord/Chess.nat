/* Chess.nat coach: says in plain words WHY a move is good, and in a game what you're trying to achieve.
   The engine in the phone finds every move and every line; the AI only puts them into words (it gets the lines and comments
   on each move of them, it never adds a move of its own). Only signed-in Chess.nat players may call it.
   AI via Vercel AI Gateway, the same way as api/kcal.js (env AI_KEY / AI_GATEWAY_API_KEY, else this project's OIDC token). */
const SUPABASE_URL = "https://zpsfdpangmvqxbkvzibb.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc2ZkcGFuZ212cXhia3Z6aWJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NDcxMTUsImV4cCI6MjEwOTEyMzExNX0.XvVXgjOsOm0DQyrWCafc-y7LUYHYiX_H6R8g5ajLJpo";
const MODELS = (process.env.COACH_MODELS || process.env.GATEWAY_MODELS || "anthropic/claude-opus-5.5,google/gemini-2.5-flash").split(",").map(s => s.trim()).filter(Boolean);
const NOPE = {};
const str = d => ({type: "string", description: d});

const VOICE = lang => `You are Coach Nat inside the chess app Chess.nat. The player is a beginner around 1000 rating who wants to understand chess, not just be told moves.
How you talk:
- ${lang === "de" ? "Write in German, informal (du), the way a German chess friend talks: Springer, Läufer, Turm, Dame, König, Bauer, Schach, Matt, Gabel, Fesselung." : "Plain English."} Short sentences, warm and direct, like a friend sitting next to them. No jargon; if a chess word is needed (fork, pin, discovered attack), explain it in the same sentence.
- Name pieces with their square: "your knight on f3", "their queen on d8". Never write move lists or notation like "Nxg5 fxg5"; say what happens in words. You may name a square (g5, f7, h5).
- Say "you" for the player and "they" for the opponent (in German: du / dein Gegner).
- Concrete over general: say which piece, which square, what it attacks, what it wins.
- Only use moves and outcomes from the engine lines you are given, and read the move notes: they say exactly what each move takes, whether it is check or CHECKMATE, and the material afterwards. Never invent a move, a threat or a result the notes don't show.
- "Sacrifice" only if the notes show the player's material going down because the opponent takes something on the next move. "Checkmate" only if a note says CHECKMATE or the engine says forced mate; if a line stops before the end, describe where it stands then (e.g. "you are a rook up and their king is still exposed").
- Your headline and idea must match the lines exactly: don't promise a queen sacrifice, a mate or a win of material that the lines don't contain.`;

const WHY_SYSTEM = lang => VOICE(lang) + `

Your job now: explain one moment of a finished game. The player played one move; the engine prefers another. Explain WHY the engine's move is better, so the player sees the idea and can find such moves alone next time.
You get the position, both moves, the engine's main line, and the lines that follow the opponent's most natural answers (especially "what if they just take back?"). Comment on every move of every line you get, in order, one short sentence each (max ~16 words): what that move does or threatens. The comments for the opponent's moves say what they try and why it fails.
- headline: the idea in one line (max 12 words), no notation.
- idea: 2 to 4 short sentences: what is special in this position (the weakness or target), what the better move does (often several things at once), why the opponent can't simply stop it.
- played: 1 to 2 sentences on the move that was played: what it missed or allowed. Kind, not mocking.
- rule: one rule of thumb to remember, max 18 words, that would have found this move.
- lines: one entry per given line, same id, a title (max 7 words, e.g. "If they take back with the pawn") and comments: exactly one per move of that line, same order.`;

const GOAL_SYSTEM = lang => VOICE(lang) + `

Your job now: the player is in the middle of a game and it's their move. Tell them what to aim for right now, WITHOUT giving away the move. They want to learn to find it themselves.
You get the position and the engine's best lines (for you only, never repeat them as moves). Turn them into an objective: what is the target (a weak king, a loose piece, a square, a pawn), which of their pieces want to get involved, what stands in the way. Do not say which piece to move where. Do not name the destination square of the best move. Hints at a target or an obstacle are fine ("their king has lost the pawn on f7: the diagonal from h5 to e8 is open, and one of your own pieces blocks your queen's way there").
- goal: max 10 words.
- why: 2 to 3 short sentences.
- look: one question they should ask themselves on this move (max 14 words).
- danger: one sentence on what the opponent threatens, or "" if nothing urgent.`;

const SUM_SYSTEM = lang => VOICE(lang) + `

Your job now: the game just ended. In 2 to 3 short sentences say what decided it, concretely: which moment (move number), what was missed or what went right, using only the key moments and numbers you get. If the player won, say what they did well first; if they lost, be kind and specific. Then one tip to work on next game.
- headline: max 8 words (e.g. "Won by a mate attack on the open king").
- text: 2-3 short sentences. Move numbers are fine ("on move 8"); for moves, say what happened in words, you may name the move in brackets once at most.
- tip: one sentence, max 18 words.`;
const SUM_SCHEMA = {type: "object", additionalProperties: false, required: ["headline", "text", "tip"], properties: {headline: str("Max 8 words"), text: str("2-3 sentences"), tip: str("One sentence")}};
const WHY_SCHEMA = {type: "object", additionalProperties: false, required: ["headline", "idea", "played", "rule", "lines"], properties: {
  headline: str("The idea in one line, no notation"), idea: str("2-4 short sentences"), played: str("1-2 sentences on the played move"), rule: str("One rule of thumb"),
  lines: {type: "array", items: {type: "object", additionalProperties: false, required: ["id", "title", "comments"], properties: {
    id: str("The id of the given line"), title: str("Max 7 words"), comments: {type: "array", items: str("One short sentence for this move")}}}}}};
const GOAL_SCHEMA = {type: "object", additionalProperties: false, required: ["goal", "why", "look", "danger"], properties: {
  goal: str("Max 10 words"), why: str("2-3 sentences"), look: str("One question, max 14 words"), danger: str("One sentence or empty")}};

function readBody(req){
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") { try { return Promise.resolve(JSON.parse(req.body)); } catch(e) { return Promise.resolve({}); } }
  return new Promise(ok => { let s = ""; req.on("data", c => { s += c; }); req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch(e) { ok({}); } }); req.on("error", () => ok({})); });
}
async function userOf(req){
  const auth = String(req.headers.authorization || "");
  if (!/^Bearer .{20,}/.test(auth)) return null;
  const r = await fetch(SUPABASE_URL + "/auth/v1/user", {headers: {apikey: SUPABASE_ANON, Authorization: auth}}).catch(() => null);
  if (!r || !r.ok) return null;
  const u = await r.json().catch(() => null);
  return u && u.id ? u : null;
}
async function ask(req, cfg){
  const key = String(process.env.AI_GATEWAY_API_KEY || process.env.AI_KEY || "").trim();
  const token = key || req.headers["x-vercel-oidc-token"] || process.env.VERCEL_OIDC_TOKEN;
  if (!token) throw Object.assign(new Error("no ai credentials"), {status: 500});
  let last;
  for (const model of MODELS.filter(m => !(NOPE[m] > Date.now()))){
    const r = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {method: "POST",
      headers: {"Content-Type": "application/json", Authorization: "Bearer " + token},
      body: JSON.stringify({model, max_tokens: 2500, temperature: 0.3,
        ...(/^google\//.test(model) ? {providerOptions: {google: {thinkingConfig: {thinkingBudget: 0}}}} : {}),
        response_format: {type: "json_schema", json_schema: {name: cfg.name, strict: true, schema: cfg.schema}},
        messages: [{role: "system", content: cfg.system}, {role: "user", content: cfg.user}]})
    }).catch(e => ({ok: false, status: 0, text: async () => String(e)}));
    if (r.ok){
      const j = await r.json();
      const out = String((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "").replace(/^```(json)?|```$/g, "").trim();
      try { const p = JSON.parse(out); p.model = model; return p; } catch(e) { last = Object.assign(new Error("bad json from " + model), {status: 502}); continue; }
    }
    last = Object.assign(new Error((await r.text().catch(() => "")).slice(0, 300)), {status: r.status, model});
    if (r.status === 403 || r.status === 402) NOPE[model] = Date.now() + 30 * 60e3;
    if (![400, 401, 402, 403, 404, 429].includes(r.status) && r.status !== 0) break;
  }
  throw last || new Error("no model");
}

const clip = (v, n) => String(v == null ? "" : v).slice(0, n);
const side = c => c === "b" ? "Black" : "White";
const moves = a => (Array.isArray(a) ? a : []).slice(0, 30).map(m => clip(m, 10)).filter(m => /^[KQRBNa-hO0-][\w+#=\-]*$/.test(m));
/* "+1.4 pawns (you are better)" / "forced mate in 2 for them": the engine score (White's view, mate = ±(10000 - moves)) from the player's side,
   in words the model can't misread */
function evalWords(v, me){
  v = Number(v); if (!isFinite(v)) return "unknown";
  if (Math.abs(v) >= 9000) return `forced mate in ${Math.max(1, Math.round(10000 - Math.abs(v)))} for ${(v > 0) === (me === "w") ? "you" : "them"}`;
  const p = v / 100 * (me === "w" ? 1 : -1);
  return (p >= 0 ? "+" : "") + p.toFixed(1) + " pawns " + (Math.abs(p) < 0.3 ? "(equal)" : p > 0 ? "(you are better)" : "(they are better)");
}
const lineText = (L, me) => { const mv = moves(L.moves), nt = Array.isArray(L.notes) ? L.notes : [];
  return `id ${clip(L.id, 12)}${L.label ? " (" + clip(L.label, 60) + ")" : ""}: ${mv.join(" ")}` + (nt.length ? "\n" + mv.map((m, k) => `   ${k + 1}. ${m} = ${clip(nt[k], 160)}`).join("\n") : "") +
    `\n   at the end: ${evalWords(L.end, me)}${L.mate ? ", checkmate on the board" : ""}${L.material ? ", material " + clip(L.material, 100) : ""}`; };

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({error: "POST only"});
  const user = await userOf(req);
  if (!user) return res.status(401).json({error: "Please sign in."});
  const b = await readBody(req);
  const lang = b.lang === "de" ? "de" : "en", me = b.me === "b" ? "b" : "w", fen = clip(b.fen, 100), board = clip(b.board, 400), facts = (Array.isArray(b.facts) ? b.facts : []).slice(0, 12).map(f => "- " + clip(f, 160)).join("\n");
  if (!/^[1-8kqrbnpKQRBNP\/]+ [wb] /.test(fen)) return res.status(400).json({error: "bad position"});
  try {
    if (b.mode === "why"){
      const L = (Array.isArray(b.lines) ? b.lines : []).slice(0, 4).map(x => ({id: clip(x.id, 12), label: x.label, moves: moves(x.moves), notes: (Array.isArray(x.notes) ? x.notes : []).slice(0, 30), end: x.end, mate: !!x.mate, material: x.material})).filter(x => x.moves.length);
      if (!L.length) return res.status(400).json({error: "no lines"});
      const msg = `The player is ${side(me)}. It was the player's move.
Position (FEN): ${fen}
Board (White at the bottom, uppercase = White):
${board}
Engine before the move: ${evalWords(b.before, me)}
Played: ${clip(b.played, 10)} → afterwards ${evalWords(b.afterPlayed, me)}${moves(b.playedReply).length ? `\n   the engine's best answer for them after it: ${moves(b.playedReply).join(" ")}` : ""}
Engine's move: ${clip(b.best, 10)} → ${evalWords(b.afterBest, me)}
Facts about the position:
${facts || "- none"}
Lines (each starts with the engine's move ${clip(b.best, 10)}; comment every move, in order):
${L.map(x => lineText(x, me)).join("\n")}`;
      const out = await ask(req, {system: WHY_SYSTEM(lang), schema: WHY_SCHEMA, name: "coach_why", user: msg});
      /* the comments belong to the moves the phone sent, never the other way round */
      out.lines = L.map(x => { const o = (out.lines || []).find(y => y && y.id === x.id) || {}; const c = Array.isArray(o.comments) ? o.comments.map(s => clip(s, 200)) : [];
        return {id: x.id, title: clip(o.title || x.label || "", 60), comments: x.moves.map((_, k) => c[k] || "")}; });
      return res.status(200).json({headline: clip(out.headline, 120), idea: clip(out.idea, 700), played: clip(out.played, 400), rule: clip(out.rule, 200), lines: out.lines});
    }
    if (b.mode === "goal"){
      const L = (Array.isArray(b.lines) ? b.lines : []).slice(0, 3).map((x, k) => ({id: "L" + (k + 1), moves: moves(x.moves), end: x.end})).filter(x => x.moves.length);
      const msg = `The player is ${side(me)} and it's their move.
Position (FEN): ${fen}
Board (White at the bottom, uppercase = White):
${board}
Engine: ${evalWords(b.eval, me)}
Facts about the position:
${facts || "- none"}
The engine's best lines, for you only (never give these moves away):
${L.map(x => lineText(x, me)).join("\n") || "- none"}`;
      const out = await ask(req, {system: GOAL_SYSTEM(lang), schema: GOAL_SCHEMA, name: "coach_goal", user: msg});
      return res.status(200).json({goal: clip(out.goal, 100), why: clip(out.why, 500), look: clip(out.look, 160), danger: clip(out.danger, 240)});
    }
    if (b.mode === "summary"){
      const M = (Array.isArray(b.moments) ? b.moments : []).slice(0, 16).map(m => `- move ${Number(m.no) || 0}, ${m.who === "you" ? "you" : "they"} played ${clip(m.played, 10)} (${clip(m.cls, 12)})${m.best && m.best !== m.played ? `, better was ${clip(m.best, 10)}` : ""}; engine before ${evalWords(m.before, "w")}, after ${evalWords(m.after, "w")}`).join("\n");
      const n = x => (x == null || !isFinite(Number(x))) ? "?" : Number(x).toFixed(1);
      const msg = `The player was ${side(me)}. Result: ${clip(b.result, 20)}${b.why ? " (" + clip(b.why, 40) + ")" : ""} against ${clip(b.opp, 40) || "the opponent"}, after ${Number(b.moves) || 0} half-moves.
Accuracy: you ${n(b.acc && b.acc.you)}, them ${n(b.acc && b.acc.them)}. Estimated game rating: you ${(b.rating && b.rating.you) || "?"}, them ${(b.rating && b.rating.them) || "?"}.
${b.turn ? `The evaluation first became decisive on move ${Number(b.turn.no) || 0} (${evalWords(b.turn.ev, "w")}).` : "The game stayed close the whole time."}
Key moments (evaluations are from the player's side):
${M || "- none"}`;
      const out = await ask(req, {system: SUM_SYSTEM(lang), schema: SUM_SCHEMA, name: "coach_summary", user: msg});
      return res.status(200).json({headline: clip(out.headline, 100), text: clip(out.text, 600), tip: clip(out.tip, 200)});
    }
    return res.status(400).json({error: "unknown mode"});
  } catch(e) {
    console.log("coach ai failed", b.mode, e.status, e.model, String(e.message).slice(0, 300));
    return res.status(502).json({error: e.status === 429 ? "Too many requests right now. Try again in a moment." : "The coach didn't answer. Try again."});
  }
};
