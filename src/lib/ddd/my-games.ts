/**
 * "Your games": one player's doubles Games across Round 2 and the Playoff,
 * so a phone can show them their court, partner, opponents and Goal before
 * they walk on. Pure and relative-import-only, so `node --test` loads it.
 *
 * Glossary: dink-dine-drink/CONTEXT.md ("Forecast", "Underdog's forecast").
 */

import { placeMatchup, type StoredCourtPlan } from "./courts.ts";
import type { SlotStatus } from "./dreambreakers.ts";
import type { Lineup, LineupGame } from "./lineup.ts";
import type { Matchup } from "./matchups.ts";

/** A Team with its Lineup already read: null until it is saved. */
export type TeamLineup = { id: string; name: string; players: { id: string; name: string }[]; lineup: Lineup | null };

export type MyGame = {
  game: LineupGame;
  status: SlotStatus;
  /** Index into the DDD's courts. */
  court: number;
  partners: string[];
  opponents: string[];
  opponentTeam: string;
  /** Null until the Underdog's forecast is set. `lower` is true when this player's Pair is the Underdog. */
  forecast: { lower: boolean; points: number } | null;
  /** [this player's Pair, the other Pair], once final. */
  score: [number, number] | null;
  /** Whether this player's Pair beat the forecast, once final. */
  beat: boolean | null;
};

const ORDER: Record<SlotStatus, number> = { now: 0, next: 1, later: 2, final: 3 };

/** Every doubles Game `playerId` plays, what's on first first and finals last. */
export function myGames(
  playerId: string,
  teams: readonly TeamLineup[],
  matchups: readonly Matchup[],
  plans: readonly StoredCourtPlan[],
  courtCount: number,
): MyGame[] {
  const nameOf = (id: string | null) => teams.flatMap((team) => team.players).find((player) => player.id === id)?.name ?? "–";
  const teamOf = (id: string) => teams.find((team) => team.id === id);
  const out: MyGame[] = [];

  for (const m of matchups) {
    const pairTeams = [teamOf(m.a), teamOf(m.b)];
    const side = pairTeams.findIndex((team) => team?.players.some((player) => player.id === playerId));
    if (side === -1) continue;
    const lineups: [Lineup | null, Lineup | null] = [pairTeams[0]?.lineup ?? null, pairTeams[1]?.lineup ?? null];
    const mine = lineups[side];
    if (!mine) continue;
    const letter = side === 0 ? "a" : "b";

    for (const place of placeMatchup(m, lineups, plans, courtCount)) {
      const pair = mine[place.game];
      if (!pair.includes(playerId)) continue;
      const game = m.games.find((each) => each.game === place.game)!;
      const theirs = lineups[1 - side]?.[place.game] ?? null;
      out.push({
        game: place.game,
        status: place.status,
        court: place.court,
        partners: pair.filter((id) => id !== playerId).map(nameOf),
        opponents: theirs ? theirs.map(nameOf) : [],
        opponentTeam: pairTeams[1 - side]?.name ?? "",
        forecast: game.spread ? { lower: game.spread.lower === letter, points: game.spread.points } : null,
        score: game.score ? [game.score[side], game.score[1 - side]] : null,
        beat: game.result ? game.result.spreadWinner === letter : null,
      });
    }
  }
  return out.sort((x, y) => ORDER[x.status] - ORDER[y.status]);
}
