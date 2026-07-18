import { getLatestVideos } from "@/lib/youtube";
import { Hero } from "./sections/hero";
import { FeaturedEpisode } from "./sections/featured-episode";
import { LatestVideos } from "./sections/latest-videos";
import { ListenEverywhere } from "./sections/listen-everywhere";
import { Newsletter } from "./sections/newsletter";

export default async function Home() {
  // First item is the feature card up top; the rest fill the grid below.
  const [featuredVideo, ...restVideos] = await getLatestVideos(7);

  return (
    <div className="flex flex-1 flex-col">
      <Hero />
      {featuredVideo && <FeaturedEpisode video={featuredVideo} />}
      {restVideos.length > 0 && <LatestVideos videos={restVideos} />}
      <ListenEverywhere />
      <Newsletter />
    </div>
  );
}
