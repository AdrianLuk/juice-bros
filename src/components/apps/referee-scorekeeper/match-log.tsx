"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import {
  buildMatchLog,
  type LogEntryTone,
} from "@/components/apps/referee-scorekeeper/lib/scoring/match-log";
import { elapsedLabel } from "@/components/apps/referee-scorekeeper/lib/scoring/selectors";
import type { MatchConfig, MatchEvent } from "@/components/apps/referee-scorekeeper/lib/scoring/types";

const TONE_DOT: Record<LogEntryTone, string> = {
  setup: "bg-neutral-300",
  point: "bg-neutral-400",
  timeout: "bg-brand-orange",
  technical: "bg-destructive",
  game: "bg-neutral-950",
};

/**
 * The audit list. This is what makes the app defensible in a dispute — a team
 * claiming they still have a timeout can be shown exactly when they used it and
 * at what score, and the rallies around it corroborate the score. Tournament
 * directors ask, so it also rides along on the match summary.
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
   * because inside a Sheet the panel body is already the scroll container —
   * a second one nested inside it would fight the first. Turn it on where the
   * log sits directly on a page (the match summary) and would otherwise run
   * the page on past a few hundred rows.
   */
  capHeight?: boolean;
}) {
  const entries = useMemo(() => buildMatchLog(config, events), [config, events]);

  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-6 text-center text-sm text-neutral-500">
        Nothing logged yet.
      </p>
    );
  }

  return (
    <ul
      className={cn(
        "divide-y divide-neutral-200 rounded-lg border border-neutral-200",
        capHeight && "max-h-[60vh] overflow-y-auto overscroll-contain"
      )}
    >
      {entries.map((entry) => (
        <li
          key={entry.key}
          className="grid grid-cols-[0.5rem_2.2rem_3rem_1fr_auto] items-baseline gap-2 px-3 py-2 font-mono text-xs text-neutral-700"
        >
          <span
            className={cn(
              "size-2 translate-y-px rounded-full",
              TONE_DOT[entry.tone]
            )}
            aria-hidden
          />
          <span className="font-semibold text-neutral-500">G{entry.gameNumber}</span>
          <span className="text-neutral-500 tabular-nums">
            {elapsedLabel(entry.at, matchStartedAt)}
          </span>
          <span className="truncate font-sans font-medium text-neutral-950">
            {entry.label}
          </span>
          <span className="text-right tabular-nums">{entry.scoreCall}</span>
          {entry.detail && (
            <span className="col-span-4 col-start-2 -mt-1 text-[0.65rem] text-neutral-400">
              {entry.detail}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
