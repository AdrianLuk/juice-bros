import Link from "next/link";

import { getYoutubeEmbedUrl } from "@/lib/utils";
import { getEpisodeHook } from "@/lib/youtube";
import type { Episode } from "@/lib/episodes";
import { WatchListenButtons } from "@/components/watch-listen-buttons";

// TODO: Swap for a distinct candid shot of Daven & Adrian. Currently reuses the
// hero banner, which shows the same faces already featured at the top of the page.
const hostPhoto = "/pictures/adrian-dav-chatgpt-edited.png";

export function FeaturedEpisode({ episode }: { episode: Episode }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="rounded-[2.25rem] bg-black/3 p-2 ring-1 ring-black/5">
        <div className="grid overflow-hidden rounded-[1.75rem] bg-brand-black text-white shadow-brand-lg lg:grid-cols-2">
          {/* Video */}
          <div className="aspect-video lg:min-h-120">
            <iframe
              className="h-full w-full"
              src={getYoutubeEmbedUrl(episode.url)}
              title={episode.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>

          {/* Host photo + episode details */}
          <div className="relative flex flex-col justify-center gap-6 p-8 sm:p-10 lg:p-12">
            {/* eslint-disable-next-line @next/next/no-img-element -- local trusted asset, no next/image optimization needed */}
            <img
              src={hostPhoto}
              alt=""
              aria-hidden
              loading="lazy"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-30"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-linear-to-t from-brand-black via-brand-black/85 to-brand-black/55"
            />
            <div className="relative flex flex-col gap-5">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-orange px-3 py-1 text-xs font-semibold tracking-[0.15em] text-white uppercase">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-white" />
                </span>
                New Episode
              </span>
              <div>
                <h2 className="font-heading text-3xl font-black tracking-[-0.02em] text-balance sm:text-4xl">
                  <Link
                    href={`/podcast/${episode.slug}`}
                    className="transition-colors duration-300 hover:text-brand-orange"
                  >
                    {episode.title}
                  </Link>
                </h2>
                {episode.description && (
                  <p className="mt-3 text-lg text-white/85 text-balance">
                    {getEpisodeHook(episode.description)}
                  </p>
                )}
              </div>
              <div className="mt-1 flex flex-col gap-3 sm:flex-row">
                <WatchListenButtons youtubeUrl={episode.url} />
              </div>
              <Link
                href="/podcast"
                className="w-fit text-sm font-medium text-white/60 transition-colors duration-300 hover:text-white"
              >
                Browse all episodes &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
