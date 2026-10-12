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

/**
 * Whether a live screen can still vouch for what it shows (issue #661). The
 * screen keeps its last good read while reads fail; past a short blip it says
 * so, and once a reload is the only way back (a redeploy retires the read) it
 * asks for one. The poll itself never changes for this.
 */
export type Freshness = "fresh" | "reconnecting" | "reload";

/** Long enough that a wifi blip never flashes a note on the TV. */
export const RECONNECTING_AFTER_MS = 30_000;

export const RELOAD_AFTER_MS = 120_000;

/** `failingForMs`: how long reads have been failing, null while they land. */
export function freshnessFor(failingForMs: number | null): Freshness {
  if (failingForMs === null || failingForMs < RECONNECTING_AFTER_MS) return "fresh";
  return failingForMs < RELOAD_AFTER_MS ? "reconnecting" : "reload";
}

/** Whether a screen should say it is behind: no LIVE mark, and the note. */
export function isStale(freshness: Freshness | undefined): boolean {
  return freshness === "reconnecting" || freshness === "reload";
}

/** Since when reads have been failing, pinned to the last good read it followed. */
export type FailureClock = { lastGoodRead: number; since: number } | null;

/**
 * Starts the clock at the first failed read and stops it only when a read
 * lands. Not when "failing" blinks false: after a redeploy every Realtime
 * broadcast restarts the dead read, and a clock that restarted with it would
 * never reach 30 seconds.
 */
export function trackFailures(
  clock: FailureClock,
  { failing, lastGoodRead, now }: { failing: boolean; lastGoodRead: number; now: number },
): FailureClock {
  if (clock && clock.lastGoodRead !== lastGoodRead) clock = null;
  return clock ?? (failing ? { lastGoodRead, since: now } : null);
}
