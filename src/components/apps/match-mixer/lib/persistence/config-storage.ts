import { isSupportedRosterSize, type ResolvedConfig } from "../engine/config.ts";
import type { Roster } from "../engine/types.ts";

/**
 * The organizer's last visit, kept in this browser.
 *
 * A Schedule is a pure function of a Config and its Seed (ADR 0001), so there
 * is nothing here but the Config: the sheet comes back by being generated
 * again, not by being stored. That is what keeps this module small enough to
 * be the only thing in Match Mixer that touches `window.localStorage`.
 *
 * Two Configs, because the screen can hold two. What is in the fields is the
 * one being edited; what the sheet was drawn from is the one that produced
 * what is on screen. They are usually the same, and when they are not the
 * screen says so — which it can only keep saying after a reload if both come
 * back.
 */
const KEY = "juicebros.matchmixer.config";

/** Bump whenever the saved shape changes. Old saves are discarded, not migrated. */
const SCHEMA = 1;

/**
 * What is in the fields. A Config with no Seed, because a Seed is something a
 * draw has rather than something the organizer sets.
 *
 * `null` for courts or rounds means the field is following the Roster rather
 * than holding a number the organizer chose, which is a distinction worth
 * saving: restoring a resolved number instead would quietly nail the field
 * down, and the next name pasted would no longer move it.
 */
export interface SavedFields {
  readonly roster: Roster;
  readonly courts: number | null;
  readonly rounds: number | null;
}

export interface SavedSession {
  readonly schema: number;
  readonly fields: SavedFields;
  /** The Config the sheet on screen came from, or null if nothing was drawn. */
  readonly drawn: ResolvedConfig | null;
  readonly savedAt: number;
}

/**
 * Callers debounce. A Roster is a few hundred bytes, so the write itself is
 * far cheaper than the keystroke that triggered it, but writing on every
 * keystroke is still work nobody asked for.
 */
export function save(fields: SavedFields, drawn: ResolvedConfig | null): void {
  if (typeof window === "undefined") return;
  // An emptied box is the organizer saying they are done with that list, so
  // nothing survives it — including the sheet drawn from it, which the screen
  // keeps on show as a stale draw but which would come back next week looking
  // like this visit's work.
  if (fields.roster.length === 0) {
    clear();
    return;
  }
  try {
    const payload: SavedSession = {
      schema: SCHEMA,
      fields,
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
export function load(): SavedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.schema !== SCHEMA) return null;

    const fields = readFields(parsed.fields);
    if (!fields) return null;

    const drawn = parsed.drawn == null ? null : readDrawn(parsed.drawn);
    if (parsed.drawn != null && !drawn) return null;

    return {
      schema: SCHEMA,
      fields,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readRoster(value: unknown): Roster | null {
  if (!Array.isArray(value)) return null;
  const roster: { id: string; name: string }[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    if (typeof entry.id !== "string" || typeof entry.name !== "string") return null;
    roster.push({ id: entry.id, name: entry.name });
  }
  return roster;
}

/** A number the organizer chose, or null for the field following the Roster. */
function readChoice(value: unknown): number | null | undefined {
  if (value == null) return null;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readFields(value: unknown): SavedFields | null {
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
  // Courts and rounds are clamped by `generateSchedule` itself, so they need
  // only be numbers here.
  return { roster, courts, rounds, seed };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
