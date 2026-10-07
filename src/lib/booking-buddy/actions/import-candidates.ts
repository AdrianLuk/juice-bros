"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { BOOKING_BUDDY_ROOT, BOOKINGS_PATH } from "../routes.ts";
import type { ActionResult } from "./result.ts";
import { authorizeEmailSyncForCaller } from "../email-sync-entitlement-for-caller.ts";
import { parseNewBooking, parseUpdateApplication } from "../bookings.ts";
import {
  decodeCandidate,
  type Candidate,
  type ImportCandidate,
} from "../import-candidate-token.ts";
import {
  CONFIRM_FAILED,
  DISMISS_FAILED,
  confirmCandidate,
  dismissCandidate,
  type ConfirmRequest,
} from "../import-candidate-settlement.ts";
import type { MailboxProvider } from "../mailbox-provider.ts";
import {
  trackEmailSyncEvent,
  trackFacilitySyncEvent,
  trackFirstBooking,
} from "../analytics.ts";

export type { ActionResult } from "./result.ts";

/**
 * The two Server Actions every Import Candidate card posts to (issue #606):
 * confirm and dismiss, for an import, a cancellation or an update, from an
 * email, a Calendar Feed event, or both merged into one card. The card posts
 * its `candidate` token (`import-candidate-token.ts`) and, to confirm an
 * import or an update, the Booking fields `parseNewBooking` or
 * `parseUpdateApplication` re-validates.
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
function trackImport(candidate: ImportCandidate, provider: MailboxProvider | null) {
  if (candidate.messageId !== null && candidate.feed !== null) {
    return trackFacilitySyncEvent("bb_sync_merged_import");
  }
  if (provider !== null) {
    return trackEmailSyncEvent("bb_email_sync_import", provider);
  }
  return trackFacilitySyncEvent("bb_facility_sync_import");
}

/** The candidate with the Booking fields its kind re-validates from the form, or the reason it can't be confirmed. */
function confirmRequestFor(
  candidate: Candidate,
  formData: FormData,
): ConfirmRequest | { error: string } {
  switch (candidate.kind) {
    case "import": {
      const booking = parseNewBooking(formData);
      return "error" in booking ? booking : { kind: "import", candidate, booking };
    }
    case "update": {
      const update = parseUpdateApplication(formData);
      return "error" in update ? update : { kind: "update", candidate, update };
    }
    case "cancellation":
      return { kind: "cancellation", candidate };
  }
}

function revalidateBookings() {
  revalidatePath(BOOKINGS_PATH);
  revalidatePath(BOOKING_BUDDY_ROOT);
}

/** Confirm an Import Candidate: "Add to my bookings", "Remove booking" or "Apply update". */
export async function confirmImportCandidate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const candidate = decodeCandidate(formData);
  if (!candidate) {
    return { error: CONFIRM_FAILED };
  }

  const gate = await providerFor(candidate);
  if ("error" in gate) return gate;

  const request = confirmRequestFor(candidate, formData);
  if ("error" in request) {
    return request;
  }

  const supabase = await createClient();
  const outcome = await confirmCandidate(supabase, {
    ownerId: session.userId,
    provider: gate.provider,
    ...request,
  });

  if (outcome.status === "error") {
    return { error: outcome.message };
  }

  if (outcome.status === "settled" && candidate.kind === "import") {
    // `bb_first_booking` (#179) counts the Booking even when its Players
    // failed below: it has committed.
    after(() => trackFirstBooking(session.userId));
    if (!outcome.playersError) {
      after(() => trackImport(candidate, gate.provider));
    }
  }
  if (candidate.kind === "cancellation" && candidate.feed !== null) {
    after(() => trackFacilitySyncEvent("bb_facility_sync_cancellation"));
  }

  revalidateBookings();

  // The Booking and its ledger rows already committed — a failure here is
  // Players-only, reported so the User can fix them from Edit Booking.
  if (outcome.status === "settled" && outcome.playersError) {
    return { error: outcome.playersError };
  }

  return { ok: true };
}

/** Dismiss an Import Candidate, or "Keep booking" on a cancellation. Never touches a Booking. */
export async function dismissImportCandidate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const candidate = decodeCandidate(formData);
  if (!candidate) {
    return { error: DISMISS_FAILED };
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
