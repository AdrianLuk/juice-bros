import assert from "node:assert/strict";
import { test } from "node:test";

import { barShare, chartRanks, nextChart } from "./leaderboard.ts";

test("tied Contestants share a rank, and the next rank skips past them", () => {
  const ranks = chartRanks([
    { id: "anna", votes: 9 },
    { id: "ben", votes: 7 },
    { id: "jw", votes: 7 },
    { id: "tyson", votes: 4 },
  ]);
  assert.deepEqual(ranks, { anna: 1, ben: 2, jw: 2, tyson: 4 });
});

test("a Contestant with no Votes has no rank yet", () => {
  const ranks = chartRanks([
    { id: "anna", votes: 1 },
    { id: "ben", votes: 0 },
    { id: "jw", votes: 0 },
  ]);
  assert.deepEqual(ranks, { anna: 1, ben: null, jw: null });
});

test("a bar's length is its share of the leader's Votes", () => {
  assert.equal(barShare(9, 9), 1);
  assert.equal(barShare(3, 12), 0.25);
  assert.equal(barShare(0, 9), 0);
  assert.equal(barShare(0, 0), 0, "before anyone votes, every bar is empty");
});

test("on the first read every row shows no change", () => {
  const chart = nextChart(null, ["anna", "ben", "jw"]);
  assert.deepEqual(chart.marks, {
    anna: { kind: "same" },
    ben: { kind: "same" },
    jw: { kind: "same" },
  });
});

test("a row that climbs two places shows up 2, and the rows it passed show down 1", () => {
  const first = nextChart(null, ["anna", "ben", "jw", "tyson"]);
  const chart = nextChart(first, ["jw", "anna", "ben", "tyson"]);
  assert.deepEqual(chart.marks, {
    jw: { kind: "up", by: 2 },
    anna: { kind: "down", by: 1 },
    ben: { kind: "down", by: 1 },
    tyson: { kind: "same" },
  });
});

test("a Contestant added since the last read shows new", () => {
  const first = nextChart(null, ["anna", "ben"]);
  const chart = nextChart(first, ["anna", "ben", "federico"]);
  assert.deepEqual(chart.marks.federico, { kind: "new" });
  assert.deepEqual(chart.marks.ben, { kind: "same" });
});

test("a re-read with the same order keeps the marks from the last change", () => {
  const first = nextChart(null, ["anna", "ben", "jw"]);
  const moved = nextChart(first, ["jw", "anna", "ben"]);
  const held = nextChart(moved, ["jw", "anna", "ben"]);
  assert.deepEqual(held.marks, {
    jw: { kind: "up", by: 2 },
    anna: { kind: "down", by: 1 },
    ben: { kind: "down", by: 1 },
  });
});

test("rows below a removed Contestant move up into its place", () => {
  const first = nextChart(null, ["anna", "ben", "jw"]);
  const chart = nextChart(first, ["anna", "jw"]);
  assert.deepEqual(chart.marks, {
    anna: { kind: "same" },
    jw: { kind: "up", by: 1 },
  });
});
