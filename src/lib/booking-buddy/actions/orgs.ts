"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { BOOKINGS_PATH, ORGS_PATH } from "../routes.ts";
import { readFailed, type ActionResult } from "./result.ts";
import {
  orgDisplayName,
  orgWriteMessage,
  parseHandNamedOrg,
  type CachedPlace,
} from "../orgs.ts";
import { isPlaceCacheStale } from "../places.ts";
import { refreshStalePlacesInBackground } from "../place-cache.ts";

export type { ActionResult } from "./result.ts";

/** One Org, with whatever the Place cache could tell us about it. */
export type Org = {
  id: string;
  /** Resolved for display: the typed name, the cached Place's, or an admission. */
  displayName: string;
  googlePlaceId: string | null;
  /** Set only for a hand-named Org. */
  handTypedName: string | null;
  /** From the Place cache, so it only ever exists for a Place-backed Org. */
  address: string | null;
  /** The facility's own clock — derived (Place-backed) or asked once (hand-named). See issue #20. */
  timeZone: string;
  createdAt: string;
};

/**
 * The caller's Orgs, newest first, each resolved to something displayable.
 *
 * Two queries rather than one join, and deliberately so: `orgs.google_place_id`
 * is not a foreign key to `place_cache` (see the migration for why), which
 * leaves PostgREST no relationship to embed across. It also makes the cache
 * miss ADR 0005 warns about an ordinary empty map rather than a failed join.
 */
export async function listOrgs(): Promise<Org[]> {
  await verifySession();
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("orgs")
    .select("id, google_place_id, name, time_zone, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    readFailed("the places you play", error);
  }

  const orgRows = rows ?? [];
  const placeIds = orgRows
    .map((row) => row.google_place_id)
    .filter((id): id is string => Boolean(id));

  const placeById = new Map<string, CachedPlace>();

  if (placeIds.length > 0) {
    const { data: places, error: placesError } = await supabase
      .from("place_cache")
      .select("place_id, name, formatted_address, fetched_at")
      .in("place_id", placeIds);

    // A failed cache read is not a failed page. Every Org still renders, just
    // without the Place's name — which is the degradation ADR 0005 asks for,
    // and better than an error page because Google had a bad minute.
    if (placesError) {
      console.error("booking-buddy: reading the place cache failed", placesError);
    }

    // Missing (never cached, or its row is gone) counts the same as stale —
    // both need a fetch before the next render can show anything real.
    const cachedPlaceIds = new Set<string>();
    const staleOrMissingPlaceIds: string[] = [];

    for (const place of places ?? []) {
      placeById.set(place.place_id, {
        name: place.name,
        formattedAddress: place.formatted_address,
      });
      cachedPlaceIds.add(place.place_id);
      if (isPlaceCacheStale(place.fetched_at)) {
        staleOrMissingPlaceIds.push(place.place_id);
      }
    }

    for (const placeId of placeIds) {
      if (!cachedPlaceIds.has(placeId)) {
        staleOrMissingPlaceIds.push(placeId);
      }
    }

    // Scheduled for after the response is sent — this render never waits on
    // Google, and a bad outcome here can't fail the page. The next visit
    // benefits from whatever this refresh managed to do.
    if (staleOrMissingPlaceIds.length > 0) {
      after(() => refreshStalePlacesInBackground(staleOrMissingPlaceIds));
    }
  }

  return orgRows.map((row) => {
    const place = row.google_place_id
      ? (placeById.get(row.google_place_id) ?? null)
      : null;

    return {
      id: row.id,
      displayName: orgDisplayName(
        { name: row.name, googlePlaceId: row.google_place_id },
        place,
      ),
      googlePlaceId: row.google_place_id,
      handTypedName: row.name,
      address: place?.formattedAddress ?? null,
      timeZone: row.time_zone,
      createdAt: row.created_at,
    };
  });
}

/**
 * Add a venue Google doesn't list, by typing its name.
 *
 * The Place-backed path — search Google, pick a candidate, cache it — is issue
 * #18, and is where most Orgs will come from once it exists. This one stays
 * regardless: a community-centre gym or a private court has no listing to find.
 */
export async function createOrg(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const parsed = parseHandNamedOrg(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("orgs").insert({
    owner_id: session.userId,
    name: parsed.name,
    time_zone: parsed.timeZone,
    // Explicit rather than omitted, so the check constraint's "exactly one of
    // the two" reads the same here as it does in the migration.
    google_place_id: null,
  });

  if (error) {
    return { error: orgWriteMessage(error, "create") };
  }

  revalidatePath(ORGS_PATH);
  revalidatePath(BOOKINGS_PATH);
  return { ok: true };
}

/**
 * Remove a place, and with it every Booking held there — the cascade is in the
 * schema, and the confirmation dialog in front of this is what makes it a
 * decision rather than a surprise.
 *
 * Beyond the ticket on purpose, for the same reason Friend Groups got a delete:
 * a mistyped entry you cannot get rid of is a trap, and here it would also sit
 * in the Booking form's picker forever.
 */
export async function deleteOrg(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();
  const orgId = String(formData.get("org_id") ?? "");

  if (!orgId) {
    return { error: "Pick a place to remove." };
  }

  const supabase = await createClient();
  // Selecting the deleted row is what distinguishes "gone" from "RLS matched
  // nothing" — a delete naming someone else's Org succeeds with zero rows, and
  // reporting that as done would be a lie.
  const { data, error } = await supabase
    .from("orgs")
    .delete()
    .eq("id", orgId)
    .select("id");

  if (error || !data?.length) {
    return { error: orgWriteMessage(error ?? {}, "delete") };
  }

  revalidatePath(ORGS_PATH);
  revalidatePath(BOOKINGS_PATH);
  return { ok: true };
}
