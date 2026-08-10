/*
 * Service worker for /tools/pickle-point-pal only.
 *
 * Court wifi is unreliable, so the app shell has to survive going offline. The
 * strategy is deliberately conservative, because a scorekeeper serving a stale
 * build is worse than one that needs a reload:
 *
 *   - Hashed build assets (/_next/static/**) are immutable, so cache-first.
 *   - Navigations are network-first with a cached fallback, so a deploy is
 *     picked up as soon as there's a connection.
 *   - Nothing else is touched. The match itself lives in localStorage, not here.
 */
const CACHE = "jb-pickle-point-pal-v1";
const SHELL = "/tools/pickle-point-pal";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(SHELL, copy)).catch(() => {});
          return response;
        })
        .catch(() =>
          caches.match(SHELL).then((cached) => cached || Response.error())
        )
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
            return response;
          })
      )
    );
  }
});
