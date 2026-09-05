import Link from "next/link";

import { siteConfig } from "@/config/site";
import { getEpisodeHook } from "@/lib/youtube";
import { episodeMetaTitle, type Episode } from "@/lib/episodes";
import { YoutubeIcon, SpotifyIcon } from "@/components/icons";
import { PlayMark } from "./play-mark";
import { formatAired, formatRuntime } from "./format";

/**
 * The first viewport: a one-line answer to "what is this", then the newest
 * episode already sitting there ready to play.
 *
 * The h1 is the positioning line rather than the show's own name - the name is
 * in the bar two centimetres above it, and a visitor who has to be told the
 * brand twice has still not been told what the brand is. The episode title is
 * the h2 under the stage.
 */
export function Stage({ episode }: { episode: Episode }) {
  const hook = episode.description ? getEpisodeHook(episode.description) : "";

  return (
    <section className="bx-measure pt-8 pb-14 sm:pt-10 sm:pb-20">
      <div className="max-w-4xl">
        <h1 className="bx-display text-[clamp(1.75rem,4.4vw,2.75rem)]">
          Pickleball talk for people who are still bad at it.
        </h1>
        <p className="mt-3 max-w-[52ch] text-[1.0625rem] leading-relaxed text-[var(--bx-muted)]">
          {siteConfig.description}
        </p>

        <div className="mt-7 sm:mt-8">
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

          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
            <div>
              <p className="bx-meta">
                New episode
                <span aria-hidden> · </span>
                {formatAired(episode.published)}
              </p>
              <h2 className="bx-h2 mt-2.5 max-w-[24ch] text-[clamp(1.375rem,3.2vw,1.875rem)]">
                <Link
                  href={`/podcast/${episode.slug}`}
                  className="transition-colors duration-200 hover:text-[var(--bx-muted)]"
                >
                  {episodeMetaTitle(episode.title)}
                </Link>
              </h2>
              {hook && (
                <p className="mt-2.5 max-w-[58ch] text-[0.9375rem] leading-relaxed text-[var(--bx-muted)]">
                  {hook}
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap gap-2.5">
              <a
                href={episode.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bx-btn bx-btn-play"
              >
                <YoutubeIcon className="size-4" />
                Watch on YouTube
              </a>
              <a
                href={siteConfig.links.spotify}
                target="_blank"
                rel="noopener noreferrer"
                className="bx-btn bx-btn-ghost"
              >
                <SpotifyIcon className="size-4" />
                Listen
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
