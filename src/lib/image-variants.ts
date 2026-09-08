/**
 * The one table describing every pre-compressed image variant on the site.
 *
 * `scripts/optimize-images.mts` reads it to decide what to encode; the
 * `<Picture>` component reads it to build the matching `srcSet`. They share it
 * on purpose: a width the component advertises but the script never wrote is a
 * 404 behind a `<source>`, and the browser silently falls back to the original
 * JPEG instead of telling you the fast path is dead. One table makes that
 * mismatch impossible.
 *
 * Deliberately not `next/image`: these are a handful of assets that change
 * maybe twice a year, so encoding them once at commit time is both cheaper
 * (no Vercel transformation quota) and more predictable than optimizing them
 * per-request forever.
 */

/** Emitted in `<source>` order - first match wins, so keep it best-first. */
export const VARIANT_FORMATS = ["avif", "webp"] as const;

export type VariantFormat = (typeof VARIANT_FORMATS)[number];

export type ImageSource = {
  /** Intrinsic width of the master file, for the `<img>` width attribute. */
  width: number;
  /** Intrinsic height of the master file, for the `<img>` height attribute. */
  height: number;
  /**
   * Widths to emit, ascending. Pick these from the largest box the image can
   * actually occupy times the DPR worth serving - not from the master's size.
   */
  widths: readonly number[];
  /**
   * Encoder quality per format. Tuned per image rather than globally: a busy
   * photograph and a flat tournament flyer fall apart at very different
   * points on the quality curve.
   */
  quality: Record<VariantFormat, number>;
};

/**
 * Keyed by the master image's public path.
 *
 * The banner's WebP quality is 68 because that is what the existing committed
 * `JB_Banner-*.webp` files were encoded at - anything higher makes them bigger
 * than they already are. That photo is close to WebP's limit; AVIF is where
 * the remaining gain is.
 *
 * `brand/JB_Logo_whitebg.jpeg` is deliberately absent despite being 181 kB. No
 * page ever loads it - it exists only as the schema.org Organization logo URL,
 * so it is worth zero page weight, and that is the one image whose format
 * Google is picky about. Not worth changing for no visitor-facing gain.
 */
export const IMAGE_MANIFEST = {
  "/pictures/adrian-dav.jpg": {
    width: 2048,
    height: 1365,
    // 800 covers the ~416px Home column at 2x; 1600 covers the About page's
    // max-w-3xl figure at 2x.
    widths: [800, 1200, 1600],
    quality: { avif: 50, webp: 68 },
  },
  "/brand/JB_Banner.jpeg": {
    width: 1600,
    height: 900,
    widths: [768, 1280, 1600],
    quality: { avif: 54, webp: 68 },
  },
  "/appearances/apa-admiral-cup-2026.png": {
    width: 600,
    height: 315,
    // 384 covers the 10rem row thumbnail to 2.4x. 600 - the master's own width,
    // so there is nothing beyond it to gain - is for the Appearances band,
    // where the next confirmed tournament runs its art at 22rem. 384 there is
    // 1.09x and visibly soft on a 2x screen, which is the same failure #416
    // fixed on the episode hero.
    widths: [384, 600],
    quality: { avif: 58, webp: 80 },
  },
  "/appearances/vaughan-fall-open-2026.png": {
    width: 600,
    height: 315,
    widths: [384, 600],
    quality: { avif: 58, webp: 80 },
  },
  "/appearances/ig-nationals-2026.png": {
    width: 600,
    height: 315,
    widths: [384, 600],
    quality: { avif: 58, webp: 80 },
  },
  // The annotated CourtReserve screenshot behind the Facilities page's feed
  // help popover (issue #454). Flat UI with fine text rather than a
  // photograph, so it needs a higher quality than the photos above - AVIF at
  // 50 smears the row labels the red outline is pointing at. Its widest box
  // is the popover's ~19rem image column, so 620 covers a 2x screen with a
  // little room, and 320 is the 1x fallback.
  "/booking-buddy/courtreserve-calendar-feed.jpg": {
    width: 1440,
    height: 2907,
    widths: [320, 620],
    quality: { avif: 62, webp: 80 },
  },
} as const satisfies Record<string, ImageSource>;

export type ManagedImage = keyof typeof IMAGE_MANIFEST;

/** True when `src` has pre-encoded variants, narrowing it for `variantSrcSet`. */
export function isManagedImage(src: string): src is ManagedImage {
  return src in IMAGE_MANIFEST;
}

/**
 * `/pictures/adrian-dav.jpg` + 800 + "webp" -> `/pictures/adrian-dav-800.webp`.
 *
 * Matches the names the hand-built hero variants already used, so the existing
 * `JB_Banner-768/1280/1600.webp` files stay exactly where they are.
 */
export function variantPath(src: string, width: number, format: VariantFormat): string {
  return `${src.replace(/\.[^./]+$/, "")}-${width}.${format}`;
}

/** The `srcSet` for one format, e.g. `"/x-800.webp 800w, /x-1200.webp 1200w"`. */
export function variantSrcSet(src: ManagedImage, format: VariantFormat): string {
  return IMAGE_MANIFEST[src].widths
    .map((width) => `${variantPath(src, width, format)} ${width}w`)
    .join(", ");
}
