"use client";

import type { LiveWriter } from "@/lib/team-tally/actions/live";
import { isScored, liveRound, type DocMatchup, type DocTeam, type Round } from "@/lib/team-tally/event-doc";
import { GameCard } from "./game-card";

/**
 * A Matchup's three Rounds as score entry. The live Round leads, open, under
 * its LIVE mark; every other Round folds into one line (its two scores and a
 * FINAL stamp once both are in), and opens to its own score boxes. All six
 * Games stay editable until the Matchup is done; then they lock, read-only,
 * until the Organizer reopens it.
 */
export function MatchupRounds({
  matchup,
  teams,
  writer,
  onSaved,
  locked = matchup.doneAt !== null,
}: {
  matchup: DocMatchup;
  teams: Map<string, DocTeam>;
  writer: LiveWriter;
  onSaved: () => Promise<unknown>;
  locked?: boolean;
}) {
  const live = locked ? undefined : liveRound(matchup);
  const order = ([1, 2, 3] as const).filter((round) => round !== live);
  const rounds: Round[] = live ? [live, ...order] : [...order];

  const games = (round: Round) =>
    matchup.games
      .filter((game) => game.round === round)
      .map((game) => (
        <GameCard
          key={game.id}
          game={game}
          matchup={matchup}
          teams={teams}
          writer={writer}
          onSaved={onSaved}
          locked={locked}
        />
      ));

  return (
    <div className="tt-rounds">
      {rounds.map((round) => {
        if (round === live) {
          return (
            <section key={round} className="tt-round-live" aria-label={`Round ${round}, live`}>
              <h3 className="tt-sect">
                Round {round} <span className="tt-live-mark">Live</span>
              </h3>
              {games(round)}
            </section>
          );
        }

        const roundGames = matchup.games.filter((game) => game.round === round);
        const final = roundGames.length > 0 && roundGames.every(isScored);
        const scores = roundGames.filter(isScored).map((game) => `${game.redScore}–${game.blueScore}`);
        return (
          <details key={round} className="tt-round">
            <summary className="tt-round-summary">
              <span>
                <b>Round {round}</b>
                <span className="tt-round-scores">{scores.length > 0 ? ` · ${scores.join(" · ")}` : " · Not started"}</span>
              </span>
              {final && <span className="tt-final">Final</span>}
            </summary>
            <div className="tt-round-body">{games(round)}</div>
          </details>
        );
      })}
    </div>
  );
}
