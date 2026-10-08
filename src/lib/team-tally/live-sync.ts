/**
 * How Team Tally's live screens stay current (issue #623): a Realtime
 * broadcast on `team-tally:<event id>` says something changed and the screen
 * re-reads; a poll is the fallback when the socket is down, and a slow
 * backstop when it is up. The same policy as On Deck's (src/lib/on-deck/
 * session/realtime.ts), duplicated on purpose: the two contexts share the
 * Supabase project and nothing else. Pure, for `node --test`.
 */

export type RealtimeStatus = "connecting" | "live" | "dropped";

export function statusFromChannel(status: string): RealtimeStatus {
  if (status === "SUBSCRIBED") return "live";
  if (status === "TIMED_OUT" || status === "CHANNEL_ERROR" || status === "CLOSED") return "dropped";
  return "connecting";
}

/** While the socket is connecting or down: poll often enough to feel live. */
export const FALLBACK_POLL_MS = 4_000;

/** While the socket carries the updates: a backstop for a missed broadcast. */
export const LIVE_POLL_MS = 15_000;

export function pollIntervalFor(status: RealtimeStatus): number {
  return status === "live" ? LIVE_POLL_MS : FALLBACK_POLL_MS;
}

/** The Realtime topic a Team Event's changes are broadcast on. */
export function teamEventTopic(eventId: string): string {
  return `team-tally:${eventId}`;
}
