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
      {/* Decorative: the tournament's name is the heading beside it. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- local asset, no next/image optimization needed */}
      <img src={image} alt="" loading="lazy" decoding="async" />
    </div>
  );
}
