/**
 * Turning a Player's `waitSince` (epoch ms, off the fold) into the short phrase
 * the Display and the floor put next to a Queue entry (issue #253). Pure and
 * relative-import-only so `node --test` can cover it — it reads a `now` passed
 * in, never the wall clock, the same discipline the fold keeps.
 */

const MINUTE = 60_000;

/**
 * "just now" under a minute, "7 min" under an hour, "1 hr 12 min" beyond — and
 * "1 hr" on the hour. A negative or future `waitSince` (clock skew between the
 * server that stamped the event and the tablet reading it) clamps to "just
 * now" rather than showing a nonsense negative.
 */
export function formatWaitLabel(waitSince: number, now: number): string {
  const elapsed = now - waitSince;
  if (elapsed < MINUTE) return "just now";

  const totalMinutes = Math.floor(elapsed / MINUTE);
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}
