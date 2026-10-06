import type { Photo, PhotoSet } from "../../content/photo-sets.ts";
import {
  appearanceEndDate,
  appearanceStartDate,
  formatAppearanceDates,
} from "./appearances.ts";

export type { Photo, PhotoSet } from "../../content/photo-sets.ts";

/** A Photo as the page shows it: where it sits in the gallery as a whole. */
export type GalleryPhoto = Photo & {
  /** Position in `Gallery.photos`, the on-page order a lightbox walks. */
  index: number;
  /** The section address of the set it belongs to. */
  setAddress: string;
};

/** A Photo Set as the page shows it. */
export type PhotoSetView = {
  /** Section address: the set's element id, and the hash that links to it. */
  address: string;
  title: string;
  /** "Sep 29, 2026", or "Sep 16-20, 2026" for a range. */
  dates: string;
  venue: string;
  note: string;
  appearance?: string;
  photos: GalleryPhoto[];
};

export type Gallery = {
  /** Newest first by last day. */
  sets: PhotoSetView[];
  /** Every photo on the page, in the order it appears. */
  photos: GalleryPhoto[];
};

/** How many photos a set shows where it is previewed outside the gallery. */
export const PREVIEW_COUNT = 5;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The set's section address, e.g. "creator-night-at-the-backyard-club-2026".
 *
 * Built from the title and the year it started, so it stays the same however
 * many sets are added around it, and an occasion that comes round every year
 * gets a new address each time rather than colliding with last year's.
 */
export function photoSetAddress(set: PhotoSet): string {
  return `${slugify(set.title)}-${appearanceStartDate(set).slice(0, 4)}`;
}

/** Where a set lives on the Photos page, e.g. "/photos#the-admiral-cup-2026". */
export function photoSetHref(set: PhotoSet): string {
  return `/photos#${photoSetAddress(set)}`;
}

/** The set that points at the Appearance with this name, if there is one. */
export function photoSetFor(
  sets: readonly PhotoSet[],
  appearanceName: string,
): PhotoSet | undefined {
  return sets.find((set) => set.appearance === appearanceName);
}

/**
 * Appearance name to its set's link on the Photos page, for the Appearances
 * that have a set. The Appearances page gives those rows "See photos".
 */
export function photoSetHrefsByAppearance(
  sets: readonly PhotoSet[],
  appearances: readonly { name: string }[],
): Record<string, string> {
  const hrefs: Record<string, string> = {};
  for (const { name } of appearances) {
    const set = photoSetFor(sets, name);
    if (set) hrefs[name] = photoSetHref(set);
  }
  return hrefs;
}

/** The first five photos of a set, or all of them if it has fewer. */
export function previewPhotos<P>(set: { photos: readonly P[] }): P[] {
  return set.photos.slice(0, PREVIEW_COUNT);
}

/**
 * The display model for the Photos page: sets newest first by their last day
 * (sets that end on the same day keep their written order), and one flat list
 * of every photo in on-page order.
 */
export function buildGallery(sets: readonly PhotoSet[]): Gallery {
  const ordered = [...sets].sort((a, b) =>
    appearanceEndDate(b).localeCompare(appearanceEndDate(a)),
  );

  const photos: GalleryPhoto[] = [];
  const views = ordered.map((set): PhotoSetView => {
    const address = photoSetAddress(set);
    const setPhotos = set.photos.map((photo) => {
      const galleryPhoto: GalleryPhoto = { ...photo, index: photos.length, setAddress: address };
      photos.push(galleryPhoto);
      return galleryPhoto;
    });

    return {
      address,
      title: set.title,
      dates: formatAppearanceDates(set),
      venue: set.venue,
      note: set.note,
      appearance: set.appearance,
      photos: setPhotos,
    };
  });

  return { sets: views, photos };
}
