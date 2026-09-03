"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { QueryProvider } from "@/components/on-deck/query-provider";
import { useRotationSync } from "@/components/on-deck/use-rotation-sync";
import { getRotationView } from "@/lib/on-deck/actions/rotation";
import type { RotationView } from "@/lib/on-deck/actions/rotation";
import { QUEUE_TOGETHER_EXPLAINER } from "@/lib/on-deck/session/types";
import {
  BoardBanner,
  BoardHeading,
  CourtPanel,
  FoursomePanel,
  QueueList,
} from "@/components/on-deck/board-parts";

function displayQueryKey(sessionId: string) {
  return ["on-deck", "rotation", sessionId, "display"] as const;
}

/**
 * The read-only Display (issue #253) on the substitution board (direction seed
 * 92ec9d54): the snack-table tablet. The two ON DECK foursomes lead — "UP
 * NEXT" carries the filled orange progress-to-court ladder — then the courts as
 * a grid of panels (an open court reads OPEN in orange until its foursome flips
 * on), then the numbered queue behind its rail. No token is ever passed to
 * `getRotationView` — display names only, no Skill Level, no contact data, no
 * buttons.
 */
export function DisplayBoard(props: {
  sessionId: string;
  initialView: RotationView;
}) {
  return (
    <QueryProvider>
      <DisplayBoardInner {...props} />
    </QueryProvider>
  );
}

function DisplayBoardInner({
  sessionId,
  initialView,
}: {
  sessionId: string;
  initialView: RotationView;
}) {
  const queryKey = displayQueryKey(sessionId);
  const pollInterval = useRotationSync(sessionId, [queryKey]);
  const query = useQuery({
    queryKey,
    queryFn: () => getRotationView(sessionId, undefined),
    refetchInterval: pollInterval,
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const view = query.data ?? initialView;

  if (view.status !== "open") {
    return (
      <BoardBanner tone="closed" data-testid="display-closed">
        Tonight&apos;s session has wrapped up
      </BoardBanner>
    );
  }

  const hasOnDeck = !view.lastCall && view.onDeck.some((f) => f.length > 0);

  return (
    <div className="space-y-7" data-testid="display-board">
      {view.lastCall && (
        <BoardBanner tone="last-call" data-testid="display-last-call">
          Last call. Final games only, no new foursomes tonight.
        </BoardBanner>
      )}

      {/* ── On Deck — the lead ─────────────────────────────────────────── */}
      {!view.lastCall && (
        <section>
          <BoardHeading tone="next">On deck</BoardHeading>
          <div className="mt-3 grid items-start gap-4 sm:grid-cols-2">
            {([0, 1] as const).map((slot) => (
              <FoursomePanel
                key={slot}
                slot={slot}
                testIdPrefix="display-on-deck-"
                names={view.onDeck[slot] ?? []}
                isGroup={view.onDeckIsGroup[slot]}
                progress={
                  slot === 0 && hasOnDeck
                    ? (view.onDeck[0]?.length ?? 0) / 4
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Courts ────────────────────────────────────────────────────── */}
      <section>
        <BoardHeading count={view.courts.length}>
          {view.lastCall ? "Final games" : "On the courts"}
        </BoardHeading>
        <div className="mt-3 grid items-start gap-3 sm:grid-cols-2">
          {view.courts.map((court) => (
            <CourtPanel key={court.number} court={court} testIdPrefix="display-court-" />
          ))}
        </div>
      </section>

      {/* ── Queue ─────────────────────────────────────────────────────── */}
      <section>
        <BoardHeading count={view.queuedCount} tone="dim">
          {view.lastCall ? "Not playing tonight" : "In the queue"}
        </BoardHeading>
        {!view.lastCall && (
          <p className="mt-1.5 text-xs text-arena-faint">
            {QUEUE_TOGETHER_EXPLAINER}
          </p>
        )}
        <QueueList
          queue={view.queue}
          now={now}
          lastCall={view.lastCall}
          data-testid="display-queue"
        />
        {view.paused.length > 0 && (
          <p className="od-readout mt-3 text-arena-dim">
            {view.paused.length} stepped out for now
          </p>
        )}
      </section>
    </div>
  );
}
