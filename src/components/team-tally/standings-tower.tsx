"use client";

import { useState } from "react";

import { liveRound, type Round, type TeamEventDoc } from "@/lib/team-tally/event-doc";
import { computeStandings, type StandingRow } from "@/lib/team-tally/standings";
import { TimingTower } from "./timing-tower";

/** Places each Team moved at the last re-sort, kept until the next one. */
function useMoves(rows: StandingRow[]): Map<string, number> {
  const signature = rows.map((row) => row.teamId).join(",");
  const [seen, setSeen] = useState({
    signature,
    positions: new Map(rows.map((row) => [row.teamId, row.position])),
    moves: new Map<string, number>(),
  });

  if (seen.signature !== signature) {
    const moves = new Map<string, number>();
    for (const row of rows) {
      const before = seen.positions.get(row.teamId);
      if (before !== undefined && before !== row.position) moves.set(row.teamId, before - row.position);
    }
    setSeen({ signature, positions: new Map(rows.map((row) => [row.teamId, row.position])), moves });
    return moves;
  }
  return seen.moves;
}

/** The Round still being played somewhere in the opening round, for the tower's yellow column. */
function openingLiveRound(event: TeamEventDoc): Round | undefined {
  const rounds = event.matchups
    .filter((matchup) => matchup.stage === "opening")
    .map((matchup) => liveRound(matchup))
    .filter((round): round is Round => round !== undefined);
  return rounds.length > 0 ? (Math.min(...rounds) as Round) : undefined;
}

/**
 * The opening standings, computed on read, as the timing tower: the viewer's
 * own Team on a Score Link highlighted, and each re-sort's moves marked.
 */
export function StandingsTower({ event, myTeamId }: { event: TeamEventDoc; myTeamId?: string }) {
  const standings = computeStandings(event);
  const moves = useMoves(standings);

  return (
    <TimingTower
      label="Standings · opening round"
      liveRound={event.status === "opening" ? openingLiveRound(event) : undefined}
      rows={standings.map((row) => ({
        position: row.position,
        name: row.name,
        side: row.side,
        rounds: row.rounds,
        points: row.teamScore,
        move: moves.get(row.teamId),
        mine: row.teamId === myTeamId,
      }))}
    />
  );
}
