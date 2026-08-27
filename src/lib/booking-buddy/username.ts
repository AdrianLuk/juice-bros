/**
 * Pure logic for choosing a Username (see CONTEXT.md).
 *
 * The rules mirror the database exactly — the `username_format` check
 * constraint and the unique index on `lower(username)` in the `add_username`
 * migration. This module exists so the User gets a sentence explaining what is
 * wrong instead of a constraint violation; the database stays the authority.
 * Change one and you must change the other.
 *
 * Kept free of Next.js and Supabase imports so it can be unit tested directly.
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

const USERNAME_PATTERN = new RegExp(
  `^[a-z0-9_]{${USERNAME_MIN_LENGTH},${USERNAME_MAX_LENGTH}}$`,
);

export type ParsedUsername = { username: string } | { error: string };

/**
 * Normalises and checks a handle someone typed.
 *
 * Case and surrounding space are normalised away, because the uniqueness index
 * ignores case and storing `AmyAce` while matching `amyace` is a difference
 * nobody would expect. Everything else is rejected rather than stripped:
 * signup strips, because it is inventing a handle nobody chose, but here a
 * person typed something specific and quietly handing them a different handle
 * is worse than telling them no.
 */
export function parseUsername(raw: string): ParsedUsername {
  const username = raw.trim().toLowerCase();

  if (!username) {
    return { error: "Pick a username. It's how friends find you." };
  }

  if (username.length < USERNAME_MIN_LENGTH) {
    return {
      error: `Usernames need at least ${USERNAME_MIN_LENGTH} characters.`,
    };
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return {
      error: `Usernames can be at most ${USERNAME_MAX_LENGTH} characters.`,
    };
  }

  if (!USERNAME_PATTERN.test(username)) {
    return {
      error: "Usernames can only use letters, numbers and underscores.",
    };
  }

  return { username };
}

/**
 * Turns a failed write into something worth reading.
 *
 * Uniqueness is checked by the database, not here: asking first and inserting
 * second leaves a gap where two people can claim the same handle between the
 * two queries. Letting the unique index refuse the write closes that, so the
 * collision arrives as an error code and is translated back here.
 */
export function usernameWriteMessage(error: { code?: string }): string {
  switch (error.code) {
    case "23505":
      return "That username is taken. Try another.";
    case "23514":
      return "Usernames can only use letters, numbers and underscores.";
    default:
      return "Couldn't save that. Try again.";
  }
}
