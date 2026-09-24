import { FORMATS } from "../engine/format.ts";
import {
  DEFAULT_FORMAT,
  MARKERS,
  type Format,
  type Marker,
  type Player,
  type Roster,
} from "../engine/types.ts";

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

/**
 * A Roster: an array of players, each with a string `id` and `name`, and
 * optionally the marker mixed doubles reads off their line.
 *
 * The marker is carried through rather than dropped. A save written by a
 * build before it existed simply has none, which reads as an unmarked line and
 * is exactly what it was — but a marker dropped on the way back *in* would put
 * a roster on screen that no longer says what was typed, and the toggle over
 * it would start refusing a list the organizer had already marked.
 */
export function readRoster(value: unknown): Roster | null {
  if (!Array.isArray(value)) return null;
  const roster: Player[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    if (typeof entry.id !== "string" || typeof entry.name !== "string") return null;
    const marker = readMarker(entry.marker);
    if (marker === undefined) return null;
    roster.push(marker ? { id: entry.id, name: entry.name, marker } : { id: entry.id, name: entry.name });
  }
  return roster;
}

/**
 * A marker, where absent is a bare line and `undefined` is a refusal. Present
 * but not `M` or `F` is a value this build cannot seat, which gets the same
 * answer as an unknown Format: refuse the whole read rather than quietly drop
 * it and draw a board nobody asked for.
 */
function readMarker(value: unknown): Marker | null | undefined {
  if (value == null) return null;
  return MARKERS.find((marker) => marker === value);
}

/**
 * A flag that may be absent, where absent is `false`. Present but not a
 * boolean is corruption, and comes back as `undefined` so the caller can
 * refuse the whole read.
 */
export function readFlag(value: unknown): boolean | undefined {
  if (value == null) return false;
  return typeof value === "boolean" ? value : undefined;
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

/**
 * A Pool count, where absent is one Pool: every save and every Config written
 * before Pools existed. Present but not a whole number of at least one is
 * corruption, and comes back as `undefined` so the caller can refuse the whole
 * read. Whether this Roster can make that many is the caller's clamp, not a
 * reason to refuse: the count is a choice, and the Roster under it may since
 * have shrunk.
 */
export function readPools(value: unknown): number | undefined {
  if (value == null) return 1;
  return typeof value === "number" && Number.isInteger(value) && value >= 1
    ? value
    : undefined;
}

/**
 * The Roster's Pool headers (ADR 0005), where absent is none: every save
 * written before headers existed, and every save since with no `---` line in
 * the box. Present but not an array of `{ label, start }` pairs is
 * corruption, and comes back as `undefined` so the caller can refuse the
 * whole read — the same answer a bad Roster or a bad Format gets.
 */
export function readHeaders(
  value: unknown,
): { readonly label: string | null; readonly start: number }[] | undefined {
  if (value == null) return [];
  if (!Array.isArray(value)) return undefined;
  const headers: { label: string | null; start: number }[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return undefined;
    const { label, start } = entry;
    if (label !== null && typeof label !== "string") return undefined;
    if (typeof start !== "number" || !Number.isInteger(start) || start < 0) {
      return undefined;
    }
    headers.push({ label, start });
  }
  return headers;
}
