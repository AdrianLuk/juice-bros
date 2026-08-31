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
 * Toggle email Reminders on or off. An unchecked checkbox sends no field at
 * all — its absence, not a value, is what "off" means here.
 *
 * Push has no control on this form yet (issue #12 wires up delivery); the
 * upsert only ever touches `email_enabled`, so a first-time write still
 * leaves `push_enabled` at the column's own default rather than this action
 * having an opinion about a channel it doesn't manage.
 */
export async function updateEmailRemindersEnabled(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();
  const emailEnabled = formData.get("email_enabled") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: session.userId, email_enabled: emailEnabled }, { onConflict: "user_id" });

  if (error) {
    return { error: "Couldn't save that. Try again." };
  }

  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}

/**
 * Toggle the friend-request email on or off (issue #228) — its own preference,
 * independent of the two Reminder toggles. Same shape as the others, touching
 * only its own column.
 */
export async function updateConnectionRequestEmailsEnabled(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();
  const connectionRequestEmailEnabled =
    formData.get("connection_request_email_enabled") === "on";

  const supabase = await createClient();
  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: session.userId,
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

/**
 * Toggle Booking Window Reminders on or off — a separate preference from
 * `updateEmailRemindersEnabled` (issue #36's own acceptance criterion):
 * someone may want to know a game is on without being nagged about booking
 * logistics, or the reverse. Same shape as that action, touching only its
 * own column.
 */
export async function updateBookingWindowRemindersEnabled(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();
  const bookingWindowEmailEnabled = formData.get("booking_window_email_enabled") === "on";

  const supabase = await createClient();
  const { error } = await supabase.from("notification_preferences").upsert(
    { user_id: session.userId, booking_window_email_enabled: bookingWindowEmailEnabled },
    { onConflict: "user_id" },
  );

  if (error) {
    return { error: "Couldn't save that. Try again." };
  }

  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}
