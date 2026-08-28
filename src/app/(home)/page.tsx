import type { Metadata } from "next";

import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/metadata";
import { getEpisodes } from "@/lib/episodes";
import { getLatestInstagramPosts, INSTAGRAM_POST_COUNT } from "@/lib/instagram";
import { Reveal } from "@/components/motion/reveal";
import { Hero } from "./sections/hero";
import { FeaturedEpisode } from "./sections/featured-episode";
import { LatestVideos } from "./sections/latest-videos";
import { NextAppearance } from "./sections/next-appearance";
import { InstagramFeed } from "@/components/instagram-feed";
// Hidden for now: <ListenEverywhere /> just repeated the hero's YouTube +
// Spotify links, and the newsletter isn't a current priority. The section
// components are kept in ./sections - re-add the imports and the JSX below to
// bring either back.

export const metadata: Metadata = pageMetadata({
  description: siteConfig.description,
  path: "/",
});

export default async function Home() {
  // First item is the feature card up top; the rest fill the grid below.
  const [featuredEpisode, ...restEpisodes] = (await getEpisodes()).slice(0, 7);
  const instagramPosts = await getLatestInstagramPosts(INSTAGRAM_POST_COUNT);

  return (
    <div className="flex flex-1 flex-col">
      <Hero />
      {featuredEpisode && (
        <Reveal variant="scale">
          <FeaturedEpisode episode={featuredEpisode} />
        </Reveal>
      )}
      {restEpisodes.length > 0 && (
        <Reveal>
          <LatestVideos videos={restEpisodes} />
        </Reveal>
      )}
      <Reveal variant="scale">
        <NextAppearance />
      </Reveal>
      {instagramPosts.length > 0 && (
        <Reveal>
          <InstagramFeed posts={instagramPosts} />
        </Reveal>
      )}
    </div>
  );
}
