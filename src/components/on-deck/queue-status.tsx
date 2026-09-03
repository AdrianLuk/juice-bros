"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QueryProvider } from "@/components/on-deck/query-provider";
import { useRotationSync } from "@/components/on-deck/use-rotation-sync";
import {
  formGroupAsPlayer,
  leaveGroup,
  leaveQueue,
  queueForSession,
  rejoinQueue,
} from "@/lib/on-deck/actions/players";
import { getRotationView } from "@/lib/on-deck/actions/rotation";
import {
  QUEUE_TOGETHER_EXPLAINER,
  type FloorMode,
} from "@/lib/on-deck/session/types";
import { TurnNotifications } from "@/components/on-deck/turn-notifications";

function rotationQueryKey(sessionId: string) {
  return ["on-deck", "rotation", sessionId, "me"] as const;
}

/**
 * A Player's own line on the running Session, on the substitution board
 * (direction seed 92ec9d54): one verdict at board scale — YOU'RE UP · COURT 5,
 * ON DECK, or #7 IN THE QUEUE — with the quieter step-out / group controls
 * below it. Polls `getRotationView` every few seconds (issue #243); no token
 * ever leaves the server, only the caller's own standing comes back.
 */
export function QueueStatus(props: {
  sessionId: string;
  token: string;
  floorMode: FloorMode;
}) {
  return (
    <QueryProvider>
      <QueueStatusInner {...props} />
    </QueryProvider>
  );
}

/**
 * The player's whole screen is one verdict at board scale — the single line
 * that answers "where do I stand": YOU'RE UP · COURT 5, #4 OF 6 IN THE QUEUE,
 * ON DECK. No kicker over it (the contract calls for one line, and an eyebrow
 * above a heading is a craft-floor ban); `sub` is the small guidance line
 * under it, not a label over it.
 */
function Verdict({
  tone,
  headline,
  sub,
}: {
  tone: "live" | "next" | "wait" | "quiet";
  headline: React.ReactNode;
  sub?: React.ReactNode;
}) {
  const shell =
    tone === "live"
      ? "od-panel od-live od-call-land"
      : tone === "next"
        ? "od-panel od-next"
        : "od-panel";
  return (
    <div className={`${shell} px-5 py-7`}>
      <p
        className={`od-display-tight ${
          tone === "quiet" ? "text-4xl" : "text-5xl sm:text-6xl"
        }`}
      >
        {headline}
      </p>
      {sub && (
        <p
          className={`mt-3 text-sm ${
            tone === "live" ? "text-arena-live-ink/85" : "text-arena-dim"
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function QueueStatusInner({
  sessionId,
  token,
  floorMode,
}: {
  sessionId: string;
  token: string;
  floorMode: FloorMode;
}) {
  const queryClient = useQueryClient();
  const queryKey = rotationQueryKey(sessionId);
  const pollInterval = useRotationSync(sessionId, [queryKey]);
  const query = useQuery({
    queryKey,
    queryFn: () => getRotationView(sessionId, token),
    refetchInterval: pollInterval,
  });
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

  const [picked, setPicked] = useState<string[]>([]);
  const [confirmLeaveGroup, setConfirmLeaveGroup] = useState(false);
  const formGroup = useMutation({
    mutationFn: (names: string[]) => formGroupAsPlayer(sessionId, token, names),
    onSuccess: (result) => {
      settle(result);
      if (result.ok) setPicked([]);
    },
    onError: () => setError("Couldn't group you up. Try again."),
  });

  const leaveGrp = useMutation({
    mutationFn: () => leaveGroup(sessionId, token),
    onSuccess: settle,
    onError: () => setError("Couldn't update that. Try again."),
  });

  const me = query.data?.me ?? null;

  const turnNotify =
    floorMode === "self-serve" || floorMode === "hybrid" ? (
      <TurnNotifications sessionId={sessionId} token={token} />
    ) : null;

  if (query.data && query.data.status !== "open") {
    return null;
  }

  const errLine = error && (
    <p className="od-readout mt-2 text-[0.72rem] text-arena-warn" role="alert">
      {error}
    </p>
  );

  // After Last Call, a Player still on a Court finishes their Game; everyone
  // else is done for the night (issue #255).
  if (query.data?.lastCall && !me?.court) {
    return (
      <div className="mt-6" data-testid="queue-last-call">
        <Verdict
          tone="quiet"
          headline="That's the last call"
          sub="No more games tonight. Thanks for playing."
        />
      </div>
    );
  }

  if (me?.court) {
    return (
      <div className="mt-6">
        <Verdict
          tone="live"
          headline={
            <>
              You&apos;re up, Court {me.court}
            </>
          }
          sub="Head over now."
        />
      </div>
    );
  }

  if (me?.paused) {
    return (
      <div className="mt-6" data-testid="queue-paused">
        <Verdict
          tone="quiet"
          headline="You've stepped out"
          sub="You won't be called until you're back. Your wait so far is saved."
        />
        <button
          type="button"
          className="od-key od-key--go mt-3 w-full"
          disabled={rejoin.isPending}
          onClick={() => rejoin.mutate()}
        >
          {rejoin.isPending ? "Adding you back…" : "Rejoin the queue"}
        </button>
        {errLine}
        {turnNotify}
      </div>
    );
  }

  const toggle = (name: string) =>
    setPicked((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );

  const groupControls = (
    <>
      {me?.group && (
        <div className="mt-4" data-testid="queue-group-note">
          <p className="text-sm text-arena-faint">
            You&apos;re queued with your group — you&apos;ll go on together.
          </p>
          {confirmLeaveGroup ? (
            <p className="mt-1 text-sm text-arena-faint">
              Leave the group? You&apos;d keep your spot but queue on your own,
              and rejoining means re-forming it.{" "}
              <button
                type="button"
                className="od-readout text-[0.7rem] text-arena-warn underline-offset-4 hover:underline"
                disabled={leaveGrp.isPending}
                onClick={() => leaveGrp.mutate()}
              >
                {leaveGrp.isPending ? "Leaving…" : "Leave"}
              </button>{" "}
              <button
                type="button"
                className="od-readout text-[0.7rem] text-arena-dim underline-offset-4 hover:underline"
                onClick={() => setConfirmLeaveGroup(false)}
              >
                Stay
              </button>
            </p>
          ) : (
            <button
              type="button"
              className="od-readout mt-1 block text-[0.7rem] text-arena-faint underline-offset-4 hover:text-arena-dim hover:underline"
              onClick={() => setConfirmLeaveGroup(true)}
            >
              Leave the group
            </button>
          )}
        </div>
      )}
      {me?.canFormGroup && me.groupmateOptions.length > 0 && (
        <details className="mt-4" data-testid="queue-together-player">
          <summary className="od-readout cursor-pointer text-[0.7rem] text-arena-dim underline-offset-4 hover:underline">
            Playing with friends? Queue together
          </summary>
          <p className="mt-2 text-xs text-arena-faint">
            {QUEUE_TOGETHER_EXPLAINER}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {me.groupmateOptions.map((name) => {
              const on = picked.includes(name);
              return (
                <li key={name}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={formGroup.isPending}
                    className={`od-chip ${on ? "od-chip--on" : ""}`}
                    onClick={() => toggle(name)}
                  >
                    {name}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="od-key od-key--ghost mt-3"
            disabled={
              formGroup.isPending ||
              picked.filter((n) => me.groupmateOptions.includes(n)).length < 1
            }
            onClick={() =>
              formGroup.mutate(
                picked.filter((n) => me.groupmateOptions.includes(n)),
              )
            }
          >
            {formGroup.isPending ? "Grouping up…" : "Queue together"}
          </button>
        </details>
      )}
    </>
  );

  const stepOut = (
    <>
      {groupControls}
      <button
        type="button"
        className="od-readout mt-4 block text-[0.7rem] text-arena-faint underline-offset-4 hover:text-arena-dim hover:underline"
        disabled={leave.isPending}
        onClick={() => leave.mutate()}
      >
        {leave.isPending ? "Stepping you out…" : "Leave the queue"}
      </button>
      {errLine}
      {turnNotify}
    </>
  );

  if (me?.onDeck != null) {
    return (
      <div className="mt-6">
        <Verdict
          tone="next"
          headline={
            me.onDeck === 0 ? "You're up next" : "You're on deck"
          }
          sub={
            me.onDeck === 0
              ? "Head to the courts. You're in the next four."
              : "You go on right after the next foursome."
          }
        />
        {stepOut}
      </div>
    );
  }

  if (me?.position) {
    return (
      <div className="mt-6" data-testid="queue-position">
        <Verdict
          tone="wait"
          headline={
            <>
              #{me.position}
              {query.data ? (
                <span className="ml-2.5 align-baseline text-2xl text-arena-dim">
                  of {query.data.queuedCount}
                </span>
              ) : null}
              <span className="mt-1 block text-3xl text-arena-dim sm:text-4xl">
                in the queue
              </span>
            </>
          }
          sub="Hang around. You don't need to touch anything."
        />
        {stepOut}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <Verdict
        tone="wait"
        headline="Not in line yet"
        sub="Join the queue and we'll call you when a court opens."
      />
      <button
        type="button"
        className="od-key od-key--go mt-3 w-full"
        disabled={join.isPending}
        onClick={() => join.mutate()}
      >
        {join.isPending ? "Joining…" : "Join the queue"}
      </button>
      {errLine}
      {turnNotify}
    </div>
  );
}
