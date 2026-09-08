/**
 * What a review card settled to, reported up to the "Sync bookings" section so
 * it can say so (issue #464).
 *
 * A settled card is dropped from the query cache and unmounts, which used to
 * be the only feedback a confirm ever gave: the card vanished, and the list it
 * landed in sits above the section, off-screen on a phone. The section keeps a
 * running tally of these instead, so "where did it go?" is answered where the
 * User is already looking.
 */
export type ReviewOutcome =
  | "added"
  | "updated"
  | "removed"
  | "kept"
  | "skipped";
