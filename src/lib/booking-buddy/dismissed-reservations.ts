/**
 * The `dismissed_reservations` store (issue #437) — the one place a "no" on
 * the "Sync bookings" review screen is written down in a form *both* import
 * sources can read.
 *
 * The two sources settle in two different places: dismissing an email writes a
 * `processed_messages` row keyed on an opaque provider message id, dismissing
 * a feed candidate writes an `org_feed_events` row keyed on a VEVENT UID, and
 * neither review reads the other's store. A *confirmed* candidate needs no
 * help — it leaves a Booking behind, and #432 taught both sources to recognise
 * a Booking across their differing court text. A dismissed one leaves nothing
 * to recognise, so each source went on offering the reservation the other had
 * already settled.
 *
 * So every dismissal of an import candidate also records its slot here, and
 * both reviews filter against the list (`isDismissedReservation`,
 * `import-candidate-shaping.ts`). The slot is the cross-source identity —
 * Org + wall-clock date + start time + the source's own court text, compared
 * by court *number* rather than as text.
 *
 * Takes the Supabase client as a parameter and imports nothing from Next.js,
 * for the same reason `feed-events.ts` does: a `"use server"` module can't
 * export a non-action helper, and all three dismiss actions — two in
 * `actions/email-sync.ts`, one in `actions/calendar-feed.ts` — need these.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { BookingIdentity } from "./import-candidate-shaping.ts";

/** One reservation the User dismissed — `BookingIdentity` under its own name. */
export type DismissedReservation = BookingIdentity;

/**
 * The slot fields a dismiss form posts, or `null` when it posted none.
 *
 * Only an *import* candidate's Dismiss carries them. A cancellation
 * candidate's "Keep booking" posts to the same feed action and deliberately
 * does not: it means "keep this Booking", not "I don't want this reservation",
 * and recording a dismissal there would suppress a future import of a slot the
 * User is still playing. An email candidate whose facility matched no Org
 * carries none either — there is no Org to key the slot on.
 *
 * The values are the candidate's own, posted back as hidden inputs the same
 * way every confirm form on this screen posts the fields it re-validates. A
 * tampered post can only suppress one of the caller's own future candidates,
 * which is strictly less than what the confirm forms already accept.
 */
export type DismissedSlotPost = {
  orgId: string;
  /** `YYYY-MM-DD` in the Org's own zone. */
  date: string;
  /** `HH:MM`, 24-hour, in the Org's own zone. */
  startTime: string;
  /** The source's own court text, unnormalised; null when it named no court. */
  courtLabel: string | null;
};

/** `YYYY-MM-DD`. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** `HH:MM`, 24-hour. */
const TIME_PATTERN = /^\d{2}:\d{2}$/;

/**
 * Read the dismissed slot off a dismiss form's `FormData`, or `null` when it
 * isn't there or doesn't look like a slot. Never throws and never reports —
 * "no slot posted" is an ordinary, expected case, not an error.
 */
export function readDismissedSlotPost(formData: FormData): DismissedSlotPost | null {
  const orgId = String(formData.get("org_id") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "").trim();

  if (!orgId || !DATE_PATTERN.test(date) || !TIME_PATTERN.test(startTime)) {
    return null;
  }

  const courtLabel = String(formData.get("court_label") ?? "").trim();

  return { orgId, date, startTime, courtLabel: courtLabel || null };
}

/**
 * Record one dismissed reservation. Failures are logged, never surfaced: the
 * dismissal of the candidate's *own* source has already happened (or is about
 * to), which is what the User asked for, and a lost row here degrades to
 * exactly the behaviour before #437 — the other source offers the reservation
 * once more and one extra Dismiss settles it.
 */
export async function recordDismissedReservation(
  supabase: SupabaseClient,
  ownerId: string,
  slot: DismissedSlotPost,
): Promise<void> {
  const { error } = await supabase.from("dismissed_reservations").insert({
    owner_id: ownerId,
    org_id: slot.orgId,
    slot_date: slot.date,
    slot_start_time: slot.startTime,
    court_label: slot.courtLabel,
  });

  if (error) {
    console.error("booking-buddy: recording a dismissed reservation failed", error);
  }
}

/**
 * Every reservation this User has dismissed, as the identity both reviews
 * compare candidates against. `orgId` narrows it to one Facility for a feed
 * sync; the email sync spans every Org and passes none.
 *
 * A read failure comes back as an empty list rather than an error: the sync it
 * feeds is still worth running, and the cost of missing rows is the pre-#437
 * behaviour — a reservation offered once more.
 */
export async function listDismissedReservations(
  supabase: SupabaseClient,
  ownerId: string,
  orgId?: string,
): Promise<DismissedReservation[]> {
  let query = supabase
    .from("dismissed_reservations")
    .select("org_id, slot_date, slot_start_time, court_label")
    .eq("owner_id", ownerId);

  if (orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("booking-buddy: reading dismissed reservations failed", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    orgId: row.org_id,
    // Postgres hands a `time` back as `HH:MM:SS`; the reviews compare `HH:MM`.
    startTime: String(row.slot_start_time).slice(0, 5),
    date: row.slot_date,
    courtLabel: row.court_label,
  }));
}
