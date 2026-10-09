import "server-only";

import { createAdminClient } from "../supabase/admin.ts";
import { deliver, type EmailSend } from "./deliver.ts";
import { emailSenderFromEnv } from "./resend-sender.ts";
import { supabaseAddressLookup } from "./supabase-adapters.ts";

export type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * The emails that keep no send log and count nothing: the Connection Request
 * Email, the Connection Accepted Email and the "it's off" email (spec #610).
 *
 * Resend is checked before `build` runs, so an unconfigured environment logs
 * one warning and skips the reads too. `build` does the caller's reads through
 * the admin client and returns what to send, or `[]` when there's nothing to
 * send (opted out, already handled).
 *
 * Never throws: these all run from `after()`, so a failure is logged under
 * `logTag` and can't fail the request that triggered it.
 */
export async function deliverOneOffEmails(
  logTag: string,
  build: (supabase: AdminClient) => Promise<readonly EmailSend[]>,
): Promise<void> {
  try {
    const sendEmail = emailSenderFromEnv();
    if (!sendEmail) {
      console.warn(`${logTag}: email is not configured, skipping it.`);
      return;
    }

    const supabase = createAdminClient();
    const sends = await build(supabase);

    // Unlogged and uncounted: the result is ignored.
    await deliver(sends, {
      logTag,
      lookupAddress: supabaseAddressLookup(supabase),
      sendEmail,
      sendPush: null,
    });
  } catch (error) {
    console.error(`${logTag}: unexpected failure`, error);
  }
}
