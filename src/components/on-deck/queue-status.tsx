"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { QueryProvider } from "@/components/on-deck/query-provider";
import {
  leaveQueue,
  queueForSession,
  rejoinQueue,
} from "@/lib/on-deck/actions/players";
import { getRotationView } from "@/lib/on-deck/actions/rotation";

const POLL_MS = 4_000;

function rotationQuery(sessionId: string, token: string) {
  return {
    queryKey: ["on-deck", "rotation", sessionId, "me"] as const,
    queryFn: () => getRotationView(sessionId, token),
    refetchInterval: POLL_MS,
  };
}

/**
 * A Player's own line on the running Session: a "join the queue" tap, then
 * their live position or the Court they're on. Polls `getRotationView` every
 * few seconds (issue #243) — no token ever leaves the server, only the
 * caller's own standing comes back.
 */
export function QueueStatus(props: { sessionId: string; token: string }) {
  return (
    <QueryProvider>
      <QueueStatusInner {...props} />
    </QueryProvider>
  );
}

function QueueStatusInner({
  sessionId,
  token,
}: {
  sessionId: string;
  token: string;
}) {
  const queryClient = useQueryClient();
  const { queryKey } = rotationQuery(sessionId, token);
  const query = useQuery(rotationQuery(sessionId, token));
  const [error, setError] = useState<string | null>(null);

  const settle = (result: { ok?: boolean; error?: string }) => {
    if (!result.ok) {
      setError(result.error ?? "Something went wrong. Try again.");
      return;
    }
    setError(null);
    queryClient.invalidateQueries({ queryKey });
  };

  const join = useMutation({
    mutationFn: () => queueForSession(sessionId, token),
    onSuccess: settle,
    onError: () => setError("Couldn't add you to the queue. Try again."),
  });

  const leave = useMutation({
    mutationFn: () => leaveQueue(sessionId, token),
    onSuccess: settle,
    onError: () => setError("Couldn't update that. Try again."),
  });

  const rejoin = useMutation({
    mutationFn: () => rejoinQueue(sessionId, token),
    onSuccess: settle,
    onError: () => setError("Couldn't add you back. Try again."),
  });

  const me = query.data?.me ?? null;

  if (query.data && query.data.status !== "open") {
    return null;
  }

  if (me?.paused) {
    return (
      <div className="mt-6" data-testid="queue-paused">
        <p className="text-sm text-muted-foreground">
          You&apos;ve stepped out — you won&apos;t be called until you&apos;re
          back. Your wait so far is saved.
        </p>
        <Button
          type="button"
          className="mt-3 h-12 w-full text-base"
          disabled={rejoin.isPending}
          onClick={() => rejoin.mutate()}
        >
          {rejoin.isPending ? "Adding you back…" : "Rejoin the queue"}
        </Button>
        {error && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (me?.court) {
    return (
      <p className="mt-6 rounded-xl bg-brand-orange px-4 py-3 font-heading text-lg font-semibold text-white">
        You&apos;re up, Court {me.court}
      </p>
    );
  }

  const stepOut = (
    <>
      <button
        type="button"
        className="mt-3 block text-sm text-muted-foreground underline-offset-4 hover:underline"
        disabled={leave.isPending}
        onClick={() => leave.mutate()}
      >
        {leave.isPending ? "Stepping you out…" : "Leave the queue"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </>
  );

  if (me?.onDeck != null) {
    return (
      <div className="mt-6">
        <p className="rounded-xl bg-brand-orange px-4 py-3 font-heading text-lg font-semibold text-white">
          {me.onDeck === 0
            ? "You're up next — head to the courts"
            : "You're on deck — the foursome after next"}
        </p>
        {stepOut}
      </div>
    );
  }

  if (me?.position) {
    return (
      <div className="mt-6" data-testid="queue-position">
        <p className="text-sm text-muted-foreground">
          You&apos;re{" "}
          <span className="font-heading text-2xl font-semibold text-foreground">
            #{me.position}
          </span>{" "}
          in the queue
          {query.data ? ` of ${query.data.queuedCount}` : ""}. Hang around, you
          don&apos;t need to touch anything.
        </p>
        {me.group && (
          <p className="mt-1 text-sm text-muted-foreground" data-testid="queue-group-note">
            You&apos;re queued with your group — you&apos;ll go on together.
          </p>
        )}
        {stepOut}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-muted-foreground">
        Ready to play? Join the queue and we&apos;ll call you when a court opens.
      </p>
      <Button
        type="button"
        className="mt-3 h-12 w-full text-base"
        disabled={join.isPending}
        onClick={() => join.mutate()}
      >
        {join.isPending ? "Joining…" : "Join the queue"}
      </Button>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
