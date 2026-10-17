/**
 * Renaming or reordering a Team's Player slots on the night (team-tally/
 * CONTEXT.md, "Player slot"). Slot N is the player who partners the captain
 * in Round N, so a Round with a score pins its slot against a reorder. A
 * rename always saves: a substitute takes over the same slot.
 *
 * Shared by the roster form and mirrored by `team_tally_write_slots` in the
 * database, which refuses with the same message. Relative imports only, for
 * `node --test`.
 */

import type { Round } from "./event-doc.ts";

export type Roster = { slotA: string; slotB: string; slotC: string };

export type RosterCheck = { ok: true } | { ok: false; problem: string };

const SLOTS = [
  { round: 1, key: "slotA", letter: "A" },
  { round: 2, key: "slotB", letter: "B" },
  { round: 3, key: "slotC", letter: "C" },
] as const;

/** Checks a new A, B, C against the current one, given the Rounds of the current Matchup that have a score. */
export function checkRosterChange(current: Roster, next: Roster, scoredRounds: readonly Round[]): RosterCheck {
  for (const { key, letter } of SLOTS) {
    const name = next[key].trim();
    if (name.length === 0) {
      return { ok: false, problem: `Player ${letter} needs a name.` };
    }
    if (name.length > 80) {
      return { ok: false, problem: `Player ${letter}'s name is too long.` };
    }
  }

  // A slot moved when it now holds a name one of its teammates held.
  for (const { round, key, letter } of SLOTS) {
    const name = next[key].trim();
    const moved =
      name !== current[key].trim() && SLOTS.some((other) => other.key !== key && current[other.key].trim() === name);
    if (scoredRounds.includes(round) && moved) {
      return {
        ok: false,
        problem: `Round ${round} already has a score, so Player ${letter} stays ${current[key].trim()}.`,
      };
    }
  }

  return { ok: true };
}
