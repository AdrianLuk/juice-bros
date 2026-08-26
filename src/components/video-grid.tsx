import Link from "next/link";

import type { Episode } from "@/lib/episodes";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function VideoGrid({ videos }: { videos: Episode[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((episode) => (
        <Link
          key={episode.id}
          href={`/podcast/${episode.slug}`}
          className="group flex flex-col overflow-hidden rounded-3xl bg-black/3 p-1.5 shadow-brand ring-1 ring-black/5 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:shadow-brand-lg"
        >
          <div className="aspect-video overflow-hidden rounded-[1.25rem]">
            {/* eslint-disable-next-line @next/next/no-img-element -- YouTube CDN thumbnail, no next/image optimization needed */}
            <img
              src={episode.thumbnail}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1 p-3.5">
            <h3 className="line-clamp-2 font-medium transition-colors duration-300 group-hover:text-brand-orange">
              {episode.title}
            </h3>
            <p className="mt-auto pt-1 text-sm text-muted-foreground">
              {dateFormatter.format(new Date(episode.published))}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
