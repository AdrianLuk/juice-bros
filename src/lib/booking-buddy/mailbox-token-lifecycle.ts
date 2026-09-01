import "server-only";

import { revalidatePath } from "next/cache";

import type { createClient } from "./supabase/server.ts";
import { SETTINGS_PATH } from "./routes.ts";
import { decryptRefreshToken, encryptRefreshToken } from "./token-encryption.ts";
import type { MailAdapter } from "./mail-adapter.ts";

type MailboxSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type MailboxAccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; reason: "reconnect_required" }
  | { ok: false; reason: "unreachable" };

/**
 * The one place a Mailbox Link's stored refresh token becomes a live access
 * token (spec #280): decrypt it, hand it to the adapter's `refreshAccessToken`,
 * **persist the rotated refresh token when the adapter returns one** (Microsoft
 * rotates on every exchange and the old token stops working; Google never
 * does), and mark the link `expired` on an `invalid_grant` so the UI shows a
 * reconnect prompt instead of a raw error. Every sync path goes through here so
 * the rotation + expiry bookkeeping lives in exactly one place, not once per
 * provider.
 *
 * A refresh token that no longer decrypts (a rotated encryption key, a
 * corrupted row) is reported as `reconnect_required` — just as unusable as an
 * expired one, and the User's fix is the same either way.
 */
export async function resolveMailboxAccessToken(params: {
  supabase: MailboxSupabaseClient;
  ownerId: string;
  adapter: MailAdapter;
  encryptedRefreshToken: string;
  encryptionKey: string;
}): Promise<MailboxAccessTokenResult> {
  const { supabase, ownerId, adapter, encryptedRefreshToken, encryptionKey } = params;

  const decrypted = decryptRefreshToken(encryptedRefreshToken, encryptionKey);
  if (!decrypted.ok) {
    console.error("booking-buddy: decrypting the Mailbox Link's refresh token failed");
    return { ok: false, reason: "reconnect_required" };
  }

  const refreshed = await adapter.refreshAccessToken(decrypted.plainText);
  if (!refreshed.ok) {
    if (refreshed.reason === "invalid_grant") {
      await supabase.from("mailbox_links").update({ status: "expired" }).eq("owner_id", ownerId);
      revalidatePath(SETTINGS_PATH);
      return { ok: false, reason: "reconnect_required" };
    }
    return { ok: false, reason: "unreachable" };
  }

  if (refreshed.refreshToken && refreshed.refreshToken !== decrypted.plainText) {
    const { error } = await supabase
      .from("mailbox_links")
      .update({ encrypted_refresh_token: encryptRefreshToken(refreshed.refreshToken, encryptionKey) })
      .eq("owner_id", ownerId);

    if (error) {
      // Non-fatal for this sync — the access token just returned is still
      // good. A rotated refresh token not persisted here keeps working until
      // its provider's sliding window lapses; the next sync tries again.
      console.error("booking-buddy: persisting a rotated Mailbox Link refresh token failed", error);
    }
  }

  return { ok: true, accessToken: refreshed.accessToken };
}
