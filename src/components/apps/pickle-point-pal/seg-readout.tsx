"use client";

import { cn } from "@/lib/utils";

/**
 * The score readout. A big, plain, tabular numeral set in the condensed
 * signage face — read in one glance in direct sun. No segmented-display
 * silhouette: what is not lit is not drawn.
 *
 * Size is driven by the container's `font-size`. The public API (SegReadout /
 * SegNumber / SegSep / SegClock / SegDigit) is unchanged so callers don't move.
 */

/** A single digit — kept for callers that render one number (the coin draw). */
export function SegDigit({ digit }: { digit: number }) {
  return <span className="pp-num">{Math.max(0, Math.trunc(digit))}</span>;
}

/**
 * A number, pinned to a reserved width so the readout does not reflow as a
 * score climbs from 9 to 10. Digits sit centred in the reserved box.
 */
export function SegNumber({ value, reserve = 1 }: { value: number; reserve?: number }) {
  return (
    <span
      className="pp-num inline-flex justify-center tabular-nums"
      style={{ minWidth: `calc(${reserve} * 0.62em)` }}
    >
      {Math.max(0, Math.trunc(value))}
    </span>
  );
}

/** The separator between two readout groups — a slim bar, vertically centred. */
export function SegSep() {
  return (
    <span
      aria-hidden
      className="mx-[0.13em] h-[0.1em] w-[0.34em] shrink-0 self-center rounded-[1px] bg-current"
    />
  );
}

/**
 * The full spoken score call: serving score, receiving score, server number —
 * in that order. `serverNumber === null` (singles, or rally) drops the third
 * group cleanly.
 */
export function SegReadout({
  serving,
  receiving,
  serverNumber,
  className,
  label,
}: {
  serving: number;
  receiving: number;
  serverNumber: 1 | 2 | null;
  className?: string;
  label: string;
}) {
  return (
    <span
      className={cn("pp-num inline-flex items-center leading-none text-pp-ink", className)}
      role="img"
      aria-label={label}
    >
      <SegNumber value={serving} reserve={2} />
      <SegSep />
      <SegNumber value={receiving} reserve={2} />
      {serverNumber !== null && (
        <>
          <SegSep />
          <SegNumber value={serverNumber} reserve={1} />
        </>
      )}
    </span>
  );
}

/** The timeout clock, same numeral: M:SS. */
export function SegClock({
  ms,
  paused,
  warn,
  className,
}: {
  ms: number;
  paused: boolean;
  warn: boolean;
  className?: string;
}) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;

  return (
    <span
      className={cn(
        "pp-num inline-flex items-center leading-none tabular-nums",
        warn && !paused ? "text-pp-signal" : paused ? "text-pp-ink-dim" : "text-pp-ink",
        className
      )}
      role="img"
      aria-label={`${minutes}:${String(seconds).padStart(2, "0")} remaining${paused ? ", paused" : ""}`}
    >
      {minutes}
      <span aria-hidden className="mx-[0.06em]">
        :
      </span>
      {String(seconds).padStart(2, "0")}
    </span>
  );
}
