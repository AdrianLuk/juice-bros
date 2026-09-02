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
 *
 * `/s/[token]` — the Guest Slot Link page — keeps the global chrome: it's a
 * public marketing surface, not part of the app.
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

  return isBookingBuddy || isOnDeckApp ? null : <>{children}</>;
}
