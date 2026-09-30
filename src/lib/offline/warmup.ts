import { getInflight } from "./status.ts";

const SKIP_DATA_WARM = ["/chat"]; // opening chat marks messages read - never do that automatically
const LAST_KEY = "naha-offline-prepared-at";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const lastPreparedAt = (): number | null => {
  try { return Number(localStorage.getItem(LAST_KEY)) || null; } catch { return null; }
};

export function registerServiceWorker() {
  if (typeof window === "undefined" || !import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

/** Ask the service worker to save the HTML of these pages for offline reloads. */
async function precachePages(urls: string[]): Promise<void> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const reg = await Promise.race([navigator.serviceWorker.ready, sleep(4000).then(() => null)]);
  const sw = reg?.active;
  if (!sw) return;
  await new Promise<void>((resolve) => {
    const ch = new MessageChannel();
    const t = setTimeout(resolve, 30000);
    ch.port1.onmessage = () => { clearTimeout(t); resolve(); };
    sw.postMessage({ type: "PRECACHE_PAGES", urls }, [ch.port2]);
  });
}

async function waitForIdle(maxMs = 10000) {
  await sleep(400); // let the page's effects fire their requests
  const start = Date.now(); let quiet = 0;
  while (Date.now() - start < maxMs && quiet < 3) { quiet = getInflight() === 0 ? quiet + 1 : 0; await sleep(100); }
}

const DYNAMIC_ROUTES: { to: string; params: Record<string, string> }[] = [
  { to: "/clients/$id", params: { id: "x" } }, { to: "/hr/$id", params: { id: "x" } },
  { to: "/audit/$id", params: { id: "x" } }, { to: "/accounts/$id", params: { id: "x" } },
  { to: "/team/$id", params: { id: "x" } }, { to: "/tax/$type", params: { type: "x" } },
];

/** Quiet background step: page HTML + code for every screen. Never navigates. */
export async function warmLight(router: any, paths: string[]) {
  try {
    await precachePages(["/", "/dashboard", ...paths]);
    for (const to of paths) { await router.preloadRoute({ to }).catch(() => {}); await sleep(120); }
    for (const r of DYNAMIC_ROUTES) { await router.preloadRoute(r as any).catch(() => {}); await sleep(120); }
  } catch { /* best effort */ }
}

/**
 * Full "prepare for offline": light step, then opens each screen once so its
 * data is saved on the device, then returns to where the user was.
 */
export async function prepareForOffline(router: any, paths: string[], onProgress: (done: number, total: number) => void) {
  const dataPaths = paths.filter((p) => !SKIP_DATA_WARM.includes(p));
  const total = dataPaths.length + 1;
  const back = window.location.pathname + window.location.search + window.location.hash;
  await warmLight(router, paths);
  onProgress(1, total);
  let done = 1;
  try {
    for (const to of dataPaths) {
      await router.navigate({ to }).catch(() => {});
      await waitForIdle();
      onProgress(++done, total);
    }
  } finally {
    router.history.push(back);
    try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch { /* ignore */ }
  }
}

/** Once per 24h, quietly, after the app has settled. */
export function scheduleBackgroundWarm(router: any, paths: string[]) {
  const last = lastPreparedAt();
  const lightKey = "naha-offline-light-at";
  let lastLight = 0; try { lastLight = Number(localStorage.getItem(lightKey)) || 0; } catch { /* ignore */ }
  if (Date.now() - Math.max(last ?? 0, lastLight) < 24 * 3600 * 1000) return () => {};
  const t = setTimeout(() => {
    if (!navigator.onLine) return;
    void warmLight(router, paths).then(() => { try { localStorage.setItem(lightKey, String(Date.now())); } catch { /* ignore */ } });
  }, 8000);
  return () => clearTimeout(t);
}
