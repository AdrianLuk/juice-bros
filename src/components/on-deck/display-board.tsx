"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { QueryProvider } from "@/components/on-deck/query-provider";
import { useRotationSync } from "@/components/on-deck/use-rotation-sync";
import { getRotationView } from "@/lib/on-deck/actions/rotation";
import type { RotationView } from "@/lib/on-deck/actions/rotation";
import { QUEUE_TOGETHER_EXPLAINER } from "@/lib/on-deck/session/types";
import type { ClubJoinQr } from "@/lib/on-deck/qr";
import {
  BoardBanner,
  BoardHeading,
  CourtPanel,
  FoursomePanel,
  QueueList,
  Readout,
  SkillColors,
  SkillKey,
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
 * `getRotationView` — display names and Skill Levels only (every name is inked
 * by its level, with the legend under the queue), no contact data, no buttons.
 */
export function DisplayBoard(props: {
  sessionId: string;
  initialView: RotationView;
  joinQr: ClubJoinQr;
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
  joinQr,
}: {
  sessionId: string;
  initialView: RotationView;
  joinQr: ClubJoinQr;
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
    <SkillColors by={view.skillByName}>
    <div className="space-y-7" data-testid="display-board">
      {view.lastCall && (
        <BoardBanner tone="last-call" data-testid="display-last-call">
          Last call. Final games only, no new foursomes tonight.
        </BoardBanner>
      )}

      {/*
        The printed sign, miniaturised onto the tablet already sitting on the
        snack table — the one surface at the venue a newcomer can reach without
        finding a person first. Leads the board on purpose: everything below it
        is unreadable to someone not yet in the queue. Gone at Last Call, when
        scanning in would only buy a place in a queue going nowhere.
      */}
      {!view.lastCall && (
        <div
          className="od-panel flex items-center gap-4 p-4 sm:w-fit"
          data-testid="display-join-qr"
        >
          {/* A QR is unreadable to a screen reader, so the code carries the
              address it encodes as its accessible name — the only way that
              reader gets into the queue. */}
          <div
            role="img"
            aria-label={`Scan to join at ${joinQr.url}`}
            className="w-24 shrink-0 rounded-lg bg-white p-1.5 sm:w-32 [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: joinQr.svg }}
          />
          <div className="min-w-0">
            <Readout className="text-arena-dim">Scan to join</Readout>
            <p className="mt-1.5 text-sm text-arena-faint">
              New here? Point your camera at this. No app, no sign-up.
            </p>
          </div>
        </div>
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

      <SkillKey className="border-t border-arena-line-soft pt-4" />
    </div>
    </SkillColors>
  );
}
