import Link from "next/link";

import { Reveal } from "@/components/motion/reveal";

/**
 * How the show started - now the notes for the episode playing above it.
 *
 * The player used to live in this section, at half width, with the story
 * beside it. It moved to the hero, which is where the page's argument now
 * starts, so this section became what it always was underneath: the written
 * account of what you just pressed play on.
 *
 * Losing the player meant the section needed a new shape, or it would have
 * been the first of five consecutive prose blocks. The name story - a piece of
 * etymology, genuinely an aside - splits off into its own raised panel beside
 * the main read, so the section carries two densities instead of one and the
 * fun part is findable without interrupting the story.
 *
 * Motion: the two blocks converge, the gesture `Reveal` was written for. It
 * runs here and on the mission below, and nowhere else on the page - motion
 * marks the top of the argument and then gets out of the way, rather than
 * giving all seven sections the same entrance.
 *
 * The story closes on the site's inline action register - the one exit the
 * body of this page used to lack entirely. It points at episode one's own page
 * rather than back at the catalogue: the hero already plays the episode, and
 * what that page adds is the thing this section is describing in prose, the
 * chapter list and the notes. It drops out when the lookup misses, because a
 * link built from a slug that does not resolve is worse than no link.
 *
 * All copy here is the published About page's own, unchanged.
 */
export function OriginStory({ episodeSlug }: { episodeSlug?: string }) {
  return (
    <section className="bx-measure bx-hair py-16 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)] lg:items-start lg:gap-14">
        <Reveal variant="left">
          <h2 className="bx-h2 max-w-[20ch] text-[clamp(1.375rem,3.2vw,1.875rem)]">
            How this whole thing started
          </h2>
          <div className="bx-prose mt-6">
            <p>
              It started on the sidelines, the way most good ideas do. Daven and
              Adrian were two regulars at their local courts, always the last
              two still talking after everyone else had packed up their paddles
              and gone home. Wins, losses, weird matchups, the friend who
              won&apos;t stop coaching from the fence. It was all fair game.
            </p>
            <p>
              Eventually one of us said, &ldquo;we should just record
              this.&rdquo; So we did.
            </p>
            <p>
              Juice Bros Pickleball started as two friends riffing after a few
              games. It&apos;s grown into a show about the people, stories, and
              community that make this sport what it is, but the vibe
              hasn&apos;t changed. <strong>Pull up a chair. You&apos;re one of
              us now.</strong>
            </p>
          </div>
          {episodeSlug && (
            <Link
              href={`/podcast/${episodeSlug}`}
              className="bx-actionlink group mt-7"
            >
              Show notes and chapters
              <span aria-hidden className="bx-arrow">
                &rarr;
              </span>
            </Link>
          )}
        </Reveal>

        <Reveal variant="right" as="aside" className="bx-panel p-6 sm:p-7">
          <h3 className="bx-h2 text-lg sm:text-xl">How we got the name</h3>
          <div className="mt-4 flex flex-col gap-4 text-[0.9375rem] leading-relaxed text-[var(--bx-muted)]">
            <p>
              Back when we first started, we both played at the same local park.
              Adrian&apos;s shot has always been the backhand roll. One day
              Daven watched him hit one and said, &ldquo;that backhand roll is
              so juicy.&rdquo; It stuck. After that, whenever the roll landed,
              Daven would yell &ldquo;juuuice&rdquo; from the other side of the
              court.
            </p>
            <p>
              Then Adrian started calling it back every time Daven hit something
              clean, and &ldquo;juice&rdquo; stopped being about one shot. It
              was just the thing we said to each other out there. And thus the
              Juice Bros were born.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
