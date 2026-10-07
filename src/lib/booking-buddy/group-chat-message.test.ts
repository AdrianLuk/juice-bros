import assert from "node:assert/strict";
import test from "node:test";

import { groupChatMessage, type GroupChatGame } from "./group-chat-message.ts";

const URL = "https://juicebros.ca/s/abc123";

/** A booked Tuesday game with a couple of answers in. */
function game(overrides: Partial<GroupChatGame> = {}): GroupChatGame {
  return {
    when: "Tue, Oct 20, 2026 · 8:00 PM – 10:00 PM",
    facilityLabel: "Backyard Club",
    courtLabels: ["3"],
    repeatsLabel: null,
    yes: 4,
    maybe: 2,
    slotLinkUrl: URL,
    ...overrides,
  };
}

test("a booked game reads day and time, where, who's in, and the link, one per line", () => {
  assert.equal(
    groupChatMessage(game()),
    [
      "Pickleball Tue, Oct 20, 8:00 PM – 10:00 PM",
      "Backyard Club, court 3",
      "4 in, 2 maybe",
      `In or out? ${URL}`,
    ].join("\n"),
  );
});

test("several courts are listed together", () => {
  assert.match(
    groupChatMessage(game({ courtLabels: ["3", "4"] })),
    /^Backyard Club, courts 3 and 4$/m,
  );
  assert.match(
    groupChatMessage(game({ courtLabels: ["1", "2", "5"] })),
    /^Backyard Club, courts 1, 2 and 5$/m,
  );
});

test("a court booked without a label says how many courts, not which", () => {
  assert.match(
    groupChatMessage(game({ courtLabels: [null] })),
    /^Backyard Club, 1 court$/m,
  );
  assert.match(
    groupChatMessage(game({ courtLabels: ["3", null] })),
    /^Backyard Club, 2 courts$/m,
  );
});

test("a game with no court booked yet names the facility it's headed for", () => {
  assert.match(
    groupChatMessage(game({ courtLabels: [] })),
    /^Backyard Club, court not booked yet$/m,
  );
});

test("a game with no facility at all leaves the where line out", () => {
  assert.equal(
    groupChatMessage(game({ facilityLabel: null, courtLabels: [] })),
    [
      "Pickleball Tue, Oct 20, 8:00 PM – 10:00 PM",
      "4 in, 2 maybe",
      `In or out? ${URL}`,
    ].join("\n"),
  );
});

test("the tally drops a zero half, and says so when nobody has answered", () => {
  assert.match(groupChatMessage(game({ maybe: 0 })), /^4 in$/m);
  assert.match(groupChatMessage(game({ yes: 0 })), /^2 maybe$/m);
  assert.match(
    groupChatMessage(game({ yes: 0, maybe: 0 })),
    /^Nobody's in yet$/m,
  );
});

test("a weekly game says it repeats, after the day and time", () => {
  const lines = groupChatMessage(
    game({ repeatsLabel: "Every Tuesday" }),
  ).split("\n");
  assert.equal(lines[1], "Every Tuesday");
});

test("the message is plain text: no markdown, no blank lines", () => {
  const message = groupChatMessage(game({ repeatsLabel: "Every Tuesday" }));
  assert.doesNotMatch(message, /[*_~`]/);
  assert.doesNotMatch(message, /\n\n/);
});
