/**
 * Which Booking Buddy paths the proxy should gate.
 *
 * Kept free of Next.js imports so it can be unit tested directly, and so the
 * proxy and the layout agree on one definition of "signed-in only" rather than
 * each carrying their own copy.
 */

export const BOOKING_BUDDY_ROOT = "/booking-buddy";

export const SIGN_IN_PATH = `${BOOKING_BUDDY_ROOT}/sign-in`;

export const FRIENDS_PATH = `${BOOKING_BUDDY_ROOT}/friends`;

export const GROUPS_PATH = `${BOOKING_BUDDY_ROOT}/groups`;

export const ORGS_PATH = `${BOOKING_BUDDY_ROOT}/orgs`;

export const BOOKINGS_PATH = `${BOOKING_BUDDY_ROOT}/bookings`;

export const SLOTS_PATH = `${BOOKING_BUDDY_ROOT}/slots`;

export function slotPath(slotId: string): string {
  return `${SLOTS_PATH}/${slotId}`;
}

export const SETTINGS_PATH = `${BOOKING_BUDDY_ROOT}/settings`;

export const PRIVACY_PATH = `${BOOKING_BUDDY_ROOT}/privacy`;

/**
 * A personal invite link (issue #175): `/booking-buddy/join/<token>`, where
 * the token is the sender's own `profiles.invite_token`. Reachable while
 * signed out — the whole point is a friend who isn't on Booking Buddy yet —
 * so it sits in `PUBLIC_SUBPATHS` below.
 */
export const JOIN_PATH = `${BOOKING_BUDDY_ROOT}/join`;

export function joinPath(token: string): string {
  return `${JOIN_PATH}/${token}`;
}

/**
 * A Guest's own view of one Slot (issue #10) — deliberately outside
 * `BOOKING_BUDDY_ROOT`, so `requiresSession` never gates it and a Guest is
 * never asked to sign in to use it.
 */
export const SLOT_LINK_ROOT = "/s";

export function slotLinkPath(token: string): string {
  return `${SLOT_LINK_ROOT}/${token}`;
}

/**
 * Reachable while signed out, despite living under the Booking Buddy root.
 * "/privacy" is here alongside "/sign-in" so the policy can be linked from
 * the sign-in page itself, before there's a session to check. "/join" is a
 * personal invite link (issue #175) — a friend who isn't on Booking Buddy
 * yet must be able to open it.
 */
const PUBLIC_SUBPATHS = ["/sign-in", "/auth", "/privacy", "/join"];

function isUnderRoot(pathname: string): boolean {
  // Exact match or a real path segment beneath it — `/booking-buddy-press-kit`
  // shares the prefix but is not a Booking Buddy route.
  return (
    pathname === BOOKING_BUDDY_ROOT || pathname.startsWith(`${BOOKING_BUDDY_ROOT}/`)
  );
}

/**
 * Sanitises the `?next=` value the proxy attaches when it bounces a signed-out
 * visitor, before it is used as a redirect after sign-in.
 *
 * The value comes off the URL, so it is attacker-controllable: without this, a
 * crafted link could land a freshly-authenticated User on another origin. Only
 * paths inside Booking Buddy are accepted; anything else falls back to the
 * dashboard.
 */
export function safeRedirectTarget(next: string | null | undefined): string {
  if (!next) {
    return BOOKING_BUDDY_ROOT;
  }

  // Reject anything that could resolve to another origin: absolute URLs,
  // protocol-relative `//host`, and backslash forms some browsers normalise
  // into them. Requiring a single leading `/` covers `javascript:` too.
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return BOOKING_BUDDY_ROOT;
  }

  // Only ever a Booking Buddy destination — this is the only section sign-in
  // guards — and never sign-in itself, which would loop.
  if (!isUnderRoot(next) || requiresSession(next) === false) {
    return BOOKING_BUDDY_ROOT;
  }

  return next;
}

export function requiresSession(pathname: string): boolean {
  if (!isUnderRoot(pathname)) {
    return false;
  }

  const subpath = pathname.slice(BOOKING_BUDDY_ROOT.length);

  // The section root is the public marketing page for signed-out visitors and
  // the dashboard for signed-in ones — the page itself branches on the session,
  // so the proxy must let it through either way. Every nested route stays gated.
  if (subpath === "") {
    return false;
  }

  return !PUBLIC_SUBPATHS.some(
    (publicSubpath) =>
      subpath === publicSubpath || subpath.startsWith(`${publicSubpath}/`),
  );
}
