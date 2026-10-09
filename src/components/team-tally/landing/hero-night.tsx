"use client";

import { useEffect, useRef, useState } from "react";

import { bugRows } from "@/lib/team-tally/score-bug";
import { ScoreBug } from "../score-bug";
import { TimingTower, type TowerRow } from "../timing-tower";

/**
 * The landing's first graphic (issue #636): one Matchup's score bug over the
 * top of the standings, mid Round 2, on a made-up night. Once it has been on
 * screen a moment, the teammates' game in Round 2 comes in. The bug fills
 * its cell and the tower re-sorts, Golden Set sliding up past the Flight A
 * line: the direction's signature motion, played once. Under reduced motion
 * the tower cuts to the new order, as it does on a real night.
 */

type Game = { round: 1 | 2 | 3; kind: "captains" | "teammates"; redScore: number; blueScore: number };

/** Golden Set (red) against Kitchen Kings (blue), Round 2's captains' game in. */
const BEFORE: Game[] = [
  { round: 1, kind: "captains", redScore: 11, blueScore: 7 },
  { round: 1, kind: "teammates", redScore: 9, blueScore: 11 },
  { round: 2, kind: "captains", redScore: 11, blueScore: 6 },
];
const LANDS: Game = { round: 2, kind: "teammates", redScore: 11, blueScore: 8 };

const THIRD_SHOT = { id: "third-shot", name: "Third Shot Club", side: "red" as const, rounds: [22, 19, null] as TowerRow["rounds"], points: 41 };
const NET_RESULTS = { id: "net-results", name: "Net Results", side: "blue" as const, rounds: [24, 11, null] as TowerRow["rounds"], points: 35 };
const RILEY = { id: "riley", name: "Team Riley Newman", side: "blue" as const, rounds: [19, 11, null] as TowerRow["rounds"], points: 30 };

const ROWS_BEFORE: TowerRow[] = [
  { ...THIRD_SHOT, position: 1 },
  { ...NET_RESULTS, position: 2 },
  { id: "golden-set", position: 3, name: "Golden Set", side: "red", rounds: [20, 11, null], points: 31 },
  { ...RILEY, position: 4 },
];
const ROWS_AFTER: TowerRow[] = [
  { id: "golden-set", position: 1, name: "Golden Set", side: "red", rounds: [20, 22, null], points: 42, move: 2 },
  { ...THIRD_SHOT, position: 2, move: -1 },
  { ...NET_RESULTS, position: 3, move: -1 },
  { ...RILEY, position: 4 },
];

/** How long the graphic sits on screen before the score comes in. */
const HOLD_MS = 1600;

export function HeroNight() {
  const figure = useRef<HTMLElement>(null);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    const element = figure.current;
    if (!element || landed) return;
    let timer: number | undefined;
    const watch = new IntersectionObserver(
      ([entry]) => {
        window.clearTimeout(timer);
        if (entry.isIntersecting) timer = window.setTimeout(() => setLanded(true), HOLD_MS);
      },
      { threshold: 0.6 },
    );
    watch.observe(element);
    return () => {
      watch.disconnect();
      window.clearTimeout(timer);
    };
  }, [landed]);

  const games = landed ? [...BEFORE, LANDS] : BEFORE;

  return (
    <figure ref={figure} className="m-0 grid gap-3" aria-label="An example night, mid Round 2">
      <ScoreBug
        label="Match 1 · Courts 16 & 19"
        liveRound={landed ? 3 : 2}
        red={{ name: "Golden Set", rows: bugRows(games, "red") }}
        blue={{ name: "Kitchen Kings", rows: bugRows(games, "blue") }}
      />
      <TimingTower label="Standings · opening round" liveRound={2} rows={landed ? ROWS_AFTER : ROWS_BEFORE} />
      <figcaption className="tt-meta text-[0.8125rem]">Example night · made-up teams</figcaption>
      <p className="sr-only" aria-live="polite">
        {landed ? "Golden Set win Round 2's teammates' game 11-8 and move up to first, into Flight A." : ""}
      </p>
    </figure>
  );
}
