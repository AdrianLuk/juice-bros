/**
 * Pure input handling and display logic for Orgs.
 *
 * The Server Actions themselves are meant to be thin: verify the session, hand
 * the form to one of these, make the write, translate the failure. Everything
 * decidable without a database lives here so it can be unit tested directly,
 * per the seam note in booking-buddy/PROGRESS.md.
 *
 * Free of Next.js and Supabase imports on purpose. The limits mirror the
 * `orgs` migration — change one and you must change the other.
 */

import { isKnownTimeZone } from "./timezone.ts";

export const ORG_NAME_MAX_LENGTH = 80;

export type HandNamedOrg = { name: string; timeZone: string };

/**
 * The hand-typed path: a venue Google has no listing for.
 *
 * The Place-backed path has no parser here because there is nothing to parse —
 * the User picks a candidate the server itself fetched, so the `place_id` comes
 * from our own search results rather than from the form, and its time zone is
 * derived from the Place's coordinates rather than asked (issue #20). A
 * hand-named venue has no coordinates to derive from, so it's asked once here,
 * defaulting to the browser's zone — a reasonable guess for a court typed in by
 * hand, unlike one searched for.
 */
export function parseHandNamedOrg(
  formData: FormData,
): HandNamedOrg | { error: string } {
  // Trimmed because the unique index compares btrim(lower(name)): an untrimmed
  // name would collide with its own twin for reasons the User cannot see.
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "Give the place a name." };
  }

  if (name.length > ORG_NAME_MAX_LENGTH) {
    return {
      error: `That name is too long — ${ORG_NAME_MAX_LENGTH} characters at most.`,
    };
  }

  const timeZone = String(formData.get("time_zone") ?? "").trim();
  // Never defaulted to the server's zone. That is precisely the bug this
  // column exists to prevent: in production the server is on UTC, which would
  // turn a 6pm court booking into 10pm for every Booking under this Org.
  if (!isKnownTimeZone(timeZone)) {
    return { error: "Couldn't tell what time zone to use for this place. Try again." };
  }

  return { name, timeZone };
}

export type OrgIdentity = {
  name: string | null;
  googlePlaceId: string | null;
};

/** A `public.place_cache` row, as the app reads it. */
export type CachedPlace = {
  name: string;
  formattedAddress: string;
};

/**
 * What to call an Org on screen.
 *
 * A hand-named Org is called what its owner typed. A Place-backed one is called
 * what the cached Place is called — never a local copy, which is the whole
 * point of ADR 0005.
 *
 * The third case is real and has to be rendered: a Place-backed Org whose cache
 * row isn't there, because it hasn't been fetched yet or because Google was
 * unreachable when it was tried. Saying so beats inventing a name that reads as
 * real, and beats an empty string that renders as a blank row.
 */
export function orgDisplayName(
  org: OrgIdentity,
  place: CachedPlace | null,
): string {
  const handTyped = org.name?.trim();
  if (handTyped) {
    return handTyped;
  }

  const cached = place?.name?.trim();
  if (cached) {
    return cached;
  }

  return "Facility details unavailable";
}

export type OrgWrite = "create" | "delete";

const FAILED: Record<OrgWrite, string> = {
  create: "Couldn't add that place. Try again.",
  delete: "Couldn't remove that place. Try again.",
};

/**
 * Turns a failed write into something worth reading.
 *
 * `23514` arrives from two sources: the place-backed/hand-named check
 * constraint, and (for a hand-named Org) the `orgs_time_zone_known` trigger.
 * `isKnownTimeZone` already catches a bad zone before the database sees it, so
 * the second case shouldn't be reachable from the form as it stands — but a
 * wrong answer here would be baffling either way, so the message is read
 * rather than assumed.
 */
export function orgWriteMessage(
  error: { code?: string; message?: string },
  write: OrgWrite,
): string {
  switch (error.code) {
    case "23505":
      return "You've already added that place.";
    case "23514":
      return error.message?.includes("time zone")
        ? "That time zone isn't one the calendar recognises. Pick another."
        : "A place needs either a Google listing or a name of its own.";
    default:
      return FAILED[write];
  }
}
