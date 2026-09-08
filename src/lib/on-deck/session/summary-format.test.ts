import assert from "node:assert/strict";
import test from "node:test";

import {
  barPercent,
  courtRows,
  skillRows,
  utilizationSentence,
  waitBucketLabel,
  waitConfidenceNote,
  waitRows,
} from "./summary-format.ts";
import type { SessionSummary } from "./summary.ts";

function summary(over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    attendance: 0,
    gamesPlayed: 0,
    courtUtilization: { courtCount: 0, perCourt: [], gamesPerCourt: 0 },
    waitTime: {
      distribution: [
        { fromMin: 0, toMin: 5, count: 0 },
        { fromMin: 5, toMin: 10, count: 0 },
        { fromMin: 10, toMin: 20, count: 0 },
        { fromMin: 20, toMin: 30, count: 0 },
        { fromMin: 30, toMin: null, count: 0 },
      ],
      longestWaitMin: 0,
      averageWaitMin: 0,
      sampleSize: 0,
    },
    skillMix: { newbie: 0, beginner: 0, intermediate: 0, advanced: 0 },
    ...over,
  };
}

test("a wait bucket reads as words, and the open-ended one reads differently", () => {
  assert.equal(waitBucketLabel({ fromMin: 0, toMin: 5, count: 0 }), "Under 5 min");
  assert.equal(waitBucketLabel({ fromMin: 5, toMin: 10, count: 0 }), "5 to 10 min");
  assert.equal(
    waitBucketLabel({ fromMin: 30, toMin: null, count: 0 }),
    "30 min or more",
  );
});

test("bar length is relative to the largest row, and an empty row stays empty", () => {
  assert.equal(barPercent(10, 10), 100);
  assert.equal(barPercent(5, 10), 50);
  assert.equal(barPercent(1, 3), 33.3);
  // A category with nobody in it reads as empty, never as a sliver.
  assert.equal(barPercent(0, 10), 0);
  // An all-zero chart divides by nothing rather than by zero.
  assert.equal(barPercent(0, 0), 0);
});

test("wait rows keep bucket order and scale to their own largest bucket", () => {
  const s = summary({
    waitTime: {
      distribution: [
        { fromMin: 0, toMin: 5, count: 2 },
        { fromMin: 5, toMin: 10, count: 8 },
        { fromMin: 10, toMin: 20, count: 4 },
        { fromMin: 20, toMin: 30, count: 0 },
        { fromMin: 30, toMin: null, count: 1 },
      ],
      longestWaitMin: 34,
      averageWaitMin: 9,
      sampleSize: 15,
    },
  });

  const rows = waitRows(s);
  assert.deepEqual(
    rows.map((r) => r.label),
    ["Under 5 min", "5 to 10 min", "10 to 20 min", "20 to 30 min", "30 min or more"],
  );
  assert.deepEqual(rows.map((r) => r.count), [2, 8, 4, 0, 1]);
  assert.equal(rows[1].percent, 100);
  assert.equal(rows[0].percent, 25);
  assert.equal(rows[3].percent, 0);
});

test("court rows are one per Court, in court order, including the idle ones", () => {
  const s = summary({
    gamesPlayed: 9,
    courtUtilization: { courtCount: 4, perCourt: [4, 3, 2, 0], gamesPerCourt: 2.25 },
  });

  const rows = courtRows(s);
  assert.deepEqual(rows.map((r) => r.label), [
    "Court 1",
    "Court 2",
    "Court 3",
    "Court 4",
  ]);
  // A Court nobody played on is still a row — that it sat idle is the finding.
  assert.equal(rows[3].count, 0);
  assert.equal(rows[0].percent, 100);
});

test("skill rows keep the club's fixed order rather than sorting by size", () => {
  const s = summary({
    skillMix: { newbie: 1, beginner: 12, intermediate: 6, advanced: 2 },
  });

  const rows = skillRows(s);
  assert.deepEqual(rows.map((r) => r.label), [
    "Newbie",
    "Beginner",
    "Intermediate",
    "Advanced",
  ]);
  assert.deepEqual(rows.map((r) => r.count), [1, 12, 6, 2]);
});

test("the average wait says how much to trust it", () => {
  assert.match(waitConfidenceNote(summary()), /no wait to average/);

  const thin = summary({
    waitTime: { ...summary().waitTime, sampleSize: 1 },
  });
  assert.equal(waitConfidenceNote(thin), "From 1 wait. Too few to read as a pattern.");

  const few = summary({ waitTime: { ...summary().waitTime, sampleSize: 4 } });
  assert.match(waitConfidenceNote(few), /From 4 waits\. Too few/);

  const enough = summary({ waitTime: { ...summary().waitTime, sampleSize: 40 } });
  assert.equal(waitConfidenceNote(enough), "From 40 waits.");
});

test("the utilization sentence pluralises and rounds to one place", () => {
  const s = summary({
    gamesPlayed: 47,
    courtUtilization: { courtCount: 8, perCourt: [], gamesPerCourt: 47 / 8 },
  });
  assert.equal(utilizationSentence(s), "8 courts, 47 games, 5.9 per court.");

  const one = summary({
    gamesPlayed: 1,
    courtUtilization: { courtCount: 1, perCourt: [], gamesPerCourt: 1 },
  });
  assert.equal(utilizationSentence(one), "1 court, 1 game, 1 per court.");
});
