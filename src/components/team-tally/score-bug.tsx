/** One side of a Matchup on the bug: its points per Round (null until scored) and total. */
export type BugSide = {
  name: string;
  rounds: [number | null, number | null, number | null];
  total: number;
};

/**
 * A Matchup as a broadcast score bug, read round by round the way a golf
 * leaderboard reads a player: R1, R2, R3, TOT. The live Round's column is
 * underlined in the world's "now" yellow; Rounds not yet scored stay dim.
 * Red is the first Team of the Matchup and blue the second, as in the brief.
 */
export function ScoreBug({
  label,
  red,
  blue,
  liveRound,
}: {
  /** What the bar says, e.g. "Match 1 · Courts 21 & 18". */
  label: string;
  red: BugSide;
  blue: BugSide;
  /** 1 to 3 while a Round is being played; omitted when none is. */
  liveRound?: 1 | 2 | 3;
}) {
  const roundClass = (round: number, extra = "") =>
    [extra, liveRound === round ? "tt-now" : ""].filter(Boolean).join(" ");

  return (
    <div className="tt-plate">
      <div className="tt-bug" role="table" aria-label={label}>
        <span role="columnheader" className="tt-bug-head tt-bug-stripe" />
        <span role="columnheader" className="tt-bug-head tt-bug-team">
          {label}
        </span>
        {[1, 2, 3].map((round) => (
          <span key={round} role="columnheader" className={roundClass(round, "tt-bug-head")}>
            R{round}
          </span>
        ))}
        <span role="columnheader" className="tt-bug-head">
          Tot
        </span>
        {(["red", "blue"] as const).map((side) => {
          const team = side === "red" ? red : blue;
          const rule = side === "blue" ? "tt-bug-rule" : "";
          return (
            <div key={side} role="row" className="contents">
              <span
                aria-hidden
                className={`tt-bug-stripe ${rule} ${side === "red" ? "tt-side-red" : "tt-side-blue"}`}
              />
              <span role="rowheader" className={`tt-bug-team ${rule}`}>
                {team.name}
              </span>
              {team.rounds.map((points, index) => (
                <span
                  key={index}
                  role="cell"
                  className={roundClass(index + 1, [rule, points === null ? "tt-pending" : ""].join(" "))}
                >
                  {points ?? "–"}
                </span>
              ))}
              <span role="cell" className={`tt-bug-tot ${rule}`}>
                {team.total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
