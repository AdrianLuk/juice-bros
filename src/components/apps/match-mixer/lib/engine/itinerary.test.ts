import assert from "node:assert/strict";
import test from "node:test";

import { describeItinerary, itinerary } from "./itinerary.ts";
import type { Round, Schedule, Team } from "./types.ts";

/** Each argument is one Game: two Teams facing each other. */
function round(games: [Team, Team][], byes: number[] = []): Round {
  return {
    games: games.map((teams, court) => ({ court, teams })),
    byes,
  };
}

function schedule(...rounds: Round[]): Schedule {
  return { source: "generated", rounds };
}

/** Eight players, two courts, nobody sitting out. */
const full = schedule(
  round([
    [
      [0, 1],
      [2, 3],
    ],
    [
      [4, 5],
      [6, 7],
    ],
  ]),
  round([
    [
      [0, 2],
      [1, 3],
    ],
    [
      [4, 6],
      [5, 7],
    ],
  ]),
  round([
    [
      [0, 4],
      [3, 7],
    ],
    [
      [1, 5],
      [2, 6],
    ],
  ]),
);

/** Five players, one court, so somebody sits out every round. */
const sitting = schedule(
  round(
    [
      [
        [0, 1],
        [2, 3],
      ],
    ],
    [4],
  ),
  round(
    [
      [
        [0, 2],
        [1, 4],
      ],
    ],
    [3],
  ),
  round(
    [
      [
        [0, 3],
        [2, 4],
      ],
    ],
    [1],
  ),
  round(
    [
      [
        [1, 2],
        [3, 4],
      ],
    ],
    [0],
  ),
);

/** Six players over four rounds on one court: everybody sits out twice. */
const sittingTwice = schedule(
  round(
    [
      [
        [0, 1],
        [2, 3],
      ],
    ],
    [4, 5],
  ),
  round(
    [
      [
        [0, 4],
        [1, 5],
      ],
    ],
    [2, 3],
  ),
  round(
    [
      [
        [2, 4],
        [3, 5],
      ],
    ],
    [0, 1],
  ),
  round(
    [
      [
        [0, 2],
        [1, 4],
      ],
    ],
    [3, 5],
  ),
);

test("returns one entry per round, in round order", () => {
  const evening = itinerary(full, 0);
  assert.equal(evening.length, 3);
  assert.deepEqual(
    evening.map((entry) => entry.round),
    [0, 1, 2],
  );
});

test("names the court, the partner and the opponents of every game", () => {
  const evening = itinerary(full, 0);

  assert.deepEqual(evening[0], {
    kind: "game",
    round: 0,
    court: 0,
    partner: 1,
    opponents: [2, 3],
  });
  assert.deepEqual(evening[1], {
    kind: "game",
    round: 1,
    court: 0,
    partner: 2,
    opponents: [1, 3],
  });
});

test("reads a player sitting on the far side of the net the same way", () => {
  // Player 3 is the second team of the first game, so partner and opponents
  // have to come off the side they are actually on.
  assert.deepEqual(itinerary(full, 3)[0], {
    kind: "game",
    round: 0,
    court: 0,
    partner: 2,
    opponents: [0, 1],
  });
});

test("carries the court a player is actually on, not the first one", () => {
  const evening = itinerary(full, 5);
  assert.deepEqual(
    evening.map((entry) => (entry.kind === "game" ? entry.court : null)),
    [1, 1, 1],
  );
});

test("a player with no byes plays every round", () => {
  const evening = itinerary(full, 6);
  assert.equal(
    evening.every((entry) => entry.kind === "game"),
    true,
  );
});

test("a bye round comes back as a bye and nothing else", () => {
  assert.deepEqual(itinerary(sitting, 4)[0], { kind: "bye", round: 0 });
});

test("a player who sits more than once gets a bye for each", () => {
  assert.deepEqual(
    itinerary(sittingTwice, 3).map((entry) => entry.kind),
    ["game", "bye", "game", "bye"],
  );
});

test("a player absent from a round reads as a bye even if the byes forgot them", () => {
  // Defensive: nothing generated gets here, but a hand-made Schedule can, and
  // an evening with a hole in it is worse than one that says "sitting out".
  const forgotten = schedule(
    round(
      [
        [
          [0, 1],
          [2, 3],
        ],
      ],
      [],
    ),
  );
  assert.deepEqual(itinerary(forgotten, 4), [{ kind: "bye", round: 0 }]);
});

test("two players sharing a name resolve to different itineraries", () => {
  // The engine never sees a name, which is exactly why this holds: the
  // itinerary is asked for by Roster index and two Mikes are two indices.
  const one = itinerary(full, 1);
  const two = itinerary(full, 5);
  assert.notDeepEqual(one, two);
  assert.deepEqual(
    one.map((entry) => (entry.kind === "game" ? entry.partner : null)),
    [0, 3, 5],
  );
  assert.deepEqual(
    two.map((entry) => (entry.kind === "game" ? entry.partner : null)),
    [4, 7, 1],
  );
});

test("an index off the end of the roster sits out the whole board", () => {
  assert.deepEqual(
    itinerary(full, 99).map((entry) => entry.kind),
    ["bye", "bye", "bye"],
  );
});

test("the sentence names the court and the rounds played", () => {
  assert.equal(
    describeItinerary(itinerary(full, 0)),
    "You're on Court 1 in rounds 1, 2 and 3. You never sit out.",
  );
});

test("each court gets its own clause, so no two lists share an 'and'", () => {
  const split = schedule(
    round([
      [
        [0, 1],
        [2, 3],
      ],
      [
        [4, 5],
        [6, 7],
      ],
    ]),
    round([
      [
        [4, 6],
        [5, 7],
      ],
      [
        [0, 2],
        [1, 3],
      ],
    ]),
  );

  assert.equal(
    describeItinerary(itinerary(split, 0)),
    "You're on Court 1 in round 1. Court 2 in round 2. You never sit out.",
  );
});

test("three courts with rounds under each still read once", () => {
  const around = schedule(
    round([
      [
        [0, 1],
        [2, 3],
      ],
      [
        [4, 5],
        [6, 7],
      ],
      [
        [8, 9],
        [10, 11],
      ],
    ]),
    round([
      [
        [4, 6],
        [5, 7],
      ],
      [
        [0, 2],
        [8, 10],
      ],
      [
        [1, 3],
        [9, 11],
      ],
    ]),
    round([
      [
        [1, 9],
        [3, 11],
      ],
      [
        [5, 6],
        [4, 7],
      ],
      [
        [0, 8],
        [2, 10],
      ],
    ]),
  );

  assert.equal(
    describeItinerary(itinerary(around, 0)),
    "You're on Court 1 in round 1. Court 2 in round 2. Court 3 in round 3. You never sit out.",
  );
});

test("the sentence names the byes rather than leaving them to be inferred", () => {
  assert.equal(
    describeItinerary(itinerary(sitting, 3)),
    "You're on Court 1 in rounds 1, 3 and 4. Sitting out round 2.",
  );
});

test("more than one bye is listed in full", () => {
  assert.equal(
    describeItinerary(itinerary(sittingTwice, 3)),
    "You're on Court 1 in rounds 1 and 3. Sitting out rounds 2 and 4.",
  );
});

test("a player who never gets on a court says so in one clause", () => {
  const crowded = schedule(
    round(
      [
        [
          [0, 1],
          [2, 3],
        ],
      ],
      [4, 5],
    ),
    round(
      [
        [
          [0, 1],
          [2, 3],
        ],
      ],
      [4, 5],
    ),
  );

  assert.equal(
    describeItinerary(itinerary(crowded, 4)),
    "You're sitting out every round.",
  );
});

test("the sentence is plain language, with no index or zero-based round in it", () => {
  const line = describeItinerary(itinerary(sitting, 0));
  assert.doesNotMatch(line, /round 0|Court 0|index/i);
});
