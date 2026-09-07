import { FREE_OPPONENT_MEETINGS } from "@/components/apps/match-mixer/lib/engine/scorer";
import type {
  Roster,
  Schedule,
  ScorerResult,
  Team,
} from "@/components/apps/match-mixer/lib/engine/types";

/**
 * Rounds run down, courts run across, the way the desk reads it out. Below the
 * `sm` breakpoint the same table restyles into one round at a time, so there is
 * only ever one copy of the schedule in the DOM (which is what lets RR-1.5's
 * print stylesheet be pure CSS).
 */

function teamNames(roster: Roster, team: Team): string {
  return `${roster[team[0]].name} / ${roster[team[1]].name}`;
}

/**
 * The summary line is a readout of the Scorer against the Schedule that was
 * actually produced, never a claim derived from the Config. Whether the Byes
 * rotate evenly is the Scorer's verdict too, not a second rule worked out
 * here from the roster size.
 */
function summarise(score: ScorerResult, schedule: Schedule): string {
  const rounds = schedule.rounds.length;
  const sitting = schedule.rounds[0]?.byes.length ?? 0;
  const sit = sitting === 1 ? "player sits" : "players sit";

  let byes: string;
  if (sitting === 0) {
    byes = "nobody sits out";
  } else if (score.byesRotateEvenly) {
    byes = `${sitting} ${sit} out each round, rotating evenly`;
  } else {
    byes = `${sitting} ${sit} out each round, but some sit out ${score.byeSpread} more time${score.byeSpread === 1 ? "" : "s"} than others`;
  }

  return [
    `${rounds} ${rounds === 1 ? "round" : "rounds"}`,
    score.repeatedPartnerPairs === 0
      ? "no repeat partners"
      : `${score.repeatedPartnerPairs} repeat partnerships`,
    byes,
    score.maxOpponentCount <= FREE_OPPONENT_MEETINGS
      ? "nobody faces the same person more than twice"
      : `some players face each other ${score.maxOpponentCount} times`,
  ].join(", ");
}

export function ScheduleGrid({
  roster,
  schedule,
  score,
  headingId = "mm-schedule-heading",
}: {
  roster: Roster;
  schedule: Schedule;
  score: ScorerResult;
  /** Overridden by the zero state, which shows a second grid of its own. */
  headingId?: string;
}) {
  const courts = schedule.rounds[0]?.games.length ?? 0;
  const anyByes = schedule.rounds.some((round) => round.byes.length > 0);

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mm-legend">
        Schedule
      </h2>
      <p className="mm-summary mt-2">{summarise(score, schedule)}</p>

      <div className="mm-scroll mt-5">
        <table className="mm-grid">
          <caption className="sr-only">
            Every round of the rotation, with one column per court.
          </caption>
          <thead>
            <tr>
              <th scope="col">Round</th>
              {Array.from({ length: courts }, (_, court) => (
                <th key={court} scope="col">
                  Court {court + 1}
                </th>
              ))}
              {anyByes ? <th scope="col">Sitting out</th> : null}
            </tr>
          </thead>
          <tbody>
            {schedule.rounds.map((round, index) => (
              <tr key={index}>
                <th scope="row">{index + 1}</th>
                {round.games.map((game) => (
                  <td key={game.court} data-court={`Court ${game.court + 1}`}>
                    <span className="mm-side">{teamNames(roster, game.teams[0])}</span>
                    <span className="mm-versus">vs</span>
                    <span className="mm-side">{teamNames(roster, game.teams[1])}</span>
                  </td>
                ))}
                {anyByes ? (
                  <td className="mm-byes" data-court="Sitting out">
                    {round.byes.map((player) => roster[player].name).join(", ")}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
