import { FORMATS } from "../engine/format.ts";
import { DEFAULT_FORMAT, type Format, type Roster } from "../engine/types.ts";

/**
 * Field-level validators for a Config read from somewhere the organizer could
 * have hand-edited: `config-storage` today, and a share-link payload once one
 * exists. Both readers need the same answer to "is this actually a Roster / a
 * court count / a Round count / a Seed", so that answer lives here once
 * rather than drifting between two copies of it.
 *
 * Pure field checks only. Assembling a caller's own shape out of them (an
 * `EditedConfig`, a `ResolvedConfig`) — and any engine-specific clamping that
 * goes with that shape — stays with the caller.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A Roster: an array of players, each with a string `id` and `name`. */
export function readRoster(value: unknown): Roster | null {
  if (!Array.isArray(value)) return null;
  const roster: { id: string; name: string }[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    if (typeof entry.id !== "string" || typeof entry.name !== "string") return null;
    roster.push({ id: entry.id, name: entry.name });
  }
  return roster;
}

/** A court count, a Round count or a Seed: always a finite number. */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * A court count or a Round count that may instead be absent — `null` meaning
 * the field follows the Roster rather than holding a number the organizer
 * chose. Anything present but not a finite number is not a valid absence, so
 * it comes back as `undefined` to let the caller reject the whole read.
 */
export function readChoice(value: unknown): number | null | undefined {
  if (value == null) return null;
  return isFiniteNumber(value) ? value : undefined;
}

/**
 * A Format, where absent means rotating — a Config written before Formats
 * existed, from either reader.
 *
 * `undefined` is a refusal and never a default: a value that is present but is
 * not a Format this build knows is a board this build cannot draw, and drawing
 * a rotating one in its place would put a Schedule on screen that nobody
 * generated. That is the same failure the Share Link's checksum exists to
 * catch, so it gets the same answer.
 */
export function readFormat(value: unknown): Format | undefined {
  if (value == null) return DEFAULT_FORMAT;
  return FORMATS.find((format) => format === value);
}
