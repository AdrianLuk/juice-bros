"use client";

import { useLayoutEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { flipDeltas } from "@/lib/team-tally/flip";

export type TowerRow = {
  /** The Team, so a row keeps its identity when the order changes. Defaults to its position. */
  id?: string;
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

/** How long a re-sorted row takes to slide into its new place. */
const SLIDE_MS = 650;

/**
 * The re-sort motion (the direction's signature interaction): when the order
 * of Teams changes, each moved row slides from where it was to where it is
 * now, by FLIP on `transform` alone. Nothing animates on first paint, on a
 * resize, while the tower is hidden (the TV's other screens), or under
 * `prefers-reduced-motion`, which gets the hard cut to the new order.
 */
function useResortSlide(order: string) {
  const list = useRef<HTMLOListElement>(null);
  const seen = useRef<{ order: string; tops: Map<string, number> } | null>(null);

  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return;

    // Hidden (display: none somewhere above) rows have no layout to compare.
    if (element.getClientRects().length === 0) {
      seen.current = null;
      return;
    }

    const rows = element.querySelectorAll<HTMLElement>("[data-flip]");
    const tops = new Map<string, number>();
    rows.forEach((row) => tops.set(row.dataset.flip!, row.offsetTop));

    const before = seen.current;
    seen.current = { order, tops };
    if (!before || before.order === order) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof Element.prototype.animate !== "function") return;

    const deltas = flipDeltas(before.tops, tops);
    rows.forEach((row) => {
      const delta = deltas.get(row.dataset.flip!);
      if (delta === undefined) return;
      row.style.zIndex = "1";
      const slide = row.animate(
        [{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }],
        { duration: SLIDE_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
      slide.onfinish = slide.oncancel = () => {
        row.style.zIndex = "";
      };
    });
  });

  return list;
}

/**
 * The standings as a broadcast timing tower read like a golf leaderboard:
 * R1, R2, R3 and TOT for every Team, the live Round underlined in the "now"
 * yellow. Columns never move; rows only re-sort, sliding into their new places
 * with an up or down mark. A Flight band opens every pair, drawn where a
 * leaderboard draws the cut, so the room can see who is about to drop a Flight.
 */
export function TimingTower({
  rows,
  label,
  liveRound,
  size,
}: {
  rows: TowerRow[];
  label?: string;
  liveRound?: 1 | 2 | 3;
  /** "tv" sets the tower for the big-screen layout (CSS in `.tt-tv`). */
  size?: "tv";
}) {
  const list = useResortSlide(rows.map((row) => row.id ?? row.position).join(","));

  const roundClass = (round: number, pending: boolean) =>
    ["tt-tower-round", liveRound === round ? "tt-now" : "", pending ? "tt-pending" : ""]
      .filter(Boolean)
      .join(" ");

  return (
    <div className="tt-plate tt-tower" data-size={size}>
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
      <ol ref={list} aria-label={label ?? "Standings"} className="tt-tower-list m-0 list-none p-0">
        {rows.flatMap((row) => [
          row.position % 2 === 1 ? (
            <li key={`band-${row.position}`} aria-hidden className="tt-tower-band">
              Flight {flightLetter(row.position)}
            </li>
          ) : null,
          <li
            key={row.id ?? row.position}
            className="tt-tower-row"
            data-mine={row.mine || undefined}
            data-flip={row.id ?? row.position}
          >
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
          </li>,
        ])}
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
