import Link from "next/link";

import { cn } from "@/lib/utils";
import { slotPath } from "@/lib/booking-buddy/routes";
import type { Slot } from "@/lib/booking-buddy/actions/slots";
import { BoardCard } from "./board-card";
import { TapeLabel } from "./tape-label";

/**
 * A game pinned to the board. A court booked reads "set" with a green pin; a
 * bare "who's in?" proposal reads amber — still gathering, still needs a court.
 * The RSVP tally is penned on in the handwriting face; capacity shows as a row
 * of pushpin holes filling.
 */

type Tally = { yes: number; maybe: number; capacity: number | null };

export function GameCard({
  slot,
  tally,
  size = "regular",
  pinInOnMount,
}: {
  slot: Slot;
  tally?: Tally;
  /** The soonest game leads the region larger. */
  size?: "lead" | "regular";
  pinInOnMount?: boolean;
}) {
  const booked = slot.courtCount > 0;
  const lead = size === "lead";
  const holes = tally?.capacity ?? (booked ? 4 : null);
  const { day, time } = splitWhen(slot.when);

  return (
    <BoardCard
      as={Link}
      href={slotPath(slot.id)}
      pin={booked ? "in" : "maybe"}
      pinLabel={booked ? "Court booked" : "Still gathering"}
      interactive
      pinInOnMount={pinInOnMount}
      className={cn(
        "block no-underline",
        lead ? "w-[19rem] sm:w-[21rem]" : "w-[15.5rem]",
      )}
    >
      <p className="font-bb-sign text-[0.68rem] tracking-[0.13em] text-muted-foreground uppercase">
        {day}
      </p>
      <h3
        className={cn(
          "mt-0.5 leading-[1.05] font-semibold text-foreground",
          lead ? "text-[1.7rem]" : "text-[1.3rem]",
        )}
      >
        {time}
      </h3>

      {slot.facilityLabel ? (
        <TapeLabel className="mt-2.5">{slot.facilityLabel}</TapeLabel>
      ) : (
        <p className="mt-2 text-[0.8rem] text-muted-foreground italic">
          no court yet
        </p>
      )}

      <div className="mt-3 flex items-baseline gap-1.5">
        <span
          aria-hidden
          className="bb-hand bb-hand--pen text-[1.5rem] leading-none"
        >
          {(tally?.yes ?? 0) > 0 ? tally!.yes : "–"}
        </span>
        <span className="text-[0.78rem] text-muted-foreground">
          {tallyLabel(tally, booked)}
        </span>
      </div>

      {holes != null && (
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {Array.from({ length: Math.max(holes, tally?.yes ?? 0) }).map(
            (_, i) => (
              <span
                key={i}
                className={cn(
                  "size-3 rounded-full",
                  i < (tally?.yes ?? 0)
                    ? "bg-[var(--bb-pin-in)] shadow-[0_1px_2px_rgba(0,0,0,.35)]"
                    : "bg-black/15 shadow-[inset_0_1px_2px_rgba(0,0,0,.35)]",
                )}
              />
            ),
          )}
        </div>
      )}
    </BoardCard>
  );
}

/**
 * `slot.when` arrives as "Sat, Sep 5, 2026 · 9:00 AM – 11:00 AM". Split it into
 * a compact day stamp for the kicker and a tight time range for the title.
 */
function splitWhen(when: string): { day: string; time: string } {
  const [left, right] = when.split(" · ");
  const day = (left ?? when).replace(/,\s*\d{4}$/, "").replace(/,\s*/g, " · ");
  let time = right ?? "";
  // "9:00 AM – 11:00 AM" → "9:00–11:00 AM"; keep both meridiems if they differ.
  const m = time.match(/^(.+?)\s*(AM|PM)\s*[–-]\s*(.+?)\s*(AM|PM)$/i);
  if (m) {
    time =
      m[2].toUpperCase() === m[4].toUpperCase()
        ? `${m[1]}–${m[3]} ${m[4].toUpperCase()}`
        : `${m[1]} ${m[2].toUpperCase()} – ${m[3]} ${m[4].toUpperCase()}`;
  }
  return { day, time: time || when };
}

function tallyLabel(tally: Tally | undefined, booked: boolean): string {
  if (!tally || (tally.yes === 0 && tally.maybe === 0)) {
    return booked ? "no replies yet" : "waiting on replies";
  }
  const parts = [`${tally.yes} in`];
  if (tally.maybe > 0) parts.push(`${tally.maybe} maybe`);
  if (tally.capacity != null && tally.yes >= tally.capacity) parts.push("full");
  return parts.join(" · ");
}
