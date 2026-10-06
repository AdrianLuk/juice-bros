/**
 * The lightbox's stepping rules, kept out of the component so they run under
 * the plain test runner. The order itself is `Gallery.photos` from
 * `photo-sets.ts`; these only decide where a step lands.
 */

/** How far a finger has to travel sideways before a drag counts as a swipe. */
const SWIPE_MIN_PX = 48;

/**
 * The photo one step from `index`, or null at either end. It stops rather
 * than wrapping: running off the last photo back onto the first reads as the
 * gallery starting over, which it isn't.
 */
export function stepPhoto(index: number, step: -1 | 1, count: number): number | null {
  const next = index + step;
  return next >= 0 && next < count ? next : null;
}

/**
 * Which way a touch drag steps: a swipe left (finger moving left, `dx` < 0)
 * goes to the next photo, as in any phone's photo viewer. A short drag, or one
 * that is more up-and-down than sideways (someone trying to scroll), is 0.
 */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}
