/**
 * Realtime sync policy for On Deck's live surfaces (issue #252).
 *
 * Every surface (the floor screen, a Player's own line) already re-folds the
 * same event log on a poll (issue #243). Realtime is an isolated swap of the
 * *trigger*: subscribe to `on_deck_session_events` inserts and re-fetch on
 * notify, so a "Court done" tap propagates in ~1s. Polling stays as the
 * automatic fallback — when the socket is healthy it slows right down; when it
 * drops it speeds back up to the pre-Realtime cadence.
 *
 * Pure and dependency-free so `node --test` can cover it (no `@/` imports —
 * see PROGRESS.md). The hook that owns the Supabase channel lives in
 * `src/components/on-deck/use-rotation-sync.ts`.
 */

/** The channel's connection health, as this module cares about it. */
export type RealtimeStatus = "connecting" | "live" | "dropped";

/** The Supabase channel lifecycle strings, narrowed to what we branch on. */
export type ChannelStatus =
  | "SUBSCRIBED"
  | "TIMED_OUT"
  | "CHANNEL_ERROR"
  | "CLOSED";

export function statusFromChannel(status: ChannelStatus): RealtimeStatus {
  switch (status) {
    case "SUBSCRIBED":
      return "live";
    case "TIMED_OUT":
    case "CHANNEL_ERROR":
    case "CLOSED":
      return "dropped";
    default:
      return "connecting";
  }
}

/**
 * The pre-Realtime poll interval (issue #243). The fallback cadence, and what
 * every surface runs at until the channel confirms it is live.
 */
export const FALLBACK_POLL_MS = 4_000;

/**
 * How often to poll once Realtime is carrying the updates. Not off entirely —
 * a slow poll is the backstop for the notifies Realtime structurally can't
 * deliver: a `SESSION_CLOSED` INSERT is invisible to an `anon` subscriber
 * because Realtime re-checks the "open Session" SELECT policy at notify time
 * and the Session is closed by then. 12s keeps that lag tolerable while still
 * being far under the free-tier limits for the club's one Session (issue #252).
 * The Undo DELETE is covered directly — the channel listens for `*`, not just
 * INSERT.
 */
export const LIVE_POLL_MS = 12_000;

/**
 * The TanStack Query `refetchInterval` for the current channel health. `live`
 * leans on the socket and only slow-polls; `connecting` and `dropped` both run
 * the full fallback cadence so a surface is never worse off than before
 * Realtime.
 */
export function pollIntervalFor(status: RealtimeStatus): number {
  return status === "live" ? LIVE_POLL_MS : FALLBACK_POLL_MS;
}
