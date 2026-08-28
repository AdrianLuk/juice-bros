import assert from "node:assert/strict";
import test from "node:test";

import { parseInstagramMedia } from "./instagram.ts";

const imageItem = {
  id: "1",
  caption: "First",
  media_type: "IMAGE" as const,
  media_url: "https://cdn.example/1.jpg",
  permalink: "https://instagram.com/p/1",
  timestamp: "2026-08-01T00:00:00Z",
};

test("parseInstagramMedia maps an image post to type 'image' using media_url", () => {
  const [post] = parseInstagramMedia({ data: [imageItem] }, 6);
  assert.deepEqual(post, {
    id: "1",
    caption: "First",
    permalink: "https://instagram.com/p/1",
    thumbnail: "https://cdn.example/1.jpg",
    timestamp: "2026-08-01T00:00:00Z",
    type: "image",
  });
});

test("parseInstagramMedia uses thumbnail_url and type 'video' for a VIDEO", () => {
  const [post] = parseInstagramMedia(
    {
      data: [
        {
          id: "2",
          media_type: "VIDEO",
          media_url: "https://cdn.example/2.mp4",
          thumbnail_url: "https://cdn.example/2.jpg",
          permalink: "https://instagram.com/reel/2",
          timestamp: "2026-08-02T00:00:00Z",
        },
      ],
    },
    6,
  );
  assert.equal(post.type, "video");
  assert.equal(post.thumbnail, "https://cdn.example/2.jpg");
});

test("parseInstagramMedia defaults a missing caption to an empty string", () => {
  const [post] = parseInstagramMedia(
    { data: [{ ...imageItem, caption: undefined }] },
    6,
  );
  assert.equal(post.caption, "");
});

test("parseInstagramMedia drops a VIDEO that has no thumbnail_url yet", () => {
  const posts = parseInstagramMedia(
    {
      data: [
        { id: "3", media_type: "VIDEO", permalink: "https://instagram.com/reel/3", timestamp: "t" },
        imageItem,
      ],
    },
    6,
  );
  assert.deepEqual(
    posts.map((p) => p.id),
    ["1"],
  );
});

test("parseInstagramMedia drops an item with no permalink", () => {
  const posts = parseInstagramMedia(
    { data: [{ ...imageItem, permalink: undefined }] },
    6,
  );
  assert.equal(posts.length, 0);
});

test("parseInstagramMedia stops at the limit", () => {
  const data = Array.from({ length: 10 }, (_, i) => ({ ...imageItem, id: String(i) }));
  assert.equal(parseInstagramMedia({ data }, 6).length, 6);
});

test("parseInstagramMedia handles a response with no data array", () => {
  assert.deepEqual(parseInstagramMedia({}, 6), []);
});
