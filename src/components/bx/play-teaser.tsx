import Link from "next/link";

import { cn } from "@/lib/utils";

/*
 * The court as the game draws it (`apps/rally/scene.ts`), seen from above, in
 * feet: a 44 x 20 court with every line where the game puts it, cropped to
 * 3ft of the game's surround so the court fills the frame. The colours
 * are the game's own. Like a thumbnail, this is content colour, not chrome.
 */
const COURT = "#1f4f7a";
const KITCHEN = "#2a6596";
const LINE = "#f2f4f6";
const BALL = "#e3f04a";

// Where each paddle meets the ball. The flight between them is a parabola,
// drawn as the quadratic whose control sits 2 x PEAK above the midpoint, and
// animated in globals.css (`.bx-court-*`) as a linear ground track plus a lift.
const FROM = { x: 16.6, y: 18.2 };
const TO = { x: 43.4, y: 11.8 };
const PEAK = 5;
const TRACK = `M${FROM.x} ${FROM.y} Q${(FROM.x + TO.x) / 2} ${(FROM.y + TO.y) / 2 - 2 * PEAK} ${TO.x} ${TO.y}`;

const R = 3.2;

/**
 * One host as a token: the game's face texture in a circle, under the hair or
 * cap the 3D figure wears (`apps/rally/hosts.ts`), so the two read apart
 * without a label.
 */
function Host({ id, cx, cy }: { id: "adrian" | "daven"; cx: number; cy: number }) {
  const clip = `bx-court-${id}`;

  return (
    <g>
      <clipPath id={clip}>
        <circle cx={cx} cy={cy} r={R} />
      </clipPath>
      <ellipse cx={cx} cy={cy + R * 0.85} rx={R * 0.8} ry={R * 0.28} fill="#000" opacity={0.3} />
      <g clipPath={`url(#${clip})`}>
        <image
          href={`/play/${id}-face.webp`}
          x={cx - R * 1.1}
          y={cy - R * 0.85}
          width={R * 2.2}
          height={R * 2.2}
        />
        {id === "adrian" ? (
          <ellipse cx={cx} cy={cy - R * 1.05} rx={R * 1.2} ry={R * 0.55} fill="#17130f" />
        ) : (
          <ellipse cx={cx} cy={cy - R * 1.1} rx={R * 1.2} ry={R * 0.55} fill="#d3d3cd" />
        )}
      </g>
      {id === "daven" && (
        <ellipse cx={cx} cy={cy - R * 0.55} rx={R * 1.08} ry={R * 0.16} fill="#b9b9b2" stroke="#0d0f12" strokeWidth={0.12} />
      )}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#0d0f12" strokeWidth={0.25} />
    </g>
  );
}

function CourtGraphic({ className }: { className?: string }) {
  return (
    <svg
      viewBox="3 1.5 54 27"
      aria-hidden
      className={cn("block h-auto w-full rounded-(--bx-radius)", className)}
    >
      <rect x="3" y="1.5" width="54" height="27" fill={COURT} />
      <rect x="23" y="5" width="14" height="20" fill={KITCHEN} />

      <g fill="none" stroke={LINE} strokeWidth="0.28">
        <rect x="8" y="5" width="44" height="20" />
        <path d="M23 5v20M37 5v20M8 15h15M37 15h15" />
      </g>

      {/* The net runs a foot past each sideline to its posts. */}
      <path d="M30 4v22" stroke="#0d0f12" strokeWidth="0.7" opacity="0.72" />
      <path d="M30 4v22" stroke={LINE} strokeWidth="0.16" />
      <circle cx="30" cy="4" r="0.45" fill="#2b3036" />
      <circle cx="30" cy="26" r="0.45" fill="#2b3036" />

      <path d={TRACK} fill="none" stroke={LINE} strokeWidth="0.16" strokeDasharray="0.6 0.7" opacity="0.55" />

      <Host id="adrian" cx={13} cy={19.5} />
      <Host id="daven" cx={47} cy={10.5} />

      <g className="bx-court-ground">
        <ellipse cx={FROM.x} cy={FROM.y} rx="0.8" ry="0.45" fill="#000" opacity="0.45" />
        <circle className="bx-court-lift" cx={FROM.x} cy={FROM.y} r="0.75" fill={BALL} />
      </g>
    </svg>
  );
}

/**
 * The way into `/play`, shared by the home page and About.
 *
 * One linked panel on the page ground: the court on one side, what the game
 * is on the other. At rest the ball hangs over the net mid-rally; hovering or
 * focusing the panel plays the rally, and leaving freezes it wherever it got
 * to. Touch visitors get the frozen frame, which reads on its own.
 *
 * Shelf rank (minor heading, shelf air). The caller adds `bx-hair` when the
 * section opens a shelf.
 */
export function PlayTeaser({ className }: { className?: string }) {
  return (
    <section className={cn("bx-measure py-10 sm:py-14", className)}>
      <Link
        href="/play"
        className="bx-panel group grid items-center gap-7 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] md:gap-12"
      >
        <CourtGraphic className="md:order-2" />
        <div className="px-2 pb-2 sm:px-2 md:py-2 md:pl-3">
          <h2 className="bx-h2 text-lg transition-colors duration-200 group-hover:text-(--bx-muted) sm:text-xl">
            Take on one of the hosts
          </h2>
          <p className="bx-meta mt-2">First to 11 · Keyboard or touch</p>
          <p className="mt-4 max-w-[44ch] text-[0.9375rem] leading-relaxed text-(--bx-muted)">
            Pick Adrian or Daven and play a game against the other one, right
            here in your browser. Your swing is automatic, so all you have to do
            is get to the ball.
          </p>
          <span className="mt-5 inline-flex text-sm font-semibold">
            Play the game
            <span aria-hidden className="bx-arrow">
              &rarr;
            </span>
          </span>
        </div>
      </Link>
    </section>
  );
}
