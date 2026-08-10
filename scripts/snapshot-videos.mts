/**
 * Refreshes the committed fallback snapshot used by /podcast when the live
 * YouTube RSS fetch fails. Run manually / periodically:
 *
 *   node scripts/snapshot-videos.mts
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getLatestVideos } from "../src/lib/youtube.ts";

const outPath = fileURLToPath(new URL("../content/videos-fallback.json", import.meta.url));

const videos = await getLatestVideos();

if (videos.length === 0) {
  console.error("Fetched zero videos - leaving existing snapshot untouched.");
  process.exit(1);
}

writeFileSync(outPath, `${JSON.stringify(videos, null, 2)}\n`);
console.log(`Wrote ${videos.length} videos to ${outPath}`);
