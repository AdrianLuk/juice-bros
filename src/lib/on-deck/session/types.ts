/**
 * Domain types for On Deck's session fold.
 *
 * The whole of a live Session's state is derived by folding an append-only
 * event log through `reduceSession` (see `reduce.ts` and
 * `on-deck/docs/adr/` — the same one-pure-fold shape Pickle Point Pal's
 * `reduceMatch` uses).
 *
 * Nothing in this folder may import React, `server-only`, or a `@/` path
 * alias: `node --test` cannot resolve the alias, so the fold, its types, and
 * its selectors stay on relative imports only. Keeping it framework-free is
 * also what keeps it testable as "given these events, expect this state".
 */

/**
 * Who may fire a Session's operational events — a Club setting, expressed as
 * three presets over two independent switches (Volunteer Links, the Kiosk).
 * See the On Deck glossary and ADR 0005.
 */
export type FloorMode = "volunteer-run" | "self-serve" | "hybrid";

export const FLOOR_MODES: readonly FloorMode[] = [
  "volunteer-run",
  "self-serve",
  "hybrid",
];

/** How each Floor Mode reads in the UI — one map, so every surface agrees. */
export const FLOOR_MODE_LABEL: Record<FloorMode, string> = {
  "volunteer-run": "Volunteer-run",
  "self-serve": "Self-serve",
  hybrid: "Hybrid",
};

/**
 * Whoever fired an operational event. Every event in the log records one; the
 * fold reads them identically (Floor Mode is an authorization gate on which
 * sources may append which events, never a branch in the fold — ADR 0005).
 *
 * `userId` is set only for `organizer` — the one Operator kind backed by a
 * real account.
 */
export type Operator =
  | { kind: "organizer"; userId: string }
  | { kind: "volunteer" }
  | { kind: "kiosk" }
  | { kind: "player" };

export const OPERATOR_KINDS = [
  "organizer",
  "volunteer",
  "kiosk",
  "player",
] as const;

/**
 * A Player's own declaration of where they play — the club's four words, not a
 * rating system, and never computed by the app (see the On Deck glossary and
 * ADR 0001). Set once per Session at join.
 */
export type SkillLevel = "newbie" | "beginner" | "intermediate" | "advanced";

export const SKILL_LEVELS: readonly SkillLevel[] = [
  "newbie",
  "beginner",
  "intermediate",
  "advanced",
];

/** How each Skill Level reads in the UI — one map, so every surface agrees. */
export const SKILL_LEVEL_LABEL: Record<SkillLevel, string> = {
  newbie: "Newbie",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/** Narrows an untrusted value (an event payload field) to a `SkillLevel`. */
export function isSkillLevel(value: unknown): value is SkillLevel {
  return (
    typeof value === "string" &&
    (SKILL_LEVELS as readonly string[]).includes(value)
  );
}

/**
 * The immutable facts a Session is folded against — the Club's saved defaults
 * captured at Start, plus a seed that makes every later tie-break
 * deterministic (never `Math.random()`).
 */
export interface SessionConfig {
  sessionId: string;
  clubId: string;
  venueName: string;
  courtCount: number;
  groupCap: number;
  floorMode: FloorMode;
  /** Deterministic tie-break seed, carried from the session row. */
  seed: string;
}

/**
 * Every event carries its own `at` (epoch ms) and the `operator` that produced
 * it. The fold reads `at` off the event and **never** calls `Date.now()` — the
 * moment it does, replay stops being reproducible and undo (dropping the last
 * event) breaks.
 *
 * `SESSION_STARTED` and `PLAYER_JOINED` exist so far; the rest of the log's
 * vocabulary (queuing, groups, courts finishing, last call, close) lands in
 * later tickets. The DB `on_deck_session_events.type` check already lists the
 * full set so those tickets add rows, not migrations.
 */
export type SessionEvent =
  | {
      type: "SESSION_STARTED";
      at: number;
      operator: Operator;
    }
  | {
      type: "PLAYER_JOINED";
      at: number;
      operator: Operator;
      /**
       * The device token the Player's phone minted and stored — their whole
       * identity for this Session (ADR 0001). A replayed event carrying a
       * token already in the roster is a no-op, which is what makes reopening
       * the Club QR on the same device safe.
       */
      token: string;
      firstName: string;
      lastInitial: string;
      skillLevel: SkillLevel;
    };

/** One Player in a Session's roster, as the fold projects them. */
export interface RosterPlayer {
  /** The device token the Player joined with — their id within this Session. */
  id: string;
  firstName: string;
  lastInitial: string;
  skillLevel: SkillLevel;
  /**
   * "First name + last initial", with a numeric suffix when someone with the
   * same name and initial already joined — "Sarah K.", then "Sarah K. 2". The
   * suffix is what a Volunteer disambiguates two same-named Players by.
   */
  displayName: string;
  /** When this Player joined the Session (epoch ms, off the event). */
  joinedAt: number;
}

/** The minimal live state a folded Session projects to so far. */
export interface SessionState {
  config: SessionConfig;
  /** Null until `SESSION_STARTED` is folded. */
  startedAt: number | null;
  /** The Operator that started the Session — always an organizer for now. */
  startedBy: Operator | null;
  status: "pending" | "open";
  /** Everyone who has joined this Session, in join order. */
  roster: RosterPlayer[];
}
