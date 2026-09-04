"use client";

import { gamesToWin } from "@/components/apps/pickle-point-pal/lib/scoring/reduce";
import { teamName } from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import { otherTeam, type MatchState } from "@/components/apps/pickle-point-pal/lib/scoring/types";

import { SegNumber, SegSep } from "./seg-readout";

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
    <div className="pp-surface fixed inset-0 z-40 flex flex-col justify-center px-5 py-6">
      <p className="pp-legend text-center">Game {state.games.length} complete</p>

      <p className="pp-plate mt-4 text-center text-3xl leading-tight text-pp-ink">
        {teamName(state.config, winner)} wins
      </p>

      <div className="pp-panel pp-panel-settle mx-auto mt-4 flex px-6 py-4">
        <span className="inline-flex items-center text-[clamp(3rem,17vw,5.5rem)] leading-none">
          <SegNumber value={game.scores[winner]} reserve={2} />
          <SegSep />
          <SegNumber value={game.scores[otherTeam(winner)]} reserve={2} />
        </span>
      </div>

      <p className="mt-6 text-center text-sm text-pp-ink-dim">
        {decidesMatch
          ? "This wins the match."
          : `Games: ${state.gamesWon.A + (winner === "A" ? 1 : 0)}-${
              state.gamesWon.B + (winner === "B" ? 1 : 0)
            } · first to ${needed}. Teams switch ends.`}
      </p>

      <div className="mt-10 grid gap-3">
        <button type="button" onClick={onConfirm} className="pp-key pp-key--primary min-h-14">
          <span className="pp-plate text-base">
            {decidesMatch ? "Confirm match result" : "Confirm and start next game"}
          </span>
        </button>
        <button type="button" onClick={onUndo} className="pp-key pp-key--quiet">
          <span className="pp-legend">Undo last rally</span>
        </button>
      </div>
    </div>
  );
}
