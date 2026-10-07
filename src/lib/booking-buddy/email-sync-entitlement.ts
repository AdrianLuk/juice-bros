import { isGmailConnectAllowed } from "./email-sync-allowlist.ts";
import type { MailboxProvider } from "./mailbox-provider.ts";

/**
 * The one place the email sync entitlement questions are answered (issue
 * #607): may this User connect a Mailbox Link (per provider), may they sync,
 * and which provider does a `processed_messages` row get recorded under.
 *
 * Kept free of Next.js and Supabase imports, like `email-sync-allowlist.ts`,
 * so the decision is unit tested directly. The Mailbox Link and profile reads
 * live in `email-sync-entitlement-for-caller.ts`.
 *
 * The Bookings, Settings and Privacy pages, the OAuth callback and the email
 * sync actions all ask this, so what a page shows is what an action allows.
 */

/** The slice of a Mailbox Link the decision needs — `null` for a User with none. */
export type EntitlementLink = {
  provider: MailboxProvider;
  status: "active" | "expired";
} | null;

export type EmailSyncEntitlement = {
  /** Gmail needs the allowlist (ADR-0009's addendum); Outlook needs nothing. */
  canConnect: Record<MailboxProvider, boolean>;
  /** Whether the User may run a sync or act on a review candidate. */
  canSync: boolean;
  /** Which provider to record the `processed_messages` row under. */
  provider: MailboxProvider;
};

/**
 * - A Gmail link still needs the caller on the allowlist: a User removed from
 *   it after connecting must not keep syncing (ADR-0009's addendum). An
 *   Outlook link needs nothing more — its consumer identity platform has no
 *   equivalent of Google's capped Testing mode (ADR-0018).
 * - With no link (the User disconnected while a review screen was still open,
 *   or just hasn't connected yet) the provider defaults to `google`, exactly
 *   the pre-#284 behaviour: an allowlisted caller may still act, and a
 *   non-allowlisted one has nothing to act on.
 * - An expired link doesn't change the answer. Expiry is the reconnect path,
 *   not a revocation, and `syncFromEmail` handles it before it gets here.
 */
export function decideEmailSyncEntitlement(input: {
  username: string | null;
  email: string | null | undefined;
  allowlistEnv: string | undefined;
  link: EntitlementLink;
}): EmailSyncEntitlement {
  const canConnect: Record<MailboxProvider, boolean> = {
    google: isGmailConnectAllowed(input.username, input.email, input.allowlistEnv),
    microsoft: true,
  };
  const provider = input.link?.provider ?? "google";

  return { canConnect, canSync: canConnect[provider], provider };
}
