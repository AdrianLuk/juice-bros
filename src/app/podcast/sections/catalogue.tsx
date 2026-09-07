import { siteConfig } from "@/config/site";
import type { Episode } from "@/lib/episodes";
import { EpisodeGrid } from "@/components/bx/episode-card";

/**
 * The catalogue. On this page the grid is not a section - it is the page, so
 * it gets no heading of its own (the h1 above already says what these are) and
 * runs at full measure straight down.
 *
 * `morph` is on here and nowhere else: clicking a thumbnail grows it into the
 * episode page's player, which only reads as one continuous object when the
 * grid is the thing you came to browse. The first four load eagerly, since on
 * every viewport at least one of them is above the fold.
 */
export function Catalogue({ episodes }: { episodes: Episode[] }) {
  if (episodes.length === 0) {
    return (
      <p className="bx-lead">
        Couldn&apos;t load episodes right now. Catch us on{" "}
        <a
          href={siteConfig.links.youtube}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[var(--bx-ink)] underline"
        >
          YouTube
        </a>{" "}
        in the meantime.
      </p>
    );
  }

  return <EpisodeGrid episodes={episodes} morph priorityCount={4} />;
}
