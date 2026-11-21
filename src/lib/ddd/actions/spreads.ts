"use server";

import { revalidatePath } from "next/cache";

import { verifyOrganizer } from "../dal.ts";
import { getLineups } from "../lineup-db.ts";
import { LINEUP_GAMES, type LineupGame } from "../lineup.ts";
import { DDD_ROOT } from "../routes.ts";
import { getRoster } from "../roster-db.ts";
import { lineupsOf, pairSig, readSpreadFields } from "../spreads.ts";
import { savePairingSpreads } from "../spreads-db.ts";
import { createClient } from "../supabase/server.ts";

export type SpreadsState = { problem?: string; saved?: boolean };

/**
 * Saves one Team pairing's four Spreads (issue #714). Nothing saves unless
 * every cell reads cleanly. Each Spread is stamped with the Pairs it was set
 * against, so a later Lineup change flags it. Reachable by a direct POST, so
 * it checks the Organizer first.
 */
export async function savePairingAction(
  eventId: string,
  teamA: string,
  teamB: string,
  _prev: SpreadsState,
  formData: FormData,
): Promise<SpreadsState> {
  await verifyOrganizer();
  const read = readSpreadFields((field) => String(formData.get(field) ?? ""));
  if ("problem" in read) return { problem: read.problem };

  const supabase = await createClient();
  const teams = await getRoster(supabase, String(eventId));
  const a = teams.find((team) => team.id === String(teamA));
  const b = teams.find((team) => team.id === String(teamB));
  // A Team's position decides which is "a", so the pairing is stored one way only.
  if (!a || !b || teams.indexOf(a) >= teams.indexOf(b)) return { problem: "That pairing is gone. Reload the page." };

  const lineups = await getLineups(supabase, [a.id, b.id]);
  const both = lineupsOf(a, b, lineups);
  if (!both) {
    if (read.entries.every((entry) => !entry.set)) return { saved: true };
    return { problem: "Both Teams need a Lineup before a Spread can be set." };
  }
  const sigs = Object.fromEntries(LINEUP_GAMES.map((game) => [game, pairSig(both[0], both[1], game)])) as Record<LineupGame, string>;
  await savePairingSpreads(supabase, a.id, b.id, read.entries, sigs);
  revalidatePath(DDD_ROOT, "layout");
  return { saved: true };
}
