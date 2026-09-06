import Link from "next/link";

import { appearances } from "@/content/appearances";
import { formatAppearanceDates, nextConfirmedAppearance } from "@/lib/appearances";

/**
 * The next confirmed tournament. Renders nothing when there is no confirmed
 * date, rather than printing an empty promise.
 */
export function OnTheRoad() {
  const next = nextConfirmedAppearance(appearances);
  if (!next) return null;

  return (
    <section className="bx-measure bx-hair py-14 sm:py-20">
      <div className="bx-panel flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 className="bx-h2 max-w-[26ch] text-xl sm:text-2xl">{next.name}</h2>
          <p className="bx-meta mt-2.5">
            Next tournament
            <span aria-hidden> · </span>
            {formatAppearanceDates(next)}
          </p>
          <p className="mt-2 text-[0.9375rem] text-[var(--bx-muted)]">{next.location}</p>
        </div>
        <Link href="/appearances" className="bx-btn bx-btn-ghost shrink-0 self-start sm:self-auto">
          All appearances
        </Link>
      </div>
    </section>
  );
}
