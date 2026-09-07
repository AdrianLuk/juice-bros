import type { Metadata } from "next";

import { siteConfig } from "@/config/site";
import { pageMetadata } from "@/lib/metadata";
import { getEpisodes } from "@/lib/episodes";
import { buildPodcastListJsonLd, toJsonLdScript } from "@/lib/structured-data";
import { YoutubeIcon, SpotifyIcon } from "@/components/icons";
import { PageHead } from "@/components/bx/page-head";
import { Catalogue } from "./sections/catalogue";
import { OnSpotify } from "./sections/on-spotify";

export const metadata: Metadata = pageMetadata({
  title: "Podcast",
  description:
    "Every episode of Juice Bros Pickleball in one place - watch on YouTube, listen on Spotify, or browse the full archive.",
  path: "/podcast",
});

/**
 * The catalogue page, in Broadcast Dark.
 *
 * The home page leads with the newest episode on a band and shows eight of the
 * rest; this page is the whole shelf, and it deliberately does not repeat that
 * featured treatment. Someone who arrives here has already decided to browse,
 * and promoting one card inside a grid of the same cards would only take room
 * from the other thirteen. The newest is simply first.
 *
 * So the page is three moves: say what these are and where to subscribe, show
 * every one of them, then offer the audio path on the page's one band.
 */
export default async function PodcastPage() {
  const videos = await getEpisodes();

  return (
    <div className="flex w-full flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(buildPodcastListJsonLd(videos)) }}
      />

      <PageHead
        title="Every episode we've made"
        meta={
          videos.length > 0 ? (
            <>
              {videos.length} episode{videos.length === 1 ? "" : "s"}
              <span aria-hidden> &middot; </span>
              New one most weeks
            </>
          ) : undefined
        }
        lead="Two rec players talking about the parts of pickleball nobody makes a tutorial for. The nerves, the rivalries, the group chat, the guy coaching from behind the fence."
        actions={
          <>
            <a
              href={siteConfig.links.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="bx-btn bx-btn-yt"
            >
              <YoutubeIcon className="size-[1.125rem]" />
              Watch on YouTube
            </a>
            <a
              href={siteConfig.links.spotify}
              target="_blank"
              rel="noopener noreferrer"
              className="bx-btn bx-btn-sp"
            >
              <SpotifyIcon className="size-[1.125rem]" />
              Listen on Spotify
            </a>
          </>
        }
      />

      <div className="bx-measure pb-20 sm:pb-28">
        <Catalogue episodes={videos} />
      </div>

      <OnSpotify />
    </div>
  );
}
