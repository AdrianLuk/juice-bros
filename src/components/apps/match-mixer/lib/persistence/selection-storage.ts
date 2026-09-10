import type { PlayerIndex } from "../engine/types.ts";

/**
 * Which Player has been found on the board in front of you, kept in this
 * browser.
 *
 * Its own key and its own module rather than a field on `SavedVisit`, because
 * the case find-me exists for is the case nothing is written to `SavedVisit`:
 * a board arrived at by link is deliberately not saved, so that reading
 * somebody else's link cannot wipe the Roster a player keeps for their own
 * club night. Put the selection in there and the player who opens a link, taps
 * themselves and pockets the phone is the one person it never comes back for.
 * It would also ride that module's 400ms save debounce and be deleted by its
 * `clear()`, and the selection wants neither.
 *
 * It holds to the same discipline all the same: a key of its own, a schema
 * marker, an SSR guard, try/catch on both sides, and anything it cannot vouch
 * for reading as "no selection" rather than as a guess.
 */
const KEY = "juicebros.matchmixer.selection";

/** Bump whenever the saved shape changes. Old saves are discarded, not migrated. */
const SCHEMA = 1;

interface SavedSelection {
  readonly schema: number;
  /** The board the index was picked on. See `boardIdentity`. */
  readonly board: string;
  readonly player: PlayerIndex;
}

/**
 * Which board a stored index belongs to. A Roster index only means anything
 * against one particular board — store index 3 against one, open another, and
 * index 3 is a stranger's evening — so the index is never stored alone.
 *
 * The draw key is the Roster, the courts and the Rounds; the Seed is what
 * separates two draws of the same numbers. Together they are what makes "the
 * organizer sent a second link" behave: the old selection simply does not
 * attach to the new board.
 */
export function boardIdentity(drawKey: string, seed: number): string {
  return `${seed}/${drawKey}`;
}

export function save(board: string, player: PlayerIndex): void {
  if (typeof window === "undefined") return;
  try {
    const payload: SavedSelection = { schema: SCHEMA, board, player };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Quota or private-mode failure. Losing the selection is survivable;
    // throwing because somebody tapped their own name is not.
  }
}

/**
 * The selected Player for this board, or `null` — which is what a mismatched
 * board, an index this Roster does not have, a corrupt value, an unknown
 * schema and a browser that refuses storage all read as. No selection is a
 * fine state to be in, and it is the state find-me starts in anyway.
 *
 * Call this from an effect, never during render: localStorage does not exist
 * on the server, so reading it while rendering hydrates a different tree than
 * the server sent.
 */
export function load(board: string, rosterSize: number): PlayerIndex | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { schema, board: saved, player } = parsed as Record<string, unknown>;
    if (schema !== SCHEMA) return null;
    if (typeof saved !== "string" || saved !== board) return null;
    if (typeof player !== "number" || !Number.isInteger(player)) return null;
    if (player < 0 || player >= rosterSize) return null;

    return player;
  } catch {
    return null;
  }
}

/**
 * Puts the whole board back, and removes the stored value rather than leaving
 * a tombstone behind.
 *
 * Scoped to a board like `save` is, because the key is one slot shared by
 * every tab: a second tab reading a different board must not delete the
 * selection the first one is still showing. A value that cannot be read at all
 * is nobody's, and goes.
 */
export function clear(board: string): void {
  if (typeof window === "undefined") return;
  try {
    if (belongsElsewhere(board)) return;
    window.localStorage.removeItem(KEY);
  } catch {
    // Same reasoning as save().
  }
}

/** Whether what is stored is some other board's selection. */
function belongsElsewhere(board: string): boolean {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return false;
    const saved = (parsed as Record<string, unknown>).board;
    return typeof saved === "string" && saved !== board;
  } catch {
    return false;
  }
}
