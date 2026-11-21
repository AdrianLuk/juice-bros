/**
 * How DDD's live screens stay current (#715): a Realtime broadcast on
 * `ddd:<event id>` says something changed and the screen re-reads; a poll
 * is the fallback while the socket is down and a slow backstop while it is
 * up. Team Tally's policy (src/lib/team-tally/live-sync.ts), copied rather
 * than shared: the contexts share the Supabase project and nothing else.
 * Pure, for `node --test`.
 */

export type RealtimeStatus = "connecting" | "live" | "dropped";

export function statusFromChannel(status: string): RealtimeStatus {
  if (status === "SUBSCRIBED") return "live";
  if (status === "TIMED_OUT" || status === "CHANNEL_ERROR" || status === "CLOSED") return "dropped";
  return "connecting";
}

/** While the socket is connecting or down: often enough to feel live. */
export const FALLBACK_POLL_MS = 4_000;

/** While the socket carries the updates: a backstop for a missed broadcast. */
export const LIVE_POLL_MS = 15_000;

export function pollIntervalFor(status: RealtimeStatus): number {
  return status === "live" ? LIVE_POLL_MS : FALLBACK_POLL_MS;
}

/** The Realtime topic a DDD's changes are broadcast on (ddd_broadcast_change). */
export function dddTopic(eventId: string): string {
  return `ddd:${eventId}`;
}
