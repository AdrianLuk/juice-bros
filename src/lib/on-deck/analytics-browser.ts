"use client";

import { track } from "@vercel/analytics";

import type { OnDeckFunnelEvent } from "./analytics-events.ts";

/**
 * The browser half of the adoption funnel (issue #524) — the demo's two events
 * and the pre-authentication `od_club_intent`. The server half, with the
 * database-gated first-time checks, is `./analytics.ts`.
 *
 * Fire and forget, nothing awaited: a navigation must never wait on analytics.
 */

/**
 * `track()` silently drops the call when `window.va` has not been set up yet —
 * it is a `window.va?.call(...)` with no queue of its own — and the root layout
 * renders `<Analytics />` *after* `{children}`, so its injection effect runs
 * after the page's. An event fired from a mount effect is therefore lost.
 *
 * Every other client event in this repo (`gear_click`,
 * `bb_onboarding_intent`) is fired from a click, long after setup, which is
 * why nothing has met this before and why it is worth writing down here rather
 * than leaving as a one-line surprise at a call site.
 */
function analyticsReady(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as { va?: unknown }).va === "function"
  );
}

/** How often to look again, and for how long, before giving up. */
const READY_POLL_MS = 100;
const READY_POLL_LIMIT = 20;

/**
 * Emit one funnel event as soon as the SDK can take it, which is usually
 * immediately.
 *
 * Gives up after a couple of seconds rather than waiting forever: an ad
 * blocker means the script is never coming, and the funnel is a thing to read
 * for a trend, not an accounting system that has to balance.
 *
 * Deliberately returns nothing to clean up with, even though it may leave a
 * short-lived interval behind. Handing an effect a canceller is the obvious
 * shape and it is a trap: Strict Mode runs an effect, tears it down, and runs
 * it again, so the cleanup cancels the pending emit while the caller's
 * "already fired" guard suppresses the second attempt, and the event is lost
 * in development while looking fine in production. The timer stops itself
 * within `READY_POLL_MS * READY_POLL_LIMIT` either way, and an event that
 * lands just after its component unmounted is still an event that happened.
 */
export function trackWhenReady(
  event: OnDeckFunnelEvent,
  properties?: Record<string, string | number | boolean | null>,
): void {
  if (analyticsReady()) {
    track(event, properties);
    return;
  }

  let tries = 0;
  const timer = setInterval(() => {
    if (analyticsReady()) {
      clearInterval(timer);
      track(event, properties);
      return;
    }
    if (++tries >= READY_POLL_LIMIT) clearInterval(timer);
  }, READY_POLL_MS);
}
