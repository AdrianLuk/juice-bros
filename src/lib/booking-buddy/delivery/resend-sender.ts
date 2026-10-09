import "server-only";

import { Resend } from "resend";

import { readResendEnv, type ResendEnv } from "../env.ts";
import type { EmailSender } from "./deliver.ts";

/** `deliver`'s email port over Resend. One client per sender, reused for every send in the run. */
function resendEmailSender(env: ResendEnv): EmailSender {
  const resend = new Resend(env.apiKey);
  return async ({ to, subject, html }) => {
    const { error } = await resend.emails.send({ from: env.from, to, subject, html });
    return error ? { status: "error", error } : { status: "ok" };
  };
}

/** The email port from RESEND_API_KEY and REMINDER_FROM_EMAIL, or `null` (`deliver` then skips email) when either is unset. */
export function emailSenderFromEnv(): EmailSender | null {
  const env = readResendEnv();
  return env ? resendEmailSender(env) : null;
}
