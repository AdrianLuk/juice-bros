import assert from "node:assert/strict";
import test from "node:test";

import {
  assembleLoadedSession,
  decode,
  decodeLog,
  encode,
  type EventRow,
} from "./codec.ts";
import type { EventBody, Operator, SessionConfig } from "./types.ts";

// Pinned shapes. SQL reads these keys by name (unique indexes on
// `payload->>'token'`, `on_deck_is_paused` reading `token` / `out`, the queue
// and form-group pre-checks, the Volunteer and Kiosk append whitelists), and
// there is no migration to rename them, so a renamed key has to fail here.

const cases: ReadonlyArray<[EventBody, { type: string; payload: object }]> = [
  [
    {
      type: "PLAYER_JOINED",
      token: "t1",
      firstName: "Ben",
      lastInitial: "J",
      skillLevel: "advanced",
    },
    {
      type: "PLAYER_JOINED",
      payload: {
        token: "t1",
        firstName: "Ben",
        lastInitial: "J",
        skillLevel: "advanced",
      },
    },
  ],
  [
    {
      type: "PLAYER_JOINED",
      token: "walkup-1",
      firstName: "Anna",
      lastInitial: "W",
      skillLevel: "intermediate",
      queueOnJoin: true,
    },
    {
      type: "PLAYER_JOINED",
      payload: {
        token: "walkup-1",
        firstName: "Anna",
        lastInitial: "W",
        skillLevel: "intermediate",
        queueOnJoin: true,
      },
    },
  ],
  [
    { type: "PLAYER_SKILL_SET", token: "t1", skillLevel: "beginner" },
    {
      type: "PLAYER_SKILL_SET",
      payload: { token: "t1", skillLevel: "beginner" },
    },
  ],
  [
    { type: "PLAYER_QUEUED", token: "t1" },
    { type: "PLAYER_QUEUED", payload: { token: "t1" } },
  ],
  [
    { type: "COURT_FINISHED", court: 3 },
    { type: "COURT_FINISHED", payload: { court: 3 } },
  ],
  [
    { type: "COURT_CONFIRMED", court: 2, since: 1_700_000_000_000 },
    {
      type: "COURT_CONFIRMED",
      payload: { court: 2, since: 1_700_000_000_000 },
    },
  ],
  [
    { type: "COURT_CONFIRMED", court: 2, since: null },
    { type: "COURT_CONFIRMED", payload: { court: 2, since: null } },
  ],
  [
    { type: "PLAYER_PAUSED", token: "t1", reason: "set-aside" },
    { type: "PLAYER_PAUSED", payload: { token: "t1", reason: "set-aside" } },
  ],
  [
    { type: "PLAYER_REQUEUED", token: "t1" },
    { type: "PLAYER_REQUEUED", payload: { token: "t1" } },
  ],
  [
    { type: "FOURSOME_MEMBER_SWAPPED", court: 4, out: "t1", in: "t2" },
    {
      type: "FOURSOME_MEMBER_SWAPPED",
      payload: { court: 4, out: "t1", in: "t2" },
    },
  ],
  [
    { type: "GROUP_FORMED", groupId: "group-1", memberTokens: ["t1", "t2"] },
    {
      type: "GROUP_FORMED",
      payload: { groupId: "group-1", memberTokens: ["t1", "t2"] },
    },
  ],
  [
    { type: "GROUP_MEMBER_REMOVED", groupId: "group-1", token: "t2" },
    {
      type: "GROUP_MEMBER_REMOVED",
      payload: { groupId: "group-1", token: "t2" },
    },
  ],
  [
    { type: "GROUP_DISSOLVED", groupId: "group-1" },
    { type: "GROUP_DISSOLVED", payload: { groupId: "group-1" } },
  ],
  [
    { type: "GROUP_CAP_CHANGED", cap: 3 },
    { type: "GROUP_CAP_CHANGED", payload: { cap: 3 } },
  ],
  // Structural events carry no payload keys: SQL builds SESSION_STARTED's
  // config keys itself, and nothing decodes them.
  [{ type: "SESSION_STARTED" }, { type: "SESSION_STARTED", payload: {} }],
  [{ type: "LAST_CALL" }, { type: "LAST_CALL", payload: {} }],
  [{ type: "SESSION_CLOSED" }, { type: "SESSION_CLOSED", payload: {} }],
];

for (const [body, expected] of cases) {
  test(`encode pins the ${body.type} payload keys${
    "queueOnJoin" in body ? " with queueOnJoin" : ""
  }${"since" in body && body.since === null ? " and a null since" : ""}`, () => {
    assert.deepEqual(encode(body), expected);
  });
}

test("encode covers every SessionEvent type", () => {
  const types = new Set(cases.map(([body]) => body.type));
  assert.equal(types.size, 15);
});

test("encode writes queueOnJoin only when the body carries it", () => {
  const { payload } = encode({
    type: "PLAYER_JOINED",
    token: "t1",
    firstName: "Ben",
    lastInitial: "J",
    skillLevel: "advanced",
  });
  assert.equal("queueOnJoin" in payload, false);
});

test("encode copies memberTokens instead of aliasing the body's array", () => {
  const memberTokens = ["t1", "t2"];
  const { payload } = encode({ type: "GROUP_FORMED", groupId: "g", memberTokens });
  assert.notEqual(payload.memberTokens, memberTokens);
});

// ── decode ──────────────────────────────────────────────────────────────────

const AT = "2026-10-08T19:30:00.000Z";
const AT_MS = Date.parse(AT);

/** The row Postgres hands back for an encoded body, as `operator` wrote it. */
function rowFor(
  body: EventBody,
  operator: Operator = { kind: "organizer", userId: "user-1" },
  seq = 1,
): EventRow {
  const { type, payload } = encode(body);
  return {
    seq,
    type,
    at: AT,
    operator_kind: operator.kind,
    operator_user_id: operator.kind === "organizer" ? operator.userId : null,
    payload,
  };
}

/** A row with `payload` swapped for a hand-written one. */
function rowWith(type: string, payload: Record<string, unknown> | null): EventRow {
  return { ...rowFor({ type: "LAST_CALL" }), type, payload };
}

function rejected(row: EventRow): boolean {
  return !decode(row).ok;
}

for (const [body] of cases) {
  test(`decode(encode(body)) gives back the ${body.type} event${
    "queueOnJoin" in body ? " with queueOnJoin" : ""
  }${"since" in body && body.since === null ? " and a null since" : ""}`, () => {
    const operator: Operator = { kind: "organizer", userId: "user-1" };
    assert.deepEqual(decode(rowFor(body, operator)), {
      ok: true,
      event: { ...body, at: AT_MS, operator },
    });
  });
}

test("decode rejects an empty string in every string field", () => {
  const joined = {
    token: "t1",
    firstName: "Ben",
    lastInitial: "J",
    skillLevel: "advanced",
  };
  for (const key of ["token", "firstName", "lastInitial"]) {
    assert.ok(rejected(rowWith("PLAYER_JOINED", { ...joined, [key]: "" })), key);
  }
  assert.ok(rejected(rowWith("PLAYER_SKILL_SET", { token: "", skillLevel: "beginner" })));
  assert.ok(rejected(rowWith("PLAYER_QUEUED", { token: "" })));
  assert.ok(rejected(rowWith("PLAYER_REQUEUED", { token: "" })));
  assert.ok(rejected(rowWith("PLAYER_PAUSED", { token: "", reason: "left" })));
  assert.ok(rejected(rowWith("FOURSOME_MEMBER_SWAPPED", { court: 1, out: "", in: "t2" })));
  assert.ok(rejected(rowWith("FOURSOME_MEMBER_SWAPPED", { court: 1, out: "t1", in: "" })));
  assert.ok(rejected(rowWith("GROUP_FORMED", { groupId: "", memberTokens: ["t1"] })));
  assert.ok(rejected(rowWith("GROUP_FORMED", { groupId: "g", memberTokens: ["t1", ""] })));
  assert.ok(rejected(rowWith("GROUP_MEMBER_REMOVED", { groupId: "", token: "t1" })));
  assert.ok(rejected(rowWith("GROUP_MEMBER_REMOVED", { groupId: "g", token: "" })));
  assert.ok(rejected(rowWith("GROUP_DISSOLVED", { groupId: "" })));
});

test("decode rejects a COURT_CONFIRMED whose since is missing or not a number", () => {
  assert.ok(rejected(rowWith("COURT_CONFIRMED", { court: 2 })));
  assert.ok(rejected(rowWith("COURT_CONFIRMED", { court: 2, since: "1700" })));
});

test("decode rejects a missing or wrong-typed field the variant needs", () => {
  assert.ok(rejected(rowWith("COURT_FINISHED", {})));
  assert.ok(rejected(rowWith("COURT_FINISHED", { court: 1.5 })));
  assert.ok(rejected(rowWith("GROUP_CAP_CHANGED", { cap: "3" })));
  assert.ok(rejected(rowWith("PLAYER_SKILL_SET", { token: "t1", skillLevel: "pro" })));
  assert.ok(rejected(rowWith("PLAYER_PAUSED", { token: "t1", reason: "bored" })));
  assert.ok(rejected(rowWith("GROUP_FORMED", { groupId: "g", memberTokens: "t1" })));
  assert.ok(rejected(rowWith("PLAYER_QUEUED", null)));
  assert.ok(
    rejected(
      rowWith("PLAYER_JOINED", {
        token: "t1",
        firstName: "Ben",
        lastInitial: "J",
        skillLevel: "advanced",
        queueOnJoin: "true",
      }),
    ),
  );
});

test("decode rejects the types the DB allows but SessionEvent lacks", () => {
  assert.ok(rejected(rowWith("GROUP_MEMBER_ADDED", { groupId: "g", token: "t1" })));
  assert.ok(rejected(rowWith("FLOOR_MODE_CHANGED", { floorMode: "hybrid" })));
  assert.ok(rejected(rowWith("NOT_A_TYPE", {})));
});

test("decode rejects an organizer row with no account behind it", () => {
  const row: EventRow = {
    ...rowFor({ type: "COURT_FINISHED", court: 1 }),
    operator_user_id: null,
  };
  assert.ok(rejected(row));
});

test("decode rejects an unknown Operator kind or an unreadable at", () => {
  const row = rowFor({ type: "COURT_FINISHED", court: 1 });
  assert.ok(rejected({ ...row, operator_kind: "robot" }));
  assert.ok(rejected({ ...row, at: "not a time" }));
});

// ── decodeLog / assembleLoadedSession ───────────────────────────────────────

const CONFIG: SessionConfig = {
  sessionId: "session-1",
  clubId: "club-1",
  venueName: "Ramsden Park",
  courtCount: 2,
  groupCap: 4,
  floorMode: "hybrid",
  seed: "seed-1",
};

const ORGANIZER: Operator = { kind: "organizer", userId: "user-1" };

/** Run `fn` with `console.error` captured, so a skipped row's log is checked
 * rather than printed. */
function capturingErrors<T>(fn: () => T): { result: T; logged: unknown[][] } {
  const logged: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => void logged.push(args);
  try {
    return { result: fn(), logged };
  } finally {
    console.error = original;
  }
}

test("assembleLoadedSession picks the last decoded event when the last row is rejected", () => {
  const rows: EventRow[] = [
    rowFor({ type: "SESSION_STARTED" }, ORGANIZER, 101),
    rowFor({ type: "COURT_FINISHED", court: 1 }, ORGANIZER, 205),
    // Undoable type, unreadable payload: Undo must not be offered on it.
    rowWith("COURT_FINISHED", { court: "one" }),
  ];
  rows[2] = { ...rows[2], seq: 310 };

  const { result: loaded, logged } = capturingErrors(() =>
    assembleLoadedSession(CONFIG, "open", decodeLog(rows)),
  );

  assert.deepEqual(loaded.lastEvent, {
    seq: 205,
    type: "COURT_FINISHED",
    at: AT_MS,
    operator: ORGANIZER,
  });
  assert.deepEqual(
    loaded.events.map((e) => e.type),
    ["SESSION_STARTED", "COURT_FINISHED"],
  );
  assert.equal(loaded.state.status, "open");
  assert.equal(loaded.status, "open");
  assert.equal(loaded.config, CONFIG);

  assert.equal(logged.length, 1);
  const line = JSON.stringify(logged[0]);
  assert.match(line, /310/);
  assert.match(line, /COURT_FINISHED/);
});

test("assembleLoadedSession has no lastEvent for an empty or wholly rejected log", () => {
  assert.equal(assembleLoadedSession(CONFIG, "open", decodeLog([])).lastEvent, null);

  const { result } = capturingErrors(() =>
    decodeLog([rowWith("GROUP_MEMBER_ADDED", { groupId: "g", token: "t1" })]),
  );
  assert.deepEqual(result, { events: [], lastEvent: null });
});

test("assembleLoadedSession takes status from its caller, not the fold", () => {
  const log = decodeLog([rowFor({ type: "SESSION_STARTED" }, ORGANIZER, 1)]);
  assert.equal(assembleLoadedSession(CONFIG, "closed", log).status, "closed");
});

test("decode builds a non-organizer Operator from the columns alone", () => {
  for (const kind of ["volunteer", "kiosk", "player"] as const) {
    const result = decode(rowFor({ type: "COURT_FINISHED", court: 1 }, { kind }));
    assert.deepEqual(result, {
      ok: true,
      event: { type: "COURT_FINISHED", court: 1, at: AT_MS, operator: { kind } },
    });
  }
});
