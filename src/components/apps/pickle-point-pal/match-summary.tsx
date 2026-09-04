"use client";

import { matchWinner, teamName } from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import { otherTeam, TEAM_IDS, type MatchEvent, type MatchState } from "@/components/apps/pickle-point-pal/lib/scoring/types";
import { MatchLog } from "./match-log";
import { SegNumber, SegSep } from "./seg-readout";

export function MatchSummary({
  state,
  events,
  matchStartedAt,
  onNewMatch,
  onUndo,
}: {
  state: MatchState;
  events: MatchEvent[];
  matchStartedAt: number;
  onNewMatch: () => void;
  onUndo: () => void;
}) {
  const winner = matchWinner(state);
  // matchComplete without a winner only happens via the "End match" button —
  // nobody had reached the required game count when the ref cut it short.
  const endedEarly = winner === null;

  return (
    <div className="mx-auto w-full max-w-md">
      <p className="pp-legend text-center">
        {endedEarly ? "Match ended early" : "Match complete"}
      </p>
      {winner && (
        <>
          <p className="pp-plate mt-3 text-center text-3xl leading-tight text-pp-ink">
            {teamName(state.config, winner)}
          </p>
          <div className="pp-panel pp-panel-settle mx-auto mt-3 flex w-fit px-5 py-3">
            <span className="inline-flex items-start text-[clamp(2.25rem,12vw,3.5rem)] leading-none">
              <SegNumber value={state.gamesWon[winner]} reserve={1} />
              <SegSep />
              <SegNumber value={state.gamesWon[otherTeam(winner)]} reserve={1} />
            </span>
          </div>
        </>
      )}

      <ul className="pp-well mt-6 divide-y divide-pp-hairline overflow-hidden">
        {state.games.map((game, i) => (
          <li
            key={i}
            className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm"
          >
            <span className="pp-data text-xs text-pp-ink-dim">Game {i + 1}</span>
            <span className="truncate text-pp-ink-dim">
              {game.winner ? teamName(state.config, game.winner) : "unfinished"}
            </span>
            <span className="pp-data font-semibold text-pp-ink tabular-nums">
              {TEAM_IDS.map((t) => game.scores[t]).join("–")}
            </span>
          </li>
        ))}
      </ul>

      <p className="pp-legend mt-6">Match log</p>
      <div className="mt-2">
        <MatchLog
          config={state.config}
          events={events}
          matchStartedAt={matchStartedAt}
          capHeight
        />
      </div>

      <p className="mt-4 text-center text-xs text-pp-ink-dim">
        {events.length} events recorded ·{" "}
        {state.warnings.A + state.warnings.B} technical warning
        {state.warnings.A + state.warnings.B === 1 ? "" : "s"}
      </p>

      <div className="mt-8 grid gap-3">
        <button type="button" onClick={onNewMatch} className="pp-key pp-key--primary min-h-14">
          <span className="pp-plate text-base">Start a new match</span>
        </button>
        <button type="button" onClick={onUndo} className="pp-key pp-key--quiet">
          <span className="pp-legend">Undo — the match isn&apos;t over</span>
        </button>
      </div>
    </div>
  );
}
