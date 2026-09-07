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
 * episode ever recorded, and it now sits in the first viewport at stage scale.
 *
 * There is no "Play episode one" button beside it, deliberately. The stage
 * *is* the play control - it carries the site's one tile gesture and the same
 * play mark every thumbnail on the site wears - and a labelled pill repeating
 * that action would give one action two affordances. The actions row carries
 * the two paths the stage cannot: subscribing, and the rest of the catalogue.
 *
 * `episode` is null when the YouTube lookup misses (an id that has fallen out
 * of the channel feed, an API failure past the snapshot fallback). The player
 * still renders from the constant id, and the caption simply drops the facts
 * it no longer has rather than printing a placeholder date.
 *
 * Motion: the site's authored on-load stagger (`jb-in`), which globals.css
 * reserves for the two hero pages. The stage takes the transform-only variant
 * instead, because its poster is this page's LCP element and an opacity ramp
 * would delay the paint the animation is decorating. That variant settles from
 * 1.06, which is wider than the measure for the first frames, so the section
 * clips on the x axis - `clip` rather than `hidden`, so the tile's hover
 * shadow still throws below the figure.
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
    <section className="bx-measure overflow-x-clip pt-10 pb-14 sm:pt-14 sm:pb-20">
      <div className="grid items-center gap-9 lg:grid-cols-[minmax(0,33rem)_1fr] lg:gap-14">
        <figure className="jb-hero-img m-0">
          <EpisodePlayer
            videoId={episodeId}
            title={title}
            poster={`https://i.ytimg.com/vi/${episodeId}/maxresdefault.jpg`}
            posterFallback={episode?.thumbnail}
            runtime={runtime}
          />
          {/* Under the tile it describes, not above a heading - and it never
              repeats the runtime already drawn on the chip, or the title the
              thumbnail has baked into the artwork. */}
          <figcaption className="bx-meta mt-3">
            Episode one
            {episode && (
              <>
                <span aria-hidden> &middot; </span>
                {formatAiredLong(episode.published)}
              </>
            )}
          </figcaption>
        </figure>

        <div>
          <h1 className="bx-display jb-in max-w-[17ch] text-[clamp(2.25rem,4.2vw,3.25rem)]">
            Two friends who couldn&apos;t stop talking about pickleball
          </h1>
          <p className="bx-lead jb-in jb-in-2 mt-6 max-w-[46ch]">
            So we hit record. Juice Bros is a podcast, a community, and most
            days a group chat that got a little out of hand. All for the
            everyday player who just wants to feel like they&apos;re part of
            something.
          </p>
          <div className="jb-in jb-in-3 mt-8 flex flex-wrap gap-3">
            <a
              href={siteConfig.links.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="bx-btn bx-btn-yt"
            >
              <YoutubeIcon className="size-[1.125rem]" />
              Subscribe on YouTube
            </a>
            <Link href="/podcast" className="bx-btn bx-btn-ghost">
              Every episode
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
