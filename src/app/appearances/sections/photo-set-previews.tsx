import Link from "next/link";

import type { PhotoSetView } from "@/lib/photo-sets";
import { PhotoRows } from "@/components/photo-rows";

/**
 * A taste of each Photo Set from an occasion the hosts went to but didn't play
 * (today, Creator Night), between the calendar and the collapsed "Already
 * played" list. A set from a tournament they played is reached from that
 * tournament's row instead ("See photos").
 *
 * It sits above that list on purpose. The past list is a disclosure that opens
 * closed, so anything under it is something a visitor has to ask for, and these
 * are the only photographs on the page below the header. They are not
 * tournaments (no brackets, no registration link), so they are not rows: the
 * heading names the occasion and one plain line says why it is on a page about
 * where to find the hosts.
 *
 * The photos are the set's first five, in the same rows as /photos, so a photo
 * looks the same here as in the gallery the link leads to.
 */
export function PhotoSetPreviews({ sets }: { sets: PhotoSetView[] }) {
  if (sets.length === 0) return null;

  return (
    <>
      {sets.map((set) => (
        <section key={set.address} className="bx-hair py-14 sm:py-20">
          <h2 className="bx-h2 max-w-[28ch] text-[clamp(1.375rem,3.2vw,1.875rem)]">
            {set.title}
          </h2>
          <p className="bx-meta mt-3">
            {set.dates}
            <span aria-hidden> &middot; </span>
            {set.venue}
          </p>
          <p className="mt-3.5 max-w-[52ch] text-[1.0625rem] leading-relaxed text-(--bx-muted)">
            {set.note}
          </p>

          <PhotoRows photos={set.photos} className="mt-8" />

          <Link href="/photos" className="bx-quietlink group mt-7 inline-flex items-center">
            All photos
            <span aria-hidden className="bx-arrow">
              &rarr;
            </span>
          </Link>
        </section>
      ))}
    </>
  );
}
