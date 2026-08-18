"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { slotPath, slotLinkPath } from "../routes.ts";
import type { ActionResult } from "./result.ts";
import { generateSlotLinkToken, slotLinkWriteMessage } from "../slot-links.ts";
import { absoluteAppUrl } from "../request-origin.ts";

export type { ActionResult } from "./result.ts";

/** The Slot's own absolute Slot Link — see `request-origin.ts`. */
async function absoluteSlotLinkUrl(token: string): Promise<string> {
  return absoluteAppUrl(slotLinkPath(token));
}

export type SlotLink = { token: string; url: string };

/** The Slot's Slot Link, if the owner has generated one — owner-only, per RLS. */
export async function getSlotLink(slotId: string): Promise<SlotLink | null> {
  await verifySession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("slot_links")
    .select("token")
    .eq("slot_id", slotId)
    .maybeSingle();

  if (error) {
    console.error("booking-buddy: reading this slot's invite link failed", error);
    throw new Error("Could not read this slot's invite link");
  }
  if (!data) {
    return null;
  }

  return { token: data.token, url: await absoluteSlotLinkUrl(data.token) };
}

/**
 * Creates the Slot's Slot Link, or hands back the existing one — CONTEXT.md
 * describes "its Slot Link" as one per Slot, so generating twice reuses
 * rather than mints a second token that would still work but confuse anyone
 * who saved the first.
 *
 * Ownership isn't re-checked here: the insert policy on `slot_links` is
 * "only into a slot you own", so an RLS-filtered insert on someone else's
 * Slot raises (an INSERT failing WITH CHECK does, unlike an UPDATE/DELETE —
 * the same distinction `slots.test.sql` already documents), and
 * `slotLinkWriteMessage` reads that as an ownership failure.
 */
export async function generateSlotLink(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();

  const slotId = String(formData.get("slot_id") ?? "").trim();
  if (!slotId) {
    return { error: "Which slot is this for?" };
  }

  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("slot_links")
    .select("id")
    .eq("slot_id", slotId)
    .maybeSingle();

  if (existingError) {
    return { error: slotLinkWriteMessage(existingError) };
  }
  if (existing) {
    return { ok: true };
  }

  const { error } = await supabase
    .from("slot_links")
    .insert({ slot_id: slotId, token: generateSlotLinkToken() });

  if (error) {
    return { error: slotLinkWriteMessage(error) };
  }

  revalidatePath(slotPath(slotId));
  return { ok: true };
}
