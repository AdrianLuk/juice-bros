import { getYoutubeEmbedUrl } from "@/lib/utils";
import { SectionHeading } from "@/components/typography/section-heading";
import { WatchListenButtons } from "@/components/watch-listen-buttons";

// The very first episode — where the show (and this whole brand) started.
const ORIGIN_EPISODE_URL = "https://youtu.be/J6gvgo_RKfo";

export function OriginEpisode() {
  return (
    <div className="mt-16 border-t pt-16">
      <SectionHeading eyebrow="Where It Started" title="Welcome to Juice Bros Pickleball" />

      <div className="mt-6 grid gap-8 sm:grid-cols-5 sm:items-center">
        <div className="overflow-hidden rounded-2xl border sm:col-span-3">
          <div className="aspect-video">
            <iframe
              className="h-full w-full"
              src={getYoutubeEmbedUrl(ORIGIN_EPISODE_URL)}
              title="Welcome to Juice Bros Pickleball"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
        <div className="flex flex-col gap-4 sm:col-span-2">
          <p className="text-muted-foreground">
            The first episode we ever recorded — who we are and why we started this
            podcast. If you&apos;re new here, start with this one.
          </p>
          <div className="flex flex-wrap gap-3">
            <WatchListenButtons youtubeUrl={ORIGIN_EPISODE_URL} />
          </div>
        </div>
      </div>
    </div>
  );
}
