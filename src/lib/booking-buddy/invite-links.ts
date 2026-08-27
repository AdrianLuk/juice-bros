/**
 * Pure logic for personal invite links (issue #175, see CONTEXT.md).
 *
 * A personal invite link is `/booking-buddy/join/<token>`, where the token is
 * a User's own rotatable `profiles.invite_token`. Opening the link connects
 * the visitor to the token's owner — a pending friend request either way, so
 * the owner still accepts.
 *
 * Free of Next.js and Supabase imports on purpose: the token shape mirrors the
 * `invite_token_format` check in the migration, and the two must stay in step.
 */

/**
 * What the migration's `generate_invite_token()` emits — 24 URL-safe base64
 * characters — with a loose lower bound so a hand-rotated value isn't boxed
 * in. Kept identical to `invite_token_format` in
 * `20260827140000_add_profile_invite_token.sql`.
 */
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * The name of the cookie that carries an invite token across the sign-in /
 * sign-up round trip. Set when a signed-out visitor opens a join link and
 * chooses to sign in; read and cleared once by the first authenticated entry
 * point afterward (`consumeInviteCookie`).
 */
export const INVITE_COOKIE = "bb_invite";

/**
 * A week. Long enough to outlast a real email-confirmation gap — the signed-out
 * → sign-up path only consumes the token when the confirmation link finally
 * lands at the auth callback, which can be a day or two later — and short
 * enough that a token clicked and forgotten doesn't auto-connect someone
 * months on.
 */
export const INVITE_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * A token off a URL or a cookie is untrusted input. Returns the trimmed token
 * only if it could be one this app minted; `null` otherwise, so a caller
 * never has to hand a malformed string to the database.
 */
export function parseInviteToken(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  return INVITE_TOKEN_PATTERN.test(trimmed) ? trimmed : null;
}

/** How the owner relates to the person who just opened their link. */
export type InviteRelation =
  | "self"
  | "connected"
  | "request-sent"
  | "request-received"
  | "none";

/**
 * The line shown to a signed-in visitor who opened someone's invite link,
 * given how they already relate to the owner. `none` has no message here —
 * that state renders an actual "send request" button instead.
 */
export function inviteRelationMessage(
  relation: Exclude<InviteRelation, "none">,
  ownerName: string,
): string {
  switch (relation) {
    case "self":
      return "This is your own invite link. Share it with someone you play with.";
    case "connected":
      return `You're already connected with ${ownerName}.`;
    case "request-sent":
      return `Your friend request to ${ownerName} is still pending.`;
    case "request-received":
      return `${ownerName} already sent you a friend request. Accept it on your Friends page.`;
  }
}
