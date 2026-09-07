import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { getEpisodes } from "@/lib/episodes";
import { getYoutubeVideoId } from "@/lib/utils";
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

// The very first episode - where the show (and this whole brand) started.
const ORIGIN_EPISODE_URL = "https://youtu.be/J6gvgo_RKfo";
const ORIGIN_EPISODE_ID = getYoutubeVideoId(ORIGIN_EPISODE_URL) ?? "";

/**
 * The About page, in Broadcast Dark.
 *
 * The page opens on the show rather than on an essay about it: episode one -
 * the first thing the two of them ever recorded - plays at stage scale in the
 * first viewport, and the origin story below reads as its notes. What shipped
 * before was a headline over empty space above seven prose sections of one
 * width and one rhythm, with the best asset on the route buried in section two
 * at half width; a visitor asking "who are these guys" met the argument before
 * ever meeting the guys.
 *
 * Order carries the argument from there: how it started, why it exists (the
 * peak, on the page's one band), who the two of them are, why that matters,
 * what the show covers, and how to take part.
 *
 * Composition, not identity, is what changed. The palette, type ramp, tile
 * gesture and component vocabulary are DESIGN.md's, untouched. The one thing
 * the page now insists on is rhythm: stage, prose beside an aside, a centred
 * full-bleed statement, a photograph over two panels, a narrow heading against
 * an argument, a row of four, a close. No two consecutive sections share a
 * shape, which is what the old page's flat scroll was missing.
 *
 * Every line of copy is the published About page's own (PRODUCT.md records it
 * as confirmed brand voice); nothing here was rewritten.
 *
 * The episode lookup is live, like every other episode surface on the site
 * (`docs/adr/0002`), so the hero's date and runtime chip are real rather than
 * hand-maintained. It resolves against the same snapshot fallback the rest of
 * the site uses, and the hero degrades to the player alone if the id ever
 * falls out of the feed entirely.
 */
export default async function AboutPage() {
  const episodes = await getEpisodes();
  const originEpisode =
    episodes.find((episode) => episode.id === ORIGIN_EPISODE_ID) ?? null;

  return (
    <div className="flex w-full flex-1 flex-col">
      <Hero episodeId={ORIGIN_EPISODE_ID} episode={originEpisode} />
      <OriginStory />
      <Mission />
      <MeetTheBros />
      <Differentiation />
      <Pillars />
      <JoinIn />
    </div>
  );
}
