import { maxCourts } from "./engine/config.ts";
import {
  describeConfig,
  describeNumbers,
  describePooledConfig,
  describeUnsupportedRoster,
  type ConfigShape,
} from "./engine/describe.ts";
import {
  countMarkers,
  mixedCourtDefault,
  partnershipSupply,
  resolveMixed,
  rosterLine,
  type MarkerCounts,
} from "./engine/mixed.ts";
import {
  boardObjection,
  declaredPools,
  drawPools,
  isSupportedBoardSize,
  MAX_BOARD_SIZE,
  planDeclaredPools,
  planPools,
  resolveBoard,
  resolvePools,
  type BoardConfig,
  type DeclaredPool,
  type Pool,
} from "./engine/pools.ts";
import {
  duplicateNames,
  parsePoolHeaders,
  parseRoster,
  rosterText,
  type PoolHeader,
} from "./engine/roster.ts";
import {
  DEFAULT_FORMAT,
  MIN_ROSTER_SIZE,
  type Format,
  type Roster,
} from "./engine/types.ts";
import type {
  EditedConfig,
  SavedVisit,
} from "./persistence/config-storage.ts";
import type { SharedBoard } from "./persistence/share-link.ts";

/**
 * Match Mixer's board editor: everything the screen holds, as one value, and
 * every way of changing it, as a pure function from one value to the next.
 *
 * Plain state rather than an event log (ADR 0001). The transitions are named
 * functions rather than a reducer over an action union, because an action
 * union reads as the start of the log that ADR forbids: there is nothing here
 * a log would record that the Config does not already say.
 *
 * The component holds one of these and renders it. Everything that touches
 * the browser — the address bar, storage, the debounce, the clock that rolls a
 * Seed — stays out there as a thin adapter, so what is in here runs under
 * `node --test` and has to keep to relative imports to do it.
 */

/** What the Schedule on screen was drawn from, kept beside it. */
export interface Draw {
  /**
   * The whole Config it came from, held rather than just its outputs. The
   * names matter because the engine works in positions, so a Schedule only
   * means anything beside the Roster it was generated against; the Seed
   * matters because it is what lets the same board be generated again after a
   * reload instead of stored (ADR 0001).
   */
  readonly config: BoardConfig;
  /** The Roster and numbers it came from, for telling current from stale. */
  readonly key: string;
  /** The numbers it was drawn from, for the flag over a stale board. */
  readonly numbers: string;
  /**
   * What was drawn: one Pool on an ordinary board, several side by side on a
   * dealt one. Each carries its own Schedule and its own Scorer reading, and
   * nothing here combines them.
   */
  readonly pools: readonly Pool[];
  /**
   * Whether this board came off a Share Link minted under an older Generator
   * Version. It sticks to this particular draw rather than to the screen, so
   * it clears the moment the board is actually redrawn — pressing the button
   * makes a current board, whatever it was opened from.
   */
  readonly outdated: boolean;
}

/**
 * A cleared Roster, held only in memory. The text and the parsed entries both,
 * so that putting it back restores the ids as well as the names and a Player
 * comes back as the same Player.
 */
export interface ClearedRoster {
  readonly text: string;
  readonly roster: Roster;
}

/** Everything the screen holds. */
export interface EditorState {
  readonly text: string;
  /**
   * The Roster is kept beside the text rather than derived from it, because
   * parsing has to see the previous entries to hand a corrected or reordered
   * line back its existing id.
   */
  readonly roster: Roster;
  /**
   * Null means "whatever this Roster suggests", so the fields keep following
   * the names being pasted until the organizer overrules them.
   */
  readonly courts: number | null;
  readonly rounds: number | null;
  /**
   * The Format is not nullable the way the two numbers are: they follow the
   * Roster until overruled, and a Format has nothing to follow. Rotating is a
   * selection made on the organizer's behalf before they arrive.
   */
  readonly format: Format;
  /**
   * Whether every team has to come out one M and one F. A qualifier on
   * rotating rather than a Format of its own, so it is held beside the row
   * rather than inside it.
   */
  readonly mixed: boolean;
  /**
   * How many Pools to deal the Roster into. A choice like the Format rather
   * than a number that follows the Roster: one until the organizer says
   * otherwise, and clamped to what the Roster can make wherever it is read.
   */
  readonly pools: number;
  readonly draw: Draw | null;
  /**
   * Whether the saved Config has been read yet, which is only ever asked so
   * that saving cannot start before loading has finished. The screen itself
   * does not wait on it: the example board is server-rendered and stays until
   * there is something truer to put in its place.
   */
  readonly restored: boolean;
  /**
   * What the box held before Clear emptied it, kept for as long as it stays
   * empty rather than for a few seconds: an organizer who looks up from the
   * court a minute later should still find the way back.
   */
  readonly cleared: ClearedRoster | null;
  /**
   * The board a link put on screen, as the signature of the screen showing it,
   * or null when nothing was borrowed. While the screen still matches, the
   * board belongs to somebody else and nothing is written: most people who
   * open a link are players rather than organizers, and some of them keep
   * their own club list in this same browser.
   *
   * Held as the signature rather than as a flag that every transition has to
   * remember to clear. There are six ways to edit this screen and a seventh
   * that forgot would quietly write a stranger's roster over the reader's own;
   * comparing what is on screen, once, in `settle`, cannot be forgotten by a
   * transition that does not know it exists.
   */
  readonly borrowed: string | null;
  /**
   * Whether this tab has ever had a Roster in it, which decides whether its
   * empty box means anything. A tab left open on the zero state has nothing to
   * say about the save, and must not be the one that deletes it.
   */
  readonly held: boolean;
}

/** The screen before anything has been read: the zero state. */
export const EMPTY: EditorState = {
  text: "",
  roster: [],
  courts: null,
  rounds: null,
  format: DEFAULT_FORMAT,
  mixed: false,
  pools: 1,
  draw: null,
  restored: false,
  cleared: null,
  borrowed: null,
  held: false,
};

/** The seven inputs generation depends on, as the draw key reads them. */
type KeyedConfig = Pick<
  BoardConfig,
  "roster" | "courts" | "rounds" | "format" | "mixed" | "pools"
> & { readonly headers: readonly PoolHeader[] };

/**
 * Everything generation depends on. Ids are deliberately absent: the engine
 * sees names and numbers only, so typing a name back to what it was is not a
 * change and should not leave the board flagged as stale.
 *
 * The Format is in here because it is the one input that changes the board
 * without changing a single name or number. Without it, switching the row
 * would leave the previous Format's board on screen with nothing over it
 * saying so — which is the exact reading this key exists to prevent. Mixed
 * doubles is in here on the same argument, twice over: the box and the markers
 * on the lines both change the board, and one of them changes it while every
 * name stays where it was. So is the Pool count, which changes every seat on
 * the board without touching a name or a court.
 *
 * The Pool count is only written past one, so a one-Pool board keys exactly as
 * it did before Pools existed. The key is also half of a stored Selection's
 * board identity, and a Selection kept from last week should still find its
 * board. `board-editor.test.ts` pins the string for that reason: a new shape
 * would silently drop every stored Selection once.
 *
 * Headers are folded in too (ADR 0005), and for the same reason: moving a
 * `---` line can change every Pool's membership without adding, removing or
 * reordering a single Player, which `roster.map(rosterLine)` alone would not
 * notice. `label` and `start` are both in the string, so a relabelled or
 * reshuffled split reads as a different key even when the names line up.
 */
function drawKey({
  roster,
  courts,
  rounds,
  format,
  mixed,
  pools,
  headers,
}: KeyedConfig): string {
  const declared =
    headers.length > 0
      ? `+declared:${headers.map((h) => `${h.label ?? ""}@${h.start}`).join(",")}`
      : "";
  // The line as typed, joined on a newline because that is the one character
  // `parseRoster` will not leave inside a name. On a space, "Mary Ann / Bo"
  // and "Mary / Ann Bo" would key the same, and an edit between them would
  // never flag the board.
  return `${format}${mixed ? "+mixed" : ""}${pools > 1 ? `+${pools}pools` : ""}${declared}/${courts}/${rounds}/${roster.map(rosterLine).join("\n")}`;
}

/** Draws the board for a Config, whether it was just asked for or restored. */
function drawFrom(config: BoardConfig, outdated = false): Draw {
  const { roster, courts, rounds, format, mixed, pools, headers } = config;
  return {
    config,
    key: drawKey({
      roster,
      courts,
      rounds,
      format,
      mixed,
      pools,
      headers: headers ?? [],
    }),
    numbers: describeNumbers({
      players: roster.length,
      courts,
      rounds,
      format,
      mixed,
      pools,
    }),
    pools: drawPools(config),
    outdated,
  };
}

/** Everything the screen reads off the editor, worked out from it afresh. */
export interface Derived {
  readonly size: number;
  /** The Roster's own `---` headers, as typed. */
  readonly headers: readonly PoolHeader[];
  /** The declared split those headers make, or `null` when there are none. */
  readonly declared: DeclaredPool[] | null;
  /** The Pool count this Roster will be drawn with. */
  readonly pools: number;
  /** Whether there is a Roster to speak of at all at this Pool count. */
  readonly supported: boolean;
  /** Whether more than one Pool is in play, dealt or declared. */
  readonly poolish: boolean;
  readonly courtCeiling: number;
  /** Mixed doubles as it actually applies: only ever under rotating. */
  readonly mixing: boolean;
  /** What a mixed night can fill, for the court dial's note and default. */
  readonly mixedCeiling: number | undefined;
  /** The numbers the engine will actually use. */
  readonly courts: number;
  readonly rounds: number;
  readonly repeated: string[];
  readonly markers: MarkerCounts;
  readonly shape: ConfigShape;
  /** Why this Roster cannot be drawn like this, if it cannot. */
  readonly objection: string | null;
  readonly drawable: boolean;
  /** The consequence line, at every Roster size. */
  readonly consequence: string;
  /** The draw key of what the fields describe now. */
  readonly key: string;
  /** Whether the board on screen was drawn from something else. */
  readonly stale: boolean;
}

/**
 * The fast speed of the screen: pure arithmetic over the editor, run on every
 * keystroke so the numbers always describe what is in the box.
 */
export function derive(state: EditorState): Derived {
  const { roster, format, draw } = state;
  const size = roster.length;
  // The Roster's own declared split (ADR 0005): headers read off the box,
  // turned into ranges over this Roster. Present, it wins over the Pool count
  // everywhere below — the count is read only when this is `null`.
  const headers = parsePoolHeaders(state.text);
  const declared = headers.length > 0 ? declaredPools(size, headers) : null;
  // The Pool count this Roster will be drawn with: the declared split's own
  // count, or the choice brought inside what the names can make. Read before
  // anything else, because whether the Roster fits at all depends on it —
  // forty names is too many for one rotation and two Pools of twenty.
  const pools = declared ? declared.length : resolvePools(size, state.pools);
  // A declared split answers its own size question per Pool, further down in
  // `boardObjection` — this is only the coarse "is there a Roster to speak
  // of at all" gate that decides whether the fields render.
  const supported = declared
    ? size >= MIN_ROSTER_SIZE && size <= MAX_BOARD_SIZE
    : isSupportedBoardSize(size, pools);
  // The ceiling follows the Format, because a singles court seats two: the
  // field's maximum has to move as the row is switched, not only as names are
  // pasted, or a doubles court count would survive into a Format that could
  // have offered twice as many.
  const courtCeiling = maxCourts(size, format);
  // Mixed doubles applies to rotating and nothing else, so a Format that
  // cannot carry it drops it here as well as hiding the box: nothing below
  // this line has to remember the pairing is impossible.
  const mixing = resolveMixed(format, state.mixed);
  // How many partnerships this board has to spend, which mixed doubles cuts to
  // `M × F`. Read by the consequence line's supply clause and by the default
  // round count, both of which would otherwise count pairs the night can never
  // draw.
  const supply = partnershipSupply(roster, mixing);
  // What a mixed night can fill, for the court dial's note and its default.
  const mixedCeiling = mixedCourtDefault(roster, mixing);
  // The fields show what the engine will actually use, which is the same clamp
  // `generateSchedule` applies rather than a second opinion beside it. A null
  // choice is an untouched or emptied field, and means the default.
  //
  // Not memoized. It is four comparisons over primitives, and the manual
  // memoization it used to carry is the kind the React Compiler has to refuse
  // to preserve once one of the inputs is derived from the Roster.
  //
  // Past one Pool the courts default to what the Pools can fill, which the
  // pool layer works out; the mixed ceiling above is a whole-Roster figure and
  // says nothing about a Pool. A declared split works its own default out the
  // same way, off its own Pools rather than an even deal.
  const poolish = declared !== null || pools > 1;
  const { courts, rounds } = resolveBoard(
    roster,
    state.courts ?? (poolish ? undefined : mixedCeiling),
    state.rounds ?? undefined,
    format,
    mixing,
    pools,
    headers,
  );

  const shape: ConfigShape = {
    players: size,
    courts,
    rounds,
    format,
    mixed: mixing,
    partnerships: supply,
    pools,
  };
  // Why this Roster cannot be drawn like this, if it cannot. Asked here rather
  // than caught out of `generateSchedule`, because the answer is a sentence
  // the organizer can act on and it has to be on screen before the button is
  // pressed rather than instead of the board afterwards.
  //
  // Past one Pool every Pool answers for itself as well, and the message names
  // the one that could not be seated — a declared Pool's own composition, an
  // even deal otherwise.
  const objection = supported
    ? boardObjection(roster, format, mixing, pools, courts, headers)
    : null;
  // The consequence line stays on the screen at every Roster size, including
  // the sizes with no Config to describe: a Roster on its way to eleven names
  // passes through them, and going quiet there is going quiet exactly when the
  // organizer is least sure what they have. A Format that cannot seat this
  // Roster takes its place, because describing seats nobody can sit in would
  // be the more confident of the two wrong answers.
  const plan =
    supported && poolish
      ? declared
        ? planDeclaredPools(roster, format, mixing, declared, courts)
        : planPools(roster, format, mixing, pools, courts)
      : null;
  const consequence = !supported
    ? describeUnsupportedRoster(size)
    : (objection ??
      (plan ? describePooledConfig(shape, plan) : describeConfig(shape)));
  const key = drawKey({ roster, courts, rounds, format, mixed: mixing, pools, headers });

  return {
    size,
    headers,
    declared,
    pools,
    supported,
    poolish,
    courtCeiling,
    mixing,
    mixedCeiling,
    courts,
    rounds,
    repeated: duplicateNames(roster),
    markers: countMarkers(roster),
    shape,
    objection,
    drawable: supported && objection === null,
    consequence,
    key,
    stale: draw !== null && draw.key !== key,
  };
}

/**
 * The signature of the screen, for telling whether it is still the board a
 * link put there. Over exactly what a save would write — the Roster including
 * identity, the two field choices as choices, and the Seed of the board on
 * screen — so anything a save would record as different reads as different
 * here too.
 *
 * Not `drawKey`, which is deliberately blind to ids and to unmade choices
 * because its question is whether the board is stale. This one's question is
 * whether the reader has touched anything at all.
 */
function borrowKey(
  state: EditorState,
  headers: readonly PoolHeader[] = parsePoolHeaders(state.text),
): string {
  const { roster, courts, rounds, format, mixed, pools, draw } = state;
  const entries = roster.map((player) => `${player.id}=${rosterLine(player)}`);
  return [
    draw?.config.seed ?? "",
    courts ?? "",
    rounds ?? "",
    format,
    mixed ? "mixed" : "",
    pools,
    headers.map((h) => `${h.label ?? ""}@${h.start}`).join(","),
    ...entries,
  ].join("\n");
}

/**
 * What every transition passes its result through: the two save gates that
 * are about the screen rather than about any one edit. Run once per
 * transition, the way the save effect used to run once per render, so no
 * transition has to know either gate exists.
 */
function settle(state: EditorState): EditorState {
  // Nothing is decided before the saved Config has been read: deciding on an
  // empty screen would save it over the roster in the middle of being
  // restored.
  if (!state.restored) return state;
  // Somebody else's board is read, not kept. A player who opens a link and
  // happens to keep their own club list in this browser must find it exactly
  // where they left it, so nothing at all is written while the screen is
  // still the board the link put there. Changing anything — a name, a
  // number, a redraw — is how a reader says they are working on it now, and
  // it saves like any other visit from that point. The claim is for good:
  // typing the edit back out does not hand the board back.
  let next = state;
  if (next.borrowed !== null) {
    if (borrowKey(next) === next.borrowed) return next;
    next = { ...next, borrowed: null };
  }
  // While the undo is standing nothing is held or written; see `saveFor`.
  if (next.cleared) return next;
  // A tab that has never held a Roster has nothing to say about the save,
  // and an empty one saying it would delete the Roster another tab is in the
  // middle of keeping.
  if (!next.held && (next.roster.length > 0 || next.draw !== null)) {
    next = { ...next, held: true };
  }
  return next;
}

/** Where a restored screen came from. */
export type Source =
  /** A Share Link in the address bar, already decoded. */
  | { readonly from: "link"; readonly board: SharedBoard }
  /** This browser's own saved visit, or `null` when there is none. */
  | { readonly from: "visit"; readonly visit: SavedVisit | null };

/**
 * Puts a whole screen back, from a link or from storage. Both give up any
 * standing Clear: the list it would put back belongs to a screen that is no
 * longer the one showing.
 */
export function restore(state: EditorState, source: Source): EditorState {
  if (source.from === "link") {
    // A link beats storage, and beats it without reading it at all.
    const { config } = source.board;
    const linked: EditorState = {
      ...state,
      // The lines as they were typed, headers and all: a shared declared
      // split has to open declared, and a shared mixed board has to open as
      // a mixed board, so the box over it has to be ticked against a roster
      // that still says why.
      text: rosterText(config.roster, config.headers ?? []),
      roster: config.roster,
      courts: config.courts,
      rounds: config.rounds,
      format: config.format,
      mixed: config.mixed,
      pools: config.pools,
      // Generated again from the values the link carried rather than sent as
      // a grid, which is what ADR 0001's determinism was for. `!current` is
      // never a decode failure (#494): an unrecognised or future version
      // still draws, it just carries the notice over the board.
      draw: drawFrom(config, !source.board.current),
      restored: true,
      cleared: null,
    };
    // Signed over the headers the link carried rather than the ones read
    // back off the box, so the signature is of the board that arrived.
    return settle({
      ...linked,
      borrowed: borrowKey(linked, config.headers ?? []),
    });
  }

  // Written out even when there is nothing saved, because this also runs on
  // the way back off a link: leaving the borrowed board on screen while
  // calling it this browser's own is how it would end up in this browser's
  // storage.
  const { visit } = source;
  const edited: EditedConfig = visit?.edited ?? {
    roster: [],
    courts: null,
    rounds: null,
    format: DEFAULT_FORMAT,
    mixed: false,
    pools: 1,
    headers: [],
  };
  return settle({
    ...state,
    text: rosterText(edited.roster, edited.headers),
    roster: edited.roster,
    courts: edited.courts,
    rounds: edited.rounds,
    format: edited.format,
    mixed: edited.mixed,
    pools: edited.pools,
    // The board is generated again rather than stored, so what comes back is
    // the same board down to the seat every name sat in.
    draw: visit?.drawn ? drawFrom(visit.drawn) : null,
    restored: true,
    cleared: null,
    borrowed: null,
  });
}

/** What to write to storage, or `null` for "write nothing". */
export interface Save {
  readonly edited: EditedConfig;
  readonly drawn: BoardConfig | null;
}

/**
 * The save, as a value. `null` covers every reason the screen has to say
 * nothing: it has not been read back yet, it is still somebody else's board,
 * a Clear is waiting to be undone, or this tab has never held a Roster. The
 * caller owns only the writing: when, how often, and on the way out.
 */
export function saveFor(state: EditorState): Save | null {
  if (!state.restored) return null;
  if (state.borrowed !== null) return null;
  // While the undo is standing, the save is what backs it. Writing the empty
  // box over it would make Clear irreversible the moment the tab went away,
  // which is the mistake the undo is there for.
  if (state.cleared) return null;
  if (!state.held) return null;
  return {
    edited: {
      roster: state.roster,
      courts: state.courts,
      rounds: state.rounds,
      format: state.format,
      mixed: state.mixed,
      pools: state.pools,
      headers: parsePoolHeaders(state.text),
    },
    drawn: state.draw?.config ?? null,
  };
}

export function editRoster(state: EditorState, text: string): EditorState {
  return settle({
    ...state,
    text,
    roster: parseRoster(text, state.roster, resolveMixed(state.format, state.mixed)),
    // Typing gives up the cleared list. By then the board may have been drawn
    // from different names, and putting the old ones back beside it would be
    // offering to undo something that is no longer what happened.
    cleared: null,
  });
}

export function chooseCourts(state: EditorState, courts: number | null): EditorState {
  return settle({ ...state, courts });
}

export function chooseRounds(state: EditorState, rounds: number | null): EditorState {
  return settle({ ...state, rounds });
}

/** An emptied field means one Pool, the count's own default. */
export function choosePools(state: EditorState, pools: number | null): EditorState {
  return settle({ ...state, pools: pools ?? 1 });
}

/**
 * Ticking the box re-reads the roster box, because the same lines mean
 * something different under it: `Sarah M` is a name with a last initial
 * while it is off and a marked Sarah while it is on. Without the re-read
 * the constraint would be applied to a Roster parsed under the other
 * reading, and every line would look unmarked however carefully it was
 * typed.
 */
export function chooseMixed(state: EditorState, mixed: boolean): EditorState {
  return settle({
    ...state,
    mixed,
    roster: parseRoster(state.text, state.roster, resolveMixed(state.format, mixed)),
  });
}

/**
 * Draws the board the fields describe, with the Seed given. The caller rolls
 * the Seed, because a roll is not a pure thing to do; pressing the button
 * with nothing changed is a new Seed and nothing else, which is the whole of
 * what a fresh draw is (ADR 0001).
 */
export function generate(state: EditorState, seed: number): EditorState {
  const { declared, headers, courts, rounds, mixing, pools } = derive(state);
  return settle({
    ...state,
    draw: drawFrom({
      roster: state.roster,
      courts,
      rounds,
      format: state.format,
      mixed: mixing,
      pools,
      headers: declared ? headers : undefined,
      seed,
    }),
  });
}
