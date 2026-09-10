import {
  isSupportedRosterSize,
  resolveNumbers,
  type ResolvedConfig,
} from "../engine/config.ts";
import type { Roster } from "../engine/types.ts";
import { isFiniteNumber, isRecord, readChoice, readRoster } from "./read-config.ts";

/**
 * The organizer's last visit, kept in this browser.
 *
 * A Schedule is a pure function of a Config and its Seed (ADR 0001), so there
 * is nothing here but the Config: the sheet comes back by being generated
 * again, not by being stored. That is what keeps this module small enough to
 * be the one place that knows the Config's storage shape — everything the
 * organizer chose is here and nowhere else.
 *
 * It is no longer the only module in Match Mixer that touches
 * `window.localStorage`: find-me's selection has a key and a module of its own
 * (`selection-storage.ts`, #495). It had to, and deliberately so — a Borrowed
 * board is never written here, which is exactly the visit whose selection most
 * needs to survive a pocket. See that module for the rest of the reasoning.
 *
 * Two Configs, because the screen can hold two. The edited one is what is in
 * the fields; the drawn one is what produced the sheet on screen. They are
 * usually the same, and when they are not the screen says so — which it can
 * only keep saying after a reload if both come back.
 */
const KEY = "juicebros.matchmixer.config";

/** Bump whenever the saved shape changes. Old saves are discarded, not migrated. */
const SCHEMA = 1;

/**
 * The Config as it stands in the fields: everything but the Seed, which is
 * something a draw has rather than something the organizer sets.
 *
 * `null` for courts or rounds means the field is following the Roster rather
 * than holding a number the organizer chose, which is a distinction worth
 * saving: restoring a resolved number instead would quietly nail the field
 * down, and the next name pasted would no longer move it.
 */
export interface EditedConfig {
  readonly roster: Roster;
  readonly courts: number | null;
  readonly rounds: number | null;
}

export interface SavedVisit {
  readonly schema: number;
  readonly edited: EditedConfig;
  /** The Config the sheet on screen came from, or null if nothing was drawn. */
  readonly drawn: ResolvedConfig | null;
  readonly savedAt: number;
}

/**
 * Callers debounce. A Roster is a few hundred bytes, so the write itself is
 * far cheaper than the keystroke that triggered it, but writing on every
 * keystroke is still work nobody asked for.
 *
 * An emptied Roster deletes the save rather than shrinking it: the box is how
 * an organizer says they are done with that list, and the sheet drawn from it
 * would otherwise come back next week looking like this visit's work. Callers
 * decide when they mean it — a tab that has never held anything must not call
 * this at all, or it would delete what another tab just saved.
 */
export function save(edited: EditedConfig, drawn: ResolvedConfig | null): void {
  if (typeof window === "undefined") return;
  if (edited.roster.length === 0) {
    clear();
    return;
  }
  try {
    const payload: SavedVisit = {
      schema: SCHEMA,
      edited,
      drawn,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Quota or private-mode failure. Losing the save is survivable; throwing
    // while somebody is typing a roster is not.
  }
}

/**
 * Never throws, and anything it cannot vouch for comes back as `null` — a
 * fresh, empty screen, which is a worse outcome than a restored roster and a
 * far better one than a page that won't load. Storage is hand-editable, so
 * every field is checked rather than trusted.
 *
 * Call this from an effect, never during render: localStorage does not exist
 * on the server, so reading it while rendering hydrates a different tree than
 * the server sent.
 */
export function load(): SavedVisit | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schema !== SCHEMA) return null;

    const edited = readEdited(parsed.edited);
    if (!edited) return null;

    const drawn = parsed.drawn == null ? null : readDrawn(parsed.drawn);
    if (parsed.drawn != null && !drawn) return null;

    return {
      schema: SCHEMA,
      edited,
      drawn,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function clear(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Same reasoning as save().
  }
}

function readEdited(value: unknown): EditedConfig | null {
  if (!isRecord(value)) return null;
  const roster = readRoster(value.roster);
  const courts = readChoice(value.courts);
  const rounds = readChoice(value.rounds);
  if (!roster || courts === undefined || rounds === undefined) return null;
  return { roster, courts, rounds };
}

function readDrawn(value: unknown): ResolvedConfig | null {
  if (!isRecord(value)) return null;
  const roster = readRoster(value.roster);
  // Anything the engine would refuse is treated as corrupt here, so a
  // hand-edited save cannot turn into an UnsupportedConfigError on mount.
  if (!roster || !isSupportedRosterSize(roster.length)) return null;
  const { courts, rounds, seed } = value;
  if (!isFiniteNumber(courts) || !isFiniteNumber(rounds) || !isFiniteNumber(seed)) {
    return null;
  }
  // Brought inside what the Roster supports here rather than left to
  // `generateSchedule`, which clamps its own copy and hands nothing back: the
  // restored numbers are read again for the stale key and for the line naming
  // what the sheet was drawn from, and both have to be the numbers used.
  return { roster, seed, ...resolveNumbers(roster.length, courts, rounds) };
}
