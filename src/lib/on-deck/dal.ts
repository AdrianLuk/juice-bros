import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "./supabase/server.ts";
import { ON_DECK_SIGN_IN_PATH } from "./routes.ts";

/**
 * On Deck's Data Access Layer for the Organizer surface.
 *
 * The proxy's auth check is optimistic only (it reads the cookie without
 * validating it). This is the real boundary: it verifies the session against
 * Supabase Auth. `cache` dedupes the check within a single render pass.
 *
 * Only Organizers authenticate — Players and Volunteers never reach this.
 */
export type Organizer = {
  userId: string;
  email: string | undefined;
};

/** The signed-in Organizer, or null. */
export const getOptionalOrganizer = cache(async (): Promise<Organizer | null> => {
  const supabase = await createClient();

  // getUser revalidates the token with Supabase Auth. getSession only decodes
  // the cookie, which the browser could have tampered with.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? { userId: user.id, email: user.email } : null;
});

/** The signed-in Organizer, or a redirect to sign-in. */
export const verifyOrganizer = cache(async (): Promise<Organizer> => {
  const organizer = await getOptionalOrganizer();

  if (!organizer) {
    redirect(ON_DECK_SIGN_IN_PATH);
  }

  return organizer;
});
