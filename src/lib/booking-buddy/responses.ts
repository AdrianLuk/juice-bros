/**
 * Pure input handling for Responses (see CONTEXT.md).
 *
 * Free of Next.js and Supabase imports on purpose. The limits mirror the
 * `responses` migration — change one and you must change the other.
 */

export type ResponseAnswer = "yes" | "no" | "maybe";

const ANSWERS: readonly ResponseAnswer[] = ["yes", "no", "maybe"];

export function isResponseAnswer(value: unknown): value is ResponseAnswer {
  return ANSWERS.includes(value as ResponseAnswer);
}

export function parseAnswer(
  formData: FormData,
): { slotId: string; answer: ResponseAnswer } | { error: string } {
  const slotId = String(formData.get("slot_id") ?? "").trim();
  if (!slotId) {
    return { error: "Which slot is this for?" };
  }

  const answer = formData.get("answer");
  // Never defaulted to "no" or anything else — an answer that didn't arrive
  // is not the same as a Response, and shouldn't quietly become one.
  if (!isResponseAnswer(answer)) {
    return { error: "Pick yes, no, or maybe." };
  }

  return { slotId, answer };
}

/**
 * Turns a failed Response write into something worth reading.
 *
 * `error` is `null` when the write ran without error but matched zero rows —
 * which for an insert or update gated by `can_access_slot` means the
 * responder has no Visibility into that Slot (the migration comment on
 * `responses` explains why that check lives in SQL rather than being
 * re-derived from `resolveVisibility` here: the responder cannot read the
 * Slot owner's own Friend Groups to compute it themselves). A real `error`
 * means something else went wrong.
 */
export function responseWriteMessage(error: { code?: string } | null): string {
  if (error) {
    return "Couldn't save that response. Try again.";
  }

  return "You don't have permission to respond to this slot.";
}
