import Link from "next/link";

import { episodeMetaTitle, type Episode } from "@/lib/episodes";
import { PlayMark } from "./play-mark";
import { formatAiredShort, formatRuntime } from "./format";

/**
 * The archive.
 *
 * A grid, not the horizontal rail the approved mockup showed - a deliberate,
 * disclosed deviation (see the surface brief). A rail keeps most of the
 * catalogue off-screen and turns browsing into a swipe most phone visitors
 * never make, which works against the one metric this page exists to serve.
 * Same cards, same ground, same gesture.
 */
export function Archive({ episodes }: { episodes: Episode[] }) {
  if (episodes.length === 0) return null;

  return (
    <section className="bx-measure bx-hair py-14 sm:py-20">
      <div className="flex items-baseline justify-between gap-6">
        <h2 className="bx-h2 text-[1.375rem] sm:text-2xl">Every episode</h2>
        <Link
          href="/podcast"
          className="text-sm text-[var(--bx-muted)] transition-colors duration-200 hover:text-[var(--bx-ink)]"
        >
          View all
        </Link>
      </div>

      <ul className="mt-7 grid grid-cols-1 gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {episodes.map((episode) => {
          const runtime = formatRuntime(episode.duration);
          return (
            <li key={episode.id}>
              <article>
                <Link
                  href={`/podcast/${episode.slug}`}
                  className="bx-tile group aspect-video"
                  tabIndex={-1}
                  aria-hidden
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail, already sized by the API */}
                  <img
                    src={episode.thumbnail}
                    alt=""
                    width={480}
                    height={270}
                    loading="lazy"
                    decoding="async"
                  />
                  <PlayMark />
                  {runtime && <span className="bx-dur">{runtime}</span>}
                </Link>

                <h3 className="mt-3.5 line-clamp-2 text-[0.9375rem] leading-snug font-semibold">
                  <Link
                    href={`/podcast/${episode.slug}`}
                    className="transition-colors duration-200 hover:text-[var(--bx-muted)]"
                  >
                    {episodeMetaTitle(episode.title)}
                  </Link>
                </h3>
                <p className="bx-meta mt-1.5">
                  {formatAiredShort(episode.published)}
                  {runtime && (
                    <>
                      <span aria-hidden> · </span>
                      {runtime}
                    </>
                  )}
                </p>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
