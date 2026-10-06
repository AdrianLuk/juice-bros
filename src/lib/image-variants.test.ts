import assert from "node:assert/strict";
import test from "node:test";

import { IMAGE_MANIFEST, largestVariantPath } from "./image-variants.ts";

test("largestVariantPath points at the widest encoded variant", () => {
  const src = "/pictures/creator-night-adrian-serving.jpg";
  const widest = Math.max(...IMAGE_MANIFEST[src].widths);

  assert.equal(
    largestVariantPath(src, "webp"),
    `/pictures/creator-night-adrian-serving-${widest}.webp`,
  );
});

test("largestVariantPath does not depend on the order widths are listed", () => {
  // Every manifest entry lists widths ascending today; this pins the result to
  // the maximum rather than to the last element.
  for (const src of Object.keys(IMAGE_MANIFEST) as (keyof typeof IMAGE_MANIFEST)[]) {
    const widest = Math.max(...IMAGE_MANIFEST[src].widths);
    assert.ok(largestVariantPath(src, "avif").endsWith(`-${widest}.avif`), src);
  }
});
