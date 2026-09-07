import type { BookingIdentity } from "@/lib/booking-buddy/import-candidate-shaping";

/**
 * The reservation's slot, carried on an Import Candidate's Dismiss form so the
 * dismissal settles the *other* import source too (issue #437) — read back by
 * `readDismissedSlotPost` (`lib/booking-buddy/dismissed-reservations.ts`),
 * whose field names these are.
 *
 * Rendered by all three import cards — the email one, the feed one and the
 * merged one — so the four names live in one place beside the reader rather
 * than pasted into each. Deliberately *not* rendered by a cancellation
 * candidate's "Keep booking": that means keep this Booking, not "I don't want
 * this reservation", and a dismissal recorded there would suppress a future
 * import of a slot the User is still playing.
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
