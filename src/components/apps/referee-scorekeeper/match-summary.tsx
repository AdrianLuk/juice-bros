"use client";

import { matchWinner, teamName } from "@/components/apps/referee-scorekeeper/lib/scoring/selectors";
import { otherTeam, TEAM_IDS, type MatchEvent, type MatchState } from "@/components/apps/referee-scorekeeper/lib/scoring/types";
import { MatchLog } from "./match-log";

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
      <p className="text-center font-mono text-[0.7rem] font-semibold tracking-[0.2em] text-neutral-500 uppercase">
        {endedEarly ? "Match ended early" : "Match complete"}
      </p>
      {winner && (
        <>
          <p className="mt-3 text-center font-heading text-3xl leading-tight font-bold text-neutral-950">
            {teamName(state.config, winner)}
          </p>
          <p className="mt-1 text-center font-mono text-4xl font-bold text-neutral-950 tabular-nums">
            {state.gamesWon[winner]}-{state.gamesWon[otherTeam(winner)]}
          </p>
        </>
      )}

      <ul className="mt-6 divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200">
        {state.games.map((game, i) => (
          <li
            key={i}
            className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm"
          >
            <span className="font-mono text-xs text-neutral-500">Game {i + 1}</span>
            <span className="truncate text-neutral-700">
              {game.winner ? teamName(state.config, game.winner) : "unfinished"}
            </span>
            <span className="font-mono font-semibold text-neutral-950 tabular-nums">
              {TEAM_IDS.map((t) => game.scores[t]).join("-")}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 font-mono text-[0.7rem] font-semibold tracking-[0.2em] text-neutral-500 uppercase">
        Match log
      </p>
      <div className="mt-2">
        <MatchLog
          config={state.config}
          events={events}
          matchStartedAt={matchStartedAt}
          capHeight
        />
      </div>

      <p className="mt-4 text-center text-xs text-neutral-400">
        {events.length} events recorded ·{" "}
        {state.warnings.A + state.warnings.B} technical warning
        {state.warnings.A + state.warnings.B === 1 ? "" : "s"}
      </p>

      <div className="mt-8 grid gap-3">
        <button
          type="button"
          onClick={onNewMatch}
          className="min-h-14 rounded-xl bg-brand-orange text-base font-semibold text-white touch-manipulation active:translate-y-px"
        >
          Start a new match
        </button>
        <button
          type="button"
          onClick={onUndo}
          className="min-h-12 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-600 touch-manipulation"
        >
          Undo — the match isn&apos;t over
        </button>
      </div>
    </div>
  );
}
