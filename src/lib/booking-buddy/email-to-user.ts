import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";

/** Sends one email to one User by id. Resolves `true` only once Resend has accepted it. */
export type EmailToUser = (
  userId: string,
  message: { subject: string; html: string },
) => Promise<boolean>;

/**
 * The Resend loop the Standing Game emails share (the Weekly Invite and the
 * "it's off" email): check the env once, then per recipient look the address
 * up through the admin API (no table in this schema exposes one) and send.
 *
 * `null` when RESEND_API_KEY or REMINDER_FROM_EMAIL is missing, logged once
 * under `logTag`; the caller decides whether that ends its run or only its
 * email channel. Each failed lookup or send is logged and reported as
 * `false`, never thrown, so one bad address doesn't stop the rest.
 *
 * Takes the admin (`service_role`) client: `auth.admin.getUserById` needs it.
 */
export function emailToUserFromEnv(
  supabase: SupabaseClient,
  logTag: string,
): EmailToUser | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;
  if (!apiKey || !from) {
    console.error(`${logTag}: missing RESEND_API_KEY or REMINDER_FROM_EMAIL, skipping email.`);
    return null;
  }

  const resend = new Resend(apiKey);
  return async (userId, { subject, html }) => {
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    const to = userData?.user?.email;
    if (userError || !to) {
      console.error(`${logTag}: no email for recipient`, userId, userError);
      return false;
    }

    const { error: sendError } = await resend.emails.send({ from, to, subject, html });
    if (sendError) {
      console.error(`${logTag}: Resend error`, sendError);
      return false;
    }
    return true;
  };
}
