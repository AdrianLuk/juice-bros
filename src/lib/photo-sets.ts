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
  /** The address of the section it is in: its set's, or the Loose Photos'. */
  sectionAddress: string;
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

/** The closing section of Photos that belong to no set. No date or venue. */
export type LoosePhotosView = {
  address: typeof LOOSE_PHOTOS_ADDRESS;
  photos: GalleryPhoto[];
};

export type Gallery = {
  /** Newest first by last day. */
  sets: PhotoSetView[];
  /** After the sets, in written order, which is newest first because new ones
   *  are added at the top. Null when there are none, so the page renders no
   *  heading over an empty block. */
  loose: LoosePhotosView | null;
  /** Every photo on the page, in the order it appears. */
  photos: GalleryPhoto[];
};

/** The Loose Photos section's address. A set's address always ends in a
 *  year, so the two can't collide. */
export const LOOSE_PHOTOS_ADDRESS = "loose-photos";

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
 * (sets that end on the same day keep their written order), then the Loose
 * Photos in written order, and one flat list of every photo in on-page order.
 */
export function buildGallery(
  sets: readonly PhotoSet[],
  loosePhotos: readonly Photo[] = [],
): Gallery {
  const ordered = [...sets].sort((a, b) =>
    appearanceEndDate(b).localeCompare(appearanceEndDate(a)),
  );

  const photos: GalleryPhoto[] = [];
  const place = (photo: Photo, sectionAddress: string): GalleryPhoto => {
    const galleryPhoto: GalleryPhoto = { ...photo, index: photos.length, sectionAddress };
    photos.push(galleryPhoto);
    return galleryPhoto;
  };

  const views = ordered.map((set): PhotoSetView => {
    const address = photoSetAddress(set);
    const setPhotos = set.photos.map((photo) => place(photo, address));

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

  const loose: LoosePhotosView | null =
    loosePhotos.length > 0
      ? {
          address: LOOSE_PHOTOS_ADDRESS,
          photos: loosePhotos.map((photo) => place(photo, LOOSE_PHOTOS_ADDRESS)),
        }
      : null;

  return { sets: views, loose, photos };
}

/**
 * The sets the Appearances page previews: those tied to no Appearance (an
 * occasion the hosts attended rather than played, like Creator Night), newest
 * first, each cut to its first five photos. A set with an Appearance gets
 * "See photos" on that Appearance's row instead.
 */
export function setsToPreview(sets: readonly PhotoSet[]): PhotoSetView[] {
  // Built from the whole gallery and then filtered, not the other way round,
  // so each previewed photo keeps its index in the /photos order.
  return buildGallery(sets)
    .sets.filter((set) => !set.appearance)
    .map((set) => ({ ...set, photos: previewPhotos(set) }));
}
