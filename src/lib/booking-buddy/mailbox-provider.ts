/**
 * Which identity platform a Mailbox Link's OAuth grant is against. Only
 * `"google"` is reachable today; `"microsoft"` is wired up in #280's later
 * slices. Kept in sync with the `provider` CHECK constraint on
 * `mailbox_links` / `processed_messages`.
 *
 * Its own module (not `actions/email-sync.ts`) so the `MailAdapter` seam and
 * the OAuth callback route can name the type without importing a
 * `"use server"` file.
 */
export type MailboxProvider = "google" | "microsoft";
