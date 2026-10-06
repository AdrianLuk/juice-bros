import "server-only";

import { Resend } from "resend";

import { createAdminClient } from "./supabase/admin.ts";
import { personOptionLabel } from "./connections.ts";
import { formatGameOffEmail } from "./game-off-email.ts";

/**
 * The I/O behind the "it's off" email (issue #578). Who to tell is decided
 * before the Slot is deleted (`gameOffRecipients`, since their Responses go
 * with it); this sends to them afterwards, from `after()`.
 *
 * Admin client for the same reason the connection emails use one: the
 * recipients' addresses live in `auth.users`, which no User's grant reaches.
 * Best-effort throughout: every exit is a `return`, each send is separate so
 * one bad address doesn't stop the rest, and nothing here can undo or fail
 * the skip that triggered it.
 */
export async function notifyGameOff(params: {
  recipientIds: readonly string[];
  ownerId: string;
  standingGameId: string;
  slotWhen: string;
  gamesUrl: string;
}): Promise<void> {
  if (params.recipientIds.length === 0) {
    return;
  }

  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.REMINDER_FROM_EMAIL;
    if (!apiKey || !from) {
      console.error("game-off-notify: missing RESEND_API_KEY or REMINDER_FROM_EMAIL.");
      return;
    }

    const supabase = createAdminClient();

    const [{ data: owner }, { data: standingGame }] = await Promise.all([
      supabase.from("profiles").select("display_name, username").eq("id", params.ownerId).maybeSingle(),
      supabase.from("standing_games").select("ended_at").eq("id", params.standingGameId).maybeSingle(),
    ]);

    const { subject, html } = formatGameOffEmail({
      organizerLabel: personOptionLabel({
        displayName: owner?.display_name ?? null,
        username: owner?.username ?? null,
      }),
      slotWhen: params.slotWhen,
      shortDay: params.slotWhen.split(" · ")[0]?.replace(/,\s*\d{4}$/, "") ?? params.slotWhen,
      gamesUrl: params.gamesUrl,
      weeklyGameContinues: Boolean(standingGame) && standingGame?.ended_at === null,
    });

    const resend = new Resend(apiKey);
    for (const userId of params.recipientIds) {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
      const to = userData?.user?.email;
      if (userError || !to) {
        console.error("game-off-notify: no email for recipient", userId, userError);
        continue;
      }

      const { error: sendError } = await resend.emails.send({ from, to, subject, html });
      if (sendError) {
        console.error("game-off-notify: Resend error", sendError);
      }
    }
  } catch (error) {
    console.error("game-off-notify: unexpected failure", error);
  }
}
