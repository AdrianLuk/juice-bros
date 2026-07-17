import type { YoutubeVideo } from "@/lib/youtube";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function VideoGrid({ videos }: { videos: YoutubeVideo[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((video) => (
        <a
          key={video.id}
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col overflow-hidden rounded-2xl border bg-background transition-colors hover:border-[#ff0000]"
        >
          <div className="aspect-video overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- YouTube CDN thumbnail, no next/image optimization needed */}
            <img
              src={video.thumbnail}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1 p-4">
            <h3 className="line-clamp-2 font-medium transition-colors group-hover:text-[#ff0000]">
              {video.title}
            </h3>
            <p className="mt-auto pt-1 text-sm text-muted-foreground">
              {dateFormatter.format(new Date(video.published))}
            </p>
          </div>
        </a>
      ))}
    </div>
  );
}
