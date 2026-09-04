"use client";

import { reduceMatch } from "@/components/apps/pickle-point-pal/lib/scoring/reduce";
import { currentGameNumber, teamName } from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import type { Persisted } from "@/components/apps/pickle-point-pal/lib/persistence/match-storage";
import { TEAM_IDS } from "@/components/apps/pickle-point-pal/lib/scoring/types";

import { SegNumber } from "./seg-readout";

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
      <h1 className="pp-plate text-2xl text-pp-ink">Match in progress</h1>
      <p className="pp-legend mt-1.5">
        Saved {new Date(saved.savedAt).toLocaleString()} · game {currentGameNumber(state)}
      </p>

      <div className="pp-panel pp-panel-settle mt-6 grid gap-3 p-4">
        {TEAM_IDS.map((team) => (
          <div key={team} className="flex items-center justify-between gap-4">
            <span className="pp-plate truncate text-sm text-pp-ink">
              {teamName(saved.config, team)}
            </span>
            <span className="text-[2rem] leading-none">
              <SegNumber value={state.current.scores[team]} reserve={2} />
            </span>
          </div>
        ))}
        {state.activeTimeout && (
          <p className="pp-mark pp-mark--timeout mt-1 self-start">
            {state.activeTimeout.kind} timeout still open
            {state.activeTimeout.runningSince === null ? " · paused" : ""}
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-3">
        <button type="button" onClick={onResume} className="pp-key pp-key--primary min-h-14">
          <span className="pp-plate text-base">Resume this match</span>
        </button>
        <button type="button" onClick={onDiscard} className="pp-key pp-key--quiet">
          <span className="pp-legend">Discard and start fresh</span>
        </button>
      </div>
    </div>
  );
}
