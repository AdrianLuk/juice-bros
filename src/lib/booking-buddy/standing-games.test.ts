import assert from "node:assert/strict";
import test from "node:test";

import {
  dueStandingGameWeeks,
  everyWeekdayLabel,
  parseStandingGameForm,
  planStandingGamePostingRun,
  postedWeekNumbers,
  slotRepeatsLabel,
  standingGameSchedule,
  standingGameTimeLabel,
  stillUpcomingCutoffDate,
  type StandingGameSchedule,
} from "./standing-games.ts";

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

// Wed Oct 7 2026, 9am in Toronto (EDT, UTC-4) — the daily cron's hour.
const WEDNESDAY_MORNING = new Date("2026-10-07T13:00:00.000Z");

test("a normal week: the next Tuesday is due, the one after is not yet", () => {
  assert.deepEqual(dueStandingGameWeeks(tuesday8pm(), new Set(), WEDNESDAY_MORNING), [
    "2026-10-13",
  ]);
});

test("a 14-day Booking Window posts two weeks ahead, so two upcoming games are on the board", () => {
  const game = tuesday8pm({ bookingWindowDaysBefore: 14 });
  assert.deepEqual(dueStandingGameWeeks(game, new Set(), WEDNESDAY_MORNING), [
    "2026-10-13",
    "2026-10-20",
  ]);
});

test("a short Booking Window still posts a full week ahead", () => {
  const game = tuesday8pm({ bookingWindowDaysBefore: 2 });
  assert.deepEqual(dueStandingGameWeeks(game, new Set(), WEDNESDAY_MORNING), ["2026-10-13"]);
});

test("an ended Standing Game posts nothing", () => {
  const game = tuesday8pm({ endedAt: "2026-10-06T18:00:00.000Z" });
  assert.deepEqual(dueStandingGameWeeks(game, new Set(), WEDNESDAY_MORNING), []);
});

test("a rerun on the same day posts nothing new once the week is recorded", () => {
  const posted = new Set(dueStandingGameWeeks(tuesday8pm(), new Set(), WEDNESDAY_MORNING));
  assert.deepEqual(dueStandingGameWeeks(tuesday8pm(), posted, WEDNESDAY_MORNING), []);
});

test("today's game is due while its start is still ahead, and skipped once it has started", () => {
  // Tue Oct 13, 7pm and 9pm in Toronto (EDT).
  const before = new Date("2026-10-13T23:00:00.000Z");
  const after = new Date("2026-10-14T01:00:00.000Z");
  assert.deepEqual(dueStandingGameWeeks(tuesday8pm(), new Set(), before), [
    "2026-10-13",
    "2026-10-20",
  ]);
  assert.deepEqual(dueStandingGameWeeks(tuesday8pm(), new Set(), after), ["2026-10-20"]);
});

test("a DST change week reads the Toronto wall clock, not a fixed offset", () => {
  // DST ends Sun Nov 1 2026. Tue Nov 3, 7:30pm EST is 00:30Z on Nov 4; an
  // offset still stuck on EDT would read 8:30pm and drop tonight's game.
  const tuesdayEveningAfterChange = new Date("2026-11-04T00:30:00.000Z");
  assert.deepEqual(dueStandingGameWeeks(tuesday8pm(), new Set(), tuesdayEveningAfterChange), [
    "2026-11-03",
    "2026-11-10",
  ]);
});

test("the week a DST change falls in is posted on its own date", () => {
  // Wed Oct 28 2026, 9am EDT: the next Tuesday (Nov 3) is after the change.
  const wednesdayBeforeChange = new Date("2026-10-28T13:00:00.000Z");
  assert.deepEqual(dueStandingGameWeeks(tuesday8pm(), new Set(), wednesdayBeforeChange), [
    "2026-11-03",
  ]);
});

test("a posting run lists every live Standing Game's due weeks and skips the ended and the caught up", () => {
  const plan = planStandingGamePostingRun({
    games: [
      tuesday8pm({ id: "live" }),
      tuesday8pm({ id: "ended", endedAt: "2026-10-01T00:00:00.000Z" }),
      tuesday8pm({ id: "caught-up" }),
      tuesday8pm({ id: "thursday", weekday: 4, startHour: 19 }),
    ],
    postedDatesByGame: new Map([["caught-up", new Set(["2026-10-13"])]]),
    now: WEDNESDAY_MORNING,
  });

  assert.deepEqual(plan.posts, [
    { standingGameId: "live", gameDate: "2026-10-13" },
    { standingGameId: "thursday", gameDate: "2026-10-08" },
  ]);
  assert.equal(plan.checked, 4);
});

test("the chip names the weekday a posted game falls on in its own zone", () => {
  // Tue Oct 13, 11pm in Toronto is already Wednesday in UTC.
  assert.equal(
    slotRepeatsLabel({ proposedStart: "2026-10-14T03:00:00.000Z", timeZone: "America/Toronto" }),
    "Every Tuesday",
  );
});

test("weekday and time labels read the way the Weekly games row shows them", () => {
  assert.equal(everyWeekdayLabel(0), "Every Sunday");
  assert.equal(standingGameTimeLabel({ startHour: 20, endHour: 22 }), "8:00 PM – 10:00 PM");
  assert.equal(standingGameTimeLabel({ startHour: 22, endHour: 1 }), "10:00 PM – 1:00 AM");
});

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

test("the Post a game form's weekly fields read as a Standing Game, with the Slot defaults for what it doesn't ask", () => {
  assert.deepEqual(
    parseStandingGameForm(
      form({
        weekday: "2",
        start_time: "20:00",
        end_time: "22:00",
        division: "mixed",
        org_id: "org-1",
        notes: "  Bring balls  ",
      }),
    ),
    {
      weekday: 2,
      startHour: 20,
      endHour: 22,
      division: "mixed",
      orgId: "org-1",
      notes: "Bring balls",
      rotationBuffer: 0,
      reminderOffsetMinutes: 60,
    },
  );
});

test("the Standing Game page's edit form carries rotation buffer and reminder timing too", () => {
  const parsed = parseStandingGameForm(
    form({
      weekday: "4",
      start_time: "22:00",
      end_time: "01:00",
      rotation_buffer: "2",
      reminder_offset_minutes: "1440",
    }),
  );
  assert.deepEqual(parsed, {
    weekday: 4,
    startHour: 22,
    endHour: 1,
    division: "open",
    orgId: null,
    notes: null,
    rotationBuffer: 2,
    reminderOffsetMinutes: 1440,
  });
});

test("a weekly game needs a real day and a range that isn't zero length", () => {
  assert.ok("error" in parseStandingGameForm(form({ weekday: "7", start_time: "20:00", end_time: "22:00" })));
  assert.ok("error" in parseStandingGameForm(form({ start_time: "20:00", end_time: "22:00" })));
  assert.ok("error" in parseStandingGameForm(form({ weekday: "2", start_time: "20:00", end_time: "20:00" })));
  assert.ok("error" in parseStandingGameForm(form({ weekday: "2", start_time: "20:30", end_time: "22:00" })));
});

test("an out-of-range rotation buffer or reminder timing is refused", () => {
  const base = { weekday: "2", start_time: "20:00", end_time: "22:00" };
  assert.ok("error" in parseStandingGameForm(form({ ...base, rotation_buffer: "-1" })));
  assert.ok("error" in parseStandingGameForm(form({ ...base, rotation_buffer: "21" })));
  assert.ok("error" in parseStandingGameForm(form({ ...base, reminder_offset_minutes: "99999" })));
});

test("stillUpcomingCutoffDate goes back two UTC calendar days, so no zone's today is missed", () => {
  // 3am UTC on Oct 6 is still Oct 5 in Toronto and Oct 5 in Honolulu.
  assert.equal(stillUpcomingCutoffDate(new Date("2026-10-06T03:00:00.000Z")), "2026-10-04");
  assert.equal(stillUpcomingCutoffDate(new Date("2027-01-01T23:00:00.000Z")), "2026-12-30");
});

test("postedWeekNumbers counts each posted week among its Standing Game's posted weeks", () => {
  const recorded = new Map([
    ["sg-1", new Set(["2026-10-06", "2026-10-13", "2026-10-20"])],
    ["sg-2", new Set(["2026-10-08"])],
  ]);

  assert.deepEqual(
    postedWeekNumbers(
      [
        { standingGameId: "sg-1", gameDate: "2026-10-20" },
        { standingGameId: "sg-2", gameDate: "2026-10-08" },
      ],
      recorded,
    ),
    [3, 1],
  );
});

test("postedWeekNumbers counts a just-posted week the read hasn't seen yet", () => {
  assert.deepEqual(
    postedWeekNumbers(
      [
        { standingGameId: "sg-1", gameDate: "2026-10-13" },
        { standingGameId: "sg-1", gameDate: "2026-10-20" },
      ],
      new Map([["sg-1", new Set(["2026-10-06"])]]),
    ),
    [2, 3],
  );
  assert.deepEqual(
    postedWeekNumbers([{ standingGameId: "sg-9", gameDate: "2026-10-13" }], new Map()),
    [1],
  );
});

test("standingGameSchedule reads a standing_games row the way the planner wants it", () => {
  assert.deepEqual(
    standingGameSchedule(
      { id: "sg-1", weekday: 2, start_hour: 20, time_zone: "America/Toronto", ended_at: null },
      14,
    ),
    tuesday8pm({ bookingWindowDaysBefore: 14 }),
  );
});
