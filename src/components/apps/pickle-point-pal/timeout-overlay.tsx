"use client";

import { cn } from "@/lib/utils";
import { timeoutAnnouncement } from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import type { MatchState } from "@/components/apps/pickle-point-pal/lib/scoring/types";

import { SegClock } from "./seg-readout";

/**
 * Takes over the screen for the duration of a timeout — the readout panel goes
 * to a full-size segmented clock.
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
  const warning = !paused && remainingMs <= 15_000;
  const markClass =
    active.kind === "standard" ? "pp-mark--timeout" : active.kind === "medical" ? "pp-mark--alert" : "pp-mark--structural";

  return (
    <div className="pp-surface fixed inset-0 z-40 flex flex-col px-5 py-6 ref-landscape:justify-center ref-landscape:gap-2 ref-landscape:px-4 ref-landscape:py-3">
      <div className="flex justify-center">
        <span className={cn("pp-mark", markClass)}>{active.kind} timeout</span>
      </div>

      {record && (
        <p className="mt-3 text-center text-lg leading-snug font-semibold text-pp-ink ref-landscape:mt-1 ref-landscape:text-sm">
          {timeoutAnnouncement(record, state.config)}
        </p>
      )}

      <div className="flex flex-1 flex-col items-center justify-center ref-landscape:flex-none ref-landscape:py-1">
        <div className="pp-panel pp-panel-settle flex flex-col items-center px-6 py-6 ref-landscape:px-5 ref-landscape:py-3">
          <SegClock
            ms={remainingMs}
            paused={paused}
            warn={warning}
            className="text-[clamp(4rem,24vw,9rem)] ref-landscape:text-[clamp(2.5rem,19vh,4rem)]"
          />
          {/* Paused has to read differently from across a court, not just up
              close — the failure mode is a ref seeing a number and assuming
              rest time is running when it isn't. */}
          {paused && (
            <p className="pp-plate mt-2 text-[clamp(1.5rem,8vw,3rem)] tracking-[0.15em] text-pp-ink-dim ref-landscape:mt-1 ref-landscape:text-lg">
              Paused
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3 ref-landscape:mx-auto ref-landscape:w-full ref-landscape:max-w-xs ref-landscape:gap-2">
        <button
          type="button"
          onClick={paused ? onStartClock : onPauseClock}
          className="pp-key min-h-14"
        >
          <span className="pp-plate text-base">{paused ? "Start clock" : "Pause clock"}</span>
        </button>

        {/* Deliberately separated from the pause control. */}
        <div className="grid grid-cols-[auto_1fr] gap-3 pt-6 ref-landscape:gap-2 ref-landscape:pt-0">
          <button
            type="button"
            onClick={onUndo}
            className="pp-key pp-key--quiet px-5"
          >
            <span className="pp-legend">Undo</span>
          </button>
          <button
            type="button"
            onClick={onEndTimeout}
            className="pp-key pp-key--primary min-h-14"
          >
            <span className="pp-plate text-base">End timeout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
