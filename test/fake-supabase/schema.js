/* Snapshot of the real Chess.nat database (project zpsfdpangmvqxbkvzibb, schema public), taken 2026-11-11.
   One line per table:  name | primary key | column:type:null?:default ; ...
   "!" = NOT NULL, "?" = nullable. Defaults: @now, @uid (auth.uid()), @uuid, @identity, @generated, @code, or a literal.
   The fake answers exactly like PostgREST does for a table or column that is not listed here, so code that
   talks to something the real database doesn't have fails in the test the same way it fails for a real player. */
const TABLES = `
chess_duels|id|id:text:!: ; white:uuid:!: ; black:uuid:!: ; result:text:!: ; reason:text:?: ; moves:int4:?: ; reported_by:uuid:!:@uid ; created_at:timestamptz:!:@now
chess_events|id|id:int8:!:@identity ; user_id:uuid:!:@uid ; session:text:?: ; kind:text:!: ; name:text:?: ; meta:jsonb:?: ; device:text:?: ; created_at:timestamptz:!:@now
chess_feedback|id|id:uuid:!:@uuid ; user_id:uuid:!:@uid ; name:text:?: ; body:text:!: ; img:text:?: ; info:text:?: ; created_at:timestamptz:!:@now
chess_fixes|user_id,id|id:text:!: ; user_id:uuid:!: ; xp:int4:!:0 ; pz:int4:!:0 ; note:text:?: ; created_at:timestamptz:!:@now ; puzzle:jsonb:?:
home_groups|id|id:uuid:!:@uuid ; owner:uuid:!:@uid ; name:text:!:'Zuhause' ; created_at:timestamptz:!:@now ; ort:text:?: ; strasse:text:?: ; addr:jsonb:?:
home_plan_wishes|id|id:int8:!:@identity ; user_id:uuid:!:@uid ; city:text:?: ; county:text:?: ; state:text:?: ; why:text:?: ; created_at:timestamptz:!:@now
home_members|group_id,user_id|group_id:uuid:!: ; user_id:uuid:!: ; created_at:timestamptz:!:@now
home_tasks|id|id:uuid:!:@uuid ; group_id:uuid:!: ; title:text:!: ; emoji:text:!:'🧹' ; note:text:?: ; img:text:?: ; kind:text:!:'once' ; every_days:int4:?: ; everyone:bool:!:false ; due_at:timestamptz:?: ; ask_at:timestamptz:!:@now ; state:text:!:'wait' ; asked:uuid:?: ; asked_at:timestamptz:?: ; passed:_text:!:{} ; taken_by:uuid:?: ; taken_at:timestamptz:?: ; reminded_at:timestamptz:?: ; done_by:uuid:?: ; done_at:timestamptz:?: ; created_by:uuid:!:@uid ; created_at:timestamptz:!:@now
home_thanks|task_id,user_id|task_id:uuid:!: ; user_id:uuid:!:@uid ; created_at:timestamptz:!:@now
chess_fairplay|id|id:uuid:!:@uuid ; user_id:uuid:!: ; quote:text:!: ; status:text:!:open ; created_at:timestamptz:!:@now ; sorry_at:timestamptz:?:
chess_ideas|id|id:uuid:!:@uuid ; user_id:uuid:!:@uid ; name:text:?: ; title:text:!: ; body:text:?: ; status:text:!:open ; created_at:timestamptz:!:@now
chess_idea_votes|idea_id,user_id|idea_id:uuid:!: ; user_id:uuid:!:@uid ; created_at:timestamptz:!:@now
kcal_own_products|id|id:uuid:!:@uuid ; user_id:uuid:!:@uid ; author:text:?: ; code:text:!: ; name:text:!: ; brand:text:!: ; unit:text:!:g ; k:numeric:!: ; c:numeric:!: ; p:numeric:!: ; f:numeric:!: ; fi:numeric:!:0 ; su:numeric:!:0 ; sf:numeric:!:0 ; sa:numeric:!:0 ; img:text:?: ; status:text:!:new ; created_at:timestamptz:!:@now
home_log|id|id:int8:!:@identity ; group_id:uuid:!: ; task_id:uuid:?: ; title:text:!: ; emoji:text:?: ; user_id:uuid:!: ; what:text:!: ; at:timestamptz:!:@now
chess_now|user_id|user_id:uuid:!:@uid ; what:jsonb:!: ; updated_at:timestamptz:!:@now
chess_friends|a,b|a:uuid:!: ; b:uuid:!: ; requested_by:uuid:!: ; status:text:!:'pending' ; created_at:timestamptz:!:@now
chess_gifts|id|id:int8:!:@identity ; from_id:uuid:!:@uid ; to_id:uuid:!: ; kind:text:!:'heart' ; created_at:timestamptz:!:@now
chess_invites|id|id:int8:!:@identity ; from_id:uuid:!:@uid ; to_id:uuid:!: ; code:text:!: ; tc:text:?: ; status:text:!:'open' ; created_at:timestamptz:!:@now
chess_matches|id|id:uuid:!:@uuid ; tc:text:!: ; cat:text:!: ; white:uuid:!: ; black:uuid:!: ; room:text:!: ; status:text:!:'live' ; res_w:text:?: ; res_b:text:?: ; why_w:text:?: ; why_b:text:?: ; result:text:?: ; why:text:?: ; rw_before:int4:?: ; rb_before:int4:?: ; rw_after:int4:?: ; rb_after:int4:?: ; created_at:timestamptz:!:@now ; reported_at:timestamptz:?: ; finished_at:timestamptz:?:
chess_messages|id|id:int8:!:@identity ; from_id:uuid:!:@uid ; to_id:uuid:!: ; body:text:!: ; created_at:timestamptz:!:@now ; read_at:timestamptz:?:
chess_news|id|id:int8:!:@identity ; title:text:!: ; body:text:!: ; created_at:timestamptz:!:@now ; pushed_at:timestamptz:?: ; pushed_count:int4:?: ; audio_url:text:?: ; rev:int4:!:0 ; sort_at:timestamptz:!:@now ; video_url:text:?:
chess_players|id|id:uuid:!: ; name:text:!: ; name_lc:text:?:@generated ; rating:int4:?: ; last_seen:timestamptz:!:@now ; created_at:timestamptz:!:@now ; avatar:jsonb:?: ; trophies:int4:!:0 ; handle:text:?: ; ratings:jsonb:?: ; flame:int4:!:0 ; flame_day:date:?: ; handle_changes:int4:!:0 ; active_at:timestamptz:?: ; referred_by:uuid:?:
chess_push|endpoint|endpoint:text:!: ; user_id:uuid:!:@uid ; p256dh:text:!: ; auth:text:!: ; tz:int4:!:0 ; hour:int4:!:18 ; prefs:jsonb:!:{"hearts": true, "remind": true, "friends": true, "invites": true, "messages": true} ; created_at:timestamptz:!:@now ; last_remind:date:?:
chess_queue|user_id|user_id:uuid:!: ; tc:text:!: ; cat:text:!: ; r:float8:!: ; joined_at:timestamptz:!:@now ; seen_at:timestamptz:!:@now ; match_id:uuid:?:
chess_ratings|user_id,cat|user_id:uuid:!: ; cat:text:!: ; r:float8:!:1200 ; rd:float8:!:350 ; games:int4:!:0 ; w:int4:!:0 ; d:int4:!:0 ; l:int4:!:0 ; peak:int4:!:0 ; updated_at:timestamptz:!:@now
kcal_body|user_id|user_id:uuid:!: ; aim:text:?: ; sex:text:?: ; born:int2:?: ; height:int2:?: ; weight:numeric:?: ; activity:numeric:?: ; custom:bool:!:false ; weigh_min:int2:?: ; setup_at:timestamptz:?: ; updated_at:timestamptz:!:@now
kcal_foods|key|key:text:!: ; name:text:!: ; k:numeric:!: ; c:numeric:!: ; p:numeric:!: ; f:numeric:!: ; fi:numeric:!:0 ; su:numeric:!:0 ; sf:numeric:!:0 ; q:int2:!:3 ; source:text:!: ; created_at:timestamptz:!:@now
kcal_ice|user_id,day|user_id:uuid:!: ; day:date:!:
kcal_invites|from_id,to_id|from_id:uuid:!:@uid ; to_id:uuid:!: ; created_at:timestamptz:!:@now
kcal_meals|id|id:uuid:!:@uuid ; user_id:uuid:!:@uid ; day:date:!: ; ts:timestamptz:!:@now ; title:text:!: ; emoji:text:?: ; source:text:?: ; kcal:int4:!:0 ; carbs:numeric:!:0 ; protein:numeric:!:0 ; fat:numeric:!:0 ; grams:int4:?: ; code:text:?: ; said:text:?: ; items:jsonb:?: ; note:text:?: ; created_at:timestamptz:!:@now
kcal_profile|user_id|user_id:uuid:!:@uid ; enabled:bool:!:false ; goal:int4:!:2500 ; share:bool:!:true ; remind:bool:!:true ; flame:int4:!:0 ; flame_day:date:?: ; best:int4:!:0 ; last_remind_at:timestamptz:?: ; last_remind_kind:text:?: ; updated_at:timestamptz:!:@now ; protein:int2:?: ; carbs:int2:?: ; fat:int2:?: ; ice:int2:!:0 ; fpush:bool:!:true ; show:_text:?: ; pins:jsonb:!:[]
kcal_recipes|id|id:uuid:!:@uuid ; user_id:uuid:!:@uid ; author:text:?: ; name:text:!: ; emoji:text:!:🍽️ ; items:jsonb:!: ; grams:numeric:!: ; kcal:int4:!: ; carbs:numeric:!:0 ; protein:numeric:!:0 ; fat:numeric:!:0 ; created_at:timestamptz:!:@now
kcal_weights|id|id:uuid:!:@uuid ; user_id:uuid:!: ; ts:timestamptz:!:@now ; day:date:!: ; kg:numeric:!: ; fasted:bool:?: ; pooped:bool:?: ; created_at:timestamptz:!:@now
kv|user_id,path|user_id:uuid:!: ; path:text:!: ; data:jsonb:!: ; updated_at:timestamptz:!:@now
shop_answers|ask_id,user_id|ask_id:uuid:!: ; user_id:uuid:!:@uid ; answer:text:!: ; amount:text:?: ; created_at:timestamptz:!:@now
shop_asks|id|id:uuid:!:@uuid ; list_id:uuid:!: ; item_id:uuid:?: ; kind:text:!: ; from_id:uuid:!:@uid ; created_at:timestamptz:!:@now
shop_items|id|id:uuid:!:@uuid ; list_id:uuid:!: ; kind:text:!:'product' ; parent:uuid:?: ; name:text:!: ; amount:text:?: ; code:text:?: ; added_by:uuid:!: ; claimed_by:uuid:?: ; done_by:uuid:?: ; done_at:timestamptz:?: ; updated_by:uuid:?: ; updated_at:timestamptz:!:@now ; created_at:timestamptz:!:@now
shop_lists|id|id:uuid:!:@uuid ; owner:uuid:!: ; name:text:!: ; created_at:timestamptz:!:@now
shop_members|list_id,user_id|list_id:uuid:!: ; user_id:uuid:!: ; created_at:timestamptz:!:@now
tipp_admins|user_id|user_id:uuid:!:
tipp_events|id|id:text:!: ; sport:text:!: ; comp:text:!: ; name:text:?: ; home:text:?: ; away:text:?: ; home_logo:text:?: ; away_logo:text:?: ; home_id:text:?: ; away_id:text:?: ; start_at:timestamptz:!: ; state:text:!:'pre' ; clock:text:?: ; score_h:int4:?: ; score_a:int4:?: ; stats:jsonb:!:{} ; markets:jsonb:!:[] ; model:jsonb:?: ; odds_src:text:?: ; odds_at:timestamptz:?: ; result:jsonb:?: ; settled:bool:!:false ; fav:bool:!:false ; meta:jsonb:!:{} ; created_by:uuid:?: ; updated_at:timestamptz:!:@now
tipp_groups|id|id:uuid:!:@uuid ; code:text:!:@code ; name:text:!: ; owner:uuid:!: ; comps:_text:!:{} ; created_at:timestamptz:!:@now
tipp_members|group_id,user_id|group_id:uuid:!: ; user_id:uuid:!: ; joined_at:timestamptz:!:@now
tipp_picks|id|id:int8:!:@identity ; user_id:uuid:?: ; bot:text:?: ; event_id:text:!: ; sh:int4:?: ; sa:int4:?: ; w:text:?: ; created_at:timestamptz:!:@now ; updated_at:timestamptz:!:@now
tipp_tips|id|id:int8:!:@identity ; user_id:uuid:?: ; bot:text:?: ; event_id:text:!: ; market:text:!: ; pick:text:!: ; label:text:?: ; stake:int4:!: ; odds:numeric:!: ; status:text:!:'open' ; payout:int4:!:0 ; claimed:bool:!:false ; created_at:timestamptz:!:@now ; settled_at:timestamptz:?:
`;

/* Tables that exist only as SQL files in the repository and are NOT in the real database yet.
   They are left out unless the server is started with FAKE_PENDING=1 (to try the feature as it will be). */
const PENDING = `
kcal_claps|from_id,to_id,day|from_id:uuid:!:@uid ; to_id:uuid:!: ; day:date:!: ; created_at:timestamptz:!:@now
`;

/* Functions callable through /rest/v1/rpc, with their argument names ("?" = has a default). */
const RPCS = {
  chess_gift_send: ["targets", "gift"], events_summary: ["days?"], kcal_buy_ice: [], fairplay_sorry: ["fid"], kcal_foods_lookup: ["names"], kcal_can_see: ["owner"], kcal_invite: ["target"],
  news_broadcast: ["nid"], news_delete: ["nid"], news_is_admin: [], news_post: ["t", "b", "a?"], news_post_v: ["t", "b", "a?", "v?"], news_reshow: ["nid"],
  nudge_turn: ["target", "code"], push_config: [], ranked_leave: [], ranked_lobby: [], ranked_me: [], ranked_queue: ["tc", "hint?"],
  ranked_report: ["mid", "res", "why?"], ranked_top: ["c", "n?"], shop_can: ["l"], shop_owns: ["l"],
  tipp_admin_event: ["p"], tipp_admin_nudge: ["p_event", "p_title", "p_body"], tipp_board: [], tipp_board_group: ["p_group"], tipp_claim: [],
  tipp_event_picks: ["p_event"], tipp_event_tips: ["p_event"], tipp_final: ["p_event"], tipp_group_save: ["p_id", "p_name", "p_comps"], tipp_groups_mine: [],
  tipp_join: ["p_code"], tipp_leave: ["p_id"], tipp_lines: ["p_event", "p_final"], tipp_live: ["p_event", "p_title"], tipp_notify: ["p_event", "p_title", "p_body"],
  tipp_pick: ["p_event", "p_h?", "p_a?", "p_w?"], tipp_place: ["p_event", "p_market", "p_pick", "p_stake", "p_score?"], tipp_remind: ["p_event", "p_title", "p_body"],
  tipp_settle: ["p_event", "p_res"], tipp_table: [],
  home_can: ["g"], home_owns: ["g"], home_answer: ["p_task", "p_yes"], home_done: ["p_task"],
  home_tick: [] /* not callable in the real database (there a trigger and a cron job do this); the tests use it to let time pass */
};

/* Tables in the supabase_realtime publication: only these send live changes. */
const REALTIME = ["chess_friends", "chess_duels", "chess_gifts", "chess_invites", "chess_messages", "kcal_meals", "shop_items", "shop_asks", "shop_answers", "home_tasks", "home_thanks"];

/* Foreign keys that matter for behaviour (the rest point at auth.users). [table, column, target table, target column, on delete] */
const FKS = [
  ["home_members", "group_id", "home_groups", "id", "cascade"], ["home_tasks", "group_id", "home_groups", "id", "cascade"], ["home_log", "group_id", "home_groups", "id", "cascade"], ["home_thanks", "task_id", "home_tasks", "id", "cascade"],
  ["shop_members", "list_id", "shop_lists", "id", "cascade"], ["shop_items", "list_id", "shop_lists", "id", "cascade"], ["shop_items", "parent", "shop_items", "id", "cascade"],
  ["shop_asks", "list_id", "shop_lists", "id", "cascade"], ["shop_asks", "item_id", "shop_items", "id", "cascade"], ["shop_answers", "ask_id", "shop_asks", "id", "cascade"],
  ["tipp_picks", "event_id", "tipp_events", "id", "restrict"], ["tipp_tips", "event_id", "tipp_events", "id", "restrict"], ["tipp_members", "group_id", "tipp_groups", "id", "cascade"]
];

function parse(text){
  const out = {};
  text.trim().split("\n").filter(Boolean).forEach(line => {
    const [name, pk, cols] = line.split("|"); const c = {};
    cols.split(" ; ").forEach(s => { const i = s.indexOf(":"), j = s.indexOf(":", i + 1), k = s.indexOf(":", j + 1);
      c[s.slice(0, i)] = {type: s.slice(i + 1, j), nullable: s.slice(j + 1, k) === "?", def: s.slice(k + 1)}; });
    out[name] = {name, pk: pk.split(","), cols: c};
  });
  return out;
}
module.exports = {tables: pending => Object.assign(parse(TABLES), pending ? parse(PENDING) : {}), RPCS, REALTIME, FKS};
