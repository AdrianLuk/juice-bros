/**
 * Dink Dine & Drink's paths. Free of Next.js imports so a test and the proxy
 * can load it. Unlisted (spec #709): nothing on the Apps page or the tools
 * index links here.
 *
 * Three kinds of access: an Organizer is a signed-in account on the list; the
 * Score Link and the Public Link are tokens in the path with no account.
 */

export const DDD_ROOT = "/tools/ddd";

export const NEW_DDD_PATH = `${DDD_ROOT}/new`;

export function dddPath(eventId: string): string {
  return `${DDD_ROOT}/events/${eventId}`;
}

export function editDddPath(eventId: string): string {
  return `${dddPath(eventId)}/edit`;
}

const JOIN_PREFIX = `${DDD_ROOT}/join/`;

/** An invite link: open it, sign in with Google, and you are an Organizer. */
export function invitePath(token: string): string {
  return `${JOIN_PREFIX}${token}`;
}

/** The token in an invite path, or null for any other path. */
export function inviteTokenOf(pathname: string): string | null {
  if (!pathname.startsWith(JOIN_PREFIX)) return null;
  const token = pathname.slice(JOIN_PREFIX.length).replace(/\/$/, "");
  return /^[A-Za-z0-9]+$/.test(token) ? token : null;
}

/** The one Score Link: whoever holds it enters scores. */
export function scoreLinkPath(token: string): string {
  return `${DDD_ROOT}/score/${token}`;
}

/** The read-only Public Link, for phones and the venue TV. */
export function publicLinkPath(token: string): string {
  return `${DDD_ROOT}/live/${token}`;
}

function isUnderRoot(pathname: string): boolean {
  return pathname === DDD_ROOT || pathname.startsWith(`${DDD_ROOT}/`);
}

/**
 * Which paths the proxy refreshes a session on: everything but the two
 * links, whose holders have no account. The pages check the Organizer
 * themselves, so nothing is redirected there.
 */
export function needsSession(pathname: string): boolean {
  return (
    isUnderRoot(pathname) &&
    !pathname.startsWith(`${DDD_ROOT}/score/`) &&
    !pathname.startsWith(`${DDD_ROOT}/live/`)
  );
}

/** Where to go after sign-in. It comes off the client, so only DDD paths pass. */
export function safeRedirectTarget(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return DDD_ROOT;
  }
  return isUnderRoot(next.split(/[?#]/, 1)[0]) ? next : DDD_ROOT;
}

/** The Lineups: each Team's four Pairs, typed in from the group chat. */
export function lineupsPath(eventId: string): string {
  return `${dddPath(eventId)}/lineups`;
}

/** The roster: paste it, then edit it. */
export function rosterPath(eventId: string): string {
  return `${dddPath(eventId)}/roster`;
}
