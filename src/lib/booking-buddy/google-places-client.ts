import "server-only";

import { readGooglePlacesApiBaseUrl, requireGoogleMapsApiKey } from "./env.ts";
import {
  parsePlaceDetails,
  parseTextSearchCandidates,
  type GooglePlaceDetails,
  type PlaceCandidate,
} from "./places.ts";

/**
 * Thin HTTP wrappers around the Places API (New) — the only place an actual
 * `fetch` to Google happens. Every response is fed through the pure parsers
 * in `places.ts`; everything here is transport concerns (auth header, field
 * mask, timeout, mapping a failure to a reason the caller can act on).
 *
 * Deliberately not unit tested: it's glue over a real network call, which is
 * what Playwright's mocked Places server (`e2e/support/google-places-mock.ts`)
 * exists to exercise instead, per the seam note in PROGRESS.md.
 */

const FETCH_TIMEOUT_MS = 8000;
const MAX_CANDIDATES = 5;

// Field masks are required by the New API — an unmasked request is refused.
// Keep these in sync with what `places.ts`'s parsers actually read.
const SEARCH_FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location";
const DETAILS_FIELD_MASK = "id,displayName,formattedAddress,location";

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

export type TextSearchOutcome =
  | { ok: true; candidates: PlaceCandidate[] }
  | { ok: false; reason: "unreachable" };

export async function searchPlacesText(query: string): Promise<TextSearchOutcome> {
  const apiKey = requireGoogleMapsApiKey();
  const baseUrl = readGooglePlacesApiBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/v1/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: query, maxResultCount: MAX_CANDIDATES }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        "booking-buddy: Places text search failed",
        response.status,
        await safeText(response),
      );
      return { ok: false, reason: "unreachable" };
    }

    const json: unknown = await response.json();
    return { ok: true, candidates: parseTextSearchCandidates(json) };
  } catch (error) {
    console.error("booking-buddy: Places text search unreachable", error);
    return { ok: false, reason: "unreachable" };
  }
}

export type PlaceDetailsOutcome =
  | { ok: true; details: GooglePlaceDetails }
  | { ok: false; reason: "not_found" | "unreachable" };

/**
 * Google documents that a `place_id` can stop resolving; a 404 here is that
 * case, distinguished from an ordinary outage so `place-cache.ts` can treat
 * them differently — one is permanent, the other is worth trying again later.
 */
export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetailsOutcome> {
  const apiKey = requireGoogleMapsApiKey();
  const baseUrl = readGooglePlacesApiBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": DETAILS_FIELD_MASK,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (response.status === 404) {
      return { ok: false, reason: "not_found" };
    }

    if (!response.ok) {
      console.error(
        "booking-buddy: Place details failed",
        response.status,
        await safeText(response),
      );
      return { ok: false, reason: "unreachable" };
    }

    const json: unknown = await response.json();
    const details = parsePlaceDetails(json);

    if (!details) {
      console.error("booking-buddy: Place details returned an unparseable response");
      return { ok: false, reason: "unreachable" };
    }

    return { ok: true, details };
  } catch (error) {
    console.error("booking-buddy: Place details unreachable", error);
    return { ok: false, reason: "unreachable" };
  }
}
