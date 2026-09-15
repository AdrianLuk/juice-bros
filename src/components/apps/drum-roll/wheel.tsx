"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";

import type { Entrant } from "@/components/apps/drum-roll/lib/engine/types";

/**
 * The wheel.
 *
 * Wedge widths are ticket counts, which is the whole argument for a wheel
 * rather than a list: five tickets is a wedge five times wider, so the odds are
 * the picture instead of a number somebody has to be told.
 *
 * It decides nothing. `spinTo` is handed the entrant already chosen by
 * `pickWinner` against a seed the room has seen, and the spin is presentation
 * of a result that is already in the log. That ordering is what lets anyone
 * recompute the draw from what they watched, and it is why this file contains
 * no randomness at all.
 */

/** Rotation is driven straight into the DOM, so React never renders a frame. */
export interface WheelHandle {
  spinTo: (entrantId: string, onLanded: () => void) => void;
  reset: () => void;
}

interface WheelProps {
  readonly pool: readonly Entrant[];
  readonly landedId: string | null;
  readonly ref?: React.Ref<WheelHandle>;
}

/** Wedges thinner than this cannot hold a name without it turning to soup. */
const LABEL_FLOOR_DEG = 11;

/** How far ahead of a peg the flapper starts riding up, in degrees. */
const FLAPPER_REACH = 7;

const SPIN_MS = 4600;
const SPIN_TURNS = 5;

const RIM = 96;

interface Slice {
  readonly entrant: Entrant;
  readonly start: number;
  readonly end: number;
  readonly mid: number;
  readonly tone: number;
}

/**
 * Wedges laid out clockwise from twelve o'clock, sized by tickets.
 *
 * Tones cycle through three warm neutrals rather than a colour per name: the
 * accent is reserved for the wedge that wins, so the landing is the only
 * saturated thing that ever happens on the wheel. The cycle is nudged where it
 * would otherwise put two matching wedges side by side at the seam.
 */
function slice(pool: readonly Entrant[]): Slice[] {
  const total = pool.reduce((sum, entrant) => sum + entrant.tickets, 0);
  if (total <= 0) return [];

  const slices: Slice[] = [];
  let cursor = 0;

  pool.forEach((entrant, index) => {
    const span = (entrant.tickets / total) * 360;
    const last = index === pool.length - 1;
    // Three tones cycle without adjacent repeats except where the last wedge
    // meets the first, which the shift fixes.
    const tone = last && pool.length > 1 && pool.length % 3 === 1 ? 1 : index % 3;

    slices.push({
      entrant,
      start: cursor,
      end: cursor + span,
      mid: cursor + span / 2,
      tone,
    });
    cursor += span;
  });

  return slices;
}

function wedgePath(start: number, end: number, r: number): string {
  // A single wedge covering the whole wheel has no two edges to draw between,
  // and an arc from a point to itself renders as nothing at all.
  if (end - start >= 359.999) {
    return `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r} Z`;
  }

  const a0 = ((start - 90) * Math.PI) / 180;
  const a1 = ((end - 90) * Math.PI) / 180;
  const large = end - start > 180 ? 1 : 0;

  return [
    "M 0 0",
    `L ${(r * Math.cos(a0)).toFixed(3)} ${(r * Math.sin(a0)).toFixed(3)}`,
    `A ${r} ${r} 0 ${large} 1 ${(r * Math.cos(a1)).toFixed(3)} ${(r * Math.sin(a1)).toFixed(3)}`,
    "Z",
  ].join(" ");
}

/** Long names get cut rather than allowed to run under the hub. */
function fit(name: string, spanDeg: number): string {
  const budget = Math.max(6, Math.round(spanDeg * 0.85));
  return name.length <= budget ? name : `${name.slice(0, budget - 1).trimEnd()}…`;
}

/**
 * A label sitting at the rim and running inward, the right way up on both
 * sides of the wheel.
 *
 * Wedge angles run clockwise from twelve o'clock, so a label placed at `mid`
 * is rotated `mid - 90` off horizontal. That reads correctly down the right
 * half and arrives upside down everywhere past six o'clock, which is the half
 * of every wheel where names go to die. The left half therefore gets a further
 * half turn and anchors from the other end, so both halves read left to right
 * and both start at the rim.
 */
function label(mid: number, radius: number) {
  const flipped = mid >= 180;

  return {
    transform: `rotate(${(mid - 90).toFixed(3)}) translate(${radius} 0)${flipped ? " rotate(180)" : ""}`,
    anchor: flipped ? ("start" as const) : ("end" as const),
  };
}

export function Wheel({ pool, landedId, ref }: WheelProps) {
  const face = useRef<HTMLDivElement>(null);
  const flapper = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const angle = useRef(0);

  const slices = useMemo(() => slice(pool), [pool]);

  // Read once per spin rather than per frame: matchMedia inside a rAF loop is
  // a layout read on every tick for an answer that cannot change mid-spin.
  const prefersReduced = useCallback(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const paint = useCallback(
    (deg: number) => {
      angle.current = deg;
      if (face.current) face.current.style.transform = `rotate(${deg}deg)`;

      if (!flapper.current) return;

      // Each peg pushes the flapper as it arrives and drops it the instant it
      // passes, so the deflection rides up and snaps rather than oscillating.
      const at = ((-deg % 360) + 360) % 360;
      let lead = FLAPPER_REACH;
      for (const s of slices) {
        const gap = (s.start - at + 360) % 360;
        if (gap < lead) lead = gap;
      }
      const push = lead < FLAPPER_REACH ? 1 - lead / FLAPPER_REACH : 0;
      flapper.current.style.transform = `rotate(${(push * 17).toFixed(2)}deg)`;
    },
    [slices],
  );

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = null;
        paint(0);
      },

      spinTo(entrantId, onLanded) {
        const target = slices.find((s) => s.entrant.id === entrantId);
        if (!target) {
          onLanded();
          return;
        }

        // Bring the winning wedge's middle to the pointer at twelve o'clock.
        const settled = 360 - target.mid;

        if (prefersReduced()) {
          paint(settled);
          onLanded();
          return;
        }

        if (frame.current !== null) cancelAnimationFrame(frame.current);

        const from = angle.current % 360;
        const distance = SPIN_TURNS * 360 + ((settled - from + 360) % 360);
        const start = performance.now();

        const step = (now: number) => {
          const t = Math.min(1, (now - start) / SPIN_MS);
          // Exponential ease-out: quick to speed, then a long honest tail where
          // a wedge boundary can still change the answer.
          const eased = 1 - Math.pow(1 - t, 4);
          paint(from + distance * eased);

          if (t < 1) {
            frame.current = requestAnimationFrame(step);
            return;
          }
          frame.current = null;
          onLanded();
        };

        frame.current = requestAnimationFrame(step);
      },
    }),
    [slices, paint, prefersReduced],
  );

  const summary =
    slices.length === 0
      ? "The wheel is empty."
      : `Wheel of ${slices.length} ${slices.length === 1 ? "name" : "names"}: ${slices
          .map(
            (s) =>
              `${s.entrant.name}, ${s.entrant.tickets} ${s.entrant.tickets === 1 ? "ticket" : "tickets"}`,
          )
          .join("; ")}.`;

  return (
    <div className="dr-wheel">
      <div className="dr-wheel-pointer" aria-hidden="true">
        <div className="dr-flapper" ref={flapper}>
          <svg viewBox="0 0 24 34" width="24" height="34" aria-hidden="true">
            <path
              d="M12 33 L3.5 6 Q12 0.5 20.5 6 Z"
              fill="var(--dr-accent)"
              stroke="var(--dr-hub)"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      <div className="dr-wheel-face" ref={face}>
        <svg viewBox="-104 -104 208 208" role="img" aria-label={summary}>
          <circle cx="0" cy="0" r="100.5" className="dr-wheel-rim" />

          {slices.map((s) => {
            const won = s.entrant.id === landedId;
            // The rotation has to sit on the text element: a transform on a
            // tspan is ignored by every browser.
            const { transform, anchor } = label(s.mid, RIM - 8);

            return (
              <g key={s.entrant.id}>
                <path
                  d={wedgePath(s.start, s.end, RIM)}
                  className={won ? "dr-wedge dr-wedge--won" : "dr-wedge"}
                  data-tone={s.tone}
                />
                {s.end - s.start >= LABEL_FLOOR_DEG ? (
                  <text
                    className={won ? "dr-wedge-name dr-wedge-name--won" : "dr-wedge-name"}
                    transform={transform}
                    textAnchor={anchor}
                    dominantBaseline="middle"
                  >
                    {fit(s.entrant.name, s.end - s.start)}
                  </text>
                ) : null}
              </g>
            );
          })}

          {slices.map((s) => (
            <line
              key={`peg-${s.entrant.id}`}
              className="dr-wheel-peg"
              x1="0"
              y1={-(RIM - 9)}
              x2="0"
              y2={-RIM}
              transform={`rotate(${s.start})`}
            />
          ))}
        </svg>
      </div>

      <div className="dr-wheel-hub" aria-hidden="true" />
    </div>
  );
}
