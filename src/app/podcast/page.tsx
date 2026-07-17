import type { Metadata } from "next";

import { siteConfig } from "@/config/site";
import { getLatestVideos } from "@/lib/youtube";
import { VideoGrid } from "@/components/video-grid";
import { YoutubeIcon, SpotifyIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Podcast",
};

export default async function PodcastPage() {
  const videos = await getLatestVideos();

  return (
    <div className="flex w-full flex-1 flex-col px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Podcast
          </h1>
          <p className="mt-2 text-muted-foreground">
            Every episode, straight from the channel.
          </p>
        </div>
        <div className="flex gap-4 text-sm font-medium">
          <a
            href={siteConfig.links.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-[#ff0000]"
          >
            <YoutubeIcon className="size-4 text-[#ff0000]" />
            YouTube
          </a>
          <a
            href={siteConfig.links.spotify}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-[#1db954]"
          >
            <SpotifyIcon className="size-4 text-[#1db954]" />
            Spotify
          </a>
        </div>
      </div>

      <div className="mt-8">
        {videos.length > 0 ? (
          <VideoGrid videos={videos} />
        ) : (
          <p className="text-muted-foreground">
            Couldn&apos;t load episodes right now — catch us on{" "}
            <a
              href={siteConfig.links.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline underline-offset-4"
            >
              YouTube
            </a>{" "}
            in the meantime.
          </p>
        )}
      </div>
    </div>
  );
}
