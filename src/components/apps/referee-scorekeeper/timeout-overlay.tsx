"use client";

import { cn } from "@/lib/utils";
import { formatClock, timeoutAnnouncement } from "@/components/apps/referee-scorekeeper/lib/scoring/selectors";
import type { MatchState } from "@/components/apps/referee-scorekeeper/lib/scoring/types";

/**
 * Takes over the screen for the duration of a timeout.
 *
 * Naming matters here: "Resume" could mean resume the clock or resume play, so
 * the timer controls are **Pause clock** / **Start clock** and the action that
 * sends players back is **End timeout**. Those two live far apart — ending a
 * timeout when you meant to pause it puts players on court early, and undo
 * won't give back the seconds already announced.
 */
export function TimeoutOverlay({
  state,
  remainingMs,
  onPauseClock,
  onStartClock,
  onEndTimeout,
  onUndo,
}: {
  state: MatchState;
  remainingMs: number;
  onPauseClock: () => void;
  onStartClock: () => void;
  onEndTimeout: () => void;
  onUndo: () => void;
}) {
  const active = state.activeTimeout;
  if (!active) return null;

  const record = state.timeoutHistory[state.timeoutHistory.length - 1];
  const paused = active.runningSince === null;
  const warning = !paused && remainingMs <= 10_000;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white px-5 py-6">
      <p className="text-center font-mono text-[0.7rem] font-semibold tracking-[0.2em] text-neutral-500 uppercase">
        {active.kind} timeout
      </p>

      {record && (
        <p className="mt-3 text-center font-heading text-xl leading-snug font-semibold text-neutral-950">
          {timeoutAnnouncement(record, state.config)}
        </p>
      )}

      <div className="flex flex-1 flex-col items-center justify-center">
        <div
          className={cn(
            "font-mono text-[clamp(4.5rem,26vw,10rem)] leading-none font-bold tracking-tight tabular-nums",
            paused ? "text-neutral-300" : warning ? "text-brand-orange" : "text-neutral-950"
          )}
        >
          {formatClock(remainingMs)}
        </div>
        {/* Paused has to read differently from across a court, not just up
            close — the failure mode is a ref seeing a number and assuming rest
            time is running when it isn't. */}
        {paused && (
          <p className="mt-2 font-mono text-[clamp(2rem,10vw,4rem)] leading-none font-bold tracking-[0.15em] text-neutral-500 uppercase">
            Paused
          </p>
        )}
        {record && record.pauseCount > 0 && (
          <p className="mt-4 text-xs text-neutral-500">
            Paused {record.pauseCount}× · {formatClock(record.pausedMs)} total
          </p>
        )}
      </div>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={paused ? onStartClock : onPauseClock}
          className="min-h-14 rounded-xl border-2 border-neutral-300 bg-white text-base font-semibold text-neutral-900 touch-manipulation active:translate-y-px"
        >
          {paused ? "Start clock" : "Pause clock"}
        </button>

        {/* Deliberately separated from the pause control. */}
        <div className="grid grid-cols-[auto_1fr] gap-3 pt-6">
          <button
            type="button"
            onClick={onUndo}
            className="min-h-14 rounded-xl border border-neutral-300 px-5 text-sm font-medium text-neutral-600 touch-manipulation"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={onEndTimeout}
            className="min-h-14 rounded-xl bg-brand-orange text-base font-semibold text-white touch-manipulation active:translate-y-px"
          >
            End timeout
          </button>
        </div>
      </div>
    </div>
  );
}
