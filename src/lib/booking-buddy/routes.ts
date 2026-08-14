/**
 * Which Booking Buddy paths the proxy should gate.
 *
 * Kept free of Next.js imports so it can be unit tested directly, and so the
 * proxy and the layout agree on one definition of "signed-in only" rather than
 * each carrying their own copy.
 */

export const BOOKING_BUDDY_ROOT = "/booking-buddy";

export const SIGN_IN_PATH = `${BOOKING_BUDDY_ROOT}/sign-in`;

/** Reachable while signed out, despite living under the Booking Buddy root. */
const PUBLIC_SUBPATHS = ["/sign-in", "/auth"];

function isUnderRoot(pathname: string): boolean {
  // Exact match or a real path segment beneath it — `/booking-buddy-press-kit`
  // shares the prefix but is not a Booking Buddy route.
  return (
    pathname === BOOKING_BUDDY_ROOT || pathname.startsWith(`${BOOKING_BUDDY_ROOT}/`)
  );
}

export function requiresSession(pathname: string): boolean {
  if (!isUnderRoot(pathname)) {
    return false;
  }

  const subpath = pathname.slice(BOOKING_BUDDY_ROOT.length);

  return !PUBLIC_SUBPATHS.some(
    (publicSubpath) =>
      subpath === publicSubpath || subpath.startsWith(`${publicSubpath}/`),
  );
}
