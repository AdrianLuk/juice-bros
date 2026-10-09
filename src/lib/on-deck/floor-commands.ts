/**
 * Floor commands (issue #612): every Operator tap that appends a Session event,
 * as one data value, plus who may send which and the one pure dispatcher that
 * turns a command into the `floor-ops` outcome it decides today.
 *
 * Each credential (Organizer, Volunteer, Kiosk, Demo night) is an adapter over
 * `dispatchFloorCommand`: it loads the Session, mints the ids, and writes the
 * event its own way. The permission table lives here so the adapters and the
 * tests read one copy (ADR 0005: which Operator may fire an event is an
 * authorization gate, never a branch in the decision).
 *
 * Undo is not a command: it drops the latest event rather than appending one,
 * so it stays outside the union and the table only records whether each
 * Operator may use it.
 *
 * Relative imports only and no `server-only`: unit-tested under `node --test`.
 */

import {
  addWalkupOutcome,
  bringBackOutcome,
  confirmCourtOutcome,
  dissolveGroupOutcome,
  finishCourtOutcome,
  formGroupOutcome,
  lowerGroupCapOutcome,
  overrideSkillOutcome,
  setAsideOutcome,
  swapNoShowOutcome,
  type FloorOpOutcome,
} from "./floor-ops.ts";
import type { EventBody, Operator, SessionState } from "./session/types.ts";

/** One appending floor operation and its inputs. `since` is the Court's
 * `since` the board last rendered (the stale-board guard). */
export type FloorCommand =
  /** Game done: "Court N done" / "Send next four". */
  | { kind: "finishCourt"; court: number; since: number | null }
  /** The idle-court nudge's "still going" tap. */
  | { kind: "confirmCourt"; court: number; since: number | null }
  | { kind: "setAside"; name: string }
  | { kind: "bringBack"; name: string }
  | {
      kind: "addWalkup";
      firstName: string;
      lastInitial: string;
      skillLevel: string;
    }
  | { kind: "overrideSkill"; name: string; skillLevel: string }
  | {
      kind: "swapNoShow";
      court: number;
      since: number | null;
      outName: string;
      inName: string;
    }
  | { kind: "formGroup"; names: readonly string[] }
  | { kind: "dissolveGroup"; groupId: string }
  | { kind: "lowerGroupCap"; cap: number }
  | { kind: "lastCall" }
  | { kind: "closeSession" };

export type FloorCommandKind = FloorCommand["kind"];

/** The Operators that run the floor. A Player's own taps are not floor
 * commands. */
export type FloorOperatorKind = Exclude<Operator["kind"], "player">;

/** Ids the adapter mints before dispatch (`walkup-<uuid>`, `group-<uuid>`), so
 * the dispatcher stays pure. Only `addWalkup` and `formGroup` read them. */
export type FloorIds = { walkupToken: string; groupId: string };

/** Fresh ids for one dispatch. Every adapter mints through here. */
export function mintFloorIds(): FloorIds {
  return {
    walkupToken: `walkup-${crypto.randomUUID()}`,
    groupId: `group-${crypto.randomUUID()}`,
  };
}

/** Which commands each Operator may send, and whether it may Undo. */
export const FLOOR_PERMISSIONS: Record<
  FloorOperatorKind,
  { commands: readonly FloorCommandKind[]; undo: boolean }
> = {
  // Everything except confirm Court, which only the Kiosk's nudge sends.
  organizer: {
    commands: [
      "finishCourt",
      "setAside",
      "bringBack",
      "addWalkup",
      "overrideSkill",
      "swapNoShow",
      "formGroup",
      "dissolveGroup",
      "lowerGroupCap",
      "lastCall",
      "closeSession",
    ],
    undo: true,
  },
  // The Organizer's set minus close Session, which stays the Organizer's alone.
  volunteer: {
    commands: [
      "finishCourt",
      "setAside",
      "bringBack",
      "addWalkup",
      "overrideSkill",
      "swapNoShow",
      "formGroup",
      "dissolveGroup",
      "lowerGroupCap",
      "lastCall",
    ],
    undo: true,
  },
  // Game done, a player short, add me, and the idle-court nudge.
  kiosk: {
    commands: ["finishCourt", "swapNoShow", "addWalkup", "confirmCourt"],
    undo: true,
  },
};

/** The two wrap-up events, which no `floor-ops` decision produces. */
export type WrapUpBody = Extract<
  EventBody,
  { type: "LAST_CALL" | "SESSION_CLOSED" }
>;

/** A `floor-ops` outcome, or a wrap-up event to append. */
export type FloorCommandOutcome =
  | FloorOpOutcome
  | { kind: "event"; body: WrapUpBody };

/**
 * The refusal for a command outside the Operator's set. No screen offers such
 * a tap, so this is what the database whitelist's refusal already surfaced
 * through `commitFloorOutcome` before the table existed.
 */
export const FLOOR_COMMAND_REFUSED = "That didn't go through. Try again.";

/**
 * Decide what `command`, sent by `operator`, appends to the board in `state`.
 * Refuses (an `error` outcome) a command the Operator may not send; otherwise
 * returns exactly what the matching `floor-ops` decision returns.
 *
 * Last Call and close Session always append: whether the Session is still open
 * is the adapter's check, as it is today.
 */
export function dispatchFloorCommand(
  state: SessionState,
  operator: FloorOperatorKind,
  command: FloorCommand,
  ids: FloorIds,
): FloorCommandOutcome {
  // `command` arrives from a client, so an unknown kind is refused here too.
  if (!FLOOR_PERMISSIONS[operator]?.commands.includes(command?.kind)) {
    return { kind: "error", error: FLOOR_COMMAND_REFUSED };
  }

  switch (command.kind) {
    case "finishCourt":
      return finishCourtOutcome(state, command.court, command.since);
    case "confirmCourt":
      return confirmCourtOutcome(state, command.court, command.since);
    case "setAside":
      return setAsideOutcome(state, command.name);
    case "bringBack":
      return bringBackOutcome(state, command.name);
    case "addWalkup":
      return addWalkupOutcome(
        state,
        ids.walkupToken,
        command.firstName,
        command.lastInitial,
        command.skillLevel,
      );
    case "overrideSkill":
      return overrideSkillOutcome(state, command.name, command.skillLevel);
    case "swapNoShow":
      return swapNoShowOutcome(
        state,
        command.court,
        command.since,
        command.outName,
        command.inName,
      );
    case "formGroup":
      return formGroupOutcome(state, command.names, ids.groupId);
    case "dissolveGroup":
      return dissolveGroupOutcome(state, command.groupId);
    case "lowerGroupCap":
      return lowerGroupCapOutcome(state, command.cap);
    case "lastCall":
      return { kind: "event", body: { type: "LAST_CALL" } };
    case "closeSession":
      return { kind: "event", body: { type: "SESSION_CLOSED" } };
  }
}
