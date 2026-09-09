import type { CSSProperties } from "react";

import { FREE_OPPONENT_MEETINGS } from "@/components/apps/match-mixer/lib/engine/scorer";
import type {
  Roster,
  Schedule,
  ScorerResult,
  Team,
} from "@/components/apps/match-mixer/lib/engine/types";

/**
 * The ruled field of the board: rounds run down, courts run across, the way
 * the desk reads it out. Each pair is a name plate; the round numerals and the
 * column rails are the board's own applied furniture. Below the `sm` breakpoint
 * the same table restyles into one round at a time, so there is only ever one
 * copy of the schedule in the DOM — which is what lets the print stylesheet be
 * pure CSS.
 */

function teamNames(roster: Roster, team: Team): string {
  return `${roster[team[0]].name} / ${roster[team[1]].name}`;
}

/**
 * How much of the room has met. Distinct from the repeat verdict beside it:
 * that one says nothing went wrong, this one says how far through the roster
 * the evening got, which is what decides whether another round is worth
 * playing. A schedule where every pair has partnered has nothing left to give
 * and says so, rather than making the organizer compare two numbers to notice.
 */
function coverage(score: ScorerResult): string | null {
  if (score.pairingsPossible === 0) return null;
  if (score.pairingsPlayed === score.pairingsPossible)
    return "every possible pairing has played";
  return `${score.pairingsPlayed} of ${score.pairingsPossible} possible pairings`;
}

/**
 * The repeat mark: a marker stroke drawn round a name plate, the way someone
 * standing at the board would ring a pair they had already seen.
 *
 * Drawn rather than bordered because this is the one place a hand touches an
 * otherwise manufactured object — every other line on the board is applied
 * vinyl, so a tidy rectangle here would read as more furniture and stop
 * registering as a mark. The path overshoots its own start, which is what a
 * hand does coming back round to where it began.
 *
 * `preserveAspectRatio="none"` lets the ellipse stretch to whatever width the
 * pair's names give it; `vector-effect` is what keeps the stroke an even
 * weight while it does, instead of the sides going thin.
 */
function RepeatRing() {
  return (
    <svg
      className="mm-ring"
      viewBox="0 0 200 44"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M195 19 C196 8 152 3 100 3 C46 3 5 8 5 20 C5 33 47 41 100 41 C155 41 197 34 194 20 C192 12 180 8 168 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * One side of a Game, on its own name plate. A pair who partnered more than
 * once is marked here, on the side it belongs to rather than on the Game or in
 * a grid of its own, because naming the pair without showing which Rounds they
 * are in leaves the organizer to find them by hand. The mark is spelled out for
 * screen readers, which have no ring to see.
 */
function Side({
  roster,
  score,
  team,
}: {
  roster: Roster;
  score: ScorerResult;
  team: Team;
}) {
  const repeat = score.partnerMatrix[team[0]][team[1]] > 1;

  return (
    <span className="mm-side" data-repeat={repeat ? "true" : undefined}>
      {teamNames(roster, team)}
      {repeat ? (
        <>
          <RepeatRing />
          <span className="sr-only"> (repeat partners)</span>
        </>
      ) : null}
    </span>
  );
}

/**
 * The summary line is a readout of the Scorer against the Schedule that was
 * actually produced, never a claim derived from the Config. Whether the Byes
 * rotate evenly is the Scorer's verdict too, not a second rule worked out
 * here from the roster size.
 */
function summarise(
  score: ScorerResult,
  schedule: Schedule,
): { verdict: string; failed: boolean; rest: string } {
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

  // The repeat clause is pulled out of the run so the board can carry it in
  // marker green or red. It is the one clause the organizer is scanning for,
  // and the only one with a pass and a fail; the rest are figures.
  const failed = score.repeatedPartnerPairs > 0;

  return {
    failed,
    verdict: failed
      ? `${score.repeatedPartnerPairs} repeat partnerships, ringed below`
      : "no repeat partners",
    rest: [
      `${rounds} ${rounds === 1 ? "round" : "rounds"}`,
      coverage(score),
      byes,
      score.maxOpponentCount <= FREE_OPPONENT_MEETINGS
        ? "nobody faces the same person more than twice"
        : `some players face each other ${score.maxOpponentCount} times`,
    ]
      .filter((clause) => clause !== null)
      .join(" · "),
  };
}

export function ScheduleGrid({
  roster,
  schedule,
  score,
  headingId = "mm-schedule-heading",
  headingHidden = false,
}: {
  roster: Roster;
  schedule: Schedule;
  score: ScorerResult;
  /** Overridden by the zero state, which shows a second grid of its own. */
  headingId?: string;
  /**
   * The zero state captions its specimen itself, so the field's own rail comes
   * off rather than sitting under a second one saying the same thing.
   */
  headingHidden?: boolean;
}) {
  const courts = schedule.rounds[0]?.games.length ?? 0;
  const anyByes = schedule.rounds.some((round) => round.byes.length > 0);
  const summary = summarise(score, schedule);

  return (
    <section aria-labelledby={headingHidden ? undefined : headingId}>
      {headingHidden ? null : (
        <h2 id={headingId} className="mm-legend mm-rail">
          The board
        </h2>
      )}
      <p className="mm-summary">
        <b data-fail={summary.failed ? "true" : undefined}>{summary.verdict}</b>
        {" · "}
        {summary.rest}
      </p>

      <div className="mm-scroll mt-4">
        <table className="mm-grid">
          <caption className="sr-only">
            Every round of the rotation, with one column per court.
          </caption>
          <thead>
            <tr>
              <th scope="col">Rd</th>
              {Array.from({ length: courts }, (_, court) => (
                <th key={court} scope="col">
                  Court {court + 1}
                </th>
              ))}
              {anyByes ? <th scope="col">Off</th> : null}
            </tr>
          </thead>
          <tbody>
            {schedule.rounds.map((round, index) => (
              // `--row` is what staggers the plates back onto the board after
              // a wipe; the animation itself is entirely in CSS.
              <tr key={index} style={{ "--row": index } as CSSProperties}>
                <th scope="row">{index + 1}</th>
                {round.games.map((game) => (
                  <td key={game.court} data-court={`Court ${game.court + 1}`}>
                    <Side roster={roster} score={score} team={game.teams[0]} />
                    <span className="mm-versus">versus</span>
                    <Side roster={roster} score={score} team={game.teams[1]} />
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
