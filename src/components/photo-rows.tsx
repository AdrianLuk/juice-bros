import type { CSSProperties } from "react";

import type { GalleryPhoto, Photo } from "@/lib/photo-sets";
import { IMAGE_MANIFEST, imageRatio, isManagedImage, largestVariantPath } from "@/lib/image-variants";
import { Picture } from "@/components/picture";

/**
 * How many tiles fit on the first line at `lg`, where the measure is 68rem
 * and the row height 16rem (see `.bx-rows`). In row heights, so it is a sum
 * of aspect ratios: a line holds tiles until their ratios add up past this.
 * A phone's first line is shorter, so there a tile or two past it also loads
 * eagerly, which is the cheap side to be wrong on.
 */
const FIRST_LINE_CAPACITY = 68 / 16;
/** The row gap at `lg` (1rem), in row heights. */
const GAP = 1 / 16;

function shapeOf(src: string) {
  return { ratio: imageRatio(src), width: isManagedImage(src) ? IMAGE_MANIFEST[src].width : 1600 };
}

/** How many photos land on the first line at `lg`. Always at least one. */
function firstLineLength(ratios: readonly number[]): number {
  let used = 0;
  for (const [i, ratio] of ratios.entries()) {
    used += ratio + (i > 0 ? GAP : 0);
    if (used > FIRST_LINE_CAPACITY) return Math.max(i, 1);
  }
  return ratios.length;
}

/** Rounded to a tenth of a rem so `sizes` stays readable in the markup. */
const rem = (n: number) => `${Math.round(n * 10) / 10}rem`;

/**
 * Photos in rows that fill the width at their true shape, never cropped. The
 * layout is all CSS (`.bx-rows` in globals.css); this only hands each tile
 * its aspect ratio and size cap from the image manifest.
 *
 * Used by the Photos page for every Photo Set, and meant for any preview of a
 * set elsewhere, so a photo looks the same wherever it shows up.
 *
 * `eager` loads the first line up front and gives its first photo fetch
 * priority, for the rows at the top of a page. Everything else is lazy.
 *
 * `linked` makes every tile a real link to the photo's large file, carrying
 * its place in the page's photo order. `PhotoLightbox` turns those clicks
 * into its viewer; without scripts they still open the photo on its own.
 */
export function PhotoRows({
  photos,
  eager = false,
  linked = false,
  className = "",
}: {
  photos: readonly (Photo | GalleryPhoto)[];
  eager?: boolean;
  linked?: boolean;
  className?: string;
}) {
  const shapes = photos.map((photo) => shapeOf(photo.src));
  const eagerCount = eager ? firstLineLength(shapes.map((shape) => shape.ratio)) : 0;

  return (
    <ul role="list" className={`bx-rows ${className}`}>
      {photos.map((photo, i) => {
        const { ratio, width } = shapes[i];
        const style = { "--ar": ratio, "--max-w": `${width / 2}px` } as CSSProperties;
        // The tile's width is roughly its ratio times the row height it
        // settles at, which runs a little over the base `--row-h`. A lone
        // wide photo on a phone takes the full column.
        const sizes = [
          `(min-width: 1024px) ${rem(Math.min(ratio * 22, 68))}`,
          `(min-width: 640px) ${rem(ratio * 15)}`,
          `min(${rem(ratio * 14)}, 100vw)`,
        ].join(", ");

        const picture = (
          <Picture
            src={photo.src}
            alt={photo.alt}
            sizes={sizes}
            loading={i < eagerCount ? "eager" : "lazy"}
            fetchPriority={eager && i === 0 ? "high" : undefined}
          />
        );

        return (
          <li key={photo.src} className="bx-tile" style={style}>
            {linked ? (
              <a
                href={isManagedImage(photo.src) ? largestVariantPath(photo.src, "webp") : photo.src}
                // Only a gallery photo knows its place in the page's order. A
                // plain Photo gets no index, so the lightbox leaves its link
                // alone rather than opening the wrong photo.
                data-photo-index={"index" in photo ? photo.index : undefined}
                className="bx-tile-link"
              >
                {picture}
              </a>
            ) : (
              picture
            )}
          </li>
        );
      })}
    </ul>
  );
}
