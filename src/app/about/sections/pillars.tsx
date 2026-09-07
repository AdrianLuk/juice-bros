import Link from "next/link";

import { SectionHead } from "@/components/bx/page-head";

const pillars = [
  {
    name: "Conversations",
    blurb:
      "The psychology, the mindset, the stuff nobody else on a pickleball feed is talking about.",
  },
  {
    name: "Entertainment",
    blurb:
      "Funny stories, friendly debates, and running jokes that have gotten a little out of hand.",
  },
  {
    name: "Community",
    blurb:
      "Your stories, your clubs, your questions. Ontario and Canadian pickleball, front and center.",
  },
  {
    name: "Culture",
    blurb: "Everything around the sport: the events, the etiquette, the trends, the drama.",
  },
];

/**
 * What the show covers.
 *
 * Four equal panels on one line. The incumbent nudged every second card down
 * by 20px, which is decoration pretending to be rhythm - these are four peers
 * and reading them as a row is the whole point. Their names are ink rather
 * than the incumbent's brand orange: orange has its jobs on this site and a
 * card heading is not one of them.
 *
 * It opens with the page's second and last hairline, because this is where the
 * register changes - the argument ends above it and a supporting shelf begins.
 * Like every shelf section on the site it carries its own way out, so the body
 * of the page is no longer a run of six sections with nowhere to click. It is
 * labelled "View all", the site's own shelf wording, and not "Every episode" -
 * that is the hero's ink pill, to the same destination, and two identical
 * labels 3,400px apart read as a stutter rather than as two ways out.
 *
 * Shelf rank, not a fourth major: DESIGN.md's ladder puts supporting sections
 * at py-10/14 under a minor heading, and this one is four one-line blurbs
 * rather than an argument. Every section on this page carried identical air
 * before, which is what made a page of genuinely different-sized ideas read as
 * a flat plateau of equals - the one thing the old About page most needed to
 * stop doing.
 */
export function Pillars() {
  return (
    <section className="bx-measure bx-hair py-10 sm:py-14">
      <SectionHead
        title="More than a podcast"
        size="minor"
        link={
          <Link
            href="/podcast"
            className="bx-quietlink group inline-flex items-center whitespace-nowrap"
          >
            View all
            <span aria-hidden className="bx-arrow">
              &rarr;
            </span>
          </Link>
        }
      />

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pillars.map((pillar) => (
          <li key={pillar.name} className="flex">
            <div className="bx-panel flex w-full flex-col p-6">
              <h3 className="bx-h2 text-base sm:text-lg">{pillar.name}</h3>
              <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-[var(--bx-muted)]">
                {pillar.blurb}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
