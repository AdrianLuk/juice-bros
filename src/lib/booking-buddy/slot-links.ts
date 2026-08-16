/**
 * Pure logic for Slot Links and Guest RSVPs (see CONTEXT.md, issue #10).
 *
 * Free of Next.js and Supabase imports on purpose. The limits mirror the
 * `slot_links`/`guest_rsvp_log` migration — change one and you must change
 * the other.
 */

import { randomBytes } from "node:crypto";

import { isResponseAnswer, type ResponseAnswer } from "./responses.ts";

export const GUEST_NAME_MAX_LENGTH = 60;

/**
 * Prior Guest RSVPs from the same IP against the same Slot Link, at or past
 * which a new one gets flagged in `guest_rsvp_log` rather than blocked (Q7:
 * logging and soft-threshold flagging only, no CAPTCHA or hard rate limit).
 */
export const GUEST_RSVP_SOFT_THRESHOLD = 3;

/**
 * A crypto-random, unguessable token — the primary protection on a Slot Link
 * per CLAUDE.md's Guest RSVP abuse-handling decision (no CAPTCHA, no hard
 * rate limit, so the token itself carries the weight). 24 bytes of entropy,
 * base64url so it drops cleanly into a URL path with no escaping.
 */
export function generateSlotLinkToken(): string {
  return randomBytes(24).toString("base64url");
}

export function slotLinkWriteMessage(error: { code?: string } | null): string {
  // `42501`: RLS filtered the insert — reachable only through a stale or
  // tampered form, since the UI never offers another User's Slot.
  if (error?.code === "42501") {
    return "You can only create an invite link for your own slot.";
  }

  return "Couldn't create an invite link. Try again.";
}

export type GuestRsvp = {
  token: string;
  guestName: string;
  answer: ResponseAnswer;
};

/**
 * Input handling for a Guest's RSVP form. The token travels as a hidden form
 * field (it's already public — it's the URL the Guest is on), but it is never
 * trusted on its own: `guestRespondViaLink` looks it up against `slot_links`
 * server-side before writing anything.
 */
export function parseGuestRsvp(formData: FormData): GuestRsvp | { error: string } {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) {
    return { error: "This invite link is missing its token." };
  }

  const guestName = String(formData.get("guest_name") ?? "").trim();
  if (!guestName) {
    return { error: "Enter your name." };
  }

  if (guestName.length > GUEST_NAME_MAX_LENGTH) {
    return {
      error: `That name is too long — ${GUEST_NAME_MAX_LENGTH} characters at most.`,
    };
  }

  const answer = formData.get("answer");
  if (!isResponseAnswer(answer)) {
    return { error: "Pick yes, no, or maybe." };
  }

  return { token, guestName, answer };
}

export type GuestRsvpFailure = "invalid_token" | "write_failed";

export function guestRsvpMessage(reason: GuestRsvpFailure): string {
  switch (reason) {
    case "invalid_token":
      return "This invite link isn't valid. Ask the organizer for a new one.";
    case "write_failed":
      return "Couldn't record your RSVP. Try again.";
  }
}
