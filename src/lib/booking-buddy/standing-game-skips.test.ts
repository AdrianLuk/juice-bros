import assert from "node:assert/strict";
import test from "node:test";

import {
  gameOffRecipients,
  isUpcomingGameDate,
  nextGameDate,
  skipWeekNotice,
  skippableGameDates,
  upcomingGameDates,
} from "./standing-game-skips.ts";
import { planStandingGamePostingRun, type StandingGameSchedule } from "./standing-games.ts";

const TUESDAY = 2;

function tuesday8pm(overrides: Partial<StandingGameSchedule> = {}): StandingGameSchedule {
  return {
    id: "sg-1",
    weekday: TUESDAY,
    startHour: 20,
    timeZone: "America/Toronto",
    endedAt: null,
    bookingWindowDaysBefore: null,
    ...overrides,
  };
}

// Wed Oct 7 2026, 9am in Toronto (EDT, UTC-4).
const WEDNESDAY_MORNING = new Date("2026-10-07T13:00:00.000Z");
// Tue Oct 13 2026, 7pm and 9pm in Toronto: before and after an 8pm start.
const TUESDAY_7PM = new Date("2026-10-13T23:00:00.000Z");
const TUESDAY_9PM = new Date("2026-10-14T01:00:00.000Z");

test("upcoming game dates run weekly from the next Tuesday", () => {
  assert.deepEqual(upcomingGameDates(tuesday8pm(), WEDNESDAY_MORNING, 3), [
    "2026-10-13",
    "2026-10-20",
    "2026-10-27",
  ]);
});

test("today's game is upcoming until it starts, then next week's is first", () => {
  assert.equal(upcomingGameDates(tuesday8pm(), TUESDAY_7PM, 1)[0], "2026-10-13");
  assert.equal(upcomingGameDates(tuesday8pm(), TUESDAY_9PM, 1)[0], "2026-10-20");
});

test("a date is upcoming only on the game's day and before it starts", () => {
  const game = tuesday8pm();
  assert.equal(isUpcomingGameDate(game, "2026-10-13", TUESDAY_7PM), true);
  assert.equal(isUpcomingGameDate(game, "2026-10-13", TUESDAY_9PM), false);
  assert.equal(isUpcomingGameDate(game, "2026-11-03", WEDNESDAY_MORNING), true);
  assert.equal(isUpcomingGameDate(game, "2026-11-04", WEDNESDAY_MORNING), false, "a Wednesday");
  assert.equal(isUpcomingGameDate(game, "2026-10-06", WEDNESDAY_MORNING), false, "last Tuesday");
  assert.equal(isUpcomingGameDate(game, "not-a-date", WEDNESDAY_MORNING), false);
});

test("the dates offered to skip leave out every week already posted or skipped", () => {
  const recorded = new Set(["2026-10-13", "2026-10-27"]);
  assert.deepEqual(skippableGameDates(tuesday8pm(), recorded, WEDNESDAY_MORNING, 3), [
    "2026-10-20",
    "2026-11-03",
    "2026-11-10",
  ]);
});

test("the next game is the first upcoming week that isn't skipped", () => {
  const game = tuesday8pm();
  assert.equal(nextGameDate(game, new Set(), WEDNESDAY_MORNING), "2026-10-13");
  assert.equal(
    nextGameDate(game, new Set(["2026-10-13", "2026-10-20"]), WEDNESDAY_MORNING),
    "2026-10-27",
  );
});

test("an ended weekly game has no next game", () => {
  const game = tuesday8pm({ endedAt: "2026-10-01T00:00:00.000Z" });
  assert.equal(nextGameDate(game, new Set(), WEDNESDAY_MORNING), null);
});

test("a week skipped before it was posted is never posted, and the week after posts as usual", () => {
  // Skipping the week of Oct 20 ahead of time records it, like a posted week.
  const game = tuesday8pm({ bookingWindowDaysBefore: 14 });
  const run = planStandingGamePostingRun({
    games: [game],
    postedDatesByGame: new Map([["sg-1", new Set(["2026-10-20"])]]),
    now: WEDNESDAY_MORNING,
  });
  assert.deepEqual(
    run.posts.map((post) => post.gameDate),
    ["2026-10-13"],
  );

  // A week later the skipped date is in range again, and still not posted;
  // the following Tuesday is.
  const later = planStandingGamePostingRun({
    games: [game],
    postedDatesByGame: new Map([["sg-1", new Set(["2026-10-13", "2026-10-20"])]]),
    now: new Date("2026-10-14T13:00:00.000Z"),
  });
  assert.deepEqual(
    later.posts.map((post) => post.gameDate),
    ["2026-10-27"],
  );
});

test("a week skipped after it was posted keeps its record, so the cron never posts it again", () => {
  // The posted Slot is gone but the week row stays, so the date is still recorded.
  const run = planStandingGamePostingRun({
    games: [tuesday8pm()],
    postedDatesByGame: new Map([["sg-1", new Set(["2026-10-13"])]]),
    now: WEDNESDAY_MORNING,
  });
  assert.deepEqual(run.posts, []);

  const nextWeek = planStandingGamePostingRun({
    games: [tuesday8pm()],
    postedDatesByGame: new Map([["sg-1", new Set(["2026-10-13"])]]),
    now: new Date("2026-10-14T13:00:00.000Z"),
  });
  assert.deepEqual(
    nextWeek.posts.map((post) => post.gameDate),
    ["2026-10-20"],
  );
});

test("the it's-off email goes to every User who said yes or maybe, never to no, Guests or the organizer", () => {
  const recipients = gameOffRecipients(
    [
      { userId: "ben", answer: "yes" },
      { userId: "anna", answer: "maybe" },
      { userId: "tyson", answer: "no" },
      { userId: null, answer: "yes" },
      { userId: "amy", answer: "yes" },
    ],
    "amy",
  );
  assert.deepEqual(recipients, ["ben", "anna"]);
});

test("the skip confirm says how many people get told", () => {
  assert.equal(
    skipWeekNotice(0),
    "Nobody has said yes or maybe yet, so nobody gets an email.",
  );
  assert.equal(skipWeekNotice(1), "The 1 person who said yes or maybe gets an email saying it's off.");
  assert.equal(skipWeekNotice(4), "The 4 people who said yes or maybe get an email saying it's off.");
});

test("a game that has already started tells nobody", () => {
  assert.equal(gameOffRecipients([{ userId: "ben", answer: "yes" }], "amy", { started: true }).length, 0);
  assert.equal(skipWeekNotice(3, { started: true }), "This game has already started, so nobody gets an email.");
});
