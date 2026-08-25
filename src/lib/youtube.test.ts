import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveOrientation,
  getEpisodeHook,
  parsePlaylistItems,
  parseVideoDetails,
} from "./youtube.ts";

test("getEpisodeHook takes just the first paragraph, collapsed to one line", () => {
  const description = "Line one\ncontinues here.\n\nSecond paragraph never shows up.";
  assert.equal(getEpisodeHook(description), "Line one continues here.");
});

test("getEpisodeHook truncates a long first paragraph with an ellipsis", () => {
  const description = "a".repeat(200);
  const hook = getEpisodeHook(description, 140);
  assert.equal(hook.length, 140);
  assert.ok(hook.endsWith("…"));
});

test("getEpisodeHook returns an untouched paragraph under the length cap as-is", () => {
  assert.equal(getEpisodeHook("Short and sweet."), "Short and sweet.");
});

test("deriveOrientation: an embed height taller than the reference width is portrait", () => {
  assert.equal(deriveOrientation(14563, 8192), "portrait");
});

test("deriveOrientation: an embed height shorter than the reference width is landscape", () => {
  assert.equal(deriveOrientation(4608, 8192), "landscape");
});

test("deriveOrientation: an exact square defaults to landscape", () => {
  assert.equal(deriveOrientation(8192, 8192), "landscape");
});

test("parsePlaylistItems maps snippet fields and drops items with no resourceId.videoId", () => {
  const result = parsePlaylistItems({
    items: [
      {
        snippet: {
          title: "Episode One",
          description: "Description one",
          publishedAt: "2026-07-21T23:30:36Z",
          resourceId: { videoId: "abc123" },
        },
      },
      {
        snippet: {
          title: "Deleted video placeholder",
          description: "",
          publishedAt: "2026-07-01T00:00:00Z",
          resourceId: {},
        },
      },
    ],
  });

  assert.deepEqual(result, [
    {
      id: "abc123",
      title: "Episode One",
      description: "Description one",
      published: "2026-07-21T23:30:36Z",
    },
  ]);
});

test("parsePlaylistItems returns an empty array when items is missing", () => {
  assert.deepEqual(parsePlaylistItems({}), []);
});

test("parsePlaylistItems skips an item with no snippet at all, rather than throwing", () => {
  const result = parsePlaylistItems({ items: [{}] });
  assert.deepEqual(result, []);
});

test("parseVideoDetails maps duration and embedHeight, keyed by video ID", () => {
  const result = parseVideoDetails({
    items: [
      {
        id: "abc123",
        contentDetails: { duration: "PT23M15S" },
        player: { embedHeight: 4608 },
      },
    ],
  });

  assert.deepEqual(result.get("abc123"), { duration: "PT23M15S", embedHeight: 4608 });
});

test("parseVideoDetails skips a video whose player part is missing, rather than fabricating embedHeight 0", () => {
  const result = parseVideoDetails({
    items: [{ id: "abc123", contentDetails: { duration: "PT23M15S" } }],
  });

  assert.equal(result.has("abc123"), false);
});

test("parseVideoDetails skips a video with no contentDetails.duration", () => {
  const result = parseVideoDetails({
    items: [{ id: "abc123", contentDetails: {}, player: { embedHeight: 4608 } }],
  });

  assert.equal(result.has("abc123"), false);
});

test("parseVideoDetails returns an empty map when items is missing", () => {
  assert.equal(parseVideoDetails({}).size, 0);
});
