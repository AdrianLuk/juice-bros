"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { BOOKINGS_PATH, ORGS_PATH } from "../routes.ts";
import type { ActionResult } from "./result.ts";
import { orgWriteMessage } from "../orgs.ts";
import { ensureFreshPlaceCache } from "../place-cache.ts";
import { searchPlacesText } from "../google-places-client.ts";
import { deriveTimeZoneFromCoordinates } from "../derive-time-zone.ts";
import {
  parsePlacePick,
  parsePlaceSearchQuery,
  placePickFailedMessage,
  placeSearchFailedMessage,
  type PlaceCandidate,
} from "../places.ts";

export type { ActionResult } from "./result.ts";
export type { PlaceCandidate } from "../places.ts";

export type PlaceSearchState = {
  query: string;
  candidates: PlaceCandidate[];
  error?: string;
};

/**
 * Search Google Places, server-side (ADR 0005 — every Booking Buddy form
 * works with JavaScript off, which a client-side autocomplete would give up).
 * The candidates rendered from this are what `pickPlace` below trusts a
 * `place_id` out of; nothing else about a candidate ever comes back from the
 * client.
 */
export async function searchPlaces(
  _prev: PlaceSearchState,
  formData: FormData,
): Promise<PlaceSearchState> {
  await verifySession();

  // Kept even on a validation failure, so the box still shows what was typed.
  const rawQuery = String(formData.get("query") ?? "");
  const parsed = parsePlaceSearchQuery(formData);

  if ("error" in parsed) {
    return { query: rawQuery, candidates: [], error: parsed.error };
  }

  const result = await searchPlacesText(parsed.query);

  if (!result.ok) {
    return {
      query: parsed.query,
      candidates: [],
      error: placeSearchFailedMessage(result.reason),
    };
  }

  if (result.candidates.length === 0) {
    return {
      query: parsed.query,
      candidates: [],
      error: "No matches. Try a different spelling, or add it by hand below.",
    };
  }

  return { query: parsed.query, candidates: result.candidates };
}

/**
 * Turns a picked candidate into a cached Place and an Org pointing at it.
 *
 * Only `place_id` is trusted from the form — never a candidate's name or
 * address. `place_cache` is shared across every User (ADR 0005), so the
 * server re-derives the facts about it itself (from the cache, or a fresh
 * Details call) rather than trusting anything the client posted back; a
 * tampered hidden field can at worst name a `place_id` that fails to
 * resolve, never write false content into the shared cache.
 */
export async function pickPlace(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const parsed = parsePlacePick(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const outcome = await ensureFreshPlaceCache(parsed.placeId);
  if (!outcome.ok) {
    return { error: placePickFailedMessage(outcome.reason) };
  }

  // Coordinates give a zone — no question asked for a Place-backed Org
  // (issue #20). A miss here (no coordinates cached, or geo-tz finding
  // nothing usable) is rare enough not to block Org creation over; 'UTC' is a
  // logged stopgap, not a real answer for where PicklePlex Downsview is.
  const timeZone =
    outcome.latitude !== null && outcome.longitude !== null
      ? deriveTimeZoneFromCoordinates(outcome.latitude, outcome.longitude)
      : null;

  if (!timeZone) {
    console.error(
      "booking-buddy: couldn't derive a time zone for place",
      parsed.placeId,
      { latitude: outcome.latitude, longitude: outcome.longitude },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("orgs").insert({
    owner_id: session.userId,
    google_place_id: parsed.placeId,
    time_zone: timeZone ?? "UTC",
    // Explicit rather than omitted, so the check constraint's "exactly one of
    // the two" reads the same here as it does in the migration.
    name: null,
  });

  if (error) {
    return { error: orgWriteMessage(error, "create") };
  }

  revalidatePath(ORGS_PATH);
  revalidatePath(BOOKINGS_PATH);
  return { ok: true };
}
