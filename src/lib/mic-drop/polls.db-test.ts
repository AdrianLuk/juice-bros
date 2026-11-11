/**
 * Mic Drop's store against the local database (spec #666, seam 1): a
 * throwaway Host (allowlisted here), an account that isn't a Host, and
 * signed-out Guests, each phone a different Guest id.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";

import {
  anonClient,
  createTestUser,
  deleteTestUser,
  serviceRoleClient,
  type TestUser,
} from "../db-test-support.ts";
import {
  addContestant,
  castVote,
  closePoll,
  createPoll,
  isHost,
  listPolls,
  loadPoll,
  readGuestPoll,
  removeContestant,
  reopenPoll,
  type GuestPoll,
} from "./polls.ts";

const users: TestUser[] = [];
const guests = anonClient();

after(async () => {
  // Deleting a User takes their allowlist row and their Polls with them.
  await Promise.all(users.map(deleteTestUser));
});

async function account(): Promise<TestUser> {
  const user = await createTestUser("Mic Drop account");
  users.push(user);
  return user;
}

async function host(): Promise<TestUser> {
  const user = await account();
  const { error } = await serviceRoleClient().from("mic_drop_hosts").insert({ user_id: user.userId });
  if (error) throw new Error(`Allowlisting the test Host failed: ${error.message}`);
  return user;
}

function ok<T>(outcome: { ok: true; value: T } | { ok: false; problem: string }): T {
  if (!outcome.ok) assert.fail(`expected success, got: ${outcome.problem}`);
  return outcome.value;
}

/** A Host's open Poll with these Contestants, in this order. */
async function pollWith(names: string[], owner?: TestUser) {
  const { supabase } = owner ?? (await host());
  const poll = ok(await createPoll(supabase, "Karaoke Night"));
  const ids: Record<string, string> = {};
  for (const name of names) {
    ids[name] = ok(await addContestant(supabase, poll.id, name));
  }
  return { supabase, poll, ids };
}

const counts = (read: GuestPoll | null) =>
  read?.contestants.map(({ name, votes }) => [name, votes]);

const phone = () => randomUUID();

// ---------------------------------------------------------------------------
// Hosts
// ---------------------------------------------------------------------------

test("a Host creates a Poll, types in its line-up and finds it in their Polls", async () => {
  const { supabase } = await host();
  assert.equal(await isHost(supabase), true);

  const poll = ok(await createPoll(supabase, "  Karaoke Night  "));
  ok(await addContestant(supabase, poll.id, "Anna Leigh Waters"));
  ok(await addContestant(supabase, poll.id, "JW Johnson & Dylan Frazier"));
  ok(await addContestant(supabase, poll.id, "Ben Johns"));

  const polls = await listPolls(supabase);
  assert.deepEqual(
    polls.map(({ name, open, contestantCount }) => ({ name, open, contestantCount })),
    [{ name: "Karaoke Night", open: true, contestantCount: 3 }],
  );
  assert.ok(polls[0].guestToken.length >= 24);
  const loaded = await loadPoll(supabase, poll.id);
  assert.equal(loaded?.guestToken, poll.guestToken);
  assert.deepEqual(
    loaded?.lineUp.map(({ name }) => name),
    ["Anna Leigh Waters", "JW Johnson & Dylan Frazier", "Ben Johns"],
  );

  const read = await readGuestPoll(guests, poll.guestToken);
  assert.equal(read?.name, "Karaoke Night");
  assert.equal(read?.open, true);
  assert.equal(read?.phonesIn, 0);
  assert.deepEqual(counts(read), [
    ["Anna Leigh Waters", 0],
    ["JW Johnson & Dylan Frazier", 0],
    ["Ben Johns", 0],
  ]);
  assert.equal(read?.myVote, null);
  assert.deepEqual(read?.winnerIds, []);
});

test("names are trimmed, and a blank or overlong name is refused", async () => {
  const { supabase } = await host();

  assert.deepEqual(await createPoll(supabase, "   "), { ok: false, problem: "A Poll needs a name." });
  assert.deepEqual(await createPoll(supabase, "x".repeat(81)), {
    ok: false,
    problem: "A Poll's name can be at most 80 characters.",
  });

  const poll = ok(await createPoll(supabase, "x".repeat(80)));
  assert.deepEqual(await addContestant(supabase, poll.id, " \t "), {
    ok: false,
    problem: "A Contestant needs a name.",
  });
  assert.deepEqual(await addContestant(supabase, poll.id, "y".repeat(81)), {
    ok: false,
    problem: "A Contestant's name can be at most 80 characters.",
  });
  ok(await addContestant(supabase, poll.id, "  Tyson McGuffin "));

  const read = await readGuestPoll(guests, poll.guestToken);
  assert.deepEqual(counts(read), [["Tyson McGuffin", 0]]);
});

test("a Poll holds at most 50 Contestants", async () => {
  const { supabase, poll } = await pollWith([]);
  for (let n = 1; n <= 50; n++) {
    ok(await addContestant(supabase, poll.id, `Singer ${n}`));
  }
  assert.deepEqual(await addContestant(supabase, poll.id, "Singer 51"), {
    ok: false,
    problem: "A Poll can have at most 50 Contestants.",
  });
});

test("an account that isn't on the allowlist can't host", async () => {
  const { supabase } = await account();

  assert.equal(await isHost(supabase), false);
  assert.deepEqual(await createPoll(supabase, "Karaoke Night"), {
    ok: false,
    problem: "This account can't host Mic Drop Polls.",
  });
  assert.deepEqual(await listPolls(supabase), []);
});

test("an account that isn't on the allowlist can't edit someone else's Poll", async () => {
  const { poll, ids } = await pollWith(["Ben Johns"]);
  const { supabase } = await account();

  const cantHost = { ok: false, problem: "This account can't host Mic Drop Polls." };
  assert.deepEqual(await addContestant(supabase, poll.id, "Planted"), cantHost);
  assert.deepEqual(await removeContestant(supabase, ids["Ben Johns"]), cantHost);
  assert.deepEqual(await closePoll(supabase, poll.id), cantHost);
  assert.equal(await loadPoll(supabase, poll.id), null);

  const read = await readGuestPoll(guests, poll.guestToken);
  assert.equal(read?.open, true);
  assert.deepEqual(counts(read), [["Ben Johns", 0]]);
});

test("a Host can't see or change another Host's Poll", async () => {
  const { supabase: owner, poll, ids } = await pollWith(["Ben Johns"]);
  const other = await host();

  assert.deepEqual(await listPolls(other.supabase), []);
  assert.equal(await loadPoll(other.supabase, poll.id), null);

  const noPoll = { ok: false, problem: "That Poll doesn't exist." };
  assert.deepEqual(await addContestant(other.supabase, poll.id, "Planted"), noPoll);
  assert.deepEqual(await removeContestant(other.supabase, ids["Ben Johns"]), {
    ok: false,
    problem: "That Contestant doesn't exist.",
  });
  assert.deepEqual(await closePoll(other.supabase, poll.id), noPoll);

  await closePoll(owner, poll.id);
  assert.deepEqual(await reopenPoll(other.supabase, poll.id), noPoll);

  const read = await readGuestPoll(guests, poll.guestToken);
  assert.equal(read?.open, false);
  assert.deepEqual(counts(read), [["Ben Johns", 0]]);
});

test("a Host taken off the allowlist stops seeing their Polls", async () => {
  const user = await host();
  const poll = ok(await createPoll(user.supabase, "Karaoke Night"));
  assert.equal((await listPolls(user.supabase)).length, 1);

  const { error } = await serviceRoleClient().from("mic_drop_hosts").delete().eq("user_id", user.userId);
  if (error) throw new Error(`Taking the Host off the allowlist failed: ${error.message}`);

  assert.deepEqual(await listPolls(user.supabase), []);
  assert.equal(await loadPoll(user.supabase, poll.id), null);
});

// ---------------------------------------------------------------------------
// Guests
// ---------------------------------------------------------------------------

test("an unknown Guest Link reads as no Poll", async () => {
  await pollWith(["Ben Johns"]);

  assert.equal(await readGuestPoll(guests, "0123456789abcdef0123456789abcdef"), null);
  assert.equal(await readGuestPoll(guests, "short"), null);
  assert.equal(await readGuestPoll(guests, ""), null);
  assert.deepEqual(
    await castVote(guests, "0123456789abcdef0123456789abcdef", phone(), randomUUID()),
    { ok: false, problem: "There's no such Poll." },
  );
});

test("each phone has one Vote, and a changed Vote replaces the old one", async () => {
  const { poll, ids } = await pollWith(["Anna Leigh Waters", "Ben Johns"]);
  const mine = phone();

  assert.deepEqual(await castVote(guests, poll.guestToken, mine, ids["Anna Leigh Waters"]), { ok: true });
  let read = await readGuestPoll(guests, poll.guestToken, mine);
  assert.equal(read?.myVote, ids["Anna Leigh Waters"]);
  assert.equal(read?.phonesIn, 1);
  assert.deepEqual(counts(read), [
    ["Anna Leigh Waters", 1],
    ["Ben Johns", 0],
  ]);

  // Same pick again: still one Vote.
  await castVote(guests, poll.guestToken, mine, ids["Anna Leigh Waters"]);
  // A later singer was better.
  assert.deepEqual(await castVote(guests, poll.guestToken, mine, ids["Ben Johns"]), { ok: true });

  read = await readGuestPoll(guests, poll.guestToken, mine);
  assert.equal(read?.myVote, ids["Ben Johns"]);
  assert.equal(read?.phonesIn, 1);
  assert.deepEqual(counts(read), [
    ["Ben Johns", 1],
    ["Anna Leigh Waters", 0],
  ]);
});

test("the Leaderboard is highest first, with entry order breaking ties", async () => {
  const { poll, ids } = await pollWith(["Anna Leigh Waters", "Ben Johns", "Tyson McGuffin", "Anna Bright"]);
  const vote = (name: string) => castVote(guests, poll.guestToken, phone(), ids[name]);

  await vote("Tyson McGuffin");
  await vote("Tyson McGuffin");
  await vote("Anna Bright");
  await vote("Ben Johns");

  const read = await readGuestPoll(guests, poll.guestToken);
  assert.equal(read?.phonesIn, 4);
  assert.deepEqual(counts(read), [
    ["Tyson McGuffin", 2],
    ["Ben Johns", 1],
    ["Anna Bright", 1],
    ["Anna Leigh Waters", 0],
  ]);
});

test("the read never shows another phone's Vote or any Guest id", async () => {
  const { poll, ids } = await pollWith(["Anna Leigh Waters", "Ben Johns"]);
  const theirs = phone();
  const mine = phone();
  await castVote(guests, poll.guestToken, theirs, ids["Ben Johns"]);

  const read = await readGuestPoll(guests, poll.guestToken, mine);
  assert.equal(read?.myVote, null);
  assert.ok(!JSON.stringify(read).includes(theirs), "another phone's Guest id leaked");
  assert.ok(!JSON.stringify(read).includes(poll.guestToken), "the token leaked");
  assert.deepEqual(Object.keys(read ?? {}).sort(), [
    "contestants",
    "id",
    "myVote",
    "name",
    "open",
    "phonesIn",
    "winnerIds",
  ]);

  // A malformed Guest id reads as a phone with no Vote, never an error.
  assert.equal((await readGuestPoll(guests, poll.guestToken, "not-a-guest-id"))?.myVote, null);
});

test("a Vote for a Contestant from another Poll, or from a malformed Guest id, is refused", async () => {
  const first = await pollWith(["Anna Leigh Waters"]);
  const second = await pollWith(["Ben Johns"]);

  assert.deepEqual(
    await castVote(guests, first.poll.guestToken, phone(), second.ids["Ben Johns"]),
    { ok: false, problem: "That Contestant isn't in this Poll." },
  );
  assert.deepEqual(
    await castVote(guests, first.poll.guestToken, "not-a-guest-id", first.ids["Anna Leigh Waters"]),
    { ok: false, problem: "This phone's Guest id isn't valid. Reload the page and try again." },
  );
  assert.deepEqual(
    await castVote(guests, first.poll.guestToken, phone(), "not-a-uuid"),
    { ok: false, problem: "That Contestant isn't in this Poll." },
  );
  assert.equal((await readGuestPoll(guests, first.poll.guestToken))?.phonesIn, 0);
});

// ---------------------------------------------------------------------------
// The line-up changing, closing, and the winner
// ---------------------------------------------------------------------------

test("removing a Contestant deletes their Votes and leaves those phones free to pick again", async () => {
  const { supabase, poll, ids } = await pollWith(["Anna Leigh Waters", "Ben Johns"]);
  const mine = phone();
  await castVote(guests, poll.guestToken, mine, ids["Ben Johns"]);
  await castVote(guests, poll.guestToken, phone(), ids["Anna Leigh Waters"]);

  assert.deepEqual(await removeContestant(supabase, ids["Ben Johns"]), { ok: true });

  let read = await readGuestPoll(guests, poll.guestToken, mine);
  assert.equal(read?.myVote, null);
  assert.equal(read?.phonesIn, 1);
  assert.deepEqual(counts(read), [["Anna Leigh Waters", 1]]);

  assert.deepEqual(await castVote(guests, poll.guestToken, mine, ids["Anna Leigh Waters"]), { ok: true });
  read = await readGuestPoll(guests, poll.guestToken, mine);
  assert.equal(read?.myVote, ids["Anna Leigh Waters"]);
  assert.deepEqual(counts(read), [["Anna Leigh Waters", 2]]);
});

test("a Contestant added mid-night joins the end of the line-up", async () => {
  const { supabase, poll } = await pollWith(["Anna Leigh Waters"]);
  const late = ok(await addContestant(supabase, poll.id, "Federico Staksrud"));

  assert.deepEqual(await castVote(guests, poll.guestToken, phone(), late), { ok: true });
  assert.deepEqual(counts(await readGuestPoll(guests, poll.guestToken)), [
    ["Federico Staksrud", 1],
    ["Anna Leigh Waters", 0],
  ]);
});

test("a closed Poll refuses Votes and line-up changes, and a reopened one takes them again", async () => {
  const { supabase, poll, ids } = await pollWith(["Anna Leigh Waters", "Ben Johns"]);
  const mine = phone();
  await castVote(guests, poll.guestToken, mine, ids["Anna Leigh Waters"]);

  assert.deepEqual(await closePoll(supabase, poll.id), { ok: true });
  assert.deepEqual(await closePoll(supabase, poll.id), { ok: true }, "closing twice is harmless");

  assert.deepEqual(await castVote(guests, poll.guestToken, mine, ids["Ben Johns"]), {
    ok: false,
    problem: "Voting is closed.",
  });
  const closedLineUp = { ok: false, problem: "This Poll is closed. Reopen it to change the line-up." };
  assert.deepEqual(await addContestant(supabase, poll.id, "Anna Bright"), closedLineUp);
  assert.deepEqual(await removeContestant(supabase, ids["Ben Johns"]), closedLineUp);

  let read = await readGuestPoll(guests, poll.guestToken, mine);
  assert.equal(read?.open, false);
  assert.equal(read?.myVote, ids["Anna Leigh Waters"]);
  assert.deepEqual(read?.winnerIds, [ids["Anna Leigh Waters"]]);
  assert.equal((await listPolls(supabase))[0].open, false, "the closed Poll and its result are kept");

  assert.deepEqual(await reopenPoll(supabase, poll.id), { ok: true });
  assert.deepEqual(await castVote(guests, poll.guestToken, mine, ids["Ben Johns"]), { ok: true });
  read = await readGuestPoll(guests, poll.guestToken, mine);
  assert.equal(read?.open, true);
  assert.deepEqual(read?.winnerIds, [], "no winner while voting is open");
  assert.deepEqual(counts(read), [
    ["Ben Johns", 1],
    ["Anna Leigh Waters", 0],
  ]);
});

test("a tie at the top makes joint winners, and a Poll with no Votes has no winner", async () => {
  const tied = await pollWith(["Anna Leigh Waters", "Ben Johns", "Tyson McGuffin"]);
  await castVote(guests, tied.poll.guestToken, phone(), tied.ids["Ben Johns"]);
  await castVote(guests, tied.poll.guestToken, phone(), tied.ids["Anna Leigh Waters"]);
  await closePoll(tied.supabase, tied.poll.id);

  assert.deepEqual((await readGuestPoll(guests, tied.poll.guestToken))?.winnerIds, [
    tied.ids["Anna Leigh Waters"],
    tied.ids["Ben Johns"],
  ]);

  const silent = await pollWith(["Anna Bright"]);
  await closePoll(silent.supabase, silent.poll.id);
  assert.deepEqual((await readGuestPoll(guests, silent.poll.guestToken))?.winnerIds, []);
});
