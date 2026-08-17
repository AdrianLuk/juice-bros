/**
 * Pure logic for Booking Windows and Booking Reminders (see CONTEXT.md,
 * issue #36).
 *
 * Free of Next.js and Supabase imports on purpose. The limits mirror the
 * `orgs`/`slots` migration — change one and you must change the other.
 */

import { isHourTime } from "./datetime.ts";
import { formatTimeLabel } from "./bookings.ts";

export const MIN_BOOKING_WINDOW_DAYS_BEFORE = 0;
export const MAX_BOOKING_WINDOW_DAYS_BEFORE = 30;

export type BookingWindow = { daysBefore: number; time: string };

/** Every valid "days before" value, for populating a select instead of a free-typed number. */
export const BOOKING_WINDOW_DAYS_OPTIONS: readonly number[] = Array.from(
  { length: MAX_BOOKING_WINDOW_DAYS_BEFORE - MIN_BOOKING_WINDOW_DAYS_BEFORE + 1 },
  (_, i) => MIN_BOOKING_WINDOW_DAYS_BEFORE + i,
);

/** A standalone label for one "days before" option, e.g. a `<select>`'s option text. */
export function daysBeforeOptionLabel(daysBefore: number): string {
  return daysBefore === 0 ? "Same day" : `${daysBefore} day${daysBefore === 1 ? "" : "s"} before`;
}

/**
 * Both fields are optional together: an Org that has never had its Booking
 * Window set has neither, and this parses that as `null` (clearing it,
 * or leaving it clear) rather than an error — most Orgs will never have one
 * set, and that's a legitimate, permanent state, not a half-filled form.
 */
export function parseBookingWindow(
  formData: FormData,
): { orgId: string; window: BookingWindow | null } | { error: string } {
  const orgId = String(formData.get("org_id") ?? "").trim();
  if (!orgId) {
    return { error: "Which place is this for?" };
  }

  const rawDays = String(formData.get("booking_window_days_before") ?? "").trim();
  const rawTime = String(formData.get("booking_window_time") ?? "").trim();

  if (rawDays === "" && rawTime === "") {
    return { orgId, window: null };
  }

  if (rawDays === "" || rawTime === "") {
    return { error: "Set both how many days before, and what time — or leave both blank." };
  }

  const daysBefore = Number(rawDays);
  if (!Number.isInteger(daysBefore)) {
    return { error: "Days before is a whole number." };
  }
  if (
    daysBefore < MIN_BOOKING_WINDOW_DAYS_BEFORE ||
    daysBefore > MAX_BOOKING_WINDOW_DAYS_BEFORE
  ) {
    return {
      error: `Days before must be between ${MIN_BOOKING_WINDOW_DAYS_BEFORE} and ${MAX_BOOKING_WINDOW_DAYS_BEFORE}.`,
    };
  }

  if (!isHourTime(rawTime)) {
    return { error: "Pick a time on the hour." };
  }

  return { orgId, window: { daysBefore, time: rawTime } };
}

/** A human label for an Org's own Booking Window, or its absence. */
export function bookingWindowLabel(window: BookingWindow | null): string {
  if (!window) {
    return "No booking window set for this place yet.";
  }

  const dayLabel =
    window.daysBefore === 0
      ? "the same day"
      : `${window.daysBefore} day${window.daysBefore === 1 ? "" : "s"} before`;

  return `Opens ${dayLabel}, at ${formatTimeLabel(window.time)}.`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Subject and body for one Booking Reminder email — pure string assembly, no I/O. */
export function formatBookingReminderEmail(params: {
  orgName: string;
  slotWhen: string;
  slotUrl: string;
}): { subject: string; html: string } {
  const safeOrgName = escapeHtml(params.orgName);
  const safeWhen = escapeHtml(params.slotWhen);
  const safeUrl = escapeHtml(params.slotUrl);

  return {
    subject: `Time to book: ${params.orgName}`,
    html: `
<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
      <tr>
        <td style="padding:24px 28px 8px;">
          <p style="margin:0;color:#18181b;font-size:16px;"><strong>${safeOrgName}</strong> just opened bookings for:</p>
          <p style="margin:12px 0 0;color:#18181b;font-size:20px;font-weight:600;">${safeWhen}</p>
          <p style="margin:12px 0 0;color:#71717a;font-size:14px;">Go grab a court before it fills up.</p>
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
