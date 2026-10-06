/**
 * Pure logic for a Standing Game's Regulars (issue #579, CONTEXT.md): the
 * organizer's own list of Connections told each time it posts a game.
 *
 * The rules that must hold whichever path writes the list live in the
 * database (`standing_game_regulars`): a Regular is an accepted Connection of
 * the organizer, a yes answer adds one, and ending the Connection removes
 * them. This module is only the form handling around it. Relative imports
 * only, so it runs under `node --test`.
 */

import { isUuid } from "./uuid.ts";

/** A friend the organizer can pick as a Regular. */
export type RegularChoice = { userId: string; label: string };

/** A Friend Group offered as a one-tap fill: it adds its members, it is not linked. */
export type RegularGroupChoice = { id: string; name: string; memberIds: string[] };

/** What the Regulars picker offers: the organizer's friends and their Friend Groups. */
export type RegularChoices = {
  friends: RegularChoice[];
  groups: RegularGroupChoice[];
};

/** The form field every ticked Regular is submitted under, one value per Regular. */
export const REGULAR_IDS_FIELD = "regular_ids";

/**
 * Every ticked Regular, once each, in the order ticked. Anything that isn't a
 * user id is dropped; whether an id is really the organizer's Connection is
 * the database's check, not this one.
 */
export function parseRegularIds(formData: FormData): string[] {
  const ids = formData
    .getAll(REGULAR_IDS_FIELD)
    .map((value) => String(value).trim())
    .filter(isUuid);
  return [...new Set(ids)];
}

/** What saving `next` over `current` writes: who to add and who to remove. */
export function diffRegulars(
  current: readonly string[],
  next: readonly string[],
): { add: string[]; remove: string[] } {
  const currentSet = new Set(current);
  const nextSet = new Set(next);
  return {
    add: next.filter((id) => !currentSet.has(id)),
    remove: current.filter((id) => !nextSet.has(id)),
  };
}

/** The list after a Friend Group fills it: everyone already picked, then the group's members not yet on it. */
export function withGroupMembers(
  selected: readonly string[],
  memberIds: readonly string[],
): string[] {
  return [...new Set([...selected, ...memberIds])];
}

/** `standing_game_regulars` rows grouped into each Standing Game's list of user ids. */
export function groupRegularsByGame(
  rows: readonly { standing_game_id: string; user_id: string }[],
): Map<string, string[]> {
  const byGame = new Map<string, string[]>();
  for (const row of rows) {
    const list = byGame.get(row.standing_game_id) ?? [];
    list.push(row.user_id);
    byGame.set(row.standing_game_id, list);
  }
  return byGame;
}

/** `"1 regular"`, `"3 regulars"`: the picker's count line and the Weekly games row. */
export function regularsCountLabel(count: number): string {
  return `${count} regular${count === 1 ? "" : "s"}`;
}
