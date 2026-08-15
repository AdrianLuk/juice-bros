import assert from "node:assert/strict";
import test from "node:test";

import { resolveAvailability } from "./availability.ts";

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
          type: "open",
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
        type: "open",
        startsAt: "2026-08-20T11:00:00Z",
        endsAt: "2026-08-20T13:00:00Z",
        createdAt: "2026-08-18T00:00:00Z",
      },
    ],
  });

  assert.equal(result, "open");
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
          type: "open",
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
    type: "open" as const,
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
    "open",
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
    "open",
    "the newer window still wins after the older one is edited to also cover `at`",
  );
});
