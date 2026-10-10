/**
 * Renders the Play teaser's still from the Rally game's own figures, so the
 * teaser on Home and About matches the game. Rerun it whenever the hosts'
 * models, faces or kit change:
 *
 *   npm run dev                       # in another terminal
 *   npm run render:play-teaser        # or: -- http://localhost:3001
 *   npm run optimize:images
 *
 * It opens the development-only page at /play/still, which draws the scene,
 * and writes the master image to public/play/teaser.jpg and the ball's flight
 * (in the image's pixels) to src/components/bx/play-teaser-flight.json.
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const root = join(fileURLToPath(import.meta.url), "../..");
const base = process.argv[2] ?? "http://localhost:3000";

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => console.error(error));
  await page.goto(`${base}/play/still`);
  await page.waitForSelector("[data-ready]", { timeout: 60_000 });
  const { image, flight } = await page.evaluate(
    () => (window as unknown as { __playStill: { image: string; flight: unknown } }).__playStill,
  );
  const png = Buffer.from(image.split(",")[1], "base64");
  await sharp(png).jpeg({ quality: 90, mozjpeg: true }).toFile(join(root, "public/play/teaser.jpg"));
  await writeFile(join(root, "src/components/bx/play-teaser-flight.json"), JSON.stringify(flight, null, 2) + "\n");
  console.log("Wrote public/play/teaser.jpg and src/components/bx/play-teaser-flight.json", flight);
} finally {
  await browser.close();
}
