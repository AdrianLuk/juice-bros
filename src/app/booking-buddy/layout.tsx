import type { Metadata, Viewport } from "next";

import { QueryProvider } from "@/components/booking-buddy/query-provider";
import { ServiceWorkerRegistration } from "@/components/booking-buddy/service-worker-registration";
import { BbAppShell } from "@/components/booking-buddy/bb-app-shell";
import { BbPullToRefresh } from "@/components/booking-buddy/bb-pull-to-refresh";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { getOptionalSession } from "@/lib/booking-buddy/dal";

/**
 * Installability metadata (issue #12) — set at the section layout, not any
 * one page, since `manifest` is a property of the whole app. Metadata
 * objects from a layout and the page beneath it are shallowly merged (Next's
 * own merge rules), so every Booking Buddy page keeps its own `title`/
 * `description` from `pageMetadata()` while inheriting `manifest` from here.
 */
export const metadata: Metadata = {
  manifest: "/booking-buddy.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Booking Buddy",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // Matches `.bb-theme`'s actual `--background` (globals.css) rather than
  // pure white. Not made dark-mode-aware here: nothing in the app ever adds
  // the `.dark` class (no toggle, no `prefers-color-scheme` sync script), so
  // a `(prefers-color-scheme: dark)` themeColor entry would paint the status
  // bar dark while the page itself stays rendered in this light palette —
  // swapping one mismatch (always-white) for a worse one (dark chrome over a
  // light page) whenever the OS happens to be in dark mode.
  themeColor: "oklch(0.735 0.056 68)",
};

/**
 * Booking Buddy's section layout.
 *
 * Still does not *gate* here — the sign-in page lives beneath this layout too,
 * and redirecting here would lock people out of the very page they need. The
 * gate is the proxy (optimistic) plus `verifySession` in each protected page
 * and Server Action (authoritative) — see ADR 0003. The `getOptionalSession`
 * read below only chooses which chrome to render (ADR 0016), and it's `cache`d,
 * so the pages beneath don't pay for it twice:
 *
 * - **Signed in** → the standalone app shell (`BbAppShell`), no global chrome.
 *   The global `SiteHeader`/`SiteFooter` are suppressed across `/booking-buddy`
 *   by `SiteChromeSlot` in the root layout.
 * - **Signed out** → the pre-auth pages (landing, sign-in, privacy, join) are
 *   marketing / auth surfaces, not the app: they keep the normal Juice Bros
 *   chrome, rendered here since the root layout's copy is suppressed.
 */
export default async function BookingBuddyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getOptionalSession();

  if (!session) {
    return (
      <QueryProvider>
        <ServiceWorkerRegistration />
        <SiteHeader />
        <div className="bb-theme bb-board flex w-full flex-1 flex-col text-foreground">
          {children}
        </div>
        <SiteFooter />
      </QueryProvider>
    );
  }

  return (
    <QueryProvider>
      <ServiceWorkerRegistration />
      {/* `.bb-board` is the cork ground the whole signed-in app stands on
          (direction seed 861cf732); the routed sign hangs over it. */}
      <div className="bb-theme bb-board flex w-full flex-1 flex-col text-foreground">
        <BbAppShell />
        {/* Clears the fixed mobile bottom tab bar (safe-area included); no bar
            on desktop. `BbPullToRefresh` owns this wrapper so a pull-down from
            the top refetches the page — the app turns the browser's native
            pull-to-refresh off, and there's none at all once installed. */}
        <BbPullToRefresh className="flex w-full flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
          {children}
        </BbPullToRefresh>
      </div>
    </QueryProvider>
  );
}
