"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { createAdminClient } from "../supabase/admin.ts";
import { slotHasNoResponsesYet, trackFunnelEvent } from "../analytics.ts";
import { formatSlotWhen } from "../slots.ts";
import { computeCapacity } from "../capacity.ts";
import {
  GUEST_RSVP_SOFT_THRESHOLD,
  guestRsvpMessage,
  parseGuestRsvp,
} from "../slot-links.ts";
import { slotLinkPath } from "../routes.ts";
import type { ResponseAnswer } from "../responses.ts";
import type { ActionResult } from "./result.ts";

export type { ActionResult } from "./result.ts";

export type GuestResponse = {
  key: string;
  label: string;
  answer: ResponseAnswer;
};

export type GuestSlotPreview = {
  slotId: string;
  when: string;
  ownerName: string;
  capacity: {
    courtCount: number;
    rotationBuffer: number;
    capacity: number | null;
  };
  responses: GuestResponse[];
};

/**
 * What a Guest sees at `/s/[token]` — the one Slot the link was generated
 * for, nothing else about the organizer (CONTEXT.md's Slot Link entry).
 *
 * Runs entirely through the admin (service_role) client: a Guest has no
 * Supabase session, so there is no `auth.uid()` for RLS to gate on. The
 * token itself is the only authorization check, done here in application
 * code before any row is read — the same hybrid posture ADR 0003 already
 * uses for `place_cache`, extended to a caller with no session at all.
 *
 * `null` for a missing or already-revoked token — a public page, so this
 * renders as "this invite isn't valid" rather than a generic 404.
 */
export async function getSlotByToken(token: string): Promise<GuestSlotPreview | null> {
  const supabase = createAdminClient();

  const { data: link, error: linkError } = await supabase
    .from("slot_links")
    .select("id, slot_id")
    .eq("token", token)
    .maybeSingle();

  if (linkError) {
    console.error("booking-buddy: reading a slot link failed", linkError);
    throw new Error("Could not read this invite link");
  }
  if (!link) {
    return null;
  }

  const { data: slotRow, error: slotError } = await supabase
    .from("slots")
    .select("id, owner_id, proposed_start, proposed_end, time_zone, rotation_buffer")
    .eq("id", link.slot_id)
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
    supabase.from("slot_bookings").select("format").eq("slot_id", slotRow.id),
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

  const formats = (bookingRowsResult.data ?? []).map((row) => row.format);

  return {
    slotId: slotRow.id,
    when: formatSlotWhen({
      proposedStart: slotRow.proposed_start,
      proposedEnd: slotRow.proposed_end,
      timeZone: slotRow.time_zone,
    }),
    ownerName: ownerProfileResult.data?.display_name ?? "A Juice Bros member",
    capacity: {
      courtCount: formats.length,
      rotationBuffer: slotRow.rotation_buffer,
      capacity: computeCapacity({ formats, rotationBuffer: slotRow.rotation_buffer }),
    },
    responses,
  };
}

/** First entry in a comma-separated `X-Forwarded-For` — the client closest to the request. */
function clientIp(forwardedFor: string | null): string | null {
  if (!forwardedFor) {
    return null;
  }
  const first = forwardedFor.split(",")[0]?.trim();
  return first || null;
}

/**
 * Records a Guest's yes/no/maybe on the Slot behind a Slot Link.
 *
 * Bypasses the Connection/Visibility check entirely — a valid token is the
 * whole authorization, per CONTEXT.md's Slot Link entry — and never touches
 * `connections`, so no Connection is created (issue #10's acceptance
 * criteria). Every attempt is logged with IP, user agent and timestamp
 * (Q7); repeated attempts from the same IP against this link past a soft
 * threshold are flagged in that log, not blocked.
 */
export async function guestRespondViaLink(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseGuestRsvp(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const supabase = createAdminClient();

  const { data: link, error: linkError } = await supabase
    .from("slot_links")
    .select("id, slot_id")
    .eq("token", parsed.token)
    .maybeSingle();

  if (linkError) {
    console.error("booking-buddy: reading a slot link failed", linkError);
    return { error: guestRsvpMessage("write_failed") };
  }
  if (!link) {
    return { error: guestRsvpMessage("invalid_token") };
  }

  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders.get("x-forwarded-for"));
  const userAgent = requestHeaders.get("user-agent");

  // Checked before the insert, same as the signed-in `respondToSlot` path, so
  // `bb_slot_first_response` (#179) fires on the 0 -> 1 transition only.
  const slotWasEmpty = await slotHasNoResponsesYet(supabase, link.slot_id);

  const { error: responseError } = await supabase.from("responses").insert({
    slot_id: link.slot_id,
    guest_name: parsed.guestName,
    answer: parsed.answer,
  });

  if (responseError) {
    console.error("booking-buddy: recording a guest RSVP failed", responseError);
    return { error: guestRsvpMessage("write_failed") };
  }

  if (slotWasEmpty) {
    after(() => trackFunnelEvent("bb_slot_first_response"));
  }

  // Best-effort: the RSVP itself already succeeded, and a logging hiccup
  // shouldn't read to the Guest as their RSVP having failed — same posture
  // `listOrgs` already takes toward a failed `place_cache` read.
  let flagged = false;
  if (ip) {
    const { count, error: countError } = await supabase
      .from("guest_rsvp_log")
      .select("id", { count: "exact", head: true })
      .eq("slot_link_id", link.id)
      .eq("ip", ip);

    if (countError) {
      console.error("booking-buddy: counting prior guest RSVPs failed", countError);
    } else {
      flagged = (count ?? 0) >= GUEST_RSVP_SOFT_THRESHOLD;
    }
  }

  const { error: logError } = await supabase.from("guest_rsvp_log").insert({
    slot_link_id: link.id,
    guest_name: parsed.guestName,
    ip,
    user_agent: userAgent,
    flagged,
  });

  if (logError) {
    console.error("booking-buddy: logging a guest RSVP failed", logError);
  }

  revalidatePath(slotLinkPath(parsed.token));
  return { ok: true };
}
