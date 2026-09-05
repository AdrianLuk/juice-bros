import { chromium } from "@playwright/test";
import fs from "node:fs";

const OUT = process.argv[2];
const BASE = "http://localhost:3000";
const routes = [
  ["home", "/"],
  ["podcast", "/podcast"],
  ["gear", "/gear"],
  ["about", "/about"],
  ["contact", "/contact"],
];
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const [vp, w, h] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  for (const [name, path] of routes) {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(1800);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${name}-${vp}.png`, fullPage: true });
    console.log("shot", name, vp);
  }
  await ctx.close();
}
await browser.close();
