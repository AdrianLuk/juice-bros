import Link from "next/link";
import type { ReactNode } from "react";

import { ON_DECK_HOME_PATH } from "@/lib/on-deck/routes";

/**
 * The Organizer's back office, in the board's own materials (issue #515
 * redesign, surface seed 7323f5fb).
 *
 * These screens used to be a column of same-weight shadcn cards on the light
 * theme — the last On Deck surface wearing a look nothing else in the product
 * uses. The composition here is "one thing lit": the Club's name is the page's
 * only heading, one panel below it carries the single thing to do now, and
 * everything else is a row on a hairline.
 */

/**
 * The chevron every destination row ends with. Drawn rather than typed: a
 * glyph borrowed from a text font would carry that font's weight and optical
 * centre, and this has to sit on the same stroke as the board's own marks.
 */
function Chevron() {
  return (
    <svg
      className="od-bo-chev"
      width="7"
      height="12"
      viewBox="0 0 7 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1 1l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The Club's name at board scale, and the spec line under it.
 *
 * The name is the page's h1 in every state, including the one where the Club
 * does not exist yet — there the create form feeds it what is being typed, so
 * an Organizer sees their club on the board before they commit to it. There is
 * one Club per account and no way to delete one, which is what makes seeing it
 * first worth a heading.
 *
 * `spec` takes real values only. It is the readout voice, so a decorative
 * string in it would be the board's clipboard worn as costume.
 */
export function BoardHead({
  name,
  resting,
  spec,
}: {
  name: string;
  /** Shown faintly when there is no name yet. */
  resting?: string;
  spec: ReactNode[];
}) {
  const empty = name.trim() === "";
  return (
    <>
      <h1
        className="od-display-tight od-bo-name"
        data-empty={empty ? "true" : undefined}
      >
        {empty ? (resting ?? "Your club") : name}
      </h1>
      {spec.length > 0 && (
        <p className="od-readout od-bo-spec">
          {spec.map((item, i) => (
            <span key={i}>{item}</span>
          ))}
        </p>
      )}
    </>
  );
}

/**
 * The lit panel. One object across every state of the home screen: it swaps
 * `tone` and the key at its foot, never its position.
 *
 * `next` is the cool imminent wash and means an action is waiting for you.
 * `live` is orange and is reserved, here as everywhere on the board, for
 * something actually happening: a Session open right now.
 *
 * `flat` is neither, and it is what settings uses. Only one thing on a screen
 * may be lit or the word stops meaning anything, and a settings form is not
 * waiting for anybody — it is a drawer you opened. Two washed panels stacked
 * down that page said "two things need you", which was false.
 */
export function Stage({
  tone = "next",
  children,
}: {
  tone?: "next" | "live" | "flat";
  children: ReactNode;
}) {
  return (
    <section
      className={`od-panel od-bo-stage${tone === "flat" ? "" : ` od-${tone}`}`}
    >
      {children}
    </section>
  );
}

/**
 * The way back to the one screen this whole section hangs off.
 *
 * Every page under `/on-deck/home` is reached from the lit panel's list and
 * returns to it, so the way back is the same control everywhere rather than a
 * different underlined phrase per page.
 */
export function BackToTonight() {
  return (
    <Link href={ON_DECK_HOME_PATH} className="od-key od-key--ghost mt-8">
      Back to tonight
    </Link>
  );
}

/**
 * How the create form hands focus to what replaces it.
 *
 * Creating a Club swaps the whole branch of the tree the submit button lived
 * in, so focus falls to `<body>` and a keyboard user has to start again from
 * the top of the page — on the one action that just changed what the page is.
 * The form sets this flag, it survives the refresh, and the Start key that
 * arrives in the panel's place claims it exactly once.
 */
export const HANDOFF_KEY = "on-deck:focus-after-create";

/**
 * A panel's own heading, in the readout voice. Cool-white rather than the dim
 * the field labels take: both are mono caps at the same step, so without a
 * value difference the heading and the labels under it read as one flat list.
 */
export function StageHeading({ children }: { children: ReactNode }) {
  return <h2 className="od-readout text-arena-fg">{children}</h2>;
}

/** The rows beneath the stage. Destinations, not a queue: no ordinals. */
export function RowList({ children }: { children: ReactNode }) {
  return (
    <nav className="od-bo-list" aria-label="Your club">
      {children}
    </nav>
  );
}

export function Row({
  href,
  label,
  sub,
  value,
  tag,
}: {
  href: string;
  label: string;
  /** A second line under the label — a venue, a night's numbers. */
  sub?: ReactNode;
  /** A real readout value. Omitted rather than filled with a verb. */
  value?: ReactNode;
  /** An inline mark on the row, e.g. the scheduled night Start will open. */
  tag?: string;
}) {
  return (
    <Link href={href} className="od-bo-row">
      <span className="od-bo-lab">
        {label}
        {tag && <span className="od-bo-tag ml-2 align-middle">{tag}</span>}
        {sub && <span className="od-bo-sub">{sub}</span>}
      </span>
      {value ? <span className="od-readout od-bo-val">{value}</span> : <span />}
      <Chevron />
    </Link>
  );
}
