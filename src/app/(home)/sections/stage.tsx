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
    <section className="bx-measure pt-7 pb-14 sm:pt-8 sm:pb-20">
      <div>
        <h1 className="bx-display max-w-[20ch] text-[clamp(1.75rem,4.4vw,2.75rem)]">
          Pickleball, from two guys still trying to get good at it.
        </h1>
        {/* No standfirst under the h1 on purpose. `siteConfig.description`
            ("the show everyday pickleball players actually relate to") says
            what the headline now says, and it still carries the page's meta
            description, so printing it here was a duplicate that pushed the
            call to action off a 1440x810 laptop. */}

        {/* Wide, the host photo takes the empty column beside the video, so the
            hosts are on the first screen at a size where you can actually see
            them and it costs no vertical space at all. Narrow, it falls under
            the video as a short strip.

            The incumbent hero made this same photo a full-bleed background that
            type had to survive on top of, which is what forced a scrim, a drop
            shadow and a WebGL layer. Given its own box it needs none of that. */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-8">
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

          <figure>
            <div className="bx-tile aspect-[3/1] sm:aspect-[4/1] lg:aspect-[4/3]">
              {/* eslint-disable-next-line @next/next/no-img-element -- local photo, no next/image optimization needed here */}
              <img
                src="/pictures/adrian-dav.jpg"
                alt="Daven and Adrian on court between points"
                width={1024}
                height={768}
                loading="lazy"
                decoding="async"
                className="object-[50%_24%]"
              />
            </div>
            <figcaption className="mt-3 text-[0.9375rem] text-[var(--bx-muted)]">
              Hosted by{" "}
              <Link
                href="/about"
                className="font-semibold text-[var(--bx-ink)] transition-colors duration-200 hover:text-[var(--bx-muted)]"
              >
                Daven and Adrian
              </Link>
              , two rec players who lose to the same team every week.
            </figcaption>
          </figure>
        </div>

        <div className="mt-6 flex max-w-[52rem] flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
          <div>
            <h2 className="bx-h2 max-w-[24ch] text-[clamp(1.375rem,3.2vw,1.875rem)]">
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
              <p className="mt-2 max-w-[58ch] text-[0.9375rem] leading-relaxed text-[var(--bx-muted)]">
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
    </section>
  );
}
