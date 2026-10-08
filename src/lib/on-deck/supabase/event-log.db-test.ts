/**
 * The `SessionEventLog` contract (issue #618), run against both adapters: the
 * Supabase one on the local database as a signed-in Organizer (what the live
 * loader and the Organizer's floor writes go through), and the in-memory one
 * built from the same `DemoLog` functions the Demo night runs. Whatever holds
 * the log, append then load gives the same events back in the same order,
 * stamped by the log itself; `lastEvent` carries the `seq` the newest one was
 * stored under; and `lastRowAt` is the newest row's `at`.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";

import {
  createTestUser,
  deleteTestUser,
  serviceRoleClient,
  type TestUser,
} from "../../db-test-support.ts";
import { inMemoryEventLog } from "../demo/fold.ts";
import type { SessionEventLog } from "../session/codec.ts";
import type { EventBody, Operator } from "../session/types.ts";
import { supabaseEventLog } from "./event-log.ts";

type Subject = { log: SessionEventLog; sessionId: string; organizer: Operator };

const users: TestUser[] = [];
const clubIds: string[] = [];

after(async () => {
  // Clubs first: deleting an Organizer would null `operator_user_id` on their
  // events before the cascade reached them, which the organizer-has-an-account
  // CHECK refuses. A Club takes its Sessions and their logs with it.
  if (clubIds.length > 0) {
    const { error } = await serviceRoleClient().from("on_deck_clubs").delete().in("id", clubIds);
    if (error) throw new Error(`deleting the test Clubs failed: ${error.message}`);
  }
  await Promise.all(users.map(deleteTestUser));
});

/** A fresh Organizer with a Club and an open Session, so each test owns its
 * log (one open Session per Club). */
async function supabaseSubject(): Promise<Subject> {
  const owner = await createTestUser("Event Log Organizer");
  users.push(owner);
  const admin = serviceRoleClient();

  const { data: club, error: clubError } = await admin
    .from("on_deck_clubs")
    .insert({
      owner_id: owner.userId,
      name: `Test Club ${randomUUID().slice(0, 8)}`,
      venue_name: "Ramsden Park",
      court_count: 4,
      group_cap: 4,
      floor_mode: "hybrid",
    })
    .select("id")
    .single();
  if (clubError || !club) throw new Error(`seeding a Club failed: ${clubError?.message}`);
  clubIds.push(club.id);

  const { data: session, error: sessionError } = await admin
    .from("on_deck_sessions")
    .insert({
      club_id: club.id,
      venue_name: "Ramsden Park",
      court_count: 4,
      group_cap: 4,
      floor_mode: "hybrid",
    })
    .select("id")
    .single();
  if (sessionError || !session) {
    throw new Error(`seeding a Session failed: ${sessionError?.message}`);
  }

  return {
    log: supabaseEventLog(owner.supabase),
    sessionId: session.id,
    organizer: { kind: "organizer", userId: owner.userId },
  };
}

async function inMemorySubject(): Promise<Subject> {
  return {
    log: inMemoryEventLog(),
    sessionId: "session-1",
    organizer: { kind: "organizer", userId: "demo-organizer" },
  };
}

const ADAPTERS: [string, () => Promise<Subject>][] = [
  ["Supabase", supabaseSubject],
  ["in-memory", inMemorySubject],
];

/** How far the database's clock may sit from this process's: same machine, but
 * Docker's VM keeps its own. */
const CLOCK_SLACK_MS = 60_000;

/** An event less its stamp, to compare what was appended with what came back. */
function unstamped<E extends { at: number }>(event: E): Omit<E, "at"> {
  const { at, ...rest } = event;
  void at;
  return rest;
}

for (const [name, subject] of ADAPTERS) {
  test(`${name}: append then load gives the events back in order, stamped by the log`, async () => {
    const { log, sessionId, organizer } = await subject();
    const bodies: EventBody[] = [
      { type: "SESSION_STARTED" },
      {
        type: "PLAYER_JOINED",
        token: "walkup-1",
        firstName: "Ben",
        lastInitial: "J",
        skillLevel: "advanced",
        queueOnJoin: true,
      },
      { type: "COURT_CONFIRMED", court: 1, since: null },
      { type: "COURT_FINISHED", court: 1 },
    ];

    assert.deepEqual(await log.load(sessionId), {
      events: [],
      lastEvent: null,
      lastRowAt: null,
    });

    const before = Date.now();
    for (const body of bodies) await log.append(sessionId, body, organizer);
    const done = Date.now();
    const loaded = await log.load(sessionId);

    assert.deepEqual(
      loaded.events.map(unstamped),
      bodies.map((body) => ({ ...body, operator: organizer })),
    );
    const stamps = loaded.events.map((event) => event.at);
    for (const [i, at] of stamps.entries()) {
      assert.ok(at >= before - CLOCK_SLACK_MS && at <= done + CLOCK_SLACK_MS, `at ${at}`);
      if (i > 0) assert.ok(at >= stamps[i - 1], `stamps run forward: ${stamps}`);
    }

    assert.ok(loaded.lastEvent);
    const { seq, ...newest } = loaded.lastEvent;
    assert.ok(Number.isInteger(seq), String(seq));
    assert.deepEqual(newest, {
      type: "COURT_FINISHED",
      at: stamps[stamps.length - 1],
      operator: organizer,
    });
    assert.equal(loaded.lastRowAt, loaded.lastEvent.at);
  });

  test(`${name}: lastEvent's seq moves on with every append`, async () => {
    const { log, sessionId, organizer } = await subject();
    await log.append(sessionId, { type: "SESSION_STARTED" }, organizer);
    const first = (await log.load(sessionId)).lastEvent;

    await log.append(sessionId, { type: "COURT_FINISHED", court: 2 }, organizer);
    const second = (await log.load(sessionId)).lastEvent;

    assert.ok(first && second);
    assert.ok(second.seq > first.seq, `${second.seq} after ${first.seq}`);
    assert.equal(second.type, "COURT_FINISHED");
  });

  test(`${name}: loads all 1,001 events of a log past PostgREST's 1,000-row cap`, async () => {
    const { log, sessionId, organizer } = await subject();
    const bodies: EventBody[] = [{ type: "SESSION_STARTED" }];
    for (let i = 1; i <= 1_000; i++) {
      bodies.push({ type: "COURT_FINISHED", court: (i % 4) + 1 });
    }

    for (const body of bodies) await log.append(sessionId, body, organizer);
    const loaded = await log.load(sessionId);

    assert.equal(loaded.events.length, 1_001);
    assert.deepEqual(
      loaded.events.map(unstamped),
      bodies.map((body) => ({ ...body, operator: organizer })),
    );
    assert.equal(loaded.lastRowAt, loaded.events[1_000].at);
  });
}

test("Supabase: a newest row that fails to decode is still the newest row for lastRowAt", async () => {
  const { log, sessionId, organizer } = await supabaseSubject();
  await log.append(sessionId, { type: "COURT_FINISHED", court: 1 }, organizer);
  const good = (await log.load(sessionId)).lastEvent;
  assert.ok(good);

  // A COURT_FINISHED with no court: the decoder skips it, but auto-close's SQL
  // still counts it in `max(at)`. Stamped well after the good row, so the two
  // can't be confused.
  const badAt = good.at + 120_000;
  const { error } = await serviceRoleClient()
    .from("on_deck_session_events")
    .insert({
      session_id: sessionId,
      type: "COURT_FINISHED",
      operator_kind: "organizer",
      operator_user_id: organizer.kind === "organizer" ? organizer.userId : null,
      payload: {},
      at: new Date(badAt).toISOString(),
    });
  if (error) throw new Error(`writing the bad row failed: ${error.message}`);

  const loaded = await log.load(sessionId);
  assert.deepEqual(loaded.lastEvent, good, "Undo still targets the last event the fold applied");
  assert.equal(loaded.lastRowAt, badAt);
});
