import "server-only";

import { createAdminClient } from "./supabase/admin.ts";
import { emailToUserFromEnv } from "./email-to-user.ts";
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
  /** The skipped week's date (`YYYY-MM-DD`), named in the email. */
  gameDate: string;
  gamesUrl: string;
}): Promise<void> {
  if (params.recipientIds.length === 0) {
    return;
  }

  try {
    const supabase = createAdminClient();
    const emailToUser = emailToUserFromEnv(supabase, "game-off-notify");
    if (!emailToUser) {
      return;
    }

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
      gameDate: params.gameDate,
      gamesUrl: params.gamesUrl,
      weeklyGameContinues: Boolean(standingGame) && standingGame?.ended_at === null,
    });

    for (const userId of params.recipientIds) {
      await emailToUser(userId, { subject, html });
    }
  } catch (error) {
    console.error("game-off-notify: unexpected failure", error);
  }
}
