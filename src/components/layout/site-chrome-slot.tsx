"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Renders the global site chrome (`SiteHeader` / `SiteFooter`) everywhere
 * except the standalone app shells:
 *
 * - **`/booking-buddy`** — its own nav (ADR 0016).
 * - **`/on-deck/*` app surfaces** — the live-session, floor, display, and
 *   organizer pages run in On Deck's own bare shell. The marketing landing at
 *   exactly `/on-deck` keeps the global chrome.
 * - **`/tools/mic-drop`** — an unlisted tool in its own world. A Guest Link,
 *   opened from a group chat at a karaoke night, is the whole phone as the
 *   chart with nothing to navigate to; the Host's pages open on the same coral
 *   field, which the site's orange header and floating menu button would sit
 *   on top of.
 *
 * `/s/[token]` — the Guest Slot Link page — keeps the global chrome: it's a
 * public marketing surface, not part of the app.
 *
 * `/` used to suppress the global footer and ship its own, because it was the
 * only route in the Broadcast Dark look and would otherwise have handed off to
 * a different one two sections from the end. Every marketing route wears that
 * look now and `SiteFooter` *is* the dark footer, so both the exception and the
 * `part` prop that existed to express it are gone: the two halves suppress
 * together on exactly the same routes.
 *
 * The chrome is a Server Component passed in as `children`, so it still renders
 * on the server; this boundary only decides whether to mount it.
 */
export function SiteChromeSlot({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  // Mirrors `isUnderRoot` in routes.ts — an exact match or a real segment
  // beneath it, so `/booking-buddy-press-kit` keeps the chrome.
  const isBookingBuddy =
    pathname === "/booking-buddy" || pathname.startsWith("/booking-buddy/");

  // On Deck's app surfaces are everything *under* /on-deck; the landing page
  // (exactly /on-deck) is marketing and keeps the global chrome.
  const isOnDeckApp = pathname.startsWith("/on-deck/");

  const isMicDrop = pathname === "/tools/mic-drop" || pathname.startsWith("/tools/mic-drop/");

  return isBookingBuddy || isOnDeckApp || isMicDrop ? null : <>{children}</>;
}
