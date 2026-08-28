"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

/**
 * A cross-fade + short rise on every marketing-route navigation, bridged to the
 * browser View Transitions API by React's <ViewTransition>. This lives in a
 * `template` rather than the root layout on purpose: templates re-mount on each
 * navigation, so the wrapper genuinely unmounts and remounts and its `exit` /
 * `enter` animations fire (a layout persists, and they never would).
 *
 * The site chrome - header, footer, background noise - sits in the `root`
 * snapshot and is held perfectly still in globals.css; only the content column
 * moves. The one shared element that travels is the desktop nav's active pill
 * (see site-header), which slides between links so the change of place reads.
 *
 * Scoped to the marketing site. Booking Buddy is a standalone app shell with
 * its own nav (ADR 0016) and Pickle Point Pal is a mid-match surface where a
 * full-page animation would be a liability, so both render straight through.
 * Timing and the reduced-motion path live in globals.css under the
 * `page-enter` / `page-exit` classes; browsers without the API just cut.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  const optOut =
    pathname === "/booking-buddy" ||
    pathname.startsWith("/booking-buddy/") ||
    pathname.startsWith("/tools/pickle-point-pal");

  if (optOut) return <>{children}</>;

  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
