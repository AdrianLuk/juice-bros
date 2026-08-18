import type { YoutubeVideo } from "@/lib/youtube";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function VideoGrid({ videos }: { videos: YoutubeVideo[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((video) => (
        <a
          key={video.id}
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col overflow-hidden rounded-3xl bg-black/3 p-1.5 shadow-brand ring-1 ring-black/5 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:shadow-brand-lg"
        >
          <div className="aspect-video overflow-hidden rounded-[1.25rem]">
            {/* eslint-disable-next-line @next/next/no-img-element -- YouTube CDN thumbnail, no next/image optimization needed */}
            <img
              src={video.thumbnail}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1 p-3.5">
            <h3 className="line-clamp-2 font-medium transition-colors duration-300 group-hover:text-[#ff0000]">
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
