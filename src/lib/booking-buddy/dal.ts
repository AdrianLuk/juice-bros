import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "./supabase/server.ts";
import { SIGN_IN_PATH } from "./routes.ts";

/**
 * Booking Buddy's Data Access Layer.
 *
 * Next.js treats the proxy's auth check as optimistic only — it reads the
 * cookie without validating it. This is the real boundary: it verifies the
 * session against Supabase Auth, and every Server Action and Server Component
 * that touches a User's data should start here.
 *
 * `cache` dedupes the check within a single render pass, so a layout and the
 * page beneath it don't each pay for a round trip.
 */
export type Session = {
  userId: string;
  email: string | undefined;
};

/**
 * The signed-in User, or null. Use this where being signed out is a legitimate
 * state to render — the sign-in page itself, or a Slot Link open to Guests.
 */
export const getOptionalSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();

  // getUser revalidates the token with Supabase Auth. getSession only decodes
  // whatever is in the cookie, which the browser could have tampered with.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? { userId: user.id, email: user.email } : null;
});

/** The signed-in User, or a redirect to sign-in. */
export const verifySession = cache(async (): Promise<Session> => {
  const session = await getOptionalSession();

  if (!session) {
    redirect(SIGN_IN_PATH);
  }

  return session;
});
