/**
 * Fails when an e2e file writes a calendar date by hand. A hard-coded
 * "future" date becomes a past one the day the calendar reaches it, and every
 * spec leaning on it breaks at once with nothing in the diff to blame. Specs
 * get their dates from `e2e/support/dates.ts`, counted from today.
 *
 * Two kinds of literal stay allowed, because they never change meaning:
 * years up to 2020 (deliberately past, e.g. "a date in the past is refused")
 * and from 2090 (a deliberate far-future sentinel). Anything between is a
 * date that will one day flip from future to past.
 *
 * Runs first in `npm test` and in CI (.github/workflows/e2e-dates.yml).
 * Usage: node scripts/check-e2e-dates.mts
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const E2E = join(ROOT, "e2e");
/** The one file whose doc comments show example dates. */
const ALLOWED_FILES = new Set(["e2e/support/dates.ts"]);

const YEAR = "(202[1-9]|20[3-8]\\d)";
const MONTH_NAME =
  "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*";
const PATTERNS = [
  // 2027-03-15, and a template's 2026-10-${day}
  new RegExp(`\\b${YEAR}-\\d{2}-`, "g"),
  // 3-15-2027, a CourtReserve email body
  new RegExp(`\\b\\d{1,2}-\\d{1,2}-${YEAR}\\b`, "g"),
  // Mar 3, 2031 / March 17, 2027 / September 16th, 2026
  new RegExp(`\\b${MONTH_NAME}\\.? \\d{1,2}(?:st|nd|rd|th)?, ${YEAR}\\b`, "g"),
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const offences: string[] = [];
for (const file of walk(E2E).filter((path) => /\.(m?ts|js)$/.test(path))) {
  const name = relative(ROOT, file).replaceAll("\\", "/");
  if (ALLOWED_FILES.has(name)) {
    continue;
  }
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      for (const pattern of PATTERNS) {
        for (const match of line.matchAll(pattern)) {
          offences.push(`${name}:${index + 1}  ${match[0]}`);
        }
      }
    });
}

if (offences.length > 0) {
  console.error(
    `Hard-coded dates in e2e/ (${offences.length}). They go stale the day the calendar passes them.\n` +
      `Use torontoDate(days) and the label helpers in e2e/support/dates.ts instead:\n\n` +
      offences.map((offence) => `  ${offence}`).join("\n"),
  );
  process.exit(1);
}
console.log("e2e dates: no hard-coded dates.");
