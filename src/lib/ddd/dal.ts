import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { isOrganizer } from "./organizers.ts";
import { DDD_ROOT } from "./routes.ts";
import { createClient } from "./supabase/server.ts";

/**
 * Who is asking, for the Organizer's pages. `getUser` revalidates the session
 * with Supabase Auth; the proxy's refresh is optimistic only. Score Link and
 * Public Link holders never come here: the token is their credential.
 */
export type Visitor =
  | { kind: "signed-out" }
  | { kind: "not-organizer"; email: string | undefined }
  | { kind: "organizer"; email: string | undefined };

export const getVisitor = cache(async (): Promise<Visitor> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "signed-out" };
  return (await isOrganizer(supabase))
    ? { kind: "organizer", email: user.email }
    : { kind: "not-organizer", email: user.email };
});

/** For pages only an Organizer may see; anyone else goes to the front door, which says why. */
export async function verifyOrganizer(): Promise<void> {
  if ((await getVisitor()).kind !== "organizer") redirect(DDD_ROOT);
}
