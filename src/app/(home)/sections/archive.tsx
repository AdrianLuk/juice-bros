import Link from "next/link";

import type { Episode } from "@/lib/episodes";
import { EpisodeGrid } from "@/components/bx/episode-card";
import { SectionHead } from "@/components/bx/page-head";

/**
 * The archive.
 *
 * A grid, not the horizontal rail the approved mockup showed - a deliberate,
 * disclosed deviation (see the surface brief). A rail keeps most of the
 * catalogue off-screen and turns browsing into a swipe most phone visitors
 * never make, which works against the one metric this page exists to serve.
 *
 * It follows the band directly, so the episodes read as one passage: the
 * newest one at full size, then the rest of the catalogue, with nothing
 * between them. It carries no `bx-hair` for that reason - the band's own
 * bottom border already draws that line.
 *
 * The card itself now lives in `@/components/bx/episode-card`, shared with the
 * Podcast catalogue: same object, same card, so a visitor moving between the
 * two pages does not have to re-learn it. `morph` stays off here — this grid is
 * one section among several, so it keeps the plain page cross-fade, while the
 * catalogue (where the grid *is* the page) grows the clicked thumbnail into the
 * episode page's player.
 */
export function Archive({ episodes }: { episodes: Episode[] }) {
  if (episodes.length === 0) return null;

  return (
    <section className="bx-measure py-16 sm:py-24">
      <SectionHead
        title="Every episode"
        link={
          <Link href="/podcast" className="bx-quietlink">
            View all
          </Link>
        }
      />
      <div className="mt-7">
        <EpisodeGrid episodes={episodes} />
      </div>
    </section>
  );
}
