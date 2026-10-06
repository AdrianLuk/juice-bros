import "server-only";

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import webpush from "web-push";

import { personOptionLabel } from "./connections.ts";
import { absoluteAppUrl } from "./request-origin.ts";
import { createAdminClient } from "./supabase/admin.ts";
import type { StoredPushSubscription } from "./reminder-run.ts";
import type { PostedWeek } from "./standing-game-posting.ts";
import {
  connectedPairKey,
  planWeeklyInviteRun,
  weeklyInviteLinkKey,
  weeklyInviteSendKey,
  type PostedSlotForInvite,
  type WeeklyInviteChannel,
} from "./weekly-invites.ts";

export type WeeklyInviteRunResult = { sent: number; failed: number };

const NOTHING_SENT: WeeklyInviteRunResult = { sent: 0, failed: 0 };

/**
 * Sends the Weekly Invite for Slots a Standing Game just posted (issue #579).
 * Called with `postStandingGameWeeks`' `posted` from both places a week
 * posts: the daily cron and the creation action (from its `after()`).
 *
 * Takes the admin (`service_role`) client: the creation action runs as the
 * organizer, whose session can't read a Regular's preferences, devices or
 * email address. Who gets what is `planWeeklyInviteRun` (unit tested); this
 * is the reads, Resend and web-push, the dead-device prune, and the
 * `weekly_invite_sends` marker, the same shape as `send-reminders`. Never
 * throws: a failed invite must not fail the posting that triggered it.
 *
 * Email needs RESEND_API_KEY and REMINDER_FROM_EMAIL; push needs the VAPID
 * keys. Either missing skips that channel with a log line, not the run.
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
    return { sent: 0, failed: posted.length };
  }
}

/**
 * For a server action that just posted weeks through the organizer's own
 * session (creating a Standing Game, putting a skipped week back on): send
 * their Weekly Invites after the response, through the admin client. Every
 * caller of `postStandingGameWeeks` outside the cron goes through this, so a
 * week never posts without inviting its Regulars. The cron route, which
 * already holds the admin client, calls `sendWeeklyInvites` directly.
 */
export async function inviteRegularsAfterResponse(posted: readonly PostedWeek[]): Promise<void> {
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
  isInvited: (slot: PostedSlotForInvite, userId: string) => boolean,
): Promise<Map<string, string>> {
  const pairs = slots.flatMap((slot) =>
    (regularsByGame.get(slot.standingGameId) ?? [])
      .filter((userId) => isInvited(slot, userId))
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
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;
  const emailConfigured = Boolean(apiKey && from);
  if (!emailConfigured) {
    console.error("weekly-invites: missing RESEND_API_KEY or REMINDER_FROM_EMAIL, skipping email.");
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  const pushConfigured = Boolean(vapidPublicKey && vapidPrivateKey && vapidSubject);
  if (pushConfigured) {
    webpush.setVapidDetails(vapidSubject!, vapidPublicKey!, vapidPrivateKey!);
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
    return { sent: 0, failed: posted.length };
  }

  const regularsByGame = new Map<string, string[]>();
  for (const row of regularRows ?? []) {
    const list = regularsByGame.get(row.standing_game_id) ?? [];
    list.push(row.user_id);
    regularsByGame.set(row.standing_game_id, list);
  }

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
    return { sent: 0, failed: posted.length };
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
  const answerTokens = await mintAnswerTokens(supabase, slots, regularsByGame, (slot, userId) =>
    userId !== slot.ownerId &&
    connectedPairs.has(connectedPairKey(slot.ownerId, userId)) &&
    inviteEnabledByUser.get(userId) !== false,
  );

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

  const resend = emailConfigured ? new Resend(apiKey) : null;
  let sent = 0;
  let failed = 0;

  // Best-effort: the message is already out; a duplicate marker (a race with
  // another run) hits the unique constraint and is not a failure.
  async function markSent(slotId: string, userId: string, channel: WeeklyInviteChannel) {
    const { error } = await supabase
      .from("weekly_invite_sends")
      .insert({ slot_id: slotId, user_id: userId, channel });
    if (error && error.code !== "23505") {
      console.error("weekly-invites: recording the send failed", error);
    }
  }

  for (const send of sends) {
    if (send.channel === "email") {
      if (!resend) {
        continue;
      }
      // The admin API: no table in this schema exposes an email column.
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
        send.userId,
      );
      if (userError || !userData?.user?.email) {
        console.error("weekly-invites: no email for recipient", send.userId, userError);
        failed += 1;
        continue;
      }

      const { error: sendError } = await resend.emails.send({
        from: from!,
        to: userData.user.email,
        subject: send.subject,
        html: send.html,
      });
      if (sendError) {
        console.error("weekly-invites: Resend error", sendError);
        failed += 1;
        continue;
      }

      await markSent(send.slotId, send.userId, "email");
      sent += 1;
      continue;
    }

    let anyPushSucceeded = false;
    for (const subscription of send.subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(send.payload),
        );
        anyPushSucceeded = true;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
        } else {
          console.error("weekly-invites: web-push error", error);
        }
      }
    }

    if (anyPushSucceeded) {
      await markSent(send.slotId, send.userId, "push");
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return { sent, failed };
}
