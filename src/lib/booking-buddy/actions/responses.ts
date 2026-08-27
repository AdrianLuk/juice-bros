"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { slotPath } from "../routes.ts";
import type { ActionResult } from "./result.ts";
import { parseAnswer, responseWriteMessage } from "../responses.ts";
import { slotHasNoResponsesYet, trackFunnelEvent } from "../analytics.ts";

export type { ActionResult } from "./result.ts";

/**
 * Record or change the caller's yes/no/maybe on a Slot.
 *
 * No visibility guard is re-derived here in TypeScript: the responder cannot
 * read the Slot owner's own Friend Groups (Phase 3's tables stay owner-only),
 * so there is nothing to compute `resolveVisibility` from on this side. The
 * `responses` insert/update policies gate on `can_access_slot` — the SQL
 * mirror of that same precedence — and an upsert RLS filters to zero rows
 * reads as "no permission" (`responseWriteMessage`), the same convention
 * every other write in this app already follows for an RLS-filtered write.
 *
 * Upserts on `(slot_id, user_id)` so responding again changes the existing
 * Response rather than accruing a second row — "change your response later"
 * is the same act as giving one for the first time.
 */
export async function respondToSlot(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const parsed = parseAnswer(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const supabase = await createClient();

  // Checked before the write so the upsert path (a responder changing their
  // own answer) can't re-fire `bb_slot_first_response` (#179).
  const slotWasEmpty = await slotHasNoResponsesYet(supabase, parsed.slotId);

  const { data, error } = await supabase
    .from("responses")
    .upsert(
      { slot_id: parsed.slotId, user_id: session.userId, answer: parsed.answer },
      { onConflict: "slot_id,user_id" },
    )
    .select("id");

  if (error || !data?.length) {
    return { error: responseWriteMessage(error) };
  }

  if (slotWasEmpty) {
    after(() => trackFunnelEvent("bb_slot_first_response"));
  }

  revalidatePath(slotPath(parsed.slotId));
  return { ok: true };
}
