"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { SLOTS_PATH } from "../routes.ts";
import { readFailed, type ActionResult } from "./result.ts";
import { formatSlotWhen, parseNewSlotProposal, slotWriteMessage } from "../slots.ts";
import type { ResponseAnswer } from "../responses.ts";

export type { ActionResult } from "./result.ts";

export type Slot = {
  id: string;
  ownerId: string;
  /** Display name of whoever proposed it — "You" is resolved by the caller, not here. */
  ownerName: string;
  /** Already rendered in the Slot's own zone — see `formatSlotWhen`. */
  when: string;
  proposedStart: string;
};

export type SlotResponse = {
  userId: string;
  /** A profile the viewer can't read (no Connection to that responder) still counts, just unnamed. */
  displayName: string | null;
  answer: ResponseAnswer;
};

export type SlotDetail = {
  slot: Slot;
  isOwner: boolean;
  responses: SlotResponse[];
  /** The caller's own answer, if they've given one. */
  myAnswer: ResponseAnswer | null;
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
    .select("user_id, guest_name, answer")
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
          .select("id, display_name")
          .in("id", responderIds);

  if (profilesError) {
    readFailed("who's responded to this slot", profilesError);
  }

  const nameById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.display_name]),
  );

  const responses: SlotResponse[] = (responseRows ?? [])
    // Guest responses aren't rendered until issue #10 wires up the Guest path.
    .filter((row) => row.user_id !== null)
    .map((row) => ({
      userId: row.user_id!,
      displayName: nameById.get(row.user_id!) ?? null,
      answer: row.answer,
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
  });

  const own: Slot[] = [];
  const friends: Slot[] = [];
  for (const row of rows ?? []) {
    (row.owner_id === session.userId ? own : friends).push(toSlot(row));
  }

  return { own, friends };
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
    .select("id, owner_id, proposed_start, proposed_end, time_zone")
    .eq("id", slotId)
    .maybeSingle();

  if (slotError) {
    readFailed("that slot", slotError);
  }
  if (!slotRow) {
    return null;
  }

  const [{ responses, myAnswer }, ownerProfileResult] = await Promise.all([
    getSlotResponses(slotId),
    supabase.from("profiles").select("display_name").eq("id", slotRow.owner_id).maybeSingle(),
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
    },
    isOwner: slotRow.owner_id === session.userId,
    responses,
    myAnswer,
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
  });

  if (error) {
    return { error: slotWriteMessage(error) };
  }

  revalidatePath(SLOTS_PATH);
  return { ok: true };
}
