import type { Metadata, Viewport } from "next";

import { apps } from "@/data/apps";
import { picklePointPalFaqs } from "@/data/pickle-point-pal-content";
import { pageMetadata } from "@/lib/metadata";
import { buildAppPageJsonLd, toJsonLdScript } from "@/lib/structured-data";
import { PicklePointPal } from "@/components/apps/pickle-point-pal/pickle-point-pal";
import { PicklePointPalAbout } from "@/components/apps/pickle-point-pal/pickle-point-pal-about";

const app = apps.find((item) => item.slug === "pickle-point-pal")!;

export const metadata: Metadata = {
  ...pageMetadata({
    title: app.title,
    description:
      "Free pickleball scorekeeping app that tracks the score, server 1 and 2, side switches, and timeouts the way a referee would. Side-out or rally scoring, works offline, no account needed.",
    path: app.href,
  }),
  manifest: "/pickle-point-pal.webmanifest",
  appleWebApp: { capable: true, title: "Pickle Point Pal", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  // Kills double-tap zoom on the rally buttons without trapping pinch-zoom.
  maximumScale: 5,
};

export default function PicklePointPalPage() {
  return (
    // The ref layout measures its fold against this top padding — keep the two
    // in step if either changes (see the fold sizing in `match-screen.tsx`).
    <div className="pp-surface flex w-full flex-1 flex-col px-4 py-6 sm:px-6 ref-landscape:px-3 ref-landscape:py-3">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toJsonLdScript(buildAppPageJsonLd(app, picklePointPalFaqs)),
        }}
      />
      <PicklePointPal />
      <PicklePointPalAbout />
    </div>
  );
}
