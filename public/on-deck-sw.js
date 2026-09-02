/*
 * Service worker for /on-deck only (issue #260).
 *
 * One job: receive and display the opt-in turn notification, and route a tap
 * on one back into the Player's Session view. No `fetch` handler — same
 * reasoning as booking-buddy-sw.js: Chrome dropped it from its installability
 * criteria, and an empty pass-through handler is a known anti-pattern. No
 * offline caching either — the live Session view is database-backed and
 * per-Player; a stale cached shell would be worse than useless.
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

  const title = payload.title || "On Deck";
  const url = payload.url || "/on-deck";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/brand/JB_Logo.svg",
      badge: "/brand/JB_Logo.svg",
      // A turn is time-sensitive — keep it on screen until the Player acts.
      requireInteraction: true,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/on-deck";

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
