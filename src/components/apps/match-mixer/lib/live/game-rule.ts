/**
 * The Game Rule (spec #685, #688): what a finished Game's score can be. Set by
 * the organizer at Go Live and changeable all night. A score is checked
 * against the rule in force when it is entered, and a later change never
 * reaches back to scores already in.
 *
 * Relative imports only, for `node --test`.
 */

export type Target = 11 | 15 | 21 | "timed";
export type WinBy = 1 | 2;

/** `winBy` is kept under timed so switching back restores it; timed ignores it. */
export interface GameRule {
  readonly to: Target;
  readonly winBy: WinBy;
}

export const TARGETS: readonly Target[] = [11, 15, 21, "timed"];

export const DEFAULT_GAME_RULE: GameRule = { to: 11, winBy: 2 };

/** The highest number either side can score, under any rule. */
export const MAX_POINTS = 99;

/** A Game's two scores, in the order of its two Sides. */
export type GameScore = readonly [number, number];

/** A Game Rule read off untrusted input, or null when it isn't one. */
export function readGameRule(value: unknown): GameRule | null {
  if (typeof value !== "object" || value === null) return null;
  const { to, winBy } = value as Record<string, unknown>;
  if (!TARGETS.includes(to as Target)) return null;
  if (winBy !== 1 && winBy !== 2) return null;
  return { to: to as Target, winBy };
}

/** "To 11, win by 2", or "Timed". */
export function describeGameRule(rule: GameRule): string {
  return rule.to === "timed" ? "Timed" : `To ${rule.to}, win by ${rule.winBy}`;
}

/**
 * Why this score can't be a finished Game under this rule, or null when it
 * can. Rally to `to`: the Game ends the moment someone has `to` with a lead of
 * `winBy`, so past `to` only a lead of exactly 2 can end it (13 to 11), and
 * win by 1 never goes past `to` at all.
 */
export function scoreProblem(rule: GameRule, [a, b]: GameScore): string | null {
  const whole = (n: number) => Number.isInteger(n) && n >= 0 && n <= MAX_POINTS;
  if (!whole(a) || !whole(b)) return `Scores are whole numbers from 0 to ${MAX_POINTS}.`;
  if (a === b) return "A Game can't end in a tie. Standings count wins.";
  if (rule.to === "timed") return null;

  const { to, winBy } = rule;
  const winner = Math.max(a, b);
  const loser = Math.min(a, b);
  const lead = winner - loser;

  if (winner < to) return `Playing to ${to}, so the winner needs ${to}.`;
  if (winner === to) {
    return lead >= winBy ? null : `Win by ${winBy}: ${winner} to ${loser} isn't over yet.`;
  }
  if (winBy === 1) return `Playing to ${to}, win by 1, the Game ends at ${to}.`;
  return lead === winBy ? null : `Past ${to}, the Game ends as soon as someone leads by 2.`;
}
