import type { ComponentPropsWithoutRef } from "react";

import {
  IMAGE_MANIFEST,
  VARIANT_FORMATS,
  isManagedImage,
  variantSrcSet,
} from "@/lib/image-variants";

const MIME: Record<(typeof VARIANT_FORMATS)[number], string> = {
  avif: "image/avif",
  webp: "image/webp",
};

type PictureProps = Omit<ComponentPropsWithoutRef<"img">, "src" | "srcSet"> & {
  /**
   * Public path of the master image. When it appears in `IMAGE_MANIFEST` this
   * renders AVIF and WebP `<source>`s ahead of it; when it does not - an SVG,
   * or a path with no variants encoded yet - it degrades to a plain `<img>`
   * with no sources, which is exactly right for both cases.
   */
  src: string;
  alt: string;
  /** Required: without it the browser assumes 100vw and over-fetches. */
  sizes?: string;
};

/**
 * A plain `<img>` plus the pre-encoded AVIF/WebP `<source>`s declared for it in
 * `src/lib/image-variants.ts`.
 *
 * The `<picture>` carries `display: contents`, so the `<img>` participates in
 * the parent's layout as if it were still a direct child. That keeps existing
 * CSS written against a bare `<img>` - `.bx-tile img { object-fit: cover }`,
 * for one - working untouched, which is what makes this a drop-in replacement
 * rather than a layout migration.
 *
 * Intrinsic `width`/`height` come from the manifest unless the caller passes
 * its own, so every instance reserves the right aspect ratio and none of them
 * contribute layout shift.
 */
export function Picture({ src, alt, sizes, width, height, ...imgProps }: PictureProps) {
  // Narrow `src` itself, not just the lookup - the callback below needs the
  // narrowed literal type to index the manifest.
  const managed = isManagedImage(src) ? src : null;
  const spec = managed && IMAGE_MANIFEST[managed];

  return (
    <picture className="contents">
      {managed &&
        VARIANT_FORMATS.map((format) => (
          <source
            key={format}
            type={MIME[format]}
            srcSet={variantSrcSet(managed, format)}
            sizes={sizes}
          />
        ))}
      <img
        src={src}
        alt={alt}
        sizes={sizes}
        width={width ?? spec?.width}
        height={height ?? spec?.height}
        decoding="async"
        {...imgProps}
      />
    </picture>
  );
}
