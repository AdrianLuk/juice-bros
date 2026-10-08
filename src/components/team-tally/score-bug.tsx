import type { BugCell, BugRows } from "@/lib/team-tally/score-bug";

/** One side of a Matchup on the bug: its name and its two rows of Game scores (`bugRows`). */
export type BugSide = {
  name: string;
  rows: BugRows;
  /** Won the Dreambreaker that settled a tie: a small DB tag after the name. */
  dreambreaker?: boolean;
};

const GAMES = [
  { kind: "captains", label: "Captains" },
  { kind: "teammates", label: "Teammates" },
] as const;

/**
 * A Matchup as a broadcast score bug, read round by round the way a golf
 * leaderboard reads a player: R1, R2, R3, TOT. Each Team has two rows, its
 * captains' Game over its teammates' Game, so every Round cell is one Game's
 * score (issue #633). The Team name and TOT span both rows; TOT is the Team
 * score. The losing score of each Game is dimmed, an unscored Game stays a
 * faint dash, and the live Round's column is underlined in the world's "now"
 * yellow. A dashed rule splits a Team's two Games, a solid one the two Teams.
 * Red is the first Team of the Matchup and blue the second, as in the brief.
 *
 * A Matchup marked done (#624) gains a plate bar on top: who won on the left,
 * a FINAL stamp on the right. A stamp on the record: every score stays where
 * it was, and the columns don't move.
 */
export function ScoreBug({
  label,
  red,
  blue,
  liveRound,
  final,
}: {
  /** What the bar says, e.g. "Match 1 · Courts 21 & 18". */
  label: string;
  red: BugSide;
  blue: BugSide;
  /** 1 to 3 while a Round is being played; omitted when none is. */
  liveRound?: 1 | 2 | 3;
  /** The Matchup is done: what its FINAL bar says, e.g. "Winner · Golden Set". */
  final?: string;
}) {
  const classes = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");
  const now = (round: number) => liveRound === round && "tt-now";
  const cellClass = (cell: BugCell, round: number, line: string) =>
    classes(line, cell.points === null && "tt-pending", cell.lost && "tt-bug-lost", now(round));

  return (
    <div className="tt-plate">
      {final !== undefined && (
        <div className="tt-plate-bar tt-bug-finalbar">
          <span className="tt-bug-finalnote">{final}</span>
          <span className="tt-bug-final">Final</span>
        </div>
      )}
      <div className="tt-bug" role="table" aria-label={label}>
        <span role="columnheader" aria-colspan={3} className="tt-bug-head tt-bug-label">
          {label}
        </span>
        {[1, 2, 3].map((round) => (
          <span key={round} role="columnheader" className={classes("tt-bug-head", now(round))}>
            R{round}
          </span>
        ))}
        <span role="columnheader" className="tt-bug-head">
          Tot
        </span>
        {(["red", "blue"] as const).map((side) => {
          const team = side === "red" ? red : blue;
          // The rule above a Team: none above red (the header bar is there), solid above blue.
          const rule = side === "blue" ? "tt-bug-rule" : "";
          return GAMES.map(({ kind, label: game }, index) => {
            // A Team's second Game sits under a dashed seam; its first under the Team's rule.
            const line = index === 1 ? "tt-bug-seam" : rule;
            return (
              <div key={`${side}-${kind}`} role="row" className="contents">
                {index === 0 && (
                  <>
                    <span
                      aria-hidden
                      className={classes("tt-bug-stripe", rule, side === "red" ? "tt-side-red" : "tt-side-blue")}
                    />
                    <span role="rowheader" aria-rowspan={2} className={classes("tt-bug-team tt-bug-teamrow", rule)}>
                      <span className="tt-bug-name">{team.name}</span>
                      {team.dreambreaker && (
                        <span className="tt-bug-mark">
                          <span aria-hidden>DB</span>
                          <span className="sr-only">, won the Dreambreaker</span>
                        </span>
                      )}
                    </span>
                  </>
                )}
                <span role="rowheader" className={classes("tt-bug-game", line)}>
                  {game}
                </span>
                {team.rows[kind].map((cell, round) => (
                  <span key={round} role="cell" className={cellClass(cell, round + 1, line)}>
                    {cell.points ?? "–"}
                  </span>
                ))}
                {index === 0 && (
                  <span role="cell" aria-rowspan={2} className={classes("tt-bug-tot", rule)}>
                    {team.rows.total}
                  </span>
                )}
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}
