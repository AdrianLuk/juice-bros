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
  /** A still wheel with nothing riding on it, for the empty state. */
  readonly ghost?: boolean;
  readonly ref?: React.Ref<WheelHandle>;
}

/** How far ahead of a peg the flapper starts riding up, in degrees. */
const FLAPPER_REACH = 7;

const SPIN_MS = 4600;
const SPIN_TURNS = 5;

const RIM = 96;
/** Where a label starts, and where it must stop before fouling the hub. */
const LABEL_OUTER = RIM - 9;
const LABEL_INNER = 23;
/** Matches `.dr-wedge-name` in globals.css. */
const LABEL_SIZE = 8.4;

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
 * Tones cycle three warm neutrals rather than a colour per name: the accent is
 * reserved for the wedge that wins, so the landing is the only saturated thing
 * that ever happens on the wheel. The cycle is nudged where it would otherwise
 * put two matching wedges side by side at the seam.
 */
function slice(pool: readonly Entrant[]): Slice[] {
  const total = pool.reduce((sum, entrant) => sum + entrant.tickets, 0);
  if (total <= 0) return [];

  const slices: Slice[] = [];
  let cursor = 0;

  pool.forEach((entrant, index) => {
    const span = (entrant.tickets / total) * 360;
    const last = index === pool.length - 1;
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

/**
 * What a wedge can actually hold.
 *
 * Two different limits, and the old code only respected one of them. The
 * radial run between rim and hub caps the character count, so a long name
 * cannot march through the middle of the wheel; the wedge's angle caps how
 * much of the name is worth attempting at all. A thin wedge therefore drops to
 * a first name and then to initials rather than vanishing, because a bucket
 * where one person's ticket is unlabelled is a bucket the room cannot audit.
 */
function labelFor(name: string, spanDeg: number): string | null {
  // A grotesk at this size averages a little under half its size per glyph.
  const budget = Math.floor((LABEL_OUTER - LABEL_INNER) / (LABEL_SIZE * 0.47));
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0] ?? name;

  const cut = (text: string, max: number) =>
    text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

  if (spanDeg >= 11) {
    if (name.length <= budget) return name;
    // Shorten the way a person would rather than cutting mid-word: "Catherine
    // Parenteau" becomes "Catherine P.", which anyone in the room can still
    // match to a face. "Catherine Pare…" is the version nobody can read.
    // Drop middle names before touching the surname: "Anna Leigh Waters" is
    // one character over budget, and "Anna Waters" is a far better answer than
    // collapsing straight to an initial.
    const last = parts[parts.length - 1];
    if (parts.length > 2) {
      const trimmed = `${first} ${last}`;
      if (trimmed.length <= budget) return trimmed;
    }
    if (parts.length > 1) {
      const abbreviated = `${first} ${last[0]?.toUpperCase() ?? ""}.`;
      if (abbreviated.length <= budget) return abbreviated;
    }
    return cut(first, budget);
  }

  if (spanDeg >= 6) return cut(first, Math.min(budget, 12));

  if (spanDeg >= 3.2) {
    const initials = parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
    return initials || null;
  }

  return null;
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
function labelPlacement(mid: number) {
  const flipped = mid >= 180;

  return {
    transform: `rotate(${(mid - 90).toFixed(3)}) translate(${LABEL_OUTER} 0)${flipped ? " rotate(180)" : ""}`,
    anchor: flipped ? ("start" as const) : ("end" as const),
  };
}

export function Wheel({ pool, landedId, ghost = false, ref }: WheelProps) {
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
    <div className={ghost ? "dr-wheel dr-wheel--ghost" : "dr-wheel"}>
      <div className="dr-wheel-pointer" aria-hidden="true">
        {/* The mount the flapper is sprung from. Without it the pointer reads
            as a triangle floating over the rim rather than a part. */}
        <svg className="dr-flapper-mount" viewBox="0 0 26 14" width="26" height="14">
          <rect x="4" y="0" width="18" height="9" rx="2.5" fill="var(--dr-hub)" />
          <circle cx="13" cy="9.5" r="3.2" fill="var(--dr-hub)" />
          <circle cx="13" cy="9.5" r="1.3" fill="var(--dr-ground)" />
        </svg>
        <div className="dr-flapper" ref={flapper}>
          <svg viewBox="0 0 24 36" width="24" height="36" aria-hidden="true">
            <path
              d="M12 35 L4 7 Q12 1.5 20 7 Z"
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
          {slices.map((s) => {
            const won = s.entrant.id === landedId;
            const { transform, anchor } = labelPlacement(s.mid);
            const text = labelFor(s.entrant.name, s.end - s.start);

            return (
              <g key={s.entrant.id} className={won ? "dr-slice dr-slice--won" : "dr-slice"}>
                <path
                  // The winning wedge is drawn proud of the rim, so the landing
                  // is a part moving rather than a colour changing.
                  d={wedgePath(s.start, s.end, won ? RIM + 3 : RIM)}
                  className={won ? "dr-wedge dr-wedge--won" : "dr-wedge"}
                  data-tone={s.tone}
                />
                {text ? (
                  <text
                    className={won ? "dr-wedge-name dr-wedge-name--won" : "dr-wedge-name"}
                    // The rotation has to sit on the text element: a transform
                    // on a tspan is ignored by every browser.
                    transform={transform}
                    textAnchor={anchor}
                    dominantBaseline="middle"
                  >
                    {text}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* The pegs the flapper ticks against. Drawn at full strength and
              standing proud of the rim: the mechanism the spin depends on has
              to be visible or the flapper has no cause. */}
          {slices.map((s) => (
            <line
              key={`peg-${s.entrant.id}`}
              className="dr-wheel-peg"
              x1="0"
              y1={-(RIM - 5)}
              x2="0"
              y2={-(RIM + 4)}
              transform={`rotate(${s.start})`}
            />
          ))}

          {/* Rim last, over the wedge edges. Two strokes: the band, and a
              turned inner edge that catches light the way the hub does. */}
          <circle cx="0" cy="0" r={RIM + 5.5} className="dr-wheel-rim" />
          <circle cx="0" cy="0" r={RIM + 1} className="dr-wheel-bevel" />
        </svg>
      </div>

      <div className="dr-wheel-hub" aria-hidden="true" />
    </div>
  );
}
