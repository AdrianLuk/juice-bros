import { siteConfig } from "@/config/site";
import { VideoGrid } from "@/components/video-grid";
import { SectionHeading } from "@/components/typography/section-heading";
import type { YoutubeVideo } from "@/lib/youtube";

export function LatestVideos({ videos }: { videos: YoutubeVideo[] }) {
  return (
    <section className="w-full border-t px-4 py-20 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading eyebrow="Freshly Squeezed" title="Latest Videos" />
        <a
          href={siteConfig.links.youtube}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          View channel &rarr;
        </a>
      </div>
      <div className="mt-6">
        <VideoGrid videos={videos} />
      </div>
    </section>
  );
}
