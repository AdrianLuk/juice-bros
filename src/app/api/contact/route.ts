import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";

import { contactReasons, isContactReason } from "@/lib/contact";

export const runtime = "nodejs";

const MAX_NAME_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Minimum time (ms) between the form rendering and a submission landing -
// bots that fill and submit instantly get quietly rejected.
const MIN_SUBMIT_MS = 1500;

// Best-effort per-IP rate limit. Lives in module memory, so it only holds
// within a single warm serverless instance - it's a speed bump against
// simple spam scripts, not a hard guarantee.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const submissionsByIp = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (submissionsByIp.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  timestamps.push(now);
  submissionsByIp.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX;
}

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderContactEmail({
  name,
  email,
  reasonLabel,
  message,
}: {
  name: string;
  email: string;
  reasonLabel: string;
  message: string;
}): string {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeReason = escapeHtml(reasonLabel);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
      <tr>
        <td style="background-color:#111827;padding:20px 28px;">
          <p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">New message from: ${safeEmail}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;color:#71717a;font-size:13px;width:80px;vertical-align:top;">Name:</td>
              <td style="padding:6px 0;color:#18181b;font-size:14px;">${safeName}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#71717a;font-size:13px;vertical-align:top;">Email:</td>
              <td style="padding:6px 0;color:#18181b;font-size:14px;">
                <a href="mailto:${safeEmail}" style="color:#2563eb;text-decoration:none;">${safeEmail}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#71717a;font-size:13px;vertical-align:top;">Type:</td>
              <td style="padding:6px 0;">
                <span style="display:inline-block;background-color:#eef2ff;color:#4338ca;font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;">${safeReason}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 28px;">
          <p style="margin:16px 0 8px;color:#71717a;font-size:13px;">Message:</p>
          <div style="background-color:#f9fafb;border:1px solid #e4e4e7;border-radius:8px;padding:16px;color:#27272a;font-size:14px;line-height:1.6;white-space:pre-wrap;">${safeMessage}</div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

type ContactPayload = {
  name: string;
  email: string;
  reason: string;
  message: string;
  company?: string; // honeypot - real users never fill this in
  startedAt?: number;
};

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many submissions - please try again in a bit." },
      { status: 429 },
    );
  }

  let body: ContactPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, email, reason, message, company, startedAt } = body;

  // Honeypot tripped - pretend success so bots don't learn to skip the field.
  if (company) {
    return NextResponse.json({ ok: true });
  }

  if (typeof startedAt === "number" && Date.now() - startedAt < MIN_SUBMIT_MS) {
    return NextResponse.json({ ok: true });
  }

  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.length > MAX_NAME_LENGTH ||
    typeof email !== "string" ||
    !EMAIL_PATTERN.test(email) ||
    !isContactReason(reason) ||
    typeof message !== "string" ||
    !message.trim() ||
    message.length > MAX_MESSAGE_LENGTH
  ) {
    return NextResponse.json({ error: "Please fill out every field." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = process.env.CONTACT_TO_EMAIL;

  if (!apiKey || !to || !from) {
    console.error("Contact form is missing RESEND_API_KEY, CONTACT_TO_EMAIL, or CONTACT_FROM_EMAIL.");
    return NextResponse.json(
      { error: "Something went wrong on our end. Try again shortly." },
      { status: 500 },
    );
  }

  const reasonLabel = contactReasons.find((r) => r.value === reason)?.label ?? reason;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    replyTo: email,
    subject: `Juice Bros contact form: ${reasonLabel}`,
    html: renderContactEmail({ name, email, reasonLabel, message }),
  });

  if (error) {
    console.error("Resend error:", error);
    return NextResponse.json(
      { error: "Something went wrong sending your message. Try again shortly." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
