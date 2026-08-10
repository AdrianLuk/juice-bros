import type { MatchConfig, PlayerPair, TeamId } from "./types.ts";

/**
 * Match rules as data. The things a ref actually chooses at the table are
 * toggles; everything else is a constant here or derived from them, so a rule
 * revision is an edit to this file rather than a code change.
 *
 * Verify against the live Pickleball Canada / USAP rulebook before a
 * sanctioned event. Where the defaults below sit relative to USAP 2026:
 *
 * - Side-out is the sanctioned format and matches the book exactly.
 * - Rally scoring in USAP 2026 is win by 2 with NO freeze — rule 14.a.2 dropped
 *   the requirement that game point be won on serve. Both are toggles here, but
 *   the defaults ship as win by 1 + freeze on, which is the rec / MLP-style
 *   variant this app is aimed at. A ref working a sanctioned rally event needs
 *   to flip Win by to 2 and Freeze to Off.
 * - Point targets and game counts are the same set for both formats: USAP
 *   sanctions rally to 11, 15, or 21 over one game, best 2-of-3, or best 3-of-5.
 */
export const POINTS_OPTIONS = [11, 15, 21] as const;
export const BEST_OF_OPTIONS = [1, 3, 5] as const;
/** Rally scoring only; side-out is always win by 2. */
export const WIN_BY_OPTIONS = [1, 2] as const;

export type PointsToWin = (typeof POINTS_OPTIONS)[number];
export type BestOf = (typeof BEST_OF_OPTIONS)[number];
export type WinBy = (typeof WIN_BY_OPTIONS)[number];

/** Exactly what the setup screen's toggles control. */
export interface MatchOptions {
  doubles: boolean;
  scoring: MatchConfig["scoring"];
  pointsToWin: PointsToWin;
  bestOf: BestOf;
  /** Rally scoring only — see `winByFor`. Defaults to 1 if omitted. */
  winBy?: WinBy;
  /** Rally scoring only — see `MatchConfig.freezeRule`. Defaults ON if omitted. */
  freezeRule?: boolean;
}

export const DEFAULT_OPTIONS: MatchOptions = {
  doubles: true,
  scoring: "sideout",
  pointsToWin: 15,
  bestOf: 1,
  winBy: 1,
  freezeRule: true,
};

/** Sides switch at the halfway mark: 6 in a game to 11, 8 to 15, 11 to 21. */
export function sideSwitchScore(pointsToWin: number): number {
  return Math.floor(pointsToWin / 2) + 1;
}

/**
 * Side-out is always the standard two-point margin. Rally scoring is the ref's
 * call: 1 closes the game out flat at the target (every rally is a point, so a
 * deuce ladder can run a game well past its slot), 2 is the USAP-sanctioned
 * margin and plays on until someone leads by two.
 */
export function winByFor(scoring: MatchConfig["scoring"], winBy?: WinBy): number {
  return scoring === "rally" ? (winBy ?? 1) : 2;
}

/** Rules the ref doesn't pick at the table. */
const FIXED_RULES = {
  switchAtScoreDecidingGameOnly: true,
  timeoutsPerGame: 2,
  timeoutSeconds: 60,
  medicalTimeoutSeconds: 15 * 60,
  equipmentTimeoutSeconds: 2 * 60,
} as const;

export function buildConfig(
  options: MatchOptions,
  players: Record<TeamId, PlayerPair>
): MatchConfig {
  return {
    ...FIXED_RULES,
    doubles: options.doubles,
    scoring: options.scoring,
    pointsToWin: options.pointsToWin,
    bestOf: options.bestOf,
    winBy: winByFor(options.scoring, options.winBy),
    switchAtScore: sideSwitchScore(options.pointsToWin),
    freezeRule: options.scoring === "rally" && (options.freezeRule ?? true),
    players,
  };
}

/** One line describing the rules a match will actually be played under. */
export function describeConfig(config: Omit<MatchConfig, "players">): string {
  const parts = [
    config.doubles ? "Doubles" : "Singles",
    config.scoring === "rally"
      ? config.freezeRule
        ? "rally scoring (freeze — win on serve only)"
        : "rally scoring"
      : "side-out scoring",
    config.bestOf === 1
      ? `one game to ${config.pointsToWin}`
      : `best of ${config.bestOf} to ${config.pointsToWin}`,
    `win by ${config.winBy}`,
  ];
  if (config.switchAtScore !== null) {
    parts.push(
      `switch at ${config.switchAtScore}${
        config.switchAtScoreDecidingGameOnly && config.bestOf > 1
          ? " in the decider"
          : ""
      }`
    );
  }
  return parts.join(" · ");
}
