"use client";

import { cn } from "@/lib/utils";

/**
 * The score readout, drawn as a true seven-segment display rather than set in a
 * font. This is the instrument's signature: every lit digit still shows its
 * unlit segments as a faint phantom (absence drawn as deliberately as light),
 * and a score change resolves as an instant per-segment swap with a hair of
 * stagger — a scoreboard slamming from 98 to 100, never a slide or a count-up.
 *
 * Size is driven entirely by the container's `font-size`; every SVG is
 * `height: 1em`. `prefers-reduced-motion` drops the stagger for an instant swap.
 */

// Segment geometry for a 100×180 cell, ~12px stroke with 45° bevels.
const SEGMENTS: Record<"a" | "b" | "c" | "d" | "e" | "f" | "g", string> = {
  a: "14,4 86,4 74,16 26,16",
  b: "88,8 88,84 76,74 76,18",
  c: "88,96 88,172 76,162 76,106",
  d: "14,176 86,176 74,164 26,164",
  e: "12,96 24,106 24,162 12,172",
  f: "12,8 24,18 24,74 12,84",
  g: "16,90 28,80 72,80 84,90 72,100 28,100",
};

const ORDER = ["a", "b", "c", "d", "e", "f", "g"] as const;

// Which segments are lit for each digit.
const DIGIT_MAP: Record<number, ReadonlySet<(typeof ORDER)[number]>> = {
  0: new Set(["a", "b", "c", "d", "e", "f"]),
  1: new Set(["b", "c"]),
  2: new Set(["a", "b", "g", "e", "d"]),
  3: new Set(["a", "b", "c", "d", "g"]),
  4: new Set(["f", "g", "b", "c"]),
  5: new Set(["a", "f", "g", "c", "d"]),
  6: new Set(["a", "f", "g", "e", "c", "d"]),
  7: new Set(["a", "b", "c"]),
  8: new Set(["a", "b", "c", "d", "e", "f", "g"]),
  9: new Set(["a", "b", "c", "d", "f", "g"]),
};

/** One cell. */
export function SegDigit({ digit }: { digit: number }) {
  const lit = DIGIT_MAP[digit] ?? DIGIT_MAP[8];
  return (
    <svg
      className="pp-seg-svg"
      viewBox="0 0 100 180"
      role="presentation"
      style={{ aspectRatio: "100 / 180" }}
    >
      {ORDER.map((seg, i) => (
        <polygon
          key={seg}
          points={SEGMENTS[seg]}
          className={lit.has(seg) ? "pp-seg-on" : "pp-seg-off"}
          style={{ transitionDelay: `${i * 12}ms` }}
        />
      ))}
    </svg>
  );
}

/**
 * A number in its own digits, no leading phantom (a padded ghost digit reads as
 * a real one and wrecks the score). Layout stays fixed as scores grow via a
 * reserved min-width of `reserve` cells, digits pinned to the right.
 */
export function SegNumber({ value, reserve = 1 }: { value: number; reserve?: number }) {
  const digits = String(Math.max(0, Math.trunc(value))).split("").map(Number);
  return (
    <span
      className="inline-flex items-start justify-center gap-[0.06em]"
      style={{ minWidth: `calc(${reserve} * 0.58em)` }}
    >
      {digits.map((d, i) => (
        <SegDigit key={i} digit={d} />
      ))}
    </span>
  );
}

/** The separator between two readout groups — a lit dash, like a real board. */
export function SegSep() {
  return (
    <span
      aria-hidden
      className="mx-[0.16em] mt-[0.4em] h-[0.15em] w-[0.3em] shrink-0 self-start rounded-[1px]"
      style={{ background: "var(--pp-ink)" }}
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
      className={cn("inline-flex items-start leading-none text-pp-ink", className)}
      role="img"
      aria-label={label}
    >
      <SegNumber value={serving} reserve={2} />
      <SegSep />
      <SegNumber value={receiving} reserve={2} />
      {serverNumber !== null && (
        <>
          <SegSep />
          <SegDigit digit={serverNumber} />
        </>
      )}
    </span>
  );
}

/** The timeout clock, same segment grammar: M:SS in fixed cells. */
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
  const secDigits = String(seconds).padStart(2, "0").split("").map(Number);
  const dotColor = paused
    ? "var(--pp-ink-dim)"
    : warn
      ? "var(--pp-signal)"
      : "var(--pp-ink)";

  return (
    <span
      className={cn(
        "pp-seg-clock inline-flex items-start leading-none",
        warn && "pp-seg-warn",
        paused && "pp-seg-paused",
        className
      )}
      role="img"
      aria-label={`${minutes}:${String(seconds).padStart(2, "0")} remaining${paused ? ", paused" : ""}`}
    >
      <SegDigit digit={minutes % 10} />
      <span
        aria-hidden
        className="mx-[0.14em] mt-[0.32em] flex shrink-0 flex-col gap-[0.24em] self-start"
      >
        <span className="h-[0.12em] w-[0.12em] rounded-full" style={{ background: dotColor }} />
        <span className="h-[0.12em] w-[0.12em] rounded-full" style={{ background: dotColor }} />
      </span>
      <SegDigit digit={secDigits[0]} />
      <SegDigit digit={secDigits[1]} />
    </span>
  );
}
