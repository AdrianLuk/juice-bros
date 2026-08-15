import assert from "node:assert/strict";
import test from "node:test";

import {
  PLACE_CACHE_TTL_DAYS,
  isPlaceCacheStale,
  parsePlaceDetails,
  parsePlacePick,
  parsePlaceSearchQuery,
  parseTextSearchCandidates,
  placePickFailedMessage,
  placeSearchFailedMessage,
} from "./places.ts";

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

test("parsePlaceSearchQuery trims and accepts a real query", () => {
  const result = parsePlaceSearchQuery(formData({ query: "  PicklePlex  " }));
  assert.deepEqual(result, { query: "PicklePlex" });
});

test("parsePlaceSearchQuery rejects a blank query", () => {
  const result = parsePlaceSearchQuery(formData({ query: "   " }));
  assert.ok("error" in result);
});

test("parsePlaceSearchQuery rejects a single character", () => {
  const result = parsePlaceSearchQuery(formData({ query: "P" }));
  assert.ok("error" in result);
});

test("parsePlaceSearchQuery rejects an overlong query", () => {
  const result = parsePlaceSearchQuery(formData({ query: "a".repeat(201) }));
  assert.ok("error" in result);
});

test("parsePlacePick reads the hidden place_id field", () => {
  const result = parsePlacePick(formData({ place_id: "ChIJ-example" }));
  assert.deepEqual(result, { placeId: "ChIJ-example" });
});

test("parsePlacePick rejects a missing place_id", () => {
  const result = parsePlacePick(formData({}));
  assert.ok("error" in result);
});

const RAW_PLACE = {
  id: "ChIJpickleplex-downsview",
  displayName: { text: "PicklePlex Downsview", languageCode: "en" },
  formattedAddress: "70 Canuck Ave, North York, ON M3K 2C5",
  location: { latitude: 43.7419, longitude: -79.4783 },
};

const RAW_PLACE_WITHOUT_LOCATION = {
  id: RAW_PLACE.id,
  displayName: RAW_PLACE.displayName,
  formattedAddress: RAW_PLACE.formattedAddress,
};

test("parseTextSearchCandidates reads candidates out of a real response", () => {
  const candidates = parseTextSearchCandidates({ places: [RAW_PLACE] });

  assert.deepEqual(candidates, [
    {
      placeId: "ChIJpickleplex-downsview",
      name: "PicklePlex Downsview",
      formattedAddress: "70 Canuck Ave, North York, ON M3K 2C5",
    },
  ]);
});

test("parseTextSearchCandidates returns [] when Google found nothing", () => {
  // Google's actual shape for zero results: no `places` key at all.
  assert.deepEqual(parseTextSearchCandidates({}), []);
});

test("parseTextSearchCandidates returns [] for a response it doesn't recognise", () => {
  assert.deepEqual(parseTextSearchCandidates(null), []);
  assert.deepEqual(parseTextSearchCandidates("not json"), []);
  assert.deepEqual(parseTextSearchCandidates({ places: "not an array" }), []);
});

test("parseTextSearchCandidates skips a malformed entry but keeps the rest", () => {
  const candidates = parseTextSearchCandidates({
    places: [{ id: "missing-fields" }, RAW_PLACE],
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].placeId, "ChIJpickleplex-downsview");
});

test("parseTextSearchCandidates tolerates a candidate with no coordinates", () => {
  const candidates = parseTextSearchCandidates({ places: [RAW_PLACE_WITHOUT_LOCATION] });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].name, "PicklePlex Downsview");
});

test("parsePlaceDetails reads a single Place", () => {
  const details = parsePlaceDetails(RAW_PLACE);

  assert.deepEqual(details, {
    name: "PicklePlex Downsview",
    formattedAddress: "70 Canuck Ave, North York, ON M3K 2C5",
    latitude: 43.7419,
    longitude: -79.4783,
  });
});

test("parsePlaceDetails returns null for coordinates missing entirely", () => {
  const details = parsePlaceDetails(RAW_PLACE_WITHOUT_LOCATION);

  assert.deepEqual(details, {
    name: "PicklePlex Downsview",
    formattedAddress: "70 Canuck Ave, North York, ON M3K 2C5",
    latitude: null,
    longitude: null,
  });
});

test("parsePlaceDetails returns null for an unparseable response", () => {
  assert.equal(parsePlaceDetails({ error: { status: "NOT_FOUND" } }), null);
  assert.equal(parsePlaceDetails(null), null);
});

test("isPlaceCacheStale is false just inside the window", () => {
  const now = new Date("2026-08-14T00:00:00Z");
  const fetchedAt = new Date(now.getTime() - (PLACE_CACHE_TTL_DAYS - 1) * 24 * 60 * 60 * 1000);

  assert.equal(isPlaceCacheStale(fetchedAt.toISOString(), now), false);
});

test("isPlaceCacheStale is false exactly at the boundary", () => {
  const now = new Date("2026-08-14T00:00:00Z");
  const fetchedAt = new Date(now.getTime() - PLACE_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

  assert.equal(isPlaceCacheStale(fetchedAt.toISOString(), now), false);
});

test("isPlaceCacheStale is true just past the window", () => {
  const now = new Date("2026-08-14T00:00:00Z");
  const fetchedAt = new Date(now.getTime() - (PLACE_CACHE_TTL_DAYS + 1) * 24 * 60 * 60 * 1000);

  assert.equal(isPlaceCacheStale(fetchedAt.toISOString(), now), true);
});

test("isPlaceCacheStale treats an unparseable timestamp as stale", () => {
  assert.equal(isPlaceCacheStale("not a date"), true);
});

test("placeSearchFailedMessage reads as a real sentence", () => {
  assert.match(placeSearchFailedMessage("unreachable"), /Google/);
});

test("placePickFailedMessage points at the hand-typed fallback when Google is unreachable", () => {
  assert.match(placePickFailedMessage("unreachable"), /by hand/);
});

test("placePickFailedMessage tells the User to search again on a dead place_id", () => {
  assert.match(placePickFailedMessage("not_found"), /searching again/);
});
