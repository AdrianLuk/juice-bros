const FALLBACK_IMAGE = "/brand/JB_Logo_White.svg";

/**
 * A tournament's cover art.
 *
 * Real tournament art is a sponsor logo lockup drawn for print - dark type,
 * often on a transparent background - so on a near-black ground a plain
 * `<img>` renders as an empty rectangle. It goes on the same white
 * `.bx-plate` the gear photographs use, for the same reason: this is somebody
 * else's mark and the honest way to show it is on the ground it was drawn for.
 *
 * An entry with no art falls back to the Juice Bros logo, which *is* drawn for
 * dark, so that case skips the plate and sits on the raised fill instead.
 */
export function AppearanceArt({
  image,
  className = "",
}: {
  image?: string;
  className?: string;
}) {
  const hasArt = Boolean(image);

  return (
    <div className={`bx-tile ${hasArt ? "bx-plate" : "grid place-items-center"} ${className}`}>
      {/* Decorative: the tournament's name is the heading beside it. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- local asset, no next/image optimization needed */}
      <img
        src={image ?? FALLBACK_IMAGE}
        alt=""
        loading="lazy"
        decoding="async"
        className={hasArt ? undefined : "size-2/3 object-contain opacity-90"}
      />
    </div>
  );
}
