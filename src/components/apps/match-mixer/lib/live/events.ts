/**
 * A Live Mixer's event log, read back into the night it describes (ADR 0001,
 * ADR 0006, #688). Nothing is updated in place: a Game's score is its latest
 * "score entered" or "score cleared", and the Game Rule is its latest change.
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

export interface Night {
  readonly rule: GameRule;
  readonly scores: Scores;
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

export function replay(events: readonly MixerEvent[]): Night {
  let rule = DEFAULT_GAME_RULE;
  const scores = new Map<string, GameScore>();

  for (const { kind, payload } of events) {
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
    if (score) scores.set(key, score);
  }

  return { rule, scores };
}
