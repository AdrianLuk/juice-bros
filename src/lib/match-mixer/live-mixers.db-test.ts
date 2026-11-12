/**
 * The Live Mixer store against the local database (#687): going live signed
 * out, reading through either link's token, and the tables staying shut to
 * everyone but the functions.
 */

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { anonClient, serviceRoleClient } from "../db-test-support.ts";
import { encodeSharePayload } from "../../components/apps/match-mixer/lib/persistence/share-link.ts";
import { parseRoster } from "../../components/apps/match-mixer/lib/engine/roster.ts";
import { goLive, readLiveMixer, UNREADABLE_BOARD } from "./live-mixers.ts";

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

const made: string[] = [];

after(async () => {
  if (made.length === 0) return;
  const { error } = await serviceRoleClient()
    .from("match_mixer_live_mixers")
    .delete()
    .in("player_token", made);
  assert.equal(error, null);
});

async function live() {
  const outcome = await goLive(anonClient(), CONFIG);
  assert.ok(outcome.ok, "expected the board to go live");
  made.push(outcome.value.playerToken);
  return outcome.value;
}

test("a signed-out organizer goes live and gets two different tokens", async () => {
  const { organizerToken, playerToken } = await live();
  assert.match(organizerToken, /^[0-9a-f]{32}$/);
  assert.match(playerToken, /^[0-9a-f]{32}$/);
  assert.notEqual(organizerToken, playerToken);
});

test("the Organizer Link reads the Config and the Player Link's token", async () => {
  const { organizerToken, playerToken } = await live();
  const mixer = await readLiveMixer(anonClient(), organizerToken);
  assert.equal(mixer?.role, "organizer");
  assert.equal(mixer?.config, CONFIG);
  assert.equal(mixer?.playerToken, playerToken);
  assert.equal(mixer?.finishedAt, null);
});

test("the Player Link reads the Config and never the Organizer Link's token", async () => {
  const { organizerToken, playerToken } = await live();
  const mixer = await readLiveMixer(anonClient(), playerToken);
  assert.equal(mixer?.role, "player");
  assert.equal(mixer?.config, CONFIG);
  assert.equal(mixer?.playerToken, null);
  assert.ok(!JSON.stringify(mixer).includes(organizerToken));
});

test("a token that isn't one reads as nothing", async () => {
  assert.equal(await readLiveMixer(anonClient(), "0".repeat(32)), null);
  assert.equal(await readLiveMixer(anonClient(), ""), null);
});

test("a Config the Share Link reader refuses never reaches the database", async () => {
  const outcome = await goLive(anonClient(), "1.2.4.99.notachecksum\nBen Johns");
  assert.deepEqual(outcome, { ok: false, problem: UNREADABLE_BOARD });
});

test("signed out, the tables themselves are shut", async () => {
  await live();
  const mixers = await anonClient().from("match_mixer_live_mixers").select("id");
  assert.ok(mixers.error, "expected no table access to Live Mixers");
  const events = await anonClient().from("match_mixer_events").select("id");
  assert.ok(events.error, "expected no table access to events");
});
