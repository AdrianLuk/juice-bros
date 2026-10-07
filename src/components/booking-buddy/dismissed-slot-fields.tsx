import type { BookingIdentity } from "@/lib/booking-buddy/import-candidate-shaping";

/**
 * A dismissed reservation's slot as four hidden inputs, read back by
 * `readDismissedSlotPost` (`lib/booking-buddy/dismissed-reservations.ts`),
 * whose field names these are.
 *
 * "Offer this again" (`suppressed-reservations.tsx`) posts it to delete the
 * dismissal. The import cards no longer render it: their Dismiss carries the
 * slot inside the candidate token (`import-candidate-token.ts`, issue #608).
 *
 * `orgId` is the Org the review matched, not whatever a card's Facility select
 * currently shows — the same Org the review's own filter compares against.
 */
export function DismissedSlotFields({ slot }: { slot: BookingIdentity }) {
  return (
    <>
      <input type="hidden" name="org_id" value={slot.orgId} />
      <input type="hidden" name="date" value={slot.date} />
      <input type="hidden" name="start_time" value={slot.startTime} />
      <input type="hidden" name="court_label" value={slot.courtLabel ?? ""} />
    </>
  );
}
