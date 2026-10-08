/**
 * The arithmetic behind the tower's re-sort motion (issue #625): FLIP, "first,
 * last, invert, play". Given where each row sat before a re-sort and where it
 * sits now, how far each moved row must be pushed back so it can slide into
 * its new place. Pure; the DOM half lives in the tower's hook.
 *
 * Relative imports only, for `node --test`.
 */

/** A move smaller than this is layout noise, not a re-sort. */
const MIN_MOVE_PX = 1;

/**
 * The `translateY` each moved row starts from: its old top minus its new top.
 * Rows with no earlier place (just arrived) and rows that did not move are
 * left out.
 */
export function flipDeltas(before: ReadonlyMap<string, number>, after: ReadonlyMap<string, number>): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const [key, top] of after) {
    const was = before.get(key);
    if (was === undefined) continue;
    const delta = was - top;
    if (Math.abs(delta) >= MIN_MOVE_PX) deltas.set(key, delta);
  }
  return deltas;
}
