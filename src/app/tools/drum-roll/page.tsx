import type { Metadata } from "next";

import { apps } from "@/data/apps";
import { pageMetadata } from "@/lib/metadata";
import { buildAppPageJsonLd, toJsonLdScript } from "@/lib/structured-data";
import { DrumRoll } from "@/components/apps/drum-roll/drum-roll";

const app = apps.find((item) => item.slug === "drum-roll")!;

export const metadata: Metadata = pageMetadata({
  title: "Drum Roll: Raffle Ticket Draw",
  description:
    "Free raffle draw for club events. Put names and tickets in, draw a winner for each prize, and show the seed so the room can check the result. No account, works offline.",
  path: app.href,
});

export default function DrumRollPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(buildAppPageJsonLd(app)) }}
      />
      <DrumRoll />
    </div>
  );
}
