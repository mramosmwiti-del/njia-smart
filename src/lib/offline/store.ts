import { idb } from "./idb.ts";
import { applyOp } from "./filters.ts";
import type { Op, Row } from "./filters.ts";
import { OFFLINE_CONFIG as cfg } from "./config.ts";

export type CacheEntry = {
  key: string; ut: string; userId: string; table: string; method: string; url: string;
  status: number; contentType: string | null; contentRange: string | null; body: string; ts: number;
};

export type OutboxItem = {
  id?: number; userId: string; method: string; url: string; table: string;
  headers: Record<string, string>; body: string | null; ts: number;
  status: "pending" | "failed"; error?: string; injectedId?: boolean; attempts: number;
};

// ---- read cache --------------------------------------------------------------
let puts = 0;
export async function cachePut(e: CacheEntry) {
  await idb.put("cache", e);
  if (++puts % 40 === 0) void idb.trim("cache", "ts", cfg.maxCacheEntries);
}
export const cacheGet = (key: string) => idb.get<CacheEntry>("cache", key);

export function toResponse(e: CacheEntry): Response {
  const h = new Headers();
  if (e.contentType) h.set("content-type", e.contentType);
  if (e.contentRange) h.set("content-range", e.contentRange);
  h.set("x-offline-cache", String(e.ts));
  return new Response(e.method === "HEAD" ? null : e.body, { status: e.status, headers: h });
}

/** Remove columns that must never sit on the device. */
export function redact(table: string, bodyText: string): string {
  const cols = cfg.redactColumns[table];
  if (!cols?.length) return bodyText;
  try {
    const j = JSON.parse(bodyText);
    const strip = (r: any) => { if (r && typeof r === "object") for (const c of cols) delete r[c]; };
    Array.isArray(j) ? j.forEach(strip) : strip(j);
    return JSON.stringify(j);
  } catch { return bodyText; }
}

/** Reflect a queued write in every cached result of that table. */
export async function applyOptimistic(userId: string, table: string, op: Op): Promise<Row[]> {
  const entries = await idb.byIndex<CacheEntry>("cache", "ut", `${userId}|${table}`);
  const matched: Row[] = [];
  for (const e of entries) {
    if (e.method !== "GET") continue;
    const r = applyOp(e.body, e.url, op);
    if (!r) continue;
    for (const m of r.matched) if (!matched.some((x) => x.id !== undefined && x.id === m.id)) matched.push(m);
    await idb.put("cache", { ...e, body: r.body });
  }
  return matched;
}

// ---- outbox ------------------------------------------------------------------
export async function outboxAdd(item: OutboxItem): Promise<number> {
  const id = await idb.put("outbox", item);
  if (id === undefined) throw new Error("Offline storage is unavailable");
  return id as number;
}
export const outboxAll = async () =>
  (await idb.all<OutboxItem>("outbox")).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
export const outboxPut = (item: OutboxItem) => idb.put("outbox", item);
export const outboxDelete = (id: number) => idb.del("outbox", id);

export async function clearAllOfflineData() {
  await idb.clear("cache");
  await idb.clear("outbox");
}
