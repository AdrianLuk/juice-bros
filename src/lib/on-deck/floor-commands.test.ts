import assert from "node:assert/strict";
import test from "node:test";

import { reduceSession } from "./session/reduce.ts";
import type { Operator, SessionConfig, SessionEvent } from "./session/types.ts";
import {
  dispatchFloorCommand,
  FLOOR_PERMISSIONS,
  type FloorCommand,
  type FloorIds,
  type FloorOperatorKind,
} from "./floor-commands.ts";

test("the permission table is exactly today's Operator abilities", () => {
  assert.deepEqual(
    {
      organizer: [...FLOOR_PERMISSIONS.organizer.commands].sort(),
      volunteer: [...FLOOR_PERMISSIONS.volunteer.commands].sort(),
      kiosk: [...FLOOR_PERMISSIONS.kiosk.commands].sort(),
    },
    {
      // Every command but confirm Court, which is the Kiosk's alone.
      organizer: [
        "addWalkup",
        "bringBack",
        "closeSession",
        "dissolveGroup",
        "finishCourt",
        "formGroup",
        "lastCall",
        "lowerGroupCap",
        "overrideSkill",
        "setAside",
        "swapNoShow",
      ],
      // The Organizer's set minus close Session.
      volunteer: [
        "addWalkup",
        "bringBack",
        "dissolveGroup",
        "finishCourt",
        "formGroup",
        "lastCall",
        "lowerGroupCap",
        "overrideSkill",
        "setAside",
        "swapNoShow",
      ],
      // Game done, a player short, add me, and the idle-court nudge.
      kiosk: ["addWalkup", "confirmCourt", "finishCourt", "swapNoShow"],
    },
  );
  assert.equal(FLOOR_PERMISSIONS.organizer.undo, true);
  assert.equal(FLOOR_PERMISSIONS.volunteer.undo, true);
  assert.equal(FLOOR_PERMISSIONS.kiosk.undo, true);
});

const config: SessionConfig = {
  sessionId: "session-1",
  clubId: "club-1",
  venueName: "Ramsden Park",
  courtCount: 8,
  groupCap: 4,
  floorMode: "hybrid",
  seed: "seed-1",
};
const organizer: Operator = { kind: "organizer", userId: "vanessa" };
const player: Operator = { kind: "player" };
const ids: FloorIds = { walkupToken: "walkup-1", groupId: "group-1" };

/** Eight joined-and-queued Players, then Court 1 filled once. */
function board() {
  let at = 1_000;
  const events: SessionEvent[] = [
    { type: "SESSION_STARTED", at: (at += 1), operator: organizer },
  ];
  for (let i = 1; i <= 8; i++) {
    events.push({
      type: "PLAYER_JOINED",
      at: (at += 1),
      operator: player,
      token: `p${i}`,
      firstName: `P${i}`,
      lastInitial: "X",
      skillLevel: "intermediate",
    });
  }
  for (let i = 1; i <= 8; i++) {
    events.push({ type: "PLAYER_QUEUED", at: (at += 1), operator: player, token: `p${i}` });
  }
  events.push({ type: "COURT_FINISHED", at: (at += 1), operator: organizer, court: 1 });
  const state = reduceSession(config, events);
  const nameOf = (id: string) =>
    state.roster.find((p) => p.id === id)?.displayName ?? "?";
  return { state, nameOf };
}

test("each command kind reaches its floor-ops decision", () => {
  const { state, nameOf } = board();
  const since = state.courts[0].since;
  const onCourt = state.courts[0].foursome[0];
  const waiting = state.queue[0].playerId;
  const waiting2 = state.queue[1].playerId;

  const cases: [FloorOperatorKind, FloorCommand, unknown][] = [
    [
      "organizer",
      { kind: "finishCourt", court: 1, since },
      { kind: "event", body: { type: "COURT_FINISHED", court: 1 } },
    ],
    [
      "kiosk",
      { kind: "confirmCourt", court: 1, since },
      { kind: "event", body: { type: "COURT_CONFIRMED", court: 1, since } },
    ],
    [
      "volunteer",
      { kind: "setAside", name: nameOf(waiting) },
      {
        kind: "event",
        body: { type: "PLAYER_PAUSED", token: waiting, reason: "set-aside" },
      },
    ],
    [
      "volunteer",
      { kind: "bringBack", name: nameOf(waiting) },
      { kind: "event", body: { type: "PLAYER_REQUEUED", token: waiting } },
    ],
    [
      "kiosk",
      { kind: "addWalkup", firstName: " Ben ", lastInitial: "johns", skillLevel: "advanced" },
      {
        kind: "event",
        body: {
          type: "PLAYER_JOINED",
          token: "walkup-1",
          firstName: "Ben",
          lastInitial: "J",
          skillLevel: "advanced",
          queueOnJoin: true,
        },
      },
    ],
    [
      "organizer",
      { kind: "overrideSkill", name: nameOf(waiting), skillLevel: "advanced" },
      {
        kind: "event",
        body: { type: "PLAYER_SKILL_SET", token: waiting, skillLevel: "advanced" },
      },
    ],
    [
      "kiosk",
      {
        kind: "swapNoShow",
        court: 1,
        since,
        outName: nameOf(onCourt),
        inName: nameOf(waiting),
      },
      {
        kind: "event",
        body: { type: "FOURSOME_MEMBER_SWAPPED", court: 1, out: onCourt, in: waiting },
      },
    ],
    [
      "volunteer",
      { kind: "formGroup", names: [nameOf(waiting), nameOf(waiting2)] },
      {
        kind: "event",
        body: { type: "GROUP_FORMED", groupId: "group-1", memberTokens: [waiting, waiting2] },
      },
    ],
    // No such waiting Group: dissolveGroupOutcome's no-op.
    ["volunteer", { kind: "dissolveGroup", groupId: "group-gone" }, { kind: "noop" }],
    [
      "organizer",
      { kind: "lowerGroupCap", cap: 9 },
      { kind: "error", error: "Pick a cap between 2 and 4." },
    ],
    [
      "volunteer",
      { kind: "lastCall" },
      { kind: "event", body: { type: "LAST_CALL" } },
    ],
    [
      "organizer",
      { kind: "closeSession" },
      { kind: "event", body: { type: "SESSION_CLOSED" } },
    ],
  ];

  assert.equal(new Set(cases.map(([, c]) => c.kind)).size, 12);
  for (const [operator, command, expected] of cases) {
    assert.deepEqual(
      dispatchFloorCommand(state, operator, command, ids),
      expected,
      `${operator} ${command.kind}`,
    );
  }
});

test("the dispatcher refuses a command outside the Operator's set", () => {
  const { state, nameOf } = board();
  const refused = { kind: "error", error: "That didn't go through. Try again." };
  const since = state.courts[0].since;

  assert.deepEqual(
    dispatchFloorCommand(state, "volunteer", { kind: "closeSession" }, ids),
    refused,
  );
  assert.deepEqual(
    dispatchFloorCommand(
      state,
      "kiosk",
      { kind: "setAside", name: nameOf(state.queue[0].playerId) },
      ids,
    ),
    refused,
  );
  assert.deepEqual(
    dispatchFloorCommand(state, "organizer", { kind: "confirmCourt", court: 1, since }, ids),
    refused,
  );
  assert.deepEqual(
    dispatchFloorCommand(state, "kiosk", { kind: "lastCall" }, ids),
    refused,
  );
  // A client can post anything; an unknown kind is refused, not thrown on.
  assert.deepEqual(
    dispatchFloorCommand(state, "organizer", { kind: "dropTable" } as unknown as FloorCommand, ids),
    refused,
  );
});
