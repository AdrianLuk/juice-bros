/**
 * Pure input handling, response parsing and staleness logic for the Google
 * Places lookup (issue #18).
 *
 * Free of Next.js, Supabase and fetch on purpose, same as `orgs.ts` and
 * `bookings.ts` — everything decidable without a network call or a database
 * lives here so it can be unit tested directly, per the seam note in
 * booking-buddy/PROGRESS.md. The actual HTTP calls live in
 * `google-places-client.ts` and feed their responses through the parsers
 * below.
 */

export const PLACE_SEARCH_QUERY_MIN_LENGTH = 2;
export const PLACE_SEARCH_QUERY_MAX_LENGTH = 200;

export function parsePlaceSearchQuery(
  formData: FormData,
): { query: string } | { error: string } {
  const query = String(formData.get("query") ?? "").trim();

  if (query.length < PLACE_SEARCH_QUERY_MIN_LENGTH) {
    return { error: "Type a bit more of the club's name to search." };
  }

  if (query.length > PLACE_SEARCH_QUERY_MAX_LENGTH) {
    return {
      error: `That search is too long — ${PLACE_SEARCH_QUERY_MAX_LENGTH} characters at most.`,
    };
  }

  return { query };
}

export function parsePlacePick(
  formData: FormData,
): { placeId: string } | { error: string } {
  const placeId = String(formData.get("place_id") ?? "").trim();

  if (!placeId) {
    return { error: "Pick a place from the search results." };
  }

  return { placeId };
}

/** A search result, safe to render — never trusted back from the client. */
export type PlaceCandidate = {
  placeId: string;
  name: string;
  formattedAddress: string;
};

/** What Google's Place Details tells us about one Place. */
export type GooglePlaceDetails = {
  name: string;
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
};

type RawGooglePlace = {
  id?: unknown;
  displayName?: { text?: unknown };
  formattedAddress?: unknown;
  location?: { latitude?: unknown; longitude?: unknown };
};

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * A single result out of the New Places API's shape (`{ id, displayName:
 * { text }, formattedAddress, location: { latitude, longitude } }`), or
 * `null` if the required fields aren't there. Coordinates are optional —
 * Google doesn't promise them for every place, and a missing pair shouldn't
 * sink the whole candidate.
 */
function parseRawPlace(raw: unknown): (PlaceCandidate & GooglePlaceDetails) | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }

  const place = raw as RawGooglePlace;
  const placeId = place.id;
  const name = place.displayName?.text;
  const formattedAddress = place.formattedAddress;

  if (!isNonBlankString(placeId) || !isNonBlankString(name) || !isNonBlankString(formattedAddress)) {
    return null;
  }

  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  const hasCoordinates = isFiniteNumber(latitude) && isFiniteNumber(longitude);

  return {
    placeId,
    name,
    formattedAddress,
    latitude: hasCoordinates ? latitude : null,
    longitude: hasCoordinates ? longitude : null,
  };
}

/**
 * Candidates out of a Text Search response. Tolerant on purpose: a response
 * with no `places` key (Google's shape for "no results") or a malformed one
 * both fall back to an empty list rather than throwing — the search box has
 * to render *something* for a query that matched nothing, and it isn't this
 * function's job to tell a zero-result search apart from a shape it doesn't
 * recognise. `searchPlacesText` in `google-places-client.ts` is what reports
 * an actual transport failure.
 */
export function parseTextSearchCandidates(json: unknown): PlaceCandidate[] {
  if (typeof json !== "object" || json === null || !("places" in json)) {
    return [];
  }

  const places = (json as { places: unknown }).places;
  if (!Array.isArray(places)) {
    return [];
  }

  const candidates: PlaceCandidate[] = [];
  for (const raw of places) {
    const parsed = parseRawPlace(raw);
    if (parsed) {
      candidates.push({
        placeId: parsed.placeId,
        name: parsed.name,
        formattedAddress: parsed.formattedAddress,
      });
    }
  }

  return candidates;
}

/** A single Place Details response, or `null` if it can't be parsed. */
export function parsePlaceDetails(json: unknown): GooglePlaceDetails | null {
  const parsed = parseRawPlace(json);
  if (!parsed) {
    return null;
  }

  return {
    name: parsed.name,
    formattedAddress: parsed.formattedAddress,
    latitude: parsed.latitude,
    longitude: parsed.longitude,
  };
}

/**
 * How long a `place_cache` row is trusted before it's re-fetched.
 *
 * One number for the whole row, not just coordinates. ADR 0005 gives a hard
 * cap only for coordinates (30 days, from Google's terms) and no caching
 * exception at all for name/address — using the stricter number everywhere
 * is the conservative reading, and it means there's exactly one staleness
 * check rather than two drifting apart.
 */
export const PLACE_CACHE_TTL_DAYS = 30;

export function isPlaceCacheStale(fetchedAt: string, now: Date = new Date()): boolean {
  const fetchedAtMs = new Date(fetchedAt).getTime();
  if (Number.isNaN(fetchedAtMs)) {
    // An unparseable timestamp is worth treating as stale rather than as
    // fresh — refetching a row is cheap, and trusting it silently is not.
    return true;
  }

  const ageMs = now.getTime() - fetchedAtMs;
  const ttlMs = PLACE_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
  return ageMs > ttlMs;
}

export type PlaceSearchFailure = "unreachable";

export function placeSearchFailedMessage(reason: PlaceSearchFailure): string {
  switch (reason) {
    case "unreachable":
      return "Couldn't reach Google to search right now. Try again in a moment.";
  }
}

export type PlacePickFailure = "not_found" | "unreachable" | "write_failed";

/**
 * Turns a failed pick into something worth reading. `unreachable` names the
 * hand-typed fallback explicitly — it's the one failure mode where staying
 * blocked would be a real dead end, since ADR 0005 gives Google no way to
 * force a retry.
 */
export function placePickFailedMessage(reason: PlacePickFailure): string {
  switch (reason) {
    case "not_found":
      return "That place isn't listed by Google anymore. Try searching again.";
    case "unreachable":
      return "Couldn't reach Google to confirm that place. Try again, or add it by hand below.";
    case "write_failed":
      return "Couldn't save that place. Try again.";
  }
}
