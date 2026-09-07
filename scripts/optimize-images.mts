/**
 * Encodes the responsive AVIF + WebP variants declared in
 * `src/lib/image-variants.ts` and writes them next to their masters in
 * `public/`. Run after adding or replacing any image in the manifest:
 *
 *   npm run optimize:images          # only what is missing or stale
 *   npm run optimize:images -- --force   # re-encode everything
 *
 * The outputs are committed. This is a one-off authoring tool, not a build
 * step: the site serves plain static files and never optimizes at request
 * time, so nothing here runs on Vercel.
 *
 * Masters are never modified or deleted - every variant is a new file. That
 * keeps the script idempotent, which an in-place re-encode would not be
 * (each run would lossily recompress its own previous output).
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import {
  IMAGE_MANIFEST,
  VARIANT_FORMATS,
  variantPath,
  type VariantFormat,
} from "../src/lib/image-variants.ts";

const publicDir = fileURLToPath(new URL("../public", import.meta.url));
const force = process.argv.includes("--force");

/** Public path (`/brand/x.jpeg`) to an on-disk path under `public/`. */
function toDiskPath(publicPath: string): string {
  return join(publicDir, publicPath.replace(/^\//, ""));
}

async function mtimeOrNull(path: string): Promise<number | null> {
  try {
    return (await stat(path)).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * `effort` is pinned high on both encoders. It only costs encode time, which
 * is spent once here rather than by every visitor, and it is worth a few
 * percent on every file.
 */
function encode(pipeline: sharp.Sharp, format: VariantFormat, quality: number) {
  return format === "avif"
    ? pipeline.avif({ quality, effort: 6 })
    : pipeline.webp({ quality, effort: 6 });
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} kB`;

let written = 0;
let skipped = 0;
let bytesOut = 0;

for (const [publicPath, spec] of Object.entries(IMAGE_MANIFEST)) {
  const masterPath = toDiskPath(publicPath);
  const masterMtime = await mtimeOrNull(masterPath);

  if (masterMtime === null) {
    console.error(`  MISSING master: ${publicPath} - listed in the manifest but not on disk`);
    process.exitCode = 1;
    continue;
  }

  const masterBytes = (await stat(masterPath)).size;
  console.log(`${publicPath}  (${kb(masterBytes)} master)`);

  for (const width of spec.widths) {
    for (const format of VARIANT_FORMATS) {
      const outPublicPath = variantPath(publicPath, width, format);
      const outPath = toDiskPath(outPublicPath);
      const outMtime = await mtimeOrNull(outPath);

      // Stale means "older than its master". Quality changes in the manifest
      // do not move the master's mtime, so use --force after retuning one.
      if (!force && outMtime !== null && outMtime >= masterMtime) {
        skipped += 1;
        bytesOut += (await stat(outPath)).size;
        continue;
      }

      const buffer = await encode(
        sharp(masterPath).resize({ width, withoutEnlargement: true }),
        format,
        spec.quality[format],
      ).toBuffer();

      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, buffer);

      written += 1;
      bytesOut += buffer.length;
      console.log(`  wrote ${outPublicPath.padEnd(46)} ${kb(buffer.length).padStart(8)}`);
    }
  }
}

console.log(
  `\n${written} written, ${skipped} already current. ` +
    `Variants on disk total ${kb(bytesOut)}.`,
);
