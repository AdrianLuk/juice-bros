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

/**
 * The one "not right now" state, reached three ways (issue #246). The reason is
 * kept for the operator surface — "left", a Player who removed themselves;
 * "no-show", a called Player swapped out because they didn't appear;
 * "set-aside", a Player an Operator stood down. The fold treats all three
 * identically: the Player stops being called and their accrued Wait Time is
 * held until they re-queue.
 */
export type PauseReason = "left" | "no-show" | "set-aside";

export const PAUSE_REASONS: readonly PauseReason[] = [
  "left",
  "no-show",
  "set-aside",
];

/** Narrows an untrusted value (an event payload field) to a `PauseReason`. */
export function isPauseReason(value: unknown): value is PauseReason {
  return (
    typeof value === "string" &&
    (PAUSE_REASONS as readonly string[]).includes(value)
  );
}

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
 * `SESSION_STARTED`, `PLAYER_JOINED`, `PLAYER_QUEUED`, `PLAYER_SKILL_SET`,
 * `COURT_FINISHED`, `PLAYER_PAUSED`, `PLAYER_REQUEUED`,
 * `FOURSOME_MEMBER_SWAPPED`, `GROUP_FORMED`, `GROUP_CAP_CHANGED`,
 * `GROUP_MEMBER_REMOVED`, `GROUP_DISSOLVED`, `LAST_CALL` and `SESSION_CLOSED`
 * exist. The DB `on_deck_session_events.type` check lists the full set (the
 * #246 migration adds `PLAYER_REQUEUED`, which the foundation missed).
 *
 * `GROUP_FORMED` is fired both ways — a Volunteer picking members (issue #250)
 * and a Player forming a Group from their own phone (issue #251). The fold
 * reads the two identically (ADR 0005); only the write path differs (a
 * Volunteer's RPC vs. an `anon` Player RPC).
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
      /**
       * Set only on a walk-up added by an Operator (issue #249): the Player is
       * there to play now, so the fold puts them straight in the Queue instead
       * of waiting for a separate `PLAYER_QUEUED` tap. A self-registered Player
       * omits it and queues themselves. Payload-driven, not operator-driven —
       * ADR 0005 keeps the Operator out of the fold's branches.
       */
      queueOnJoin?: boolean;
    }
  | {
      /**
       * An Operator corrects an obviously wrong self-declared Skill Level
       * (issue #249) — the club vocabulary is never computed by the app, but a
       * Volunteer may override it. Takes effect on the next Match Me selection;
       * a committed On Deck Foursome is never reshuffled for it (ADR 0007). A
       * no-op for a token the roster does not carry.
       */
      type: "PLAYER_SKILL_SET";
      at: number;
      operator: Operator;
      token: string;
      skillLevel: SkillLevel;
    }
  | {
      /**
       * A Player taps to join the Queue. Fired once per Player — coming off a
       * Court re-queues them without an event (the fold does it on
       * `COURT_FINISHED`), so a replayed `PLAYER_QUEUED` for a token already
       * queued or playing is a no-op.
       */
      type: "PLAYER_QUEUED";
      at: number;
      operator: Operator;
      token: string;
    }
  | {
      /**
       * An Operator taps "Court N done". The four Players on Court `court`
       * re-queue (Wait Time measured from this event's `at`), then Match Me
       * (`match-me.ts`) seats the next Foursome onto the freed Court. Several
       * in a row fold one at a time, each Foursome removed from the Queue
       * before the next is picked (ADR 0004).
       */
      type: "COURT_FINISHED";
      at: number;
      operator: Operator;
      /** 1-based Court number, within `config.courtCount`. */
      court: number;
    }
  | {
      /**
       * A Player steps out of the rotation — they removed themselves (`left`),
       * or an Operator stood them down (`set-aside`). They leave the Queue (and
       * any On Deck Foursome, which then tops up), stop being called, and their
       * accrued Wait Time is held. A no-op for a token already paused or one
       * neither queued nor playing. The no-show door is `FOURSOME_MEMBER_SWAPPED`.
       */
      type: "PLAYER_PAUSED";
      at: number;
      operator: Operator;
      token: string;
      reason: PauseReason;
    }
  | {
      /**
       * A paused Player re-enters the Queue — by scanning the Club QR again, or
       * an Operator re-adding them. Their Wait Time resumes from the equity they
       * had when they paused (`waitSince` is back-dated by the accrued amount),
       * so stepping away cost them nothing. A no-op for a token that is not
       * currently paused.
       */
      type: "PLAYER_REQUEUED";
      at: number;
      operator: Operator;
      token: string;
    }
  | {
      /**
       * The no-show door into Paused: an Operator taps a called Player who did
       * not appear and names a replacement standing there. `out` goes to Paused
       * (reason `no-show`, Wait Time held); `in` — a waiting Player, never one
       * paused or already on a Court — takes the open seat on `court`. The
       * Game's clock (`since`) is untouched; only the four names change.
       */
      type: "FOURSOME_MEMBER_SWAPPED";
      at: number;
      operator: Operator;
      /** 1-based Court number the swap happens on. */
      court: number;
      /** Device token of the no-show leaving the Foursome. */
      out: string;
      /** Device token of the replacement joining it. */
      in: string;
    }
  | {
      /**
       * A Volunteer (or the Organizer) forms a **Group** from Players who asked
       * to play together (issue #250). The members queue as one unit at their
       * **median** Wait Time; a Group of 2-3 is filled to four by Match Me, and
       * Variety is suppressed between members. The Group dissolves when its
       * Game ends (the fold derives that from `COURT_FINISHED`, not a separate
       * event). A no-op unless every member is rostered, currently in the
       * Queue, in no other Group, and `2 <= members <= state.groupCap`.
       */
      type: "GROUP_FORMED";
      at: number;
      operator: Operator;
      /** Server-minted `group-<uuid>` — the Group's id within this Session. */
      groupId: string;
      /** Device tokens of the chosen members, in the order they were picked. */
      memberTokens: string[];
    }
  | {
      /**
       * A member removes themselves from a Group from their own phone (issue
       * #251). They stay in the Queue as a solo — this is *not* leaving the
       * Queue (`PLAYER_PAUSED`). A Group left under two members dissolves; its
       * remaining member re-sorts as a solo too. A no-op unless the token is a
       * current member of a still-waiting Group.
       */
      type: "GROUP_MEMBER_REMOVED";
      at: number;
      operator: Operator;
      groupId: string;
      /** Device token of the member leaving the Group. */
      token: string;
    }
  | {
      /**
       * A Volunteer (or the Organizer) dissolves a whole Group before it walks
       * onto a Court (issue #251) — its members stay in the Queue as solos. A
       * no-op for an unknown groupId or a Group already on a Court (that one
       * dissolves on its `COURT_FINISHED`).
       */
      type: "GROUP_DISSOLVED";
      at: number;
      operator: Operator;
      groupId: string;
    }
  | {
      /**
       * A Volunteer lowers the live group cap mid-Session (issue #250) to stop
       * one Foursome monopolising a Court. Bounded to `[2, config.groupCap]` —
       * the Club default is the ceiling. Existing larger Groups are left alone;
       * only later `GROUP_FORMED` events feel the new cap.
       */
      type: "GROUP_CAP_CHANGED";
      at: number;
      operator: Operator;
      /** The new cap, 2..`config.groupCap`. */
      cap: number;
    }
  | {
      /**
       * Last Call (issue #255): an Operator — the Organizer or a Volunteer,
       * never a Kiosk (it is a judgment about the night, not a Court turnover,
       * ADR 0002) — ends new play. After it the fold assigns no further
       * Foursomes and forms no new On Deck Foursomes; Games already on Courts
       * finish normally (a `COURT_FINISHED` still re-queues the four and records
       * the Game, it just doesn't seat a replacement). A replayed event is a
       * no-op — the first Last Call wins.
       */
      type: "LAST_CALL";
      at: number;
      operator: Operator;
    }
  | {
      /**
       * The Organizer closes the Session (issue #255). In the live fold this
       * only flips `status` to `closed`; the permanent Session Summary
       * projection and the purge of the event log and Player roster (ADR 0001)
       * happen in `on_deck_close_session` at the database, not here. Present in
       * the fold so a log that still carries the event (before the purge, or in
       * a test) reduces sensibly.
       */
      type: "SESSION_CLOSED";
      at: number;
      operator: Operator;
    };

/**
 * The one-line explainer of how a Queue Together Group's place in line works —
 * so a Group sitting mid-Queue doesn't read as line-jumping (issue #238 user
 * story 57, issue #251). Shown on the Display and the floor's Queue; kept here
 * so every surface uses the same words.
 */
export const QUEUE_TOGETHER_EXPLAINER =
  "Groups line up at the middle of their members' wait times — nobody skips the queue by grouping up.";

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

/** One Player waiting for a Court. */
export interface QueueEntry {
  /** The Player's device token — their id within this Session. */
  playerId: string;
  /**
   * When this Player's current wait began (epoch ms, off an event): their
   * `PLAYER_QUEUED`, or the `COURT_FINISHED` that last took them off a Court,
   * whichever is later. The primary fairness input to selection.
   */
  waitSince: number;
}

/**
 * A Game that has finished, in the order Games finished — the last entry is
 * the most recent. Feeds Match Me's Variety preference (issue #244): the
 * further back two Players last shared a Court, the weaker the pull to keep
 * them apart now.
 */
export interface CompletedGame {
  /** The device tokens of the four who played it. */
  players: string[];
  /**
   * The 1-based Court it finished on — feeds the Session Summary's per-Court
   * utilization (issue #255). Optional only for the sake of Match Me's unit
   * tests, which build `CompletedGame` literals for Variety scoring and don't
   * care where a Game happened; `reduceSession` always sets it.
   */
  court?: number;
}

/**
 * A Group of Players queued together (issue #250). Formed by a Volunteer from
 * members who are all currently in the Queue; queues as one unit at the
 * **median** Wait Time of its members. A Group of 2-3 has its remaining seats
 * filled by Match Me (targeting the members' average Skill Level, Variety
 * suppressed between members). Dissolves when its Game ends.
 */
export interface Group {
  /** `group-<uuid>`, from the `GROUP_FORMED` event. */
  id: string;
  /**
   * Device tokens of the members still in the Group, in pick order. A member
   * who is later Paused drops out; a Group under two members dissolves.
   */
  memberIds: string[];
  /** When the Group was formed (epoch ms, off the event). */
  formedAt: number;
  /**
   * The Court the Group's Foursome walked onto, or null while it is still
   * waiting. `COURT_FINISHED` for this Court dissolves the Group — matching on
   * the Court rather than the members so a no-show swap of a member mid-Game
   * still ends the Group cleanly.
   */
  courtNumber: number | null;
}

/** One Player who has stepped out of the rotation (issue #246). */
export interface PausedPlayer {
  /** The Player's device token — their id within this Session. */
  playerId: string;
  /**
   * Wait Time (ms) the Player had accrued at the moment they paused. On
   * `PLAYER_REQUEUED` their `waitSince` is back-dated by this, so all three
   * doors into Paused preserve equity identically.
   */
  accruedWaitMs: number;
  /** When they paused (epoch ms, off the event). */
  pausedAt: number;
  /** Which door they came through — for the operator surface only. */
  reason: PauseReason;
}

/** One Court in a Session — empty (`foursome` is `[]`) or holding a Game. */
export interface CourtSlot {
  /** 1-based Court number. */
  number: number;
  /** The device tokens of the four Players on it, or `[]` when empty. */
  foursome: string[];
  /** When the current Game was seated (epoch ms, off an event), or null. */
  since: number | null;
}

/**
 * A Foursome the app has **committed** to ahead of any Court freeing — "Up
 * next", then "After that" (issue #245). Committed at the moment it is selected
 * and carried forward in the fold's accumulator, never recomputed on a read: a
 * Player joining the Queue must not reshuffle a Foursome already announced.
 *
 * An incomplete Foursome (`players.length < 4`, formed when the Queue was too
 * short) **tops up** as Players join — appended in wait order, its existing
 * members untouched. A complete one never changes until it walks onto a Court.
 */
export interface OnDeckFoursome {
  /** Device tokens of the committed Players, in Queue (wait) order. */
  players: string[];
  /** When this Foursome was first committed (epoch ms, off an event). */
  committedAt: number;
  /**
   * Set to a `Group`'s id when this Foursome was formed from a Queue Together
   * Group (issue #250) — its members are fixed and only the fill seats top up.
   * `seatCourt` reads it to bind the Group to the Court it walks onto. Null for
   * an ordinary Match Me Foursome.
   */
  groupId: string | null;
}

/** The live state a folded Session projects to. */
export interface SessionState {
  config: SessionConfig;
  /**
   * The current effective group cap (issue #250) — starts at
   * `config.groupCap` and is lowered by `GROUP_CAP_CHANGED`, never above the
   * Club default. `GROUP_FORMED` is bound by this, not by `config.groupCap`.
   */
  groupCap: number;
  /** Active Queue Together Groups (issue #250), in formation order. */
  groups: Group[];
  /** Null until `SESSION_STARTED` is folded. */
  startedAt: number | null;
  /** The Operator that started the Session — always an organizer for now. */
  startedBy: Operator | null;
  /**
   * When Last Call was tapped (issue #255), or null. Once set, the fold assigns
   * no further Foursomes and forms no new On Deck ones; Games on Courts play
   * out. The floor and Display read it to flip to "final games".
   */
  lastCallAt: number | null;
  status: "pending" | "open" | "closed";
  /** Everyone who has joined this Session, in join order. */
  roster: RosterPlayer[];
  /**
   * Players waiting for a Court, ordered longest-wait-first — index 0 is the
   * anchor Match Me always seats next (issue #244, ADR 0004).
   */
  queue: QueueEntry[];
  /** Every Court, `config.courtCount` of them, numbered 1..N. */
  courts: CourtSlot[];
  /**
   * Up to two committed Foursomes shown ahead of any Court freeing — index 0
   * is "Up next" (walks straight onto the next freed Court), index 1 is "After
   * that" (issue #245). Carried forward across events, never recomputed on a
   * read.
   */
  onDeck: OnDeckFoursome[];
  /**
   * Players who have stepped out of the rotation (issue #246), newest last.
   * They are in no Queue, on no Court, and in no Foursome until a
   * `PLAYER_REQUEUED` brings them back.
   */
  paused: PausedPlayer[];
  /**
   * When each Player's current wait began (epoch ms), by device token — set on
   * `PLAYER_QUEUED`, on the `COURT_FINISHED` that re-queues them, and on
   * `PLAYER_REQUEUED`. Kept even while a Player is on a Court or On Deck so the
   * no-show door can preserve the equity they had. Internal to the fold; not
   * projected.
   */
  waitStartByPlayer: Record<string, number>;
  /**
   * Every finished Game, in finish order — the Variety history Match Me scores
   * candidate Foursomes against. Not projected to any live surface.
   */
  completedGames: CompletedGame[];
  /**
   * Every Wait Time (ms) that has actually ended — one entry per Player each
   * time they are seated onto a Court, measured from when their wait began.
   * The Session Summary's wait-time distribution and longest wait (issue #255)
   * are projected from this. Internal to the fold; not projected to a live
   * surface.
   */
  completedWaits: number[];
}

/**
 * A Player's position in the Queue (1-based), or null if they are not queued
 * (on a Court, only on the roster, or unknown).
 */
export function queuePosition(
  state: SessionState,
  playerId: string,
): number | null {
  const index = state.queue.findIndex((e) => e.playerId === playerId);
  return index < 0 ? null : index + 1;
}

/** The Court a Player is on (1-based number), or null if they are not playing. */
export function playerCourt(
  state: SessionState,
  playerId: string,
): number | null {
  const court = state.courts.find((c) => c.foursome.includes(playerId));
  return court ? court.number : null;
}

/** Is this Player currently paused (stepped out of the rotation)? */
export function playerPaused(state: SessionState, playerId: string): boolean {
  return state.paused.some((p) => p.playerId === playerId);
}

/**
 * The median of a non-empty list of numbers. For an even count it is the
 * average of the two middle values — a Group's Queue position (issue #250) so
 * that adding a longer-waiting member moves the Group only partway up, never to
 * that member's own spot.
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * One entry in the Queue as a surface should show it (issue #250): a solo
 * Player, or a whole Group collapsed to a single unit. Group members are
 * contiguous in `state.queue`, so this is a straight walk over it.
 */
export type QueueUnit =
  | { kind: "solo"; playerId: string }
  | { kind: "group"; groupId: string; memberIds: string[] };

/**
 * Collapse the ordered Queue into units — a Group is one entry, positioned
 * where its (contiguous) members sit. Used by the read model so the floor and
 * Display show "Group: A, B, C" as a single line rather than three.
 */
export function queueUnits(state: SessionState): QueueUnit[] {
  const groupOfMember = new Map<string, Group>();
  for (const group of state.groups) {
    for (const id of group.memberIds) groupOfMember.set(id, group);
  }

  const units: QueueUnit[] = [];
  const emitted = new Set<string>();
  for (const entry of state.queue) {
    const group = groupOfMember.get(entry.playerId);
    if (!group) {
      units.push({ kind: "solo", playerId: entry.playerId });
      continue;
    }
    if (emitted.has(group.id)) continue;
    emitted.add(group.id);
    const memberIds = state.queue
      .filter((e) => groupOfMember.get(e.playerId) === group)
      .map((e) => e.playerId);
    units.push({ kind: "group", groupId: group.id, memberIds });
  }
  return units;
}
