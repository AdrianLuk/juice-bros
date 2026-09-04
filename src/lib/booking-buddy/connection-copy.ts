/**
 * The consequence copy shared across every path that leads to accepting a
 * Connection (issue #379, BB-2 story 7-10): the Connection Request Email, the
 * `/connect/<token>` confirmation page, and the in-app Accept control on the
 * Friends page all state the same thing before someone accepts; the
 * Connection Accepted Email states the shorter, past-tense version back to
 * the original requester. One shared string per notice keeps the four
 * surfaces from drifting out of sync with each other.
 *
 * Deliberately not shown at request-send time (no new copy there — see the
 * spec) — only where accepting actually happens.
 */

/** Shown before accepting, on every path that leads to an accept. */
export const CONNECTION_VISIBILITY_NOTICE =
  "You'll both see each other's games and availability — change that any time.";

/** Shown after accepting, to the original requester. */
export const CONNECTION_ACCEPTED_VISIBILITY_NOTICE =
  "You'll now see each other's games and availability.";
