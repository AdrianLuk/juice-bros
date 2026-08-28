"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The rack of capacity marks on a Game's Capacity panel (and its guest RSVP
 * page) — a filled mark is a "yes" Response, an outlined one an open spot, and
 * anything past the ceiling shows as an over-capacity mark (the same "signal,
 * never block" posture as the amber note beside it, see ADR 0001).
 *
 * When the last open spot lands — and only on that live transition, never on a
 * mount that happens to already be full — the whole rack does one short settle.
 * `prev` is seeded from the first render's `filled` so opening a slot that's
 * already full stays quiet; the settle is reserved for watching it happen.
 *
 * Decorative and redundant with the sentence it sits above, so it's
 * `aria-hidden` — the count stays in the text for a screen reader.
 */
export function SpotsMeter({
  filled,
  capacity,
  className,
}: {
  filled: number;
  capacity: number;
  className?: string;
}) {
  const base = Math.min(Math.max(filled, 0), capacity);
  const open = Math.max(0, capacity - filled);
  const over = Math.max(0, filled - capacity);

  const prev = useRef(filled);
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    const wasBelow = prev.current < capacity;
    const nowFull = capacity > 0 && filled >= capacity;
    if (wasBelow && nowFull && filled > prev.current) {
      setLocking(true);
    }
    prev.current = filled;
  }, [filled, capacity]);

  return (
    <span
      className={cn("bb-spots", locking && "bb-spots--lock", className)}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) {
          setLocking(false);
        }
      }}
      aria-hidden="true"
    >
      {Array.from({ length: base }, (_, index) => (
        <span key={`filled-${index}`} className="bb-spot bb-spot--filled" />
      ))}
      {Array.from({ length: open }, (_, index) => (
        <span key={`open-${index}`} className="bb-spot" />
      ))}
      {Array.from({ length: over }, (_, index) => (
        <span key={`over-${index}`} className="bb-spot bb-spot--over" />
      ))}
    </span>
  );
}
