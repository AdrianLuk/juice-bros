import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { isHost } from "./polls.ts";
import { MIC_DROP_ROOT } from "./routes.ts";
import { createClient } from "./supabase/server.ts";

/**
 * Who is asking, for the Host's pages. `getUser` revalidates the session with
 * Supabase Auth; the proxy's refresh is optimistic only. Guests never come
 * here: the Guest Link token is their credential.
 */
export type Visitor =
  | { kind: "signed-out" }
  | { kind: "not-host" }
  | { kind: "host"; userId: string };

export const getVisitor = cache(async (): Promise<Visitor> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "signed-out" };
  return (await isHost(supabase))
    ? { kind: "host", userId: user.id }
    : { kind: "not-host" };
});

/** For pages only a Host may see; anyone else goes to the front door, which says why. */
export async function verifyHost(): Promise<void> {
  if ((await getVisitor()).kind !== "host") redirect(MIC_DROP_ROOT);
}
