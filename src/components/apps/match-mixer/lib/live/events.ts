/**
 * A Live Mixer's event log, read back into the night it describes (ADR 0001,
 * ADR 0006, #688). Nothing is updated in place: a Game's score is its latest
 * "score entered" or "score cleared", and the Game Rule is its latest change.
 *
 * The Current Round (#689) is the higher of the latest Round the organizer
 * started and the latest Round ever scored, plus one. "Ever": a cleared score
 * never lowers it, which is what makes locks never undo.
 *
 * The server checks a score against the rule in force before it appends one;
 * this reader checks only what holds under every rule, so an event it can't
 * make sense of is skipped rather than taking the board down.
 *
 * Relative imports only, for `node --test`.
 */

import { DEFAULT_GAME_RULE, MAX_POINTS, readGameRule, type GameRule, type GameScore } from "./game-rule.ts";

/** One row of `match_mixer_events`, as the read function returns it, in log order. */
export interface MixerEvent {
  readonly id: number;
  readonly kind: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

/** A Game on the whole board: its Round, and its court across the night (ADR 0004). */
export interface GameAt {
  readonly round: number;
  readonly court: number;
}

export function gameKey(round: number, court: number): string {
  return `${round}:${court}`;
}

/** Scores keyed by `gameKey`. */
export type Scores = ReadonlyMap<string, GameScore>;

/**
 * Somebody arriving or leaving after Go Live (#692), from Round `from` on:
 * the Round after the Current Round when the event was logged, which is the
 * first Round not yet locked. Read off the log's own order rather than stored,
 * so the Rounds a change can move are exactly the ones nobody has started.
 *
 * `joined` is new Players: one Roster line, or a Pairing's two in fixed
 * partners, into Pool `pool`. `left` and `back` name a Roster index, where the
 * live Roster is the Config's followed by everyone who joined, in log order.
 */
export type RosterChange =
  | { readonly kind: "joined"; readonly from: number; readonly pool: number; readonly lines: readonly string[] }
  | { readonly kind: "left" | "back"; readonly from: number; readonly player: number };

/** The longest name a late arrival's line may carry. */
export const MAX_LINE_LENGTH = 60;

export interface Replay {
  readonly rule: GameRule;
  readonly scores: Scores;
  /** As a Round index, like a Game's `round`: Round 1 is 0. */
  readonly currentRound: number;
  /** In log order, which is also `from` order. */
  readonly changes: readonly RosterChange[];
}

const index = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const points = (value: unknown): value is number => index(value) && (value as number) <= MAX_POINTS;

/** The Game an event's payload names, or null. */
export function readGameAt(payload: Readonly<Record<string, unknown>>): GameAt | null {
  const { round, court } = payload;
  return index(round) && index(court) ? { round, court } : null;
}

/** A score off an event's payload, or null when no rule could accept it. */
function readScore(value: unknown): GameScore | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [a, b] = value as unknown[];
  return points(a) && points(b) && a !== b ? [a, b] : null;
}

export function replay(events: readonly MixerEvent[]): Replay {
  let rule = DEFAULT_GAME_RULE;
  const scores = new Map<string, GameScore>();
  let currentRound = 0;
  const changes: RosterChange[] = [];

  for (const { kind, payload } of events) {
    if (kind === "player_added" || kind === "player_left") {
      const change = readRosterChange(kind, payload, currentRound + 1);
      if (change) changes.push(change);
      continue;
    }
    if (kind === "round_started") {
      if (index(payload.round)) currentRound = Math.max(currentRound, payload.round);
      continue;
    }
    if (kind === "game_rule_changed") {
      rule = readGameRule(payload) ?? rule;
      continue;
    }
    if (kind !== "score_entered" && kind !== "score_cleared") continue;
    const at = readGameAt(payload);
    if (!at) continue;
    const key = gameKey(at.round, at.court);
    if (kind === "score_cleared") {
      scores.delete(key);
      continue;
    }
    const score = readScore(payload.score);
    if (!score) continue;
    scores.set(key, score);
    currentRound = Math.max(currentRound, at.round + 1);
  }

  return { rule, scores, currentRound, changes };
}

const line = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= MAX_LINE_LENGTH;

/** A Roster change off an event's payload, or null when it names nothing. */
function readRosterChange(
  kind: "player_added" | "player_left",
  payload: Readonly<Record<string, unknown>>,
  from: number,
): RosterChange | null {
  if (index(payload.player)) return { kind: kind === "player_left" ? "left" : "back", from, player: payload.player };
  const { lines, pool } = payload;
  if (kind !== "player_added" || !index(pool) || !Array.isArray(lines)) return null;
  if (lines.length < 1 || lines.length > 2 || !lines.every(line)) return null;
  return { kind: "joined", from, pool, lines: lines.map((text) => text.trim()) };
}
