import type { ReactNode } from "react";

import { formatWaitLabel } from "@/lib/on-deck/session/wait";
import type { QueueEntryView, RotationCourt } from "@/lib/on-deck/rotation";

/*
 * Shared pieces of the On Deck substitution board (direction seed 92ec9d54).
 * Pure presentational — no hooks, no data fetching — so a Server Component or a
 * "use client" board can both render them. Every surface (Display, Kiosk,
 * floor screen, player phone) draws its courts, foursomes and queue from
 * these, so the board reads the same on the snack-table tablet and the
 * organizer's pocket.
 */

const ON_DECK_LABEL = ["Up next", "After that"] as const;

/** A tracked mono label — the starter's-clipboard voice. */
export function Readout({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`od-readout ${className}`}>{children}</span>;
}

/** The section headers on every board — a mono kicker over nothing, just the
 * label itself in the readout voice. Not the banned decorative eyebrow: it is
 * the only heading these list sections carry. */
export function BoardHeading({
  children,
  count,
  tone = "dim",
}: {
  children: ReactNode;
  count?: number;
  tone?: "dim" | "live" | "next";
}) {
  const color =
    tone === "live"
      ? "text-arena-live"
      : tone === "next"
        ? "text-arena-next"
        : "text-arena-dim";
  return (
    <h2 className={`od-readout flex items-baseline gap-2 ${color}`}>
      {children}
      {count != null && (
        <span className="text-arena-faint">
          {String(count).padStart(2, "0")}
        </span>
      )}
    </h2>
  );
}

/**
 * One of the two On Deck foursomes. `slot` 0 is "Up next" and, when `progress`
 * is given (0..1 — how near the front its Match Me anchor is), carries the
 * filled orange progress-to-court ladder. `slot` 1 is the cool "After that".
 * `live` flips it to the full orange call state (used the moment it walks onto
 * a court elsewhere, and on the player's own "you're up" surface).
 */
export function FoursomePanel({
  slot,
  names,
  isGroup,
  emptyLabel = "Selected when the queue fills",
  size = "board",
  progress,
  live = false,
  className = "",
  testIdPrefix = "foursome-",
}: {
  slot: 0 | 1;
  names: string[];
  isGroup?: boolean;
  emptyLabel?: string;
  size?: "board" | "compact";
  progress?: number;
  live?: boolean;
  className?: string;
  testIdPrefix?: string;
}) {
  const nameClass =
    size === "board"
      ? "od-display text-4xl sm:text-5xl"
      : "od-display text-3xl";
  const open = 4 - names.length;
  const ready = Math.round(Math.min(1, Math.max(0, progress ?? 0)) * 4);
  const showLadder = slot === 0 && progress != null && !live;

  return (
    <div
      className={`od-panel ${live ? "od-live" : slot === 0 ? "od-next" : ""} relative flex flex-col overflow-hidden ${className}`}
      data-testid={`${testIdPrefix}${slot}`}
    >
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <BoardHeading tone={live ? "live" : slot === 0 ? "next" : "dim"}>
            {ON_DECK_LABEL[slot]}
          </BoardHeading>
          {isGroup && (
            <Readout className="rounded-sm border border-current px-1.5 py-0.5 text-arena-next">
              Group
            </Readout>
          )}
        </div>

        {names.length === 0 ? (
          <p className="od-display mt-3 text-xl text-arena-faint">{emptyLabel}</p>
        ) : (
          <ul className="mt-3 space-y-0.5">
            {names.map((name, i) => (
              <li key={i} className={nameClass}>
                {name}
              </li>
            ))}
            {Array.from({ length: open }, (_, k) => (
              <li key={`open-${k}`} className={`${nameClass} text-arena-faint`}>
                Open spot
              </li>
            ))}
          </ul>
        )}
      </div>

      {showLadder && (
        <div className="border-t border-arena-next-line px-5 py-3.5 sm:px-6">
          <div className="flex items-center justify-between">
            <Readout className="text-arena-dim">To the courts</Readout>
            <Readout className="text-arena-next">{ready} / 4 ready</Readout>
          </div>
          <div
            className="od-ladder-track mt-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuenow={ready}
            aria-label="Players ready in the up-next foursome"
          >
            <div
              className="od-ladder-fill"
              style={{
                transform: `scaleX(${Math.min(1, Math.max(0, progress))})`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One court tile. Open reads OPEN in orange; occupied shows the four names in
 * board type.
 *
 * The one authored moment lives here with no JS state: the names list is keyed
 * on the foursome itself, so when a court turns over — an open court fills, or
 * one four is swapped for the next — the keyed node re-mounts and the CSS
 * `.od-flip` / `.od-court-fill` animation replays. Reduced motion collapses
 * both to an instant swap in globals.css.
 */
export function CourtPanel({
  court,
  size = "board",
  children,
  testIdPrefix = "court-",
}: {
  court: RotationCourt;
  size?: "board" | "compact";
  children?: ReactNode;
  testIdPrefix?: string;
}) {
  const occupied = court.players.length > 0;
  const numClass =
    size === "board"
      ? "od-display-tight text-3xl sm:text-4xl"
      : "od-display-tight text-2xl";
  const nameClass =
    size === "board" ? "od-display text-2xl sm:text-3xl" : "od-display text-xl";
  const foursomeKey = occupied ? court.players.join("|") : "open";

  return (
    <div
      className="od-panel od-court p-4 sm:p-5"
      data-testid={`${testIdPrefix}${court.number}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className={numClass}>
          <span className="text-arena-faint">Court</span> {court.number}
        </h3>
        {!occupied && (
          <Readout className="text-arena-live">Open</Readout>
        )}
      </div>

      {occupied ? (
        <ul key={foursomeKey} className="od-court-fill mt-2.5 space-y-0.5">
          {court.players.map((name, i) => (
            <li key={i} className={nameClass}>
              {name}
            </li>
          ))}
        </ul>
      ) : (
        <p key={foursomeKey} className={`mt-2.5 ${nameClass} text-arena-faint`}>
          Waiting for a foursome
        </p>
      )}

      {children}
    </div>
  );
}

/**
 * The numbered queue — a fixed tabular rail down the left, names in board
 * type, wait time as a mono readout on the right. `now` ticks in from the
 * parent so a quiet board still counts up. `onSetAside` / `onBreakUp`, when
 * given, render the operator's inline controls per row.
 */
export function QueueList({
  queue,
  now,
  lastCall = false,
  busy = false,
  onSetAside,
  onBreakUp,
  "data-testid": testId,
}: {
  queue: QueueEntryView[];
  now: number;
  lastCall?: boolean;
  busy?: boolean;
  onSetAside?: (name: string) => void;
  onBreakUp?: (groupId: string) => void;
  "data-testid"?: string;
}) {
  if (queue.length === 0) {
    return (
      <p className="od-display mt-3 text-lg text-arena-faint">
        {lastCall ? "Everyone got a game in" : "Nobody waiting right now"}
      </p>
    );
  }

  return (
    <ol className="mt-3 space-y-px" data-testid={testId}>
      {queue.map((entry, i) => {
        const pos = String(i + 1).padStart(2, "0");
        if (entry.kind === "solo") {
          return (
            <li
              key={`${entry.name}-${i}`}
              className="flex items-center gap-3 border-b border-arena-line-soft py-2"
            >
              <span className="od-rail">{pos}</span>
              <span className="od-display flex-1 text-2xl sm:text-3xl">
                {entry.name}
              </span>
              <Readout className="text-arena-dim">
                {formatWaitLabel(entry.waitSince, now)}
              </Readout>
              {onSetAside && !lastCall && (
                <button
                  type="button"
                  className="od-key--chip"
                  disabled={busy}
                  onClick={() => onSetAside(entry.name)}
                >
                  Set aside
                </button>
              )}
            </li>
          );
        }
        return (
          <li
            key={entry.groupId}
            className="border-b border-arena-line-soft py-2"
            data-testid="queue-group"
          >
            <div className="flex items-center gap-3">
              <span className="od-rail">{pos}</span>
              <Readout className="flex-1 text-arena-dim">
                Group of {entry.names.length}
              </Readout>
              <Readout className="text-arena-dim">
                {formatWaitLabel(entry.waitSince, now)}
              </Readout>
              {onBreakUp && !lastCall && (
                <button
                  type="button"
                  className="od-key--chip"
                  disabled={busy}
                  onClick={() => onBreakUp(entry.groupId)}
                >
                  Break up
                </button>
              )}
            </div>
            <ul className="mt-1.5 space-y-1 pl-[calc(2.25ch+0.75rem)]">
              {entry.names.map((name) => (
                <li
                  key={name}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="od-display text-xl sm:text-2xl">{name}</span>
                  {onSetAside && !lastCall && (
                    <button
                      type="button"
                      className="od-key--chip shrink-0"
                      disabled={busy}
                      onClick={() => onSetAside(name)}
                    >
                      Set aside
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

/** The full-width status bar — LAST CALL, session closed, the live tag. */
export function BoardBanner({
  tone,
  children,
  "data-testid": testId,
}: {
  tone: "live" | "last-call" | "closed";
  children: ReactNode;
  "data-testid"?: string;
}) {
  const cls =
    tone === "last-call"
      ? "od-live"
      : "od-panel text-arena-dim";
  return (
    <p
      className={`${cls} od-display px-5 py-3.5 text-xl`}
      data-testid={testId}
    >
      {children}
    </p>
  );
}
