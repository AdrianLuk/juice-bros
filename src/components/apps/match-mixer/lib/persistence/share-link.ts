import {
  isSupportedRosterSize,
  resolveNumbers,
  type ResolvedConfig,
} from "../engine/config.ts";
import { FORMATS, formatObjection } from "../engine/format.ts";
import {
  mixedObjection,
  partnershipSupply,
  rosterLine,
} from "../engine/mixed.ts";
import { parseRoster } from "../engine/roster.ts";
import { DEFAULT_FORMAT, type Format } from "../engine/types.ts";
import { isFiniteNumber, readChoice } from "./read-config.ts";

/**
 * The board, in a URL.
 *
 * An organizer copies a link and pastes it into the group chat; whoever opens
 * it sees the same board down to the seat every name sat in. Nothing is
 * uploaded and there is no server to ask: the link carries the Config, and the
 * Schedule is generated again in the reader's browser from it. That is what
 * ADR 0001's determinism was for, and it is why shipping this meant carrying
 * four values rather than serialising a grid.
 *
 * The link is transport, not storage. `config-storage` stays the only module
 * in Match Mixer that touches `window.localStorage`.
 *
 * Like everything under `lib/`, this resolves under plain `node --test` with
 * relative `.ts` imports — no `@/` alias, no React — which is the other reason
 * the encoding is synchronous and dependency-free.
 */

/** The one query parameter. Short because every character is budget. */
export const SHARE_PARAM = "b";

/**
 * Which generator minted a link. Bump it whenever a change alters what an
 * existing Config generates: a new or amended Table, a change to the search, a
 * change to the Scorer's weights. A Seed only reproduces a board if the thing
 * consuming it has not moved.
 *
 * Carried from day one because it is a format contract — adding it later would
 * leave every link already in a chat thread unmarked. What to *do* about a
 * mismatch is #494; this module only carries it and reports it.
 */
export const GENERATOR_VERSION = 1;

/**
 * Where chat clients, mail clients and address bars stop being reliable. The
 * Roster is capped at 32 Players, so a real link lands well inside this and
 * the ceiling is a refusal rather than a truncation.
 */
export const MAX_LINK_LENGTH = 2000;

/** A board that arrived by link, and which generator minted it. */
export interface SharedBoard {
  readonly config: ResolvedConfig;
  /** The generator version the link was minted under. */
  readonly version: number;
  /** Whether that is the version this build generates with. */
  readonly current: boolean;
}

/**
 * The payload is one line of numbers followed by the Roster, one line per
 * Player exactly as it was typed — including the marker mixed doubles reads
 * off the end of it. Newline is the separator because it is the one character
 * `parseRoster` will not leave inside a name, and the same parse reads the
 * block here as reads the roster box, so the two cannot disagree about where
 * a name ends and a marker begins.
 *
 * A future field is appended to the number line, never inserted, and an absent
 * one reads as its default. That is what keeps a link minted today valid once
 * RR-6 adds Pool Count, and it is how RR-4.1's Format arrived: a sixth field
 * after the checksum, absent in every link already sitting in a group chat,
 * and absent reads as rotating. RR-4.3's mixed doubles is the seventh, on the
 * same terms.
 *
 * The number line carries a checksum over the Roster block, which is the one
 * thing in the payload not implied by the rest of it. It is there because a
 * truncated link is the failure this transport actually has — a chat client
 * that autolinks half a URL, an address bar that loses the tail — and without
 * it a link cut after the sixth of twelve names decodes cleanly into a
 * six-player board that a reader has no way to tell from the real one, and one
 * cut mid-name into a board with "Gabriel Tar" playing court 3. Neither is a
 * board anybody drew. A count would catch the first; only a checksum catches
 * both.
 *
 * It covers the Roster and not the numbers, which is what leaves the number
 * line free to grow: RR-6 can append Pool Count without invalidating a link
 * minted today. A truncation inside the number line takes the whole Roster
 * with it, and is refused for having no Roster at all.
 */
const LINE = "\n";
const FIELD = ".";

/**
 * The Format, as one character on the number line.
 *
 * A code rather than the Format's own name, because every character in a link
 * is budget, and a code rather than a position in `FORMATS`, because a
 * position is a promise never to reorder that list. Appended after the
 * checksum and never inserted, so a link minted before Formats existed has
 * five fields, reads as rotating, and goes on drawing the board it named.
 */
const FORMAT_CODES: Record<Format, string> = {
  rotating: "r",
  fixed: "f",
  singles: "s",
};

/**
 * Mixed doubles, as a seventh field, present only when it is on.
 *
 * The constraint needs a field of its own even though the markers travel in
 * the Roster block, because marking the lines and asking for a mixed board are
 * two different things: an organizer can paste a marked list, leave the box
 * unticked and get an ordinary rotation, and a link that carried only the
 * markers could not tell the reader which of those they were looking at.
 *
 * Appended rather than always emitted, so a link minted for an unmixed board
 * is byte-for-byte the link this build minted yesterday.
 */
const MIXED_CODE = "m";

/**
 * The link for a drawn board, or `null` if the Roster is too long to fit one.
 *
 * `base` is the address of the tool itself, normally `window.location.href`.
 * Its fragment is dropped and any existing share parameter is replaced, so
 * copying a link off a link-opened board gives the board on screen rather than
 * the one that was opened.
 *
 * No compression. It would buy a few hundred characters in exchange for an
 * async, platform-dependent API that does not exist uniformly across the
 * browser and the `node --test` runner this module has to work under, and the
 * budget is not tight enough to pay that.
 */
export function encodeShareLink(
  config: ResolvedConfig,
  base: string,
): string | null {
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }

  // The line as typed, not the name: a marker parsed off one end of the
  // journey and dropped at the other would open an unmixed board that looks
  // exactly like the mixed one that was shared, and the reader would have no
  // way to tell. Carrying the line also puts the markers under the checksum,
  // where the rest of the Roster already is.
  const names = config.roster.map(rosterLine).join(LINE);
  const numbers = [
    GENERATOR_VERSION,
    config.courts,
    config.rounds,
    config.seed,
    checksum(names),
    FORMAT_CODES[config.format],
  ];
  if (config.mixed) numbers.push(MIXED_CODE);
  const payload = [numbers.join(FIELD), names].join(LINE);

  url.hash = "";
  url.searchParams.set(SHARE_PARAM, payload);

  const link = url.toString();
  return link.length > MAX_LINK_LENGTH ? null : link;
}

/**
 * The address bar, with the share parameter gone.
 *
 * The one thing a link-opened board can do that a saved one cannot is lie: the
 * moment the board on screen stops matching what the parameter describes —
 * redrawn, edited, a different court or Round count — the address bar is
 * still offering the old one to anyone who copies it. This is the fix, and it
 * is only ever handed to `history.replaceState`, never to a navigation: the
 * caller decides how it lands, this function only says what the address bar
 * should say.
 *
 * `href` unchanged for anything that is not a URL or does not carry the
 * parameter — this runs beside code that cannot always be sure which is
 * true, and echoing the input back is the right answer for both.
 */
export function stripShareParam(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  if (!url.searchParams.has(SHARE_PARAM)) return href;
  url.searchParams.delete(SHARE_PARAM);
  return url.toString();
}

/**
 * The board a link describes, or `null` for anything this cannot vouch for.
 *
 * Never throws, and `null` is the ordinary empty tool rather than an error
 * page: a URL is the most mangled input this app takes, since chat clients
 * wrap it, truncate it and re-escape it on the way through. Absent, empty,
 * truncated and hand-edited all land here and all get the same answer.
 *
 * The numbers are validated by the same reader `config-storage` uses, so there
 * is one definition of "a Config I did not write" rather than two that drift.
 * The Roster goes through `parseRoster`, which is also how a pasted list is
 * read — Player ids are not carried and are regenerated on arrival, because
 * the engine works in positions.
 */
export function decodeShareLink(value: unknown): SharedBoard | null {
  if (typeof value !== "string" || value.length === 0) return null;

  const cut = value.indexOf(LINE);
  const numbers = cut === -1 ? value : value.slice(0, cut);
  const names = cut === -1 ? "" : value.slice(cut + LINE.length);
  const [rawVersion, rawCourts, rawRounds, rawSeed, rawSum, rawFormat, rawMixed] =
    numbers.split(FIELD);

  // Required. A payload that cannot say which generator drew it, or with what
  // Seed, does not describe a board — it describes some other board.
  const version = toNumber(rawVersion);
  const seed = toNumber(rawSeed);
  if (!isFiniteNumber(version) || !isFiniteNumber(seed)) return null;

  // Not what the payload says it carries: the link lost its tail on the way
  // through a chat client, or was edited by hand. Either way the board it
  // would draw is not the board that was shared, and a reader has no way of
  // telling — a name cut to "Gabriel Tar" reads as a board, not as damage.
  if (rawSum !== checksum(names)) return null;

  // Optional. Absent reads as the default for this Roster; present but not a
  // number is corruption, and the whole read is refused.
  const courts = readChoice(toNumber(rawCourts));
  const rounds = readChoice(toNumber(rawRounds));
  if (courts === undefined || rounds === undefined) return null;

  // Absent is rotating, which is what every link minted before Formats existed
  // is. A code this build does not know is not: it names a board this build
  // cannot draw, and drawing a rotating one under it would put a Schedule on
  // screen that nobody generated — the same failure the checksum above exists
  // to catch, so it gets the same answer rather than a quiet substitution.
  const format = toFormat(rawFormat);
  if (format === undefined) return null;

  // Same rule one field along, and one extra refusal: mixed doubles is a
  // qualifier on rotating, so a payload asking for it under any other Format
  // is describing a board this build cannot draw rather than one it should
  // quietly draw differently.
  const mixed = toMixed(rawMixed);
  if (mixed === undefined) return null;
  if (mixed && format !== "rotating") return null;

  // The markers are read only when the payload asked for a mixed board, which
  // is the same rule the roster box follows: a line ending in a last initial
  // is a name everywhere else, and a link must not be the one place it stops
  // being one.
  const roster = parseRoster(names, [], mixed);
  // Anything the engine would refuse is corruption here too, so a link with
  // three names in it opens the empty tool rather than throwing on mount.
  //
  // Roster size is not the whole of what the engine refuses. A Format has its
  // own arithmetic — an odd list in fixed partners leaves somebody with nobody
  // to partner — and the checksum is no help here, because it covers the names
  // block and the Format rides on the number line. Flipping that one character
  // by hand produces a payload that checksums perfectly and describes a board
  // that cannot be drawn.
  if (!isSupportedRosterSize(roster.length)) return null;

  // Brought inside what the Roster supports here rather than left to
  // `generateSchedule`, for the same reason a restored Config is: these
  // numbers are read again for the stale key and for the line naming what
  // the board was drawn from, and both have to be the numbers used.
  const numbersFor = resolveNumbers(
    roster.length,
    courts ?? undefined,
    rounds ?? undefined,
    format,
    partnershipSupply(roster, mixed),
  );

  if (formatObjection(roster, format) !== null) return null;
  // Mixed doubles has its own arithmetic and the checksum is no help with it
  // either: the markers are inside the names block it covers, but the flag
  // rides on the number line. Appending that one character by hand produces a
  // payload that checksums perfectly and asks for a board that cannot be
  // seated.
  if (mixedObjection(roster, numbersFor.courts, mixed) !== null) return null;

  return {
    config: { roster, seed, format, mixed, ...numbersFor },
    version,
    current: version === GENERATOR_VERSION,
  };
}

/**
 * A field of the payload as a number, or `undefined` when it is not there at
 * all. Empty is absence rather than zero, which `Number("")` would make it.
 * Everything else is handed to the shared reader to accept or refuse.
 */
function toNumber(field: string | undefined): number | undefined {
  if (field === undefined || field.trim() === "") return undefined;
  return Number(field);
}

/**
 * The Format field as a Format. Absent or empty is absence rather than
 * corruption, and absence is rotating; anything else has to be a code this
 * build mints, or the whole read is refused.
 */
function toFormat(field: string | undefined): Format | undefined {
  if (field === undefined || field.trim() === "") return DEFAULT_FORMAT;
  return FORMATS.find((format) => FORMAT_CODES[format] === field.trim());
}

/**
 * The mixed-doubles field as a flag. Absent or empty is off, which is every
 * link minted before this existed and every link minted for an ordinary
 * rotation since. Anything that is not the one code this build mints is
 * refused, for the reason `toFormat` gives.
 */
function toMixed(field: string | undefined): boolean | undefined {
  if (field === undefined || field.trim() === "") return false;
  return field.trim() === MIXED_CODE ? true : undefined;
}

/**
 * FNV-1a over the Roster block, in base 36 — six or seven characters to make
 * a truncated or hand-edited link unopenable.
 *
 * Not a security measure and nothing here pretends otherwise: anybody can mint
 * a link, which is the whole feature. This is only here to tell damage from a
 * board, and it is written out rather than imported because everything under
 * `lib/` has to resolve under plain `node --test` with no dependencies.
 */
function checksum(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}
