/**
 * Pure logic for the "your friend request was accepted" email — the follow-up
 * to the friend-request email (`connection-request-email.ts`, issue #228).
 *
 * When someone accepts a request, the person who sent it gets this note with a
 * link to their Friends page. There's nothing to action from the email, so it
 * carries a single plain link rather than one-click buttons.
 *
 * Free of Next.js and Supabase imports on purpose, so it runs under
 * `node --test` — same posture as `connection-request-email.ts`.
 */

import { escapeHtml } from "./escape-html.ts";

/**
 * Subject and HTML body for one connection-accepted email — pure string
 * assembly, no I/O. Same hand-rolled table layout as the other two BB emails,
 * so they read as one family.
 *
 * `accepterLabel` is already resolved to a display string by the caller
 * (`personOptionLabel`), and every interpolated value is escaped here rather
 * than trusting that.
 */
export function formatConnectionAcceptedEmail(params: {
  accepterLabel: string;
  friendsUrl: string;
}): { subject: string; html: string } {
  const name = escapeHtml(params.accepterLabel);
  const friendsUrl = escapeHtml(params.friendsUrl);

  return {
    subject: `${params.accepterLabel} accepted your friend request on Booking Buddy`,
    html: `
<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
      <tr>
        <td style="padding:24px 28px 8px;">
          <p style="margin:0;color:#18181b;font-size:20px;font-weight:600;">${name} accepted your friend request</p>
          <p style="margin:12px 0 0;color:#3f3f46;font-size:15px;line-height:1.5;">You're connected on Booking Buddy now. You can see each other's open time and invite each other to games.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px 28px;">
          <a href="${friendsUrl}" style="display:inline-block;background-color:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">Open your Friends page</a>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}
