"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import {
  buildMatchLog,
  type LogEntryTone,
} from "@/components/apps/pickle-point-pal/lib/scoring/match-log";
import { elapsedLabel } from "@/components/apps/pickle-point-pal/lib/scoring/selectors";
import type { MatchConfig, MatchEvent } from "@/components/apps/pickle-point-pal/lib/scoring/types";

const TONE_MARK: Record<LogEntryTone, string> = {
  setup: "bg-pp-hairline",
  point: "bg-pp-ink-dim",
  timeout: "bg-pp-signal",
  technical: "bg-pp-alert",
  game: "bg-pp-ink",
};

/**
 * The audit list — the referee's scoresheet. This is what makes the app
 * defensible in a dispute: a team claiming they still have a timeout can be
 * shown exactly when they used it and at what score, and the rallies around it
 * corroborate. Tournament directors ask, so it also rides on the match summary.
 */
export function MatchLog({
  config,
  events,
  matchStartedAt,
  capHeight,
}: {
  config: MatchConfig;
  events: MatchEvent[];
  matchStartedAt: number;
  /**
   * Cap the list's own height and let it scroll internally. Off by default
   * because inside a Sheet the panel body is already the scroll container.
   * Turn it on where the log sits directly on a page (the match summary).
   */
  capHeight?: boolean;
}) {
  const entries = useMemo(() => buildMatchLog(config, events), [config, events]);

  if (entries.length === 0) {
    return (
      <p className="pp-well px-3 py-6 text-center text-sm text-pp-ink-dim">
        Nothing logged yet.
      </p>
    );
  }

  return (
    <ul
      className={cn(
        "pp-well divide-y divide-pp-hairline overflow-hidden",
        capHeight && "max-h-[60vh] overflow-y-auto overscroll-contain"
      )}
    >
      {entries.map((entry) => (
        <li
          key={entry.key}
          className="grid grid-cols-[0.5rem_2.2rem_3rem_1fr_auto] items-baseline gap-2 px-3 py-2 pp-data text-xs text-pp-ink-dim"
        >
          <span
            className={cn("size-2 translate-y-px rounded-full", TONE_MARK[entry.tone])}
            aria-hidden
          />
          <span className="font-semibold text-pp-ink-dim">G{entry.gameNumber}</span>
          <span className="tabular-nums text-pp-ink-dim">
            {elapsedLabel(entry.at, matchStartedAt)}
          </span>
          <span className="truncate font-sans font-medium text-pp-ink">
            {entry.label}
          </span>
          <span className="text-right tabular-nums text-pp-ink">{entry.scoreCall}</span>
          {entry.detail && (
            <span className="col-span-4 col-start-2 -mt-1 text-[0.65rem] text-pp-ink-dim">
              {entry.detail}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
