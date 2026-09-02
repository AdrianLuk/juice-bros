"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryProvider } from "@/components/on-deck/query-provider";
import {
  addWalkup,
  bringPlayerBack,
  dissolveGroup,
  finishCourt,
  formGroup,
  lowerGroupCap,
  overridePlayerSkill,
  setPlayerAside,
  swapNoShow,
  undoLastAction,
} from "@/lib/on-deck/actions/floor";
import {
  volunteerAddWalkup,
  volunteerBringPlayerBack,
  volunteerDissolveGroup,
  volunteerFinishCourt,
  volunteerFormGroup,
  volunteerLowerGroupCap,
  volunteerOverridePlayerSkill,
  volunteerSetPlayerAside,
  volunteerSwapNoShow,
  volunteerUndoLastAction,
} from "@/lib/on-deck/actions/volunteer";
import {
  getFloorRoster,
  getRotationView,
  type FloorRoster,
  type RotationView,
} from "@/lib/on-deck/actions/rotation";
import {
  QUEUE_TOGETHER_EXPLAINER,
  SKILL_LEVELS,
  SKILL_LEVEL_LABEL,
  type PauseReason,
} from "@/lib/on-deck/session/types";

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

/** Whose tap the Undo control is offering to reverse, when it wasn't the
 * person now looking at the board (#247). */
const OTHER_OPERATOR_LABEL: Record<string, string> = {
  organizer: "The organizer",
  volunteer: "A volunteer",
  kiosk: "The kiosk",
  player: "A player",
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
  initialRoster,
  auth = ORGANIZER_AUTH,
}: {
  sessionId: string;
  initialView: RotationView;
  initialRoster: FloorRoster;
  auth?: FloorAuth;
}) {
  return (
    <QueryProvider>
      <RotationBoardInner
        sessionId={sessionId}
        initialView={initialView}
        initialRoster={initialRoster}
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
    addWalkup: (first: string, initial: string, skill: string) =>
      auth.kind === "volunteer"
        ? volunteerAddWalkup(sessionId, auth.token, first, initial, skill)
        : addWalkup(sessionId, first, initial, skill),
    overrideSkill: (name: string, skill: string) =>
      auth.kind === "volunteer"
        ? volunteerOverridePlayerSkill(sessionId, auth.token, name, skill)
        : overridePlayerSkill(sessionId, name, skill),
    formGroup: (names: string[]) =>
      auth.kind === "volunteer"
        ? volunteerFormGroup(sessionId, auth.token, names)
        : formGroup(sessionId, names),
    lowerGroupCap: (cap: number) =>
      auth.kind === "volunteer"
        ? volunteerLowerGroupCap(sessionId, auth.token, cap)
        : lowerGroupCap(sessionId, cap),
    dissolveGroup: (groupId: string) =>
      auth.kind === "volunteer"
        ? volunteerDissolveGroup(sessionId, auth.token, groupId)
        : dissolveGroup(sessionId, groupId),
  };
}

const ON_DECK_LABELS = ["Up next", "After that"];

function OnDeck({
  foursomes,
  isGroup,
}: {
  foursomes: string[][];
  isGroup: boolean[];
}) {
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
                {isGroup[i] ? (
                  <span className="ml-2 rounded-full bg-brand-orange px-2 py-0.5 text-[0.65rem] tracking-normal text-white">
                    Group
                  </span>
                ) : null}
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

/**
 * "Add a walk-up" (issue #249): an Operator enters a Player with no phone —
 * name, last initial, Skill Level. They land in the Session and the Queue like
 * a self-registered Player, minus the device.
 */
function AddWalkup({
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
  const [first, setFirst] = useState("");
  const [initial, setInitial] = useState("");
  const [skill, setSkill] = useState<string>("intermediate");
  const ready = first.trim() !== "" && initial.trim() !== "";

  return (
    <form
      className="rounded-2xl border bg-card p-4"
      data-testid="add-walkup"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || pending) return;
        // Clear only once the add lands — a failed write keeps what was typed.
        onAdd({ first, initial, skill })
          .then((result) => {
            if (result && result.ok === false) return;
            setFirst("");
            setInitial("");
            setSkill("intermediate");
          })
          .catch(() => {});
      }}
    >
      <h2 className="font-heading text-xl font-semibold">Add a walk-up</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Someone without their phone — they queue like everyone else.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="walkup-first">First name</Label>
          <Input
            id="walkup-first"
            autoComplete="off"
            autoCapitalize="words"
            className="w-40"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="walkup-initial">Last initial</Label>
          <Input
            id="walkup-initial"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={4}
            className="w-16"
            value={initial}
            onChange={(e) => setInitial(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="walkup-skill">Skill level</Label>
          <select
            id="walkup-skill"
            className="h-9 rounded-md border bg-background px-2 text-sm"
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
        <Button type="submit" size="sm" disabled={!ready || pending}>
          Add to the queue
        </Button>
      </div>
    </form>
  );
}

/**
 * "Fix a skill level" (issue #249): a self-rating is sometimes plainly wrong.
 * An Operator corrects it on any Player and Match Me uses the new level on its
 * next selection. Tucked in a `<details>` — a rare correction, not a primary
 * control.
 */
function SkillLevels({
  roster,
  onOverride,
  pending,
}: {
  roster: FloorRoster;
  onOverride: (args: { name: string; skill: string }) => void;
  pending: boolean;
}) {
  if (roster.length === 0) return null;

  return (
    <details className="rounded-2xl border bg-card p-4" data-testid="skill-levels">
      <summary className="cursor-pointer font-heading text-xl font-semibold">
        Fix a skill level
      </summary>
      <p className="mt-1 text-sm text-muted-foreground">
        Only if a self-rating is clearly off — this feeds the next match.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {roster.map((p) => (
          <li key={p.name} className="flex items-center justify-between gap-3">
            <span>{p.name}</span>
            <select
              aria-label={`Skill level for ${p.name}`}
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={p.skillLevel}
              disabled={pending}
              onChange={(e) => onOverride({ name: p.name, skill: e.target.value })}
            >
              {SKILL_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {SKILL_LEVEL_LABEL[level]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * "Queue together" (issue #250): an Operator picks 2 to the live cap waiting
 * Players who asked to play together and queues them as one Group. A short
 * Group is filled to four by Match Me; the Group dissolves when its Game ends.
 * The cap has a live "lower it" control so one Foursome can't monopolise a
 * Court.
 */
function QueueTogether({
  waiting,
  groupCap,
  groupCapMax,
  onForm,
  onSetCap,
  pending,
}: {
  waiting: string[];
  groupCap: number;
  groupCapMax: number;
  onForm: (names: string[]) => Promise<{ ok?: boolean } | undefined>;
  onSetCap: (cap: number) => void;
  pending: boolean;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const chosen = picked.filter((name) => waiting.includes(name));
  const ready = chosen.length >= 2 && chosen.length <= groupCap;
  const capOptions = Array.from(
    { length: Math.max(0, groupCapMax - 1) },
    (_, i) => i + 2,
  );

  const toggle = (name: string) =>
    setPicked((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );

  return (
    <div className="rounded-2xl border bg-card p-4" data-testid="queue-together">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-xl font-semibold">Queue together</h2>
        <label className="text-xs text-muted-foreground">
          Group cap{" "}
          <select
            aria-label="Group cap"
            className="ml-1 h-8 rounded-md border bg-background px-1.5 text-sm"
            value={groupCap}
            disabled={pending}
            onChange={(e) => onSetCap(Number(e.target.value))}
          >
            {capOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick the players who asked to play together — we&apos;ll fill any open
        spots and keep them in line by their median wait.
      </p>
      {waiting.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nobody waiting to group up right now.
        </p>
      ) : (
        <>
          <ul className="mt-3 flex flex-wrap gap-2">
            {waiting.map((name) => {
              const on = chosen.includes(name);
              return (
                <li key={name}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={pending}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      on
                        ? "border-brand-orange bg-brand-orange text-white"
                        : "border-input"
                    }`}
                    onClick={() => toggle(name)}
                  >
                    {name}
                  </button>
                </li>
              );
            })}
          </ul>
          <Button
            type="button"
            size="sm"
            className="mt-3"
            disabled={!ready || pending}
            onClick={() => {
              onForm(chosen)
                .then((result) => {
                  if (result && result.ok === false) return;
                  setPicked([]);
                })
                .catch(() => {});
            }}
          >
            {chosen.length >= 2 && chosen.length > groupCap
              ? `Cap is ${groupCap}`
              : `Form group${chosen.length ? ` (${chosen.length})` : ""}`}
          </Button>
        </>
      )}
    </div>
  );
}

function RotationBoardInner({
  sessionId,
  initialView,
  initialRoster,
  auth,
}: {
  sessionId: string;
  initialView: RotationView;
  initialRoster: FloorRoster;
  auth: FloorAuth;
}) {
  const queryClient = useQueryClient();
  const authToken = auth.kind === "volunteer" ? auth.token : undefined;
  const queryKey = ["on-deck", "rotation", sessionId, "floor"] as const;
  const rosterKey = ["on-deck", "roster", sessionId, "floor"] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => getRotationView(sessionId),
    refetchInterval: POLL_MS,
    initialData: initialView,
  });
  const rosterQuery = useQuery({
    queryKey: rosterKey,
    queryFn: () => getFloorRoster(sessionId, authToken),
    refetchInterval: POLL_MS,
    initialData: initialRoster,
  });
  const [error, setError] = useState<string | null>(null);
  const ops = boundFloorActions(sessionId, auth);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: rosterKey });
  };
  const handle = (result: { ok?: boolean; error?: string }) => {
    setError(result.ok ? null : (result.error ?? "Something went wrong. Try again."));
    // Re-sync either way: on success to show the new board, on error (e.g. a
    // concurrent Operator) to pull in whatever they changed.
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

  const walkup = useMutation({
    mutationFn: ({
      first,
      initial,
      skill,
    }: {
      first: string;
      initial: string;
      skill: string;
    }) => ops.addWalkup(first, initial, skill),
    onSuccess: handle,
    onError: () => setError("Couldn't add that walk-up. Try again."),
  });

  const skillOverride = useMutation({
    mutationFn: ({ name, skill }: { name: string; skill: string }) =>
      ops.overrideSkill(name, skill),
    onSuccess: handle,
    onError: () => setError("Couldn't change that skill level. Try again."),
  });

  const group = useMutation({
    mutationFn: (names: string[]) => ops.formGroup(names),
    onSuccess: handle,
    onError: () => setError("Couldn't form that group. Try again."),
  });

  const capChange = useMutation({
    mutationFn: (cap: number) => ops.lowerGroupCap(cap),
    onSuccess: handle,
    onError: () => setError("Couldn't change the cap. Try again."),
  });

  const breakUp = useMutation({
    mutationFn: (groupId: string) => ops.dissolveGroup(groupId),
    onSuccess: handle,
    onError: () => setError("Couldn't break up that group. Try again."),
  });

  const view = query.data ?? initialView;
  const undoTarget = view.undo;
  const roster = rosterQuery.data ?? initialRoster;
  const busy =
    finish.isPending ||
    swap.isPending ||
    aside.isPending ||
    back.isPending ||
    undo.isPending ||
    walkup.isPending ||
    skillOverride.isPending ||
    group.isPending ||
    capChange.isPending ||
    breakUp.isPending;

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
        <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed px-3 py-2">
          <span className="text-sm text-muted-foreground">
            {undoTarget.by !== auth.kind
              ? `${OTHER_OPERATOR_LABEL[undoTarget.by]} made the last change.`
              : "Tapped something by mistake?"}
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
          // A clean Foursome is ready only when On Deck has actually committed
          // one — with Groups in the mix `queuedCount >= 4` no longer implies a
          // seatable four (a Group at the front may be short a fill Player).
          const nextReady = view.onDeck[0]?.length === 4;
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
                  waiting={view.waitingNames}
                  onSwap={swap.mutate}
                  pending={swap.isPending}
                />
              )}
            </div>
          );
        })}
      </div>

      <OnDeck foursomes={view.onDeck} isGroup={view.onDeckIsGroup} />

      <AddWalkup
        onAdd={(args) => walkup.mutateAsync(args)}
        pending={walkup.isPending}
      />

      <div>
        <h2 className="font-heading text-xl font-semibold">
          Queue{" "}
          <span className="text-muted-foreground">({view.queuedCount})</span>
        </h2>
        {view.queue.some((e) => e.kind === "group") && (
          <p className="mt-1 text-xs text-muted-foreground">
            {QUEUE_TOGETHER_EXPLAINER}
          </p>
        )}
        {view.queue.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nobody waiting right now.
          </p>
        ) : (
          <ol className="mt-3 space-y-1 text-sm" data-testid="queue-list">
            {view.queue.map((entry, i) =>
              entry.kind === "solo" ? (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span>
                    <span className="text-muted-foreground">{i + 1}.</span>{" "}
                    {entry.name}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                    disabled={busy}
                    onClick={() => aside.mutate(entry.name)}
                  >
                    Set aside
                  </button>
                </li>
              ) : (
                <li
                  key={i}
                  className="rounded-lg border border-brand-orange/40 bg-brand-orange/5 px-2 py-1.5"
                  data-testid="queue-group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold tracking-wide text-brand-orange uppercase">
                      <span className="text-muted-foreground">{i + 1}.</span>{" "}
                      Group
                    </span>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                      disabled={busy}
                      onClick={() => breakUp.mutate(entry.groupId)}
                    >
                      Break up
                    </button>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {entry.names.map((name) => (
                      <li
                        key={name}
                        className="flex items-center justify-between gap-2"
                      >
                        <span>{name}</span>
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
                  </ul>
                </li>
              ),
            )}
          </ol>
        )}
      </div>

      <QueueTogether
        waiting={view.groupablePlayers}
        groupCap={view.groupCap}
        groupCapMax={view.groupCapMax}
        onForm={(names) => group.mutateAsync(names)}
        onSetCap={capChange.mutate}
        pending={group.isPending || capChange.isPending}
      />

      <SkillLevels
        roster={roster}
        onOverride={skillOverride.mutate}
        pending={skillOverride.isPending}
      />

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
