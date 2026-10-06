import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { appearances } from "../../content/appearances.ts";
import { loosePhotos, photoSets } from "../../content/photo-sets.ts";
import { IMAGE_MANIFEST, VARIANT_FORMATS, variantPath } from "./image-variants.ts";
import { buildGallery } from "./photo-sets.ts";

// These run against the real, hand-edited content, so a typo in a path or a
// forgotten alt text fails here rather than shipping as a broken tile.

const publicFile = (path: string) =>
  fileURLToPath(new URL(`../../public${path}`, import.meta.url));

// Every Photo on the page, set photos and Loose Photos alike, with where it
// lives for the failure message.
const allPhotos = [
  ...photoSets.flatMap((set) => set.photos.map((photo) => ({ where: `"${set.title}"`, photo }))),
  ...loosePhotos.map((photo) => ({ where: "Loose Photos", photo })),
];

test("every Photo Set has at least one photo", () => {
  for (const set of photoSets) {
    assert.ok(set.photos.length > 0, `"${set.title}" has no photos`);
  }
});

test("every photo has alt text", () => {
  for (const { where, photo } of allPhotos) {
    assert.ok(photo.alt.trim().length > 0, `${photo.src} in ${where} has no alt text`);
  }
});

test("every photo's file exists", () => {
  for (const { photo } of allPhotos) {
    assert.ok(existsSync(publicFile(photo.src)), `${photo.src} is not in public/`);
  }
});

test("every photo is registered for optimisation and its variants are encoded", () => {
  for (const { photo } of allPhotos) {
    assert.ok(photo.src in IMAGE_MANIFEST, `${photo.src} is missing from IMAGE_MANIFEST`);
    const spec = IMAGE_MANIFEST[photo.src as keyof typeof IMAGE_MANIFEST];
    for (const width of spec.widths) {
      for (const format of VARIANT_FORMATS) {
        const variant = variantPath(photo.src, width, format);
        assert.ok(
          existsSync(publicFile(variant)),
          `${variant} is not encoded; run npm run optimize:images`,
        );
      }
    }
  }
});

test("no photo appears twice", () => {
  const srcs = allPhotos.map(({ photo }) => photo.src);
  assert.equal(new Set(srcs).size, srcs.length);
});

test("section addresses are unique", () => {
  const gallery = buildGallery(photoSets, loosePhotos);
  const addresses = [...gallery.sets.map((set) => set.address), gallery.loose?.address].filter(Boolean);
  assert.equal(new Set(addresses).size, addresses.length);
});

test("every set's dates are a single day or a full range", () => {
  for (const set of photoSets) {
    const single = Boolean(set.date) && !set.startDate && !set.endDate;
    const range = !set.date && Boolean(set.startDate) && Boolean(set.endDate);
    assert.ok(single || range, `"${set.title}" needs a date, or a startDate and endDate`);
  }
});

test("a set that points at an Appearance names one that exists", () => {
  const names = new Set(appearances.map((appearance) => appearance.name));
  for (const set of photoSets) {
    if (set.appearance === undefined) continue;
    assert.ok(names.has(set.appearance), `"${set.title}" points at unknown Appearance "${set.appearance}"`);
  }
});

test("no Appearance has more than one set pointing at it", () => {
  const pointers = photoSets.flatMap((set) => (set.appearance ? [set.appearance] : []));
  assert.equal(new Set(pointers).size, pointers.length);
});
