// Dastavez service worker: makes the site installable, fast on repeat visits, and usable offline.
//  - Built JS/CSS (/_nuxt/*, hashed names): cache first.
//  - Pages and content API: network first, saved copy when offline. So any guide opened once works offline.
//  - Accounts (/api/auth, /api/me): never cached.
const VERSION = "v1";
const STATIC = `dz-static-${VERSION}`;
const PAGES = `dz-pages-${VERSION}`;
const PRECACHE = ["/offline.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Signing out removes saved pages, since they can contain the signed-in user's name and saved guides.
self.addEventListener("message", (event) => {
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGES));
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? (fallbackUrl ? caches.match(fallbackUrl) : Response.error());
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(STATIC)).put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/auth") || url.pathname.startsWith("/api/me")) return;

  if (url.pathname.startsWith("/_nuxt/") || PRECACHE.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/offline.html"));
  } else if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_payload")) {
    event.respondWith(networkFirst(request));
  }
});
