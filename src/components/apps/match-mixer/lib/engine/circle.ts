import { seating } from "./random.ts";
import type { Game, PlayerIndex, Round, Side } from "./types.ts";

/**
 * The circle method, and the packing that turns it into Rounds.
 *
 * Two Formats are built on it and they differ only in what a side is. Fixed
 * partners circles `n / 2` Pairings, each of which takes both its Players to
 * a court; singles circles `n` Players, each of which is a side on its own.
 * Everything else — every unit meets every other exactly once, a ghost for an
 * odd count, the Byes arriving already rotating, a court left idle rather than
 * filled with a rematch — is the same construction and lives here once.
 *
 * It is written over Sides rather than over an abstract "unit" so that there
 * is nothing to translate at the end: whatever the caller circles is already
 * the thing that goes on a name plate.
 *
 * This is a construction and not a search, which is ADR 0003's argument for
 * why neither Format reaches the rotating generator. It is also why neither
 * reaches `findTable`: every stored Table is a whist tournament, and ADR
 * 0002's guarantee about its prefixes is a claim about rotating doubles.
 *
 * A change here changes what an existing fixed-partner or singles Config
 * generates, so it requires bumping `GENERATOR_VERSION` in
 * `persistence/share-link.ts`, on the same rule that governs `generator.ts`,
 * `tables.ts` and `scorer.ts`.
 */

/** Two units meeting, by position in the unit list. */
export type Meeting = readonly [number, number];

/** What the construction needs: the sides to circle, and the night's numbers. */
export interface CircleSpec {
  /** The units that rotate, in Roster order. A Pairing, or a lone Player. */
  readonly units: readonly Side[];
  readonly courts: number;
  readonly rounds: number;
  readonly seed: number;
}

/**
 * Every meeting between `t` units, in circle-method order: rounds of disjoint
 * pairings in which every unit meets every other exactly once.
 *
 * An odd `t` plays a ghost, and whoever draws it sits that circle round out —
 * which is how the Byes arrive already rotating rather than needing a rule of
 * their own.
 *
 * Returned flat rather than grouped, because a Round is `courts` games and a
 * circle round is `floor(t / 2)`, and those are only the same number when the
 * club has exactly enough courts. What the grouping is worth — that any
 * prefix of it is spread evenly over the units — survives the flattening,
 * which is what lets the packing below just walk it in order.
 */
export function circleMeetings(t: number): Meeting[] {
  if (t < 2) return [];

  // An odd count gets a ghost to pair against, sitting out whoever draws it.
  const size = t % 2 === 0 ? t : t + 1;
  const ghost = t % 2 === 0 ? -1 : size - 1;
  const ring = Array.from({ length: size }, (_, i) => i);

  const meetings: Meeting[] = [];
  for (let round = 0; round < size - 1; round++) {
    for (let i = 0; i < size / 2; i++) {
      const a = ring[i];
      const b = ring[size - 1 - i];
      if (a !== ghost && b !== ghost) meetings.push([a, b]);
    }
    // Position 0 is the hub and stays put; the rest turn by one.
    ring.splice(1, 0, ring.pop() as number);
  }
  return meetings;
}

/**
 * The Rounds for a Config whose Format circles. Deterministic in `seed`, like
 * every other path through the engine, so the board can be rebuilt from its
 * Config rather than stored (ADR 0001).
 *
 * The Seed decides which unit takes each position in the circle, and nothing
 * else. In fixed partners the pairs are the organizer's and a redraw must
 * never move them; in singles there is nothing to move in the first place.
 * What a redraw moves is which unit meets which first, which is the whole of
 * what there is to vary here. Relabeling the units in a circle tournament
 * permutes its meetings along with them and leaves the construction alone —
 * the same argument `tablePrefix` makes about seating a Table.
 */
export function generateCircleRounds(spec: CircleSpec): Round[] {
  const { units } = spec;
  const t = units.length;

  // A single unit has nobody to play. Unreachable from a supported Roster —
  // four names make two Pairings or four singles players — and cheaper to
  // answer than to rule out below.
  if (t < 2) return [];

  const order = seating(t, spec.seed);
  const everyMeeting: Meeting[] = circleMeetings(t).map(([a, b]) => [
    order[a],
    order[b],
  ]);

  // Consumed as the night goes on. When it empties, every unit has met every
  // other and there is nothing left that is not a rematch, so it refills and
  // the rotation runs again — which is the honest answer to a Round count past
  // the natural length, the same one the rotating generator gives.
  const fresh: Meeting[] = [...everyMeeting];
  const played = new Array<number>(t).fill(0);

  const rounds: Round[] = [];
  for (let round = 0; round < spec.rounds; round++) {
    rounds.push(buildRound(spec.courts, units, fresh, everyMeeting, played));
  }
  return rounds;
}

/**
 * One Round: up to `courts` meetings that share no unit, taken from the ones
 * that have not happened yet.
 *
 * Among the meetings that fit, the one whose units have played least goes on
 * first. That is the whole of the Bye rotation — a unit that has been sitting
 * is the unit a court is next offered to — and ties fall back to circle order,
 * which keeps the construction's own spread underneath the greed.
 *
 * A court is left empty rather than filled with a rematch while any meeting is
 * still unplayed. That ordering is deliberate: the one failure both these
 * Formats have is two units meeting again before everyone has met, and
 * manufacturing one to avoid an idle court would be the board telling a lie to
 * look tidier. It is reachable only where the court count makes it
 * unavoidable.
 */
function buildRound(
  courts: number,
  units: readonly Side[],
  fresh: Meeting[],
  everyMeeting: readonly Meeting[],
  played: number[],
): Round {
  const busy = new Set<number>();
  const games: Game[] = [];

  while (games.length < courts) {
    let pick = -1;
    let fewest = Infinity;
    for (let i = 0; i < fresh.length; i++) {
      const [a, b] = fresh[i];
      if (busy.has(a) || busy.has(b)) continue;
      const idle = played[a] + played[b];
      // Strictly less, so a tie keeps the earlier one: circle order underneath.
      if (idle < fewest) {
        fewest = idle;
        pick = i;
      }
    }

    if (pick === -1) {
      // Nothing unplayed fits. Either the rotation is spent and the next one
      // starts, or this Round genuinely has a court it cannot seat.
      if (fresh.length > 0) break;
      fresh.push(...everyMeeting);
      continue;
    }

    const [a, b] = fresh.splice(pick, 1)[0];
    busy.add(a);
    busy.add(b);
    played[a] += 1;
    played[b] += 1;
    games.push({ court: games.length, sides: [units[a], units[b]] });
  }

  // A Bye belongs to a unit here, not to a Player: in fixed partners four
  // teams on one court means two whole teams sit, and both members of a
  // sitting team sit. The list is still Players, because that is what the
  // board and the Scorer read — and in singles a unit is one Player anyway.
  const byes: PlayerIndex[] = [];
  for (let unit = 0; unit < units.length; unit++) {
    if (!busy.has(unit)) byes.push(...units[unit]);
  }

  return { games, byes: byes.sort((a, b) => a - b) };
}
