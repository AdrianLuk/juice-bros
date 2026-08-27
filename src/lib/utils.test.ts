import assert from "node:assert/strict";
import test from "node:test";

import { getYoutubeVideoId } from "./utils.ts";

test("getYoutubeVideoId reads the v param from a watch URL", () => {
  assert.equal(
    getYoutubeVideoId("https://www.youtube.com/watch?v=OY-LgG7kSfs"),
    "OY-LgG7kSfs",
  );
});

test("getYoutubeVideoId reads the path from a youtu.be short URL", () => {
  assert.equal(getYoutubeVideoId("https://youtu.be/J6gvgo_RKfo"), "J6gvgo_RKfo");
});

test("getYoutubeVideoId returns null when there is no id", () => {
  assert.equal(getYoutubeVideoId("https://www.youtube.com/@PickleballDav"), null);
  assert.equal(getYoutubeVideoId("https://youtu.be/"), null);
});
