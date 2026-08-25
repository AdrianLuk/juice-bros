import assert from "node:assert/strict";
import test from "node:test";

import type { EpisodeOverride } from "../../content/episode-overrides.ts";
import { buildEpisode, isShort, parseIsoDurationSeconds, slugify } from "./episodes.ts";
import type { YoutubeVideo } from "./youtube.ts";

function makeVideo(overrides: Partial<YoutubeVideo> = {}): YoutubeVideo {
  return {
    id: "abc123",
    title: "Why Are We Always Looking for Better Partners? | Juice Bros Pickleball",
    url: "https://www.youtube.com/watch?v=abc123",
    thumbnail: "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
    description: "Raw YouTube description.",
    published: "2026-07-21T23:30:36Z",
    duration: "PT23M15S",
    orientation: "landscape",
    ...overrides,
  };
}

test("slugify lowercases, collapses punctuation/whitespace to hyphens, and trims edges", () => {
  assert.equal(
    slugify("Why Are We Always Looking for Better Partners? | Juice Bros Pickleball"),
    "why-are-we-always-looking-for-better-partners-juice-bros-pickleball",
  );
});

test("slugify trims leading/trailing separators produced by leading/trailing punctuation", () => {
  assert.equal(slugify("--Hello, World!--"), "hello-world");
});

test("parseIsoDurationSeconds reads hours, minutes, and seconds", () => {
  assert.equal(parseIsoDurationSeconds("PT1H2M3S"), 3723);
});

test("parseIsoDurationSeconds reads minutes-only durations", () => {
  assert.equal(parseIsoDurationSeconds("PT3M"), 180);
  assert.equal(parseIsoDurationSeconds("PT3M0S"), 180);
});

test("parseIsoDurationSeconds reads seconds-only durations", () => {
  assert.equal(parseIsoDurationSeconds("PT45S"), 45);
});

test("a normal horizontal, >3-minute video classifies as an Episode with a title-derived slug", () => {
  const video = makeVideo({ orientation: "landscape", duration: "PT23M15S" });
  const episode = buildEpisode(video, []);
  assert.ok(episode);
  assert.equal(episode.slug, slugify(video.title));
  assert.equal(episode.title, video.title);
});

test("a vertical, <=3-minute video classifies as a Short (null)", () => {
  const video = makeVideo({ orientation: "portrait", duration: "PT45S" });
  assert.equal(buildEpisode(video, []), null);
});

test("isShort: exactly 3 minutes and vertical is a Short", () => {
  assert.equal(isShort({ orientation: "portrait", duration: "PT3M0S" }), true);
});

test("isShort: one second over 3 minutes and vertical is not a Short", () => {
  assert.equal(isShort({ orientation: "portrait", duration: "PT3M1S" }), false);
});

test("isShort: exactly 3 minutes but landscape is not a Short", () => {
  assert.equal(isShort({ orientation: "landscape", duration: "PT3M0S" }), false);
});

test("isShort: vertical (the 9:16 orientation) but well over 3 minutes is not a Short", () => {
  assert.equal(isShort({ orientation: "portrait", duration: "PT23M15S" }), false);
});

test("a video whose videoId has a matching override with showNotes resolves with that show notes text in place of the raw description", () => {
  const video = makeVideo({ id: "abc123", description: "Raw description" });
  const overrides: EpisodeOverride[] = [
    { videoId: "abc123", title: "Label only", showNotes: "Hand-written show notes." },
  ];
  const episode = buildEpisode(video, overrides);
  assert.ok(episode);
  assert.equal(episode.description, "Hand-written show notes.");
});

test("a video whose override has redirectFrom resolves with the correct redirect target on its current slug", () => {
  const video = makeVideo({ id: "abc123", title: "New Improved Title" });
  const overrides: EpisodeOverride[] = [
    { videoId: "abc123", title: "Label only", redirectFrom: ["old-title-before-rename"] },
  ];
  const episode = buildEpisode(video, overrides);
  assert.ok(episode);
  assert.equal(episode.slug, "new-improved-title");
  assert.deepEqual(episode.redirectFrom, ["old-title-before-rename"]);
});

test("a video with no matching override still classifies correctly with sensible defaults", () => {
  const video = makeVideo({ id: "zzz999", description: "Raw description" });
  const overrides: EpisodeOverride[] = [{ videoId: "some-other-id", title: "Unrelated" }];
  const episode = buildEpisode(video, overrides);
  assert.ok(episode);
  assert.equal(episode.description, "Raw description");
  assert.deepEqual(episode.redirectFrom, []);
});

test("buildEpisode falls back to the video ID for a slug when the title has no ASCII alphanumeric characters", () => {
  const video = makeVideo({ id: "abc123", title: "🎾🥒" });
  const episode = buildEpisode(video, []);
  assert.ok(episode);
  assert.equal(episode.slug, "abc123");
});

test("buildEpisode returns null for a Short even when an override exists for its videoId", () => {
  const video = makeVideo({ id: "short1", orientation: "portrait", duration: "PT30S" });
  const overrides: EpisodeOverride[] = [{ videoId: "short1", title: "Label only", showNotes: "Notes" }];
  assert.equal(buildEpisode(video, overrides), null);
});
