/**
 * Turning a projected Session Summary into the words and proportions a reader
 * needs (issue #469).
 *
 * Split out from `summary.ts` so the projection stays a pure fold over events
 * with no opinion about presentation, and so this is testable under
 * `node --test` — relative imports only, like the rest of `session/`.
 */

import type { SessionSummary, WaitBucket } from "./summary.ts";
import { SKILL_LEVEL_LABEL, SKILL_LEVELS } from "./types.ts";

/**
 * A wait bucket in the club's own words. The open-ended last bucket has to
 * read differently from the rest — "30 to null min" is the bug this exists to
 * make impossible.
 */
export function waitBucketLabel(bucket: WaitBucket): string {
  if (bucket.toMin === null) return `${bucket.fromMin} min or more`;
  if (bucket.fromMin === 0) return `Under ${bucket.toMin} min`;
  return `${bucket.fromMin} to ${bucket.toMin} min`;
}

/**
 * A bar's length as a percentage of the largest value in its own chart, so
 * every chart uses its full width rather than being scaled to some shared
 * maximum that makes the small ones unreadable.
 *
 * Zero-length bars stay zero — a category with no members should read as
 * empty, not as a sliver. An all-zero chart gives every row 0 rather than
 * dividing by nothing.
 */
export function barPercent(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.round((value / max) * 1000) / 10;
}

/** The largest count in a set of rows, for `barPercent`'s denominator. */
function maxCount(values: number[]): number {
  return values.reduce((max, v) => Math.max(max, v), 0);
}

export type SummaryRow = {
  label: string;
  count: number;
  /** 0-100, relative to the largest row in this set. */
  percent: number;
};

/** The wait-time distribution as bar rows, in bucket order. */
export function waitRows(summary: SessionSummary): SummaryRow[] {
  const counts = summary.waitTime.distribution.map((b) => b.count);
  const max = maxCount(counts);
  return summary.waitTime.distribution.map((bucket) => ({
    label: waitBucketLabel(bucket),
    count: bucket.count,
    percent: barPercent(bucket.count, max),
  }));
}

/** Games played per Court, in court order, as bar rows. */
export function courtRows(summary: SessionSummary): SummaryRow[] {
  const perCourt = summary.courtUtilization.perCourt;
  const max = maxCount(perCourt);
  return perCourt.map((count, i) => ({
    label: `Court ${i + 1}`,
    count,
    percent: barPercent(count, max),
  }));
}

/**
 * The room by Skill Level, always in the club's own fixed order rather than
 * sorted by size — the four are ordinal, and re-sorting them by count would
 * hide the shape of the room, which is the only thing this chart is for.
 */
export function skillRows(summary: SessionSummary): SummaryRow[] {
  const counts = SKILL_LEVELS.map((level) => summary.skillMix[level] ?? 0);
  const max = maxCount(counts);
  return SKILL_LEVELS.map((level, i) => ({
    label: SKILL_LEVEL_LABEL[level],
    count: counts[i],
    percent: barPercent(counts[i], max),
  }));
}

/**
 * How much to trust the average wait. A mean over three waits is not a
 * statistic, and a page that prints one without saying so is lying quietly —
 * so the reader is told which of these it is looking at.
 */
export function waitConfidenceNote(summary: SessionSummary): string {
  const n = summary.waitTime.sampleSize;
  if (n === 0) {
    return "Nobody was seated off the queue, so there is no wait to average.";
  }
  if (n < 10) {
    return `From ${n} wait${n === 1 ? "" : "s"}. Too few to read as a pattern.`;
  }
  return `From ${n} waits.`;
}

/**
 * "8 courts, 47 games, 5.9 games per court." Written out rather than left as
 * three tiles because the third number is only meaningful beside the other
 * two.
 */
export function utilizationSentence(summary: SessionSummary): string {
  const { courtCount, gamesPerCourt } = summary.courtUtilization;
  const per = Math.round(gamesPerCourt * 10) / 10;
  const courts = `${courtCount} court${courtCount === 1 ? "" : "s"}`;
  const games = `${summary.gamesPlayed} game${summary.gamesPlayed === 1 ? "" : "s"}`;
  return `${courts}, ${games}, ${per} per court.`;
}
