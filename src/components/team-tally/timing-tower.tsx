import { Fragment } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export type TowerRow = {
  position: number;
  name: string;
  /** The Team's side in its Matchup, as the brief colours it. */
  side: "red" | "blue";
  /** Points per Round, null until that Round is scored. */
  rounds: [number | null, number | null, number | null];
  points: number;
  /** Places gained (positive) or lost (negative) since the last score. */
  move?: number;
  /** The viewer's own Team, on a Score Link. */
  mine?: boolean;
  /** How a tie with the row above was settled, e.g. "Ahead on point differential". */
  note?: string | null;
};

/** Positions 1 and 2 are Flight A, 3 and 4 Flight B, and so on. */
function flightLetter(position: number): string {
  return String.fromCharCode(65 + Math.floor((position - 1) / 2));
}

/**
 * The standings as a broadcast timing tower read like a golf leaderboard:
 * R1, R2, R3 and TOT for every Team, the live Round underlined in the "now"
 * yellow. Columns never move; rows only re-sort. A Flight band opens every
 * pair, drawn where a leaderboard draws the cut, so the room can see who is
 * about to drop a Flight.
 */
export function TimingTower({
  rows,
  label,
  liveRound,
}: {
  rows: TowerRow[];
  label?: string;
  liveRound?: 1 | 2 | 3;
}) {
  const roundClass = (round: number, pending: boolean) =>
    ["tt-tower-round", liveRound === round ? "tt-now" : "", pending ? "tt-pending" : ""]
      .filter(Boolean)
      .join(" ");

  return (
    <div className="tt-plate">
      {label && (
        <div className="tt-plate-bar">
          <span>{label}</span>
        </div>
      )}
      <div className="tt-tower-row tt-tower-head" aria-hidden>
        <span>Pos</span>
        <span />
        <span className="text-left">Team</span>
        {[1, 2, 3].map((round) => (
          <span key={round} className={liveRound === round ? "tt-now-ink" : undefined}>
            R{round}
          </span>
        ))}
        <span>Tot</span>
        <span />
      </div>
      <ol aria-label={label ?? "Standings"} className="m-0 list-none p-0">
        {rows.map((row) => (
          <Fragment key={row.position}>
            {row.position % 2 === 1 && (
              <li aria-hidden className="tt-tower-band">
                Flight {flightLetter(row.position)}
              </li>
            )}
            <li className="tt-tower-row" data-mine={row.mine || undefined}>
              <span className="tt-tower-pos">{row.position}</span>
              <span aria-hidden className={`tt-tower-chip ${row.side === "red" ? "tt-side-red" : "tt-side-blue"}`} />
              <span className="tt-tower-name">
                <span className="tt-tower-name-text">{row.name}</span>
                {row.note && <small className="tt-tower-note">{row.note}</small>}
              </span>
              {row.rounds.map((points, index) => (
                <span
                  key={index}
                  className={roundClass(index + 1, points === null)}
                  aria-label={`Round ${index + 1}: ${points ?? "not scored"}`}
                >
                  {points ?? "–"}
                </span>
              ))}
              <span className="tt-tower-pts" aria-label={`Total ${row.points}`}>
                {row.points}
              </span>
              <Move move={row.move} />
            </li>
          </Fragment>
        ))}
      </ol>
    </div>
  );
}

function Move({ move }: { move?: number }) {
  if (!move) {
    return (
      <span className="tt-tower-move" aria-label="No change">
        –
      </span>
    );
  }
  const up = move > 0;
  const Icon = up ? ChevronUp : ChevronDown;
  return (
    <span
      className="tt-tower-move"
      data-move={up ? "up" : "down"}
      aria-label={`${up ? "Up" : "Down"} ${Math.abs(move)}`}
    >
      <Icon aria-hidden size={14} strokeWidth={3} />
      {Math.abs(move)}
    </span>
  );
}
