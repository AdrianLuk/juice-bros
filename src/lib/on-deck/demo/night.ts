/**
 * The demo night's Session log (issue #519).
 *
 * `/on-deck/demo` folds a whole club night in the browser so somebody who has
 * never heard of On Deck can tap "Court N done" and watch the next foursome
 * get called, with no account, no Club and no database (issue #512). There is
 * no real log to replay — nobody has ever run a night on this — so this one is
 * **authored**: the arrivals and the turnovers are written here, and every
 * *selection* in it is produced by Match Me through `reduceSession`, not
 * invented. What the demo opens on is therefore a real fold of a real log, and
 * a bug it shows is a bug in the Floor.
 *
 * Same relative-imports-only, no-React, no-`server-only`, no-`@/` rule as
 * `../session/` (see `types.ts`): the log has to fold under `node --test`, and
 * nothing about it may drag a Supabase client into the demo route's import
 * graph.
 *
 * ## Shape of the night
 *
 * 64 minutes in, on five Courts. Everybody who is coming has arrived: 40
 * Players, 20 of them on a Court, 8 committed to the two On Deck Foursomes,
 * and 12 waiting — a Queue deep enough that who walks on next is visibly a
 * decision rather than the only four left. Two things happened earlier that a
 * real night has and a canned screenshot doesn't: somebody was called and
 * didn't appear (swapped out, then turned up and re-queued), and three Players
 * asked to play together.
 *
 * The event times are written relative to "now", so the board opens with
 * plausible Wait Times whenever it is loaded. The relative script is built
 * once per process and re-stamped — the fold's selections depend on the
 * *order* and the *gaps* between events, never on the absolute clock, so
 * shifting every `at` by the same offset yields the identical night.
 */

import { fakePlayer } from "../dev-players.ts";
import { rotationViewFrom, type RotationView } from "../session/rotation-view.ts";
import type {
  Operator,
  SessionConfig,
  SessionEvent,
  SessionState,
} from "../session/types.ts";
import { demoLoadedSession } from "./fold.ts";

const MIN = 60_000;
const SEC = 1_000;

/** The demo's Session id — never a real one; nothing reads it but the fold. */
export const DEMO_SESSION_ID = "demo-session";
export const DEMO_CLUB_ID = "demo-club";

/**
 * The Club the demo night is run by. Five Courts and a group cap of four are
 * On Deck's own defaults; the venue is invented, like everybody in the Queue.
 */
export const DEMO_CONFIG: SessionConfig = {
  sessionId: DEMO_SESSION_ID,
  clubId: DEMO_CLUB_ID,
  venueName: "Riverbend Community Centre",
  courtCount: 5,
  groupCap: 4,
  floorMode: "hybrid",
  seed: "on-deck-demo-night",
};

/** Everybody who turns up over the course of the demo night. */
export const DEMO_PLAYER_COUNT = 40;

/**
 * The opening state the demo claims, asserted in `night.test.ts` against the
 * actual fold. Written down here rather than left implicit because the whole
 * point of the exercise is that the board's first screen is checked, not
 * hoped for.
 */
export const DEMO_OPENING = {
  /** Every Court in play — an organizer arriving mid-night, not an empty gym. */
  courtsOccupied: 5,
  /** Both On Deck Foursomes committed and full. */
  onDeckFoursomes: 2,
  /** Waiting Players not already committed to an On Deck Foursome. */
  queuedCount: 12,
  /** Games already finished — the Variety history Match Me is scoring against. */
  minCompletedGames: 12,
} as const;

const ORGANIZER: Operator = { kind: "organizer", userId: "demo-organizer" };
const PLAYER: Operator = { kind: "player" };

/** The demo's device token for the `n`th Player (1-based), matching `fakePlayer`. */
function demoToken(n: number): string {
  return `demo-player-${n}`;
}

/**
 * When the night started, relative to "now". Long enough that Wait Times read
 * like a real mid-evening board and short enough that no Court trips the
 * idle-court nudge.
 */
const STARTED_AT = -64 * MIN;

/** When the Organizer sent the first five Foursomes out. */
const FIRST_SEATING_AT = -54 * MIN;

/** Courts stop turning over this long before "now", so every Court is mid-Game. */
const LAST_TURNOVER_BY = -3 * MIN;

/**
 * How long each Game runs, cycled per turnover. Real games to 11 land between
 * ten minutes and a quarter of an hour; the spread is what staggers the Courts
 * so they don't all finish together.
 */
const GAME_MINUTES = [12, 14, 11, 15, 13, 10, 13, 12, 16, 11] as const;

/** A Player joining from their own phone, then tapping into the Queue. */
function arrival(n: number, joinedAt: number): SessionEvent[] {
  const { firstName, lastInitial, skillLevel } = fakePlayer(n - 1);
  const token = demoToken(n);
  return [
    {
      type: "PLAYER_JOINED",
      at: joinedAt,
      operator: PLAYER,
      token,
      firstName,
      lastInitial,
      skillLevel,
    },
    { type: "PLAYER_QUEUED", at: joinedAt + 25 * SEC, operator: PLAYER, token },
  ];
}

/**
 * Who is on Court `court`, and who is longest-waiting, at the point the log has
 * reached. Folding mid-build is what keeps the authored events *honest*: a
 * no-show can only be swapped out of a Foursome Match Me actually seated.
 */
function foldSoFar(
  events: SessionEvent[],
  upTo: number,
): { state: SessionState; view: RotationView } {
  // Sorted, not just filtered: the fold is order-sensitive, and the script is
  // assembled in blocks that each cover a different stretch of the evening.
  const loaded = demoLoadedSession(
    DEMO_CONFIG,
    events.filter((e) => e.at <= upTo).sort((a, b) => a.at - b.at),
  );
  return { state: loaded.state, view: rotationViewFrom(loaded, undefined, upTo) };
}

/**
 * Build the night once, with every `at` relative to "now" (all negative). The
 * turnover schedule is a straight simulation of five Courts each playing a
 * Game of `GAME_MINUTES` length: whichever Court is due next gets the
 * "Court N done" tap, and the fold decides who walks on.
 */
function buildScript(): SessionEvent[] {
  const events: SessionEvent[] = [
    { type: "SESSION_STARTED", at: STARTED_AT, operator: ORGANIZER },
  ];

  // ── The early crowd: 24 Players in the first eight minutes, so there is a
  //    full board plus a Queue the moment the first Courts go out.
  const EARLY = 24;
  for (let n = 1; n <= EARLY; n++) {
    events.push(...arrival(n, STARTED_AT + 30 * SEC + (n - 1) * 20 * SEC));
  }

  // ── "Send next four", five times: the Organizer fills the empty Courts.
  //    A `COURT_FINISHED` on an empty Court carries no Game — it just seats.
  for (let court = 1; court <= DEMO_CONFIG.courtCount; court++) {
    events.push({
      type: "COURT_FINISHED",
      at: FIRST_SEATING_AT + (court - 1) * 20 * SEC,
      operator: ORGANIZER,
      court,
    });
  }

  // ── The late crowd: the other 16 trickle in over the next half hour, which
  //    is what keeps the Queue growing while Courts turn over.
  const lateArrivals: SessionEvent[] = [];
  for (let n = EARLY + 1; n <= DEMO_PLAYER_COUNT; n++) {
    lateArrivals.push(...arrival(n, -52 * MIN + (n - EARLY - 1) * 2 * MIN));
  }

  // ── The turnovers. Each Court's Game is scheduled forward from when it was
  //    seated; the earliest-due Court is tapped next.
  const dueAt = new Map<number, number>();
  for (let court = 1; court <= DEMO_CONFIG.courtCount; court++) {
    dueAt.set(court, FIRST_SEATING_AT + (court - 1) * 20 * SEC + GAME_MINUTES[court - 1] * MIN);
  }

  const turnovers: SessionEvent[] = [];
  let round = 0;
  for (;;) {
    let next = 1;
    for (let court = 2; court <= DEMO_CONFIG.courtCount; court++) {
      if (dueAt.get(court)! < dueAt.get(next)!) next = court;
    }
    const at = dueAt.get(next)!;
    if (at > LAST_TURNOVER_BY) break;
    turnovers.push({ type: "COURT_FINISHED", at, operator: ORGANIZER, court: next });
    round += 1;
    dueAt.set(next, at + GAME_MINUTES[round % GAME_MINUTES.length] * MIN);
  }

  // Arrivals and turnovers interleave in real time, and the fold is
  // order-sensitive — merge them by `at` rather than appending one block after
  // the other. A stable sort keeps a Player's join ahead of their own queue tap.
  const middle = [...lateArrivals, ...turnovers].sort((a, b) => a.at - b.at);
  events.push(...middle);

  events.push(...noShowAndReturn(events));
  events.push(...queueTogether(events));

  return events.sort((a, b) => a.at - b.at);
}

/**
 * Somebody got called and wasn't there. The Organizer swapped in whoever Match
 * Me suggested, and the missing Player turned up four minutes later and went
 * back in the Queue at the wait they'd banked.
 *
 * Both events are derived from the fold at the moment they happen — the Player
 * swapped out is really on that Court, and the replacement is really waiting.
 */
function noShowAndReturn(events: SessionEvent[]): SessionEvent[] {
  const swapAt = -28 * MIN;
  const { state: before, view } = foldSoFar(events, swapAt);

  // The Court that most recently turned over — its Foursome was called within
  // the last few minutes, which is when a no-show is noticed.
  const court = [...before.courts]
    .filter((c) => c.foursome.length === 4 && c.since !== null)
    .sort((a, b) => (b.since ?? 0) - (a.since ?? 0))[0];
  const replacement = view.courts.find((c) => c.number === court?.number)
    ?.suggestedReplacement;
  if (!court || !replacement) return [];

  const inToken = before.roster.find((p) => p.displayName === replacement)?.id;
  // The last of the four called is the one who wandered off to the water
  // fountain; anybody on the Court would do.
  const outToken = court.foursome[court.foursome.length - 1];
  if (!inToken || !outToken) return [];

  return [
    {
      type: "FOURSOME_MEMBER_SWAPPED",
      at: swapAt,
      operator: ORGANIZER,
      court: court.number,
      out: outToken,
      in: inToken,
    },
    {
      type: "PLAYER_REQUEUED",
      at: swapAt + 4 * MIN,
      operator: ORGANIZER,
      token: outToken,
    },
  ];
}

/**
 * Three friends asked to play together. Formed after the last turnover so the
 * Group is still in the Queue when the demo opens — a Queue Together Group
 * sitting at its members' median wait is the part of the order people argue
 * about, so the demo should show one rather than describe it.
 *
 * The members are picked from the middle of the waiting list, past whoever is
 * already committed to an On Deck Foursome: grouping must not look like a way
 * to jump the line, and it must not reshuffle a Foursome already announced.
 */
function queueTogether(events: SessionEvent[]): SessionEvent[] {
  const formedAt = -6 * MIN;
  const { state: before, view } = foldSoFar(events, formedAt);

  const members = view.waitingNames.slice(7, 10);
  if (members.length < 3) return [];
  const memberTokens = members
    .map((name) => before.roster.find((p) => p.displayName === name)?.id)
    .filter((id): id is string => typeof id === "string");
  if (memberTokens.length < 3) return [];

  return [
    {
      type: "GROUP_FORMED",
      at: formedAt,
      operator: ORGANIZER,
      groupId: "demo-group-1",
      memberTokens,
    },
  ];
}

let script: SessionEvent[] | null = null;

/**
 * The demo night's event log, stamped against `now`. Building the relative
 * script folds the log a few times to keep the authored events honest, so it
 * is done once and re-stamped on every call.
 */
export function demoNightEvents(now: number): SessionEvent[] {
  script ??= buildScript();
  return script.map((event) => ({ ...event, at: event.at + now }));
}
