import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { Hero } from "./sections/hero";
import { OriginStory } from "./sections/origin-story";
import { Mission } from "./sections/mission";
import { MeetTheBros } from "./sections/meet-the-bros";
import { Differentiation } from "./sections/differentiation";
import { Pillars } from "./sections/pillars";
import { JoinIn } from "./sections/join-in";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "Meet the hosts of Juice Bros Pickleball and find out how two friends riffing after pickup games turned into a show for everyday players.",
  path: "/about",
});

/**
 * The About page, in Broadcast Dark.
 *
 * Section order carries the argument: how it started (with the first episode
 * playing), why it exists (the peak, on the page's one band), who the two of
 * them are, why that matters, what the show covers, and how to take part.
 *
 * Mission moved up ahead of Meet the Bros. The incumbent ran story, mission,
 * hosts, difference, pillars - which put the page's strongest sentence third
 * and its proof fourth, so a visitor who left after two screens had read the
 * origin story and nothing else. The mission now lands on the first scroll
 * after the story, and Differentiation follows the hosts, where "they're rec
 * players like you" is a claim the reader has just seen the evidence for.
 *
 * Every line of copy is the published About page's own (PRODUCT.md records it
 * as confirmed brand voice); nothing here was rewritten.
 */
export default function AboutPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <Hero />
      <OriginStory />
      <Mission />
      <MeetTheBros />
      <Differentiation />
      <Pillars />
      <JoinIn />
    </div>
  );
}
