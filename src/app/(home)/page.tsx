import type { Metadata } from "next";

import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/metadata";
import { getEpisodes } from "@/lib/episodes";
import { getLatestInstagramPosts, INSTAGRAM_POST_COUNT } from "@/lib/instagram";
import { PhotoHero } from "./sections/photo-hero";
import { NowPlaying } from "./sections/now-playing";
import { Archive } from "./sections/archive";
import { TheHosts } from "./sections/the-hosts";
import { FreeTools } from "./sections/free-tools";
import { OnTheRoad } from "./sections/on-the-road";
import { FromInstagram } from "./sections/from-instagram";
import { Foot } from "./sections/foot";

export const metadata: Metadata = pageMetadata({
  description: siteConfig.description,
  path: "/",
});

/**
 * The home page, in the "Broadcast Dark" look (contract in
 * `.impeccable/surfaces/src-app-home.md`).
 *
 * The category standard executed at full fidelity, which is a standing brand
 * commitment recorded in PRODUCT.md rather than a default. The global
 * `SiteHeader` (the floating orange pill every marketing route shares) sits
 * over the hero; the page renders its own footer, so `/` suppresses only the
 * global footer in `SiteChromeSlot`. The `.bx-dark` scope in globals.css
 * carries the whole look and nothing here reaches outside it.
 */
export default async function Home() {
  const episodes = await getEpisodes();
  const instagramPosts = await getLatestInstagramPosts(INSTAGRAM_POST_COUNT);

  const [newest, ...rest] = episodes;

  return (
    <div className="bx-dark flex flex-1 flex-col">
      <PhotoHero />
      {newest && <NowPlaying episode={newest} />}
      <Archive episodes={rest.slice(0, 8)} />
      <TheHosts />
      <FreeTools />
      <OnTheRoad />
      <FromInstagram posts={instagramPosts} />
      <Foot />
    </div>
  );
}
