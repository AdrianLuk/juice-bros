import type { Metadata } from "next";

import { apps } from "@/data/apps";
import { pageMetadata } from "@/lib/metadata";
import { buildAppPageJsonLd, toJsonLdScript } from "@/lib/structured-data";
import { MatchMixer } from "@/components/apps/match-mixer/match-mixer";

const app = apps.find((item) => item.slug === "match-mixer")!;

export const metadata: Metadata = pageMetadata({
  title: "Match Mixer: Pickleball Round Robin Generator",
  description:
    "Free pickleball round robin generator. Paste your player list and get a balanced doubles rotation where nobody partners the same person twice and nobody sits out. No account, works offline.",
  path: app.href,
});

export default function MatchMixerPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(buildAppPageJsonLd(app)) }}
      />
      <MatchMixer />
    </div>
  );
}
