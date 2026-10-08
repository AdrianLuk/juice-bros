import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "./supabase/server.ts";
import { TEAM_TALLY_SIGN_IN_PATH } from "./routes.ts";

/**
 * Team Tally's Data Access Layer for the Organizer.
 *
 * The proxy's check is optimistic only (it reads the cookie without validating
 * it). This is the real boundary: `getUser` revalidates the session with
 * Supabase Auth. Captains and Public Link viewers never reach this; their link
 * token is their credential.
 */
export type Organizer = {
  userId: string;
  email: string | undefined;
};

export const getOptionalOrganizer = cache(async (): Promise<Organizer | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? { userId: user.id, email: user.email } : null;
});

export const verifyOrganizer = cache(async (): Promise<Organizer> => {
  const organizer = await getOptionalOrganizer();
  if (!organizer) {
    redirect(TEAM_TALLY_SIGN_IN_PATH);
  }
  return organizer;
});
