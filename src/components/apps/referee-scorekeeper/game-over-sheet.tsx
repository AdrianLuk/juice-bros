"use client";

import { gamesToWin } from "@/components/apps/referee-scorekeeper/lib/scoring/reduce";
import { teamName } from "@/components/apps/referee-scorekeeper/lib/scoring/selectors";
import { otherTeam, type MatchState } from "@/components/apps/referee-scorekeeper/lib/scoring/types";

/**
 * Game point does not auto-advance. A ref needs a beat to confirm the call
 * before the next game starts, and an undo has to stay reachable until then.
 */
export function GameOverSheet({
  state,
  onConfirm,
  onUndo,
}: {
  state: MatchState;
  onConfirm: () => void;
  onUndo: () => void;
}) {
  const game = state.current;
  if (!game.complete || game.winner === null) return null;

  const winner = game.winner;
  const needed = gamesToWin(state.config);
  const winsAfter = state.gamesWon[winner] + 1;
  const decidesMatch = winsAfter >= needed;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-center bg-white px-5 py-6">
      <p className="text-center font-mono text-[0.7rem] font-semibold tracking-[0.2em] text-neutral-500 uppercase">
        Game {state.games.length} complete
      </p>

      <p className="mt-4 text-center font-heading text-3xl leading-tight font-bold text-neutral-950">
        {teamName(state.config, winner)} wins
      </p>
      <p className="mt-2 text-center font-mono text-5xl font-bold text-neutral-950 tabular-nums">
        {game.scores[winner]}-{game.scores[otherTeam(winner)]}
      </p>

      <p className="mt-6 text-center text-sm text-neutral-500">
        {decidesMatch
          ? "This wins the match."
          : `Games: ${state.gamesWon.A + (winner === "A" ? 1 : 0)}-${
              state.gamesWon.B + (winner === "B" ? 1 : 0)
            } · first to ${needed}. Teams switch ends.`}
      </p>

      <div className="mt-10 grid gap-3">
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-14 rounded-xl bg-brand-orange text-base font-semibold text-white touch-manipulation active:translate-y-px"
        >
          {decidesMatch ? "Confirm match result" : "Confirm and start next game"}
        </button>
        <button
          type="button"
          onClick={onUndo}
          className="min-h-12 rounded-xl border border-neutral-300 text-sm font-medium text-neutral-600 touch-manipulation"
        >
          Undo last rally
        </button>
      </div>
    </div>
  );
}
