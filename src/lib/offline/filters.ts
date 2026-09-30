/**
 * Pure helpers that let a queued offline write show up immediately in the
 * locally cached query results (so a task you add offline appears in the list).
 * Understands the common PostgREST filters (eq, neq, gt, gte, lt, lte, like,
 * ilike, in, is, not.*), order, limit. Anything it does not understand makes it
 * leave that cached result untouched - it never guesses.
 */
export type Row = Record<string, any>;
export type Filter = { col: string; op: string; value: string; negate: boolean };
export type OrderTerm = { col: string; desc: boolean; nullsFirst: boolean };
export type ParsedQuery = {
  filters: Filter[]; order: OrderTerm[]; limit: number | null; offset: number | null;
  select: string | null; unsupported: boolean;
};
export type Op =
  | { kind: "insert"; rows: Row[] }
  | { kind: "update"; where: ParsedQuery; patch: Row }
  | { kind: "delete"; where: ParsedQuery };

const OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in", "is"];

function parseOrder(val: string): OrderTerm[] {
  return val.split(",").filter(Boolean).map((t) => {
    const parts = t.split(".");
    const desc = parts.includes("desc");
    const nullsFirst = parts.includes("nullsfirst") ? true : parts.includes("nullslast") ? false : desc;
    return { col: parts[0], desc, nullsFirst };
  });
}

export function parseQuery(url: string): ParsedQuery {
  const u = new URL(url, "http://local");
  const q: ParsedQuery = { filters: [], order: [], limit: null, offset: null, select: u.searchParams.get("select"), unsupported: false };
  u.searchParams.forEach((val, key) => {
    if (key === "select" || key === "columns" || key === "on_conflict") return;
    if (key === "limit") { q.limit = Number(val); return; }
    if (key === "offset") { q.offset = Number(val); return; }
    if (key === "order") { q.order = parseOrder(val); return; }
    if (key === "and" || key === "or" || key.startsWith("not.") || /[.>]/.test(key)) { q.unsupported = true; return; }
    let negate = false; let rest = val;
    if (rest.startsWith("not.")) { negate = true; rest = rest.slice(4); }
    const dot = rest.indexOf(".");
    const op = dot < 0 ? "" : rest.slice(0, dot);
    if (!OPS.includes(op)) { q.unsupported = true; return; }
    q.filters.push({ col: key, op, value: rest.slice(dot + 1), negate });
  });
  return q;
}

function parseList(v: string): string[] {
  const inner = v.replace(/^\(/, "").replace(/\)$/, "");
  const out: string[] = []; let cur = ""; let quoted = false;
  for (const ch of inner) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  if (cur !== "" || out.length) out.push(cur);
  return out;
}

function likeRegex(p: string, ci: boolean) {
  const esc = p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[*%]/g, ".*").replace(/_/g, ".");
  return new RegExp("^" + esc + "$", ci ? "i" : "");
}

function cmp(a: any, b: string): number {
  if (typeof a === "number") return a - Number(b);
  const s = String(a);
  return s < b ? -1 : s > b ? 1 : 0;
}

/** true / false, or null when the row can't answer (column not present). */
function evalFilter(row: Row, f: Filter): boolean | null {
  if (!(f.col in row)) return null;
  const v = row[f.col];
  if (v == null && f.op !== "is") return false; // SQL NULL never matches
  let r: boolean | null;
  switch (f.op) {
    case "is": r = f.value === "null" ? v === null : f.value === "true" ? v === true : f.value === "false" ? v === false : null; break;
    case "eq": r = typeof v === "number" ? v === Number(f.value) : String(v) === f.value; break;
    case "neq": r = typeof v === "number" ? v !== Number(f.value) : String(v) !== f.value; break;
    case "in": r = parseList(f.value).includes(String(v)); break;
    case "gt": r = cmp(v, f.value) > 0; break;
    case "gte": r = cmp(v, f.value) >= 0; break;
    case "lt": r = cmp(v, f.value) < 0; break;
    case "lte": r = cmp(v, f.value) <= 0; break;
    case "like": r = likeRegex(f.value, false).test(String(v)); break;
    case "ilike": r = likeRegex(f.value, true).test(String(v)); break;
    default: r = null;
  }
  return r === null ? null : f.negate ? !r : r;
}

export function rowMatches(row: Row, filters: Filter[]): boolean | null {
  let unknown = false;
  for (const f of filters) {
    const r = evalFilter(row, f);
    if (r === false) return false;
    if (r === null) unknown = true;
  }
  return unknown ? null : true;
}

export function sortRows(rows: Row[], order: OrderTerm[]): Row[] {
  if (!order.length) return rows;
  return [...rows].sort((a, b) => {
    for (const o of order) {
      const x = a[o.col], y = b[o.col];
      const xn = x == null, yn = y == null;
      if (xn && yn) continue;
      if (xn) return o.nullsFirst ? -1 : 1;
      if (yn) return o.nullsFirst ? 1 : -1;
      let c = typeof x === "number" && typeof y === "number" ? x - y : String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0;
      if (o.desc) c = -c;
      if (c) return c;
    }
    return 0;
  });
}

/** Give a new row the same shape as the rows already in a cached result. */
function shape(nr: Row, sample: Row | undefined, now: string): Row {
  if (!sample) return { ...nr };
  const out: Row = {};
  for (const k of Object.keys(sample)) {
    if (k in nr) out[k] = nr[k];
    else if (k === "created_at" || k === "updated_at") out[k] = now;
    else out[k] = null;
  }
  return out;
}

/**
 * Apply a queued write to one cached response body.
 * Returns the new body plus the rows an update/delete touched, or null when
 * nothing changed (or the cached query is too complex to patch safely).
 */
export function applyOp(bodyText: string, entryUrl: string, op: Op, now = new Date().toISOString()): { body: string; matched: Row[] } | null {
  let parsed: any;
  try { parsed = JSON.parse(bodyText); } catch { return null; }
  const single = !Array.isArray(parsed);
  if (single && (parsed === null || typeof parsed !== "object" || ("code" in parsed && "message" in parsed))) return null;
  const rows: Row[] = single ? [parsed] : parsed;
  const q = parseQuery(entryUrl);

  if (op.kind === "insert") {
    if (single || q.unsupported || q.offset) return null;
    let out = [...rows]; let changed = false;
    for (const nr of op.rows) {
      const shaped = shape(nr, rows[0], now);
      if (rowMatches(shaped, q.filters) === true) { out.push(shaped); changed = true; }
    }
    if (!changed) return null;
    out = sortRows(out, q.order);
    if (q.limit != null) out = out.slice(0, q.limit);
    return { body: JSON.stringify(out), matched: [] };
  }

  if (op.where.unsupported || op.where.filters.length === 0) return null; // never patch "everything"
  const matched: Row[] = []; const out: Row[] = [];
  for (const r of rows) {
    if (rowMatches(r, op.where.filters) !== true) { out.push(r); continue; }
    matched.push(r);
    if (op.kind === "delete") continue;
    const merged = { ...r, ...op.patch };
    if (rowMatches(merged, q.filters) === false) continue; // no longer belongs in this result
    out.push(merged);
  }
  if (!matched.length) return null;
  if (single && out.length === 0) return null;
  return { body: JSON.stringify(single ? out[0] : out), matched };
}
