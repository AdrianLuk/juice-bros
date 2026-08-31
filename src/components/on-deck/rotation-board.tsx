"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { QueryProvider } from "@/components/on-deck/query-provider";
import { finishCourt } from "@/lib/on-deck/actions/floor";
import {
  getRotationView,
  type RotationView,
} from "@/lib/on-deck/actions/rotation";

const POLL_MS = 4_000;

/**
 * The Organizer's floor screen (issue #243): every Court and who is on it, the
 * Queue in order, and a "Court N done" tap per occupied Court. Polls
 * `getRotationView` every few seconds so it stays current as Players join and
 * queue from their own phones.
 */
export function RotationBoard({
  sessionId,
  initialView,
}: {
  sessionId: string;
  initialView: RotationView;
}) {
  return (
    <QueryProvider>
      <RotationBoardInner sessionId={sessionId} initialView={initialView} />
    </QueryProvider>
  );
}

function RotationBoardInner({
  sessionId,
  initialView,
}: {
  sessionId: string;
  initialView: RotationView;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["on-deck", "rotation", sessionId, "floor"] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => getRotationView(sessionId),
    refetchInterval: POLL_MS,
    initialData: initialView,
  });
  const [error, setError] = useState<string | null>(null);

  const finish = useMutation({
    mutationFn: ({ number, since }: { number: number; since: number | null }) =>
      finishCourt(sessionId, number, since),
    onSuccess: (result) => {
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => setError("Couldn't end that game. Try again."),
  });

  const view = query.data ?? initialView;

  return (
    <div className="space-y-8">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {view.courts.map((court) => {
          const occupied = court.players.length > 0;
          return (
            <div
              key={court.number}
              className="rounded-2xl border bg-card p-4"
              data-testid={`court-${court.number}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-lg font-semibold">
                  Court {court.number}
                </h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={finish.isPending || (!occupied && view.queuedCount < 4)}
                  onClick={() =>
                    finish.mutate({ number: court.number, since: court.since })
                  }
                >
                  {occupied ? `Court ${court.number} done` : "Send next four"}
                </Button>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {occupied ? (
                  court.players.map((name, i) => <li key={i}>{name}</li>)
                ) : (
                  <li className="text-muted-foreground">Waiting for a foursome</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="font-heading text-xl font-semibold">
          Queue{" "}
          <span className="text-muted-foreground">({view.queuedCount})</span>
        </h2>
        {view.queue.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nobody waiting right now.
          </p>
        ) : (
          <ol className="mt-3 space-y-1 text-sm" data-testid="queue-list">
            {view.queue.map((name, i) => (
              <li key={i}>
                <span className="text-muted-foreground">{i + 1}.</span> {name}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
