"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { QueryProvider } from "@/components/on-deck/query-provider";
import {
  bringPlayerBack,
  finishCourt,
  setPlayerAside,
  swapNoShow,
  undoLastAction,
} from "@/lib/on-deck/actions/floor";
import {
  volunteerBringPlayerBack,
  volunteerFinishCourt,
  volunteerSetPlayerAside,
  volunteerSwapNoShow,
  volunteerUndoLastAction,
} from "@/lib/on-deck/actions/volunteer";
import {
  getRotationView,
  type RotationView,
} from "@/lib/on-deck/actions/rotation";
import type { PauseReason } from "@/lib/on-deck/session/types";

/**
 * How the person driving the board is authorized (issue #248). The Organizer
 * holds an account; a Volunteer holds only the link's token, which every action
 * carries back so `on_deck_volunteer_append` can re-check it. The two paths run
 * the identical `floor-ops` decision — ADR 0005.
 */
export type FloorAuth =
  | { kind: "organizer" }
  | { kind: "volunteer"; token: string };

const ORGANIZER_AUTH: FloorAuth = { kind: "organizer" };

const POLL_MS = 4_000;

const PAUSE_REASON_LABEL: Record<PauseReason, string> = {
  left: "left the queue",
  "no-show": "no-show",
  "set-aside": "set aside",
};

/**
 * The Organizer's floor screen (issue #243): every Court and who is on it, the
 * Queue in order, and a "Court N done" tap per occupied Court. Polls
 * `getRotationView` every few seconds so it stays current as Players join and
 * queue from their own phones.
 *
 * Paused (issue #246) lands here too: a no-show swap per in-play Court, a "set
 * aside" tap per waiting Player, and a "back in the queue" tap per paused one.
 */
export function RotationBoard({
  sessionId,
  initialView,
  auth = ORGANIZER_AUTH,
}: {
  sessionId: string;
  initialView: RotationView;
  auth?: FloorAuth;
}) {
  return (
    <QueryProvider>
      <RotationBoardInner
        sessionId={sessionId}
        initialView={initialView}
        auth={auth}
      />
    </QueryProvider>
  );
}

/**
 * The four floor actions, bound to whoever is driving the board: the
 * Organizer's account-backed Server Actions, or the Volunteer's token-carrying
 * ones. `auth.kind` is checked inline so TypeScript narrows `auth.token`.
 */
function boundFloorActions(sessionId: string, auth: FloorAuth) {
  return {
    finishCourt: (court: number, since: number | null) =>
      auth.kind === "volunteer"
        ? volunteerFinishCourt(sessionId, auth.token, court, since)
        : finishCourt(sessionId, court, since),
    swapNoShow: (
      court: number,
      since: number | null,
      outName: string,
      inName: string,
    ) =>
      auth.kind === "volunteer"
        ? volunteerSwapNoShow(sessionId, auth.token, court, since, outName, inName)
        : swapNoShow(sessionId, court, since, outName, inName),
    setPlayerAside: (name: string) =>
      auth.kind === "volunteer"
        ? volunteerSetPlayerAside(sessionId, auth.token, name)
        : setPlayerAside(sessionId, name),
    bringPlayerBack: (name: string) =>
      auth.kind === "volunteer"
        ? volunteerBringPlayerBack(sessionId, auth.token, name)
        : bringPlayerBack(sessionId, name),
    undo: (expectedSeq: number) =>
      auth.kind === "volunteer"
        ? volunteerUndoLastAction(sessionId, auth.token, expectedSeq)
        : undoLastAction(sessionId, expectedSeq),
  };
}

const ON_DECK_LABELS = ["Up next", "After that"];

function OnDeck({ foursomes }: { foursomes: string[][] }) {
  return (
    <div>
      <h2 className="font-heading text-xl font-semibold">On deck</h2>
      {foursomes.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Not enough players waiting to line up a foursome yet.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {foursomes.map((players, i) => (
            <div
              key={i}
              className="rounded-2xl border bg-card p-4"
              data-testid={`on-deck-${i}`}
            >
              <p className="font-heading text-sm font-semibold tracking-[0.15em] text-brand-orange uppercase">
                {ON_DECK_LABELS[i]}
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {players.map((name, j) => (
                  <li key={j}>{name}</li>
                ))}
                {Array.from({ length: 4 - players.length }, (_, k) => (
                  <li key={`open-${k}`} className="text-muted-foreground">
                    Open spot
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * "Someone didn't show?" for one in-play Court. Collapsed to a link until the
 * Organizer needs it; open, it pre-fills the Match Me suggestion but lets them
 * pick any waiting Player instead.
 */
function NoShowSwap({
  court,
  players,
  since,
  suggested,
  waiting,
  onSwap,
  pending,
}: {
  court: number;
  players: string[];
  since: number | null;
  suggested: string | null;
  waiting: string[];
  onSwap: (args: {
    court: number;
    since: number | null;
    outName: string;
    inName: string;
  }) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Track only the Organizer's explicit picks; everything else follows the
  // live polled props, so a 4s refresh never strands the selects on a stale
  // name or an empty value.
  const [outPick, setOutPick] = useState<string | null>(null);
  const [inPick, setInPick] = useState<string | null>(null);
  const outName =
    outPick && players.includes(outPick) ? outPick : (players[0] ?? "");
  const inName =
    inPick && waiting.includes(inPick)
      ? inPick
      : (suggested && waiting.includes(suggested) ? suggested : waiting[0] ?? "");

  if (waiting.length === 0) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        No one waiting to swap in.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => setOpen(true)}
      >
        Someone didn&apos;t show?
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-dashed p-3">
      <label className="block text-xs font-medium">
        Who&apos;s missing
        <select
          className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={outName}
          onChange={(e) => setOutPick(e.target.value)}
        >
          {players.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium">
        Swap in{suggested ? " (suggested)" : ""}
        <select
          className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={inName}
          onChange={(e) => setInPick(e.target.value)}
        >
          {waiting.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending || !outName || !inName}
          onClick={() => onSwap({ court, since, outName, inName })}
        >
          Swap in
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function RotationBoardInner({
  sessionId,
  initialView,
  auth,
}: {
  sessionId: string;
  initialView: RotationView;
  auth: FloorAuth;
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
  const ops = boundFloorActions(sessionId, auth);

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const handle = (result: { ok?: boolean; error?: string }) => {
    if (!result.ok) {
      setError(result.error ?? "Something went wrong. Try again.");
      return;
    }
    setError(null);
    refresh();
  };

  const finish = useMutation({
    mutationFn: ({ number, since }: { number: number; since: number | null }) =>
      ops.finishCourt(number, since),
    onSuccess: handle,
    onError: () => setError("Couldn't end that game. Try again."),
  });

  const swap = useMutation({
    mutationFn: ({
      court,
      since,
      outName,
      inName,
    }: {
      court: number;
      since: number | null;
      outName: string;
      inName: string;
    }) => ops.swapNoShow(court, since, outName, inName),
    onSuccess: handle,
    onError: () => setError("Couldn't make that swap. Try again."),
  });

  const aside = useMutation({
    mutationFn: (name: string) => ops.setPlayerAside(name),
    onSuccess: handle,
    onError: () => setError("Couldn't set that player aside. Try again."),
  });

  const back = useMutation({
    mutationFn: (name: string) => ops.bringPlayerBack(name),
    onSuccess: handle,
    onError: () => setError("Couldn't add that player back. Try again."),
  });

  const undo = useMutation({
    mutationFn: (expectedSeq: number) => ops.undo(expectedSeq),
    onSuccess: handle,
    onError: () => setError("Couldn't undo that. Try again."),
  });

  const view = query.data ?? initialView;
  const undoTarget = view.undo;
  const busy =
    finish.isPending ||
    swap.isPending ||
    aside.isPending ||
    back.isPending ||
    undo.isPending;

  return (
    <div className="space-y-8">
      {error && (
        <p
          className="text-sm text-destructive"
          role="alert"
          data-testid="floor-error"
        >
          {error}
        </p>
      )}

      {undoTarget && (
        <div className="flex items-center justify-between rounded-xl border border-dashed px-3 py-2">
          <span className="text-sm text-muted-foreground">
            Tapped something by mistake?
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            data-testid="undo-button"
            onClick={() => undo.mutate(undoTarget.seq)}
          >
            Undo {undoTarget.label}
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {view.courts.map((court) => {
          const occupied = court.players.length > 0;
          const nextReady =
            view.onDeck[0]?.length === 4 || view.queuedCount >= 4;
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
                  disabled={busy || (!occupied && !nextReady)}
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
              {occupied && (
                <NoShowSwap
                  court={court.number}
                  players={court.players}
                  since={court.since}
                  suggested={court.suggestedReplacement}
                  waiting={view.queue}
                  onSwap={swap.mutate}
                  pending={swap.isPending}
                />
              )}
            </div>
          );
        })}
      </div>

      <OnDeck foursomes={view.onDeck} />

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
              <li
                key={i}
                className="flex items-center justify-between gap-2"
              >
                <span>
                  <span className="text-muted-foreground">{i + 1}.</span> {name}
                </span>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  disabled={busy}
                  onClick={() => aside.mutate(name)}
                >
                  Set aside
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {view.paused.length > 0 && (
        <div>
          <h2 className="font-heading text-xl font-semibold">Set aside</h2>
          <ul
            className="mt-3 space-y-1 text-sm"
            data-testid="paused-list"
          >
            {view.paused.map((p, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2"
              >
                <span>
                  {p.name}{" "}
                  <span className="text-muted-foreground">
                    ({PAUSE_REASON_LABEL[p.reason]})
                  </span>
                </span>
                <button
                  type="button"
                  className="text-xs text-brand-orange underline-offset-4 hover:underline"
                  disabled={busy}
                  onClick={() => back.mutate(p.name)}
                >
                  Back in the queue
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
