"use client";

import { useState } from "react";

import {
  BoardBanner,
  BoardHeading,
  CourtPanel,
  FoursomePanel,
  PlayerName,
  QueueList,
  Readout,
  SkillColors,
  SkillKey,
} from "@/components/on-deck/board-parts";
import type {
  FloorRoster,
  RotationView,
} from "@/lib/on-deck/session/rotation-view";
import {
  QUEUE_TOGETHER_EXPLAINER,
  SKILL_LEVELS,
  SKILL_LEVEL_LABEL,
  type PauseReason,
} from "@/lib/on-deck/session/types";
import type { ClubJoinQr } from "@/lib/on-deck/qr-types";

/*
 * The floor screen itself (issue #243), with nothing in it that knows where the
 * board came from. Every tap leaves through `ops`, so the same component draws
 * the Organizer's live screen (`rotation-board.tsx`, TanStack Query over Server
 * Actions), a Volunteer's, and the browser-only demo night (#519), which folds
 * its taps in a `useState` with no database anywhere in its import graph. That
 * is the point of the seam: the demo exercises the real Floor, not a replica of
 * it, so a bug the demo shows is a bug an organizer would have hit.
 */

/**
 * How the person driving the board is authorized (issue #248). The Organizer
 * holds an account; a Volunteer holds only the link's token, which every action
 * carries back so `on_deck_volunteer_append` can re-check it. The two paths run
 * the identical `floor-ops` decision — ADR 0005.
 */
export type FloorAuth =
  | { kind: "organizer" }
  | { kind: "volunteer"; token: string };

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
 * "Show the QR": the Club QR on the Operator's own screen, for the night the
 * printed sign isn't on the wall. Held out to a new arrival, it saves the
 * Operator typing them in one field at a time — the self-serve path first,
 * `AddWalkup` behind it for someone with no phone at all.
 *
 * Collapsed into a `<details>` like `SkillLevels`: needed a few times a night,
 * never while a Court is turning over. White card behind the code, the same
 * treatment the printed sign gives it — the arena panel is far too dark to
 * scan against.
 */
function ShowTheQr({ qr }: { qr: ClubJoinQr }) {
  return (
    <details className="od-panel p-4" data-testid="floor-join-qr">
      <summary className="od-readout cursor-pointer text-[0.72rem] text-arena-dim">
        Show the QR
      </summary>
      {/* Deliberately not phrased "in the queue": that is a board heading two
          panels down, and loose text matchers can't tell the two apart. */}
      <p className="mt-1 text-sm text-arena-faint">
        Hold this up and they add themselves, no typing from you. Same code as
        the sign on the wall.
      </p>
      {/* A QR is unreadable to a screen reader, so the code carries the
          address it encodes as its accessible name. */}
      <div
        role="img"
        aria-label={`Scan to join at ${qr.url}`}
        className="mt-3 w-40 rounded-lg bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: qr.svg }}
      />
    </details>
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
            <PlayerName name={p.name} className="od-display text-lg" />
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
                    <PlayerName name={name} />
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
  now,
  onLastCall,
  onClose,
  pending,
}: {
  lastCall: boolean;
  canClose: boolean;
  permitEndsAt: number | null;
  now: number;
  onLastCall: () => void;
  onClose: () => void;
  pending: boolean;
}) {
  const [confirming, setConfirming] = useState<"last-call" | "close" | null>(
    null,
  );
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

/**
 * What a tap on the floor screen does. The live board hands these to TanStack
 * Query mutations that call Server Actions; the demo hands them a reducer over
 * an event array. Neither shape leaks into the board.
 *
 * The two that return a promise do so because the form behind them clears
 * itself only on success — everything else is fire-and-forget from the board's
 * point of view, with `error` and `pending` coming back as props.
 */
export type FloorBoardOps = {
  finishCourt: (court: number, since: number | null) => void;
  swapNoShow: (args: {
    court: number;
    since: number | null;
    outName: string;
    inName: string;
  }) => void;
  setPlayerAside: (name: string) => void;
  bringPlayerBack: (name: string) => void;
  undo: (expectedSeq: number) => void;
  addWalkup: (args: {
    first: string;
    initial: string;
    skill: string;
  }) => Promise<{ ok?: boolean } | undefined>;
  overrideSkill: (args: { name: string; skill: string }) => void;
  formGroup: (names: string[]) => Promise<{ ok?: boolean } | undefined>;
  setGroupCap: (cap: number) => void;
  dissolveGroup: (groupId: string) => void;
  callLastCall: () => void;
  closeSession: () => void;
};

/**
 * Which controls are mid-flight. Separate flags rather than one boolean
 * because a form that disables itself while an unrelated action is in the air
 * reads as broken; `any` is the one the turnover keys watch.
 */
export type FloorBoardPending = {
  any: boolean;
  swap: boolean;
  walkup: boolean;
  skill: boolean;
  group: boolean;
};

/** Nothing in flight — what a board committing its taps synchronously passes. */
export const NOTHING_PENDING: FloorBoardPending = {
  any: false,
  swap: false,
  walkup: false,
  skill: false,
  group: false,
};

/**
 * The Organizer / Volunteer floor screen (issue #243) on the substitution
 * board (direction seed 92ec9d54): every Court with its four names in board
 * type and one orange turnover key, the two ON DECK foursomes, the numbered
 * Queue, and the operator controls (walk-up, skill fix, queue together, wrap
 * up).
 */
export function FloorBoard({
  view,
  roster,
  joinQr,
  auth,
  error,
  pending,
  now,
  ops,
}: {
  view: RotationView;
  roster: FloorRoster;
  /** The Club QR to hold up, or null where there is no Club to join — the
   * demo night, whose players are invented. */
  joinQr: ClubJoinQr | null;
  auth: FloorAuth;
  error: string | null;
  pending: FloorBoardPending;
  /**
   * The board's clock (`useBoardClock`), owned by whoever drives it so that
   * the Queue's wait times, the permit nudge, and — on the demo, which folds
   * its own board — the projection all read the same moment. The fold never
   * sees it.
   */
  now: number;
  ops: FloorBoardOps;
}) {
  const undoTarget = view.undo;
  const busy = pending.any;

  /**
   * The Session is over — closed, or Last Call has ended new play. Every
   * control that would *start* something is gated on this; the board itself
   * stays readable, because the last state of the night is worth being able
   * to look at (issue #532).
   *
   * `lastCall` is already false once a Session closes (`rotationViewFrom`
   * only sets it while the Session is open), so the two have to be asked
   * separately — a closed Session is not a Last Called one.
   */
  const closed = view.status === "closed";
  const live = !closed && !view.lastCall;

  const nextReady = live && view.onDeck[0]?.length === 4;
  const hasOnDeck = live && view.onDeck.some((f) => f.length > 0);

  return (
    <SkillColors by={view.skillByName}>
    <div className="space-y-7">
      {closed && (
        <BoardBanner tone="closed" data-testid="floor-closed">
          Tonight&apos;s session has wrapped up
        </BoardBanner>
      )}

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
            onClick={() => ops.undo(undoTarget.seq)}
          >
            Undo {undoTarget.label}
          </button>
        </div>
      )}

      {/*
        On mobile, On Deck leads — who's coming up next is what an operator
        glances at first on a phone. Courts stays first from sm: up, where
        there's room to see both without scrolling.
      */}
      <div className="flex flex-col gap-7">
        {/* ── Courts ──────────────────────────────────────────────────── */}
        <section className="order-2 sm:order-1">
          <BoardHeading count={view.courts.length}>
            {view.lastCall ? "Final games" : "On the courts"}
          </BoardHeading>
          <div className="mt-3 grid items-start gap-3 sm:grid-cols-2">
            {view.courts.map((court) => {
              const occupied = court.players.length > 0;
              return (
                <CourtPanel key={court.number} court={court}>
                  {!closed && (
                    <button
                      type="button"
                      className={
                        occupied
                          ? "od-key od-key--go od-key--turnover mt-4"
                          : "od-key od-key--ghost mt-4 w-full"
                      }
                      disabled={busy || (!occupied && !nextReady)}
                      onClick={() =>
                        ops.finishCourt(court.number, court.since)
                      }
                    >
                      {occupied ? `Court ${court.number} done` : "Send next four"}
                    </button>
                  )}
                  {occupied && !closed && (
                    <NoShowSwap
                      court={court.number}
                      players={court.players}
                      since={court.since}
                      suggested={court.suggestedReplacement}
                      waiting={view.waitingNames}
                      onSwap={ops.swapNoShow}
                      pending={pending.swap}
                    />
                  )}
                </CourtPanel>
              );
            })}
          </div>
        </section>

        {/* ── On Deck ─────────────────────────────────────────────────── */}
        {live && (
          <section className="order-1 sm:order-2">
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
      </div>

      {/* Both ways to get a new arrival in — and neither survives Last Call,
          which is the point at which nobody else gets a game tonight. */}
      {live && (
        <>
          {joinQr && <ShowTheQr qr={joinQr} />}
          <AddWalkup
            onAdd={ops.addWalkup}
            pending={pending.walkup}
          />
        </>
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
        {live && view.queue.some((e) => e.kind === "group") && (
          <p className="mt-1 text-xs text-arena-faint">
            {QUEUE_TOGETHER_EXPLAINER}
          </p>
        )}
        <QueueList
          queue={view.queue}
          now={now}
          lastCall={view.lastCall}
          busy={busy}
          onSetAside={live ? ops.setPlayerAside : undefined}
          onBreakUp={live ? ops.dissolveGroup : undefined}
          data-testid="queue-list"
        />
      </section>

      {live && (
        <>
          <QueueTogether
            waiting={view.groupablePlayers}
            groupCap={view.groupCap}
            groupCapMax={view.groupCapMax}
            onForm={ops.formGroup}
            onSetCap={ops.setGroupCap}
            pending={pending.group}
          />

          <SkillLevels
            roster={roster}
            onOverride={ops.overrideSkill}
            pending={pending.skill}
          />
        </>
      )}

      {view.status === "open" && (
        <WrapUp
          lastCall={view.lastCall}
          canClose={auth.kind === "organizer"}
          permitEndsAt={view.permitEndsAt}
          now={now}
          onLastCall={ops.callLastCall}
          onClose={ops.closeSession}
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
                  <PlayerName name={p.name} />{" "}
                  <span className="od-readout ml-1 text-arena-dim">
                    {PAUSE_REASON_LABEL[p.reason]}
                  </span>
                </span>
                {!closed && (
                  <button
                    type="button"
                    className="od-readout text-arena-dim underline-offset-4 hover:underline"
                    disabled={busy}
                    onClick={() => ops.bringPlayerBack(p.name)}
                  >
                    Back in the queue
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <SkillKey className="border-t border-arena-line-soft pt-4" />
    </div>
    </SkillColors>
  );
}
