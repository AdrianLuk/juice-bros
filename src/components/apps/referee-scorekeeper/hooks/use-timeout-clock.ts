"use client";

import { useEffect, useState } from "react";

import type { ActiveTimeout } from "@/components/apps/referee-scorekeeper/lib/scoring/types";

/**
 * Remaining rest time, computed on every tick from the accumulated-time fields
 * on `ActiveTimeout` rather than stored as a decrementing integer.
 *
 * A ticking number in React state is lost on refresh and drifts when the tab is
 * backgrounded — mobile browsers throttle intervals hard, so a 60-second
 * timeout can finish 8 seconds late if the ref glances at a text message.
 * Deriving it gives two properties worth protecting in review:
 *
 * - Refresh-proof in both states. Running: close the tab at 0:42, reopen four
 *   seconds later, it reads 0:38. Paused: it reads 0:42 no matter how long the
 *   app was gone, because `runningSince` is null and nothing accrues.
 * - No interval while paused. The effect returns early, so a paused timeout
 *   costs nothing and can't tick past zero in the background.
 */
export function useTimeoutClock(
  active: ActiveTimeout | null,
  onExpire: () => void
): number {
  // Tagged with the timeout it belongs to, so a reading left over from the
  // previous timeout can never be painted against the next one.
  const [reading, setReading] = useState<{ startedAt: number; ms: number } | null>(
    null
  );

  useEffect(() => {
    if (!active) return;

    const tick = () => {
      const spent =
        active.accumulatedMs +
        (active.runningSince === null ? 0 : Date.now() - active.runningSince);
      const left = Math.max(0, active.durationMs - spent);
      setReading({ startedAt: active.startedAt, ms: left });
      if (left <= 0) onExpire();
    };

    tick(); // paint immediately, don't wait 250ms
    if (active.runningSince === null) return; // paused: frozen value, no interval

    const id = setInterval(tick, 250);
    // Forces a recompute the instant the ref returns to the app, so a throttled
    // background interval can never leave a stale number on screen.
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active, onExpire]);

  if (!active) return 0;
  if (reading && reading.startedAt === active.startedAt) return reading.ms;
  // First paint of a new timeout, before the effect has ticked. Pure, so it
  // ignores the segment currently running — which is ~0ms at this point.
  return Math.max(0, active.durationMs - active.accumulatedMs);
}
