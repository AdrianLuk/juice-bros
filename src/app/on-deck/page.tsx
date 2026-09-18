import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import {
  buildOnDeckLandingJsonLd,
  toJsonLdScript,
} from "@/lib/structured-data";
import "./on-deck-landing.css";
import { Hero } from "./sections/hero";
import { TheProblem } from "./sections/the-problem";
import { HowItRuns } from "./sections/how-it-runs";
import { AtTheVenue } from "./sections/at-the-venue";
import { CourtsideBoard } from "./sections/courtside-board";
import { Matching } from "./sections/matching";
import { WhenItGoesWrong } from "./sections/when-it-goes-wrong";
import { StaysSocial } from "./sections/stays-social";

export const metadata: Metadata = pageMetadata({
  title: "On Deck",
  description:
    "Free live court rotation for pickleball socials. Players scan a sign to join the queue, and On Deck calls the next foursome as courts free up. Tap through a whole night in your browser before you sign up for anything.",
  path: "/on-deck",
});

export default function OnDeckPage() {
  return (
    <div className="odl flex w-full flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toJsonLdScript(buildOnDeckLandingJsonLd()),
        }}
      />
      <Hero />
      <TheProblem />
      <HowItRuns />
      <AtTheVenue />
      <CourtsideBoard />
      <Matching />
      <WhenItGoesWrong />
      <StaysSocial />
    </div>
  );
}
