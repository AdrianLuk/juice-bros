import type { AppearanceDivision } from "@/lib/appearances";
import { describePlayers, formatShortDay } from "@/lib/appearances";

/**
 * The brackets the hosts are entered in.
 *
 * This is the one piece of data on the page a rec player actually plans
 * around - which day, which bracket, which of the two of them - so it is set
 * as a readable list with the division in ink and the day and players in
 * metadata beside it, the same shape the home page's tournament panel uses.
 */
export function DivisionsList({ divisions }: { divisions: AppearanceDivision[] }) {
  if (divisions.length === 0) return null;

  return (
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
  );
}
