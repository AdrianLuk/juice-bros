import { siteConfig } from "@/config/site";
import { VideoGrid } from "@/components/video-grid";
import { SectionHeading } from "@/components/typography/section-heading";
import type { Episode } from "@/lib/episodes";

export function LatestVideos({ videos }: { videos: Episode[] }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading title="Freshly squeezed videos" />
        <a
          href={siteConfig.links.youtube}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground"
        >
          View channel &rarr;
        </a>
      </div>
      <div className="mt-8">
        <VideoGrid videos={videos} />
      </div>
    </section>
  );
}
