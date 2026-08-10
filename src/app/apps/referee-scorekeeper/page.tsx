import type { Metadata, Viewport } from "next";

import { apps } from "@/data/apps";
import { pageMetadata } from "@/lib/metadata";
import { RefScorekeeper } from "@/components/apps/referee-scorekeeper/ref-scorekeeper";

const app = apps.find((item) => item.slug === "referee-scorekeeper")!;

export const metadata: Metadata = {
  ...pageMetadata({
    title: app.title,
    description: app.description,
    path: app.href,
  }),
  manifest: "/referee-scorekeeper.webmanifest",
  appleWebApp: { capable: true, title: "Juice Bros Ref", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  // Kills double-tap zoom on the rally buttons without trapping pinch-zoom.
  maximumScale: 5,
};

export default function RefereeScorekeeperPage() {
  return (
    <div className="flex w-full flex-1 flex-col bg-white px-4 py-6 text-neutral-950 sm:px-6">
      <RefScorekeeper />
    </div>
  );
}
