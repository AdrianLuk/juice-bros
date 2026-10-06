import assert from "node:assert/strict";
import test from "node:test";

import type { Photo, PhotoSet } from "../../content/photo-sets.ts";
import {
  LOOSE_PHOTOS_ADDRESS,
  buildGallery,
  photoSetAddress,
  photoSetFor,
  photoSetHref,
  photoSetHrefsByAppearance,
  previewPhotos,
} from "./photo-sets.ts";

function photos(prefix: string, count: number): Photo[] {
  return Array.from({ length: count }, (_, i) => ({
    src: `/pictures/${prefix}-${i + 1}.jpg`,
    alt: `${prefix} photo ${i + 1}`,
  }));
}

function make(overrides: Partial<PhotoSet> = {}): PhotoSet {
  return {
    title: "Test Night",
    date: "2026-09-01",
    venue: "Somewhere, ON",
    note: "One plain line.",
    photos: photos("test", 2),
    ...overrides,
  };
}

test("buildGallery orders sets newest first by their end date", () => {
  const older = make({ title: "Older", date: "2026-08-01" });
  const newer = make({ title: "Newer", date: "2026-09-29" });
  // Starts before Newer but ends after it, so it is the newest occasion.
  const range = make({
    title: "Range",
    date: undefined,
    startDate: "2026-09-27",
    endDate: "2026-10-02",
  });

  const { sets } = buildGallery([older, newer, range]);

  assert.deepEqual(
    sets.map((set) => set.title),
    ["Range", "Newer", "Older"],
  );
});

test("buildGallery keeps written order for sets that end on the same day", () => {
  const first = make({ title: "First", date: "2026-09-01" });
  const second = make({ title: "Second", date: "2026-09-01" });

  const { sets } = buildGallery([first, second]);

  assert.deepEqual(
    sets.map((set) => set.title),
    ["First", "Second"],
  );
});

test("buildGallery formats a single day and a range for the meta line", () => {
  const day = make({ title: "Day", date: "2026-09-29" });
  const range = make({
    title: "Range",
    date: undefined,
    startDate: "2026-09-16",
    endDate: "2026-09-20",
  });

  const { sets } = buildGallery([day, range]);

  assert.equal(sets.find((set) => set.title === "Day")?.dates, "Sep 29, 2026");
  assert.equal(sets.find((set) => set.title === "Range")?.dates, "Sep 16-20, 2026");
});

test("buildGallery flattens every photo into on-page order across sets", () => {
  const older = make({ title: "Older", date: "2026-08-01", photos: photos("older", 2) });
  const newer = make({ title: "Newer", date: "2026-09-29", photos: photos("newer", 3) });

  const gallery = buildGallery([older, newer]);

  assert.deepEqual(
    gallery.photos.map((photo) => photo.src),
    [
      "/pictures/newer-1.jpg",
      "/pictures/newer-2.jpg",
      "/pictures/newer-3.jpg",
      "/pictures/older-1.jpg",
      "/pictures/older-2.jpg",
    ],
  );
  assert.deepEqual(
    gallery.photos.map((photo) => photo.index),
    [0, 1, 2, 3, 4],
  );
});

test("a set's photos carry the same position as in the flat list", () => {
  const older = make({ title: "Older", date: "2026-08-01", photos: photos("older", 2) });
  const newer = make({ title: "Newer", date: "2026-09-29", photos: photos("newer", 3) });

  const gallery = buildGallery([older, newer]);

  for (const set of gallery.sets) {
    for (const photo of set.photos) {
      assert.equal(gallery.photos[photo.index], photo);
      assert.equal(photo.sectionAddress, set.address);
    }
  }
});

test("previewPhotos returns the first five photos of a set, in order", () => {
  const set = make({ photos: photos("big", 7) });

  assert.deepEqual(
    previewPhotos(set).map((photo) => photo.src),
    [1, 2, 3, 4, 5].map((n) => `/pictures/big-${n}.jpg`),
  );
});

test("previewPhotos returns every photo when a set has fewer than five", () => {
  const set = make({ photos: photos("small", 3) });

  assert.deepEqual(previewPhotos(set), set.photos);
});

test("photoSetAddress is the title as a slug plus the year", () => {
  assert.equal(
    photoSetAddress(make({ title: "Creator Night at The Backyard Club", date: "2026-09-29" })),
    "creator-night-at-the-backyard-club-2026",
  );
  assert.equal(
    photoSetAddress(
      make({ title: "The Admiral Cup!", date: undefined, startDate: "2026-09-16", endDate: "2026-09-20" }),
    ),
    "the-admiral-cup-2026",
  );
});

test("photoSetAddress tells the same occasion apart across years", () => {
  const thisYear = make({ title: "The Admiral Cup", date: "2026-09-16" });
  const nextYear = make({ title: "The Admiral Cup", date: "2027-09-15" });

  assert.notEqual(photoSetAddress(thisYear), photoSetAddress(nextYear));
});

test("sets with different titles in the same year get different addresses", () => {
  const sets = [
    make({ title: "Creator Night", date: "2026-09-29" }),
    make({ title: "The Admiral Cup", date: undefined, startDate: "2026-09-16", endDate: "2026-09-20" }),
    make({ title: "Vaughan Fall Open", date: "2026-10-04" }),
  ];

  const addresses = buildGallery(sets).sets.map((set) => set.address);

  assert.equal(new Set(addresses).size, sets.length);
});

test("buildGallery gives every set its section address", () => {
  const set = make({ title: "Creator Night", date: "2026-09-29" });

  const { sets } = buildGallery([set]);

  assert.equal(sets[0].address, photoSetAddress(set));
});

test("photoSetFor finds the set that points at an Appearance", () => {
  const cup = make({ title: "The Admiral Cup", appearance: "APA - The Admiral Cup" });
  const night = make({ title: "Creator Night" });

  assert.equal(photoSetFor([night, cup], "APA - The Admiral Cup"), cup);
});

test("photoSetFor finds nothing for an Appearance with no set", () => {
  const night = make({ title: "Creator Night" });

  assert.equal(photoSetFor([night], "Some Other Open"), undefined);
});

test("photoSetHref links to the set's section on the Photos page", () => {
  const cup = make({ title: "The Admiral Cup", date: undefined, startDate: "2026-09-16", endDate: "2026-09-20" });

  assert.equal(photoSetHref(cup), "/photos#the-admiral-cup-2026");
});

test("photoSetHrefsByAppearance maps only the Appearances that have a set", () => {
  const cup = make({
    title: "The Admiral Cup",
    date: undefined,
    startDate: "2026-09-16",
    endDate: "2026-09-20",
    appearance: "APA - The Admiral Cup",
  });
  const night = make({ title: "Creator Night" });

  const hrefs = photoSetHrefsByAppearance(
    [cup, night],
    [{ name: "APA - The Admiral Cup" }, { name: "Some Other Open" }],
  );

  assert.deepEqual(hrefs, { "APA - The Admiral Cup": "/photos#the-admiral-cup-2026" });
});

test("Loose Photos come after every set, in written order (newest is written first)", () => {
  const night = make({ title: "Night", date: "2026-09-29", photos: photos("night", 2) });
  const loose = photos("loose", 3);
  const expected = ["/pictures/loose-1.jpg", "/pictures/loose-2.jpg", "/pictures/loose-3.jpg"];

  const gallery = buildGallery([night], loose);

  assert.deepEqual(gallery.loose?.photos.map((photo) => photo.src), expected);
  assert.deepEqual(gallery.photos.map((photo) => photo.src).slice(-3), expected);
});

test("Loose Photos carry their place in the flat list and their own section", () => {
  const night = make({ title: "Night", date: "2026-09-29", photos: photos("night", 2) });

  const gallery = buildGallery([night], photos("loose", 2));

  assert.equal(gallery.loose?.address, LOOSE_PHOTOS_ADDRESS);
  for (const photo of gallery.loose?.photos ?? []) {
    assert.equal(gallery.photos[photo.index], photo);
    assert.equal(photo.sectionAddress, LOOSE_PHOTOS_ADDRESS);
  }
  assert.deepEqual(
    gallery.loose?.photos.map((photo) => photo.index),
    [2, 3],
  );
});

test("with no Loose Photos there is no Loose Photos section", () => {
  const night = make({ title: "Night" });

  assert.equal(buildGallery([night], []).loose, null);
  assert.equal(buildGallery([night]).loose, null);
});

test("the Loose Photos address can't collide with a set's", () => {
  const set = make({ title: "Loose Photos", date: "2026-09-01" });

  assert.notEqual(photoSetAddress(set), LOOSE_PHOTOS_ADDRESS);
});
