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

/** The Organizer's Club settings screen — edit the saved Session defaults. */
export const ON_DECK_SETTINGS_PATH = `${ON_DECK_ROOT}/home/settings`;

/** Create a Session ahead of time (issue #254). */
export const ON_DECK_NEW_SESSION_PATH = `${ON_DECK_ROOT}/home/sessions/new`;

/** Edit a not-yet-open Session (issue #254). */
export function editSessionPath(sessionId: string): string {
  return `${ON_DECK_ROOT}/home/sessions/${sessionId}`;
}

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

/**
 * The read-only Display (issue #253) — Courts, the ordered Queue with Wait
 * Times, and the two On Deck Foursomes, for a tablet on the snack table. No
 * account and no token: it renders only what the venue's wall already shows
 * (display names, no Skill Level, no contact data) and carries no buttons.
 */
export function displayPath(sessionId: string): string {
  return `${ON_DECK_ROOT}/session/${sessionId}/display`;
}

/**
 * The courtside Kiosk (issue #259): the Display's board plus the turnover
 * buttons a Game needs, for a tablet stood by the courts. Open, no account and
 * no token — the Session id is its own credential, the same as the Display, and
 * ADR 0005 accepts that anyone courtside can tap. Inert unless the Session's
 * Floor Mode is `self-serve` or `hybrid` (checked in the page).
 */
export function kioskPath(sessionId: string): string {
  return `${ON_DECK_ROOT}/session/${sessionId}/kiosk`;
}

/**
 * The per-Session Volunteer Link (issue #248): the operational floor surface,
 * no account, admitted by the link's token rather than a session. Not
 * Organizer-gated (ADR 0005) — the token in the path is the credential, and it
 * stops working when the Session closes.
 */
export function volunteerPath(sessionId: string, token: string): string {
  return `${ON_DECK_ROOT}/session/${sessionId}/volunteer/${token}`;
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
 * The Volunteer Link (`/session/:id/volunteer/:token`) stays open: the token
 * is its credential (ADR 0005), verified in the page, not by a session.
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
