import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { facilityLabel, formatSlotWhen } from "./slots.ts";
import { computeCapacity } from "./capacity.ts";
import type { ResponseAnswer } from "./responses.ts";

export type GuestResponse = {
  key: string;
  label: string;
  answer: ResponseAnswer;
};

/**
 * One Slot as a session-less link shows it: the Slot Link page (`/s/<token>`)
 * and the Weekly Invite answer page (`/answer/<token>`). The same fields for
 * both, so a token never reveals more than a Slot Link preview does.
 */
export type GuestSlotPreview = {
  slotId: string;
  when: string;
  /**
   * The facility this game is at — the attached court's, or the organizer's
   * Intended Org for a bare proposal, same fallback as `Slot.facilityLabel`.
   * `null` when neither is set. Both are already-resolved display snapshots
   * (`slot_bookings.org_name` / `slots.intended_org_name`), so a caller with
   * no session gets the same text a friend would without `orgs` or `bookings`
   * being touched.
   */
  facilityLabel: string | null;
  ownerName: string;
  capacity: {
    courtCount: number;
    rotationBuffer: number;
    capacity: number | null;
  };
  responses: GuestResponse[];
};

/**
 * Reads the preview of one Slot through the admin (service_role) client.
 *
 * Server-only and never a Server Action: it takes a bare Slot id, so the
 * caller must already have checked a token that grants this one Slot. `null`
 * when the Slot no longer exists.
 */
export async function readSlotPreview(
  supabase: SupabaseClient,
  slotId: string,
): Promise<GuestSlotPreview | null> {
  const { data: slotRow, error: slotError } = await supabase
    .from("slots")
    .select(
      "id, owner_id, proposed_start, proposed_end, time_zone, rotation_buffer, intended_org_name",
    )
    .eq("id", slotId)
    .maybeSingle();

  if (slotError) {
    console.error("booking-buddy: reading the linked slot failed", slotError);
    throw new Error("Could not read this slot");
  }
  if (!slotRow) {
    return null;
  }

  const [ownerProfileResult, bookingRowsResult, responseRowsResult] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", slotRow.owner_id).maybeSingle(),
    supabase.from("slot_bookings").select("format, org_name").eq("slot_id", slotRow.id),
    supabase.from("responses").select("user_id, guest_name, answer").eq("slot_id", slotRow.id),
  ]);

  if (ownerProfileResult.error || bookingRowsResult.error || responseRowsResult.error) {
    console.error(
      "booking-buddy: reading this slot's details failed",
      ownerProfileResult.error ?? bookingRowsResult.error ?? responseRowsResult.error,
    );
    throw new Error("Could not read this slot's details");
  }

  const responderIds = (responseRowsResult.data ?? [])
    .map((row) => row.user_id)
    .filter((id): id is string => id !== null);

  const { data: responderProfiles, error: responderProfilesError } =
    responderIds.length === 0
      ? { data: [], error: null }
      : await supabase.from("profiles").select("id, display_name").in("id", responderIds);

  if (responderProfilesError) {
    console.error("booking-buddy: reading who's responded failed", responderProfilesError);
    throw new Error("Could not read who's responded to this slot");
  }

  const nameById = new Map(
    (responderProfiles ?? []).map((profile) => [profile.id, profile.display_name]),
  );

  const responses: GuestResponse[] = (responseRowsResult.data ?? []).map((row) => ({
    key: row.user_id ?? `guest:${row.guest_name}`,
    label: row.user_id
      ? (nameById.get(row.user_id) ?? "A friend")
      : (row.guest_name ?? "A guest"),
    answer: row.answer,
  }));

  const bookingRows = bookingRowsResult.data ?? [];
  const formats = bookingRows.map((row) => row.format);

  return {
    slotId: slotRow.id,
    when: formatSlotWhen({
      proposedStart: slotRow.proposed_start,
      proposedEnd: slotRow.proposed_end,
      timeZone: slotRow.time_zone,
    }),
    // Booked court's facility wins; a bare proposal falls back to the
    // Intended Org, same as the signed-in game row and detail page.
    facilityLabel:
      facilityLabel(bookingRows.map((row) => row.org_name)) ?? slotRow.intended_org_name,
    ownerName: ownerProfileResult.data?.display_name ?? "A Juice Bros member",
    capacity: {
      courtCount: formats.length,
      rotationBuffer: slotRow.rotation_buffer,
      capacity: computeCapacity({ formats, rotationBuffer: slotRow.rotation_buffer }),
    },
    responses,
  };
}
