/**
 * Fake Player generation for the dev console (`/on-deck/dev`).
 *
 * On Deck only does anything visible with a crowd — Match Me, On Deck
 * foursomes, Variety, groups all need 8+ queued Players — and one phone can
 * only join as one. The dev console fills a real Session with synthetic
 * Players; this module is the (pure, `node --test`-able, relative-imports-only)
 * name/skill generator behind it.
 *
 * The names are deliberately unlike a real roster — a bird pool plus a
 * "(bot)" last initial spelled out on the board — so a synthetic Player is
 * obvious at a glance on the floor screen or Display if a test Session is ever
 * left open.
 */

import { SKILL_LEVELS, type SkillLevel } from "./session/types.ts";

/** First names for synthetic Players — a fixed pool, cycled by index. */
export const DEV_PLAYER_NAMES: readonly string[] = [
  "Robin",
  "Wren",
  "Finch",
  "Lark",
  "Heron",
  "Swift",
  "Kestrel",
  "Martin",
  "Pipit",
  "Sora",
  "Rail",
  "Snipe",
  "Plover",
  "Godwit",
  "Curlew",
  "Dunlin",
  "Sanderling",
  "Turnstone",
  "Avocet",
  "Oystercatcher",
  "Merlin",
  "Hobby",
  "Harrier",
  "Osprey",
  "Kite",
  "Buzzard",
  "Goshawk",
  "Peregrine",
  "Nightjar",
  "Swallow",
  "Swan",
  "Teal",
  "Wigeon",
  "Pintail",
  "Gadwall",
  "Shoveler",
  "Pochard",
  "Scaup",
  "Eider",
  "Smew",
];

export type FakePlayer = {
  firstName: string;
  lastInitial: string;
  skillLevel: SkillLevel;
};

/**
 * The `n`th synthetic Player — deterministic in `n` so a test can assert on it
 * and re-runs stay stable. Cycles the name pool, tacks on a wrapping numeric
 * suffix once it wraps ("Robin", …, "Smew", "Robin 2"), and spreads Skill
 * Levels evenly so a filled Queue exercises Match Me's skill fit.
 */
export function fakePlayer(n: number): FakePlayer {
  const index = ((n % DEV_PLAYER_NAMES.length) + DEV_PLAYER_NAMES.length) %
    DEV_PLAYER_NAMES.length;
  const wrap = Math.floor(n / DEV_PLAYER_NAMES.length);
  const base = DEV_PLAYER_NAMES[index];

  return {
    firstName: wrap > 0 ? `${base} ${wrap + 1}` : base,
    lastInitial: "B", // reads "· B." on the board — a synthetic-Player tell
    skillLevel: SKILL_LEVELS[index % SKILL_LEVELS.length],
  };
}

/** A short batch of synthetic Players starting from `startIndex`. */
export function fakePlayers(count: number, startIndex = 0): FakePlayer[] {
  const safe = Math.max(0, Math.floor(count));
  return Array.from({ length: safe }, (_, i) => fakePlayer(startIndex + i));
}

/** A device token for a synthetic Player — namespaced so it never collides
 * with a real phone's token or an Operator walk-up's `walkup-<uuid>`. */
export function fakePlayerToken(): string {
  return `dev-${crypto.randomUUID()}`;
}
