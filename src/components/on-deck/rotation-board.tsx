"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { QueryProvider } from "@/components/on-deck/query-provider";
import { useRotationSync } from "@/components/on-deck/use-rotation-sync";
import {
  BoardHeading,
  CourtPanel,
  FoursomePanel,
  QueueList,
  Readout,
} from "@/components/on-deck/board-parts";
import {
  addWalkup,
  bringPlayerBack,
  callLastCall,
  closeSession,
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
  volunteerCallLastCall,
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
 * The Organizer / Volunteer floor screen (issue #243) on the substitution
 * board (direction seed 92ec9d54): every Court with its four names in board
 * type and one orange turnover key, the two ON DECK foursomes, the numbered
 * Queue, and the operator controls (walk-up, skill fix, queue together, wrap
 * up). Polls `getRotationView` so it stays current as Players join from their
 * phones.
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
 * The floor actions, bound to whoever is driving the board: the Organizer's
 * account-backed Server Actions, or the Volunteer's token-carrying ones.
 * `auth.kind` is checked inline so TypeScript narrows `auth.token`.
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
    callLastCall: () =>
      auth.kind === "volunteer"
        ? volunteerCallLastCall(sessionId, auth.token)
        : callLastCall(sessionId),
    // Close is the Organizer's alone — a Volunteer link has no close path.
    closeSession: () => closeSession(sessionId),
  };
}


/**
 * "Someone didn't show?" for one in-play Court. Collapsed to a link until the
 * operator needs it; open, it pre-fills the Match Me suggestion but lets them
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
      <p className="od-readout mt-3 text-arena-dim">
        No one waiting to swap in
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="od-readout mt-3 text-[0.72rem] text-arena-dim underline-offset-4 hover:text-arena-fg hover:underline"
        onClick={() => setOpen(true)}
      >
        Someone didn&apos;t show?
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2.5 rounded-lg border border-dashed border-arena-line p-3">
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
          Swap in{suggested ? " (suggested)" : ""}
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
          Swap in
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
      className="od-panel p-4"
      data-testid="add-walkup"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || pending) return;
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
      <BoardHeading>Add a walk-up</BoardHeading>
      <p className="mt-1 text-sm text-arena-faint">
        Someone without their phone — they queue like everyone else.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <Readout className="text-arena-dim">First name</Readout>
          <input
            autoComplete="off"
            autoCapitalize="words"
            className="od-field w-40"
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
            className="od-select w-40"
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
          Add to the queue
        </button>
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
    <details className="od-panel p-4" data-testid="skill-levels">
      <summary className="od-readout cursor-pointer text-[0.72rem] text-arena-dim">
        Fix a skill level
      </summary>
      <p className="mt-1 text-sm text-arena-faint">
        Only if a self-rating is clearly off — this feeds the next match.
      </p>
      <ul className="mt-3 space-y-2">
        {roster.map((p) => (
          <li key={p.name} className="flex items-center justify-between gap-3">
            <span className="od-display text-lg">{p.name}</span>
            <select
              aria-label={`Skill level for ${p.name}`}
              className="od-select w-40"
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
 * Players who asked to play together and queues them as one Group.
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
    <div className="od-panel p-4" data-testid="queue-together">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <BoardHeading>Queue together</BoardHeading>
        <label className="od-readout flex items-center gap-1.5 text-arena-dim">
          Group cap
          <select
            aria-label="Group cap"
            className="od-select h-9 w-16"
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
      <p className="mt-1 text-sm text-arena-faint">
        Pick the players who asked to play together — we&apos;ll fill any open
        spots and keep them in line by their median wait.
      </p>
      {waiting.length === 0 ? (
        <p className="od-display mt-3 text-lg text-arena-faint">
          Nobody waiting to group up right now
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
          </button>
        </>
      )}
    </div>
  );
}

/** How long before the venue permit ends the floor screen starts nudging
 * "call it?" (ADR 0002). A prompt only — the tap stays a human decision. */
export const LAST_CALL_NUDGE_LEAD_MS = 15 * 60 * 1000;

/**
 * "Wrap up the night" (issue #255): Last Call, then Close. Last Call takes a
 * confirm — a judgment about the night, not a Court turnover, with no undo.
 */
function WrapUp({
  lastCall,
  canClose,
  permitEndsAt,
  onLastCall,
  onClose,
  pending,
}: {
  lastCall: boolean;
  canClose: boolean;
  permitEndsAt: number | null;
  onLastCall: () => void;
  onClose: () => void;
  pending: boolean;
}) {
  const [confirming, setConfirming] = useState<"last-call" | "close" | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const nudging =
    !lastCall &&
    permitEndsAt !== null &&
    permitEndsAt - now <= LAST_CALL_NUDGE_LEAD_MS;

  return (
    <div className="od-panel p-4" data-testid="wrap-up">
      <BoardHeading>Wrapping up</BoardHeading>
      {!lastCall ? (
        <>
          <p className="mt-1 text-sm text-arena-faint">
            Last Call stops new games starting. Games already on court finish
            normally.
          </p>
          {nudging && (
            <p
              className="od-readout mt-2 text-[0.72rem] text-arena-warn"
              data-testid="last-call-nudge"
            >
              The permit ends soon — call it?
            </p>
          )}
          {confirming === "last-call" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm text-arena-fg">
                Call it? This can&apos;t be undone.
              </span>
              <button
                type="button"
                className="od-key"
                disabled={pending}
                data-testid="last-call-confirm"
                onClick={() => {
                  onLastCall();
                  setConfirming(null);
                }}
              >
                Yes, last call
              </button>
              <button
                type="button"
                className="od-key od-key--ghost"
                onClick={() => setConfirming(null)}
              >
                Not yet
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="od-key od-key--ghost mt-3"
              disabled={pending}
              data-testid="last-call-button"
              onClick={() => setConfirming("last-call")}
            >
              Last call
            </button>
          )}
        </>
      ) : (
        <>
          <p
            className="od-display mt-1 text-lg text-arena-live"
            data-testid="last-call-banner"
          >
            Last call. Final games only, no new foursomes.
          </p>
          {canClose &&
            (confirming === "close" ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-arena-fg">
                  Close the session? The player list is wiped — only the summary
                  is kept.
                </span>
                <button
                  type="button"
                  className="od-key"
                  disabled={pending}
                  data-testid="close-session-confirm"
                  onClick={() => {
                    onClose();
                    setConfirming(null);
                  }}
                >
                  Close it
                </button>
                <button
                  type="button"
                  className="od-key od-key--ghost"
                  onClick={() => setConfirming(null)}
                >
                  Not yet
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="od-key od-key--ghost mt-3"
                disabled={pending}
                data-testid="close-session-button"
                onClick={() => setConfirming("close")}
              >
                Close the session
              </button>
            ))}
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
  const pollInterval = useRotationSync(sessionId, [queryKey, rosterKey]);
  const query = useQuery({
    queryKey,
    queryFn: () => getRotationView(sessionId),
    refetchInterval: pollInterval,
    initialData: initialView,
  });
  const rosterQuery = useQuery({
    queryKey: rosterKey,
    queryFn: () => getFloorRoster(sessionId, authToken),
    refetchInterval: pollInterval,
    initialData: initialRoster,
  });
  const [error, setError] = useState<string | null>(null);
  // Wait Times count up between polls — tick a local clock so a quiet board
  // still advances the queue's minutes.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const ops = boundFloorActions(sessionId, auth);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: rosterKey });
  };
  const handle = (result: { ok?: boolean; error?: string }) => {
    setError(result.ok ? null : (result.error ?? "Something went wrong. Try again."));
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

  const lastCallMut = useMutation({
    mutationFn: () => ops.callLastCall(),
    onSuccess: handle,
    onError: () => setError("Couldn't call it. Try again."),
  });

  const closeMut = useMutation({
    mutationFn: () => ops.closeSession(),
    onSuccess: handle,
    onError: () => setError("Couldn't close the session. Try again."),
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
    breakUp.isPending ||
    lastCallMut.isPending ||
    closeMut.isPending;

  const nextReady = !view.lastCall && view.onDeck[0]?.length === 4;
  const hasOnDeck = !view.lastCall && view.onDeck.some((f) => f.length > 0);

  return (
    <div className="space-y-7">
      {error && (
        <p
          className="od-readout text-[0.72rem] text-arena-warn"
          role="alert"
          data-testid="floor-error"
        >
          {error}
        </p>
      )}

      {undoTarget && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-arena-line px-4 py-2.5">
          <span className="text-sm text-arena-faint">
            {undoTarget.by !== auth.kind
              ? `${OTHER_OPERATOR_LABEL[undoTarget.by]} made the last change.`
              : "Tapped something by mistake?"}
          </span>
          <button
            type="button"
            className="od-key od-key--ghost"
            disabled={busy}
            data-testid="undo-button"
            onClick={() => undo.mutate(undoTarget.seq)}
          >
            Undo {undoTarget.label}
          </button>
        </div>
      )}

      {/* ── Courts ────────────────────────────────────────────────────── */}
      <section>
        <BoardHeading count={view.courts.length}>
          {view.lastCall ? "Final games" : "On the courts"}
        </BoardHeading>
        <div className="mt-3 grid items-start gap-3 sm:grid-cols-2">
          {view.courts.map((court) => {
            const occupied = court.players.length > 0;
            return (
              <CourtPanel key={court.number} court={court}>
                <button
                  type="button"
                  className={
                    occupied
                      ? "od-key od-key--go od-key--turnover mt-4"
                      : "od-key od-key--ghost mt-4 w-full"
                  }
                  disabled={busy || (!occupied && !nextReady)}
                  onClick={() =>
                    finish.mutate({ number: court.number, since: court.since })
                  }
                >
                  {occupied ? `Court ${court.number} done` : "Send next four"}
                </button>
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
                testIdPrefix="on-deck-"
                names={view.onDeck[slot] ?? []}
                isGroup={view.onDeckIsGroup[slot]}
                emptyLabel="Not enough players waiting yet"
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
        <AddWalkup
          onAdd={(args) => walkup.mutateAsync(args)}
          pending={walkup.isPending}
        />
      )}

      {/* ── Queue ─────────────────────────────────────────────────────── */}
      <section>
        <BoardHeading count={view.queuedCount}>
          {view.lastCall ? "Not playing tonight" : "In the queue"}
        </BoardHeading>
        {view.lastCall && view.queuedCount > 0 && (
          <p className="mt-1 text-xs text-arena-faint">
            Last call was made before a court opened for these players.
          </p>
        )}
        {!view.lastCall && view.queue.some((e) => e.kind === "group") && (
          <p className="mt-1 text-xs text-arena-faint">
            {QUEUE_TOGETHER_EXPLAINER}
          </p>
        )}
        <QueueList
          queue={view.queue}
          now={now}
          lastCall={view.lastCall}
          busy={busy}
          onSetAside={(name) => aside.mutate(name)}
          onBreakUp={(groupId) => breakUp.mutate(groupId)}
          data-testid="queue-list"
        />
      </section>

      {!view.lastCall && (
        <>
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
        </>
      )}

      {view.status === "open" && (
        <WrapUp
          lastCall={view.lastCall}
          canClose={auth.kind === "organizer"}
          permitEndsAt={view.permitEndsAt}
          onLastCall={() => lastCallMut.mutate()}
          onClose={() => closeMut.mutate()}
          pending={busy}
        />
      )}

      {view.paused.length > 0 && (
        <section>
          <BoardHeading>Set aside</BoardHeading>
          <ul className="mt-3 space-y-px" data-testid="paused-list">
            {view.paused.map((p, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 border-b border-arena-line-soft py-2"
              >
                <span className="od-display text-lg">
                  {p.name}{" "}
                  <span className="od-readout ml-1 text-arena-dim">
                    {PAUSE_REASON_LABEL[p.reason]}
                  </span>
                </span>
                <button
                  type="button"
                  className="od-readout text-arena-dim underline-offset-4 hover:underline"
                  disabled={busy}
                  onClick={() => back.mutate(p.name)}
                >
                  Back in the queue
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
