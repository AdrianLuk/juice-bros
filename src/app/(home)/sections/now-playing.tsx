import Link from "next/link";

import { getEpisodeHook } from "@/lib/youtube";
import { episodeMetaTitle, type Episode } from "@/lib/episodes";
import { PlayMark } from "@/components/bx/play-mark";
import { formatAired, formatRuntime } from "@/components/bx/format";

/**
 * The newest episode, on the page's one raised band directly under the hero,
 * and the page's rank-one section: the peak heading step, the most vertical
 * air on the page, and the only lighter ground.
 *
 * The hero owns the whole first screen (Adrian's call - the two hosts in
 * frame), so this is where the page pays back the missing playable thing: the
 * scroll lands on a lighter passage with the stage at full column width, the
 * title at headline size, and nothing else competing. The platform buttons
 * already live in the hero, so this block does not repeat them; the thumbnail
 * is the action.
 */
export function NowPlaying({ episode }: { episode: Episode }) {
  const hook = episode.description ? getEpisodeHook(episode.description) : "";
  const runtime = formatRuntime(episode.duration);

  return (
    <section className="bx-band">
      <div className="bx-measure py-16 sm:py-24 lg:py-28">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,38rem)_1fr] lg:items-center lg:gap-12">
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
            {runtime && <span className="bx-dur">{runtime}</span>}
          </Link>

          <div>
            {/* Title first, metadata under it - the same order the archive
                cards and the tournament panel use. A label above a heading is
                an eyebrow whatever data it carries, and it made the largest
                type in the section the second thing read. */}
            <h2 className="bx-h2 max-w-[20ch] text-[clamp(1.75rem,3.4vw,2.125rem)]">
              <Link
                href={`/podcast/${episode.slug}`}
                className="transition-colors duration-200 hover:text-[var(--bx-muted)]"
              >
                {episodeMetaTitle(episode.title)}
              </Link>
            </h2>
            {/* The runtime is the stage's chip, not printed text - the
                archive cards below do the same. It is kept for screen readers,
                which never reach the chip: this link is named by its
                `aria-label`, so its contents are not announced. */}
            <p className="bx-meta mt-3">
              New episode
              <span aria-hidden> · </span>
              {formatAired(episode.published)}
              {runtime && <span className="sr-only">, {runtime}</span>}
            </p>
            {hook && (
              <p className="mt-3.5 max-w-[48ch] text-[1.0625rem] leading-relaxed text-[var(--bx-muted)]">
                {hook}
              </p>
            )}
            <Link
              href={`/podcast/${episode.slug}`}
              className="group mt-6 inline-flex text-sm font-semibold transition-colors duration-200 hover:text-[var(--bx-muted)]"
            >
              Watch the episode
              <span aria-hidden className="ml-1.5 inline-block transition-transform duration-200 group-hover:translate-x-0.5">
                &rarr;
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
