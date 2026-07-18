import { siteConfig } from "@/config/site";
import { VideoGrid } from "@/components/video-grid";
import type { YoutubeVideo } from "@/lib/youtube";

export function Episodes({ videos }: { videos: YoutubeVideo[] }) {
  return (
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
  );
}
