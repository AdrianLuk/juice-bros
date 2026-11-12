/**
 * Match Mixer's Live Mixer paths (ADR 0006). Free of Next.js imports so a
 * test can load it directly. The token is the whole credential for each.
 */

export const MATCH_MIXER_ROOT = "/tools/match-mixer";

/** The Organizer Link: can do everything. Kept by the organizer. */
export function organizerLinkPath(token: string): string {
  return `${MATCH_MIXER_ROOT}/organizer/${token}`;
}

/** The Player Link: the one pasted into the group chat. */
export function playerLinkPath(token: string): string {
  return `${MATCH_MIXER_ROOT}/player/${token}`;
}
