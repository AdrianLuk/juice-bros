import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { buildOnDeckLandingJsonLd, toJsonLdScript } from "@/lib/structured-data";
import { Hero } from "./sections/hero";
import { TheProblem } from "./sections/the-problem";
import { HowItRuns } from "./sections/how-it-runs";
import { Matching } from "./sections/matching";
import { StaysSocial } from "./sections/stays-social";

export const metadata: Metadata = pageMetadata({
  title: "On Deck",
  description:
    "Live court rotation for pickleball socials. Players scan a sign to join the queue, and On Deck calls the next foursome as courts free up, keeping court time fair and mixing up who plays with whom.",
  path: "/on-deck",
});

export default function OnDeckPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toJsonLdScript(buildOnDeckLandingJsonLd()),
        }}
      />
      <Hero />
      <TheProblem />
      <HowItRuns />
      <Matching />
      <StaysSocial />
    </div>
  );
}
