import "server-only";

import { createAdminClient } from "./supabase/admin.ts";
import { personOptionLabel } from "./connections.ts";
import { readSlotPreview, type GuestSlotPreview } from "./slot-preview.ts";
import { isWeeklyInviteToken } from "./weekly-invites.ts";
import type { ResponseAnswer } from "./responses.ts";

/**
 * What a Weekly Invite answer link opens (issue #580, ADR 0022):
 *   * `null`: no such live token (mistyped, the game was deleted or skipped,
 *     or the Regular is no longer the organizer's Connection);
 *   * `started`: the game has begun, so the link only says so;
 *   * `open`: the game as a Slot Link preview shows it, whose answer this is,
 *     and their current Response.
 */
export type WeeklyInviteView =
  | null
  | { state: "started"; when: string }
  | {
      state: "open";
      preview: GuestSlotPreview;
      regularLabel: string;
      currentAnswer: ResponseAnswer | null;
    };

/**
 * Reads what `/answer/<token>` shows, through the admin client: the reader
 * has no session, and the token is the only authorization. Never writes,
 * so a mail scanner following the link changes nothing. Server-only and not
 * a Server Action.
 */
export async function getWeeklyInviteByToken(token: string): Promise<WeeklyInviteView> {
  if (!isWeeklyInviteToken(token)) {
    return null;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("read_weekly_invite", { invite_token: token });
  if (error) {
    console.error("booking-buddy: reading a weekly invite link failed", error);
    throw new Error("Could not read this invite link");
  }

  const link = (data as { slot_id: string; user_id: string; state: string }[] | null)?.[0];
  if (!link) {
    return null;
  }

  const preview = await readSlotPreview(supabase, link.slot_id);
  if (!preview) {
    return null;
  }
  if (link.state !== "open") {
    return { state: "started", when: preview.when };
  }

  const [profileResult, responseResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", link.user_id)
      .maybeSingle(),
    supabase
      .from("responses")
      .select("answer")
      .eq("slot_id", link.slot_id)
      .eq("user_id", link.user_id)
      .maybeSingle(),
  ]);
  if (profileResult.error || responseResult.error) {
    console.error(
      "booking-buddy: reading a weekly invite's regular failed",
      profileResult.error ?? responseResult.error,
    );
    throw new Error("Could not read this invite");
  }

  return {
    state: "open",
    preview,
    regularLabel: profileResult.data
      ? personOptionLabel({
          displayName: profileResult.data.display_name,
          username: profileResult.data.username,
        })
      : "you",
    currentAnswer: (responseResult.data?.answer as ResponseAnswer | undefined) ?? null,
  };
}
