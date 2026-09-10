import assert from "node:assert/strict";
import test from "node:test";

import { defaultRounds, maxCourts, type ResolvedConfig } from "../engine/config.ts";
import { parseRoster } from "../engine/roster.ts";
import { generateSchedule } from "../engine/schedule.ts";
import { MAX_ROSTER_SIZE } from "../engine/types.ts";
import {
  decodeShareLink,
  encodeShareLink,
  GENERATOR_VERSION,
  MAX_LINK_LENGTH,
  SHARE_PARAM,
} from "./share-link.ts";

/**
 * The tests assert what a caller passes in and what comes back, never the
 * link's byte format — the encoding has to stay free to improve. The one
 * exception is the version marker, which is a contract, and the two tests that
 * hand-write a payload say so where they do it.
 */

const BASE = "https://juicebrospickleball.com/tools/match-mixer";

const roster = parseRoster(
  [
    "Ben Johns",
    "Anna Leigh Waters",
    "Federico Staksrud",
    "Catherine Parenteau",
    "JW Johnson",
    "Anna Bright",
    "Gabriel Tardio",
    "Jorja Johnson",
  ].join("\n"),
);

const config: ResolvedConfig = { roster, courts: 2, rounds: 5, seed: 12345 };

/** The payload of a link, which is all the decoder ever sees. */
function payloadOf(link: string): string {
  return new URL(link).searchParams.get(SHARE_PARAM)!;
}

function encoded(from: ResolvedConfig = config): string {
  const link = encodeShareLink(from, BASE);
  assert.ok(link, "expected a link");
  return payloadOf(link);
}

test("the board a link opens is the board that was shared", () => {
  // The load-bearing test. Everything else here is a detail of it: what a
  // reader is promised is not that the Config survives the round trip but that
  // the same Rounds, courts, seats and partners come out the other end.
  const shared = decodeShareLink(encoded());
  assert.ok(shared);
  assert.deepEqual(
    generateSchedule(shared.config),
    generateSchedule(config),
  );
});

test("round-trips the roster in order, the numbers and the seed", () => {
  const shared = decodeShareLink(encoded());
  assert.deepEqual(
    shared?.config.roster.map((player) => player.name),
    roster.map((player) => player.name),
  );
  assert.equal(shared?.config.courts, 2);
  assert.equal(shared?.config.rounds, 5);
  assert.equal(shared?.config.seed, 12345);
});

test("carries names a URL would otherwise eat", () => {
  const awkward = parseRoster(
    ["Ana Rodríguez", "J.W. O'Brien", "Sam & Max", "100% Dave", "李伟", "Zoë"].join(
      "\n",
    ),
  );
  const shared = decodeShareLink(
    encoded({ ...config, roster: awkward, courts: 1, rounds: 3 }),
  );
  assert.deepEqual(
    shared?.config.roster.map((player) => player.name),
    awkward.map((player) => player.name),
  );
});

test("does not carry player ids, and regenerates them on arrival", () => {
  // The engine works in positions; ids are made again by `parseRoster` exactly
  // as they are for a pasted list. A link that carried them would be carrying
  // a private detail of one browser's editing history.
  const renumbered = roster.map((player, index) => ({
    ...player,
    id: `carried-${index}`,
  }));
  const shared = decodeShareLink(encoded({ ...config, roster: renumbered }));
  assert.deepEqual(
    shared?.config.roster.map((player) => player.id),
    roster.map((player) => player.id),
  );
});

test("two players sharing a name arrive as two players", () => {
  const twoMikes = parseRoster(["Mike", "Mike", "Dave", "Sue"].join("\n"));
  const shared = decodeShareLink(encoded({ ...config, roster: twoMikes }));
  assert.equal(shared?.config.roster.length, 4);
  assert.notEqual(shared?.config.roster[0].id, shared?.config.roster[1].id);
});

test("reports the generator version the link was minted under", () => {
  const shared = decodeShareLink(encoded());
  assert.equal(shared?.version, GENERATOR_VERSION);
  assert.equal(shared?.current, true);
});

test("a link from another generator still opens, and says it is not ours", () => {
  // The version marker is the one part of the format the tests are allowed to
  // know: it is a contract, and it is the first field of the payload. Acting
  // on the mismatch is #494; carrying and reporting it is this module's whole
  // responsibility for it.
  const future = encoded().replace(/^\d+/, String(GENERATOR_VERSION + 41));
  const shared = decodeShareLink(future);
  assert.ok(shared, "a link from a later generator must still open");
  assert.equal(shared.version, GENERATOR_VERSION + 41);
  assert.equal(shared.current, false);
  assert.deepEqual(shared.config.roster.length, roster.length);
});

test("a payload with no version marker at all is not a link", () => {
  assert.equal(decodeShareLink(encoded().replace(/^\d+/, "")), null);
});

test("an absent optional field reads as its default", () => {
  // What keeps a link minted today valid once RR-6 adds Pool Count: a field
  // the payload does not carry is the Roster's default rather than a refusal.
  // Court and round counts are the two that already work that way.
  const blanked = encoded().replace(/^(\d+)\.\d+\.\d+\./, "$1...");
  const shared = decodeShareLink(blanked);
  assert.equal(shared?.config.courts, maxCourts(roster.length));
  assert.equal(
    shared?.config.rounds,
    defaultRounds(roster.length, maxCourts(roster.length)),
  );
  assert.equal(shared?.config.seed, 12345, "the seed is not optional");
});

test("brings numbers this roster cannot support inside what it can", () => {
  const shared = decodeShareLink(
    encoded({ ...config, courts: 99, rounds: 500 }),
  );
  assert.equal(shared?.config.courts, 2, "eight players cannot fill 99 courts");
  assert.equal(shared?.config.rounds, 40, "the round count outran MAX_ROUNDS");
});

test("a link truncated in transit is not a shorter board", () => {
  // A chat client that autolinks half a URL is the failure this transport
  // actually has, and a link cut after the sixth of eight names would
  // otherwise decode cleanly into a six-player board nobody drew.
  const payload = encoded();
  for (let cut = 1; cut < payload.length; cut++) {
    const shared = decodeShareLink(payload.slice(0, cut));
    if (shared) {
      assert.equal(
        shared.config.roster.length,
        roster.length,
        `a link cut at ${cut} opened a board of ${shared.config.roster.length}`,
      );
    }
  }
});

test("a mangled, empty or absent parameter is not a board", () => {
  const rubbish: unknown[] = [
    null,
    undefined,
    "",
    "   ",
    42,
    {},
    [],
    ["1.2.5.12345.8"],
    "not a payload at all",
    "1.2.5.12345.8",
    "1.2.5.12345.8\nBen\nAnna\nFed",
    "1.2.5.abc.8\nBen\nAnna\nFed\nCath",
    "1.2.5.12345\nBen\nAnna\nFed\nCath",
    `1.2.5.12345.${MAX_ROSTER_SIZE + 1}\n${Array.from(
      { length: MAX_ROSTER_SIZE + 1 },
      (_, i) => `Player ${i}`,
    ).join("\n")}`,
    "\n\n\n",
    "%%%",
  ];
  for (const value of rubbish) {
    assert.doesNotThrow(() => decodeShareLink(value), `threw on ${String(value)}`);
    assert.equal(decodeShareLink(value), null, `accepted ${String(value)}`);
  }
});

test("a roster too long for a link is refused rather than truncated", () => {
  const enormous = parseRoster(
    Array.from({ length: MAX_ROSTER_SIZE }, (_, i) =>
      `Player ${i} ${"Wentworth-Fitzwilliam".repeat(4)}`,
    ).join("\n"),
  );
  assert.equal(encodeShareLink({ ...config, roster: enormous }, BASE), null);
});

test("a link stays inside the budget for the roster the tool allows", () => {
  const full = parseRoster(
    Array.from({ length: MAX_ROSTER_SIZE }, (_, i) =>
      `Alexandra Wentworth ${i}`,
    ).join("\n"),
  );
  const link = encodeShareLink({ ...config, roster: full }, BASE);
  assert.ok(link);
  assert.ok(
    link.length <= MAX_LINK_LENGTH,
    `a full roster produced ${link.length} characters`,
  );
});

test("encoding onto a link-opened board gives the board on screen", () => {
  // Copying a link while reading somebody else's must not hand back theirs.
  const theirs = encodeShareLink(config, BASE)!;
  const mine = encodeShareLink({ ...config, seed: 999 }, `${theirs}#top`);
  const shared = decodeShareLink(payloadOf(mine!));
  assert.equal(shared?.config.seed, 999);
  assert.equal(new URL(mine!).hash, "", "a fragment has no business in a link");
});

test("a base that is not a URL is not a link", () => {
  assert.equal(encodeShareLink(config, "not a url"), null);
});
