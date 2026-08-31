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

import { escapeHtml } from "./escape-html.ts";

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
 * Subject and HTML body for one friend-request email — pure string assembly,
 * no I/O. Same hand-rolled table layout as `formatReminderEmail`, so the two
 * BB emails read as one family.
 *
 * `requesterLabel` is already resolved to a display string by the caller
 * (`personOptionLabel`), and every interpolated value is escaped here rather
 * than trusting that.
 */
export function formatConnectionRequestEmail(params: {
  requesterLabel: string;
  acceptUrl: string;
  declineUrl: string;
}): { subject: string; html: string } {
  const name = escapeHtml(params.requesterLabel);
  const acceptUrl = escapeHtml(params.acceptUrl);
  const declineUrl = escapeHtml(params.declineUrl);

  return {
    subject: `${params.requesterLabel} wants to connect on Booking Buddy`,
    html: `
<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
      <tr>
        <td style="padding:24px 28px 8px;">
          <p style="margin:0;color:#18181b;font-size:20px;font-weight:600;">${name} wants to connect</p>
          <p style="margin:12px 0 0;color:#3f3f46;font-size:15px;line-height:1.5;">On Booking Buddy, connecting is mutual. Once you accept, you can see each other's open time and invite each other to games.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px 28px;">
          <a href="${acceptUrl}" style="display:inline-block;background-color:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">Accept</a>
          <a href="${declineUrl}" style="display:inline-block;margin-left:8px;color:#3f3f46;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;border:1px solid #e4e4e7;">Decline</a>
          <p style="margin:16px 0 0;color:#71717a;font-size:12px;line-height:1.5;">These links work once, straight from this email. If you don't recognise the name, Decline is safe.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}
