// Chess.nat push sender: called by database triggers (invites, friends, hearts, cages, chat) and hourly for flame reminders.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
let cfg: Record<string, string> | null = null;
async function config() {
  if (cfg) return cfg;
  const { data, error } = await sb.rpc("push_config");
  if (error) throw error;
  cfg = data as Record<string, string>;
  webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);
  return cfg;
}
type Sub = { endpoint: string; p256dh: string; auth: string; user_id: string; tz: number; hour: number; prefs: Record<string, boolean> | null; last_remind: string | null };
async function sendTo(rows: Sub[], payload: Record<string, unknown>) {
  let sent = 0;
  await Promise.all(rows.map(async (r) => {
    try {
      await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, JSON.stringify(payload), { TTL: 6 * 3600, urgency: "high" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from("chess_push").delete().eq("endpoint", r.endpoint);
      else console.log("push failed", code, (e as { body?: string }).body);
    }
  }));
  return sent;
}
const localHour = (now: Date, tz: number) => Math.floor(((now.getUTCHours() * 60 + now.getUTCMinutes() + tz) % 1440 + 1440) % 1440 / 60);
const localDate = (now: Date, tz: number) => new Date(now.getTime() + tz * 60000).toISOString().slice(0, 10);

async function remind() {
  const now = new Date();
  const { data } = await sb.from("chess_push").select("*");
  const due = ((data || []) as Sub[]).filter((r) => (!r.prefs || r.prefs.remind !== false) && localHour(now, r.tz) === r.hour && r.last_remind !== localDate(now, r.tz));
  if (!due.length) return { sent: 0 };
  const ids = [...new Set(due.map((r) => r.user_id))];
  const { data: players } = await sb.from("chess_players").select("id,flame,flame_day").in("id", ids);
  const P = new Map((players || []).map((p) => [p.id, p]));
  let sent = 0;
  for (const r of due) {
    const today = localDate(now, r.tz), yday = localDate(new Date(now.getTime() - 864e5), r.tz), p = P.get(r.user_id);
    await sb.from("chess_push").update({ last_remind: today }).eq("endpoint", r.endpoint);
    if (p && p.flame_day === today) continue; // already lit today
    const alive = p && p.flame_day === yday && p.flame > 0;
    sent += await sendTo([r], alive
      ? { title: `🔥 Your ${p.flame}-day flame goes out tonight`, body: "Play 3 puzzles to keep it burning.", url: "/#puzzles", kind: "remind", tag: "remind", badge: p.flame }
      : { title: "🔥 Light your flame", body: "3 puzzles a day keep it burning. Today's are waiting.", url: "/#puzzles", kind: "remind", tag: "remind", badge: 0 });
  }
  return { sent };
}

Deno.serve(async (req) => {
  try {
    const c = await config();
    if (req.headers.get("x-hook-key") !== c.hook_key) return new Response("forbidden", { status: 401 });
    const body = await req.json();
    if (body.remind) return Response.json(await remind());
    const { data } = await sb.from("chess_push").select("*").eq("user_id", body.to);
    const rows = ((data || []) as Sub[]).filter((r) => !r.prefs || r.prefs[body.kind] !== false);
    const { data: p } = await sb.from("chess_players").select("flame").eq("id", body.to).maybeSingle();
    const sent = await sendTo(rows, { title: body.title, body: body.body, url: body.url, kind: body.kind, tag: body.kind + ":" + (body.url || ""), badge: p ? p.flame : undefined });
    return Response.json({ sent });
  } catch (e) {
    console.log("error", String(e));
    return new Response("error", { status: 500 });
  }
});
