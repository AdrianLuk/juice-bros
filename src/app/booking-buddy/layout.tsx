import type { Metadata, Viewport } from "next";

import { QueryProvider } from "@/components/booking-buddy/query-provider";
import { ServiceWorkerRegistration } from "@/components/booking-buddy/service-worker-registration";

/**
 * Installability metadata (issue #12) — set at the section layout, not any
 * one page, since `manifest` is a property of the whole app. Metadata
 * objects from a layout and the page beneath it are shallowly merged (Next's
 * own merge rules), so every Booking Buddy page keeps its own `title`/
 * `description` from `pageMetadata()` while inheriting `manifest` from here.
 */
export const metadata: Metadata = {
  manifest: "/booking-buddy.webmanifest",
  appleWebApp: { capable: true, title: "Booking Buddy", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // Matches `.bb-theme`'s actual `--background` (globals.css) rather than
  // pure white. Not made dark-mode-aware here: nothing in the app ever adds
  // the `.dark` class (no toggle, no `prefers-color-scheme` sync script), so
  // a `(prefers-color-scheme: dark)` themeColor entry would paint the status
  // bar dark while the page itself stays rendered in this light palette —
  // swapping one mismatch (always-white) for a worse one (dark chrome over a
  // light page) whenever the OS happens to be in dark mode.
  themeColor: "oklch(0.972 0.008 75)",
};

/**
 * Booking Buddy's section layout.
 *
 * Deliberately does not call `verifySession` itself: the sign-in page lives
 * beneath this layout too, and gating here would lock people out of the very
 * page they need. The gate is the proxy (optimistic) plus `verifySession` in
 * each protected page and Server Action (authoritative) — see ADR 0003.
 */
export default function BookingBuddyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <ServiceWorkerRegistration />
      <div className="bb-theme flex w-full flex-1 flex-col bg-background text-foreground">
        {children}
      </div>
    </QueryProvider>
  );
}
