import Link from "next/link";

import { BoardCard } from "@/components/booking-buddy/bb/board-card";
import { slotPath } from "@/lib/booking-buddy/routes";
import type { BookACourtNote } from "@/lib/booking-buddy/actions/book-a-court";

/**
 * "Book a court for Tue, Oct 20 at 8:00 PM" (issue #573): one kraft note per
 * game whose facility has opened bookings and which still has no court.
 * Red "needs you" pin, never orange: orange stays the screen's one commit
 * (DESIGN.md). Not dismissible; it goes when its condition does. Renders
 * nothing with no notes, so a caller can drop it into its notice spot
 * unconditionally.
 *
 * `onGamePage` points the link at this page's own Courts section instead of
 * at the game, since the reader is already there.
 */
export function BookACourtNotes({
  notes,
  onGamePage = false,
  className,
}: {
  notes: readonly BookACourtNote[];
  onGamePage?: boolean;
  className?: string;
}) {
  if (notes.length === 0) {
    return null;
  }

  return (
    <ul aria-label="Courts to book" className={className ?? "flex flex-col gap-4"}>
      {notes.map((note) => (
        <li key={note.slotId}>
          <BoardCard
            pin="need"
            pinLabel="Needs you"
            pinAlign="left"
            pinned={false}
            className="bb-slip"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{note.heading}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{note.opened}</p>
              </div>
              <Link
                href={onGamePage ? "#courts" : slotPath(note.slotId)}
                className="shrink-0 text-sm underline underline-offset-4"
              >
                {onGamePage ? "Booked it? Attach it below" : "Open the game"}
              </Link>
            </div>
          </BoardCard>
        </li>
      ))}
    </ul>
  );
}
