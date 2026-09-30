/**
 * Tiny observable store: is the server reachable, how many changes are
 * waiting, are we syncing. `navigator.onLine` alone lies (Wi-Fi with no
 * upstream reads "online"), so a failed request also flips `reachable`
 * and a background probe flips it back.
 */
export type FailedInfo = { id: number; method: string; table: string; error: string; ts: number; preview: string };
export type OfflineSnapshot = {
  browserOnline: boolean; reachable: boolean; online: boolean;
  pending: number; failed: FailedInfo[]; syncing: boolean; lastSyncedAt: number | null;
};

let snap: OfflineSnapshot = {
  browserOnline: typeof navigator === "undefined" ? true : navigator.onLine,
  reachable: true, online: true, pending: 0, failed: [], syncing: false, lastSyncedAt: null,
};
const listeners = new Set<() => void>();
let inflight = 0;
let probe: (() => Promise<boolean>) | null = null;
let onReconnect: (() => void) | null = null;
let probeTimer: ReturnType<typeof setInterval> | null = null;
let probeEveryMs = 10_000;

function startProbe() {
  if (probeTimer || !probe) return;
  probeTimer = setInterval(() => { if (snap.browserOnline) void verify(); }, probeEveryMs);
}
function stopProbe() { if (probeTimer) { clearInterval(probeTimer); probeTimer = null; } }

function set(p: Partial<OfflineSnapshot>) {
  const next = { ...snap, ...p };
  next.online = next.browserOnline && next.reachable;
  if ((Object.keys(next) as (keyof OfflineSnapshot)[]).every((k) => next[k] === snap[k])) return;
  const was = snap.online;
  snap = next;
  listeners.forEach((l) => l());
  if (was && !next.online) startProbe();
  if (!was && next.online) { stopProbe(); onReconnect?.(); }
}

async function verify() {
  if (!probe) return;
  let ok = false;
  try { ok = await probe(); } catch { ok = false; }
  set({ reachable: ok });
}

export function initStatus(opts: { probe: () => Promise<boolean>; onReconnect: () => void; probeEveryMs: number }) {
  probe = opts.probe; onReconnect = opts.onReconnect; probeEveryMs = opts.probeEveryMs;
  if (typeof window === "undefined") return;
  window.addEventListener("online", () => { set({ browserOnline: true }); void verify(); });
  window.addEventListener("offline", () => set({ browserOnline: false }));
  if (!snap.browserOnline) startProbe();
}

export const getSnapshot = () => snap;
export const getServerSnapshot = (): OfflineSnapshot => ({ ...snap, browserOnline: true, reachable: true, online: true, pending: 0, failed: [], syncing: false });
export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const isOnline = () => snap.online;
export const markReachable = (v: boolean) => set({ reachable: v });
export const setSyncing = (syncing: boolean) => set({ syncing });
export const setSynced = () => set({ lastSyncedAt: Date.now() });
export function setCounts(pending: number, failed: FailedInfo[]) {
  const same = pending === snap.pending && failed.length === snap.failed.length &&
    failed.every((f, i) => f.id === snap.failed[i].id && f.error === snap.failed[i].error);
  if (!same) set({ pending, failed });
}

/** Count of in-flight data requests (used to know when a page has finished loading). */
export function trackInflight() {
  inflight++; let done = false;
  return () => { if (!done) { done = true; inflight--; } };
}
export const getInflight = () => inflight;
