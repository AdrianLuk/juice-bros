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
import { gameKey, replay, type GameAt } from "../../components/apps/match-mixer/lib/live/events.ts";
import { gameOn, playsIn, redraw } from "../../components/apps/match-mixer/lib/live/rebuild.ts";
import {
  changeGameRule,
  clearScore,
  enterScore,
  goLive,
  LAST_ROUND,
  NOT_ON_THE_BOARD,
  NOT_YOUR_GAME,
  ONE_ROUND_AT_A_TIME,
  ORGANIZER_ONLY,
  PICK_YOUR_NAME,
  readLiveMixer,
  SIGN_IN_TO_GO_LIVE,
  startRound,
  UNREADABLE_BOARD,
} from "./live-mixers.ts";

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

// #688: scores and the Game Rule.

/** The first Round's two Games on CONFIG's board. */
const FIRST: GameAt = { round: 0, court: 0 };
const SECOND: GameAt = { round: 0, court: 1 };

async function replayedAt(token: string) {
  const mixer = await readLiveMixer(anonClient(), token);
  assert.ok(mixer, "expected a Live Mixer");
  return replay(mixer.events);
}

test("going live with a Game Rule makes it the night's rule; without one it plays to 11, win by 2", async () => {
  const user = await organizer();
  const picked = await goLive(user.supabase, CONFIG, { to: 15, winBy: 1 });
  assert.ok(picked.ok);
  assert.deepEqual((await replayedAt(picked.value.playerToken)).rule, { to: 15, winBy: 1 });

  const plain = await goLive(user.supabase, CONFIG);
  assert.ok(plain.ok);
  assert.deepEqual((await replayedAt(plain.value.playerToken)).rule, { to: 11, winBy: 2 });
});

test("the Organizer Link enters, changes and clears a score, signed out, and the Player Link reads it", async () => {
  const { organizerToken, playerToken } = await live();
  assert.ok(gameOn(redraw(CONFIG)!, FIRST), "CONFIG's board has a Game on court 1 in Round 1");

  assert.deepEqual(await enterScore(anonClient(), organizerToken, FIRST, [11, 7]), { ok: true, value: null });
  assert.deepEqual((await replayedAt(playerToken)).scores.get(gameKey(0, 0)), [11, 7]);

  assert.ok((await enterScore(anonClient(), organizerToken, FIRST, [13, 11])).ok);
  assert.deepEqual((await replayedAt(playerToken)).scores.get(gameKey(0, 0)), [13, 11]);

  assert.ok((await clearScore(anonClient(), organizerToken, FIRST)).ok);
  assert.equal((await replayedAt(playerToken)).scores.has(gameKey(0, 0)), false);
});

test("a score the Game Rule refuses is refused, and changing the rule keeps scores already in", async () => {
  const { organizerToken, playerToken } = await live();
  const short = await enterScore(anonClient(), organizerToken, FIRST, [11, 10]);
  assert.equal(short.ok, false);
  assert.match(!short.ok ? short.problem : "", /win by 2/i);

  assert.ok((await enterScore(anonClient(), organizerToken, FIRST, [11, 7])).ok);
  assert.ok((await changeGameRule(anonClient(), organizerToken, { to: 21, winBy: 2 })).ok);

  const replayed = await replayedAt(playerToken);
  assert.deepEqual(replayed.rule, { to: 21, winBy: 2 });
  assert.deepEqual(replayed.scores.get(gameKey(0, 0)), [11, 7]);

  const now = await enterScore(anonClient(), organizerToken, SECOND, [11, 7]);
  assert.equal(now.ok, false);
  assert.match(!now.ok ? now.problem : "", /21/);
});

test("the Player Link can't change the Game Rule or start a Round", async () => {
  const { playerToken } = await live();
  const refusal = { ok: false, problem: ORGANIZER_ONLY };
  assert.deepEqual(await changeGameRule(anonClient(), playerToken, { to: 21, winBy: 1 }), refusal);
  assert.deepEqual(await startRound(anonClient(), playerToken, 1), refusal);
});

// #689: players score their own Games, and the Current Round.

const BOARD = redraw(CONFIG)!;
const BEN = 0;

/** The court of the Game a Roster index plays in that Round, or of one it doesn't. */
function courtOf(player: number, round: number, theirs: boolean): GameAt {
  for (let court = 0; court < 2; court++) {
    const at = { round, court };
    if (gameOn(BOARD, at) && playsIn(BOARD, at, player) === theirs) return at;
  }
  throw new Error(`CONFIG's board has no such Game in Round ${round + 1}`);
}

async function currentRoundAt(token: string) {
  return (await replayedAt(token)).currentRound;
}

test("a Player Link with a Selection enters, changes and clears its own Game's score, signed out", async () => {
  const { playerToken } = await live();
  const own = courtOf(BEN, 0, true);

  assert.deepEqual(await enterScore(anonClient(), playerToken, own, [11, 7], BEN), { ok: true, value: null });
  assert.deepEqual((await replayedAt(playerToken)).scores.get(gameKey(own.round, own.court)), [11, 7]);
  assert.ok((await enterScore(anonClient(), playerToken, own, [7, 11], BEN)).ok);
  assert.ok((await clearScore(anonClient(), playerToken, own, BEN)).ok);
  assert.equal((await replayedAt(playerToken)).scores.has(gameKey(own.round, own.court)), false);
});

test("a Player Link without a Selection can't score", async () => {
  const { playerToken } = await live();
  const own = courtOf(BEN, 0, true);
  for (const selection of [undefined, null, -1, 8, 1.5, "0"]) {
    assert.deepEqual(
      await enterScore(anonClient(), playerToken, own, [11, 7], selection as number),
      { ok: false, problem: PICK_YOUR_NAME },
      `selection ${String(selection)}`,
    );
  }
  assert.deepEqual(await clearScore(anonClient(), playerToken, own), { ok: false, problem: PICK_YOUR_NAME });
});

test("a Game the Selection doesn't sit in is refused", async () => {
  const { playerToken } = await live();
  const other = courtOf(BEN, 0, false);
  const refusal = { ok: false, problem: NOT_YOUR_GAME };
  assert.deepEqual(await enterScore(anonClient(), playerToken, other, [11, 7], BEN), refusal);
  assert.deepEqual(await clearScore(anonClient(), playerToken, other, BEN), refusal);
});

test("a player scores up to the Current Round, and a later Round hasn't started yet", async () => {
  const { playerToken } = await live();
  assert.equal(await currentRoundAt(playerToken), 0);

  assert.deepEqual(await enterScore(anonClient(), playerToken, courtOf(BEN, 1, true), [11, 7], BEN), {
    ok: false,
    problem: "Round 2 hasn't started yet.",
  });

  // A score in the Current Round moves the night on by one, and no further.
  assert.ok((await enterScore(anonClient(), playerToken, courtOf(BEN, 0, true), [11, 7], BEN)).ok);
  assert.equal(await currentRoundAt(playerToken), 1);
  assert.ok((await enterScore(anonClient(), playerToken, courtOf(BEN, 1, true), [11, 7], BEN)).ok);
  assert.equal(await currentRoundAt(playerToken), 2);
  assert.deepEqual(await enterScore(anonClient(), playerToken, courtOf(BEN, 3, true), [11, 7], BEN), {
    ok: false,
    problem: "Round 4 hasn't started yet.",
  });
});

test("the Organizer Link starts the next Round, one at a time, and a second tap changes nothing", async () => {
  const { organizerToken, playerToken } = await live();
  assert.deepEqual(await startRound(anonClient(), organizerToken, 1), { ok: true, value: null });
  assert.equal(await currentRoundAt(playerToken), 1);

  // The same tap again, from a second phone or a slow one, is already done.
  assert.ok((await startRound(anonClient(), organizerToken, 1)).ok);
  assert.equal((await readLiveMixer(anonClient(), playerToken))?.events.length, 1);

  assert.deepEqual(await startRound(anonClient(), organizerToken, 3), { ok: false, problem: ONE_ROUND_AT_A_TIME });

  // Now Round 2 is on, its players can score it.
  assert.ok((await enterScore(anonClient(), playerToken, courtOf(BEN, 1, true), [11, 7], BEN)).ok);
});

test("the last Round is as far as the night goes", async () => {
  const { organizerToken } = await live();
  for (const round of [1, 2, 3]) assert.ok((await startRound(anonClient(), organizerToken, round)).ok);
  assert.deepEqual(await startRound(anonClient(), organizerToken, 4), { ok: false, problem: LAST_ROUND });
});

test("the Organizer Link scores any Game in any Round, whatever the Current Round", async () => {
  const { organizerToken, playerToken } = await live();
  assert.ok((await enterScore(anonClient(), organizerToken, { round: 3, court: 1 }, [11, 7])).ok);
  assert.equal(await currentRoundAt(playerToken), 4);
});

test("the database lets the Player Link token write scores and nothing else", async () => {
  const { playerToken } = await live();
  const append = (kind: string, payload: unknown) =>
    anonClient().rpc("match_mixer_append", { p_token: playerToken, p_kind: kind, p_payload: payload });
  assert.equal((await append("round_started", { round: 1 })).error?.code, "42501");
  assert.equal((await append("game_rule_changed", { to: 21, winBy: 2 })).error?.code, "42501");
  assert.equal((await append("score_entered", { round: 0, court: 0, score: [11, 7] })).error, null);
});

test("a Game that isn't on the board can't be scored", async () => {
  const { organizerToken } = await live();
  assert.deepEqual(await enterScore(anonClient(), organizerToken, { round: 99, court: 0 }, [11, 7]), {
    ok: false,
    problem: NOT_ON_THE_BOARD,
  });
});

test("the database refuses a payload of the wrong shape, even from the Organizer Link", async () => {
  const { organizerToken } = await live();
  const append = (kind: string, payload: unknown) =>
    anonClient().rpc("match_mixer_append", { p_token: organizerToken, p_kind: kind, p_payload: payload });
  for (const [kind, payload] of [
    ["score_entered", { round: 0, court: 0, score: [7, 7] }],
    ["score_entered", { round: 0, court: 0, score: [100, 7] }],
    ["score_entered", { round: -1, court: 0, score: [11, 7] }],
    ["score_entered", { round: 0, court: 0, score: ["11", 7] }],
    ["game_rule_changed", { to: 12, winBy: 2 }],
    ["round_started", { round: "1" }],
    ["round_started", {}],
    ["finished", {}],
  ] as const) {
    const { error } = await append(kind, payload);
    assert.equal(error?.code, "22023", `${kind} ${JSON.stringify(payload)}`);
  }
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
