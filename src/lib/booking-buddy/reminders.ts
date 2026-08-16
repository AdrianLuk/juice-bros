/**
 * Pure logic for Reminders (see CONTEXT.md, issue #11).
 *
 * Free of Next.js and Supabase imports on purpose. The limits mirror the
 * `slots`/`notification_preferences`/`reminder_sends` migration — change one
 * and you must change the other.
 */

import type { ResponseAnswer } from "./responses.ts";

export const DEFAULT_REMINDER_OFFSET_MINUTES = 60;
export const MIN_REMINDER_OFFSET_MINUTES = 0;
/** 7 days — a Reminder set further out than that isn't really a reminder. */
export const MAX_REMINDER_OFFSET_MINUTES = 10080;

export type ReminderResponder = {
  userId: string | null;
  answer: ResponseAnswer;
};

/**
 * Who gets a Reminder for a Slot: signed-in "yes" Responders, and only on a
 * confirmed Slot — one with at least one Booking attached (CONTEXT.md's
 * Reminder entry: "a bare proposal has nothing concrete to remind anyone
 * about"). Guests are never included; they hold no account to email.
 */
export function getReminderRecipients(
  responses: ReminderResponder[],
  hasBooking: boolean,
): string[] {
  if (!hasBooking) {
    return [];
  }

  return responses
    .filter((response) => response.answer === "yes" && response.userId !== null)
    .map((response) => response.userId as string);
}

export function parseReminderOffsetMinutes(
  formData: FormData,
): { slotId: string; reminderOffsetMinutes: number } | { error: string } {
  const slotId = String(formData.get("slot_id") ?? "").trim();
  if (!slotId) {
    return { error: "Which slot is this for?" };
  }

  const raw = String(formData.get("reminder_offset_minutes") ?? "").trim();
  const reminderOffsetMinutes = Number(raw);

  if (raw === "" || !Number.isInteger(reminderOffsetMinutes)) {
    return { error: "Reminder timing is a whole number of minutes." };
  }

  if (
    reminderOffsetMinutes < MIN_REMINDER_OFFSET_MINUTES ||
    reminderOffsetMinutes > MAX_REMINDER_OFFSET_MINUTES
  ) {
    return {
      error: `Reminder timing must be between ${MIN_REMINDER_OFFSET_MINUTES} and ${MAX_REMINDER_OFFSET_MINUTES} minutes before the slot.`,
    };
  }

  return { slotId, reminderOffsetMinutes };
}

/**
 * A Slot's Reminder is due from the moment "now" reaches its configured
 * offset before `proposedStart`, staying due all the way up to the Slot's
 * own start — not a narrow window. That's deliberate: the send job may run
 * as infrequently as once a day (see the route handler), and a Reminder that
 * stopped being "due" the moment its exact minute passed would get missed
 * entirely between runs. `reminder_sends` is what stops a wide window from
 * ever sending twice, not this function.
 */
export function isReminderDue(params: {
  proposedStart: Date;
  reminderOffsetMinutes: number;
  now: Date;
}): boolean {
  const dueAt = new Date(
    params.proposedStart.getTime() - params.reminderOffsetMinutes * 60_000,
  );
  return params.now >= dueAt && params.now < params.proposedStart;
}

export type ReminderChannel = "email" | "push";

/**
 * Whether one Reminder send should actually go out on one channel — a pure
 * decision over already-fetched preference and idempotency state, kept
 * separate from fetching either (the DB is the glue, this is the rule).
 * `pushEnabled` is accepted now, ahead of push delivery itself (issue #12),
 * so the decision doesn't have to be relearned once that channel is wired up.
 */
export function shouldSendReminder(params: {
  channel: ReminderChannel;
  emailEnabled: boolean;
  pushEnabled: boolean;
  alreadySent: boolean;
}): boolean {
  if (params.alreadySent) {
    return false;
  }

  return params.channel === "email" ? params.emailEnabled : params.pushEnabled;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Subject and body for one Reminder email — pure string assembly, no I/O. */
export function formatReminderEmail(params: {
  slotWhen: string;
  slotUrl: string;
}): { subject: string; html: string } {
  const safeWhen = escapeHtml(params.slotWhen);
  const safeUrl = escapeHtml(params.slotUrl);

  return {
    subject: `Reminder: ${params.slotWhen}`,
    html: `
<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
      <tr>
        <td style="padding:24px 28px 8px;">
          <p style="margin:0;color:#18181b;font-size:16px;">You're down as <strong>yes</strong> for:</p>
          <p style="margin:12px 0 0;color:#18181b;font-size:20px;font-weight:600;">${safeWhen}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px 28px;">
          <a href="${safeUrl}" style="display:inline-block;background-color:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">View the slot</a>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}
