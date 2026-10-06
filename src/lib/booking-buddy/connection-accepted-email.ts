/**
 * Pure logic for the "your friend request was accepted" email — the follow-up
 * to the friend-request email (`connection-request-email.ts`, issue #228).
 *
 * When someone accepts a request, the person who sent it gets this note with a
 * link to their Friends page. There's nothing to action from the email, so it
 * carries one link rather than Accept / Decline buttons.
 *
 * Free of Next.js and Supabase imports on purpose, so it runs under
 * `node --test` — same posture as `connection-request-email.ts`.
 */

import { renderEmailLayout } from "./email-layout.ts";
import { CONNECTION_ACCEPTED_VISIBILITY_NOTICE } from "./connection-copy.ts";

/**
 * Subject and HTML body for one connection-accepted email: pure string
 * assembly, no I/O, rendered through the shared Booking Buddy email layout so
 * every BB email reads as one family.
 *
 * `accepterLabel` is already resolved to a display string by the caller
 * (`personOptionLabel`); the layout escapes it rather than trusting that.
 */
export function formatConnectionAcceptedEmail(params: {
  accepterLabel: string;
  friendsUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `${params.accepterLabel} accepted your friend request on Booking Buddy`,
    html: renderEmailLayout({
      heading: `${params.accepterLabel} accepted your friend request`,
      paragraphs: [
        `You're connected on Booking Buddy now. ${CONNECTION_ACCEPTED_VISIBILITY_NOTICE}`,
      ],
      primaryAction: { label: "Open your Friends page", url: params.friendsUrl },
    }),
  };
}
