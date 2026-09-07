import Link from "next/link";

import { appearances } from "@/content/appearances";
import {
  describePlayers,
  formatAppearanceDates,
  formatShortDay,
  nextConfirmedAppearance,
  sortDivisions,
} from "@/lib/appearances";

/**
 * The next confirmed tournament. Renders nothing when there is no confirmed
 * date, rather than printing an empty promise.
 *
 * Built in the shelf's own pattern - a section label with its "all of them"
 * link, then the panel - so the shelf reads as two matching sections rather
 * than one labelled section plus an unidentifiable card.
 *
 * The panel carries the brackets they are actually entered in, which is real
 * data the home page was throwing away, and which is what a rec player reading
 * this actually wants to know. It also stops the panel being a full-width
 * raised rectangle three-quarters full of nothing: an appearance with no
 * `divisions` falls back to a single constrained column instead of stretching.
 */
export function OnTheRoad() {
  const next = nextConfirmedAppearance(appearances);
  if (!next) return null;

  const divisions = sortDivisions(next.divisions ?? []);

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

      <div
        className={`bx-panel mt-6 gap-8 p-6 sm:p-7 ${
          divisions.length > 0
            ? "grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] sm:gap-12"
            : "max-w-2xl"
        }`}
      >
        <div>
          <h3 className="bx-h2 max-w-[26ch] text-base sm:text-lg">{next.name}</h3>
          <p className="bx-meta mt-2">{formatAppearanceDates(next)}</p>
          <p className="mt-2 text-[0.9375rem] text-[var(--bx-muted)]">{next.location}</p>
          {next.url && (
            <a
              href={next.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-4 inline-flex text-sm font-semibold transition-colors duration-200 hover:text-[var(--bx-muted)]"
            >
              Tournament details
              <span
                aria-hidden
                className="ml-1.5 inline-block transition-transform duration-200 group-hover:translate-x-0.5"
              >
                &rarr;
              </span>
            </a>
          )}
        </div>

        {divisions.length > 0 && (
          <div>
            <p className="bx-meta">Entered in</p>
            <ul className="mt-2.5 space-y-px">
              {divisions.map((division) => (
                <li
                  key={division.name}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-[var(--bx-line-soft)] py-2 last:border-b-0"
                >
                  <span className="text-[0.9375rem] leading-snug">{division.name}</span>
                  <span className="bx-meta shrink-0">
                    {division.date && (
                      <>
                        {formatShortDay(division.date)}
                        <span aria-hidden> &middot; </span>
                      </>
                    )}
                    {describePlayers(division.players)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
