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
 * What a dismissal means therefore changes, and not only in reach. It was
 * "never show me *this message* again" (email) or "never show me *this
 * VEVENT* again" (feed); it becomes "never offer me *this slot* again", from
 * either source. The concrete cost is a **cancel and rebook of the same
 * slot** — same Org, day, start time and court. That is a genuinely new
 * reservation; it used to arrive with a fresh message id and a fresh VEVENT
 * UID and be offered by both sources, and it is dropped by both.
 *
 * Accepted because a slot is the only key the two sources share, and
 * suppressing only the *counterpart* source doesn't help — a rebook
 * regenerates both sides, so the same slot arrives fresh from each. What made
 * it safe to accept is issue #444: a sync that drops candidates this way says
 * so on the review screen and lists them, and "Offer this again" deletes the
 * dismissal (`deleteDismissedReservations`). So the two properties the slot
 * key made load-bearing — invisible, and permanent — are neither any more.
 *
 * Takes the Supabase client as a parameter and imports nothing from Next.js,
 * for the same reason `feed-events.ts` does: a `"use server"` module can't
 * export a non-action helper, and all three dismiss actions — two in
 * `actions/email-sync.ts`, one in `actions/calendar-feed.ts` — need these.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { isSameReservation, type BookingIdentity } from "./import-candidate-shaping.ts";

/** `YYYY-MM-DD`. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** `HH:MM`, 24-hour. */
const TIME_PATTERN = /^\d{2}:\d{2}$/;

/**
 * Read the dismissed slot off a dismiss form's `FormData`
 * (`DismissedSlotFields`), or `null` when it posted none.
 *
 * "No slot posted" is an ordinary case, not an error, so this never throws and
 * never reports: only an *import* candidate's Dismiss carries a slot. A
 * cancellation candidate's "Keep booking" posts to the same feed action and
 * deliberately does not — it means "keep this Booking", not "I don't want this
 * reservation" — and neither does an email import whose facility matched no
 * Org, since there is no Org to key the slot on.
 *
 * The values are the candidate's own, posted back as hidden inputs the same
 * way every confirm form on this screen posts the fields it re-validates. A
 * tampered post can only suppress one of the caller's own future candidates,
 * which is strictly less than what the confirm forms already accept.
 */
export function readDismissedSlotPost(formData: FormData): BookingIdentity | null {
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
 * Record the dismissed slot a dismiss form carried, if it carried one — the
 * whole of what each of the three dismiss actions does about #437.
 *
 * Failures are logged, never surfaced: the dismissal of the candidate's *own*
 * source has already happened, which is what the User asked for, and a lost
 * row here degrades to exactly the behaviour before #437 — the other source
 * offers the reservation once more and one extra Dismiss settles it.
 */
export async function recordDismissedSlotFromForm(
  supabase: SupabaseClient,
  ownerId: string,
  formData: FormData,
): Promise<void> {
  const slot = readDismissedSlotPost(formData);
  if (!slot) {
    return;
  }

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
): Promise<BookingIdentity[]> {
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

  return (data ?? []).map(toReservation);
}

/** One stored row as the identity the reviews compare against. */
function toReservation(row: DismissedReservationRow): BookingIdentity {
  return {
    orgId: row.org_id,
    date: row.slot_date,
    // Postgres hands a `time` back as `HH:MM:SS`; the reviews compare `HH:MM`.
    startTime: String(row.slot_start_time).slice(0, 5),
    courtLabel: row.court_label,
  };
}

/** The slot columns every read here selects — what `toReservation` reshapes. */
type DismissedReservationRow = {
  org_id: string;
  slot_date: string;
  slot_start_time: string;
  court_label: string | null;
};

/**
 * Take a dismissal back (issue #444): delete every `dismissed_reservations`
 * row for this slot, so both import sources offer the reservation again.
 *
 * Every row, not one by id, because a slot can hold more than one. When both
 * sources are configured for a facility, dismissing the merged card records
 * the slot once per dismissal path, and the two sources' court text differs
 * ("#9 - Hard" against "#9") — which is exactly why the table has no
 * uniqueness. Deleting a single row would leave the slot suppressed and
 * nothing on the review screen still offering to un-suppress it.
 *
 * Which rows count is `isSameReservation`, the same identity that suppressed
 * the candidate in the first place, applied here rather than in SQL because
 * the court comparison is by court *number* and Postgres holds the raw text.
 * That carries the identity's deliberate looseness with it: a slot whose court
 * is unreadable matches every court at that Org, date and start time, so
 * taking one back takes back the whole slot. That is the honest reading of a
 * candidate that named no court — there is no narrower reservation to mean.
 *
 * Reports failure to the caller rather than swallowing it, unlike the record
 * and list helpers above: this one is a User pressing a button and waiting to
 * see the reservation offered again, so a silent no-op would be a lie.
 */
export async function deleteDismissedReservations(
  supabase: SupabaseClient,
  ownerId: string,
  slot: BookingIdentity,
): Promise<{ ok: boolean }> {
  const { data, error } = await supabase
    .from("dismissed_reservations")
    .select("id, org_id, slot_date, slot_start_time, court_label")
    .eq("owner_id", ownerId)
    .eq("org_id", slot.orgId)
    .eq("slot_date", slot.date);

  if (error) {
    console.error("booking-buddy: reading dismissed reservations to take one back failed", error);
    return { ok: false };
  }

  const matchingIds = (data ?? [])
    .filter((row) => isSameReservation(slot, toReservation(row)))
    .map((row) => row.id);

  // Nothing to delete is success, not a failure: the caller's goal — this slot
  // is no longer suppressed — is already true. A double-submit, or the same
  // list acted on from two tabs, lands here.
  if (matchingIds.length === 0) {
    return { ok: true };
  }

  const { error: deleteError } = await supabase
    .from("dismissed_reservations")
    .delete()
    .eq("owner_id", ownerId)
    .in("id", matchingIds);

  if (deleteError) {
    console.error("booking-buddy: taking a dismissed reservation back failed", deleteError);
    return { ok: false };
  }

  return { ok: true };
}
