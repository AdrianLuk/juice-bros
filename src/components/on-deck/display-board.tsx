"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { QueryProvider } from "@/components/on-deck/query-provider";
import { useRotationSync } from "@/components/on-deck/use-rotation-sync";
import { getRotationView } from "@/lib/on-deck/actions/rotation";
import type { RotationView } from "@/lib/on-deck/actions/rotation";
import { QUEUE_TOGETHER_EXPLAINER } from "@/lib/on-deck/session/types";
import { formatWaitLabel } from "@/lib/on-deck/session/wait";

function displayQueryKey(sessionId: string) {
  return ["on-deck", "rotation", sessionId, "display"] as const;
}

const ON_DECK_LABEL = ["Up next", "After that"] as const;

/**
 * The read-only Display (issue #253): a walk-up-and-read board for a tablet on
 * the snack table. Every Court and who is on it, the two On Deck Foursomes
 * (the visually prominent element), the full Queue in order with Wait Times,
 * and a one-line explainer of how Group order works.
 *
 * No token is ever passed to `getRotationView` — the Display shows only what
 * the venue's wall already shows: display names, no Skill Level, no contact
 * data. It carries no buttons. A Session runs identically with no Display
 * open; this only ever reads.
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
  // Realtime nudges a re-fetch within ~1s of any event (issue #252); the
  // interval it returns is the slow backstop while the socket is live and the
  // ~4s fallback while it's connecting or dropped.
  const pollInterval = useRotationSync(sessionId, [queryKey]);
  const query = useQuery({
    queryKey,
    queryFn: () => getRotationView(sessionId, undefined),
    refetchInterval: pollInterval,
  });

  // Wait Times count up between polls — tick a local clock every 30s so a
  // quiet board doesn't sit on stale minutes.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const view = query.data ?? initialView;

  if (view.status !== "open") {
    return (
      <p className="text-lg text-muted-foreground" data-testid="display-closed">
        Tonight&apos;s session has wrapped up.
      </p>
    );
  }

  return (
    <div className="space-y-10" data-testid="display-board">
      {view.lastCall && (
        <p
          className="rounded-2xl bg-brand-orange px-6 py-4 font-heading text-xl font-semibold text-white"
          data-testid="display-last-call"
        >
          Last call — final games. No new foursomes tonight.
        </p>
      )}

      {/* On Deck — the prominent element. */}
      <section>
        <h2 className="font-heading text-sm font-semibold tracking-[0.2em] text-brand-orange uppercase">
          On deck
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {[0, 1].map((slot) => {
            const foursome = view.onDeck[slot] ?? [];
            return (
              <div
                key={slot}
                className="rounded-3xl border-2 border-brand-orange bg-brand-orange/10 p-6"
                data-testid={`display-on-deck-${slot}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-heading text-xl font-semibold">
                    {ON_DECK_LABEL[slot]}
                  </p>
                  {view.onDeckIsGroup[slot] && (
                    <span className="rounded-full bg-brand-orange px-2 py-0.5 text-xs font-semibold text-white">
                      Group
                    </span>
                  )}
                </div>
                {foursome.length === 0 ? (
                  <p className="mt-3 text-muted-foreground">
                    Selected when the queue fills.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-1 font-heading text-2xl font-semibold">
                    {foursome.map((name, i) => (
                      <li key={i}>{name}</li>
                    ))}
                    {Array.from({ length: 4 - foursome.length }).map((_, i) => (
                      <li key={`open-${i}`} className="text-muted-foreground">
                        Open spot
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Courts. */}
      <section>
        <h2 className="font-heading text-xl font-semibold">On the courts</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {view.courts.map((court) => (
            <div
              key={court.number}
              className="rounded-2xl border bg-card p-4"
              data-testid={`display-court-${court.number}`}
            >
              <p className="font-heading text-lg font-semibold">
                Court {court.number}
              </p>
              {court.players.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Open</p>
              ) : (
                <ul className="mt-2 space-y-0.5 text-sm">
                  {court.players.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Queue with Wait Times. */}
      <section>
        <h2 className="font-heading text-xl font-semibold">
          In the queue{" "}
          <span className="text-muted-foreground">({view.queuedCount})</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {QUEUE_TOGETHER_EXPLAINER}
        </p>
        {view.queue.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nobody waiting right now.
          </p>
        ) : (
          <ol className="mt-3 space-y-1 text-sm" data-testid="display-queue">
            {view.queue.map((entry, i) => (
              <li
                key={entry.kind === "group" ? entry.groupId : `${entry.name}-${i}`}
                className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-1"
              >
                <span>
                  <span className="text-muted-foreground tabular-nums">
                    {i + 1}.
                  </span>{" "}
                  {entry.kind === "solo" ? (
                    entry.name
                  ) : (
                    <>
                      <span className="font-semibold">Group:</span>{" "}
                      {entry.names.join(", ")}
                    </>
                  )}
                </span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {formatWaitLabel(entry.waitSince, now)}
                </span>
              </li>
            ))}
          </ol>
        )}
        {view.paused.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {view.paused.length} stepped out for now.
          </p>
        )}
      </section>
    </div>
  );
}
