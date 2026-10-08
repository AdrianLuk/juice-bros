import type { DocMatchup, DocTeam } from "@/lib/team-tally/event-doc";
import { GameLine } from "./game-card";

/**
 * A Matchup's six Games, folded under one line, read-only: who played, the
 * score and who entered it. The Public Link's Matchups and the results page's
 * "every Matchup" use it, and a Score Link once the night has ended.
 */
export function MatchupGames({ matchup, teams }: { matchup: DocMatchup; teams: Map<string, DocTeam> }) {
  const name = `${matchup.stage === "flight" ? `Flight ${matchup.flightLetter}` : `Match ${matchup.number}`} games`;
  return (
    <details className="tt-round">
      <summary className="tt-round-summary">
        <b>{name}</b>
      </summary>
      <section aria-label={name} className="tt-round-body">
        <ol className="tt-game-lines">
          {matchup.games.map((game) => (
            <GameLine key={game.id} game={game} matchup={matchup} teams={teams} />
          ))}
        </ol>
      </section>
    </details>
  );
}
