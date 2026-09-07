import Link from "next/link";

import { appearances } from "@/content/appearances";
import { formatAppearanceDates, nextConfirmedAppearance } from "@/lib/appearances";

/**
 * The next confirmed tournament. Renders nothing when there is no confirmed
 * date, rather than printing an empty promise.
 *
 * Built in the shelf's own pattern - a section label with its "all of them"
 * link, then the panel - so the shelf reads as two matching sections rather
 * than one labelled section plus an unidentifiable card. Without the label the
 * only thing naming this section was an 11px mono line inside the panel.
 */
export function OnTheRoad() {
  const next = nextConfirmedAppearance(appearances);
  if (!next) return null;

  return (
    <section className="bx-measure py-10 sm:py-14">
      <div className="flex items-baseline justify-between gap-6">
        <h2 className="bx-h2 text-lg sm:text-xl">On the road</h2>
        <Link
          href="/appearances"
          className="text-sm text-[var(--bx-muted)] transition-colors duration-200 hover:text-[var(--bx-ink)]"
        >
          All appearances
        </Link>
      </div>

      <div className="bx-panel mt-6 p-6 sm:p-7">
        <h3 className="bx-h2 max-w-[26ch] text-base sm:text-lg">{next.name}</h3>
        <p className="bx-meta mt-2">{formatAppearanceDates(next)}</p>
        <p className="mt-2 text-[0.9375rem] text-[var(--bx-muted)]">{next.location}</p>
      </div>
    </section>
  );
}
