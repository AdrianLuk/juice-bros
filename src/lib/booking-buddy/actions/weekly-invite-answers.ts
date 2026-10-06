"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createAdminClient } from "../supabase/admin.ts";
import { slotHasNoResponsesYet, trackFunnelEvent } from "../analytics.ts";
import { slotPath, weeklyInviteAnswerPath } from "../routes.ts";
import { isWeeklyInviteToken, parseWeeklyInviteAnswer } from "../weekly-invites.ts";

/**
 * The answer page's confirm (issue #580, ADR 0022): sets the token's
 * Regular's Response to the token's Slot, then lands back on the page.
 *
 * The only write a Weekly Invite link can make, and only ever from this POST:
 * the page's GET reads and nothing else. Runs through the service role (the
 * Regular may have no session, and may lack Visibility of the organizer's
 * games), but the database function takes nothing except the token and the
 * answer, so it cannot answer another game or as anyone else. A plain form
 * action that redirects, so it works with JavaScript off.
 */
export async function answerWeeklyInvite(formData: FormData): Promise<void> {
  const parsed = parseWeeklyInviteAnswer(formData);
  if ("error" in parsed) {
    // Only a well-formed token goes back into the redirect path.
    const token = String(formData.get("token") ?? "").trim();
    redirect(`${weeklyInviteAnswerPath(isWeeklyInviteToken(token) ? token : "unknown")}?failed=1`);
  }

  const { token, answer } = parsed;
  const supabase = createAdminClient();

  // Read first, for the Slot whose page to refresh and whether this is its
  // first Response (`bb_slot_first_response`, as on the Slot page).
  const { data: links, error: readError } = await supabase.rpc("read_weekly_invite", {
    invite_token: token,
  });
  const link = (links as { slot_id: string; state: string }[] | null)?.[0];
  if (readError || !link || link.state !== "open") {
    if (readError) {
      console.error("booking-buddy: reading a weekly invite link failed", readError);
    }
    // The page itself says why: invalid, or the game has started.
    redirect(weeklyInviteAnswerPath(token));
  }

  const slotWasEmpty = await slotHasNoResponsesYet(supabase, link.slot_id);

  const { data: outcome, error } = await supabase.rpc("answer_weekly_invite", {
    invite_token: token,
    chosen_answer: answer,
  });
  if (error) {
    console.error("booking-buddy: answering a weekly invite failed", error);
    redirect(`${weeklyInviteAnswerPath(token)}?failed=1`);
  }
  if (outcome !== "answered") {
    redirect(weeklyInviteAnswerPath(token));
  }

  after(() => trackFunnelEvent("bb_weekly_invite_answered", { answer }));
  if (slotWasEmpty) {
    after(() => trackFunnelEvent("bb_slot_first_response"));
  }

  revalidatePath(slotPath(link.slot_id));
  redirect(`${weeklyInviteAnswerPath(token)}?saved=1`);
}
