import type { CSSProperties } from "react";
import Link from "next/link";

import { Picture } from "@/components/picture";
import { cn } from "@/lib/utils";
import flight from "./play-teaser-flight.json";

const BALL = "#e3f04a";

const { from, to, fromGround, toGround, mid, top } = flight;
// The flight is a parabola between the paddles: a straight line plus a lift
// that peaks at `top` halfway, which is the quadratic whose control point sits
// twice that lift above the straight line's midpoint.
const lift = { x: top.x - mid.x, y: top.y - mid.y };
const TRACK = `M${from.x} ${from.y} Q${mid.x + 2 * lift.x} ${mid.y + 2 * lift.y} ${to.x} ${to.y}`;
const px = (n: number) => `${n}px`;
const motion = {
  "--bx-court-dx": px(to.x - from.x),
  "--bx-court-dy": px(to.y - from.y),
  "--bx-court-sx": px(toGround.x - fromGround.x),
  "--bx-court-sy": px(toGround.y - fromGround.y),
  "--bx-court-lx": px(lift.x),
  "--bx-court-ly": px(lift.y),
} as CSSProperties;

/**
 * The two hosts on the game's court, as the game draws them: a still rendered
 * from the Rally figures by `scripts/render-play-teaser.mts` (rerun it when
 * the models change). The ball, its shadow and its dashed flight are drawn
 * over the still in the image's own pixels, so the teaser can animate them.
 */
function Court({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-(--bx-radius)", className)}>
      <Picture
        src="/play/teaser.jpg"
        alt=""
        sizes="(min-width: 1216px) 38rem, (min-width: 768px) 56vw, 100vw"
        loading="lazy"
        className="block h-auto w-full"
      />
      <svg
        viewBox={`0 0 ${flight.width} ${flight.height}`}
        aria-hidden
        className="absolute inset-0 h-full w-full"
        style={motion}
      >
        <path d={TRACK} fill="none" stroke="#f2f4f6" strokeWidth="3" strokeDasharray="10 12" opacity="0.5" />
        <ellipse className="bx-court-shadow" cx={fromGround.x} cy={fromGround.y} rx="15" ry="6" fill="#000" opacity="0.45" />
        <g className="bx-court-ball">
          <circle className="bx-court-lift" cx={from.x} cy={from.y} r="13" fill={BALL} />
        </g>
      </svg>
    </div>
  );
}

/**
 * The way into `/play`, shared by the home page and About.
 *
 * One linked panel on the page ground: the two hosts on court on one side,
 * what the game is on the other. At rest the ball hangs over the net
 * mid-rally; hovering or focusing the panel plays the rally, and leaving
 * freezes it wherever it got to. Touch visitors get the frozen frame, which
 * reads on its own.
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
        <Court className="md:order-2" />
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
