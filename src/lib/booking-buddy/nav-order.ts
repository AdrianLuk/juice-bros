/**
 * The Booking Buddy app's reading order, and the forward / back / lateral
 * call the directional route transition keys off it
 * (`src/app/booking-buddy/template.tsx`).
 *
 * Kept free of Next.js / React imports so it unit-tests directly, the same
 * way `routes.ts` beside it does.
 */

import { BB_SECTIONS, BOOKING_BUDDY_ROOT } from "./routes.ts";

export type BbNavDirection = "forward" | "back" | "lateral";

/**
 * Every primary destination in the app, in the order the nav presents them:
 * section by section (`BB_SECTIONS`), and within a section that has a sibling
 * row, child by child. A destination further down this list sits "ahead" of
 * one higher up — the new page slides in from the trailing edge going that
 * way, from the leading edge coming back, and a move that resolves to neither
 * (a jump between unrelated things, or in/out of a pre-auth page that isn't
 * on this list at all) just cross-fades.
 */
const ORDER: readonly string[] = BB_SECTIONS.flatMap((section) =>
  section.children.length > 0
    ? section.children.map((child) => child.href)
    : [section.primary],
);

/**
 * Where a pathname sits in `ORDER`. The deepest (longest) matching entry
 * wins, so a detail route like `/booking-buddy/slots/<id>` ranks with its
 * list (`/booking-buddy/slots`) rather than falling through to the section
 * root. `-1` for anything off the list (sign-in, privacy, join).
 */
function rank(pathname: string): number {
  let bestIndex = -1;
  let bestLength = -1;

  for (let index = 0; index < ORDER.length; index += 1) {
    const base = ORDER[index];
    // The bare root is a prefix of every app route, so it only ever matches
    // exactly — otherwise it would rank every pre-auth page (sign-in, join)
    // as the dashboard instead of leaving them unranked.
    const matches =
      pathname === base ||
      (base !== BOOKING_BUDDY_ROOT && pathname.startsWith(`${base}/`));
    if (matches && base.length > bestLength) {
      bestIndex = index;
      bestLength = base.length;
    }
  }

  return bestIndex;
}

/**
 * The direction the content column should travel for a `from` → `to`
 * navigation inside Booking Buddy.
 *
 * A strict parent/child move reads as depth before anything else — a list
 * opening its own detail is `forward`, the detail closing back to the list is
 * `back` — regardless of where either sits in `ORDER`. Otherwise the two
 * ranks decide it, and a tie or an unranked endpoint is `lateral`.
 */
export function bookingBuddyNavDirection(
  from: string | null | undefined,
  to: string,
): BbNavDirection {
  if (!from || from === to) {
    return "lateral";
  }

  if (to.startsWith(`${from}/`)) {
    return "forward";
  }
  if (from.startsWith(`${to}/`)) {
    return "back";
  }

  const fromRank = rank(from);
  const toRank = rank(to);
  if (fromRank === -1 || toRank === -1 || fromRank === toRank) {
    return "lateral";
  }

  return toRank > fromRank ? "forward" : "back";
}

/** Exposed for the test only — the ordered destination list. */
export const BB_NAV_ORDER = ORDER;
export { BOOKING_BUDDY_ROOT };
