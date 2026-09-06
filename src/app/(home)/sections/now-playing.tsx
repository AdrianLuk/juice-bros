import Link from "next/link";

import { getEpisodeHook } from "@/lib/youtube";
import { episodeMetaTitle, type Episode } from "@/lib/episodes";
import { PlayMark } from "./play-mark";
import { formatAired, formatRuntime } from "./format";

/**
 * The newest episode, sat directly under the photo hero.
 *
 * This is the variant used when the hero carries the brand rather than the
 * episode: the platform buttons already live up there, so this block does not
 * repeat them. The thumbnail is the action, and it breaks the fold under the
 * hero so a visitor still meets something playable on the first screen.
 */
export function NowPlaying({ episode }: { episode: Episode }) {
  const hook = episode.description ? getEpisodeHook(episode.description) : "";

  return (
    <section className="bx-measure pt-12 pb-14 sm:pt-14 sm:pb-20">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,32rem)_1fr] lg:items-center lg:gap-12">
        <Link
          href={`/podcast/${episode.slug}`}
          className="bx-tile bx-stage group aspect-video"
          aria-label={`Play ${episodeMetaTitle(episode.title)}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail, already sized by the API */}
          <img
            src={episode.thumbnail}
            alt=""
            width={1280}
            height={720}
            fetchPriority="high"
            decoding="async"
          />
          <PlayMark />
          <span className="bx-dur">{formatRuntime(episode.duration)}</span>
        </Link>

        <div>
          <h2 className="bx-h2 max-w-[22ch] text-[clamp(1.375rem,3.2vw,1.875rem)]">
            <Link
              href={`/podcast/${episode.slug}`}
              className="transition-colors duration-200 hover:text-[var(--bx-muted)]"
            >
              {episodeMetaTitle(episode.title)}
            </Link>
          </h2>
          <p className="bx-meta mt-2.5">
            New episode
            <span aria-hidden> · </span>
            {formatAired(episode.published)}
            <span aria-hidden> · </span>
            {formatRuntime(episode.duration)}
          </p>
          {hook && (
            <p className="mt-2.5 max-w-[52ch] text-[0.9375rem] leading-relaxed text-[var(--bx-muted)]">
              {hook}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
