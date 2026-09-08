"use server";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import {
  deleteDismissedReservations,
  readDismissedSlotPost,
} from "../dismissed-reservations.ts";
import type { ActionResult } from "./result.ts";

export type { ActionResult } from "./result.ts";

/**
 * "Offer this again" (issue #444) — the un-dismiss, from the review screen's
 * list of reservations a sync dropped against `dismissed_reservations`.
 *
 * Its own action file rather than a fifth export on `actions/email-sync.ts` or
 * `actions/calendar-feed.ts`, because it belongs to neither source: the whole
 * point of the slot key is that one dismissal covers both, and one un-dismiss
 * has to as well. Putting it under either source's module would make the
 * cross-source rule read as that source's business.
 *
 * The slot arrives as the same four hidden fields a Dismiss posts
 * (`DismissedSlotFields` / `readDismissedSlotPost`), which is what lets the
 * two stay in step: whatever a dismissal can record, this can take back.
 *
 * No authorization beyond the session. `authorizeEmailSyncForCaller`, which
 * guards the email actions, exists to enforce Google's Testing-mode allowlist
 * on people *reaching a mailbox*; nothing here reaches one. RLS and the
 * `owner_id` filter already confine the delete to the caller's own rows, and a
 * tampered post can only un-suppress one of the caller's own future
 * candidates — strictly less than the dismiss it mirrors already accepts.
 *
 * What it deliberately does not do is touch the source-side ledgers. The
 * `processed_messages` row is write-once by design and could not be undone
 * anyway, and the `dismissed` `org_feed_events` row is left standing too, so
 * this is not a replay of the message or the feed event the User dismissed —
 * that event is still theirs to have said no to. It is narrower and more
 * useful than that: the *slot* stops being suppressed, so the reservation that
 * arrives under a fresh message id or a fresh VEVENT UID, which is what a
 * cancel-and-rebook produces, is offered again.
 */
export async function offerDismissedReservationAgain(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const slot = readDismissedSlotPost(formData);
  if (!slot) {
    return { error: "Couldn't offer that again. Try again." };
  }

  const supabase = await createClient();
  const { ok } = await deleteDismissedReservations(supabase, session.userId, slot);

  if (!ok) {
    return { error: "Couldn't offer that again. Try again." };
  }

  return { ok: true };
}
