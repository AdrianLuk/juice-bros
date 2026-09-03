"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
import { SKILL_LEVELS, SKILL_LEVEL_LABEL } from "@/lib/on-deck/session/types";
import {
  BoardBanner,
  BoardHeading,
  CourtPanel,
  FoursomePanel,
  QueueList,
  Readout,
} from "@/components/on-deck/board-parts";

/**
 * The courtside Kiosk (issue #259) on the substitution board (direction seed
 * 92ec9d54): the Display's board — courts, on deck, the queue — plus the milled
 * keys a Game turnover needs, for a tablet stood by the courts.
 *
 *   - **Court N done** — the orange turnover key; the next Foursome walks on
 *   - **A player short** — flag a missing fourth; Match Me pulls a replacement
 *   - **Add me** — a walk-up with no phone enters name + last initial + skill
 *
 * plus an **idle-court nudge** — "Is Court N still going?" — when a Court has
 * sat unconfirmed well past a normal Game length.
 *
 * No token — the Session id in the URL is the whole credential (ADR 0005). All
 * taps are `kiosk` Operator actions.
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
        className="od-readout mt-3 text-[0.72rem] text-arena-dim underline-offset-4 hover:text-arena-fg hover:underline"
        data-testid={`player-short-${court}`}
        onClick={() => setOpen(true)}
      >
        A player short?
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-dashed border-arena-line p-3">
      <label className="block">
        <Readout className="text-arena-dim">Who&apos;s missing</Readout>
        <select
          className="od-select mt-1.5"
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
      <label className="block">
        <Readout className="text-arena-dim">
          Bring in{suggested ? " (suggested)" : ""}
        </Readout>
        <select
          className="od-select mt-1.5"
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
        <button
          type="button"
          className="od-key"
          disabled={pending || !outName || !inName}
          onClick={() => onSwap({ court, since, outName, inName })}
        >
          Bring them in
        </button>
        <button
          type="button"
          className="od-key od-key--ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
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
      <button
        type="button"
        className="od-key od-key--ghost w-full"
        data-testid="add-me"
        onClick={() => setOpen(true)}
      >
        Add me to the queue
      </button>
    );
  }

  return (
    <form
      className="od-panel p-4"
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
      <BoardHeading>Add me</BoardHeading>
      <p className="mt-1 text-sm text-arena-faint">
        No phone? Enter your name and you&apos;ll queue like everyone else.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <Readout className="text-arena-dim">First name</Readout>
          <input
            autoComplete="off"
            autoCapitalize="words"
            className="od-field w-44"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <Readout className="text-arena-dim">Last initial</Readout>
          <input
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={4}
            className="od-field w-20"
            value={initial}
            onChange={(e) => setInitial(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <Readout className="text-arena-dim">Skill level</Readout>
          <select
            className="od-select w-44"
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
          >
            {SKILL_LEVELS.map((level) => (
              <option key={level} value={level}>
                {SKILL_LEVEL_LABEL[level]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="od-key od-key--go"
          disabled={!ready || pending}
        >
          Add me
        </button>
        <button
          type="button"
          className="od-key od-key--ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

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
  const kioskUndo = view.undo && view.undo.by === "kiosk" ? view.undo : null;

  if (view.status !== "open") {
    return (
      <BoardBanner tone="closed" data-testid="kiosk-closed">
        Tonight&apos;s session has wrapped up
      </BoardBanner>
    );
  }

  const hasOnDeck = !view.lastCall && view.onDeck.some((f) => f.length > 0);

  return (
    <div className="space-y-7" data-testid="kiosk-board">
      {error && (
        <p
          className="od-readout text-[0.72rem] text-arena-warn"
          role="alert"
          data-testid="kiosk-error"
        >
          {error}
        </p>
      )}

      {kioskUndo && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-arena-line px-4 py-2.5">
          <span className="text-sm text-arena-faint">
            Tapped something by mistake?
          </span>
          <button
            type="button"
            className="od-key od-key--ghost"
            disabled={busy}
            data-testid="kiosk-undo"
            onClick={() => undo.mutate(kioskUndo.seq)}
          >
            Undo {kioskUndo.label}
          </button>
        </div>
      )}

      {view.lastCall && (
        <BoardBanner tone="last-call" data-testid="kiosk-last-call">
          Last call. Final games only, no new foursomes tonight.
        </BoardBanner>
      )}

      {/* ── Courts — the primary surface, big turnover keys ────────────── */}
      <section>
        <BoardHeading count={view.courts.length}>
          {view.lastCall ? "Final games" : "On the courts"}
        </BoardHeading>
        <div className="mt-3 grid items-start gap-3 sm:grid-cols-2">
          {view.courts.map((court) => {
            const occupied = court.players.length > 0;
            const nextReady = !view.lastCall && view.onDeck[0]?.length === 4;
            const idle = view.idleCourts.includes(court.number);
            return (
              <CourtPanel key={court.number} court={court} testIdPrefix="kiosk-court-">
                <button
                  type="button"
                  className={
                    occupied
                      ? "od-key od-key--go od-key--turnover mt-4"
                      : "od-key od-key--ghost mt-4 w-full"
                  }
                  disabled={busy || (!occupied && !nextReady)}
                  data-testid={`kiosk-court-${court.number}`}
                  onClick={() =>
                    finish.mutate({ court: court.number, since: court.since })
                  }
                >
                  {occupied ? `Court ${court.number} done` : "Send next four"}
                </button>

                {idle && (
                  <div
                    className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-arena-warn/40 bg-arena-warn/10 px-3 py-2"
                    data-testid={`kiosk-idle-nudge-${court.number}`}
                  >
                    <Readout className="text-arena-warn">
                      Is Court {court.number} still going?
                    </Readout>
                    <button
                      type="button"
                      className="od-key od-key--ghost"
                      disabled={busy}
                      data-testid={`kiosk-still-going-${court.number}`}
                      onClick={() =>
                        confirm.mutate({ court: court.number, since: court.since })
                      }
                    >
                      Still going
                    </button>
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
              </CourtPanel>
            );
          })}
        </div>
      </section>

      {/* ── On Deck ───────────────────────────────────────────────────── */}
      {!view.lastCall && (
        <section>
          <BoardHeading tone="next">On deck</BoardHeading>
          <div className="mt-3 grid items-start gap-4 sm:grid-cols-2">
            {([0, 1] as const).map((slot) => (
              <FoursomePanel
                key={slot}
                slot={slot}
                testIdPrefix="kiosk-on-deck-"
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

      {!view.lastCall && (
        <AddMe onAdd={(args) => walkup.mutateAsync(args)} pending={walkup.isPending} />
      )}

      {/* ── Queue ─────────────────────────────────────────────────────── */}
      <section>
        <BoardHeading count={view.queuedCount}>
          {view.lastCall ? "Not playing tonight" : "In the queue"}
        </BoardHeading>
        <QueueList
          queue={view.queue}
          now={now}
          lastCall={view.lastCall}
          data-testid="kiosk-queue"
        />
      </section>
    </div>
  );
}
