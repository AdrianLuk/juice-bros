"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { SLOTS_PATH, slotPath } from "../routes.ts";
import { readFailed, type ActionResult } from "./result.ts";
import {
  facilityLabel,
  formatSlotWhen,
  parseNewSlotProposal,
  parseSlotNotes,
  slotWriteMessage,
} from "../slots.ts";
import {
  bookingOverlapsSlot,
  computeCapacity,
  parseRotationBuffer,
  slotBookingWriteMessage,
} from "../capacity.ts";
import { isDivision, type Division } from "../division.ts";
import type { Gender } from "../gender.ts";
import type { ResponseAnswer } from "../responses.ts";
import { getBookingsPageData, type Booking } from "./bookings.ts";
import { listOrgs, type Org } from "./orgs.ts";

export type { ActionResult } from "./result.ts";

export type Slot = {
  id: string;
  ownerId: string;
  /** Display name of whoever proposed it — "You" is resolved by the caller, not here. */
  ownerName: string;
  /** Already rendered in the Slot's own zone — see `formatSlotWhen`. */
  when: string;
  proposedStart: string;
  /**
   * The attached court(s)' facility, resolved for display — `null` for a
   * bare proposal with nothing attached yet. Reads `slot_bookings.org_name`
   * alone, so this is the same for the owner and for a friend; unlike
   * `SlotCapacity.attached`, it never needs the owner-only `bookings` table.
   */
  facilityLabel: string | null;
};

export type SlotResponse = {
  id: string;
  /** `null` for a Guest response (issue #10) — keyed by `guestName` instead. */
  userId: string | null;
  /**
   * A profile the viewer can't read (no Connection to that responder) still
   * counts, just unnamed. Always set for a Guest — their own given name.
   */
  displayName: string | null;
  answer: ResponseAnswer;
  /** The responder's own Gender (issue #79) — `null` for a Guest, or a signed-in responder who hasn't set one. Feeds `computeGenderedCapacity` (issue #80). */
  gender: Gender | null;
};

/**
 * What a Slot's Capacity is made of. `capacity` is `null` for a Slot with no
 * Booking attached — a bare proposal has nothing to enforce (ADR 0001).
 *
 * `courtCount` comes from `slot_bookings`, which every viewer of the Slot can
 * read, so a friend sees the same Capacity the organizer does. `attached` and
 * `attachable` are empty for a friend: `bookings` itself stays owner-only, so
 * where and which court are never theirs to see.
 */
export type SlotCapacity = {
  courtCount: number;
  rotationBuffer: number;
  capacity: number | null;
  /** Set once at Slot creation (issue #80) — governs whether the Capacity signal is broken down by gender. */
  division: Division;
  /** Mirrors `Slot.facilityLabel` — see there for why it's computed once, off `slot_bookings.org_name` alone. */
  facilityLabel: string | null;
  attached: Booking[];
  attachable: Booking[];
};

export type SlotDetail = {
  slot: Slot;
  isOwner: boolean;
  responses: SlotResponse[];
  /** The caller's own answer, if they've given one. */
  myAnswer: ResponseAnswer | null;
  capacity: SlotCapacity;
  /** Minutes before `proposedStart` a Reminder goes out (issue #11). Owner-editable. */
  reminderOffsetMinutes: number;
  /** The organizer's own hint at which facility they plan to book (issue #36). */
  intendedOrgId: string | null;
  /** The owner's own Orgs, to pick an intended one from — empty for a non-owner, same pattern as `capacity.attached`/`attachable`. */
  ownedOrgs: Org[];
  /** Null when the owner hasn't added one. Set at posting time or afterward via `setSlotNotes`; shown on the Slot's own detail page only. */
  notes: string | null;
};

export type SlotResponses = {
  responses: SlotResponse[];
  myAnswer: ResponseAnswer | null;
};

/**
 * Just the responses half of a Slot's detail — its own query key on the
 * client, so `ResponseButtons`' optimistic mutation (issue #8's one dedicated
 * UI-seam test) can refetch and cache-patch this alone rather than the whole
 * page's data, per CLAUDE.md's TanStack Query carve-out for Slot Responses.
 */
export async function getSlotResponses(slotId: string): Promise<SlotResponses> {
  const session = await verifySession();
  const supabase = await createClient();

  const { data: responseRows, error: responsesError } = await supabase
    .from("responses")
    .select("id, user_id, guest_name, answer")
    .eq("slot_id", slotId);

  if (responsesError) {
    readFailed("who's responded to this slot", responsesError);
  }

  const responderIds = (responseRows ?? [])
    .map((row) => row.user_id)
    .filter((id): id is string => id !== null);

  const { data: profiles, error: profilesError } =
    responderIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("profiles")
          .select("id, display_name, gender")
          .in("id", responderIds);

  if (profilesError) {
    readFailed("who's responded to this slot", profilesError);
  }

  const nameById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.display_name]),
  );
  const genderById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.gender as Gender | null]),
  );

  const responses: SlotResponse[] = (responseRows ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    // A signed-in responder's name comes from their profile (unnamed if the
    // viewer can't read it); a Guest's is exactly the name they typed in —
    // there's no profile to look up (issue #10).
    displayName: row.user_id ? (nameById.get(row.user_id) ?? null) : row.guest_name,
    answer: row.answer,
    // Same reasoning as displayName: a Guest has no profile to read a Gender
    // off, so they fall into the "unspecified" bucket, same as an unset one.
    gender: row.user_id ? (genderById.get(row.user_id) ?? null) : null,
  }));

  const mine = responses.find((response) => response.userId === session.userId);

  return { responses, myAnswer: mine?.answer ?? null };
}

/**
 * Every Slot the caller can see: their own, and any friend's they have at
 * least `slots` Visibility into. One query — RLS (`has_slot_visibility`) is
 * what actually decides which rows come back, so there is no separate
 * "visible friends" filter to apply here.
 */
export async function listSlots(): Promise<{ own: Slot[]; friends: Slot[] }> {
  const session = await verifySession();
  const supabase = await createClient();

  const { data: rows, error } = await supabase
    .from("slots")
    .select("id, owner_id, proposed_start, proposed_end, time_zone")
    .order("proposed_start", { ascending: true });

  if (error) {
    readFailed("your slots", error);
  }

  const ownerIds = [...new Set((rows ?? []).map((row) => row.owner_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ownerIds.length > 0 ? ownerIds : [session.userId]);

  if (profilesError) {
    readFailed("who proposed those slots", profilesError);
  }

  const nameById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.display_name]),
  );

  const slotIds = (rows ?? []).map((row) => row.id);
  // One batched read rather than one per Slot: `slot_bookings` is exactly as
  // friend-visible as `slots` itself (same `can_access_slot` policy), so this
  // needs no ownership branch the way `getSlotCapacity`'s `attached`/
  // `attachable` halves do.
  const { data: attachedRows, error: attachedError } =
    slotIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("slot_bookings")
          .select("slot_id, org_name")
          .in("slot_id", slotIds);

  if (attachedError) {
    readFailed("which facilities those slots are at", attachedError);
  }

  const orgNamesBySlotId = new Map<string, string[]>();
  for (const row of attachedRows ?? []) {
    const names = orgNamesBySlotId.get(row.slot_id) ?? [];
    names.push(row.org_name);
    orgNamesBySlotId.set(row.slot_id, names);
  }

  const toSlot = (row: (typeof rows)[number]): Slot => ({
    id: row.id,
    ownerId: row.owner_id,
    ownerName: nameById.get(row.owner_id) ?? "A friend",
    when: formatSlotWhen({
      proposedStart: row.proposed_start,
      proposedEnd: row.proposed_end,
      timeZone: row.time_zone,
    }),
    proposedStart: row.proposed_start,
    facilityLabel: facilityLabel(orgNamesBySlotId.get(row.id) ?? []),
  });

  const own: Slot[] = [];
  const friends: Slot[] = [];
  for (const row of rows ?? []) {
    (row.owner_id === session.userId ? own : friends).push(toSlot(row));
  }

  return { own, friends };
}

/**
 * What the Slot's courts add up to, and — for the organizer — which Bookings
 * those are and which of theirs are still free to attach.
 *
 * Two reads, and which of them runs is decided by who is asking:
 * `slot_bookings` is readable by anyone who can see the Slot, so the court
 * count (and therefore Capacity) is the same number on everyone's screen;
 * `bookings` is owner-only, so the Booking details are fetched at all only for
 * the owner. Nothing here filters by viewer — that split is RLS's, which is
 * why a friend's `attached`/`attachable` come back empty rather than needing a
 * branch that could be forgotten.
 */
async function getSlotCapacity(
  slotId: string,
  slotWindow: { proposedStart: string; proposedEnd: string },
  rotationBuffer: number,
  division: Division,
  isOwner: boolean,
): Promise<SlotCapacity> {
  const supabase = await createClient();

  // `format` and `org_name` are copied onto this row at attach time (the
  // migration's trigger), which is what lets a friend — who can read
  // `slot_bookings` but not the owner-only `bookings`/`orgs` tables — compute
  // the same Capacity the organizer sees, and read the same facility, without
  // either of those tables ever becoming friend-visible.
  const { data: attachedRows, error } = await supabase
    .from("slot_bookings")
    .select("booking_id, format, org_name")
    .eq("slot_id", slotId);

  if (error) {
    readFailed("this slot's courts", error);
  }

  const attachedIds = new Set((attachedRows ?? []).map((row) => row.booking_id));
  const courtCount = attachedIds.size;
  const formats = (attachedRows ?? []).map((row) => row.format);

  const base = {
    courtCount,
    rotationBuffer,
    capacity: computeCapacity({ formats, rotationBuffer }),
    division,
    facilityLabel: facilityLabel((attachedRows ?? []).map((row) => row.org_name)),
  };

  if (!isOwner) {
    return { ...base, attached: [], attachable: [] };
  }

  // Reuses the Bookings page's own read rather than repeating the Org-name and
  // time-zone resolution it already does — the picker needs a Booking to read
  // exactly as it does on that page, or the same reservation looks like two
  // different ones.
  const { bookings } = await getBookingsPageData();

  return {
    ...base,
    attached: bookings.filter((booking) => attachedIds.has(booking.id)),
    // Only bookings for the same real-world game — same overlapping window —
    // are offered. Attaching one from an unrelated date would silently attach
    // the wrong reservation, and Capacity would read the courts of a game
    // that isn't this one.
    attachable: bookings.filter(
      (booking) => !attachedIds.has(booking.id) && bookingOverlapsSlot(booking, slotWindow),
    ),
  };
}

/**
 * Everything the Slot detail page renders. `slot` is `null` when the row
 * doesn't exist or (per `can_access_slot`/`has_slot_visibility`) the caller
 * has no Visibility into it — the two are indistinguishable through RLS on
 * purpose, same as every other table here.
 */
export async function getSlotDetail(slotId: string): Promise<SlotDetail | null> {
  const session = await verifySession();
  const supabase = await createClient();

  const { data: slotRow, error: slotError } = await supabase
    .from("slots")
    .select(
      "id, owner_id, proposed_start, proposed_end, time_zone, rotation_buffer, reminder_offset_minutes, intended_org_id, division, notes",
    )
    .eq("id", slotId)
    .maybeSingle();

  if (slotError) {
    readFailed("that slot", slotError);
  }
  if (!slotRow) {
    return null;
  }

  const isOwner = slotRow.owner_id === session.userId;
  // The check constraint guarantees this, but a stray value falls back to
  // `open` rather than crashing the page — the same defensive posture the
  // rest of this app takes with a value it doesn't fully trust the source of.
  const division = isDivision(slotRow.division) ? slotRow.division : "open";

  const [{ responses, myAnswer }, ownerProfileResult, capacity, ownedOrgs] = await Promise.all([
    getSlotResponses(slotId),
    supabase.from("profiles").select("display_name").eq("id", slotRow.owner_id).maybeSingle(),
    getSlotCapacity(
      slotId,
      { proposedStart: slotRow.proposed_start, proposedEnd: slotRow.proposed_end },
      slotRow.rotation_buffer,
      division,
      isOwner,
    ),
    // Orgs are owner-only per RLS, so this would come back empty for a
    // friend anyway — skipped outright rather than paying for a query whose
    // answer is already known.
    isOwner ? listOrgs() : Promise.resolve([]),
  ]);

  if (ownerProfileResult.error) {
    readFailed("who proposed this slot", ownerProfileResult.error);
  }

  return {
    slot: {
      id: slotRow.id,
      ownerId: slotRow.owner_id,
      ownerName: ownerProfileResult.data?.display_name ?? "A friend",
      when: formatSlotWhen({
        proposedStart: slotRow.proposed_start,
        proposedEnd: slotRow.proposed_end,
        timeZone: slotRow.time_zone,
      }),
      proposedStart: slotRow.proposed_start,
      facilityLabel: capacity.facilityLabel,
    },
    isOwner,
    responses,
    myAnswer,
    capacity,
    reminderOffsetMinutes: slotRow.reminder_offset_minutes,
    intendedOrgId: slotRow.intended_org_id,
    ownedOrgs,
    notes: slotRow.notes,
  };
}

/**
 * Post a bare-proposal Slot — no Booking, no capacity to enforce (ADR 0001).
 * Attaching a Booking is issue #9's.
 */
export async function createSlot(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const parsed = parseNewSlotProposal(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const supabase = await createClient();

  const { error } = await supabase.from("slots").insert({
    owner_id: session.userId,
    // Wall-clock strings carrying their own zone, same as Bookings — Postgres
    // does the DST-aware conversion to an instant.
    proposed_start: `${parsed.date} ${parsed.startTime}:00 ${parsed.timeZone}`,
    proposed_end: `${parsed.date} ${parsed.endTime}:00 ${parsed.timeZone}`,
    time_zone: parsed.timeZone,
    division: parsed.division,
    intended_org_id: parsed.orgId,
    notes: parsed.notes,
  });

  if (error) {
    return { error: slotWriteMessage(error) };
  }

  revalidatePath(SLOTS_PATH);
  return { ok: true };
}

/**
 * Withdraw a Slot outright, not just detach a Booking from it — every
 * Response, attached slot_booking, Slot Link, and Reminder send cascades with
 * it (the migration's `on delete cascade`). The Bookings it was attached to
 * are untouched, same "this app's records vs. the real reservation" split
 * `detachBookingFromSlot` and `deleteOwnedBooking` already draw.
 *
 * The detail page this is called from stops existing the moment this
 * succeeds, so unlike every other delete in this file there's nowhere left to
 * revalidate back to — `redirect` takes the caller to the list instead.
 */
export async function deleteSlot(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();

  const slotId = String(formData.get("slot_id") ?? "").trim();
  if (!slotId) {
    return { error: "Which slot is this?" };
  }

  const supabase = await createClient();
  // Selected back for the same reason as every other delete here: RLS turns
  // "that isn't yours" into an empty result, not an error.
  const { data, error } = await supabase
    .from("slots")
    .delete()
    .eq("id", slotId)
    .select("id");

  if (error || !data?.length) {
    return { error: "Couldn't delete that slot. Try again." };
  }

  revalidatePath(SLOTS_PATH);
  redirect(SLOTS_PATH);
}

/**
 * Attach one of the caller's Bookings to one of their Slots — the act that
 * turns a bare proposal into a confirmed Slot with real Capacity (ADR 0001).
 *
 * Several Bookings on one Slot is the multi-court game, not a mistake, so this
 * adds rather than replaces. Ownership of both sides is checked in the
 * database (`assert_slot_booking_coherent` plus the insert policy) rather than
 * re-derived here; an RLS-filtered write comes back as zero rows, which
 * `slotBookingWriteMessage` reads as "not yours", the same convention every
 * other write in this app follows.
 */
export async function attachBookingToSlot(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();

  const slotId = String(formData.get("slot_id") ?? "").trim();
  const bookingId = String(formData.get("booking_id") ?? "").trim();

  if (!slotId || !bookingId) {
    return { error: "Pick a booking to attach." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("slot_bookings")
    .insert({ slot_id: slotId, booking_id: bookingId })
    .select("booking_id");

  if (error || !data?.length) {
    return { error: slotBookingWriteMessage(error) };
  }

  revalidatePath(slotPath(slotId));
  return { ok: true };
}

/**
 * Detach a Booking, dropping the Slot's Capacity by one court — back to a bare
 * proposal if it was the last one, since the Slot never changes identity
 * (ADR 0001). The Booking itself is untouched; the reservation still exists.
 */
export async function detachBookingFromSlot(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();

  const slotId = String(formData.get("slot_id") ?? "").trim();
  const bookingId = String(formData.get("booking_id") ?? "").trim();

  if (!slotId || !bookingId) {
    return { error: "Pick a booking to detach." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("slot_bookings")
    .delete()
    .eq("slot_id", slotId)
    .eq("booking_id", bookingId)
    .select("booking_id");

  if (error || !data?.length) {
    return { error: "Couldn't detach that booking. Try again." };
  }

  revalidatePath(slotPath(slotId));
  return { ok: true };
}

/**
 * Set how many players beyond the courts' own capacity a Slot expects to
 * rotate through (CONTEXT.md's Capacity entry).
 *
 * Settable on a bare proposal too — it costs nothing, and it means the buffer
 * is already right at the moment a Booking gets attached, rather than needing
 * a second visit once Capacity starts counting.
 */
export async function setRotationBuffer(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();

  const parsed = parseRotationBuffer(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("slots")
    .update({ rotation_buffer: parsed.rotationBuffer })
    .eq("id", parsed.slotId)
    .select("id");

  if (error || !data?.length) {
    return { error: "Couldn't save that rotation buffer. Try again." };
  }

  revalidatePath(slotPath(parsed.slotId));
  return { ok: true };
}

/**
 * Set or clear which of the owner's own Orgs they plan to book at for this
 * Slot (issue #36) — a hint for the Booking Window Reminder, not a
 * reservation. An empty selection clears it back to unset.
 *
 * `assert_slot_intended_org_coherent` (the migration) is what actually
 * enforces the Org belongs to the same owner as the Slot; an RLS-filtered or
 * trigger-refused write comes back as zero rows or a `23514`, both read the
 * same generic way here since neither is reachable from the picker as it
 * stands (it only ever lists the owner's own Orgs).
 */
export async function setIntendedOrg(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();

  const slotId = String(formData.get("slot_id") ?? "").trim();
  if (!slotId) {
    return { error: "Which slot is this for?" };
  }

  const orgId = String(formData.get("org_id") ?? "").trim();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("slots")
    .update({ intended_org_id: orgId || null })
    .eq("id", slotId)
    .select("id");

  if (error || !data?.length) {
    return { error: "Couldn't save that. Try again." };
  }

  revalidatePath(slotPath(slotId));
  return { ok: true };
}

/**
 * Set or clear a Slot's own notes after it's been posted — the one full-text
 * field editable outside the narrow `rotation_buffer`/`intended_org_id`
 * pattern, since the rest of a Slot's proposal (date/time, division) is fixed
 * once posted. Shares `parseSlotNotes` with `parseNewSlotProposal` so
 * create-time and edit-time validation can't drift apart.
 */
export async function setSlotNotes(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();

  const slotId = String(formData.get("slot_id") ?? "").trim();
  if (!slotId) {
    return { error: "Which slot is this for?" };
  }

  const parsed = parseSlotNotes(String(formData.get("notes") ?? ""));
  if ("error" in parsed) {
    return parsed;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("slots")
    .update({ notes: parsed.notes })
    .eq("id", slotId)
    .select("id");

  if (error || !data?.length) {
    return { error: "Couldn't save that note. Try again." };
  }

  revalidatePath(slotPath(slotId));
  return { ok: true };
}
