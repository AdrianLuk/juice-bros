import type { MatchConfig, PlayerPair, TeamId } from "./types.ts";

/**
 * Match rules as data. The four things a ref actually chooses at the table are
 * toggles; everything else is a constant here or derived from them, so a rule
 * revision is an edit to this file rather than a code change.
 *
 * Verify against the live Pickleball Canada / USAP rulebook before a
 * sanctioned event — these are the 2024-era defaults.
 */
export const POINTS_OPTIONS = [11, 15, 21] as const;
export const BEST_OF_OPTIONS = [1, 3, 5] as const;

export type PointsToWin = (typeof POINTS_OPTIONS)[number];
export type BestOf = (typeof BEST_OF_OPTIONS)[number];

/** Exactly what the setup screen's toggles control. */
export interface MatchOptions {
  doubles: boolean;
  scoring: MatchConfig["scoring"];
  pointsToWin: PointsToWin;
  bestOf: BestOf;
  /** Rally scoring only — see `MatchConfig.freezeRule`. Defaults off if omitted. */
  freezeRule?: boolean;
}

export const DEFAULT_OPTIONS: MatchOptions = {
  doubles: true,
  scoring: "sideout",
  pointsToWin: 11,
  bestOf: 3,
  freezeRule: false,
};

/** Sides switch at the halfway mark: 6 in a game to 11, 8 to 15, 11 to 21. */
export function sideSwitchScore(pointsToWin: number): number {
  return Math.floor(pointsToWin / 2) + 1;
}

/** Rules the ref doesn't pick at the table. */
const FIXED_RULES = {
  winBy: 2,
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
    switchAtScore: sideSwitchScore(options.pointsToWin),
    freezeRule: options.scoring === "rally" && (options.freezeRule ?? false),
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
