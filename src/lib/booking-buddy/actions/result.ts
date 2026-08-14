/**
 * What every Booking Buddy Server Action hands back, and how they report a
 * failed read.
 *
 * Deliberately not a `"use server"` module: it holds a type and a plain
 * helper, neither of which is an action, and both of which more than one
 * action file needs.
 */

export type ActionResult = { error?: string; ok?: boolean };

/**
 * A read failed. Thrown rather than returned, because there is no honest way
 * to render it inline: an empty list reads as "you have nothing here", which
 * is a lie the User has no way to see through — an outage and a schema that
 * had never been deployed both once rendered as a calm empty state. The
 * route's error boundary shows a real error and a retry instead.
 */
export function readFailed(what: string, error: unknown): never {
  console.error(`booking-buddy: reading ${what} failed`, error);
  throw new Error(`Could not read ${what}`);
}
