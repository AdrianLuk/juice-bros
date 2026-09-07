import Link from "next/link";

import { siteConfig } from "@/config/site";
import { YoutubeIcon } from "@/components/icons";
import { EpisodePlayer } from "@/components/bx/episode-player";
import { formatAiredLong, formatRuntime } from "@/components/bx/format";
import type { Episode } from "@/lib/episodes";

/**
 * The About page's opening: episode one, on the stage.
 *
 * The page used to open on a headline over empty space, with the first episode
 * buried in section two at half width under a screen of prose - so a visitor
 * asking "who are these guys" got an essay about a podcast instead of the
 * podcast. The single strongest thing this route owns is the actual first
 * episode ever recorded, and it now sits in the first viewport at the largest
 * stage on the site - 38rem, the same width as the home page's Now Playing
 * rather than a step under it, because this is the page's rank-one moment and
 * the site's one tile gesture should be at its biggest here.
 *
 * That full width waits for `xl:`. The lock engages at `lg:`, where the measure
 * is 960px, and a 38rem stage there leaves the h1 a 304px column with its clamp
 * already pinned to the ladder's 36px floor - a real squeeze at a common laptop
 * width. The stage steps 34rem then 38rem instead, so the column the headline
 * gets never falls below what the headline needs.
 *
 * There is no "Play episode one" button beside it, deliberately. The stage
 * *is* the play control - it carries that gesture and the same play mark every
 * thumbnail on the site wears - and a labelled pill repeating the action would
 * give one action two affordances. The row carries the two paths the stage
 * cannot: the rest of the catalogue in the ink register, then subscribing in
 * YouTube's own colour.
 *
 * Order in the right column is the site's own - title, metadata, standfirst,
 * actions, the `PageHead` sequence every other interior route uses. The date
 * sat under the tile as a figcaption in a first pass, which read correctly on
 * a wide screen and turned into a tracked mono label stacked above the h1 the
 * moment the columns collapsed. That is an eyebrow whatever data it carries,
 * and DESIGN.md records this page shipping five of them once already.
 *
 * `episode` is null when the YouTube lookup misses (an id that has fallen out
 * of the channel feed, an API failure past the snapshot fallback). The player
 * still renders from the constant id, and the metadata line drops the facts it
 * no longer has rather than printing a placeholder date.
 *
 * Motion: the site's authored on-load stagger (`jb-in`), which globals.css
 * reserves for the two hero pages. The stage takes the transform-only variant
 * instead, because its poster is this page's LCP element and an opacity ramp
 * would delay the paint the animation is decorating. That variant settles from
 * 1.06, wider than the measure for the first frames, so the section clips on
 * the x axis - `clip` rather than `hidden`, so the tile's hover shadow still
 * throws below it.
 *
 * Copy is the published About page's own, unchanged (PRODUCT.md records it as
 * confirmed brand voice, not draft).
 */
export function Hero({
  episodeId,
  episode,
}: {
  episodeId: string;
  episode: Episode | null;
}) {
  const title = episode?.title ?? "Why We Started This";
  const runtime = episode ? formatRuntime(episode.duration) : "";

  return (
    <section className="bx-measure overflow-x-clip pt-14 pb-16 sm:pt-20 sm:pb-24">
      <div className="grid items-center gap-9 lg:grid-cols-[minmax(0,34rem)_1fr] lg:gap-10 xl:grid-cols-[minmax(0,38rem)_1fr] xl:gap-12">
        <div className="jb-hero-img">
          <EpisodePlayer
            videoId={episodeId}
            title={title}
            poster={`https://i.ytimg.com/vi/${episodeId}/maxresdefault.jpg`}
            posterFallback={episode?.thumbnail}
            runtime={runtime}
          />
        </div>

        <div>
          <h1 className="bx-display jb-in max-w-[17ch] text-[clamp(2.25rem,3.4vw,2.875rem)]">
            Two friends who couldn&apos;t stop talking about pickleball
          </h1>
          {/* Under the heading it belongs to, never above it - and it never
              repeats the runtime already drawn on the chip, or the title the
              thumbnail has baked into its own artwork. */}
          <p className="bx-meta jb-in jb-in-2 mt-4">
            Episode one
            {episode && (
              <>
                <span aria-hidden> &middot; </span>
                {formatAiredLong(episode.published)}
              </>
            )}
          </p>
          <p className="bx-lead jb-in jb-in-3 mt-5 max-w-[46ch]">
            So we hit record. Juice Bros is a podcast, a community, and most
            days a group chat that got a little out of hand. All for the
            everyday player who just wants to feel like they&apos;re part of
            something.
          </p>
          <div className="jb-in jb-in-4 mt-8 flex flex-wrap gap-3">
            <Link href="/podcast" className="bx-btn bx-btn-play">
              Every episode
            </Link>
            <a
              href={siteConfig.links.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="bx-btn bx-btn-yt"
            >
              <YoutubeIcon className="size-[1.125rem]" />
              Subscribe on YouTube
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
