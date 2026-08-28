import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";

import {
  getInstagramToken,
  shouldRefreshToken,
  writeInstagramToken,
} from "@/lib/instagram-token";

export const runtime = "nodejs";

const REFRESH_ENDPOINT = "https://graph.instagram.com/refresh_access_token";

type RefreshResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

/**
 * Keeps the Instagram feed's long-lived token alive.
 *
 * Instagram long-lived tokens last 60 days; `refresh_access_token` resets that
 * to another 60, but only for a token that's between 24 hours and 60 days old.
 * Fired by Vercel Cron (`vercel.json`), this route rotates the stored token
 * once it's within `REFRESH_LEAD_DAYS` of expiry and writes the new value to
 * Edge Config, where the running deployment reads it
 * (see docs/adr/0003-instagram-token-in-edge-config.md).
 *
 * Cadence tolerance: the lead window is 14 days wide, so any daily-ish run
 * catches it with room to spare. `vercel.json`'s schedule is once a day
 * (Vercel Hobby only invokes crons daily) and nothing here assumes more —
 * a token that isn't close to expiry is a no-op, so extra runs are cheap.
 * Upgrading the schedule later is a one-line change with no code impact.
 *
 * On failure it emails `INSTAGRAM_ALERT_EMAIL` (falling back to
 * `CONTACT_TO_EMAIL`) via Resend: a silently dead token just makes the feed
 * vanish from the homepage with no other signal.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("refresh-instagram-token: CRON_SECRET is not configured.");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const stored = await getInstagramToken();
  if (!stored) {
    // Nothing wired up yet (no Edge Config value, no env token) — not an error.
    return NextResponse.json({ ok: true, skipped: "no-token" });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!shouldRefreshToken(stored.expiresAt, nowSeconds)) {
    return NextResponse.json({ ok: true, skipped: "not-due" });
  }

  try {
    const params = new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: stored.token,
    });
    const res = await fetch(`${REFRESH_ENDPOINT}?${params}`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(
        `refresh_access_token responded ${res.status}: ${await res.text().catch(() => "")}`,
      );
    }

    const body = (await res.json()) as RefreshResponse;
    if (!body.access_token || !body.expires_in) {
      throw new Error(`refresh_access_token returned an unexpected body: ${JSON.stringify(body)}`);
    }

    await writeInstagramToken({
      token: body.access_token,
      expiresAt: nowSeconds + body.expires_in,
    });

    return NextResponse.json({ ok: true, refreshed: true, expiresIn: body.expires_in });
  } catch (error) {
    console.error("refresh-instagram-token: refresh failed", error);
    await sendFailureEmail(error);
    return NextResponse.json({ error: "Refresh failed." }, { status: 502 });
  }
}

async function sendFailureEmail(error: unknown): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL ?? process.env.REMINDER_FROM_EMAIL;
  const to = process.env.INSTAGRAM_ALERT_EMAIL ?? process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !from || !to) {
    console.error(
      "refresh-instagram-token: can't send failure email — Resend env not configured.",
    );
    return;
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to,
      subject: "Instagram feed token refresh failed",
      text:
        "The scheduled Instagram token refresh failed. The homepage and Contact " +
        "feed will go blank once the current token expires. Mint a new one with " +
        "`node scripts/instagram-token.mts` (see docs/instagram-feed-setup.md).\n\n" +
        `${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
    });
  } catch (sendError) {
    console.error("refresh-instagram-token: the failure email itself failed", sendError);
  }
}
