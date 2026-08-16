/*
 * Service worker for /booking-buddy only (issue #12).
 *
 * One job: receive and display web push notifications, and route a tap on
 * one back into the app. No `fetch` handler — Chrome dropped that from its
 * installability criteria (108 mobile / 112 desktop); an empty pass-through
 * handler added just to satisfy an old checklist is a known anti-pattern
 * (it disables the browser's own HTTP cache reasoning for every request),
 * so this deliberately doesn't add one. No offline caching either, unlike
 * pickle-point-pal-sw.js — that app is a single self-contained scorekeeper
 * where a stale cached shell is harmless; this one is an auth-gated,
 * per-User, database-backed app where caching a navigation response risks
 * serving one User's page to whoever signs in next on a shared device.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "Booking Buddy";
  const url = payload.url || "/booking-buddy";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/brand/JB_Logo.svg",
      badge: "/brand/JB_Logo.svg",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/booking-buddy";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.includes(url));
      if (existing) {
        return existing.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
