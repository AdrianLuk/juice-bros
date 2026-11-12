/**
 * How a Live Mixer's screens stay current (#688): the database broadcasts a
 * data-free "changed" on the Live Mixer's topic and the screen re-reads;
 * polling is the fallback while the socket is down, and a slow backstop while
 * it is up. Team Tally's and Mic Drop's policy, duplicated on purpose: the
 * contexts share the Supabase project and nothing else. Pure, for `node --test`.
 */

export type SocketState = "connecting" | "live" | "dropped";

export function socketFrom(channelStatus: string): SocketState {
  if (channelStatus === "SUBSCRIBED") return "live";
  if (channelStatus === "TIMED_OUT" || channelStatus === "CHANNEL_ERROR" || channelStatus === "CLOSED") {
    return "dropped";
  }
  return "connecting";
}

/** While the socket carries the updates: a backstop for a missed broadcast. */
export const LIVE_POLL_MS = 15_000;

/** While the socket connects or is down: often enough to still feel live. */
export const FALLBACK_POLL_MS = 4_000;

export function pollIntervalFor(socket: SocketState): number {
  return socket === "live" ? LIVE_POLL_MS : FALLBACK_POLL_MS;
}

/** The Realtime topic; the migration's trigger sends to the same name. */
export function liveMixerTopic(liveMixerId: string): string {
  return `match-mixer:${liveMixerId}`;
}
