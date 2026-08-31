"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { SETTINGS_PATH, slotPath } from "../routes.ts";
import { readFailed, type ActionResult } from "./result.ts";
import { parseReminderOffsetMinutes } from "../reminders.ts";

export type { ActionResult } from "./result.ts";

/**
 * Set how long before a Slot starts its "yes" Responders get a Reminder
 * (issue #11's "configurable per Slot" acceptance criterion).
 *
 * Settable on a bare proposal too, same reasoning `setRotationBuffer`
 * already gives: it costs nothing, and it's already right the moment the
 * Slot becomes confirmed and Reminders start actually going out.
 */
export async function updateReminderOffset(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();

  const parsed = parseReminderOffsetMinutes(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("slots")
    .update({ reminder_offset_minutes: parsed.reminderOffsetMinutes })
    .eq("id", parsed.slotId)
    .select("id");

  if (error || !data?.length) {
    return { error: "Couldn't save that reminder timing. Try again." };
  }

  revalidatePath(slotPath(parsed.slotId));
  return { ok: true };
}

export type NotificationPreferences = {
  emailEnabled: boolean;
  pushEnabled: boolean;
  /** Independent of `emailEnabled` — governs the Booking Window Reminder (issue #36), not the attendee Reminder (issue #11). */
  bookingWindowEmailEnabled: boolean;
  /** Independent of the two above — governs the friend-request email (issue #228). */
  connectionRequestEmailEnabled: boolean;
};

/**
 * A User who has never touched this yet has no row at all — `email_enabled:
 * true` is the same "on by default" behaviour the migration's column default
 * gives a User whose first row is inserted directly by `updateEmailRemindersEnabled`.
 */
const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  pushEnabled: false,
  bookingWindowEmailEnabled: true,
  connectionRequestEmailEnabled: true,
};

/** The signed-in User's own notification preferences, defaulted if they've never set any. */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const session = await verifySession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notification_preferences")
    .select(
      "email_enabled, push_enabled, booking_window_email_enabled, connection_request_email_enabled",
    )
    .eq("user_id", session.userId)
    .maybeSingle();

  if (error) {
    readFailed("your notification preferences", error);
  }
  if (!data) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  return {
    emailEnabled: data.email_enabled,
    pushEnabled: data.push_enabled,
    bookingWindowEmailEnabled: data.booking_window_email_enabled,
    connectionRequestEmailEnabled: data.connection_request_email_enabled,
  };
}

/**
 * Save all three email notification opt-ins in one write — the Settings page's
 * "Notifications" card has a single Save button covering every email toggle
 * (issues #11, #36, #228), so this action reads and upserts all three columns
 * at once. An unchecked checkbox sends no field at all — its absence, not a
 * value, is what "off" means here.
 *
 * Push has no control on this form (`PushNotificationsForm` manages the
 * per-device subscription itself); the upsert never touches `push_enabled`, so
 * a first-time write still leaves it at the column's own default rather than
 * this action having an opinion about a channel it doesn't manage.
 */
export async function updateNotificationPreferences(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const emailEnabled = formData.get("email_enabled") === "on";
  const bookingWindowEmailEnabled = formData.get("booking_window_email_enabled") === "on";
  const connectionRequestEmailEnabled =
    formData.get("connection_request_email_enabled") === "on";

  const supabase = await createClient();
  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: session.userId,
      email_enabled: emailEnabled,
      booking_window_email_enabled: bookingWindowEmailEnabled,
      connection_request_email_enabled: connectionRequestEmailEnabled,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { error: "Couldn't save that. Try again." };
  }

  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}
