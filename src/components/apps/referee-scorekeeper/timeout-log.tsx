"use client";

import {
  elapsedLabel,
  formatClock,
  recordScoreCall,
  teamName,
} from "@/components/apps/referee-scorekeeper/lib/scoring/selectors";
import type { MatchConfig, TimeoutRecord } from "@/components/apps/referee-scorekeeper/lib/scoring/types";

/**
 * The audit list. This is what makes the app defensible in a dispute — a team
 * claiming they still have a timeout can be shown exactly when they used it and
 * at what score. Tournament directors ask, so it also rides along on the match
 * summary.
 */
export function TimeoutLog({
  history,
  config,
  matchStartedAt,
}: {
  history: TimeoutRecord[];
  config: MatchConfig;
  matchStartedAt: number;
}) {
  if (history.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-6 text-center text-sm text-neutral-500">
        No timeouts called yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200">
      {history.map((record, i) => (
        <li
          key={`${record.startedAt}-${i}`}
          className="grid grid-cols-[2.2rem_3rem_1fr_auto] items-baseline gap-2 px-3 py-2 font-mono text-xs text-neutral-700"
        >
          <span className="font-semibold text-neutral-500">G{record.gameNumber}</span>
          <span className="text-neutral-500 tabular-nums">
            {elapsedLabel(record.startedAt, matchStartedAt)}
          </span>
          <span className="truncate font-sans font-medium text-neutral-950">
            {teamName(config, record.team)}
            <span className="ml-2 font-mono text-[0.7rem] text-neutral-500">
              {record.kind === "standard"
                ? `standard ${record.ordinal}/${config.timeoutsPerGame}`
                : record.kind}
            </span>
          </span>
          <span className="text-right tabular-nums">
            at {recordScoreCall(record, config)}
          </span>
          <span className="col-span-4 -mt-1 text-[0.65rem] text-neutral-400">
            {record.endedAt === null
              ? "in progress"
              : `${record.endReason === "expired" ? "expired" : "ended early"} after ${formatClock(record.endedAt - record.startedAt)}`}
            {record.pauseCount > 0 &&
              ` · paused ${record.pauseCount}× for ${formatClock(record.pausedMs)}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
