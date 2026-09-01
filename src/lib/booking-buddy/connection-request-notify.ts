import "server-only";

import { Resend } from "resend";

import { createAdminClient } from "./supabase/admin.ts";
import { absoluteAppUrl } from "./request-origin.ts";
import { connectLinkPath, FRIENDS_PATH } from "./routes.ts";
import { personOptionLabel } from "./connections.ts";
import {
  formatConnectionRequestEmail,
  type ConnectionRequestAction,
} from "./connection-request-email.ts";
import { formatConnectionAcceptedEmail } from "./connection-accepted-email.ts";

/**
 * The I/O behind the friend-request email (issue #228). The email copy itself
 * is `connection-request-email.ts` (pure, unit-tested); everything here is the
 * `service_role` reads, the address lookup, the Resend call, and the
 * session-less Accept / Decline logic the `/connect/<token>` page and its
 * action share.
 *
 * Runs entirely through the admin client, the same posture the Reminders send
 * job and the Guest RSVP path already use: nobody here is a User acting through
 * their own session — the notifier fires from `after()` on the requester's
 * request, and the respond page has no session at all — and both need to read
 * across two Users (the addressee's email in `auth.users`, the requester's name
 * in a `profiles` row RLS would hide), which no single User's grant allows.
 */

type ConnectionRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
};

type LinkRow = {
  id: string;
  connection_id: string;
  token: string;
  consumed_at: string | null;
};

/** A person's display label from their `profiles` row, read past RLS. Used for both parties. */
async function loadPersonLabel(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", userId)
    .maybeSingle();

  return personOptionLabel({
    displayName: data?.display_name ?? null,
    username: data?.username ?? null,
  });
}

/**
 * Send the friend-request email for a freshly-created pending Connection.
 * Best-effort: every exit is a `return`, and the whole body is wrapped so a
 * failure here never propagates into the request that triggered it (it is
 * always called from `after()`).
 */
export async function notifyNewConnectionRequest(
  connectionId: string,
): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.REMINDER_FROM_EMAIL;
    if (!apiKey || !from) {
      console.error(
        "connection-request-notify: missing RESEND_API_KEY or REMINDER_FROM_EMAIL.",
      );
      return;
    }

    const supabase = createAdminClient();

    const { data: connection, error: connectionError } = await supabase
      .from("connections")
      .select("id, requester_id, addressee_id, status")
      .eq("id", connectionId)
      .maybeSingle<ConnectionRow>();

    if (connectionError || !connection || connection.status !== "pending") {
      return;
    }

    // The trigger mints one per Connection; insert defensively in case this
    // ships ahead of its migration on some environment, or the row was pruned.
    let { data: link } = await supabase
      .from("connection_request_links")
      .select("id, connection_id, token, consumed_at")
      .eq("connection_id", connectionId)
      .maybeSingle<LinkRow>();

    if (!link) {
      const inserted = await supabase
        .from("connection_request_links")
        .insert({ connection_id: connectionId })
        .select("id, connection_id, token, consumed_at")
        .maybeSingle<LinkRow>();
      link = inserted.data ?? null;
    }

    if (!link || link.consumed_at) {
      return;
    }

    const { data: preference } = await supabase
      .from("notification_preferences")
      .select("connection_request_email_enabled")
      .eq("user_id", connection.addressee_id)
      .maybeSingle();

    // A missing row means the column default — opted in.
    if (preference && preference.connection_request_email_enabled === false) {
      return;
    }

    const { data: userData, error: userError } =
      await supabase.auth.admin.getUserById(connection.addressee_id);
    const to = userData?.user?.email;
    if (userError || !to) {
      console.error(
        "connection-request-notify: no email for addressee",
        connection.addressee_id,
        userError,
      );
      return;
    }

    const requesterLabel = await loadPersonLabel(
      supabase,
      connection.requester_id,
    );

    const { subject, html } = formatConnectionRequestEmail({
      requesterLabel,
      acceptUrl: await absoluteAppUrl(connectLinkPath(link.token, "accept")),
      declineUrl: await absoluteAppUrl(connectLinkPath(link.token, "decline")),
    });

    const { error: sendError } = await new Resend(apiKey).emails.send({
      from,
      to,
      subject,
      html,
    });
    if (sendError) {
      console.error("connection-request-notify: Resend error", sendError);
    }
  } catch (error) {
    console.error("connection-request-notify: unexpected failure", error);
  }
}

/**
 * Send the "your friend request was accepted" email to the original requester.
 * Called from `after()` on whichever path moved the Connection to `accepted`
 * (the signed-in Friends page, or the session-less `/connect/<token>` link), so
 * the same best-effort rules as `notifyNewConnectionRequest` apply: every exit
 * is a `return`, and the whole body is wrapped so nothing here can fail the
 * request that triggered it.
 */
export async function notifyConnectionAccepted(
  connectionId: string,
): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.REMINDER_FROM_EMAIL;
    if (!apiKey || !from) {
      console.error(
        "connection-request-notify: missing RESEND_API_KEY or REMINDER_FROM_EMAIL.",
      );
      return;
    }

    const supabase = createAdminClient();

    const { data: connection, error: connectionError } = await supabase
      .from("connections")
      .select("id, requester_id, addressee_id, status")
      .eq("id", connectionId)
      .maybeSingle<ConnectionRow>();

    if (connectionError || !connection || connection.status !== "accepted") {
      return;
    }

    const { data: preference } = await supabase
      .from("notification_preferences")
      .select("connection_accepted_email_enabled")
      .eq("user_id", connection.requester_id)
      .maybeSingle();

    // A missing row means the column default — opted in.
    if (preference && preference.connection_accepted_email_enabled === false) {
      return;
    }

    const { data: userData, error: userError } =
      await supabase.auth.admin.getUserById(connection.requester_id);
    const to = userData?.user?.email;
    if (userError || !to) {
      console.error(
        "connection-request-notify: no email for requester",
        connection.requester_id,
        userError,
      );
      return;
    }

    const accepterLabel = await loadPersonLabel(
      supabase,
      connection.addressee_id,
    );

    const { subject, html } = formatConnectionAcceptedEmail({
      accepterLabel,
      friendsUrl: await absoluteAppUrl(FRIENDS_PATH),
    });

    const { error: sendError } = await new Resend(apiKey).emails.send({
      from,
      to,
      subject,
      html,
    });
    if (sendError) {
      console.error("connection-request-notify: Resend error (accepted)", sendError);
    }
  } catch (error) {
    console.error(
      "connection-request-notify: unexpected failure (accepted)",
      error,
    );
  }
}

export type ConnectionRequestView = {
  requesterLabel: string;
  /** `pending` means the Accept / Decline buttons should show; `handled` is the terminal state. */
  state: "pending" | "handled";
};

/**
 * What the `/connect/<token>` page needs to render — the requester's name and
 * whether the request is still open. `null` for an unknown token (rotated,
 * mistyped, or never existed), which the page shows as "this link isn't valid".
 */
export async function getConnectionRequestByToken(
  token: string,
): Promise<ConnectionRequestView | null> {
  const supabase = createAdminClient();

  const { data: link } = await supabase
    .from("connection_request_links")
    .select("connection_id, consumed_at")
    .eq("token", token)
    .maybeSingle<Pick<LinkRow, "connection_id" | "consumed_at">>();

  if (!link) {
    return null;
  }

  const { data: connection } = await supabase
    .from("connections")
    .select("requester_id, status")
    .eq("id", link.connection_id)
    .maybeSingle<Pick<ConnectionRow, "requester_id" | "status">>();

  if (!connection) {
    return null;
  }

  return {
    requesterLabel: await loadPersonLabel(supabase, connection.requester_id),
    state:
      link.consumed_at || connection.status !== "pending" ? "handled" : "pending",
  };
}

export type RespondOutcome =
  | "accepted"
  | "declined"
  | "already-handled"
  | "invalid"
  | "failed";

/**
 * Apply an Accept or Decline from a `/connect/<token>` link. Session-less: the
 * token is the authorization. Single-use — a consumed link, or a Connection
 * that has already moved off `pending`, returns `already-handled` rather than
 * acting again.
 *
 * Returns the addressee's id and the Connection id on a successful accept, so
 * the caller can attribute analytics and fire the "request accepted" email
 * without a second read.
 */
export async function respondToConnectionRequest(
  token: string,
  action: ConnectionRequestAction,
): Promise<{
  outcome: RespondOutcome;
  addresseeId?: string;
  connectionId?: string;
}> {
  const supabase = createAdminClient();

  const { data: link } = await supabase
    .from("connection_request_links")
    .select("id, connection_id, consumed_at")
    .eq("token", token)
    .maybeSingle<Pick<LinkRow, "id" | "connection_id" | "consumed_at">>();

  if (!link) {
    return { outcome: "invalid" };
  }

  const { data: connection } = await supabase
    .from("connections")
    .select("id, addressee_id, status")
    .eq("id", link.connection_id)
    .maybeSingle<Pick<ConnectionRow, "id" | "addressee_id" | "status">>();

  if (link.consumed_at || !connection || connection.status !== "pending") {
    return { outcome: "already-handled" };
  }

  if (action === "accept") {
    const { data: updated, error } = await supabase
      .from("connections")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", connection.id)
      .eq("status", "pending")
      .select("id");

    if (error) {
      return { outcome: "failed" };
    }
    if (!updated?.length) {
      return { outcome: "already-handled" };
    }
  } else {
    const { error } = await supabase
      .from("connections")
      .delete()
      .eq("id", connection.id)
      .eq("status", "pending");

    if (error) {
      return { outcome: "failed" };
    }
  }

  // Burn the link whichever way it went. Best-effort — the action above is the
  // real outcome, and the `pending`-status guards already make a double-submit
  // a no-op even if this write is lost.
  await supabase
    .from("connection_request_links")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", link.id)
    .is("consumed_at", null);

  return {
    outcome: action === "accept" ? "accepted" : "declined",
    addresseeId: connection.addressee_id,
    connectionId: connection.id,
  };
}
