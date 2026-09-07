/**
 * Why the show exists, on the page's one band and at its one peak heading.
 *
 * This is the page's rank-one section - the sentence the whole About page is
 * built to earn - so it takes all three channels at once: the lighter ground,
 * the peak type step, and the most vertical air on the page.
 *
 * Centred, and the only centred passage here. The mission is a statement made
 * to a room; everything around it is the two of them talking, which is set
 * left like the rest of the site.
 *
 * Copy unchanged from the published About page.
 */
export function Mission() {
  return (
    <section className="bx-band">
      <div className="bx-measure py-20 sm:py-28 lg:py-32">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <h2 className="bx-h2 max-w-[20ch] text-[clamp(1.75rem,3.4vw,2.125rem)]">
            To create the most relatable pickleball conversations on the
            internet.
          </h2>
          <div className="mt-7 flex flex-col gap-5 text-[1.0625rem] leading-relaxed text-[var(--bx-muted)]">
            <p>
              We&apos;re not here to fix your third shot drop or rank the best
              paddles. There are plenty of people already doing that, and doing
              it better than we would.
            </p>
            <p>
              We&apos;re here for everything else: the psychology, the
              friendships, the rivalry that started over one bad line call, the
              pre-tournament nerves, the post-tournament food. The stuff that
              happens before, during, and after every game, the stuff that
              actually makes this sport what it is.
            </p>
            <p className="font-medium text-[var(--bx-ink)]">
              If pickleball content has ever felt like it was made for someone
              way more serious than you, this is the show that isn&apos;t.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
