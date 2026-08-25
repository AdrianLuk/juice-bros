import type { Metadata, Viewport } from "next";

import { apps } from "@/data/apps";
import { pageMetadata } from "@/lib/metadata";
import { PicklePointPal } from "@/components/apps/pickle-point-pal/pickle-point-pal";

const app = apps.find((item) => item.slug === "pickle-point-pal")!;

export const metadata: Metadata = {
  ...pageMetadata({
    title: app.title,
    description: app.description,
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
      <PicklePointPal />
    </div>
  );
}
