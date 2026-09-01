/**
 * Which identity platform a Mailbox Link's OAuth grant is against (spec #280).
 * Kept in sync with the `provider` CHECK constraint on `mailbox_links` /
 * `processed_messages`.
 *
 * Its own module (not `actions/email-sync.ts`) so the `MailAdapter` seam, the
 * OAuth callback route, and the Settings/Bookings UI can name the type and its
 * labels without importing a `"use server"` file.
 */
export type MailboxProvider = "google" | "microsoft";

export const MAILBOX_PROVIDERS: readonly MailboxProvider[] = ["google", "microsoft"];

export function isMailboxProvider(value: string): value is MailboxProvider {
  return (MAILBOX_PROVIDERS as readonly string[]).includes(value);
}

/**
 * How each provider's *inbox* is named in copy the User reads — "Connect
 * Outlook", "Connected as … via Gmail". The mailbox brand, not the identity
 * platform: a Hotmail User thinks of their inbox as Outlook, not "Microsoft".
 */
export const MAILBOX_PROVIDER_LABEL: Record<MailboxProvider, string> = {
  google: "Gmail",
  microsoft: "Outlook",
};

/**
 * How each provider's *identity platform* is named in reconnect copy —
 * "Google needs you to reconnect", "Microsoft needs you to reconnect". This
 * is the party whose OAuth grant lapsed, which is the one the User is about to
 * see a consent screen from again.
 */
export const MAILBOX_PROVIDER_IDENTITY_LABEL: Record<MailboxProvider, string> = {
  google: "Google",
  microsoft: "Microsoft",
};
