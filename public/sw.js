/* Service worker: lets the app open with no internet.
   - /assets/* (hashed build files): cache-first
   - pages (HTML): network-first, falls back to the saved copy
   - fonts/images: stale-while-revalidate
   Data (Supabase) is handled inside the app, not here. */
const V = "v1";
const PAGES = "naha-pages-" + V;
const ASSETS = "naha-assets-" + V;
const FONTS = "naha-fonts-" + V;
const KEEP = [PAGES, ASSETS, FONTS];
const pageKey = (u) => { const x = new URL(u, self.location.origin); return x.origin + x.pathname; };

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.add("/offline.html")).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!KEEP.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function cacheFirst(req) {
  const c = await caches.open(ASSETS);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) c.put(req, res.clone());
  return res;
}
async function swr(name, req) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  const net = fetch(req).then((res) => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
}
async function page(req) {
  const c = await caches.open(PAGES);
  const key = pageKey(req.url);
  const net = fetch(req);
  try {
    const res = await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 4000))]);
    if (res.ok && (res.headers.get("content-type") || "").includes("text/html")) c.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(key);
    if (hit) return hit;
    try { return await net; } catch (e) { return (await c.match("/offline.html")) || Response.error(); }
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") { e.respondWith(swr(FONTS, req)); return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js" || url.pathname.startsWith("/_") || url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/assets/")) { e.respondWith(cacheFirst(req)); return; }
  if (req.mode === "navigate") { e.respondWith(page(req)); return; }
  if (["image", "font", "style", "script"].includes(req.destination)) e.respondWith(swr(ASSETS, req));
});

self.addEventListener("message", (e) => {
  if (!e.data || e.data.type !== "PRECACHE_PAGES") return;
  e.waitUntil((async () => {
    const c = await caches.open(PAGES);
    await Promise.allSettled((e.data.urls || []).map(async (u) => {
      const res = await fetch(u, { headers: { accept: "text/html" }, credentials: "same-origin" });
      if (res.ok && (res.headers.get("content-type") || "").includes("text/html")) await c.put(pageKey(u), res);
    }));
    if (e.ports && e.ports[0]) e.ports[0].postMessage({ done: true });
  })());
});
