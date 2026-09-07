/**
 * The About page's opening.
 *
 * Type-first, and deliberately not a photograph. The incumbent opened on the
 * brand banner, which is now the home page's hero - running it again here would
 * have made a seven-page site look like it owns one image, and it would have
 * spent the About page's first screen on something a visitor arriving from the
 * home page had already seen.
 *
 * The photographs still appear, further down, where they prove something: the
 * first episode plays in the origin story, and the on-court shot of the two of
 * them opens Meet the Bros. Here the h1 is the whole idea, at the page's
 * largest step with room around it.
 *
 * Copy is the published About page's own, unchanged (PRODUCT.md records it as
 * confirmed brand voice, not draft).
 */
export function Hero() {
  return (
    <section className="bx-measure pt-16 pb-14 sm:pt-24 sm:pb-20">
      <h1 className="bx-display max-w-[16ch] text-[clamp(2.5rem,6.4vw,4.25rem)]">
        Two friends who couldn&apos;t stop talking about pickleball
      </h1>
      {/* The body step, like every other standfirst on the site, at a slightly
          wider measure. An earlier pass set this at 20px to make the hero feel
          bigger, which added a type step the ramp doesn't have for the sake of
          one paragraph - the 68px h1 above it is already carrying the hero. */}
      <p className="bx-lead mt-7 max-w-[54ch]">
        So we hit record. Juice Bros is a podcast, a community, and - most days
        - a group chat that got a little out of hand. All for the everyday
        player who just wants to feel like they&apos;re part of something.
      </p>
    </section>
  );
}
