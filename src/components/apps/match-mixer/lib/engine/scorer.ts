import { pairsOf, resolveFormat } from "./format.ts";
import { markersOf, resolveMixed } from "./mixed.ts";
import { MARKERS } from "./types.ts";
import type {
  Config,
  FixedConfig,
  FixedScore,
  Format,
  Marker,
  PlayerIndex,
  RotatingConfig,
  RotatingScore,
  Round,
  Schedule,
  ScorerResult,
  SinglesConfig,
  SinglesScore,
  Tally,
} from "./types.ts";

/**
 * The Scorer: this context's definition of "fair". Nothing else in the app may
 * claim a Schedule is balanced — the summary line and the repeat marks in the
 * grid both read what this returns for the Schedule that was actually
 * produced.
 *
 * What "fair" means depends on the Format, so this asks a different question
 * of each. In rotating doubles it is partner repeats first, Bye imbalance
 * second, opponent repeats third. In fixed partners every partner repeat is
 * deliberate and counting them would report a Schedule that is exactly right
 * as a catastrophe, so the question becomes whether every Pairing has faced
 * every other and whether the team Byes come round evenly. In singles there
 * are no partners at all, so the whole verdict is what the opponent matrix
 * says: has anybody played the same person twice, and do the Byes rotate.
 *
 * That is why the Format reaches the Scorer at all rather than being handled
 * by the grid: a board in a Format the Scorer did not know about could only be
 * described by something else deciding what balance meant, and this is the one
 * place allowed to decide that.
 *
 * A change to the weights below changes what an existing Config generates —
 * the generator's search picks its winner by them — so it requires bumping
 * `GENERATOR_VERSION` in `persistence/share-link.ts`: a Share Link only
 * reproduces the board it named if the Scorer it drew from has not moved
 * under it (#494).
 */

/** A pair partnering more than once is the most visible failure, so it dominates. */
export const PARTNER_REPEAT_WEIGHT = 100;
/** Sitting out more often than everyone else is the second complaint. */
export const BYE_IMBALANCE_WEIGHT = 40;
/** Facing the same person a third time is noticeable but tolerable. */
export const OPPONENT_REPEAT_WEIGHT = 5;

/** A whist tournament has everyone opposing everyone exactly twice, so 2 is free. */
export const FREE_OPPONENT_MEETINGS = 2;

/**
 * The circling Formats: two units meeting again before every unit has met —
 * two Pairings in fixed partners, two Players in singles. It is their
 * equivalent of a partner repeat, the one thing the construction can get
 * wrong, so it is priced the same, and a board in either Format that costs
 * zero means the same thing a rotating one that costs zero means.
 */
export const REMATCH_WEIGHT = 100;

function matrix(n: number): number[][] {
  return Array.from({ length: n }, () => new Array<number>(n).fill(0));
}

export function emptyTally(n: number): Tally {
  return {
    partnerMatrix: matrix(n),
    opponentMatrix: matrix(n),
    gamesPlayed: new Array<number>(n).fill(0),
    byes: new Array<number>(n).fill(0),
  };
}

/**
 * Add one Round to a Tally, in place. This is the only place in the app that
 * counts who played with and against whom, so the generator guessing its next
 * move and the Scorer judging the finished Schedule cannot come to different
 * arithmetic.
 *
 * A side of one contributes nothing to the partner matrix, which is why a
 * singles board leaves it entirely at zero. That is a fact and not an omission:
 * there is nobody on the far side of a singles player to have partnered.
 */
export function recordRound(tally: Tally, round: Round): void {
  const bump = (grid: number[][], a: PlayerIndex, b: PlayerIndex) => {
    grid[a][b] += 1;
    grid[b][a] += 1;
  };

  for (const game of round.games) {
    const [sideA, sideB] = game.sides;
    for (const side of game.sides) {
      if (side.length === 2) bump(tally.partnerMatrix, side[0], side[1]);
    }
    for (const x of sideA) {
      for (const y of sideB) bump(tally.opponentMatrix, x, y);
    }
    for (const p of [...sideA, ...sideB]) tally.gamesPlayed[p] += 1;
  }
  for (const p of round.byes) tally.byes[p] += 1;
}

export function tallyRounds(rounds: readonly Round[], n: number): Tally {
  const tally = emptyTally(n);
  for (const round of rounds) recordRound(tally, round);
  return tally;
}

/**
 * The Scorer's reading of a drawn Schedule.
 *
 * The overloads exist so that a caller who already knows which Format it drew
 * in gets that Format's reading back, and a caller holding a Config whose
 * Format is only known at runtime gets the union and has to say which board it
 * is looking at before reading a verdict off it. The screen is the second kind
 * and should be; a test that writes `{ roster, courts, seed }` is the first,
 * and asking it to narrow would be ceremony over a Format it named by omission.
 */
export function scoreSchedule(
  schedule: Schedule,
  config: RotatingConfig,
): RotatingScore;
export function scoreSchedule(
  schedule: Schedule,
  config: FixedConfig,
): FixedScore;
export function scoreSchedule(
  schedule: Schedule,
  config: SinglesConfig,
): SinglesScore;
export function scoreSchedule(schedule: Schedule, config: Config): ScorerResult;
export function scoreSchedule(schedule: Schedule, config: Config): ScorerResult {
  const format = resolveFormat(config.format);
  return scoreRounds(
    schedule.rounds,
    config.roster.length,
    format,
    // A half-marked Roster never reaches a drawn Schedule — `mixedObjection`
    // refuses it at the entry point — so `null` here is a board that was not
    // asked to be mixed, and it reads as the ordinary rotating one.
    resolveMixed(format, config.mixed) ? markersOf(config.roster) : null,
  );
}

/**
 * The same reading, taken over bare Rounds. The generator scores its own
 * half-built attempts before there is a Roster or a Config to hand over, and
 * it has to be judged by exactly the function that judges the finished
 * Schedule rather than by a second opinion that might disagree.
 *
 * The Format defaults to rotating, which is both the Format every caller
 * predating Formats is in and the one the search still runs for.
 *
 * `markers` is the mixed-doubles constraint, and it changes two of the
 * answers: what the partnership supply is, and what an even share of the Byes
 * looks like. Absent or `null` is every board that is not mixed.
 */
export function scoreRounds(
  rounds: readonly Round[],
  n: number,
  format?: "rotating",
  markers?: readonly Marker[] | null,
): RotatingScore;
export function scoreRounds(
  rounds: readonly Round[],
  n: number,
  format: "fixed",
  markers?: readonly Marker[] | null,
): FixedScore;
export function scoreRounds(
  rounds: readonly Round[],
  n: number,
  format: "singles",
): SinglesScore;
export function scoreRounds(
  rounds: readonly Round[],
  n: number,
  format?: Format,
  markers?: readonly Marker[] | null,
): ScorerResult;
export function scoreRounds(
  rounds: readonly Round[],
  n: number,
  format: Format = "rotating",
  markers: readonly Marker[] | null = null,
): ScorerResult {
  const tally = tallyRounds(rounds, n);
  const byes = byeVerdict(tally, n, markers);

  if (format === "fixed") return scoreFixed(tally, n, byes);
  if (format === "singles") return scoreSingles(tally, n, byes);
  return scoreRotating(tally, n, byes, markers);
}

/**
 * How evenly the night was shared out, which is the second thing every Format
 * cares about and means the same thing in all of them.
 *
 * Measured off games played rather than Byes counted, so a Schedule that seats
 * someone twice in one Round can't hide behind a tidy Bye list.
 *
 * It needs no variant in either of the other Formats. A Bye in fixed partners
 * belongs to a Pairing and both members of a sitting team sit, so every
 * Player's count is their team's count and the spread over Players is already
 * the spread over Pairings; the divisibility below comes out the same way,
 * since twice the team Byes over twice the teams is the same remainder as the
 * team Byes over the teams. In singles the unit that sits *is* a Player, so
 * there was never anything to convert.
 */
function byeVerdict(
  tally: Tally,
  n: number,
  markers: readonly Marker[] | null = null,
): { byeSpread: number; byesRotateEvenly: boolean } {
  const everyone = Array.from({ length: n }, (_, i) => i);
  if (!markers) return shareOver(tally, everyone);

  // A mixed Round seats `2c` of each marker, so the two sides take their Byes
  // from two separate queues: with ten M and six F on three courts, no F ever
  // sits and four M do every Round. Measured across the whole Roster that
  // reads as a broken rotation, and it is not one — it is the only rotation
  // those counts allow. What the organizer can be let down by is somebody
  // sitting out more often than the others *of their own side*, so that is
  // what is asked, once per side.
  const sides = MARKERS.map((marker) =>
    shareOver(
      tally,
      everyone.filter((player) => markers[player] === marker),
    ),
  );

  return {
    byeSpread: Math.max(...sides.map((side) => side.byeSpread)),
    byesRotateEvenly: sides.every((side) => side.byesRotateEvenly),
  };
}

/**
 * How evenly one group of Players shared the night, which is the whole of the
 * Bye verdict for an unmixed board and half of it for a mixed one.
 *
 * Byes divide among a group like anything else: when the total does not go
 * round exactly, somebody has to take one more than somebody else. That is
 * arithmetic rather than a flaw, so it still counts as rotating evenly, and
 * this is the only place allowed to decide that.
 */
function shareOver(
  tally: Tally,
  group: readonly PlayerIndex[],
): { byeSpread: number; byesRotateEvenly: boolean } {
  if (group.length === 0) return { byeSpread: 0, byesRotateEvenly: true };

  const played = group.map((player) => tally.gamesPlayed[player]);
  const byeSpread = Math.max(...played) - Math.min(...played);
  const totalByes = group.reduce((sum, player) => sum + tally.byes[player], 0);
  const byesRotateEvenly =
    totalByes % group.length === 0 ? byeSpread === 0 : byeSpread <= 1;

  return { byeSpread, byesRotateEvenly };
}

/**
 * Fixed partners: has every Pairing faced every other, and did the team Byes
 * come round evenly. The partner counts are left alone deliberately — they are
 * all repeats by construction, and there is nothing to report about a thing
 * that was asked for.
 *
 * The meetings are counted off the Games rather than off the opponent matrix,
 * because that matrix counts Players facing Players and would read one meeting
 * as four. Two Pairings met once, and once is what has to be counted for
 * "before any rematch" to mean anything.
 */
function scoreFixed(
  tally: Tally,
  n: number,
  { byeSpread, byesRotateEvenly }: ReturnType<typeof byeVerdict>,
): FixedScore {
  const teams = pairsOf(n);
  const t = teams.length;
  const meetingMatrix = matrix(t);

  for (let i = 0; i < t; i++) {
    for (let j = i + 1; j < t; j++) {
      // Two Pairings met as many times as they share a Game, which the partner
      // matrix already records once per side: a Player of i faced a Player of
      // j in that Game, four times over.
      const met = tally.opponentMatrix[teams[i][0]][teams[j][0]];
      meetingMatrix[i][j] = met;
      meetingMatrix[j][i] = met;
    }
  }

  const meetings = readMeetings(meetingMatrix, t);

  return {
    format: "fixed",
    cost: meetings.cost + byeSpread * BYE_IMBALANCE_WEIGHT,
    ...tally,
    teams,
    meetingMatrix,
    ...meetings.counts,
    meetingsPossible: Math.max(0, (t * (t - 1)) / 2),
    byeSpread,
    byesRotateEvenly,
  };
}

/**
 * Singles: has anybody played the same person twice, and did the Byes come
 * round evenly. That is the whole of it, because there is nothing else on a
 * singles board to get wrong.
 *
 * The meetings are read straight off the opponent matrix rather than out of a
 * matrix of its own, which is the one place singles is simpler than fixed
 * partners: there a meeting is between Pairings and the opponent matrix counts
 * one of them four times, so it has to be collapsed. Here the unit that meets
 * is the Player, so `opponentMatrix[i][j]` is already the count.
 *
 * The partner counts are left alone, and they are all zero. Nothing here reads
 * them and nothing should: a reader that took `maxPartnerCount` off a singles
 * board would get a truthful 0 and draw a conclusion from it about partnering
 * that a singles night does not have an opinion on, which is exactly why the
 * Scorer returns a union rather than one shape with the unused fields left in.
 */
function scoreSingles(
  tally: Tally,
  n: number,
  { byeSpread, byesRotateEvenly }: ReturnType<typeof byeVerdict>,
): SinglesScore {
  const meetings = readMeetings(tally.opponentMatrix, n);

  return {
    format: "singles",
    cost: meetings.cost + byeSpread * BYE_IMBALANCE_WEIGHT,
    ...tally,
    ...meetings.counts,
    // Floored at zero for the same reason rotating's supply is: an empty
    // Roster works out at -0, which prints as "-0" in the summary line.
    meetingsPossible: Math.max(0, (n * (n - 1)) / 2),
    byeSpread,
    byesRotateEvenly,
  };
}

/**
 * What a symmetric matrix of meeting counts says: how many distinct meetings
 * happened, how many happened more than once, the worst of them, and what the
 * repeats cost.
 *
 * Shared by the two Formats that circle, which count the same noun over
 * different units — Pairings in fixed partners, Players in singles. Sharing it
 * is what keeps a rematch priced identically in both, which is the claim that
 * `cost === 0` means the same thing on every board rests on.
 */
function readMeetings(
  meetings: readonly number[][],
  units: number,
): {
  cost: number;
  counts: {
    repeatedMeetings: number;
    maxMeetingCount: number;
    meetingsPlayed: number;
  };
} {
  let cost = 0;
  let repeatedMeetings = 0;
  let maxMeetingCount = 0;
  let meetingsPlayed = 0;

  for (let i = 0; i < units; i++) {
    for (let j = i + 1; j < units; j++) {
      const met = meetings[i][j];
      maxMeetingCount = Math.max(maxMeetingCount, met);
      // Counted per pair rather than per meeting, so a rematch adds to the
      // failure without also inflating how much of the room has met.
      if (met > 0) meetingsPlayed += 1;
      if (met > 1) {
        repeatedMeetings += 1;
        cost += (met - 1) * REMATCH_WEIGHT;
      }
    }
  }

  return { cost, counts: { repeatedMeetings, maxMeetingCount, meetingsPlayed } };
}

function scoreRotating(
  tally: Tally,
  n: number,
  { byeSpread, byesRotateEvenly }: ReturnType<typeof byeVerdict>,
  markers: readonly Marker[] | null = null,
): RotatingScore {
  const { partnerMatrix, opponentMatrix } = tally;

  let cost = 0;
  let repeatedPartnerPairs = 0;
  let maxPartnerCount = 0;
  let maxOpponentCount = 0;
  let pairingsPlayed = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const partnered = partnerMatrix[i][j];
      const opposed = opponentMatrix[i][j];
      maxPartnerCount = Math.max(maxPartnerCount, partnered);
      maxOpponentCount = Math.max(maxOpponentCount, opposed);
      // Counted per pair rather than per partnership, so a repeat adds to the
      // failure above without also inflating how much of the room has met.
      if (partnered > 0) pairingsPlayed += 1;
      if (partnered > 1) {
        repeatedPartnerPairs += 1;
        cost += (partnered - 1) * PARTNER_REPEAT_WEIGHT;
      }
      if (opposed > FREE_OPPONENT_MEETINGS) {
        cost += (opposed - FREE_OPPONENT_MEETINGS) * OPPONENT_REPEAT_WEIGHT;
      }
    }
  }

  cost += byeSpread * BYE_IMBALANCE_WEIGHT;

  return {
    format: "rotating",
    cost,
    ...tally,
    repeatedPartnerPairs,
    maxPartnerCount,
    maxOpponentCount,
    pairingsPlayed,
    // Floored at zero because an empty Roster works out at -0, which prints as
    // "-0" the moment the summary line interpolates it.
    //
    // A mixed board has `M × F` partnerships and not the whole triangle: a
    // same-marker pair is one this night can never draw, so counting it in
    // the total would leave a board that has played every partnership it has
    // reporting itself short of one it never could.
    pairingsPossible: markers
      ? markers.filter((marker) => marker === "M").length *
        markers.filter((marker) => marker === "F").length
      : Math.max(0, (n * (n - 1)) / 2),
    byeSpread,
    byesRotateEvenly,
  };
}
