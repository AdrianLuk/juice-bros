import { resolveMixed } from "../engine/mixed.ts";
import {
  boardObjection,
  isSupportedBoardSize,
  maxPools,
  resolveBoard,
  type BoardConfig,
} from "../engine/pools.ts";
import type { PoolHeader } from "../engine/roster.ts";
import type { Format, Roster } from "../engine/types.ts";
import {
  isFiniteNumber,
  isRecord,
  readChoice,
  readFlag,
  readFormat,
  readHeaders,
  readPools,
  readRoster,
} from "./read-config.ts";

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

/**
 * Bump whenever the saved shape changes. Old saves are discarded, not
 * migrated.
 *
 * 2 is RR-4.1's Format (#543). A schema-1 save has no Format and would read as
 * rotating perfectly well, so discarding it is a choice rather than a
 * necessity: what is thrown away is a Roster the organizer can paste again,
 * and the alternative is a migration path kept alive forever for one optional
 * field. The Share Link makes the opposite trade, and has to — a link in a
 * group chat cannot be asked to paste anything again.
 *
 * RR-4.3's mixed doubles (#545) is deliberately *not* a bump, which is the
 * other half of that same trade rather than a change of mind about it. What it
 * adds is a flag that is off in every existing save and a per-Player marker
 * that is absent from every existing Roster, and both read correctly as what
 * they were. There is nothing to migrate and nothing to discard, so discarding
 * would only throw away a roster to no end.
 *
 * RR-6's Pool count (#552) is not a bump either, on exactly those terms: it is
 * absent from every existing save, and absent reads as one Pool, which is what
 * every existing save is.
 *
 * RR-6.2's headers (#553, ADR 0005) are not a bump on the same terms again:
 * `headers` is absent from every save written before it, and absent reads as
 * no declared split — the ordinary Roster every existing save already is.
 */
const SCHEMA = 2;

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
  /**
   * Which Format the row is on. Not nullable the way the two numbers are:
   * those follow the Roster until the organizer overrules them, and a Format
   * has nothing to follow — rotating is a selection like any other, made on
   * the organizer's behalf before they arrive.
   */
  readonly format: Format;
  /**
   * Whether the mixed-doubles box is ticked. Kept beside the Format rather
   * than folded into it because it is a constraint on rotating and not a
   * Format of its own, and the markers it reads live on the Roster lines.
   */
  readonly mixed: boolean;
  /**
   * How many Pools the Roster is dealt into. Not nullable, for the Format's
   * reason: one is a choice made on the organizer's behalf, not a number that
   * follows the Roster. What does follow the Roster is how many it can make,
   * and that is clamped where it is read rather than written back here.
   *
   * Meaningless while `headers` says otherwise (ADR 0005) — a declared split
   * is not a choice this field records, and reading it back is what the
   * headers are for. It is kept anyway so a save written before headers
   * existed restores exactly as it did.
   */
  readonly pools: number;
  /**
   * The Roster's own `---` headers, in the order they were typed. Empty is
   * every save written before ADR 0005 and every one since with no header in
   * the box — the ordinary Roster this app has always read, where the Pool
   * count above decides the split.
   */
  readonly headers: readonly PoolHeader[];
}

export interface SavedVisit {
  readonly schema: number;
  readonly edited: EditedConfig;
  /** The Config the sheet on screen came from, or null if nothing was drawn. */
  readonly drawn: BoardConfig | null;
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
export function save(edited: EditedConfig, drawn: BoardConfig | null): void {
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
  const format = readFormat(value.format);
  const mixed = readFlag(value.mixed);
  const pools = readPools(value.pools);
  const headers = readHeaders(value.headers);
  if (!roster || courts === undefined || rounds === undefined) return null;
  if (format === undefined || mixed === undefined || pools === undefined) {
    return null;
  }
  if (headers === undefined) return null;
  // Normalized rather than restored as written: mixed doubles is a qualifier
  // on rotating, and a box that came back ticked under fixed partners would be
  // applying to nothing. The screen never writes that pair, so this is only
  // about a save edited by hand.
  return {
    roster,
    courts,
    rounds,
    format,
    mixed: resolveMixed(format, mixed),
    pools,
    headers,
  };
}

function readDrawn(value: unknown): BoardConfig | null {
  if (!isRecord(value)) return null;
  const roster = readRoster(value.roster);
  const count = readPools(value.pools);
  const headers = readHeaders(value.headers);
  // Anything the engine would refuse is treated as corrupt here, so a
  // hand-edited save cannot turn into an UnsupportedConfigError on mount.
  // A drawn count this Roster cannot make is refused rather than clamped, on
  // the Share Link's terms: the screen only ever writes the count it drew.
  // Headers win over the count on the same terms as everywhere else (ADR
  // 0005), so this pre-check is the count-based split's own clamp and is
  // harmless rather than load-bearing once headers are present — the count a
  // declared save writes is always `headers.length` and already satisfies it.
  if (!roster || count === undefined || headers === undefined) return null;
  if (count > maxPools(roster.length)) return null;
  if (!isSupportedBoardSize(roster.length, count)) return null;
  const { courts, rounds, seed } = value;
  if (!isFiniteNumber(courts) || !isFiniteNumber(rounds) || !isFiniteNumber(seed)) {
    return null;
  }
  const format = readFormat(value.format);
  const ticked = readFlag(value.mixed);
  if (format === undefined || ticked === undefined) return null;
  const mixed = resolveMixed(format, ticked);
  // Brought inside what the Roster supports here rather than left to
  // `generateSchedule`, which clamps its own copy and hands nothing back: the
  // restored numbers are read again for the stale key and for the line naming
  // what the sheet was drawn from, and both have to be the numbers used.
  const numbers = resolveBoard(roster, courts, rounds, format, mixed, count, headers);
  // Roster size is not the only thing a draw refuses: an odd list in fixed
  // partners leaves somebody with nobody to partner, a half-marked or
  // lopsided list cannot be seated as mixed doubles, and a Pool short of a
  // court or of a side cannot be seated at all — a declared Pool's own
  // composition, an even deal otherwise. All of them have to be checked here,
  // and for the same reason — this Config is drawn from during mount, so
  // anything a draw would throw on is a screen that never renders, on every
  // visit, until storage is cleared by hand.
  if (
    boardObjection(roster, format, mixed, numbers.pools, numbers.courts, headers) !==
    null
  ) {
    return null;
  }
  return {
    roster,
    seed,
    format,
    mixed,
    ...numbers,
    ...(headers.length > 0 ? { headers } : {}),
  };
}
