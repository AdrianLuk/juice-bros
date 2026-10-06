/**
 * Pure logic for the friend-request email (issue #228, see CONTEXT.md's
 * Connection Request Email entry).
 *
 * When someone sends a friend request, the addressee gets this email with
 * one-click Accept / Decline links. The links carry a single-use
 * `connection_request_links` token and work without the recipient being signed
 * in — see `connection-request-notify.ts` for the I/O and the ADR for why
 * session-less is safe here.
 *
 * Free of Next.js and Supabase imports on purpose, so it runs under
 * `node --test` — same posture as `reminders.ts`.
 */

import { renderEmailLayout } from "./email-layout.ts";
import { CONNECTION_VISIBILITY_NOTICE } from "./connection-copy.ts";

/** What a `/connect/<token>` link asks for. */
export type ConnectionRequestAction = "accept" | "decline";

/**
 * Validate the `?a=` query param (or the matching hidden form field) off a
 * `/connect/<token>` link. Untrusted input — returns `null` for anything that
 * isn't one of the two actions, so a caller never acts on a typo.
 */
export function parseConnectionRequestAction(
  raw: string | null | undefined,
): ConnectionRequestAction | null {
  return raw === "accept" || raw === "decline" ? raw : null;
}

/**
 * Subject and HTML body for one friend-request email: pure string assembly,
 * no I/O, rendered through the shared Booking Buddy email layout.
 *
 * `requesterLabel` is already resolved to a display string by the caller
 * (`personOptionLabel`); the layout escapes it rather than trusting that.
 */
export function formatConnectionRequestEmail(params: {
  requesterLabel: string;
  acceptUrl: string;
  declineUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `${params.requesterLabel} wants to connect on Booking Buddy`,
    html: renderEmailLayout({
      heading: `${params.requesterLabel} wants to connect`,
      paragraphs: [`On Booking Buddy, connecting is mutual. ${CONNECTION_VISIBILITY_NOTICE}`],
      primaryAction: { label: "Accept", url: params.acceptUrl },
      secondaryActions: [{ label: "Decline", url: params.declineUrl }],
      smallPrint:
        "These links work once, straight from this email. If you don't recognise the name, Decline is safe.",
    }),
  };
}
