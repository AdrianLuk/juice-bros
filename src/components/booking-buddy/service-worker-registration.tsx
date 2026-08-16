"use client";

import { useEffect } from "react";

/**
 * Registers the push/PWA service worker for the whole Booking Buddy section
 * (issue #12), not just the settings page — installability is a property of
 * the app, not of one route. Scoped to `/booking-buddy` so it never touches
 * `/tools/pickle-point-pal`'s own service worker.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker
      .register("/booking-buddy-sw.js", { scope: "/booking-buddy" })
      .catch(() => {
        // Push/installability are enhancements; a failed registration must
        // not break the rest of the app.
      });
  }, []);

  return null;
}
