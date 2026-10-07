import "server-only";

import { verifySession } from "./dal.ts";
import { getOwnProfile } from "./actions/profile.ts";
import { readEmailSyncAllowlist } from "./env.ts";
import type { MailboxProvider } from "./mailbox-provider.ts";
import {
  decideCanConnect,
  decideEmailSyncEntitlement,
  type EmailSyncEntitlement,
  type EntitlementLink,
} from "./email-sync-entitlement.ts";

/**
 * The signed-in User's email sync entitlement — the reads around
 * `decideCanConnect` and `decideEmailSyncEntitlement`.
 *
 * Neither reads the Mailbox Link: the link is the caller's to fetch with
 * `getMailboxLink` (every one that needs sync already has it, or wants to
 * handle a failed read its own way), and a caller that only asks about
 * connecting never needs it. A caller that already holds the profile's
 * Username (the Settings page does) passes it as `prefetched`, so this stays
 * the convenience path rather than a second query on top of one it already ran.
 *
 * Throws if the profile read fails, like every other page-level read here:
 * guessing "not entitled" would tell a User with a working mailbox that they
 * aren't approved.
 */

type Prefetched = { username?: string | null };

async function readAllowlistInputs(prefetched: Prefetched) {
  const session = await verifySession();
  const username =
    prefetched.username !== undefined
      ? prefetched.username
      : (await getOwnProfile()).username;

  return { username, email: session.email, allowlistEnv: readEmailSyncAllowlist() };
}

/** May the signed-in User sync, and under which provider — given their Mailbox Link (`null` if none). */
export async function getEmailSyncEntitlementForCaller(
  link: EntitlementLink,
  prefetched: Prefetched = {},
): Promise<EmailSyncEntitlement> {
  return decideEmailSyncEntitlement({ ...(await readAllowlistInputs(prefetched)), link });
}

/** May the signed-in User start connecting `provider` — no Mailbox Link needed. */
export async function canConnectMailboxForCaller(
  provider: MailboxProvider,
  prefetched: Prefetched = {},
): Promise<boolean> {
  return decideCanConnect(await readAllowlistInputs(prefetched))[provider];
}
