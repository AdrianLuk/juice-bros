"use client";

import { useEffect, ViewTransition } from "react";
import { usePathname } from "next/navigation";

import { bookingBuddyNavDirection } from "@/lib/booking-buddy/nav-order";

/**
 * Directional route transitions for Booking Buddy — the section-wide opt-out
 * that `src/app/template.tsx` still carries for the marketing template is
 * lifted here: the app now animates its own way, the marketing site keeps
 * animating its own.
 *
 * A `template` rather than the layout on purpose (same reason the marketing
 * one is): templates re-mount on every navigation, so this wrapper genuinely
 * unmounts and remounts and React's `<ViewTransition>` `enter` / `exit` fire.
 * A layout persists and they never would.
 *
 * The app-shell chrome — the desktop top bar, the mobile tab bar — sits in the
 * `root` snapshot and is pinned in globals.css; only the content column moves,
 * and it moves *directionally*. `nav-order.ts` reads the app's own reading
 * order: a destination further along it enters from the trailing edge
 * (`forward`), an earlier one from the leading edge (`back`), an unrelated
 * jump just settles in place (`lateral`). The active nav indicator
 * (`bb-nav-pill`, `bb-tab-pill`, `bb-section-pill`) is a shared element that
 * slides between destinations underneath the moving page.
 *
 * `lastPath` lives at module scope so it survives this template's
 * per-navigation re-mount (a ref would reset). It's read during render but
 * only ever written from the effect below — the exiting instance leaves it
 * untouched, so the entering instance reads the path it came *from*.
 */
const lastPath = { current: null as string | null };

export default function BookingBuddyTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const direction = bookingBuddyNavDirection(lastPath.current, pathname);

  useEffect(() => {
    lastPath.current = pathname;
  }, [pathname]);

  return (
    <ViewTransition
      enter={`bb-page-enter-${direction}`}
      exit="bb-page-exit"
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
