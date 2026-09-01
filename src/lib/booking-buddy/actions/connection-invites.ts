"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createAdminClient } from "../supabase/admin.ts";
import { trackFunnelEvent } from "../analytics.ts";
import { FRIENDS_PATH, connectLinkPath } from "../routes.ts";
import { parseConnectionRequestAction } from "../connection-request-email.ts";
import {
  notifyConnectionAccepted,
  respondToConnectionRequest,
} from "../connection-request-notify.ts";

/**
 * Accept or Decline a friend request from its email link (`/connect/<token>`,
 * issue #228). No `verifySession`: the single-use token is the authorization,
 * the same posture `guestRespondViaLink` takes for a Slot Link. The RLS
 * "only the addressee answers" policy still guards the signed-in Friends-page
 * path — this action reaches `connections` through `service_role` instead.
 *
 * Always redirects back to the same page with `?done=...`, which the page
 * renders as the terminal state. A GET of the link only ever renders; this
 * POST is the sole thing that mutates, so an inbox link-prefetcher can't
 * accept or decline on the recipient's behalf.
 */
export async function respondToConnectionRequestAction(
  formData: FormData,
): Promise<void> {
  const token = String(formData.get("token") ?? "").trim();
  const action = parseConnectionRequestAction(String(formData.get("a") ?? ""));

  if (!token || !action) {
    redirect(`${connectLinkPath(token || "unknown")}?done=failed`);
  }

  const { outcome, addresseeId, connectionId } =
    await respondToConnectionRequest(token, action);

  if (outcome === "accepted" && connectionId) {
    // Tell the requester their request went through (best-effort, after the
    // response — same as the friend-request email on the way in).
    after(() => notifyConnectionAccepted(connectionId));
  }

  if (outcome === "accepted" && addresseeId) {
    // The requester's own first-friend funnel moment is already untracked
    // (see `trackFirstFriend`), and this session-less path has no user client
    // to count the accepter's connections through. Emit the event only when
    // we can be cheap and certain: skip the "is it their first?" check here
    // rather than open a second admin read on every accept.
    after(() => countAndMaybeTrackFirstFriend(addresseeId));
  }

  if (outcome === "accepted" || outcome === "declined") {
    // A signed-in addressee may have the Friends page open in another tab.
    revalidatePath(FRIENDS_PATH);
  }

  redirect(`${connectLinkPath(token)}?done=${outcome}`);
}

/**
 * `after()` helper: emit `bb_first_friend` if this accept is the addressee's
 * first accepted Connection. Mirrors `trackFirstFriend` in `analytics.ts` but
 * counts through the admin client, since the email-link path has no session.
 */
async function countAndMaybeTrackFirstFriend(addresseeId: string): Promise<void> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("connections")
    .select("id", { count: "exact", head: true })
    .eq("status", "accepted")
    .or(`requester_id.eq.${addresseeId},addressee_id.eq.${addresseeId}`);

  if (error) {
    console.error("connection-invites: counting connections for the funnel failed", error);
    return;
  }
  if (count === 1) {
    await trackFunnelEvent("bb_first_friend");
  }
}
