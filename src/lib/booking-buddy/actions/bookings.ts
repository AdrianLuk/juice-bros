"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { trackBookingViaCalendar, trackFirstBooking } from "../analytics.ts";
import { BOOKING_BUDDY_ROOT, BOOKINGS_PATH } from "../routes.ts";
import { readFailed, type ActionResult } from "./result.ts";
import {
  formatBookingWhen,
  parseNewBooking,
  type NewBooking,
} from "../bookings.ts";
import type { BookingFormat } from "../capacity.ts";
import {
  editBooking,
  insertBooking,
  removeBooking,
} from "../booking-writes.ts";
import { listOrgs, type Org } from "./orgs.ts";

export type { ActionResult } from "./result.ts";

export type Booking = {
  id: string;
  orgId: string;
  /** Resolved the same way the Orgs page resolves it, cache miss included. */
  orgName: string;
  /** Null when the User didn't note one down — not every facility labels its courts. */
  courtLabel: string | null;
  /** Null when the User didn't give the Booking a name. */
  name: string | null;
  /** Null when the User didn't add one. Shown only in the Booking's own detail view. */
  notes: string | null;
  /** Already rendered in the Booking's own zone — see `formatBookingWhen`. */
  when: string;
  startsAt: string;
  endsAt: string;
  /** The facility's own clock (issue #20) — what `when` was rendered in. Surfaced raw for the dashboard calendar's (#23) detail popover. */
  timeZone: string;
  /** Doubles (4) or singles (2) — what this court's own share of Capacity is (ADR 0008). */
  format: BookingFormat;
  /** Names only, alphabetical — the Connection link is write-time-only data (ADR 0011), not surfaced on this list. */
  players: string[];
};

export type BookingsPageData = {
  orgs: Org[];
  bookings: Booking[];
};

/**
 * Everything the bookings page renders: the caller's Bookings, soonest first,
 * and the Orgs the form's picker offers.
 *
 * Formatting happens here rather than in the component because it needs each
 * Booking's own `time_zone`, and the alternative — letting the browser pick —
 * is the bug that column exists to prevent.
 */
export async function getBookingsPageData(): Promise<BookingsPageData> {
  await verifySession();
  const supabase = await createClient();

  const [orgs, bookingsResult, playersResult] = await Promise.all([
    listOrgs(),
    supabase
      .from("bookings")
      .select("id, org_id, court_label, name, notes, starts_at, ends_at, format")
      .order("starts_at", { ascending: true }),
    // A separate query rather than a PostgREST embed — this codebase avoids
    // embedding (see PROGRESS.md's connections notes) and joins in
    // application code instead.
    //
    // Ordered by name, not created_at: every Player from one Booking is
    // written in a single insert (`insertBookingPlayers`), so they all share
    // the exact same `now()` — Postgres gives no guarantee about the order of
    // ties, so a real tiebreaker is what actually makes the list stable.
    supabase
      .from("booking_players")
      .select("booking_id, name")
      .order("name", { ascending: true }),
  ]);

  if (bookingsResult.error) {
    readFailed("your bookings", bookingsResult.error);
  }
  if (playersResult.error) {
    readFailed("your bookings' players", playersResult.error);
  }

  const orgById = new Map(orgs.map((org) => [org.id, org]));

  const playerNamesByBookingId = new Map<string, string[]>();
  for (const row of playersResult.data ?? []) {
    const names = playerNamesByBookingId.get(row.booking_id) ?? [];
    names.push(row.name);
    playerNamesByBookingId.set(row.booking_id, names);
  }

  return {
    orgs,
    bookings: (bookingsResult.data ?? []).map((row) => {
      const org = orgById.get(row.org_id);
      return {
        id: row.id,
        orgId: row.org_id,
        // An Org deleted between the two reads would leave this blank rather
        // than crash; the cascade means its Bookings are on their way out
        // anyway. Same fallback spirit for the zone: UTC is honest about not
        // knowing rather than a guess.
        orgName: org?.displayName ?? "Somewhere you played",
        courtLabel: row.court_label,
        name: row.name,
        notes: row.notes,
        when: formatBookingWhen({
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          timeZone: org?.timeZone ?? "UTC",
        }),
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        timeZone: org?.timeZone ?? "UTC",
        format: row.format,
        players: playerNamesByBookingId.get(row.id) ?? [],
      };
    }),
  };
}

/**
 * The session-free half of logging a Booking lives in `booking-writes.ts`
 * (issue #608). What stays here is what only a Server Action can do: the
 * first-Booking and calendar analytics (`after()`) and `revalidatePath`.
 */
async function insertValidatedBooking(
  ownerId: string,
  parsed: NewBooking,
  // `"calendar"` when the submission came from a dashboard calendar cell's `+`
  // (spec #303) — the only thing this changes is a non-funnel
  // `bb_booking_via_calendar` analytics ping.
  source?: "calendar",
): Promise<ActionResult> {
  const supabase = await createClient();
  const result = await insertBooking(supabase, ownerId, parsed);
  if ("error" in result) {
    return result;
  }

  // `bb_first_booking` (#179) — fired after the response only if this was the
  // caller's first Booking. Fired even on a Players-only failure below: the
  // Booking has committed.
  after(() => trackFirstBooking(ownerId));

  // `bb_booking_via_calendar` (spec #303) — every calendar-originated create,
  // not just the first. Independent of `bb_first_booking` above.
  if (source === "calendar") {
    after(() => trackBookingViaCalendar());
  }

  revalidatePath(BOOKINGS_PATH);
  // The dashboard calendar (#23) renders these too, via a quick-add sheet
  // that posts here without navigating off `/booking-buddy`.
  revalidatePath(BOOKING_BUDDY_ROOT);

  // The Booking itself already committed — a failure here is Players-only,
  // so the page still revalidates above rather than leaving the User to
  // resubmit and log a duplicate Booking on top of the one that already saved.
  if (result.playersError) {
    return { error: result.playersError };
  }

  return { ok: true };
}

/** Log a court reservation that already exists on the facility's own platform. */
export async function createBooking(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const parsed = parseNewBooking(formData);
  if ("error" in parsed) {
    return parsed;
  }

  // The hidden marker `CreateBookingForm` stamps only on a calendar-cell open
  // (spec #303); `parseNewBooking` ignores the field.
  const source =
    formData.get("source") === "calendar" ? ("calendar" as const) : undefined;

  return insertValidatedBooking(session.userId, parsed, source);
}

/** `editBooking` (`booking-writes.ts`) plus the revalidation only a Server Action can do. */
async function updateValidatedBooking(
  ownerId: string,
  bookingId: string,
  parsed: NewBooking,
): Promise<ActionResult> {
  const supabase = await createClient();
  const result = await editBooking(supabase, ownerId, bookingId, parsed);
  if ("error" in result) {
    return result;
  }

  revalidatePath(BOOKINGS_PATH);
  revalidatePath(BOOKING_BUDDY_ROOT);

  // The Booking itself already committed — same "still revalidate, but
  // report the Players-only failure" posture insertValidatedBooking uses.
  if (result.playersError) {
    return { error: result.playersError };
  }

  return { ok: true };
}

/** Edit an existing Booking — same validation as logging one (issue #97), now including Players (issue #101). */
export async function updateBooking(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();
  const bookingId = String(formData.get("booking_id") ?? "");

  if (!bookingId) {
    return { error: "Pick a booking to edit." };
  }

  const parsed = parseNewBooking(formData);
  if ("error" in parsed) {
    return parsed;
  }

  return updateValidatedBooking(session.userId, bookingId, parsed);
}

/**
 * Remove a Booking from the Bookings page or the dashboard calendar's (#23)
 * Booking popover. A confirmed cancellation removes one through
 * `import-candidate-settlement.ts` instead, which settles its sources too.
 */
export async function deleteBooking(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();
  const bookingId = String(formData.get("booking_id") ?? "");

  if (!bookingId) {
    return { error: "Pick a booking to remove." };
  }

  const supabase = await createClient();
  const result = await removeBooking(supabase, bookingId);
  if ("error" in result) {
    return result;
  }

  revalidatePath(BOOKINGS_PATH);
  revalidatePath(BOOKING_BUDDY_ROOT);
  return { ok: true };
}