/**
 * The forgotten-Session auto-close (issue #516, parent #512).
 *
 * An Organizer who never taps Close blocks their own next night — one open
 * Session per Club is enforced, and at a Club nobody but them runs, there is
 * nobody else to notice. So a Session whose log has gone quiet past
 * `AUTO_CLOSE_AFTER_MS` closes itself, the next time the Organizer's own home
 * screen or Start tap looks at it (`resolveOpenSessionForClub` in
 * `../sessions.ts`) — this project has no scheduler to fire it on its own
 * clock.
 *
 * `isSessionStale` is the pure half of that decision, mirroring
 * `on_deck_stale_after()` in the database, which is the authority: the
 * database re-checks staleness itself and refuses to close anything this
 * function would call live, so a mismatch here only ever costs a slightly
 * late close, never an early one.
 *
 * Relative imports only and no `server-only` — pure logic over two numbers,
 * unit-tested under `node --test`.
 */

/**
 * How long a Session's event log may sit quiet before it is eligible to close
 * itself. Six hours is comfortably past any real club night — TO Pickleball
 * Club's own runs two — while being nowhere near "left open since last week",
 * which is the actual failure this exists to catch. Keep in sync with
 * `on_deck_stale_after()`.
 */
export const AUTO_CLOSE_AFTER_MS = 6 * 60 * 60 * 1000;

/**
 * Whether a Session's log has gone quiet long enough to auto-close, given the
 * timestamp (ms) of its most recent event and the current time (ms, injected
 * so this stays testable). Measured from the *last event*, never from when
 * the Session started — a Session open ten hours with an event five minutes
 * ago is exactly as live as one two minutes old.
 */
export function isSessionStale(lastEventAt: number, now: number): boolean {
  return now - lastEventAt > AUTO_CLOSE_AFTER_MS;
}
