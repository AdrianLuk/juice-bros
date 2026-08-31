import assert from "node:assert/strict";
import test from "node:test";

import {
  availabilityWriteMessage,
  formatAvailabilityWindowRange,
  parseNewAvailabilityWindow,
  resolveAvailability,
  resolveAvailabilitySegments,
  resolveCommonOpenSegments,
} from "./availability.ts";

test("a Booking or confirmed Slot covering `at` returns busy regardless of any Availability Window", () => {
  const at = new Date("2026-08-20T12:00:00Z");

  assert.equal(
    resolveAvailability({
      at,
      busyIntervals: [
        { startsAt: "2026-08-20T10:00:00Z", endsAt: "2026-08-20T14:00:00Z" },
      ],
      windows: [
        {
          type: "looking",
          startsAt: "2026-08-20T00:00:00Z",
          endsAt: "2026-08-21T00:00:00Z",
          createdAt: "2026-08-19T00:00:00Z",
        },
      ],
    }),
    "busy",
  );
});

test("with no covering Booking/confirmed Slot, the most recently created Availability Window wins", () => {
  const at = new Date("2026-08-20T12:00:00Z");

  const result = resolveAvailability({
    at,
    busyIntervals: [],
    windows: [
      {
        type: "busy",
        startsAt: "2026-08-20T10:00:00Z",
        endsAt: "2026-08-20T14:00:00Z",
        createdAt: "2026-08-15T00:00:00Z",
      },
      {
        type: "looking",
        startsAt: "2026-08-20T11:00:00Z",
        endsAt: "2026-08-20T13:00:00Z",
        createdAt: "2026-08-18T00:00:00Z",
      },
    ],
  });

  assert.equal(result, "looking");
});

test("a moment covered by neither a busy interval nor an Availability Window is unspecified", () => {
  const at = new Date("2026-08-20T12:00:00Z");

  assert.equal(
    resolveAvailability({
      at,
      busyIntervals: [
        { startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-01-02T00:00:00Z" },
      ],
      windows: [
        {
          type: "looking",
          startsAt: "2026-08-21T00:00:00Z",
          endsAt: "2026-08-22T00:00:00Z",
          createdAt: "2026-08-15T00:00:00Z",
        },
      ],
    }),
    "unspecified",
  );
});

test("creation order, not edit order, decides precedence", () => {
  const at = new Date("2026-08-20T11:30:00Z");

  // Created first, and does not originally cover `at` at all.
  const olderWindowBeforeEdit = {
    type: "busy" as const,
    startsAt: "2026-08-10T00:00:00Z",
    endsAt: "2026-08-10T01:00:00Z",
    createdAt: "2026-08-15T00:00:00Z",
  };
  // Created second, and covers `at`.
  const newerWindow = {
    type: "looking" as const,
    startsAt: "2026-08-20T11:00:00Z",
    endsAt: "2026-08-20T13:00:00Z",
    createdAt: "2026-08-18T00:00:00Z",
  };

  assert.equal(
    resolveAvailability({
      at,
      busyIntervals: [],
      windows: [olderWindowBeforeEdit, newerWindow],
    }),
    "looking",
    "the newer window wins when it's the only one covering `at`",
  );

  // Now edit the *older* window's own time range and type so it newly covers
  // `at` too — but its createdAt, fixed at insert, doesn't change. If
  // precedence tracked edit recency instead, this row (just touched) would
  // now win over the row that was actually created more recently.
  const olderWindowAfterEdit = {
    ...olderWindowBeforeEdit,
    type: "busy" as const,
    startsAt: "2026-08-20T10:00:00Z",
    endsAt: "2026-08-20T14:00:00Z",
  };

  assert.equal(
    resolveAvailability({
      at,
      busyIntervals: [],
      windows: [olderWindowAfterEdit, newerWindow],
    }),
    "looking",
    "the newer window still wins after the older one is edited to also cover `at`",
  );
});

test("resolveAvailabilitySegments: a busy-covered span is omitted entirely, not returned as a busy segment", () => {
  const segments = resolveAvailabilitySegments({
    rangeStart: new Date("2026-08-20T00:00:00Z"),
    rangeEnd: new Date("2026-08-21T00:00:00Z"),
    busyIntervals: [
      { startsAt: "2026-08-20T10:00:00Z", endsAt: "2026-08-20T14:00:00Z" },
    ],
    windows: [
      {
        type: "looking",
        startsAt: "2026-08-20T00:00:00Z",
        endsAt: "2026-08-21T00:00:00Z",
        createdAt: "2026-08-19T00:00:00Z",
      },
    ],
  });

  // The Booking owns 10:00-14:00 — the calendar draws its own block there, so
  // no Availability segment should claim that span (ADR 0006, "never both").
  // The Availability Window's `looking` declaration still surfaces either side.
  assert.deepEqual(segments, [
    { type: "looking", startsAt: "2026-08-20T00:00:00.000Z", endsAt: "2026-08-20T10:00:00.000Z" },
    { type: "looking", startsAt: "2026-08-20T14:00:00.000Z", endsAt: "2026-08-21T00:00:00.000Z" },
  ]);
});

test("resolveAvailabilitySegments: adjacent same-type slices merge into one segment", () => {
  const segments = resolveAvailabilitySegments({
    rangeStart: new Date("2026-08-20T00:00:00Z"),
    rangeEnd: new Date("2026-08-21T00:00:00Z"),
    busyIntervals: [],
    windows: [
      {
        type: "looking",
        startsAt: "2026-08-20T08:00:00Z",
        endsAt: "2026-08-20T12:00:00Z",
        createdAt: "2026-08-15T00:00:00Z",
      },
      {
        type: "looking",
        startsAt: "2026-08-20T12:00:00Z",
        endsAt: "2026-08-20T18:00:00Z",
        createdAt: "2026-08-16T00:00:00Z",
      },
    ],
  });

  assert.deepEqual(segments, [
    { type: "looking", startsAt: "2026-08-20T08:00:00.000Z", endsAt: "2026-08-20T18:00:00.000Z" },
  ]);
});

test("resolveAvailabilitySegments: an unspecified stretch produces no segment at all", () => {
  const segments = resolveAvailabilitySegments({
    rangeStart: new Date("2026-08-20T00:00:00Z"),
    rangeEnd: new Date("2026-08-21T00:00:00Z"),
    busyIntervals: [],
    windows: [],
  });

  assert.deepEqual(segments, []);
});

test("resolveAvailabilitySegments: a Window outside the visible range is clamped to it, not dropped", () => {
  const segments = resolveAvailabilitySegments({
    rangeStart: new Date("2026-08-20T00:00:00Z"),
    rangeEnd: new Date("2026-08-21T00:00:00Z"),
    busyIntervals: [],
    windows: [
      {
        type: "busy",
        startsAt: "2026-08-19T00:00:00Z",
        endsAt: "2026-08-22T00:00:00Z",
        createdAt: "2026-08-15T00:00:00Z",
      },
    ],
  });

  assert.deepEqual(segments, [
    { type: "busy", startsAt: "2026-08-20T00:00:00.000Z", endsAt: "2026-08-21T00:00:00.000Z" },
  ]);
});

test("resolveAvailabilitySegments: an override still wins its own slice, splitting the group's default either side", () => {
  const segments = resolveAvailabilitySegments({
    rangeStart: new Date("2026-08-20T00:00:00Z"),
    rangeEnd: new Date("2026-08-21T00:00:00Z"),
    busyIntervals: [],
    windows: [
      {
        type: "busy",
        startsAt: "2026-08-20T09:00:00Z",
        endsAt: "2026-08-20T17:00:00Z",
        createdAt: "2026-08-15T00:00:00Z",
      },
      {
        type: "looking",
        startsAt: "2026-08-20T12:00:00Z",
        endsAt: "2026-08-20T13:00:00Z",
        createdAt: "2026-08-18T00:00:00Z",
      },
    ],
  });

  assert.deepEqual(segments, [
    { type: "busy", startsAt: "2026-08-20T09:00:00.000Z", endsAt: "2026-08-20T12:00:00.000Z" },
    { type: "looking", startsAt: "2026-08-20T12:00:00.000Z", endsAt: "2026-08-20T13:00:00.000Z" },
    { type: "busy", startsAt: "2026-08-20T13:00:00.000Z", endsAt: "2026-08-20T17:00:00.000Z" },
  ]);
});

test("resolveCommonOpenSegments: with nobody busy, the whole range comes back as one free segment", () => {
  const segments = resolveCommonOpenSegments({
    rangeStart: new Date("2026-08-20T00:00:00Z"),
    rangeEnd: new Date("2026-08-21T00:00:00Z"),
    people: [
      { busyIntervals: [], windows: [] },
      { busyIntervals: [], windows: [] },
    ],
  });

  assert.deepEqual(segments, [
    { startsAt: "2026-08-20T00:00:00.000Z", endsAt: "2026-08-21T00:00:00.000Z" },
  ]);
});

test("resolveCommonOpenSegments: no people means no common time", () => {
  assert.deepEqual(
    resolveCommonOpenSegments({
      rangeStart: new Date("2026-08-20T00:00:00Z"),
      rangeEnd: new Date("2026-08-21T00:00:00Z"),
      people: [],
    }),
    [],
  );
});

test("resolveCommonOpenSegments: one person's busy Window carves that span out of the shared time", () => {
  const segments = resolveCommonOpenSegments({
    rangeStart: new Date("2026-08-20T00:00:00Z"),
    rangeEnd: new Date("2026-08-21T00:00:00Z"),
    people: [
      {
        busyIntervals: [],
        windows: [
          {
            type: "busy",
            startsAt: "2026-08-20T10:00:00Z",
            endsAt: "2026-08-20T14:00:00Z",
            createdAt: "2026-08-15T00:00:00Z",
          },
        ],
      },
      { busyIntervals: [], windows: [] },
    ],
  });

  assert.deepEqual(segments, [
    { startsAt: "2026-08-20T00:00:00.000Z", endsAt: "2026-08-20T10:00:00.000Z" },
    { startsAt: "2026-08-20T14:00:00.000Z", endsAt: "2026-08-21T00:00:00.000Z" },
  ]);
});

test("resolveCommonOpenSegments: a Booking (busy interval) carves out its span too", () => {
  const segments = resolveCommonOpenSegments({
    rangeStart: new Date("2026-08-20T00:00:00Z"),
    rangeEnd: new Date("2026-08-21T00:00:00Z"),
    people: [
      {
        busyIntervals: [
          { startsAt: "2026-08-20T18:00:00Z", endsAt: "2026-08-20T20:00:00Z" },
        ],
        windows: [],
      },
    ],
  });

  assert.deepEqual(segments, [
    { startsAt: "2026-08-20T00:00:00.000Z", endsAt: "2026-08-20T18:00:00.000Z" },
    { startsAt: "2026-08-20T20:00:00.000Z", endsAt: "2026-08-21T00:00:00.000Z" },
  ]);
});

test("resolveCommonOpenSegments: a `looking` Window carves nothing — free means 'not busy', unspecified included", () => {
  const segments = resolveCommonOpenSegments({
    rangeStart: new Date("2026-08-20T00:00:00Z"),
    rangeEnd: new Date("2026-08-21T00:00:00Z"),
    people: [
      {
        busyIntervals: [],
        windows: [
          {
            type: "looking",
            startsAt: "2026-08-20T10:00:00Z",
            endsAt: "2026-08-20T14:00:00Z",
            createdAt: "2026-08-15T00:00:00Z",
          },
        ],
      },
      { busyIntervals: [], windows: [] },
    ],
  });

  assert.deepEqual(segments, [
    { startsAt: "2026-08-20T00:00:00.000Z", endsAt: "2026-08-21T00:00:00.000Z" },
  ]);
});

test("resolveCommonOpenSegments: a newer `looking` Window reopens the span an older `busy` Window closed (ADR 0006)", () => {
  const segments = resolveCommonOpenSegments({
    rangeStart: new Date("2026-08-20T00:00:00Z"),
    rangeEnd: new Date("2026-08-21T00:00:00Z"),
    people: [
      {
        busyIntervals: [],
        windows: [
          {
            type: "busy",
            startsAt: "2026-08-20T10:00:00Z",
            endsAt: "2026-08-20T14:00:00Z",
            createdAt: "2026-08-15T00:00:00Z",
          },
          {
            type: "looking",
            startsAt: "2026-08-20T11:00:00Z",
            endsAt: "2026-08-20T13:00:00Z",
            createdAt: "2026-08-18T00:00:00Z",
          },
        ],
      },
    ],
  });

  assert.deepEqual(segments, [
    { startsAt: "2026-08-20T00:00:00.000Z", endsAt: "2026-08-20T10:00:00.000Z" },
    { startsAt: "2026-08-20T11:00:00.000Z", endsAt: "2026-08-20T13:00:00.000Z" },
    { startsAt: "2026-08-20T14:00:00.000Z", endsAt: "2026-08-21T00:00:00.000Z" },
  ]);
});

test("resolveCommonOpenSegments: three people's staggered busy Windows leave the gaps between them", () => {
  const busyWindow = (startsAt: string, endsAt: string) => ({
    busyIntervals: [],
    windows: [{ type: "busy" as const, startsAt, endsAt, createdAt: "2026-08-15T00:00:00Z" }],
  });

  const segments = resolveCommonOpenSegments({
    rangeStart: new Date("2026-08-20T08:00:00Z"),
    rangeEnd: new Date("2026-08-20T20:00:00Z"),
    people: [
      busyWindow("2026-08-20T09:00:00Z", "2026-08-20T11:00:00Z"),
      busyWindow("2026-08-20T12:00:00Z", "2026-08-20T14:00:00Z"),
      busyWindow("2026-08-20T16:00:00Z", "2026-08-20T18:00:00Z"),
    ],
  });

  assert.deepEqual(segments, [
    { startsAt: "2026-08-20T08:00:00.000Z", endsAt: "2026-08-20T09:00:00.000Z" },
    { startsAt: "2026-08-20T11:00:00.000Z", endsAt: "2026-08-20T12:00:00.000Z" },
    { startsAt: "2026-08-20T14:00:00.000Z", endsAt: "2026-08-20T16:00:00.000Z" },
    { startsAt: "2026-08-20T18:00:00.000Z", endsAt: "2026-08-20T20:00:00.000Z" },
  ]);
});

test("resolveCommonOpenSegments: free slices merge across an internal boundary that doesn't change the state", () => {
  // Person A is `looking` 09:00-17:00 (an internal 09:00 and 17:00 boundary
  // that must NOT split the free run); person B is busy 12:00-13:00.
  const segments = resolveCommonOpenSegments({
    rangeStart: new Date("2026-08-20T00:00:00Z"),
    rangeEnd: new Date("2026-08-21T00:00:00Z"),
    people: [
      {
        busyIntervals: [],
        windows: [
          {
            type: "looking",
            startsAt: "2026-08-20T09:00:00Z",
            endsAt: "2026-08-20T17:00:00Z",
            createdAt: "2026-08-15T00:00:00Z",
          },
        ],
      },
      {
        busyIntervals: [],
        windows: [
          {
            type: "busy",
            startsAt: "2026-08-20T12:00:00Z",
            endsAt: "2026-08-20T13:00:00Z",
            createdAt: "2026-08-15T00:00:00Z",
          },
        ],
      },
    ],
  });

  assert.deepEqual(segments, [
    { startsAt: "2026-08-20T00:00:00.000Z", endsAt: "2026-08-20T12:00:00.000Z" },
    { startsAt: "2026-08-20T13:00:00.000Z", endsAt: "2026-08-21T00:00:00.000Z" },
  ]);
});

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

test("parseNewAvailabilityWindow: an all-day range is accepted, defaulting to busy", () => {
  const result = parseNewAvailabilityWindow(
    formData({ all_day: "on", from_date: "2026-08-24", to_date: "2026-08-30" }),
  );

  assert.deepEqual(result, {
    type: "busy",
    fromDate: "2026-08-24",
    toDate: "2026-08-30",
    startTime: null,
    endTime: null,
  });
});

test("parseNewAvailabilityWindow: an explicit type is honoured", () => {
  const result = parseNewAvailabilityWindow(
    formData({ type: "looking", all_day: "on", from_date: "2026-08-24", to_date: "2026-08-24" }),
  );

  assert.deepEqual(result, {
    type: "looking",
    fromDate: "2026-08-24",
    toDate: "2026-08-24",
    startTime: null,
    endTime: null,
  });
});

test("parseNewAvailabilityWindow: an unrecognised type falls back to busy rather than refusing the form", () => {
  const result = parseNewAvailabilityWindow(
    formData({
      type: "gone-fishing",
      all_day: "on",
      from_date: "2026-08-24",
      to_date: "2026-08-24",
    }),
  );

  assert.deepEqual(result, {
    type: "busy",
    fromDate: "2026-08-24",
    toDate: "2026-08-24",
    startTime: null,
    endTime: null,
  });
});

test("parseNewAvailabilityWindow: a missing or malformed start date is refused", () => {
  assert.deepEqual(parseNewAvailabilityWindow(formData({ to_date: "2026-08-24" })), {
    error: "Pick a start date.",
  });
  assert.deepEqual(
    parseNewAvailabilityWindow(formData({ from_date: "not-a-date", to_date: "2026-08-24" })),
    { error: "Pick a start date." },
  );
});

test("parseNewAvailabilityWindow: a missing or malformed end date is refused", () => {
  assert.deepEqual(parseNewAvailabilityWindow(formData({ from_date: "2026-08-24" })), {
    error: "Pick an end date.",
  });
});

test("parseNewAvailabilityWindow: an end date before the start date is refused", () => {
  assert.deepEqual(
    parseNewAvailabilityWindow(formData({ from_date: "2026-08-24", to_date: "2026-08-20" })),
    { error: "The end date has to be on or after the start date." },
  );
});

test("parseNewAvailabilityWindow: a single-day all-day window (from equals to) is accepted", () => {
  const result = parseNewAvailabilityWindow(
    formData({ all_day: "on", from_date: "2026-08-24", to_date: "2026-08-24" }),
  );

  assert.deepEqual(result, {
    type: "busy",
    fromDate: "2026-08-24",
    toDate: "2026-08-24",
    startTime: null,
    endTime: null,
  });
});

test("parseNewAvailabilityWindow: unchecking all-day requires a start and end time", () => {
  const result = parseNewAvailabilityWindow(
    formData({ from_date: "2026-08-24", to_date: "2026-08-24", start_time: "18:00", end_time: "21:00" }),
  );

  assert.deepEqual(result, {
    type: "busy",
    fromDate: "2026-08-24",
    toDate: "2026-08-24",
    startTime: "18:00",
    endTime: "21:00",
  });
});

test("parseNewAvailabilityWindow: a timed window missing or off-grid times is refused", () => {
  assert.deepEqual(
    parseNewAvailabilityWindow(formData({ from_date: "2026-08-24", to_date: "2026-08-24" })),
    { error: "Pick a start and end time, or mark it all day." },
  );
  assert.deepEqual(
    parseNewAvailabilityWindow(
      formData({ from_date: "2026-08-24", to_date: "2026-08-24", start_time: "18:15", end_time: "21:00" }),
    ),
    { error: "Pick a start and end time, or mark it all day." },
  );
});

test("parseNewAvailabilityWindow: a same-day timed window needs its end time after its start time", () => {
  assert.deepEqual(
    parseNewAvailabilityWindow(
      formData({ from_date: "2026-08-24", to_date: "2026-08-24", start_time: "21:00", end_time: "18:00" }),
    ),
    { error: "The end time has to be after the start time." },
  );
});

test("parseNewAvailabilityWindow: a cross-day timed window is fine even when the end clock time reads earlier", () => {
  // Friday evening through Saturday morning — the date order already
  // confirms it's a real span, so the same-day clock check doesn't apply.
  const result = parseNewAvailabilityWindow(
    formData({
      from_date: "2026-08-21",
      to_date: "2026-08-22",
      start_time: "22:00",
      end_time: "08:00",
    }),
  );

  assert.deepEqual(result, {
    type: "busy",
    fromDate: "2026-08-21",
    toDate: "2026-08-22",
    startTime: "22:00",
    endTime: "08:00",
  });
});

test("availabilityWriteMessage: the ends-after-start check constraint reads as a friendly message", () => {
  assert.equal(
    availabilityWriteMessage({ code: "23514" }),
    "The end date has to be on or after the start date.",
  );
});

test("availabilityWriteMessage: an unexplained failure still says what was being attempted", () => {
  assert.equal(availabilityWriteMessage({ code: "42501" }), "Couldn't save that. Try again.");
  assert.equal(availabilityWriteMessage({}), "Couldn't save that. Try again.");
});

test("formatAvailabilityWindowRange: a multi-day window reads as From – To, using the inclusive last day", () => {
  // A week off picked as Aug 24 through Aug 30 is stored with the exclusive
  // next-day boundary (Aug 31 00:00) — the display has to undo that, or a
  // window through Sunday would read as running through Monday.
  const label = formatAvailabilityWindowRange(
    { startsAt: "2026-08-24T04:00:00.000Z", endsAt: "2026-08-31T04:00:00.000Z" },
    "America/Toronto",
  );

  assert.equal(label, "Aug 24 – Aug 30");
});

test("formatAvailabilityWindowRange: a single all-day window reads as one date, not a range", () => {
  const label = formatAvailabilityWindowRange(
    { startsAt: "2026-08-24T04:00:00.000Z", endsAt: "2026-08-25T04:00:00.000Z" },
    "America/Toronto",
  );

  assert.equal(label, "Aug 24");
});

test("formatAvailabilityWindowRange: a same-day timed window reads as Date · Start – End", () => {
  // 2026-08-24 6:00 PM / 9:00 PM in Toronto (EDT, UTC-4).
  const label = formatAvailabilityWindowRange(
    { startsAt: "2026-08-24T22:00:00.000Z", endsAt: "2026-08-25T01:00:00.000Z" },
    "America/Toronto",
  );

  assert.equal(label, "Aug 24 · 6:00 PM – 9:00 PM");
});

test("formatAvailabilityWindowRange: a cross-day timed window reads as Date Time – Date Time", () => {
  // Fri 2026-08-21 10:00 PM through Sat 2026-08-22 8:00 AM in Toronto.
  const label = formatAvailabilityWindowRange(
    { startsAt: "2026-08-22T02:00:00.000Z", endsAt: "2026-08-22T12:00:00.000Z" },
    "America/Toronto",
  );

  assert.equal(label, "Aug 21 10:00 PM – Aug 22 8:00 AM");
});
