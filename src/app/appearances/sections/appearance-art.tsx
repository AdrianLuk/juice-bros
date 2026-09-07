import { Picture } from "@/components/picture";

/**
 * A tournament's cover art, when there is any.
 *
 * Real tournament art is a sponsor logo lockup drawn for print - dark type,
 * often on a transparent background - so on a near-black ground a plain
 * `<img>` renders as an empty rectangle. It goes on the same white
 * `.bx-plate` the gear photographs use, for the same reason: this is somebody
 * else's mark and the honest way to show it is on the ground it was drawn for.
 *
 * An entry with no art renders **nothing**, and its row goes title-led. The
 * earlier fallback drew the Juice Bros logo instead, which made the largest
 * element of the row say nothing about the event and turned every art-less
 * entry into a visual twin of the next one.
 */
export function AppearanceArt({
  image,
  className = "",
}: {
  image?: string;
  className?: string;
}) {
  if (!image) return null;

  return (
    <div className={`bx-tile bx-plate ${className}`}>
      {/* `Picture` (#418) serves the 384w AVIF/WebP variants encoded for these
          three files; its `display: contents` keeps the `<img>` as
          `.bx-plate`'s direct child so the contain-and-pad rule still applies.
          `sizes` is wider than the incumbent's 8rem row thumbnail because this
          layout gives the art a 10rem column, and the full width of the band on
          the featured entry. Decorative: the tournament's name is the heading
          beside it. */}
      <Picture
        src={image}
        alt=""
        sizes="(min-width: 1024px) 22rem, (min-width: 640px) 10rem, 100vw"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
