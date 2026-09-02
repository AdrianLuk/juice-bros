"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryProvider } from "@/components/on-deck/query-provider";
import { useRotationSync } from "@/components/on-deck/use-rotation-sync";
import {
  kioskAddWalkup,
  kioskConfirmCourt,
  kioskFinishCourt,
  kioskSwapNoShow,
  kioskUndoLastAction,
} from "@/lib/on-deck/actions/kiosk";
import {
  getRotationView,
  type RotationView,
} from "@/lib/on-deck/actions/rotation";
import {
  SKILL_LEVELS,
  SKILL_LEVEL_LABEL,
} from "@/lib/on-deck/session/types";
import { formatWaitLabel } from "@/lib/on-deck/session/wait";

/**
 * The courtside Kiosk (issue #259): the Display's live board — Courts, On Deck,
 * the Queue — plus the buttons a Game turnover needs, for a tablet stood by the
 * courts. Any Player standing there can tap:
 *
 *   - **Court N done** — ends the Game; the next Foursome walks on
 *   - **A player short** — flag a missing fourth; Match Me pulls a replacement
 *   - **Add me** — a walk-up with no phone enters name + last initial + skill
 *
 * plus an **idle-court nudge**: "Is Court N still going?" when a Court has sat
 * unconfirmed well past a normal Game length.
 *
 * No token — the Session id in the URL is the whole credential (ADR 0005). All
 * taps are `kiosk` Operator actions. Available only under `self-serve` /
 * `hybrid` Floor Mode; the page returns 404 otherwise.
 */
export function KioskBoard(props: {
  sessionId: string;
  initialView: RotationView;
}) {
  return (
    <QueryProvider>
      <KioskBoardInner {...props} />
    </QueryProvider>
  );
}

/** "A player short" for one in-play Court: pick who didn't show, confirm the
 * Match Me replacement (overridable). Collapsed until tapped. */
function PlayerShort({
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
  const [outPick, setOutPick] = useState<string | null>(null);
  const [inPick, setInPick] = useState<string | null>(null);
  const outName =
    outPick && players.includes(outPick) ? outPick : (players[0] ?? "");
  const inName =
    inPick && waiting.includes(inPick)
      ? inPick
      : suggested && waiting.includes(suggested)
        ? suggested
        : (waiting[0] ?? "");

  if (waiting.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        className="mt-3 text-sm text-muted-foreground underline-offset-4 hover:underline"
        data-testid={`player-short-${court}`}
        onClick={() => setOpen(true)}
      >
        A player short?
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-dashed p-3">
      <label className="block text-sm font-medium">
        Who&apos;s missing
        <select
          className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-base"
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
      <label className="block text-sm font-medium">
        Bring in{suggested ? " (suggested)" : ""}
        <select
          className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-base"
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
          disabled={pending || !outName || !inName}
          onClick={() => onSwap({ court, since, outName, inName })}
        >
          Bring them in
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** "Add me": a walk-up with no phone enters their details and joins the Queue. */
function AddMe({
  onAdd,
  pending,
}: {
  onAdd: (args: {
    first: string;
    initial: string;
    skill: string;
  }) => Promise<{ ok?: boolean } | undefined>;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState("");
  const [initial, setInitial] = useState("");
  const [skill, setSkill] = useState<string>("intermediate");
  const ready = first.trim() !== "" && initial.trim() !== "";

  if (!open) {
    return (
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="w-full"
        data-testid="add-me"
        onClick={() => setOpen(true)}
      >
        Add me to the queue
      </Button>
    );
  }

  return (
    <form
      className="rounded-2xl border bg-card p-4"
      data-testid="add-me-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || pending) return;
        onAdd({ first, initial, skill })
          .then((result) => {
            if (result && result.ok === false) return;
            setFirst("");
            setInitial("");
            setSkill("intermediate");
            setOpen(false);
          })
          .catch(() => {});
      }}
    >
      <h2 className="font-heading text-xl font-semibold">Add me</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        No phone? Enter your name and you&apos;ll queue like everyone else.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kiosk-first">First name</Label>
          <Input
            id="kiosk-first"
            autoComplete="off"
            autoCapitalize="words"
            className="w-44"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kiosk-initial">Last initial</Label>
          <Input
            id="kiosk-initial"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={4}
            className="w-16"
            value={initial}
            onChange={(e) => setInitial(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kiosk-skill">Skill level</Label>
          <select
            id="kiosk-skill"
            className="h-10 rounded-md border bg-background px-2 text-base"
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
          >
            {SKILL_LEVELS.map((level) => (
              <option key={level} value={level}>
                {SKILL_LEVEL_LABEL[level]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="lg" disabled={!ready || pending}>
          Add me
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

const ON_DECK_LABEL = ["Up next", "After that"] as const;

function KioskBoardInner({
  sessionId,
  initialView,
}: {
  sessionId: string;
  initialView: RotationView;
}) {
  const queryClient = useQueryClient();
  const queryKey = ["on-deck", "rotation", sessionId, "kiosk"] as const;
  const pollInterval = useRotationSync(sessionId, [queryKey]);
  const query = useQuery({
    queryKey,
    queryFn: () => getRotationView(sessionId),
    refetchInterval: pollInterval,
    initialData: initialView,
  });

  // Wait Times and the idle-court threshold both count up between polls — tick a
  // local clock so a quiet board still advances.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const [error, setError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const handle = (result: { ok?: boolean; error?: string }) => {
    setError(result.ok ? null : (result.error ?? "Something went wrong. Try again."));
    refresh();
  };

  const finish = useMutation({
    mutationFn: ({ court, since }: { court: number; since: number | null }) =>
      kioskFinishCourt(sessionId, court, since),
    onSuccess: handle,
    onError: () => setError("Couldn't end that game. Try again."),
  });
  const swap = useMutation({
    mutationFn: (args: {
      court: number;
      since: number | null;
      outName: string;
      inName: string;
    }) => kioskSwapNoShow(sessionId, args.court, args.since, args.outName, args.inName),
    onSuccess: handle,
    onError: () => setError("Couldn't bring someone in. Try again."),
  });
  const walkup = useMutation({
    mutationFn: (args: { first: string; initial: string; skill: string }) =>
      kioskAddWalkup(sessionId, args.first, args.initial, args.skill),
    onSuccess: handle,
    onError: () => setError("Couldn't add you. Try again."),
  });
  const confirm = useMutation({
    mutationFn: ({ court, since }: { court: number; since: number | null }) =>
      kioskConfirmCourt(sessionId, court, since),
    onSuccess: handle,
    onError: () => setError("Couldn't update that. Try again."),
  });
  const undo = useMutation({
    mutationFn: (expectedSeq: number) => kioskUndoLastAction(sessionId, expectedSeq),
    onSuccess: handle,
    onError: () => setError("Couldn't undo that. Try again."),
  });

  const view = query.data ?? initialView;
  const busy =
    finish.isPending ||
    swap.isPending ||
    walkup.isPending ||
    confirm.isPending ||
    undo.isPending;
  // A Kiosk can only take back a Kiosk tap — an Organizer's or Volunteer's
  // action on a hybrid Session is theirs to undo from their own surface (the
  // RPC enforces this too; not offering the button avoids a guaranteed error).
  const kioskUndo = view.undo && view.undo.by === "kiosk" ? view.undo : null;

  if (view.status !== "open") {
    return (
      <p className="text-lg text-muted-foreground" data-testid="kiosk-closed">
        Tonight&apos;s session has wrapped up.
      </p>
    );
  }

  return (
    <div className="space-y-8" data-testid="kiosk-board">
      {error && (
        <p className="text-sm text-destructive" role="alert" data-testid="kiosk-error">
          {error}
        </p>
      )}

      {kioskUndo && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed px-3 py-2">
          <span className="text-sm text-muted-foreground">
            Tapped something by mistake?
          </span>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            data-testid="kiosk-undo"
            onClick={() => undo.mutate(kioskUndo.seq)}
          >
            Undo {kioskUndo.label}
          </Button>
        </div>
      )}

      {view.lastCall && (
        <p
          className="rounded-2xl bg-brand-orange px-6 py-4 font-heading text-xl font-semibold text-white"
          data-testid="kiosk-last-call"
        >
          Last call — final games. No new foursomes tonight.
        </p>
      )}

      {/* Courts — the primary surface, big turnover buttons. */}
      <section>
        <h2 className="font-heading text-xl font-semibold">
          {view.lastCall ? "Final games" : "On the courts"}
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {view.courts.map((court) => {
            const occupied = court.players.length > 0;
            const nextReady = !view.lastCall && view.onDeck[0]?.length === 4;
            const idle = view.idleCourts.includes(court.number);
            return (
              <div
                key={court.number}
                className="rounded-2xl border bg-card p-4"
                data-testid={`kiosk-court-${court.number}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-heading text-lg font-semibold">
                    Court {court.number}
                  </h3>
                  <Button
                    type="button"
                    size="lg"
                    variant={occupied ? "default" : "outline"}
                    disabled={busy || (!occupied && !nextReady)}
                    onClick={() =>
                      finish.mutate({ court: court.number, since: court.since })
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

                {idle && (
                  <div
                    className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-brand-orange/10 px-3 py-2"
                    data-testid={`kiosk-idle-nudge-${court.number}`}
                  >
                    <span className="text-sm font-medium text-brand-orange">
                      Is Court {court.number} still going?
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      data-testid={`kiosk-still-going-${court.number}`}
                      onClick={() =>
                        confirm.mutate({ court: court.number, since: court.since })
                      }
                    >
                      Still going
                    </Button>
                  </div>
                )}

                {occupied && (
                  <PlayerShort
                    court={court.number}
                    players={court.players}
                    since={court.since}
                    suggested={court.suggestedReplacement}
                    waiting={view.waitingNames}
                    onSwap={swap.mutate}
                    pending={swap.isPending}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* On Deck — same prominent cards as the Display. */}
      {!view.lastCall && (
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
                  data-testid={`kiosk-on-deck-${slot}`}
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
      )}

      {!view.lastCall && (
        <AddMe onAdd={(args) => walkup.mutateAsync(args)} pending={walkup.isPending} />
      )}

      {/* Queue with Wait Times — read-only, same as the Display. */}
      <section>
        <h2 className="font-heading text-xl font-semibold">
          {view.lastCall ? "Not playing tonight" : "In the queue"}{" "}
          <span className="text-muted-foreground">({view.queuedCount})</span>
        </h2>
        {view.queue.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {view.lastCall ? "Everyone got a game in." : "Nobody waiting right now."}
          </p>
        ) : (
          <ol className="mt-3 space-y-1 text-sm" data-testid="kiosk-queue">
            {view.queue.map((entry, i) => (
              <li
                key={entry.kind === "group" ? entry.groupId : `${entry.name}-${i}`}
                className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-1"
              >
                <span>
                  <span className="text-muted-foreground tabular-nums">{i + 1}.</span>{" "}
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
      </section>
    </div>
  );
}
