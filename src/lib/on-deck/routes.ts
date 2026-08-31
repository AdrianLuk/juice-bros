/**
 * On Deck's paths, and which of them the proxy should gate.
 *
 * Free of Next.js imports so it can be unit tested directly, and so the proxy
 * and the pages agree on one definition of "Organizer only".
 *
 * Three distinct access models live here (ADR 0005 / #238's identity section):
 * Organizers are real accounts, Volunteers hold a per-Session link, Players
 * have nothing. Only the Organizer surface is auth-gated — everything a Player
 * or Volunteer touches is reachable with no session.
 */

export const ON_DECK_ROOT = "/on-deck";

/** The Organizer home screen — sign in, see your Club, tap Start. */
export const ON_DECK_HOME_PATH = `${ON_DECK_ROOT}/home`;

export const ON_DECK_SIGN_IN_PATH = `${ON_DECK_ROOT}/sign-in`;

/**
 * The stable per-Club path a printed QR sign points at. Resolves to the
 * currently-open Session, or a "nothing running right now" screen. One per
 * Club, never regenerated per Session.
 */
export function clubQrPath(clubId: string): string {
  return `${ON_DECK_ROOT}/c/${clubId}`;
}

export function sessionPath(sessionId: string): string {
  return `${ON_DECK_ROOT}/session/${sessionId}`;
}

/** The Organizer's floor screen for a running Session — Courts and the Queue. */
export function floorPath(sessionId: string): string {
  return `${ON_DECK_ROOT}/session/${sessionId}/floor`;
}

function isUnderRoot(pathname: string): boolean {
  // Exact match or a real segment beneath it — `/on-deck-press-kit` shares the
  // prefix but is not an On Deck route.
  return pathname === ON_DECK_ROOT || pathname.startsWith(`${ON_DECK_ROOT}/`);
}

/**
 * Only the Organizer subtree requires a session. The landing page, sign-in,
 * the Club QR resolver, and the live Session view are all open — but the
 * floor screen *under* a Session (`/session/:id/floor`) is the Organizer's.
 */
const ORGANIZER_SUBPATHS = ["/home"];

export function requiresOrganizerSession(pathname: string): boolean {
  if (!isUnderRoot(pathname)) {
    return false;
  }

  const subpath = pathname.slice(ON_DECK_ROOT.length);

  if (/^\/session\/[^/]+\/floor\/?$/.test(subpath)) {
    return true;
  }

  return ORGANIZER_SUBPATHS.some(
    (gated) => subpath === gated || subpath.startsWith(`${gated}/`),
  );
}

/**
 * Sanitises the `?next=` value the proxy attaches when it bounces a signed-out
 * Organizer, before it is used as a post-sign-in redirect. The value is off
 * the URL, so it is attacker-controllable: only On Deck paths are accepted,
 * and never sign-in itself (which would loop).
 */
export function safeRedirectTarget(next: string | null | undefined): string {
  if (!next) {
    return ON_DECK_HOME_PATH;
  }

  // Reject anything that could resolve to another origin: absolute URLs,
  // protocol-relative `//host`, and backslash forms browsers normalise into
  // them. Requiring a single leading `/` covers `javascript:` too.
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return ON_DECK_HOME_PATH;
  }

  // Compare on the path alone — `/on-deck/sign-in?next=…` and a trailing
  // slash must not slip past an exact-string check and bounce the Organizer
  // back to a page they just left.
  const path = next.split(/[?#]/, 1)[0].replace(/\/$/, "");
  const isAuthPage =
    path === ON_DECK_SIGN_IN_PATH || path.startsWith(`${ON_DECK_ROOT}/auth`);
  if (!isUnderRoot(next) || isAuthPage) {
    return ON_DECK_HOME_PATH;
  }

  return next;
}
