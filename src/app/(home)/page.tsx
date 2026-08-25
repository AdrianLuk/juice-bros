import type { Metadata } from "next";

import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/metadata";
import { getEpisodes } from "@/lib/episodes";
import { getLatestInstagramPosts } from "@/lib/instagram";
import { Hero } from "./sections/hero";
import { FeaturedEpisode } from "./sections/featured-episode";
import { LatestVideos } from "./sections/latest-videos";
import { InstagramFeed } from "./sections/instagram-feed";
import { ListenEverywhere } from "./sections/listen-everywhere";
import { Newsletter } from "./sections/newsletter";

export const metadata: Metadata = pageMetadata({
  description: siteConfig.description,
  path: "/",
});

export default async function Home() {
  // First item is the feature card up top; the rest fill the grid below.
  const [featuredEpisode, ...restEpisodes] = (await getEpisodes()).slice(0, 7);
  const instagramPosts = await getLatestInstagramPosts(6);

  return (
    <div className="flex flex-1 flex-col">
      <Hero />
      {featuredEpisode && <FeaturedEpisode episode={featuredEpisode} />}
      {restEpisodes.length > 0 && <LatestVideos videos={restEpisodes} />}
      {instagramPosts.length > 0 && <InstagramFeed posts={instagramPosts} />}
      <ListenEverywhere />
      <Newsletter />
    </div>
  );
}
