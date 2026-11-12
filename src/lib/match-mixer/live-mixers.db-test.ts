/**
 * The Live Mixer store against the local database (#687): a signed-in
 * organizer goes live and owns the night, a signed-out one is refused, and
 * either link's token reads it back with no account. Deleting the throwaway
 * organizers takes their Live Mixers with them.
 */

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { anonClient, createTestUser, deleteTestUser, type TestUser } from "../db-test-support.ts";
import { encodeSharePayload } from "../../components/apps/match-mixer/lib/persistence/share-link.ts";
import { parseRoster } from "../../components/apps/match-mixer/lib/engine/roster.ts";
import { goLive, readLiveMixer, SIGN_IN_TO_GO_LIVE, UNREADABLE_BOARD } from "./live-mixers.ts";

const CONFIG = encodeSharePayload({
  roster: parseRoster(
    ["Ben Johns", "Anna Leigh Waters", "JW Johnson", "Anna Bright", "Tyson McGuffin", "Jorja Johnson", "Collin Johns", "Lea Jansen"].join("\n"),
  ),
  courts: 2,
  rounds: 4,
  seed: 4242,
  format: "rotating",
  mixed: false,
});

const organizers: TestUser[] = [];

after(async () => {
  for (const organizer of organizers) await deleteTestUser(organizer);
});

async function organizer(): Promise<TestUser> {
  const user = await createTestUser("Anna Leigh Waters");
  organizers.push(user);
  return user;
}

let shared: TestUser | undefined;

async function live() {
  shared ??= await organizer();
  const outcome = await goLive(shared.supabase, CONFIG);
  assert.ok(outcome.ok, "expected the board to go live");
  return outcome.value;
}

test("a signed-in organizer goes live and gets two different tokens", async () => {
  const { organizerToken, playerToken } = await live();
  assert.match(organizerToken, /^[0-9a-f]{32}$/);
  assert.match(playerToken, /^[0-9a-f]{32}$/);
  assert.notEqual(organizerToken, playerToken);
});

test("signed out, going live is refused and asks for sign-in", async () => {
  assert.deepEqual(await goLive(anonClient(), CONFIG), {
    ok: false,
    problem: SIGN_IN_TO_GO_LIVE,
    signIn: true,
  });
});

test("the Organizer Link reads the Config and the Player Link's token, signed out", async () => {
  const { organizerToken, playerToken } = await live();
  const mixer = await readLiveMixer(anonClient(), organizerToken);
  assert.equal(mixer?.role, "organizer");
  assert.equal(mixer?.config, CONFIG);
  assert.equal(mixer?.playerToken, playerToken);
  assert.equal(mixer?.finishedAt, null);
});

test("the Player Link reads the Config and never the Organizer Link's token or the Owner", async () => {
  const { organizerToken, playerToken } = await live();
  const mixer = await readLiveMixer(anonClient(), playerToken);
  assert.equal(mixer?.role, "player");
  assert.equal(mixer?.config, CONFIG);
  assert.equal(mixer?.playerToken, null);
  const text = JSON.stringify(mixer);
  assert.ok(!text.includes(organizerToken));
  assert.ok(!text.includes(shared!.userId));
});

test("a token that isn't one reads as nothing", async () => {
  assert.equal(await readLiveMixer(anonClient(), "0".repeat(32)), null);
  assert.equal(await readLiveMixer(anonClient(), ""), null);
});

test("a Config the Share Link reader refuses never reaches the database", async () => {
  const user = await organizer();
  const outcome = await goLive(user.supabase, "1.2.4.99.notachecksum\nBen Johns");
  assert.deepEqual(outcome, { ok: false, problem: UNREADABLE_BOARD });
});

test("one account can take 20 boards live in a day, not 21", async () => {
  const user = await organizer();
  for (let i = 0; i < 20; i++) assert.ok((await goLive(user.supabase, CONFIG)).ok, `board ${i + 1}`);
  const refused = await goLive(user.supabase, CONFIG);
  assert.equal(refused.ok, false);
  assert.match(!refused.ok ? refused.problem : "", /20 boards live in a day/);
});

test("the tables themselves are shut, signed in or out", async () => {
  const user = await organizer();
  for (const client of [anonClient(), user.supabase]) {
    const mixers = await client.from("match_mixer_live_mixers").select("id");
    assert.ok(mixers.error, "expected no table access to Live Mixers");
    const events = await client.from("match_mixer_events").select("id");
    assert.ok(events.error, "expected no table access to events");
  }
});
