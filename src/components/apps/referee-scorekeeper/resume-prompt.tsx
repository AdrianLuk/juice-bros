"use client";

import { reduceMatch } from "@/components/apps/referee-scorekeeper/lib/scoring/reduce";
import { currentGameNumber, teamName } from "@/components/apps/referee-scorekeeper/lib/scoring/selectors";
import type { Persisted } from "@/components/apps/referee-scorekeeper/lib/persistence/match-storage";
import { TEAM_IDS } from "@/components/apps/referee-scorekeeper/lib/scoring/types";

/**
 * Shows the actual score it would restore to, not a generic "restore previous
 * session" — a ref needs to confirm it's the right match before committing.
 */
export function ResumePrompt({
  saved,
  onResume,
  onDiscard,
}: {
  saved: Persisted;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const state = reduceMatch(saved.config, saved.events);

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="font-heading text-2xl font-bold text-neutral-950">
        Match in progress
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Saved {new Date(saved.savedAt).toLocaleString()} · game{" "}
        {currentGameNumber(state)}
      </p>

      <div className="mt-6 grid gap-2 rounded-xl border-2 border-neutral-200 bg-neutral-50 p-4">
        {TEAM_IDS.map((team) => (
          <div key={team} className="flex items-baseline justify-between gap-4">
            <span className="truncate text-sm font-semibold text-neutral-900">
              {teamName(saved.config, team)}
            </span>
            <span className="font-mono text-3xl font-bold text-neutral-950 tabular-nums">
              {state.current.scores[team]}
            </span>
          </div>
        ))}
        {state.activeTimeout && (
          <p className="mt-1 text-xs font-medium text-brand-orange">
            A {state.activeTimeout.kind} timeout is still open
            {state.activeTimeout.runningSince === null ? " and paused" : ""}.
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-3">
        <button
          type="button"
          onClick={onResume}
          className="min-h-14 rounded-xl bg-neutral-950 text-base font-semibold text-white touch-manipulation active:translate-y-px"
        >
          Resume this match
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="min-h-12 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-600 touch-manipulation"
        >
          Discard and start fresh
        </button>
      </div>
    </div>
  );
}
