/* A small in-memory stand-in for the Chess.nat database that answers like PostgREST:
   same URLs, filters, status codes and error codes, the real tables and columns (schema.js) and the real rules (rules.js). */
const crypto = require("crypto");
const schema = require("./schema");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const err = (status, code, message, details = null, hint = null) => ({status, body: {code, details, hint, message}});
const NUMERIC = ["int2", "int4", "int8", "float8", "numeric"];

class DB {
  constructor({pending = false} = {}){
    this.tables = schema.tables(pending); this.rows = {}; this.seq = {}; this.users = []; this.admins = []; this.listeners = []; this.problems = []; this.calls = [];
    Object.keys(this.tables).forEach(t => { this.rows[t] = []; this.seq[t] = 0; });
    this.rules = require("./rules")(this); this._now = null;
  }
  /* now() is the same for everything one request does, like inside one transaction */
  now(){ return this._now || new Date().toISOString().replace("Z", "+00:00"); }
  nextId(t){ return ++this.seq[t]; }
  onChange(fn){ this.listeners.push(fn); }
  emit(table, type, row, old){ if (schema.REALTIME.includes(table)) this.listeners.forEach(fn => fn({table, type, row, old, pk: this.tables[table].pk, cols: this.tables[table].cols})); }
  /* what went wrong on the database side: every error answer is kept, so a test run can list them */
  note(req, e){ this.problems.push({at: new Date().toISOString(), req, status: e.status, code: e.body && e.body.code, message: e.body && (e.body.message || e.body.msg)}); }

  /* ---- values ---- */
  coerce(table, col, v){
    const c = this.tables[table].cols[col], bad = (code, msg) => { throw err(400, code, msg); };
    if (v === null || v === undefined) return null;
    switch (c.type){
      case "uuid": if (typeof v !== "string" || !UUID.test(v)) bad("22P02", `invalid input syntax for type uuid: "${v}"`); return v.toLowerCase();
      case "int2": case "int4": case "int8": {
        const n = typeof v === "number" ? v : typeof v === "string" && /^\s*-?\d+\s*$/.test(v) ? Number(v) : NaN;
        if (!Number.isInteger(n)) bad("22P02", `invalid input syntax for type ${c.type === "int2" ? "smallint" : c.type === "int4" ? "integer" : "bigint"}: "${v}"`);
        if (c.type === "int2" && Math.abs(n) > 32767) bad("22003", "smallint out of range"); if (c.type === "int4" && Math.abs(n) > 2147483647) bad("22003", "integer out of range"); return n; }
      case "float8": case "numeric": { const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN; if (!Number.isFinite(n)) bad("22P02", `invalid input syntax for type ${c.type === "numeric" ? "numeric" : "double precision"}: "${v}"`); return n; }
      case "bool": if (typeof v === "boolean") return v; if (v === "true" || v === "t") return true; if (v === "false" || v === "f") return false; bad("22P02", `invalid input syntax for type boolean: "${v}"`); break;
      case "date": if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v) || isNaN(Date.parse(v.slice(0, 10)))) bad("22007", `invalid input syntax for type date: "${v}"`); return v.slice(0, 10);
      case "timestamptz": { const t = typeof v === "string" ? Date.parse(v) : NaN; if (isNaN(t)) bad("22007", `invalid input syntax for type timestamp with time zone: "${v}"`); return new Date(t).toISOString().replace("Z", "+00:00"); }
      case "jsonb": return v;
      case "_text": if (typeof v === "string" && /^\{.*\}$/.test(v)) return v.slice(1, -1) ? v.slice(1, -1).split(",").map(s => s.replace(/^"|"$/g, "")) : [];
        if (!Array.isArray(v)) bad("22P02", `malformed array literal: "${typeof v === "object" ? JSON.stringify(v) : v}"`); return v.map(String);
      default: return typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
    }
  }
  def(table, col, uid){
    const c = this.tables[table].cols[col], d = c.def;
    if (d === "") return null; if (d === "@now") return this.now(); if (d === "@uid") return uid; if (d === "@uuid") return crypto.randomUUID(); if (d === "@identity") return this.nextId(table);
    if (d === "@code") return crypto.randomBytes(4).toString("hex"); if (d === "@generated") return null;
    if (c.type === "_text") return []; if (c.type === "jsonb") return JSON.parse(d); if (c.type === "bool") return d === "true"; if (NUMERIC.includes(c.type)) return Number(d);
    return d.replace(/^'|'$/g, "");
  }
  key(table, r){ return this.tables[table].pk.map(k => r[k]).join("\u0001"); }
  validate(table, r){
    const T = this.tables[table], gen = this.rules.GENERATED[table] || {}; Object.keys(gen).forEach(c => { r[c] = gen[c](r); });
    for (const c of Object.keys(T.cols)) if (r[c] == null && !T.cols[c].nullable) throw err(400, "23502", `null value in column "${c}" of relation "${table}" violates not-null constraint`, "Failing row contains (" + Object.keys(T.cols).map(k => r[k] == null ? "null" : typeof r[k] === "object" ? JSON.stringify(r[k]) : r[k]).join(", ").slice(0, 300) + ").");
    for (const [name, ok] of this.rules.CHECKS[table] || []) if (!ok(r)) throw err(400, "23514", `new row for relation "${table}" violates check constraint "${name}"`, "Failing row contains (…).");
    for (const [t, col, tt, tc] of schema.FKS) if (t === table && r[col] != null && !this.rows[tt].some(x => x[tc] === r[col])) throw err(409, "23503", `insert or update on table "${table}" violates foreign key constraint "${table}_${col}_fkey"`, `Key (${col})=(${r[col]}) is not present in table "${tt}".`);
    for (const uc of ["user_id", "owner", "from_id", "to_id", "added_by", "a", "b"]) if (T.cols[uc] && T.cols[uc].type === "uuid" && r[uc] != null && !this.users.some(u => u.id === r[uc]))
      throw err(409, "23503", `insert or update on table "${table}" violates foreign key constraint "${table}_${uc}_fkey"`, `Key (${uc})=(${r[uc]}) is not present in table "users".`);
  }
  unique(table, r, self){
    const pk = this.tables[table].pk;
    if (this.rows[table].some(x => x !== self && pk.every(k => x[k] === r[k]))) throw err(409, "23505", `duplicate key value violates unique constraint "${table}_pkey"`, `Key (${pk.join(", ")})=(${pk.map(k => r[k]).join(", ")}) already exists.`);
    for (const [name, cols] of this.rules.UNIQUE[table] || []) if (cols.every(c => r[c] != null) && this.rows[table].some(x => x !== self && cols.every(c => x[c] === r[c])))
      throw err(409, "23505", `duplicate key value violates unique constraint "${name}"`, `Key (${cols.join(", ")})=(${cols.map(c => r[c]).join(", ")}) already exists.`);
  }
  /* ---- row level security ---- */
  can(table, cmd, row, uid, part){
    if (uid === "service") return true; if (!uid) return false;
    const P = this.rules.POLICIES[table] || {}, p = P[cmd] || P.all; if (!p) return false;
    if (typeof p === "function") return !!p(row, uid); return !!p[part || "using"](row, uid);
  }
  rls(table){ return err(403, "42501", `new row violates row-level security policy for table "${table}"`); }
  remove(table, row){
    const i = this.rows[table].indexOf(row); if (i < 0) return; this.rows[table].splice(i, 1); this.emit(table, "DELETE", null, row);
    const trg = this.rules.TRIGGERS[table]; if (trg) trg("DELETE", null, row);
    for (const [t, col, tt, tc, on] of schema.FKS) if (tt === table && on === "cascade") this.rows[t].filter(x => x[col] === row[tc]).forEach(x => this.remove(t, x));
  }

  /* ---- reading the request ---- */
  col(table, name){ const c = name.split("->")[0].split("::")[0]; if (!this.tables[table].cols[c]) throw err(400, "42703", `column ${table}.${c} does not exist`); return c; }
  split(s){ const out = []; let d = 0, cur = "", q = false; for (const ch of s){ if (ch === '"') q = !q; if (!q && ch === "(") d++; if (!q && ch === ")") d--; if (ch === "," && !d && !q){ out.push(cur); cur = ""; } else cur += ch; } if (cur !== "") out.push(cur); return out; }
  cond(table, colName, expr){
    const col = this.col(table, colName), type = this.tables[table].cols[col].type; let not = false;
    if (expr.startsWith("not.")){ not = true; expr = expr.slice(4); }
    const i = expr.indexOf("."), op = i < 0 ? expr : expr.slice(0, i), raw = i < 0 ? "" : expr.slice(i + 1);
    const val = s => { s = s.replace(/^"(.*)"$/, "$1"); return type === "jsonb" || type === "_text" ? s : this.coerce(table, col, s); };
    const cmp = (a, b) => type === "timestamptz" ? Date.parse(a) - Date.parse(b) : NUMERIC.includes(type) ? a - b : a < b ? -1 : a > b ? 1 : 0;
    let f;
    switch (op){
      case "eq": { const v = val(raw); f = r => r[col] != null && cmp(r[col], v) === 0; break; }
      case "neq": { const v = val(raw); f = r => r[col] != null && cmp(r[col], v) !== 0; break; }
      case "gt": { const v = val(raw); f = r => r[col] != null && cmp(r[col], v) > 0; break; }
      case "gte": { const v = val(raw); f = r => r[col] != null && cmp(r[col], v) >= 0; break; }
      case "lt": { const v = val(raw); f = r => r[col] != null && cmp(r[col], v) < 0; break; }
      case "lte": { const v = val(raw); f = r => r[col] != null && cmp(r[col], v) <= 0; break; }
      case "is": { const v = raw.toLowerCase(); if (!["null", "true", "false"].includes(v)) throw err(400, "PGRST100", `failed to parse filter (${expr})`); f = v === "null" ? r => r[col] == null : r => r[col] === (v === "true"); break; }
      case "in": { if (!/^\(.*\)$/.test(raw)) throw err(400, "PGRST100", `failed to parse filter (${expr})`); const vs = raw.slice(1, -1) === "" ? [] : this.split(raw.slice(1, -1)).map(val); f = r => r[col] != null && vs.some(v => cmp(r[col], v) === 0); break; }
      case "like": case "ilike": { const re = new RegExp("^" + raw.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*|%/g, ".*").replace(/_/g, ".") + "$", op === "ilike" ? "i" : ""); f = r => r[col] != null && re.test(String(r[col])); break; }
      case "cs": { const vs = JSON.parse(raw.replace(/^\{/, "[").replace(/\}$/, "]").replace(/([^,\[\]"]+)/g, '"$1"')); f = r => Array.isArray(r[col]) && vs.every(v => r[col].includes(v)); break; }
      default: throw err(400, "PGRST100", `unexpected "${op}" expecting operator (eq, gte, gt, lte, lt, neq, like, ilike, in, is, …)`);
    }
    return not ? r => !f(r) : f;
  }
  logic(table, s, isOr){ /* "(a.eq.1,and(b.eq.2,c.eq.3))" */
    const parts = this.split(s.replace(/^\(|\)$/g, "")).map(p => { const m = /^(and|or)(\(.*\))$/.exec(p); if (m) return this.logic(table, m[2], m[1] === "or"); const i = p.indexOf("."); return this.cond(table, p.slice(0, i), p.slice(i + 1)); });
    return isOr ? r => parts.some(f => f(r)) : r => parts.every(f => f(r));
  }
  where(table, q){
    const fs = [];
    for (const [k, v] of q){ if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
      if (k === "or" || k === "and") fs.push(this.logic(table, v, k === "or")); else if (k.includes(".")) continue; else fs.push(this.cond(table, k, v)); }
    return r => fs.every(f => f(r));
  }
  /* select=*,other(*) : columns, and rows of a related table embedded through a foreign key */
  shape(table, sel, uid){
    const parts = this.split(sel || "*").map(s => s.trim()).filter(Boolean), cols = [], emb = [];
    for (const p of parts){
      const m = /^(?:(\w+):)?(\w+)(?:!\w+)?\((.*)\)$/.exec(p);
      if (m){ const other = m[2]; if (!this.tables[other]) throw err(400, "PGRST200", `Could not find a relationship between '${table}' and '${other}' in the schema cache`);
        const down = schema.FKS.find(f => f[0] === other && f[2] === table), up = schema.FKS.find(f => f[0] === table && f[2] === other);
        if (!down && !up) throw err(400, "PGRST200", `Could not find a relationship between '${table}' and '${other}' in the schema cache`, `Searched for a foreign key relationship between '${table}' and '${other}' in the schema 'public', but no matches were found.`);
        emb.push({as: m[1] || other, other, down, up, inner: this.shape(other, m[3], uid)}); continue; }
      if (p === "*"){ cols.push("*"); continue; }
      const a = /^(?:(\w+):)?([\w>\-]+)(?:::\w+)?$/.exec(p); if (!a) throw err(400, "PGRST100", `failed to parse select parameter (${sel})`);
      cols.push({as: a[1] || a[2], col: this.col(table, a[2])});
    }
    return r => { const o = {};
      for (const c of cols){ if (c === "*") Object.keys(this.tables[table].cols).forEach(k => { o[k] = r[k]; }); else o[c.as] = r[c.col]; }
      for (const e of emb){ const vis = x => this.can(e.other, "select", x, uid);
        if (e.down) o[e.as] = this.rows[e.other].filter(x => x[e.down[1]] === r[e.down[3]] && vis(x)).map(e.inner);
        else { const x = this.rows[e.other].find(x => x[e.up[3]] === r[e.up[1]] && vis(x)); o[e.as] = x ? e.inner(x) : null; } }
      return o; };
  }
  order(table, s){
    const ks = (s || "").split(",").filter(Boolean).map(k => { const [c, ...f] = k.split("."); const desc = f.includes("desc"); return {c: this.col(table, c), desc, nf: f.includes("nullsfirst") || (desc && !f.includes("nullslast")), type: this.tables[table].cols[this.col(table, c)].type}; });
    return (a, b) => { for (const k of ks){ const x = a[k.c], y = b[k.c]; if (x == null && y == null) continue; if (x == null) return k.nf ? -1 : 1; if (y == null) return k.nf ? 1 : -1;
      const d = k.type === "timestamptz" ? Date.parse(x) - Date.parse(y) : typeof x === "number" ? x - y : x < y ? -1 : x > y ? 1 : 0; if (d) return k.desc ? -d : d; } return 0; };
  }

  /* ---- one /rest/v1/<table> request ---- */
  rest(method, table, q, body, headers, uid){
    this._now = new Date().toISOString().replace("Z", "+00:00");
    try { return this._rest(method, table, q, body, headers, uid); } finally { this._now = null; }
  }
  _rest(method, table, q, body, headers, uid){
    if (!this.tables[table]) throw err(404, "PGRST205", `Could not find the table 'public.${table}' in the schema cache`);
    const T = this.tables[table], R = this.rows[table], prefer = String(headers.prefer || ""), want = /return=representation/.test(prefer);
    const single = /vnd\.pgrst\.object/.test(String(headers.accept || "")), sel = q.get("select");
    const out = (rows, status) => {
      if (!want && method !== "GET" && method !== "HEAD") return {status: method === "POST" ? 201 : 204, body: null};
      const shape = this.shape(table, sel, uid); let res = rows.map(shape);
      if (single){ if (res.length !== 1) throw err(406, "PGRST116", "JSON object requested, multiple (or no) rows returned", `The result contains ${res.length} rows`); res = res[0]; }
      return {status, body: res, count: rows.length};
    };
    if (method === "GET" || method === "HEAD"){
      const f = this.where(table, q); this.shape(table, sel, uid);
      let rows = R.filter(r => this.can(table, "select", r, uid) && f(r)); const total = rows.length;
      if (q.get("order")) rows = rows.slice().sort(this.order(table, q.get("order")));
      const off = Number(q.get("offset") || 0), lim = q.get("limit") != null ? Number(q.get("limit")) : 1000; rows = rows.slice(off, off + Math.min(lim, 1000));
      const r = out(rows, 200); r.total = total; return r;
    }
    if (method === "POST"){
      const list = Array.isArray(body) ? body : [body], upsert = /resolution=merge-duplicates/.test(prefer), ignore = /resolution=ignore-duplicates/.test(prefer);
      const conflict = (q.get("on_conflict") || T.pk.join(",")).split(","), done = [], todo = [];
      /* PostgREST takes the columns of the first object for every row of a bulk insert */
      const keys = Object.keys(list[0] || {});
      if (!list.length || list.some(o => !o || typeof o !== "object")) throw err(400, "PGRST102", "Empty or invalid json");
      for (const o of list) for (const k of Object.keys(o)) if (!T.cols[k]) throw err(400, "PGRST204", `Could not find the '${k}' column of '${table}' in the schema cache`);
      /* supabase-js sends columns=<all keys> with a bulk insert: a key missing in one row is then NULL for that row (not the default) */
      const named = q.get("columns") ? q.get("columns").split(",").map(s => s.replace(/"/g, "")) : null;
      if (named) named.forEach(k => { if (!T.cols[k]) throw err(400, "PGRST204", `Could not find the '${k}' column of '${table}' in the schema cache`); });
      if (!named && list.length > 1 && list.some(o => Object.keys(o).length !== keys.length || Object.keys(o).some(k => !keys.includes(k)))) throw err(400, "PGRST102", "All object keys must match");
      if (named) list.forEach(o => named.forEach(k => { if (!(k in o)) o[k] = null; }));
      for (const o of list){
        const r = {}; for (const c of Object.keys(T.cols)){ if (T.cols[c].def === "@generated") { if (c in o) throw err(400, "428C9", `cannot insert a non-DEFAULT value into column "${c}"`, `Column "${c}" is a generated column.`); continue; }
          r[c] = c in o && o[c] !== undefined ? this.coerce(table, c, o[c]) : this.def(table, c, uid === "service" ? null : uid);
          if (c in o && o[c] === null) r[c] = null; }
        const ex = R.find(x => conflict.every(k => x[k] === r[k]));
        if (ex && ignore) continue;
        if (ex && upsert){
          if (!this.can(table, "insert", r, uid)) throw this.rls(table);
          if (!this.can(table, "select", ex, uid) || !this.can(table, "update", ex, uid, "using")) throw this.rls(table);
          const n = Object.assign({}, ex); for (const k of Object.keys(o)) if (!conflict.includes(k)) n[k] = r[k];
          this.validate(table, n); this.unique(table, n, ex); if (!this.can(table, "update", n, uid, "check")) throw this.rls(table);
          todo.push(() => { const old = Object.assign({}, ex); Object.assign(ex, n); done.push(ex); this.emit(table, "UPDATE", ex, old); const t = this.rules.TRIGGERS[table]; if (t) t("UPDATE", ex, old); }); continue;
        }
        this.validate(table, r); this.unique(table, r, null);
        if (todo.some(t => t.row && T.pk.every(k => t.row[k] === r[k]))) throw err(409, "23505", `duplicate key value violates unique constraint "${table}_pkey"`);
        if (!this.can(table, "insert", r, uid)) throw this.rls(table);
        const fn = () => { R.push(r); done.push(r); this.emit(table, "INSERT", r, null); const t = this.rules.TRIGGERS[table]; if (t) t("INSERT", r, null); }; fn.row = r; todo.push(fn);
      }
      todo.forEach(f => f());
      if (want && done.some(r => !this.can(table, "select", r, uid))) throw this.rls(table);
      return out(done, 201);
    }
    if (method === "PATCH"){
      if (!body || typeof body !== "object" || Array.isArray(body)) throw err(400, "PGRST102", "Empty or invalid json");
      for (const k of Object.keys(body)){ if (!T.cols[k]) throw err(400, "PGRST204", `Could not find the '${k}' column of '${table}' in the schema cache`); if (T.cols[k].def === "@generated") throw err(400, "428C9", `column "${k}" can only be updated to DEFAULT`); }
      const f = this.where(table, q), patch = {}; Object.keys(body).forEach(k => { patch[k] = this.coerce(table, k, body[k]); });
      const hit = R.filter(r => this.can(table, "select", r, uid) && this.can(table, "update", r, uid, "using") && f(r)), next = hit.map(r => Object.assign({}, r, patch));
      next.forEach((n, i) => { this.validate(table, n); this.unique(table, n, hit[i]); if (!this.can(table, "update", n, uid, "check")) throw this.rls(table); });
      hit.forEach((r, i) => { const old = Object.assign({}, r); Object.assign(r, next[i]); this.emit(table, "UPDATE", r, old); const t = this.rules.TRIGGERS[table]; if (t) t("UPDATE", r, old); });
      return out(hit, 200);
    }
    if (method === "DELETE"){
      const f = this.where(table, q), hit = R.filter(r => this.can(table, "select", r, uid) && this.can(table, "delete", r, uid) && f(r));
      const copy = hit.map(r => Object.assign({}, r)); hit.forEach(r => this.remove(table, r)); return out(copy, 200);
    }
    throw err(405, "PGRST117", "Unsupported HTTP method: " + method);
  }
  rpc(name, args, uid){
    const sig = schema.RPCS[name], miss = () => err(404, "PGRST202", `Could not find the function public.${name}${args && Object.keys(args).length ? "(" + Object.keys(args).sort().join(", ") + ")" : " without parameters"} in the schema cache`, "Searched for the function public." + name + " with the given parameters, but no matches were found in the schema cache.");
    if (!sig) throw miss();
    const names = sig.map(s => s.replace("?", "")); args = args || {};
    if (Object.keys(args).some(k => !names.includes(k)) || sig.some(s => !s.endsWith("?") && !(s in args))) throw miss();
    this._now = new Date().toISOString().replace("Z", "+00:00");
    try { const fn = this.rules.RPC[name]; const v = fn ? fn(uid === "service" ? null : uid, args) : null; return {status: v === null || v === undefined ? 204 : 200, body: v === undefined ? null : v}; } finally { this._now = null; }
  }
  /* seeding without the rules getting in the way (still validated against the schema) */
  seed(table, rows){ (Array.isArray(rows) ? rows : [rows]).forEach(o => { const r = this.rest("POST", table, new URLSearchParams(), o, {prefer: "return=representation"}, "service"); return r; }); }
}
module.exports = {DB, err};
