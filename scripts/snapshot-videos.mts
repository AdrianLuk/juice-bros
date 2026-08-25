/**
 * Refreshes the committed fallback snapshot used by /podcast when the live
 * YouTube RSS fetch fails. Run manually / periodically:
 *
 *   node scripts/snapshot-videos.mts
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getLatestVideos } from "../src/lib/youtube.ts";

if (!process.env.YOUTUBE_API_KEY) {
  console.error(
    "YOUTUBE_API_KEY is not set in this shell - refusing to run. " +
      "Without it, getLatestVideos() silently falls back to the existing " +
      "snapshot, which would make this script rewrite the file with its own " +
      "stale contents while reporting success. Export YOUTUBE_API_KEY (see " +
      ".env.example) and try again.",
  );
  process.exit(1);
}

const outPath = fileURLToPath(new URL("../content/videos-fallback.json", import.meta.url));

const videos = await getLatestVideos();

if (videos.length === 0) {
  console.error("Fetched zero videos - leaving existing snapshot untouched.");
  process.exit(1);
}

writeFileSync(outPath, `${JSON.stringify(videos, null, 2)}\n`);
console.log(`Wrote ${videos.length} videos to ${outPath}`);
