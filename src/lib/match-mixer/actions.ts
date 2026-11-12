"use server";

import { goLive as commit, type Outcome } from "./live-mixers.ts";
import { organizerLinkPath, playerLinkPath } from "./routes.ts";
import { createClient } from "./supabase/server.ts";

/**
 * Go Live, the one call `/tools/match-mixer` makes over the network (ADR
 * 0006). Returns the two links' paths; the browser adds its own origin.
 */
export async function goLive(
  config: string,
): Promise<Outcome<{ organizerPath: string; playerPath: string }>> {
  if (typeof config !== "string") return { ok: false, problem: "That isn't a board." };
  const outcome = await commit(await createClient(), config);
  if (!outcome.ok) return outcome;
  return {
    ok: true,
    value: {
      organizerPath: organizerLinkPath(outcome.value.organizerToken),
      playerPath: playerLinkPath(outcome.value.playerToken),
    },
  };
}
