import type { Metadata } from "next";

import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/metadata";
import { getEpisodes } from "@/lib/episodes";
import { getLatestInstagramPosts, INSTAGRAM_POST_COUNT } from "@/lib/instagram";
import { TopBar } from "./sections/top-bar";
import { Stage } from "./sections/stage";
import { Archive } from "./sections/archive";
import { FreeTools } from "./sections/free-tools";
import { OnTheRoad } from "./sections/on-the-road";
import { TheHosts } from "./sections/the-hosts";
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
 * commitment recorded in PRODUCT.md rather than a default. The page renders its
 * own bar and footer, so `/` suppresses the global chrome in `SiteChromeSlot`;
 * the `.bx-dark` scope in globals.css carries the whole look and nothing here
 * reaches outside it.
 */
export default async function Home() {
  const episodes = await getEpisodes();
  const instagramPosts = await getLatestInstagramPosts(INSTAGRAM_POST_COUNT);

  const [newest, ...rest] = episodes;

  return (
    <div className="bx-dark flex flex-1 flex-col">
      <TopBar />
      {newest && <Stage episode={newest} />}
      <Archive episodes={rest.slice(0, 8)} />
      <FreeTools />
      <OnTheRoad />
      <TheHosts />
      <FromInstagram posts={instagramPosts} />
      <Foot />
    </div>
  );
}
