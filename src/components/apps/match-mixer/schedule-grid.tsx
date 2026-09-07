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
 * actually produced, never a claim derived from the Config.
 */
function summarise(score: ScorerResult, rounds: number): string {
  return [
    `${rounds} rounds`,
    score.repeatedPartnerPairs === 0
      ? "no repeat partners"
      : `${score.repeatedPartnerPairs} repeat partnerships`,
    score.byeSpread === 0 ? "nobody sits out" : "byes spread evenly",
    score.maxOpponentCount <= FREE_OPPONENT_MEETINGS
      ? "nobody faces the same person more than twice"
      : `some players face each other ${score.maxOpponentCount} times`,
  ].join(", ");
}

export function ScheduleGrid({
  roster,
  schedule,
  score,
}: {
  roster: Roster;
  schedule: Schedule;
  score: ScorerResult;
}) {
  const courts = schedule.rounds[0]?.games.length ?? 0;

  return (
    <section aria-labelledby="mm-schedule-heading">
      <h2 id="mm-schedule-heading" className="mm-legend">
        Schedule
      </h2>
      <p className="mm-summary mt-2">{summarise(score, schedule.rounds.length)}</p>

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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
