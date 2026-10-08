/**
 * Team Tally's paths, and which of them the proxy should gate.
 *
 * Free of Next.js imports so it can be unit tested directly, and so the proxy
 * and the pages agree on one definition of "Organizer only". Three kinds of
 * access live here: the Organizer is a real account; a captain holds a Score
 * Link and anyone holds the Public Link, each a token in the path with no
 * account (team-tally/CONTEXT.md, "Links").
 */

export const TEAM_TALLY_ROOT = "/tools/team-tally";

export const TEAM_TALLY_SIGN_IN_PATH = `${TEAM_TALLY_ROOT}/sign-in`;

const EVENTS_PATH = `${TEAM_TALLY_ROOT}/events`;

/** Build a new Team Event. */
export const TEAM_TALLY_NEW_EVENT_PATH = `${EVENTS_PATH}/new`;

/** One Team Event, for its Organizer: the Brief and what comes after it. */
export function teamEventPath(eventId: string): string {
  return `${EVENTS_PATH}/${eventId}`;
}

/** Change a Team Event's setup. */
export function editTeamEventPath(eventId: string): string {
  return `${teamEventPath(eventId)}/edit`;
}

/** A Team's Score Link (issue #623). The token is the credential. */
export function scoreLinkPath(token: string): string {
  return `${TEAM_TALLY_ROOT}/score/${token}`;
}

/** The Team Event's read-only Public Link. The token is the credential. */
export function publicLinkPath(token: string): string {
  return `${TEAM_TALLY_ROOT}/live/${token}`;
}

function isUnderRoot(pathname: string): boolean {
  return pathname === TEAM_TALLY_ROOT || pathname.startsWith(`${TEAM_TALLY_ROOT}/`);
}

/** Only the Organizer's Team Events are gated; the landing branches itself. */
export function requiresOrganizerSession(pathname: string): boolean {
  return pathname === EVENTS_PATH || pathname.startsWith(`${EVENTS_PATH}/`);
}

/**
 * Sanitises the `?next=` the proxy attaches when it bounces a signed-out
 * Organizer. It comes off the URL, so only Team Tally paths are accepted, and
 * never sign-in itself (which would loop).
 */
export function safeRedirectTarget(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return TEAM_TALLY_ROOT;
  }

  const path = next.split(/[?#]/, 1)[0].replace(/\/$/, "");
  if (!isUnderRoot(path) || path === TEAM_TALLY_SIGN_IN_PATH || path.startsWith(`${TEAM_TALLY_ROOT}/auth`)) {
    return TEAM_TALLY_ROOT;
  }

  return next;
}
