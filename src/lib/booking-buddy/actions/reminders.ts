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
};

/**
 * A User who has never touched this yet has no row at all — `email_enabled:
 * true` is the same "on by default" behaviour the migration's column default
 * gives a User whose first row is inserted directly by `updateEmailRemindersEnabled`.
 */
const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  pushEnabled: false,
};

/** The signed-in User's own notification preferences, defaulted if they've never set any. */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const session = await verifySession();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("email_enabled, push_enabled")
    .eq("user_id", session.userId)
    .maybeSingle();

  if (error) {
    readFailed("your notification preferences", error);
  }
  if (!data) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  return { emailEnabled: data.email_enabled, pushEnabled: data.push_enabled };
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
