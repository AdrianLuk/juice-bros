/**
 * The Supabase side of `deliver`'s ports (spec #610): the address lookup, the
 * dead-device prune, and the send-log writers.
 *
 * Every function takes the caller's admin (`service_role`) client: the
 * `*_sends` tables are service_role-only, and `auth.admin.getUserById` needs
 * that key. Not marked `server-only`, unlike the Resend and web-push
 * adapters: it holds no secret of its own (the client it's handed does), and
 * importing nothing but relative paths keeps it loadable by `npm run test:db`,
 * which runs it against the real tables (`supabase-adapters.db-test.ts`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AddressLookup, MarkSent } from "./deliver.ts";

/** A User's address from `auth.users` — no table in this schema exposes one. Throws on an API error. */
export function supabaseAddressLookup(supabase: SupabaseClient): AddressLookup {
  return async (userId) => {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) {
      throw error;
    }
    return data.user?.email ?? null;
  };
}

/** Deletes a `push_subscriptions` row the push service reported gone (404/410). */
export async function pruneSubscription(supabase: SupabaseClient, deviceId: string): Promise<void> {
  const { error } = await supabase.from("push_subscriptions").delete().eq("id", deviceId);
  if (error) {
    throw error;
  }
}

export type SlotUserChannelSend = { slotId: string; userId: string; channel: "email" | "push" };

/**
 * The writer for the two logs keyed on (Slot, User, channel): Reminders
 * (`reminder_sends`) and Weekly Invites (`weekly_invite_sends`). Their
 * unique constraint turns a second write into a 23505, which `deliver`
 * counts as already sent.
 */
export function slotUserChannelLog(
  supabase: SupabaseClient,
  table: "reminder_sends" | "weekly_invite_sends",
): MarkSent<SlotUserChannelSend> {
  return async (send) => {
    const { error } = await supabase
      .from(table)
      .insert({ slot_id: send.slotId, user_id: send.userId, channel: send.channel });
    return error;
  };
}

/** The Booking Reminder's log: one row per Slot (one recipient, the organizer; one channel, email). */
export function bookingWindowReminderLog(supabase: SupabaseClient): MarkSent<{ slotId: string }> {
  return async (send) => {
    const { error } = await supabase
      .from("booking_window_reminder_sends")
      .insert({ slot_id: send.slotId });
    return error;
  };
}
