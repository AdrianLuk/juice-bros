/**
 * The `SessionEventLog` contract (issue #618), run against both adapters: the
 * Supabase one on the local database as a signed-in Organizer, and the
 * in-memory one the Demo night uses. Whatever holds the log, append then load
 * gives the same events back in the same order, and `lastEvent` carries the
 * `seq` the newest one was stored under.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";

import {
  createTestUser,
  deleteTestUser,
  serviceRoleClient,
  type TestUser,
} from "../../booking-buddy/db-test-support.ts";
import { inMemoryEventLog } from "../demo/fold.ts";
import type { SessionEventLog } from "../session/codec.ts";
import type { Operator, SessionEvent } from "../session/types.ts";
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

/** Whole milliseconds, a little apart: what `timestamptz` keeps exactly. */
const T0 = Date.parse("2026-10-08T19:00:00.000Z");

for (const [name, subject] of ADAPTERS) {
  test(`${name}: append then load gives the events back in order`, async () => {
    const { log, sessionId, organizer } = await subject();
    const events: SessionEvent[] = [
      { type: "SESSION_STARTED", at: T0, operator: organizer },
      {
        type: "PLAYER_JOINED",
        at: T0 + 1_000,
        operator: organizer,
        token: "walkup-1",
        firstName: "Ben",
        lastInitial: "J",
        skillLevel: "advanced",
        queueOnJoin: true,
      },
      { type: "COURT_CONFIRMED", at: T0 + 2_000, operator: organizer, court: 1, since: null },
      { type: "COURT_FINISHED", at: T0 + 3_000, operator: organizer, court: 1 },
    ];

    assert.deepEqual(await log.load(sessionId), { events: [], lastEvent: null });

    for (const event of events) await log.append(sessionId, event);
    const loaded = await log.load(sessionId);

    assert.deepEqual(loaded.events, events);
    assert.ok(loaded.lastEvent);
    const { seq, ...newest } = loaded.lastEvent;
    assert.ok(Number.isInteger(seq), String(seq));
    assert.deepEqual(newest, { type: "COURT_FINISHED", at: T0 + 3_000, operator: organizer });
  });

  test(`${name}: lastEvent's seq moves on with every append`, async () => {
    const { log, sessionId, organizer } = await subject();
    await log.append(sessionId, { type: "SESSION_STARTED", at: T0, operator: organizer });
    const first = (await log.load(sessionId)).lastEvent;

    await log.append(sessionId, {
      type: "COURT_FINISHED",
      at: T0 + 1_000,
      operator: organizer,
      court: 2,
    });
    const second = (await log.load(sessionId)).lastEvent;

    assert.ok(first && second);
    assert.ok(second.seq > first.seq, `${second.seq} after ${first.seq}`);
    assert.equal(second.type, "COURT_FINISHED");
  });

  test(`${name}: loads all 1,001 events of a log past PostgREST's 1,000-row cap`, async () => {
    const { log, sessionId, organizer } = await subject();
    const events: SessionEvent[] = [{ type: "SESSION_STARTED", at: T0, operator: organizer }];
    for (let i = 1; i <= 1_000; i++) {
      events.push({
        type: "COURT_FINISHED",
        at: T0 + i * 1_000,
        operator: organizer,
        court: (i % 4) + 1,
      });
    }

    for (const event of events) await log.append(sessionId, event);
    const loaded = await log.load(sessionId);

    assert.equal(loaded.events.length, 1_001);
    assert.deepEqual(loaded.events, events);
    assert.equal(loaded.lastEvent?.at, T0 + 1_000_000);
  });
}
