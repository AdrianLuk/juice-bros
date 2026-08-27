import Link from "next/link";

import { getEpisodeHook } from "@/lib/youtube";
import { episodeMetaTitle, type Episode } from "@/lib/episodes";
import { WatchListenButtons } from "@/components/watch-listen-buttons";
import { YoutubeEmbed } from "@/components/youtube-embed";

export function FeaturedEpisode({ episode }: { episode: Episode }) {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="rounded-[2.25rem] bg-black/3 p-2 ring-1 ring-black/5">
        <div className="flex flex-col overflow-hidden rounded-[1.75rem] bg-brand-black text-white shadow-brand-lg">
          {/* Video leads the section: a full-width, uncropped 16:9 player. The
              wrapper carries only aspect-video, so the ratio drives its height
              and there is no forced min-height that could slide the iframe
              under a neighbouring panel (the old two-column bug). */}
          <div className="p-2 sm:p-3">
            <div className="aspect-video overflow-hidden rounded-[1.4rem] bg-black ring-1 ring-white/10">
              <YoutubeEmbed videoId={episode.id} title={episode.title} />
            </div>
          </div>

          {/* Episode details */}
          <div className="flex flex-col gap-5 px-5 pt-3 pb-7 sm:px-8 sm:pb-9">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-orange px-3 py-1 text-xs font-semibold tracking-[0.15em] text-white uppercase">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-white" />
                </span>
                New Episode
              </span>
              <Link
                href="/podcast"
                className="ml-auto text-sm font-medium text-white/60 transition-colors duration-300 hover:text-white"
              >
                Browse all episodes &rarr;
              </Link>
            </div>

            <div>
              <h2 className="font-heading text-2xl font-black tracking-[-0.02em] text-balance sm:text-3xl">
                <Link
                  href={`/podcast/${episode.slug}`}
                  className="transition-colors duration-300 hover:text-brand-orange"
                >
                  {episodeMetaTitle(episode.title)}
                </Link>
              </h2>
              {episode.description && (
                <p className="mt-3 max-w-2xl text-lg text-white/85 text-balance">
                  {getEpisodeHook(episode.description)}
                </p>
              )}
            </div>

            <div className="mt-1 flex flex-col gap-3 sm:flex-row">
              <WatchListenButtons youtubeUrl={episode.url} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
