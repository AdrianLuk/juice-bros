"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { BOOKING_BUDDY_ROOT, BOOKINGS_PATH } from "../routes.ts";
import type { ActionResult } from "./result.ts";
import { authorizeEmailSyncForCaller } from "../email-sync-entitlement-for-caller.ts";
import { parseNewBooking } from "../bookings.ts";
import { decodeCandidate, type Candidate } from "../import-candidate-token.ts";
import { dismissCandidate, settleCandidate } from "../import-candidate-settlement.ts";
import type { MailboxProvider } from "../mailbox-provider.ts";
import {
  trackEmailSyncEvent,
  trackFacilitySyncEvent,
  trackFirstBooking,
} from "../analytics.ts";

export type { ActionResult } from "./result.ts";

/**
 * The two Server Actions every Import Candidate card posts to (issue #606):
 * confirm and dismiss, for an email, a Calendar Feed event, or both merged
 * into one card. The card posts its `candidate` token
 * (`import-candidate-token.ts`) and, to confirm, the Booking fields
 * `parseNewBooking` re-validates, the same names `CreateBookingForm` posts.
 *
 * Everything about settling is `import-candidate-settlement.ts`. What stays
 * here is what only a Server Action can do: the session, the email sync
 * entitlement for a candidate with an email source, analytics and
 * `revalidatePath`.
 */

/**
 * The provider an email source is recorded under, `null` for a feed-only
 * candidate (a Calendar Feed is available to every User, ADR-0019), or the
 * refusal to hand back.
 */
async function providerFor(
  candidate: Candidate,
): Promise<{ provider: MailboxProvider | null } | { error: string }> {
  if (candidate.messageId === null) {
    return { provider: null };
  }
  return authorizeEmailSyncForCaller();
}

/** The import event for where the candidate came from. Only a Booking this confirm created counts. */
function trackImport(candidate: Candidate, provider: MailboxProvider | null) {
  if (candidate.messageId !== null && candidate.feed !== null) {
    return trackFacilitySyncEvent("bb_sync_merged_import");
  }
  if (provider !== null) {
    return trackEmailSyncEvent("bb_email_sync_import", provider);
  }
  return trackFacilitySyncEvent("bb_facility_sync_import");
}

function revalidateBookings() {
  revalidatePath(BOOKINGS_PATH);
  revalidatePath(BOOKING_BUDDY_ROOT);
}

/** Confirm an Import Candidate: "Add to my bookings". */
export async function settleImportCandidate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const candidate = decodeCandidate(formData);
  if (!candidate) {
    return { error: "Couldn't confirm that booking. Try again." };
  }

  const gate = await providerFor(candidate);
  if ("error" in gate) return gate;

  const parsed = parseNewBooking(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const supabase = await createClient();
  const outcome = await settleCandidate(supabase, {
    ownerId: session.userId,
    candidate,
    booking: parsed,
    provider: gate.provider,
  });

  if (outcome.status === "error") {
    return { error: outcome.message };
  }

  if (outcome.status === "settled") {
    // `bb_first_booking` (#179) counts the Booking even when its Players
    // failed below: it has committed.
    after(() => trackFirstBooking(session.userId));
    if (!outcome.playersError) {
      after(() => trackImport(candidate, gate.provider));
    }
  }

  revalidateBookings();

  // The Booking and its ledger rows already committed — a failure here is
  // Players-only, reported so the User can fix them from Edit Booking.
  if (outcome.status === "settled" && outcome.playersError) {
    return { error: outcome.playersError };
  }

  return { ok: true };
}

/** Dismiss an Import Candidate. Never touches a Booking. */
export async function dismissImportCandidate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const candidate = decodeCandidate(formData);
  if (!candidate) {
    return { error: "Couldn't dismiss that. Try again." };
  }

  const gate = await providerFor(candidate);
  if ("error" in gate) return gate;

  const supabase = await createClient();
  const outcome = await dismissCandidate(supabase, {
    ownerId: session.userId,
    candidate,
    provider: gate.provider,
  });

  if (outcome.status === "error") {
    return { error: outcome.message };
  }

  revalidateBookings();
  return { ok: true };
}
