"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Renders the global site chrome (`SiteHeader` / `SiteFooter`) everywhere
 * except `/booking-buddy`, which is a standalone app shell with its own nav
 * (ADR 0016). `/s/[token]` — the Guest Slot Link page — keeps the global
 * chrome: it's a public marketing surface, not part of the app.
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

  return isBookingBuddy ? null : <>{children}</>;
}
