import {
  isSupportedRosterSize,
  resolveNumbers,
  type ResolvedConfig,
} from "../engine/config.ts";
import { parseRoster } from "../engine/roster.ts";
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
 * The payload is one line of numbers followed by the Roster, one name per
 * line. Newline is the separator because it is the one character `parseRoster`
 * will not leave inside a name — the same argument the stale-board key makes.
 *
 * A future field is appended to the number line, never inserted, and an absent
 * one reads as its default. That is what keeps a link minted today valid once
 * RR-6 adds Pool Count.
 *
 * The number line ends with the Roster size, which is the one thing in the
 * payload that is already implied by the rest of it. It is there because a
 * truncated link is the failure this transport actually has — a chat client
 * that autolinks half a URL, an address bar that loses the tail — and without
 * it a link cut after the sixth of twelve names decodes cleanly into a
 * six-player board that a reader has no way to tell from the real one. A count
 * is a weak checksum, and the weakest one that catches that.
 */
const LINE = "\n";
const FIELD = ".";

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

  const numbers = [
    GENERATOR_VERSION,
    config.courts,
    config.rounds,
    config.seed,
    config.roster.length,
  ].join(FIELD);
  const payload = [numbers, ...config.roster.map((player) => player.name)].join(
    LINE,
  );

  url.hash = "";
  url.searchParams.set(SHARE_PARAM, payload);

  const link = url.toString();
  return link.length > MAX_LINK_LENGTH ? null : link;
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

  const [numbers = "", ...names] = value.split(LINE);
  const [rawVersion, rawCourts, rawRounds, rawSeed, rawSize] =
    numbers.split(FIELD);

  // Required. A payload that cannot say which generator drew it, with what
  // Seed, or over how many people does not describe a board — it describes
  // some other board.
  const version = toNumber(rawVersion);
  const seed = toNumber(rawSeed);
  const size = toNumber(rawSize);
  if (!isFiniteNumber(version) || !isFiniteNumber(seed)) return null;
  if (!isFiniteNumber(size)) return null;

  // Optional. Absent reads as the default for this Roster; present but not a
  // number is corruption, and the whole read is refused.
  const courts = readChoice(toNumber(rawCourts));
  const rounds = readChoice(toNumber(rawRounds));
  if (courts === undefined || rounds === undefined) return null;

  const roster = parseRoster(names.join("\n"));
  // Short of what the payload says it carries: the link lost its tail on the
  // way through a chat client, and the board it would draw is not the board
  // that was shared.
  if (roster.length !== size) return null;
  // Anything the engine would refuse is corruption here too, so a link with
  // three names in it opens the empty tool rather than throwing on mount.
  if (!isSupportedRosterSize(roster.length)) return null;

  return {
    // Brought inside what the Roster supports here rather than left to
    // `generateSchedule`, for the same reason a restored Config is: these
    // numbers are read again for the stale key and for the line naming what
    // the board was drawn from, and both have to be the numbers used.
    config: {
      roster,
      seed,
      ...resolveNumbers(
        roster.length,
        courts ?? undefined,
        rounds ?? undefined,
      ),
    },
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
