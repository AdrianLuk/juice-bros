import "server-only";

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { personOptionLabel } from "./connections.ts";
import { deliver, type DeliveryResult } from "./delivery/deliver.ts";
import { emailSenderFromEnv } from "./delivery/resend-sender.ts";
import { slotUserChannelLog, supabaseAddressLookup } from "./delivery/supabase-adapters.ts";
import { pushSenderFromEnv } from "./delivery/web-push-sender.ts";
import { groupRegularsByGame } from "./regulars.ts";
import { absoluteAppUrl } from "./request-origin.ts";
import { createAdminClient } from "./supabase/admin.ts";
import type { StoredPushSubscription } from "./reminder-run.ts";
import type { PostedWeek } from "./standing-game-posting.ts";
import {
  connectedPairKey,
  isInvitedRegular,
  planWeeklyInviteRun,
  weeklyInviteLinkKey,
  weeklyInviteSendKey,
  type PostedSlotForInvite,
  type WeeklyInviteChannel,
  type WeeklyInviteRules,
} from "./weekly-invites.ts";

/**
 * One count per planned send, under `deliver`'s rule (spec #610): `sent`,
 * `failed`, or `skipped` (channel not configured). `runFailed` is set when a
 * read or the planning threw before anything was sent: the counts are then 0
 * because nothing was planned, not because nothing was due.
 */
export type WeeklyInviteRunResult = DeliveryResult & { runFailed: boolean };

const NOTHING_SENT: WeeklyInviteRunResult = { sent: 0, failed: 0, skipped: 0, runFailed: false };
const RUN_FAILED: WeeklyInviteRunResult = { ...NOTHING_SENT, runFailed: true };

/**
 * Sends the Weekly Invite for Slots a Standing Game just posted (issue #579).
 * Called by `postDueWeeks` (`standing-game-posting.ts`) with what it just
 * posted: directly for the daily cron, through
 * `sendWeeklyInvitesInBackground` for the server actions.
 *
 * Takes the admin (`service_role`) client: the creation action runs as the
 * organizer, whose session can't read a Regular's preferences, devices or
 * email address. Who gets what is `planWeeklyInviteRun` (unit tested); this
 * is the reads, then `deliver` (`delivery/deliver.ts`) does Resend and
 * web-push, the dead-device prune, and the `weekly_invite_sends` marker, the
 * same as `send-reminders`. Never throws: a failed invite must not fail the
 * posting that triggered it.
 *
 * Email needs RESEND_API_KEY and REMINDER_FROM_EMAIL: without them every email
 * counts as `skipped`, with one warning per run. Push needs the VAPID keys:
 * without them the planner plans no push at all, with one warning per run.
 */
export async function sendWeeklyInvites(
  supabase: SupabaseClient,
  posted: readonly PostedWeek[],
  origin: string,
): Promise<WeeklyInviteRunResult> {
  if (posted.length === 0) {
    return NOTHING_SENT;
  }

  try {
    return await sendWeeklyInvitesUnsafe(supabase, posted, origin);
  } catch (error) {
    console.error("weekly-invites: the run failed", error);
    return RUN_FAILED;
  }
}

/**
 * For a server action that just posted weeks through the organizer's own
 * session (creating a Standing Game, putting a skipped week back on): send
 * their Weekly Invites after the response, through the admin client.
 * `postDueWeeks` picks this for the actions; the cron, which already holds
 * the admin client, sends in the request with `sendWeeklyInvites`.
 */
export async function sendWeeklyInvitesInBackground(
  posted: readonly PostedWeek[],
): Promise<void> {
  if (posted.length === 0) {
    return;
  }
  // Read inside the request, before `after()`.
  const origin = new URL(await absoluteAppUrl("/")).origin;
  after(async () => {
    try {
      await sendWeeklyInvites(createAdminClient(), posted, origin);
    } catch (error) {
      console.error("weekly-invites: sending after posting failed", error);
    }
  });
}

/**
 * Each invited Regular's answer token for these Slots (issue #580, ADR 0022),
 * by `weeklyInviteLinkKey`. Minted on first send and reused after (one
 * `weekly_invite_links` row per Slot and Regular), so a rerun links to the
 * same token. The database refuses a link for anyone who isn't a Regular.
 *
 * Best-effort: on a failed write or read this returns what it has, and a
 * Regular without a token still gets the invite with "View the game".
 */
async function mintAnswerTokens(
  supabase: SupabaseClient,
  slots: readonly PostedSlotForInvite[],
  regularsByGame: ReadonlyMap<string, readonly string[]>,
  rules: WeeklyInviteRules,
): Promise<Map<string, string>> {
  const pairs = slots.flatMap((slot) =>
    (regularsByGame.get(slot.standingGameId) ?? [])
      .filter((userId) => isInvitedRegular(slot, userId, rules))
      .map((userId) => ({ slot_id: slot.slotId, user_id: userId })),
  );
  const tokens = new Map<string, string>();
  if (pairs.length === 0) {
    return tokens;
  }

  const { error: mintError } = await supabase
    .from("weekly_invite_links")
    .upsert(pairs, { onConflict: "slot_id,user_id", ignoreDuplicates: true });
  if (mintError) {
    console.error("weekly-invites: minting answer links failed", mintError);
  }

  const { data: linkRows, error: linksError } = await supabase
    .from("weekly_invite_links")
    .select("slot_id, user_id, token")
    .in(
      "slot_id",
      slots.map((slot) => slot.slotId),
    );
  if (linksError) {
    console.error("weekly-invites: reading answer links failed", linksError);
    return tokens;
  }

  for (const row of linkRows ?? []) {
    tokens.set(weeklyInviteLinkKey(row.slot_id, row.user_id), row.token);
  }
  return tokens;
}

async function sendWeeklyInvitesUnsafe(
  supabase: SupabaseClient,
  posted: readonly PostedWeek[],
  origin: string,
): Promise<WeeklyInviteRunResult> {
  // Without VAPID keys the planner plans no push and the subscriptions read
  // is skipped. `deliver` never sees a push send then, so it can't warn; this
  // is that one warning for the run.
  const sendPush = pushSenderFromEnv(supabase);
  const pushConfigured = sendPush !== null;
  if (!pushConfigured) {
    console.warn("weekly-invites: push is not configured, skipping it this run.");
  }

  const slotIds = posted.map((week) => week.slotId);
  const standingGameIds = [...new Set(posted.map((week) => week.standingGameId))];

  const [{ data: slotRows, error: slotsError }, { data: regularRows, error: regularsError }] =
    await Promise.all([
      supabase
        .from("slots")
        .select("id, owner_id, proposed_start, proposed_end, time_zone")
        .in("id", slotIds),
      supabase
        .from("standing_game_regulars")
        .select("standing_game_id, user_id")
        .in("standing_game_id", standingGameIds),
    ]);
  if (slotsError || regularsError) {
    console.error("weekly-invites: reading slots or regulars failed", slotsError ?? regularsError);
    return RUN_FAILED;
  }

  const regularsByGame = groupRegularsByGame(regularRows ?? []);

  const regularIds = [...new Set((regularRows ?? []).map((row) => row.user_id))];
  if (regularIds.length === 0) {
    return NOTHING_SENT;
  }

  const ownerIds = [...new Set((slotRows ?? []).map((row) => row.owner_id))];
  const ownerList = ownerIds.join(",");

  const [
    { data: profileRows, error: profilesError },
    { data: connectionRows, error: connectionsError },
    { data: preferenceRows, error: preferencesError },
    { data: sentRows, error: sentError },
    { data: subscriptionRows, error: subscriptionsError },
  ] = await Promise.all([
    supabase.from("profiles").select("id, display_name, username").in("id", ownerIds),
    supabase
      .from("connections")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.in.(${ownerList}),addressee_id.in.(${ownerList})`),
    supabase
      .from("notification_preferences")
      .select("user_id, weekly_invite_enabled, push_enabled")
      .in("user_id", regularIds),
    supabase.from("weekly_invite_sends").select("slot_id, user_id, channel").in("slot_id", slotIds),
    pushConfigured
      ? supabase
          .from("push_subscriptions")
          .select("id, user_id, endpoint, p256dh, auth")
          .in("user_id", regularIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const readError =
    profilesError ?? connectionsError ?? preferencesError ?? sentError ?? subscriptionsError;
  if (readError) {
    console.error("weekly-invites: a read failed", readError);
    return RUN_FAILED;
  }

  const nameByOwner = new Map(
    (profileRows ?? []).map((row) => [
      row.id,
      personOptionLabel({ displayName: row.display_name, username: row.username }),
    ]),
  );
  const standingGameBySlot = new Map(posted.map((week) => [week.slotId, week.standingGameId]));

  const slots: PostedSlotForInvite[] = (slotRows ?? []).flatMap((row) => {
    const standingGameId = standingGameBySlot.get(row.id);
    if (!standingGameId) {
      return [];
    }
    return [
      {
        slotId: row.id,
        standingGameId,
        ownerId: row.owner_id,
        organizerName: nameByOwner.get(row.owner_id) ?? "Your organizer",
        proposedStart: row.proposed_start,
        proposedEnd: row.proposed_end,
        timeZone: row.time_zone,
      },
    ];
  });

  const connectedPairs = new Set<string>();
  for (const row of connectionRows ?? []) {
    connectedPairs.add(connectedPairKey(row.requester_id, row.addressee_id));
    connectedPairs.add(connectedPairKey(row.addressee_id, row.requester_id));
  }

  const subscriptionsByUser = new Map<string, StoredPushSubscription[]>();
  for (const row of subscriptionRows ?? []) {
    const list = subscriptionsByUser.get(row.user_id) ?? [];
    list.push({ id: row.id, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth });
    subscriptionsByUser.set(row.user_id, list);
  }

  const inviteEnabledByUser = new Map(
    (preferenceRows ?? []).map((row) => [row.user_id, row.weekly_invite_enabled]),
  );
  const answerTokens = await mintAnswerTokens(supabase, slots, regularsByGame, {
    connectedPairs,
    inviteEnabledByUser,
  });

  const { sends } = planWeeklyInviteRun({
    slots,
    regularsByGame,
    connectedPairs,
    inviteEnabledByUser,
    answerTokens,
    pushEnabledByUser: new Map(
      (preferenceRows ?? []).map((row) => [row.user_id, row.push_enabled]),
    ),
    alreadySent: new Set(
      (sentRows ?? []).map((row) =>
        weeklyInviteSendKey(row.slot_id, row.user_id, row.channel as WeeklyInviteChannel),
      ),
    ),
    subscriptionsByUser,
    pushConfigured,
    origin,
  });

  const result = await deliver(sends, {
    logTag: "weekly-invites",
    lookupAddress: supabaseAddressLookup(supabase),
    sendEmail: emailSenderFromEnv(),
    sendPush,
    markSent: slotUserChannelLog(supabase, "weekly_invite_sends"),
  });
  return { ...result, runFailed: false };
}
