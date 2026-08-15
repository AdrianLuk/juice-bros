import "server-only";

import { createAdminClient } from "./supabase/admin.ts";
import { fetchPlaceDetails } from "./google-places-client.ts";
import { isPlaceCacheStale, type PlacePickFailure } from "./places.ts";
import type { CachedPlace } from "./orgs.ts";

/**
 * Keeps `place_cache` fresh — the server-owned half of ADR 0005. Two callers,
 * two different reactions to the same outcome:
 *
 * - `pickPlace` (`actions/places.ts`) awaits this directly: a `not_found` or
 *   an `unreachable` with nothing cached yet has to become a message the User
 *   reads before an Org gets created.
 * - `listOrgs`'s background refresh (`refreshStalePlacesInBackground`, run
 *   inside `after()`) never surfaces a failure to anyone — it's a page that
 *   "cannot fail" per ADR 0005, so a bad outcome here is logged and dropped.
 */
export type EnsureOutcome =
  | {
      ok: true;
      place: CachedPlace;
      /**
       * Carried alongside `place`, not folded into `CachedPlace` itself —
       * `listOrgs`/`orgDisplayName` never need coordinates, only `pickPlace`
       * does, to derive the new Org's time zone (issue #20). Every code path
       * below already has the row in hand, so this is free.
       */
      latitude: number | null;
      longitude: number | null;
    }
  | { ok: false; reason: PlacePickFailure };

type PlaceCacheRow = {
  place_id: string;
  name: string;
  formatted_address: string;
  latitude: number | null;
  longitude: number | null;
  fetched_at: string;
};

/**
 * Nulls out just the coordinates on a row whose refresh attempt failed and
 * whose `fetched_at` is already past the 30-day window — Google's terms cap
 * how long coordinates may be retained, and a failed refresh means they can
 * no longer be verified. Name and address stay: they have no such cap, and
 * `orgDisplayName` still needs *something* to show. A no-op when the row
 * already has no coordinates to drop.
 */
async function dropStaleCoordinates(
  admin: ReturnType<typeof createAdminClient>,
  row: PlaceCacheRow,
): Promise<void> {
  if (row.latitude === null && row.longitude === null) {
    return;
  }

  const { error } = await admin
    .from("place_cache")
    .update({ latitude: null, longitude: null })
    .eq("place_id", row.place_id);

  if (error) {
    console.error("booking-buddy: dropping stale coordinates failed", row.place_id, error);
  }
}

function toCachedPlace(row: { name: string; formatted_address: string }): CachedPlace {
  return { name: row.name, formattedAddress: row.formatted_address };
}

/**
 * A Place already cached and fresh is returned as-is, with no Google call. A
 * stale or missing one is fetched and the whole row is overwritten — success
 * resets `fetched_at` (coordinates included); failure on a row that has one
 * leaves name/address as last-known and drops just the coordinates.
 */
export async function ensureFreshPlaceCache(placeId: string): Promise<EnsureOutcome> {
  const admin = createAdminClient();

  let existingRow: PlaceCacheRow | null = null;
  const { data, error: readError } = await admin
    .from("place_cache")
    .select("place_id, name, formatted_address, latitude, longitude, fetched_at")
    .eq("place_id", placeId)
    .maybeSingle();

  if (readError) {
    console.error("booking-buddy: reading the place cache failed", placeId, readError);
  } else {
    existingRow = data;
  }

  if (existingRow && !isPlaceCacheStale(existingRow.fetched_at)) {
    return {
      ok: true,
      place: toCachedPlace(existingRow),
      latitude: existingRow.latitude,
      longitude: existingRow.longitude,
    };
  }

  const detailsOutcome = await fetchPlaceDetails(placeId);

  if (!detailsOutcome.ok) {
    if (existingRow) {
      await dropStaleCoordinates(admin, existingRow);
    }

    if (detailsOutcome.reason === "unreachable" && existingRow) {
      // Degrade to what's already known rather than blocking on an outage
      // that has nothing to do with whether this Place still exists. The
      // coordinates returned here are the pre-drop, in-memory values — the
      // write above may just have nulled them out in the database once past
      // the 30-day window, but "last known" is still the best answer to give.
      return {
        ok: true,
        place: toCachedPlace(existingRow),
        latitude: existingRow.latitude,
        longitude: existingRow.longitude,
      };
    }

    return { ok: false, reason: detailsOutcome.reason };
  }

  const { details } = detailsOutcome;
  const { error: writeError } = await admin.from("place_cache").upsert({
    place_id: placeId,
    name: details.name,
    formatted_address: details.formattedAddress,
    latitude: details.latitude,
    longitude: details.longitude,
    fetched_at: new Date().toISOString(),
  });

  if (writeError) {
    console.error("booking-buddy: caching the place failed", placeId, writeError);
    return { ok: false, reason: "write_failed" };
  }

  return {
    ok: true,
    place: { name: details.name, formattedAddress: details.formattedAddress },
    latitude: details.latitude,
    longitude: details.longitude,
  };
}

/**
 * Best-effort refresh for whichever of the caller's own Orgs turned out to be
 * stale or missing when `listOrgs` last read them. Run inside `after()`, so
 * it happens after the response is already on its way and can never slow
 * down or fail a render — every outcome, including a thrown error, is logged
 * and swallowed rather than propagated.
 */
export async function refreshStalePlacesInBackground(placeIds: string[]): Promise<void> {
  const results = await Promise.allSettled(placeIds.map((placeId) => ensureFreshPlaceCache(placeId)));

  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      console.error(
        "booking-buddy: background place refresh threw",
        placeIds[index],
        result.reason,
      );
    } else if (!result.value.ok && result.value.reason !== "not_found") {
      console.error(
        "booking-buddy: background place refresh failed",
        placeIds[index],
        result.value.reason,
      );
    }
  }
}
