import "server-only";

import { verifySession } from "./dal.ts";
import { createClient } from "./supabase/server.ts";
import { readFailed } from "./actions/result.ts";
import { getOwnProfile } from "./actions/profile.ts";
import { readEmailSyncAllowlist } from "./env.ts";
import {
  decideEmailSyncEntitlement,
  type EmailSyncEntitlement,
  type EntitlementLink,
} from "./email-sync-entitlement.ts";

/**
 * The signed-in User's email sync entitlement — the reads around
 * `decideEmailSyncEntitlement`.
 *
 * A caller that already holds the profile's Username or the Mailbox Link (the
 * pages do) passes it in, so this stays the convenience path rather than a
 * second query on top of one the caller already ran. `link: null` means "known
 * to have none"; leaving it out means "go and look".
 *
 * Throws if a read fails, like every other page-level read here: guessing
 * "not entitled" would tell a User with a working mailbox that they aren't
 * approved.
 */
export async function getEmailSyncEntitlement(
  known: { username?: string | null; link?: EntitlementLink } = {},
): Promise<EmailSyncEntitlement> {
  const session = await verifySession();

  const [username, link] = await Promise.all([
    known.username !== undefined ? known.username : getOwnProfile().then((profile) => profile.username),
    known.link !== undefined ? known.link : readEntitlementLink(session.userId),
  ]);

  return decideEmailSyncEntitlement({
    username,
    email: session.email,
    allowlistEnv: readEmailSyncAllowlist(),
    link,
  });
}

async function readEntitlementLink(userId: string): Promise<EntitlementLink> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mailbox_links")
    .select("provider, status")
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) {
    readFailed("your mailbox connection", error);
  }

  return data ? { provider: data.provider, status: data.status } : null;
}
